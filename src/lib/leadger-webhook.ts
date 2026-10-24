import { createHmac, randomUUID } from "node:crypto";
import { heartPrisma } from "./heart-db";

export const LEADGER_SCHEMA_VERSION = 1;
export const MAX_VERSION_INT = 2147483647;
export const MAX_PAYLOAD_BYTES = 256 * 1024; // 256 KiB
export const MAX_INVOICES_PER_BASE_UPSERT = 60;

export type LeadgerPaymentMethod =
  | "pix"
  | "boleto"
  | "credit_card"
  | "bank_transfer"
  | "cash";

export type LeadgerInvoiceStatus = "pending" | "paid" | "cancelled";
export type LeadgerClientStatus = "active" | "inactive";
export type LeadgerBaseStatus = "active" | "paused" | "cancelled";

export interface LeadgerWebhookConfig {
  url: string;
  source: string;
  secret: string;
  configured: boolean;
  photoBaseUrl: string;
  photoEnabled: boolean;
  photoHost: string | null;
}

/**
 * Lê a configuração do emissor a partir das variáveis de ambiente do backend.
 * O segredo nunca é exposto para o navegador ou logs.
 */
export function getLeadgerWebhookConfig(): LeadgerWebhookConfig {
  const url =
    process.env.LEADGER_WEBHOOK_URL?.trim() ||
    "https://leadger.teltech.com.br/api/webhooks/inbound/sistema-amigo";
  const source = process.env.LEADGER_WEBHOOK_SOURCE?.trim() || "sistema-amigo";
  const secret = process.env.LEADGER_WEBHOOK_SECRET?.trim() || "";
  const photoBaseUrl = (
    process.env.LEADGER_PHOTO_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ""
  )
    .trim()
    .replace(/\/+$/, "");

  let photoHost: string | null = null;
  let validHttpsPhotoOrigin = false;
  if (photoBaseUrl) {
    try {
      const parsed = new URL(photoBaseUrl);
      const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(parsed.hostname);
      const isLocal =
        parsed.hostname === "localhost" ||
        parsed.hostname.endsWith(".local") ||
        parsed.hostname === "127.0.0.1";
      if (
        parsed.protocol === "https:" &&
        (!parsed.port || parsed.port === "443") &&
        !isIp &&
        !isLocal
      ) {
        photoHost = parsed.hostname;
        validHttpsPhotoOrigin = true;
      }
    } catch {
      photoHost = null;
    }
  }

  const photoEnabled =
    process.env.LEADGER_WEBHOOK_ENABLE_PHOTO === "true" && validHttpsPhotoOrigin;

  return {
    url,
    source,
    secret,
    configured: Boolean(url && source && secret),
    photoBaseUrl,
    photoEnabled,
    photoHost,
  };
}

/**
 * Sanitiza eventId e externalId para conter apenas [A-Za-z0-9_.:-] com 1..120 caracteres.
 */
export function sanitizeExternalId(raw: string, prefixFallback = "id"): string {
  const cleaned = String(raw || "")
    .trim()
    .replace(/[^A-Za-z0-9_.:-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const finalStr = cleaned || `${prefixFallback}-${randomUUID().slice(0, 8)}`;
  return finalStr.slice(0, 120);
}

export function getClientExternalId(tenant: {
  id: string;
  clientExternalId?: string | null;
}): string {
  return sanitizeExternalId(
    tenant.clientExternalId || `cli-${tenant.id}`,
    "cli"
  );
}

export function getBaseExternalId(tenant: {
  id: string;
  baseExternalId?: string | null;
}): string {
  return sanitizeExternalId(tenant.baseExternalId || `base-${tenant.id}`, "base");
}

export function getInvoiceExternalId(
  tenantId: string,
  referenceMonth: string,
  existingExternalId?: string | null
): string {
  if (existingExternalId) {
    return sanitizeExternalId(existingExternalId, "fat");
  }
  return sanitizeExternalId(`fat-${tenantId}-${referenceMonth}`, "fat");
}

/**
 * Converte valor em reais (Decimal/number/string) para centavos inteiros BRL.
 * R$ 149,90 -> 14990.
 */
export function toCents(value: unknown): number {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.min(Math.round(num * 100), MAX_VERSION_INT);
}

/**
 * Converte centavos inteiros para valor em reais com 2 casas decimais.
 */
export function centsToReais(cents: number): number {
  return Number(((cents || 0) / 100).toFixed(2));
}

/**
 * Formata uma data para YYYY-MM-DD (calendário UTC válido).
 */
export function toDateOnlyString(
  value: Date | string | null | undefined,
  fallback?: string
): string {
  if (!value) {
    return fallback || new Date().toISOString().split("T")[0];
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return fallback || new Date().toISOString().split("T")[0];
  }
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Extrai a competência YYYY-MM de uma data YYYY-MM-DD ou Date.
 */
export function toReferenceMonth(value: Date | string | null | undefined): string {
  const dateStr = toDateOnlyString(value);
  return dateStr.slice(0, 7);
}

/**
 * Avança N meses preservando o dia de vencimento sem overflow de calendário.
 */
export function addMonthsToDateString(
  dateStr: string,
  monthsToAdd: number,
  preferredDay?: number | null
): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const targetDay =
    preferredDay && preferredDay >= 1 && preferredDay <= 31 ? preferredDay : d;
  const base = new Date(Date.UTC(y, m - 1 + monthsToAdd, 1));
  const lastDayOfTargetMonth = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const clampedDay = Math.min(targetDay, lastDayOfTargetMonth);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}-${String(clampedDay).padStart(2, "0")}`;
}

export function mapClientStatus(status?: string | null): LeadgerClientStatus {
  const s = String(status || "active").toLowerCase();
  if (s === "inactive" || s === "cancelled") return "inactive";
  return "active";
}

export function mapBaseStatus(status?: string | null): LeadgerBaseStatus {
  const s = String(status || "active").toLowerCase();
  if (s === "inactive" || s === "cancelled") return "cancelled";
  if (s === "suspended" || s === "paused") return "paused";
  return "active";
}

export function normalizePaymentMethod(
  method?: string | null
): LeadgerPaymentMethod | null {
  if (!method) return null;
  const m = String(method).trim().toLowerCase();
  if (
    m === "pix" ||
    m === "boleto" ||
    m === "credit_card" ||
    m === "bank_transfer" ||
    m === "cash"
  ) {
    return m;
  }
  return null;
}

export function isValidEmail(email?: string | null): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Gera ou valida o token assinado para download público da foto do cliente pelo Leadger.
 */
export function generateLogoSignedToken(
  tenantId: string,
  photoVersion: number
): string {
  const secret =
    process.env.LEADGER_WEBHOOK_SECRET ||
    process.env.JWT_SECRET ||
    "shark-tenant-logo-secret";
  return createHmac("sha256", secret)
    .update(`tenant-logo:${tenantId}:${photoVersion}`)
    .digest("hex");
}

export function buildClientPhotoUrl(
  tenantId: string,
  photoVersion: number
): string | null {
  const cfg = getLeadgerWebhookConfig();
  if (!cfg.photoBaseUrl || !cfg.photoHost || photoVersion <= 0) {
    return null;
  }
  const token = generateLogoSignedToken(tenantId, photoVersion);
  return `${cfg.photoBaseUrl}/api/public/tenants/${encodeURIComponent(
    tenantId
  )}/logo?v=${photoVersion}&sig=${token}`;
}

/**
 * Constrói o snapshot completo do cliente conforme Seções 6, 8 e 11.
 */
export function buildClientSnapshot(
  tenant: any,
  options?: {
    includePhoto?: boolean;
    removePhoto?: boolean;
    fallbackEmail?: string | null;
  }
) {
  const clientName = String(
    tenant.razaoSocial ||
      tenant.nomeFantasia ||
      tenant.name ||
      tenant.databaseName ||
      "Cliente Shark"
  )
    .trim()
    .slice(0, 200);

  const rawEmail = (
    tenant.emailContato ||
    options?.fallbackEmail ||
    tenant.users?.[0]?.email ||
    ""
  )
    .trim()
    .toLowerCase();

  const email = isValidEmail(rawEmail) ? rawEmail : null;
  const document = tenant.cnpj ? String(tenant.cnpj).trim() || null : null;
  const phone =
    (tenant.telefoneContato || tenant.telefone || "").trim() || null;
  const notes = tenant.observacoes ? String(tenant.observacoes).trim() : null;

  const snapshot: Record<string, any> = {
    externalId: getClientExternalId(tenant),
    version: Math.max(1, Number(tenant.clientVersion || 1)),
    name: clientName,
    document,
    email,
    phone,
    status: mapClientStatus(tenant.status),
    notes,
  };

  if (options?.removePhoto) {
    snapshot.photo = null;
  } else if (options?.includePhoto && tenant.logoUrl && tenant.photoVersion > 0) {
    // Se já for uma URL https direta e válida ou se tivermos o endpoint público configurado
    let sourceUrl: string | null = null;
    if (
      typeof tenant.logoUrl === "string" &&
      tenant.logoUrl.startsWith("https://")
    ) {
      sourceUrl = tenant.logoUrl;
    } else {
      sourceUrl = buildClientPhotoUrl(tenant.id, Number(tenant.photoVersion));
    }

    if (sourceUrl) {
      snapshot.photo = {
        sourceUrl,
        version: Math.max(1, Number(tenant.photoVersion)),
      };
    }
  }

  return snapshot;
}

/**
 * Constrói o snapshot completo da base/mensalidade conforme Seção 6.
 */
export function buildBaseSnapshot(tenant: any) {
  const displayName = String(
    tenant.nomeFantasia || tenant.name || tenant.razaoSocial || tenant.databaseName
  ).trim();
  const baseName = `Base ${displayName}`.slice(0, 200);

  const monthlyAmount = toCents(tenant.mensalidadeValor);
  const dueStr = toDateOnlyString(
    tenant.mensalidadeVencimento,
    toDateOnlyString(tenant.createdAt)
  );
  const dueDay = Number(dueStr.split("-")[2]) || 10;
  const billingDay = Math.min(
    31,
    Math.max(1, Number(tenant.billingDay || dueDay || 10))
  );

  const createdDateStr = toDateOnlyString(tenant.createdAt, dueStr);
  const startDate =
    tenant.contractStartDate ||
    (dueStr < createdDateStr ? dueStr : createdDateStr);

  let effectiveDate =
    tenant.effectiveDate || toDateOnlyString(new Date(), startDate);
  if (effectiveDate < startDate) {
    effectiveDate = startDate;
  }

  const endDate =
    tenant.contractEndDate ||
    (mapBaseStatus(tenant.status) === "cancelled"
      ? toDateOnlyString(new Date())
      : null);

  return {
    externalId: getBaseExternalId(tenant),
    version: Math.max(1, Number(tenant.baseVersion || 1)),
    name: baseName,
    monthlyAmount,
    billingDay,
    startDate,
    endDate,
    effectiveDate,
    status: mapBaseStatus(tenant.status),
  };
}

/**
 * Constrói o snapshot completo de uma fatura conforme Seções 6 e 7.
 */
export function buildInvoiceSnapshot(invoice: any, tenantName?: string) {
  const status: LeadgerInvoiceStatus =
    invoice.status === "paid" || invoice.status === "cancelled"
      ? invoice.status
      : "pending";

  const [year, month] = String(invoice.referenceMonth || "2026-01").split("-");
  const defaultDesc = `${tenantName || "Cliente"} — Mensalidade ${month}/${year}`;
  const description = String(invoice.description || defaultDesc)
    .trim()
    .slice(0, 300);

  const paidAt =
    status === "paid"
      ? invoice.paidAt
        ? new Date(invoice.paidAt).toISOString()
        : new Date().toISOString()
      : null;

  const paymentMethod =
    status === "paid" ? normalizePaymentMethod(invoice.paymentMethod) : null;

  return {
    externalId: sanitizeExternalId(invoice.externalId, "fat"),
    version: Math.max(1, Number(invoice.version || 1)),
    description,
    amount: Math.max(1, Number(invoice.amount || 0)),
    dueDate: toDateOnlyString(invoice.dueDate),
    referenceMonth: String(invoice.referenceMonth).slice(0, 7),
    status,
    paidAt,
    paymentMethod,
  };
}

/**
 * Calcula a assinatura HMAC-SHA256 exata especificada na Seção 3:
 * HMAC-SHA256(secret_utf8, `${timestamp}.${source}.${rawBodyUtf8}`)
 */
export function signLeadgerPayload(
  timestamp: string,
  source: string,
  rawBodyUtf8: string,
  secret: string
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${source}.`)
    .update(Buffer.from(rawBodyUtf8, "utf8"))
    .digest("hex");
}

/**
 * Garante que o tenant possua uma fatura inicial/atual para o vencimento vigente,
 * caso tenha mensalidade > 0 configurada.
 */
export async function ensureCurrentTenantInvoice(
  tx: any,
  tenant: any
): Promise<any | null> {
  const amountCents = toCents(tenant.mensalidadeValor);
  if (amountCents <= 0 || !tenant.mensalidadeVencimento) {
    return null;
  }

  const dueDate = toDateOnlyString(tenant.mensalidadeVencimento);
  const referenceMonth = toReferenceMonth(dueDate);
  const [year, month] = referenceMonth.split("-");
  const displayName = String(
    tenant.nomeFantasia || tenant.name || tenant.razaoSocial || tenant.databaseName
  ).trim();
  const description = `${displayName} — Mensalidade ${month}/${year}`.slice(
    0,
    300
  );
  const externalId = getInvoiceExternalId(tenant.id, referenceMonth);

  const existing = await tx.tenantInvoice.findUnique({
    where: {
      tenantId_referenceMonth: {
        tenantId: tenant.id,
        referenceMonth,
      },
    },
  });

  if (existing) {
    return existing;
  }

  return tx.tenantInvoice.create({
    data: {
      tenantId: tenant.id,
      externalId,
      version: 1,
      description,
      amount: amountCents,
      dueDate,
      referenceMonth,
      status: "pending",
      paidAt: null,
      paymentMethod: null,
    },
  });
}

/**
 * Grava um evento `base.upsert` na fila transacional (`webhook_outbox`).
 */
export async function enqueueBaseUpsertEvent(
  tx: any,
  tenant: any,
  invoices: any[],
  options?: { occurredAt?: string; includeInvoicesOnUpdate?: boolean }
) {
  const occurredAt = options?.occurredAt || new Date().toISOString();
  const clientSnapshot = buildClientSnapshot(tenant, { includePhoto: false });
  const baseSnapshot = buildBaseSnapshot(tenant);

  if (baseSnapshot.monthlyAmount <= 0) {
    throw new Error(
      "Não é possível emitir base.upsert com mensalidade igual ou menor que R$ 0,00."
    );
  }

  const displayName = String(
    tenant.nomeFantasia || tenant.name || tenant.razaoSocial || tenant.databaseName
  ).trim();

  const sortedInvoices = [...invoices]
    .filter((inv) => inv.amount > 0)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));

  if (!tenant.leadgerSynced && sortedInvoices.length === 0) {
    throw new Error(
      "Para uma base ainda não vinculada no Leadger, é obrigatório enviar ao menos 1 fatura inicial."
    );
  }

  const initialInvoices = sortedInvoices
    .slice(0, MAX_INVOICES_PER_BASE_UPSERT)
    .map((inv) => buildInvoiceSnapshot(inv, displayName));

  const overflowInvoices = sortedInvoices.slice(MAX_INVOICES_PER_BASE_UPSERT);

  const shortSuffix = randomUUID().slice(0, 8);
  const eventId = sanitizeExternalId(
    `evt-base-${tenant.id.slice(0, 18)}-v${baseSnapshot.version}-${shortSuffix}`,
    "evt-base"
  );

  const eventPayload = {
    schemaVersion: LEADGER_SCHEMA_VERSION,
    eventId,
    eventType: "base.upsert",
    occurredAt,
    data: {
      client: clientSnapshot,
      base: baseSnapshot,
      invoices: initialInvoices,
    },
  };

  const payloadJson = JSON.stringify(eventPayload);

  const outboxItem = await tx.webhookOutbox.create({
    data: {
      tenantId: tenant.id,
      eventId,
      eventType: "base.upsert",
      occurredAt,
      payloadJson,
      clientVersion: clientSnapshot.version,
      baseVersion: baseSnapshot.version,
      status: "pending",
      nextAttemptAt: new Date(),
    },
  });

  // Se houver mais de 60 faturas, enfileira as excedentes individualmente com invoice.upsert
  for (const extraInv of overflowInvoices) {
    await enqueueInvoiceUpsertEvent(tx, tenant, extraInv, { occurredAt });
  }

  return outboxItem;
}

/**
 * Grava um evento `invoice.upsert` na fila transacional (`webhook_outbox`).
 */
export async function enqueueInvoiceUpsertEvent(
  tx: any,
  tenant: any,
  invoice: any,
  options?: { occurredAt?: string }
) {
  const occurredAt = options?.occurredAt || new Date().toISOString();
  const displayName = String(
    tenant.nomeFantasia || tenant.name || tenant.razaoSocial || tenant.databaseName
  ).trim();
  const invoiceSnapshot = buildInvoiceSnapshot(invoice, displayName);
  const baseExternalId = getBaseExternalId(tenant);

  const shortSuffix = randomUUID().slice(0, 8);
  const eventId = sanitizeExternalId(
    `evt-fat-${invoice.id.slice(0, 18)}-v${invoiceSnapshot.version}-${shortSuffix}`,
    "evt-fat"
  );

  const eventPayload = {
    schemaVersion: LEADGER_SCHEMA_VERSION,
    eventId,
    eventType: "invoice.upsert",
    occurredAt,
    data: {
      baseExternalId,
      invoice: invoiceSnapshot,
    },
  };

  const payloadJson = JSON.stringify(eventPayload);

  return tx.webhookOutbox.create({
    data: {
      tenantId: tenant.id,
      invoiceId: invoice.id,
      eventId,
      eventType: "invoice.upsert",
      occurredAt,
      payloadJson,
      invoiceVersion: invoiceSnapshot.version,
      status: "pending",
      nextAttemptAt: new Date(),
    },
  });
}

/**
 * Grava um evento `client.upsert` na fila transacional (`webhook_outbox`).
 */
export async function enqueueClientUpsertEvent(
  tx: any,
  tenant: any,
  options?: {
    occurredAt?: string;
    includePhoto?: boolean;
    removePhoto?: boolean;
    fallbackEmail?: string | null;
  }
) {
  const occurredAt = options?.occurredAt || new Date().toISOString();
  const clientSnapshot = buildClientSnapshot(tenant, {
    includePhoto: options?.includePhoto,
    removePhoto: options?.removePhoto,
    fallbackEmail: options?.fallbackEmail,
  });

  const shortSuffix = randomUUID().slice(0, 8);
  const photoTag = options?.includePhoto
    ? `-photo-v${tenant.photoVersion || 1}`
    : options?.removePhoto
    ? "-photo-rm"
    : "";
  const eventId = sanitizeExternalId(
    `evt-cli-${tenant.id.slice(0, 16)}-v${clientSnapshot.version}${photoTag}-${shortSuffix}`,
    "evt-cli"
  );

  const eventPayload = {
    schemaVersion: LEADGER_SCHEMA_VERSION,
    eventId,
    eventType: "client.upsert",
    occurredAt,
    data: clientSnapshot,
  };

  const payloadJson = JSON.stringify(eventPayload);

  return tx.webhookOutbox.create({
    data: {
      tenantId: tenant.id,
      eventId,
      eventType: "client.upsert",
      occurredAt,
      payloadJson,
      clientVersion: clientSnapshot.version,
      photoVersion:
        options?.includePhoto || options?.removePhoto
          ? Number(tenant.photoVersion || 0)
          : null,
      status: "pending",
      nextAttemptAt: new Date(),
    },
  });
}

/**
 * Calcula o atraso de backoff exponencial com jitter conforme Seção 9:
 * 10s, 30s, 1min, 5min, 15min, 1h + jitter e respeitando Retry-After.
 */
export function computeNextBackoffDate(
  attempts: number,
  retryAfterHeader?: string | null
): Date {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader.trim());
    if (Number.isFinite(seconds) && seconds > 0) {
      const jitterMs = Math.floor(Math.random() * 2000);
      return new Date(Date.now() + seconds * 1000 + jitterMs);
    }
    const parsedDate = new Date(retryAfterHeader);
    if (!Number.isNaN(parsedDate.getTime()) && parsedDate.getTime() > Date.now()) {
      return parsedDate;
    }
  }

  const scheduleSeconds = [10, 30, 60, 300, 900, 3600];
  const idx = Math.min(
    Math.max(0, attempts - 1),
    scheduleSeconds.length - 1
  );
  const baseSec = scheduleSeconds[idx];
  const jitterFactor = 0.85 + Math.random() * 0.3; // 85% a 115%
  const delayMs = Math.round(baseSec * 1000 * jitterFactor);
  return new Date(Date.now() + delayMs);
}

/**
 * Realiza uma tentativa HTTP de entrega para um item da fila `webhook_outbox`.
 * Gera timestamp e assinatura NOVOS em cada retry, mantendo `eventId` e `payloadJson` IDÊNTICOS.
 */
export async function deliverWebhookOutboxItem(itemId: string): Promise<{
  id: string;
  eventId: string;
  eventType: string;
  status: string;
  httpStatus: number | null;
  outcome?: string | null;
  duplicate?: boolean | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}> {
  const item = await heartPrisma.webhookOutbox.findUnique({
    where: { id: itemId },
  });

  if (!item) {
    throw new Error(`Evento de outbox '${itemId}' não encontrado.`);
  }

  if (item.status === "delivered") {
    return {
      id: item.id,
      eventId: item.eventId,
      eventType: item.eventType,
      status: item.status,
      httpStatus: item.lastHttpStatus,
      outcome: item.outcome,
      duplicate: item.duplicate,
    };
  }

  const cfg = getLeadgerWebhookConfig();
  if (!cfg.configured) {
    const msg =
      "Integração não configurada: defina LEADGER_WEBHOOK_URL, LEADGER_WEBHOOK_SOURCE e LEADGER_WEBHOOK_SECRET no ambiente do backend.";
    await heartPrisma.webhookOutbox.update({
      where: { id: item.id },
      data: {
        status: "blocked",
        lastAttemptAt: new Date(),
        lastErrorCode: "missing_configuration",
        lastErrorMessage: msg,
      },
    });
    return {
      id: item.id,
      eventId: item.eventId,
      eventType: item.eventType,
      status: "blocked",
      httpStatus: null,
      errorCode: "missing_configuration",
      errorMessage: msg,
    };
  }

  // Se for invoice.upsert ou client.upsert e houver um base.upsert anterior ainda não entregue para o mesmo tenant,
  // aguarda a entrega da base primeiro (Seção 7 e Seção 9: base_not_synced).
  if (item.tenantId && item.eventType !== "base.upsert") {
    const pendingBaseEvent = await heartPrisma.webhookOutbox.findFirst({
      where: {
        tenantId: item.tenantId,
        eventType: "base.upsert",
        status: { in: ["pending", "retry_scheduled", "processing", "blocked"] },
        createdAt: { lte: item.createdAt },
        id: { not: item.id },
      },
      orderBy: { createdAt: "asc" },
    });

    if (pendingBaseEvent) {
      const waitMsg = `Aguardando confirmação prévia do evento base.upsert (${pendingBaseEvent.eventId}).`;
      await heartPrisma.webhookOutbox.update({
        where: { id: item.id },
        data: {
          status: "retry_scheduled",
          nextAttemptAt: new Date(Date.now() + 15000),
          lastErrorCode: "waiting_base_upsert",
          lastErrorMessage: waitMsg,
        },
      });
      return {
        id: item.id,
        eventId: item.eventId,
        eventType: item.eventType,
        status: "retry_scheduled",
        httpStatus: null,
        errorCode: "waiting_base_upsert",
        errorMessage: waitMsg,
      };
    }
  }

  const payloadBytes = Buffer.byteLength(item.payloadJson, "utf8");
  if (payloadBytes > MAX_PAYLOAD_BYTES) {
    const msg = `Corpo do evento excede o limite de 256 KiB (${payloadBytes} bytes). Divida o lote em eventos individuais.`;
    await heartPrisma.webhookOutbox.update({
      where: { id: item.id },
      data: {
        status: "blocked",
        lastHttpStatus: 413,
        lastErrorCode: "payload_too_large",
        lastErrorMessage: msg,
      },
    });
    return {
      id: item.id,
      eventId: item.eventId,
      eventType: item.eventType,
      status: "blocked",
      httpStatus: 413,
      errorCode: "payload_too_large",
      errorMessage: msg,
    };
  }

  const newAttempts = item.attempts + 1;
  await heartPrisma.webhookOutbox.update({
    where: { id: item.id },
    data: {
      status: "processing",
      attempts: newAttempts,
      lastAttemptAt: new Date(),
    },
  });

  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signLeadgerPayload(
    timestamp,
    cfg.source,
    item.payloadJson,
    cfg.secret
  );

  try {
    const response = await fetch(cfg.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Leadger-Timestamp": timestamp,
        "X-Leadger-Signature": `sha256=${signature}`,
      },
      body: item.payloadJson,
      signal: AbortSignal.timeout(20000),
    });

    const rawResponseText = await response.text();
    let resultado: any = {};
    try {
      resultado = rawResponseText ? JSON.parse(rawResponseText) : {};
    } catch {
      resultado = { raw: rawResponseText.slice(0, 1000) };
    }

    const responseJsonStr = JSON.stringify(resultado).slice(0, 8000);

    // Sucesso confirmado: apenas HTTP 200 com ok === true
    if (response.status === 200 && resultado?.ok === true) {
      const outcome = resultado.outcome || "applied";
      const duplicate = Boolean(resultado.duplicate);

      await heartPrisma.$transaction(async (tx) => {
        await tx.webhookOutbox.update({
          where: { id: item.id },
          data: {
            status: "delivered",
            deliveredAt: new Date(),
            lastHttpStatus: 200,
            lastErrorCode: null,
            lastErrorMessage: null,
            lastResponseJson: responseJsonStr,
            outcome,
            duplicate,
          },
        });

        if (item.tenantId) {
          const tenantUpdate: Record<string, any> = {
            leadgerLastSyncedAt: new Date(),
          };
          if (item.eventType === "base.upsert") {
            tenantUpdate.leadgerSynced = true;
          }
          if (resultado.clientId) {
            tenantUpdate.leadgerClientId = String(resultado.clientId);
          }
          if (resultado.saleItemId) {
            tenantUpdate.leadgerSaleItemId = String(resultado.saleItemId);
          }
          if (resultado.photo?.status === "stored" && resultado.photo?.url) {
            tenantUpdate.leadgerPhotoUrl = String(resultado.photo.url);
          } else if (resultado.photo?.status === "removed") {
            tenantUpdate.leadgerPhotoUrl = null;
          }

          await tx.tenant
            .update({
              where: { id: item.tenantId },
              data: tenantUpdate,
            })
            .catch(() => {});
        }

        if (item.invoiceId && item.invoiceVersion) {
          await tx.tenantInvoice
            .update({
              where: { id: item.invoiceId },
              data: {
                leadgerSyncedVersion: item.invoiceVersion,
                ...(resultado.invoiceId
                  ? { leadgerInvoiceId: String(resultado.invoiceId) }
                  : {}),
              },
            })
            .catch(() => {});
        }
      });

      return {
        id: item.id,
        eventId: item.eventId,
        eventType: item.eventType,
        status: "delivered",
        httpStatus: 200,
        outcome,
        duplicate,
      };
    }

    // Classificação de erros conforme Seção 9 e Seção 11
    const errorCode = String(
      resultado?.error || resultado?.code || `http_${response.status}`
    );
    const errorMessage = String(
      resultado?.message ||
        (Array.isArray(resultado?.issues)
          ? resultado.issues
              .map((i: any) => `${i.path?.join(".") || ""}: ${i.message}`)
              .join("; ")
          : "") ||
        resultado?.error ||
        `HTTP ${response.status}`
    );

    const retryAfterHeader = response.headers.get("retry-after");

    // 429 ou 5xx (incluindo 503 photo_download_failed): reenvio com backoff exponencial + jitter
    if (response.status === 429 || response.status >= 500) {
      const nextAttemptAt = computeNextBackoffDate(
        newAttempts,
        retryAfterHeader
      );
      const nextStatus = newAttempts >= 12 ? "failed" : "retry_scheduled";

      await heartPrisma.webhookOutbox.update({
        where: { id: item.id },
        data: {
          status: nextStatus,
          nextAttemptAt,
          lastHttpStatus: response.status,
          lastErrorCode: errorCode,
          lastErrorMessage: errorMessage,
          lastResponseJson: responseJsonStr,
        },
      });

      return {
        id: item.id,
        eventId: item.eventId,
        eventType: item.eventType,
        status: nextStatus,
        httpStatus: response.status,
        errorCode,
        errorMessage,
      };
    }

    // 400, 401, 404, 409, 413, 415, 422: parar retries cegos e mostrar pendência ao operador
    await heartPrisma.webhookOutbox.update({
      where: { id: item.id },
      data: {
        status: "blocked",
        lastHttpStatus: response.status,
        lastErrorCode: errorCode,
        lastErrorMessage: errorMessage,
        lastResponseJson: responseJsonStr,
      },
    });

    return {
      id: item.id,
      eventId: item.eventId,
      eventType: item.eventType,
      status: "blocked",
      httpStatus: response.status,
      errorCode,
      errorMessage,
    };
  } catch (networkErr: any) {
    const errMsg =
      networkErr?.name === "TimeoutError" ||
      networkErr?.message?.includes("timeout")
        ? "Timeout de 20s ao aguardar resposta do Leadger (pode ter ocorrido commit; manteremos o mesmo eventId para retry seguro)."
        : networkErr?.message || "Erro de rede ao conectar ao Leadger.";

    const nextAttemptAt = computeNextBackoffDate(newAttempts, null);
    const nextStatus = newAttempts >= 12 ? "failed" : "retry_scheduled";

    await heartPrisma.webhookOutbox.update({
      where: { id: item.id },
      data: {
        status: nextStatus,
        nextAttemptAt,
        lastHttpStatus: null,
        lastErrorCode: "network_or_timeout",
        lastErrorMessage: errMsg,
      },
    });

    return {
      id: item.id,
      eventId: item.eventId,
      eventType: item.eventType,
      status: nextStatus,
      httpStatus: null,
      errorCode: "network_or_timeout",
      errorMessage: errMsg,
    };
  }
}

/**
 * Worker de processamento da fila Outbox.
 * Respeita a ordem de criação e garante que `base.upsert` seja entregue antes de `invoice.upsert`.
 */
export async function processWebhookOutboxBatch(options?: {
  limit?: number;
  tenantId?: string;
  includeBlocked?: boolean;
}) {
  const limit = Math.min(50, Math.max(1, options?.limit || 20));
  const now = new Date();

  const statuses = options?.includeBlocked
    ? ["pending", "retry_scheduled", "blocked", "failed"]
    : ["pending", "retry_scheduled"];

  const items = await heartPrisma.webhookOutbox.findMany({
    where: {
      ...(options?.tenantId ? { tenantId: options.tenantId } : {}),
      status: { in: statuses },
      ...(options?.includeBlocked ? {} : { nextAttemptAt: { lte: now } }),
    },
    orderBy: [{ createdAt: "asc" }],
    take: limit,
  });

  // Prioriza base.upsert antes de invoice.upsert/client.upsert do mesmo tenant
  const sorted = [...items].sort((a, b) => {
    if (a.tenantId === b.tenantId) {
      if (a.eventType === "base.upsert" && b.eventType !== "base.upsert")
        return -1;
      if (b.eventType === "base.upsert" && a.eventType !== "base.upsert")
        return 1;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const results = [];
  for (const item of sorted) {
    const res = await deliverWebhookOutboxItem(item.id);
    results.push(res);
  }

  return {
    processedCount: results.length,
    results,
  };
}

/**
 * Dispara o processamento em background sem bloquear a resposta da API local.
 */
export function triggerOutboxWorkerAsync(tenantId?: string) {
  const cfg = getLeadgerWebhookConfig();
  if (!cfg.configured) return;

  setTimeout(() => {
    processWebhookOutboxBatch({ limit: 10, tenantId }).catch((err) => {
      console.error("[LeadgerOutboxWorker] Erro no processamento assíncrono:", err);
    });
  }, 50);
}
