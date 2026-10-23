const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
} = require("@whiskeysockets/baileys");
const http = require("http");
const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");

/**
 * Baileys Multi-Tenant WhatsApp Service
 * 
 * Cada tenant possui sua própria pasta de credenciais em:
 *   /app/auth_info_baileys/<tenantId>/
 * E sua própria conexão de socket WhatsApp isolada e independente.
 */

const BASE_AUTH_DIR = path.join(__dirname, "auth_info_baileys");

// Map<tenantId, { tenantId, sock, connectionStatus, lastQr, isResetting, reconnectDelay, userInfo }>
const sessions = new Map();

function sanitizeTenantId(id) {
  if (!id || typeof id !== "string") return "default";
  const clean = id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  return clean || "default";
}

function getTenantAuthDir(tenantId) {
  const tid = sanitizeTenantId(tenantId);
  return path.join(BASE_AUTH_DIR, tid);
}

function destroyTenantSocket(tenantId) {
  const tid = sanitizeTenantId(tenantId);
  const session = sessions.get(tid);
  if (session && session.sock) {
    try {
      session.sock.ev.removeAllListeners();
      session.sock.end();
    } catch (_) {}
    session.sock = null;
  }
}

function clearTenantAuthFiles(tenantId) {
  const authDir = getTenantAuthDir(tenantId);
  if (fs.existsSync(authDir)) {
    const entries = fs.readdirSync(authDir);
    for (const entry of entries) {
      const fullPath = path.join(authDir, entry);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          fs.unlinkSync(fullPath);
        }
      } catch (e) {
        console.error(`[${tenantId}] Error removing auth file:`, fullPath, e.message);
      }
    }
  }
}

function migrateLegacyAuthIfNeeded() {
  if (!fs.existsSync(BASE_AUTH_DIR)) {
    fs.mkdirSync(BASE_AUTH_DIR, { recursive: true });
    return;
  }
  const legacyCreds = path.join(BASE_AUTH_DIR, "creds.json");
  if (fs.existsSync(legacyCreds)) {
    const defaultDir = path.join(BASE_AUTH_DIR, "default");
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }
    const files = fs.readdirSync(BASE_AUTH_DIR);
    for (const file of files) {
      const full = path.join(BASE_AUTH_DIR, file);
      if (fs.statSync(full).isFile()) {
        fs.renameSync(full, path.join(defaultDir, file));
      }
    }
    console.log("[Baileys Multi-Tenant] Migradas credenciais legacy para auth_info_baileys/default/");
  }
}

async function connectTenant(tenantId) {
  const tid = sanitizeTenantId(tenantId);
  let session = sessions.get(tid);
  if (!session) {
    session = {
      tenantId: tid,
      sock: null,
      connectionStatus: "disconnected",
      lastQr: null,
      isResetting: false,
      reconnectDelay: 3000,
      userInfo: null,
    };
    sessions.set(tid, session);
  }

  if (session.isResetting) return session;

  const authDir = getTenantAuthDir(tid);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  try {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys),
      },
      printQRInTerminal: false,
      defaultQueryTimeoutMs: undefined,
    });
    session.sock = sock;

    sock.ev.on("connection.update", async (update) => {
      if (session.isResetting) return;

      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        session.connectionStatus = "qr";
        try {
          session.lastQr = await QRCode.toDataURL(qr);
        } catch (err) {
          console.error(`[${tid}] Failed to generate QR data URL:`, err);
        }
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`[${tid}] Connection closed, reconnecting: ${shouldReconnect} | delay: ${session.reconnectDelay}ms`);

        if (session.isResetting) return;

        session.connectionStatus = "disconnected";
        session.lastQr = null;

        if (shouldReconnect) {
          const delay = session.reconnectDelay;
          session.reconnectDelay = Math.min(session.reconnectDelay * 2, 60000);
          setTimeout(() => connectTenant(tid), delay);
        } else {
          session.reconnectDelay = 3000;
          console.log(`[${tid}] Logged out from WhatsApp. Clearing auth and generating new QR.`);
          clearTenantAuthFiles(tid);
          setTimeout(() => connectTenant(tid), 2000);
        }
      } else if (connection === "open") {
        session.reconnectDelay = 3000;
        session.connectionStatus = "connected";
        session.lastQr = null;
        session.userInfo = sock.user || null;
        console.log(`[${tid}] WhatsApp conectado com sucesso! Número: ${sock.user?.id || "desconhecido"}`);
      } else if (connection === "connecting") {
        if (session.lastQr) {
          session.connectionStatus = "qr";
        } else {
          session.connectionStatus = "connecting";
        }
      }
    });

    sock.ev.on("creds.update", saveCreds);
  } catch (err) {
    console.error(`[${tid}] Erro ao conectar ao WhatsApp:`, err.message);
    session.connectionStatus = "disconnected";
  }

  return session;
}

async function resolveWhatsAppJid(sock, phone) {
  let clean = (phone || "").replace(/\D/g, "");
  if (!clean.startsWith("55") && (clean.length === 10 || clean.length === 11)) {
    clean = "55" + clean;
  }

  if (!clean.startsWith("55") || clean.length < 12 || clean.length > 13) {
    return clean + "@s.whatsapp.net";
  }

  const ddd = clean.slice(2, 4);
  const rest = clean.slice(4);
  const candidates = [];

  if (rest.length === 9 && rest.startsWith("9")) {
    candidates.push(clean);                       // com 9 dígitos
    candidates.push(`55${ddd}${rest.slice(1)}`); // sem 9 dígitos
  } else if (rest.length === 8) {
    candidates.push(`55${ddd}9${rest}`);         // com 9 dígitos
    candidates.push(clean);                       // sem 9 dígitos
  } else {
    candidates.push(clean);
  }

  if (sock && typeof sock.onWhatsApp === "function") {
    try {
      const results = await sock.onWhatsApp(...candidates);
      if (Array.isArray(results) && results.length > 0) {
        const found = results.find(r => r.exists && r.jid);
        if (found) {
          return found.jid;
        }
      }
    } catch (err) {
      console.warn(`[WhatsApp] Falha ao consultar onWhatsApp para ${phone}:`, err.message);
    }
  }

  return candidates[0] + "@s.whatsapp.net";
}

// Auto-restore das sessões existentes em disco
function autoRestoreSavedSessions() {
  migrateLegacyAuthIfNeeded();
  if (fs.existsSync(BASE_AUTH_DIR)) {
    const entries = fs.readdirSync(BASE_AUTH_DIR);
    for (const entry of entries) {
      const full = path.join(BASE_AUTH_DIR, entry);
      try {
        if (fs.statSync(full).isDirectory()) {
          const credsFile = path.join(full, "creds.json");
          if (fs.existsSync(credsFile)) {
            console.log(`[Baileys Multi-Tenant] Auto-restaurando sessão salva para tenant: '${entry}'...`);
            connectTenant(entry).catch(err => {
              console.error(`[${entry}] Falha no auto-restore:`, err.message);
            });
          }
        }
      } catch (_) {}
    }
  }
}

autoRestoreSavedSessions();

// Servidor HTTP Multi-Tenant
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-tenant-id");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname.replace(/\/+/g, "/");

  // Helper para obter tenantId da requisição (Query > Header > 'default')
  function extractTenantId(req, url) {
    const q = url.searchParams.get("tenantId") || url.searchParams.get("tenant_id");
    if (q) return sanitizeTenantId(q);
    const h = req.headers["x-tenant-id"];
    if (h) return sanitizeTenantId(h);
    return "default";
  }

  // Health check
  if (pathname === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      activeSessions: sessions.size,
      tenants: Array.from(sessions.keys()),
      timestamp: Date.now(),
    }));
    return;
  }

  // Listar todas as sessões ativas (para o Super Admin no Sys-Init)
  if ((pathname === "/sessions" || pathname === "/tenants") && req.method === "GET") {
    const list = Array.from(sessions.values()).map(s => ({
      tenantId: s.tenantId,
      status: s.connectionStatus,
      hasQr: !!s.lastQr,
      user: s.userInfo,
    }));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ sessions: list }));
    return;
  }

  // Status de um tenant específico: GET /status?tenantId=xxx
  if (pathname === "/status" && req.method === "GET") {
    const tid = extractTenantId(req, url);
    let session = sessions.get(tid);

    // Se a sessão ainda não existir ou nunca tiver tentado conectar, inicia agora para gerar o QR
    if (!session || session.connectionStatus === "disconnected") {
      session = await connectTenant(tid);
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      tenantId: tid,
      status: session.connectionStatus,
      qr: session.lastQr,
      user: session.userInfo,
    }));
    return;
  }

  // Desconectar/Logout de um tenant específico: POST /logout
  if (pathname === "/logout" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        let tid = extractTenantId(req, url);
        if (body) {
          try {
            const data = JSON.parse(body);
            if (data.tenantId || data.tenant_id) {
              tid = sanitizeTenantId(data.tenantId || data.tenant_id);
            }
          } catch (_) {}
        }

        const session = sessions.get(tid) || { tenantId: tid, reconnectDelay: 3000 };
        session.isResetting = true;
        session.connectionStatus = "disconnected";
        session.lastQr = null;
        session.userInfo = null;

        destroyTenantSocket(tid);
        await new Promise(resolve => setTimeout(resolve, 500));
        clearTenantAuthFiles(tid);

        session.reconnectDelay = 3000;
        session.isResetting = false;

        setTimeout(() => connectTenant(tid), 500);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, tenantId: tid }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Enviar mensagens: POST /send
  if (pathname === "/send" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const data = JSON.parse(body || "{}");
        const tid = sanitizeTenantId(data.tenantId || data.tenant_id || extractTenantId(req, url));
        const { messages } = data;

        if (!messages || !Array.isArray(messages)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid payload format. Expected 'messages' array." }));
          return;
        }

        const session = sessions.get(tid);
        if (!session || session.connectionStatus !== "connected" || !session.sock) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            error: `WhatsApp não está conectado para este tenant (${tid}). Escaneie o QR Code nas configurações.`,
            tenantId: tid,
            status: session?.connectionStatus || "disconnected"
          }));
          return;
        }

        const logs = [];
        for (const item of messages) {
          const jid = await resolveWhatsAppJid(session.sock, item.phone);
          console.log(`[${tid}] Enviando mensagem para: ${jid}`);

          if (item.document) {
            const docBuffer = Buffer.isBuffer(item.document)
              ? item.document
              : Buffer.from(item.document, "base64");
            await session.sock.sendMessage(jid, {
              document: docBuffer,
              mimetype: item.mimetype || "application/pdf",
              fileName: item.fileName || "cronograma.pdf",
              caption: item.caption || item.text || undefined,
            });
          } else {
            await session.sock.sendMessage(jid, { text: item.text });
          }

          logs.push({ phone: item.phone, jid, status: "sent" });
          // Delay de 2s para evitar restrições de anti-spam do WhatsApp
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, tenantId: tid, logs }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
});

const PORT = process.env.PORT || 3529;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`[Baileys Multi-Tenant] Servidor rodando em 0.0.0.0:${PORT}`);
});
