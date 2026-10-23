import { tenantStorage } from "./tenant-manager";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(
    process.env.JWT_SECRET || "solucoes-financeiras-super-secret-key-2026"
  );
}

export async function resolveCurrentTenantId(): Promise<string> {
  const store = tenantStorage.getStore();
  if (store?.tenantId) return store.tenantId;

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("sol_auth_token")?.value;
    if (token) {
      const { payload } = await jwtVerify(token, getJwtSecret());
      if (payload.tenantId) return String(payload.tenantId);
    }
  } catch (_) {}

  return "default";
}

export function getWhatsappApiUrl(): string {
  let url = process.env.WHATSAPP_API_URL || "http://179.127.59.225:3529";
  url = url.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, "");
}

export async function sendWhatsappMessage(
  phone: string,
  text: string,
  tenantId?: string
): Promise<{ success: boolean; error?: string }> {
  if (!phone || !text) {
    return { success: false, error: "Telefone ou texto inválido." };
  }

  const WHATSAPP_API = getWhatsappApiUrl();
  const targetTenant = tenantId || (await resolveCurrentTenantId());

  try {
    const res = await fetch(`${WHATSAPP_API}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": targetTenant,
      },
      body: JSON.stringify({
        tenantId: targetTenant,
        messages: [{ phone, text }],
      }),
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data?.error || `Status HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err: any) {
    console.error(`[WhatsApp tenant=${targetTenant}] Erro ao enviar mensagem:`, err?.message || err);
    return {
      success: false,
      error: err?.message || "Falha de conexão com o servidor do WhatsApp.",
    };
  }
}

export async function sendWhatsappDocument(
  phone: string,
  base64Data: string,
  fileName: string = "cronograma.pdf",
  caption?: string,
  tenantId?: string
): Promise<{ success: boolean; error?: string }> {
  if (!phone || !base64Data) {
    return { success: false, error: "Telefone ou documento inválido." };
  }

  const WHATSAPP_API = getWhatsappApiUrl();
  const targetTenant = tenantId || (await resolveCurrentTenantId());

  try {
    const res = await fetch(`${WHATSAPP_API}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": targetTenant,
      },
      body: JSON.stringify({
        tenantId: targetTenant,
        messages: [
          {
            phone,
            document: base64Data,
            mimetype: "application/pdf",
            fileName,
            caption: caption || "",
          },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data?.error || `Status HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err: any) {
    console.error(`[WhatsApp tenant=${targetTenant}] Erro ao enviar documento:`, err?.message || err);
    return {
      success: false,
      error: err?.message || "Falha de conexão com o servidor do WhatsApp.",
    };
  }
}

export async function getWhatsappStatus(tenantId?: string): Promise<{
  tenantId: string;
  status: "connected" | "qr" | "connecting" | "disconnected";
  qr?: string | null;
  user?: any;
  error?: string;
}> {
  const targetTenant = tenantId || (await resolveCurrentTenantId());
  const WHATSAPP_API = getWhatsappApiUrl();
  try {
    const res = await fetch(`${WHATSAPP_API}/status?tenantId=${encodeURIComponent(targetTenant)}`, {
      cache: "no-store",
      headers: { "x-tenant-id": targetTenant },
    });
    const data = await res.json();
    return { tenantId: targetTenant, ...data };
  } catch (err: any) {
    return {
      tenantId: targetTenant,
      status: "disconnected",
      error: err?.message || "Serviço WhatsApp offline",
    };
  }
}
