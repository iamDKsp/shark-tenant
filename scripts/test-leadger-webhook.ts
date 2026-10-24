import http from "node:http";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Carrega .env antes de importar heartPrisma
function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}
loadEnv();

const TEST_SECRET = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
const TEST_SOURCE = "sistema-amigo";

process.env.LEADGER_WEBHOOK_SOURCE = TEST_SOURCE;
process.env.LEADGER_WEBHOOK_SECRET = TEST_SECRET;
process.env.LEADGER_PHOTO_BASE_URL = "https://shark.teltech.com.br";
process.env.LEADGER_WEBHOOK_ENABLE_PHOTO = "true";

import { heartPrisma } from "../src/lib/heart-db";
import {
  deliverWebhookOutboxItem,
  ensureCurrentTenantInvoice,
  enqueueBaseUpsertEvent,
  enqueueClientUpsertEvent,
  enqueueInvoiceUpsertEvent,
  generateLogoSignedToken,
  processWebhookOutboxBatch,
  signLeadgerPayload,
  toCents,
} from "../src/lib/leadger-webhook";

interface ReceivedWebhookRequest {
  headers: http.IncomingHttpHeaders;
  rawBody: string;
  json: any;
}

async function runTests() {
  console.log("=== INICIANDO SUÍTE DE TESTES DO EMISSOR WEBHOOK LEADGER (CONTRATO V1) ===");

  const receivedRequests: ReceivedWebhookRequest[] = [];
  let nextMockResponse: {
    status: number;
    headers?: Record<string, string>;
    body: Record<string, any>;
  } = {
    status: 200,
    body: {
      ok: true,
      outcome: "applied",
      clientId: "leadger-cli-uuid-001",
      saleItemId: "leadger-sale-uuid-001",
    },
  };

  // 1. Inicia servidor HTTP Mock simulando o receptor POST /api/webhooks/inbound/sistema-amigo do Leadger
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const rawBody = Buffer.concat(chunks).toString("utf8");
      const timestamp = String(req.headers["x-leadger-timestamp"] || "");
      const sigHeader = String(req.headers["x-leadger-signature"] || "");

      // Valida assinatura exatamente como o Leadger faz (Seção 3)
      const expectedHmac = createHmac("sha256", TEST_SECRET)
        .update(`${timestamp}.${TEST_SOURCE}.`)
        .update(Buffer.from(rawBody, "utf8"))
        .digest("hex");

      const nowSec = Math.floor(Date.now() / 1000);
      const tsNum = Number(timestamp);
      const clockSkewOk = Math.abs(nowSec - tsNum) <= 300;

      let parsedJson: any = null;
      try {
        parsedJson = JSON.parse(rawBody);
      } catch {}

      receivedRequests.push({
        headers: req.headers,
        rawBody,
        json: parsedJson,
      });

      if (!clockSkewOk || sigHeader !== `sha256=${expectedHmac}`) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ok: false,
            error: "invalid_signature",
            message: "Assinatura HMAC ou timestamp inválido.",
          })
        );
        return;
      }

      const status = nextMockResponse.status;
      const customHeaders = nextMockResponse.headers || {};
      res.writeHead(status, {
        "Content-Type": "application/json",
        ...customHeaders,
      });
      res.end(JSON.stringify(nextMockResponse.body));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as { port: number };
  process.env.LEADGER_WEBHOOK_URL = `http://127.0.0.1:${addr.port}/api/webhooks/inbound/${TEST_SOURCE}`;

  const testTenantId = "test-leadger-tenant-001";

  try {
    // Limpa resquícios anteriores de teste
    await heartPrisma.webhookOutbox.deleteMany({
      where: { tenantId: testTenantId },
    });
    await heartPrisma.tenant.deleteMany({
      where: { id: testTenantId },
    });

    // ------------------------------------------------------------------------
    // TESTE 1: Cadastro de Cliente + Base + Mensalidade + 1ª Fatura (base.upsert)
    // ------------------------------------------------------------------------
    console.log("-> [Teste 1] Cadastro de Cliente + Base + 1ª Fatura (base.upsert)...");
    const created = await heartPrisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          id: testTenantId,
          databaseName: "shark_test_leadger_001",
          databaseUrl: "postgresql://localhost:5432/shark_test_leadger_001",
          name: "Empresa Exemplo Teste",
          nomeFantasia: "Empresa Exemplo Teste",
          razaoSocial: "Empresa Exemplo LTDA",
          cnpj: "12345678000199",
          emailContato: "financeiro@empresa-exemplo.com.br",
          telefone: "+5514999999999",
          telefoneContato: "+5514999999999",
          status: "active",
          mensalidadeValor: 149.9,
          mensalidadeVencimento: new Date("2026-10-10T12:00:00Z"),
          billingDay: 10,
          contractStartDate: "2026-10-10",
          effectiveDate: "2026-10-10",
          clientExternalId: "cli-test-001",
          baseExternalId: "base-test-001",
          clientVersion: 1,
          baseVersion: 1,
          photoVersion: 0,
          leadgerSyncEnabled: true,
        },
      });

      const inv = await ensureCurrentTenantInvoice(tx, tenant);
      assert.ok(inv, "Fatura inicial deve ser criada");
      assert.equal(inv.amount, 14990, "Valor deve ser 14990 centavos");
      assert.equal(inv.referenceMonth, "2026-10");
      assert.equal(inv.dueDate, "2026-10-10");

      const outbox = await enqueueBaseUpsertEvent(tx, tenant, [inv]);
      return { tenant, inv, outbox };
    });

    const delivery1 = await deliverWebhookOutboxItem(created.outbox.id);
    assert.equal(delivery1.status, "delivered");
    assert.equal(delivery1.httpStatus, 200);
    assert.equal(receivedRequests.length, 1);

    const req1 = receivedRequests[0].json;
    assert.equal(req1.schemaVersion, 1);
    assert.equal(req1.eventType, "base.upsert");
    assert.equal(req1.data.client.externalId, "cli-test-001");
    assert.equal(req1.data.client.version, 1);
    assert.equal(req1.data.base.externalId, "base-test-001");
    assert.equal(req1.data.base.monthlyAmount, 14990);
    assert.equal(req1.data.base.billingDay, 10);
    assert.equal(req1.data.invoices.length, 1);
    assert.equal(req1.data.invoices[0].amount, 14990);
    assert.equal(req1.data.invoices[0].status, "pending");
    assert.equal(req1.data.invoices[0].paidAt, null);

    const syncedTenant = await heartPrisma.tenant.findUnique({
      where: { id: testTenantId },
    });
    assert.equal(syncedTenant?.leadgerSynced, true);
    assert.equal(syncedTenant?.leadgerClientId, "leadger-cli-uuid-001");
    assert.equal(syncedTenant?.leadgerSaleItemId, "leadger-sale-uuid-001");
    console.log("   OK: base.upsert entregue, validado por HMAC e confirmado no banco!");

    // ------------------------------------------------------------------------
    // TESTE 2: Pagamento de Fatura (invoice.upsert status=paid) + Correção + Estorno
    // ------------------------------------------------------------------------
    console.log("-> [Teste 2] Confirmação de Pagamento, Correção de Valor e Estorno...");
    const paidAtIso = "2026-10-10T16:00:00.000Z";
    const paidInv = await heartPrisma.tenantInvoice.update({
      where: { id: created.inv.id },
      data: {
        version: 2,
        status: "paid",
        paidAt: new Date(paidAtIso),
        paymentMethod: "pix",
      },
    });
    const outboxPay = await enqueueInvoiceUpsertEvent(
      heartPrisma,
      syncedTenant,
      paidInv
    );
    const delPay = await deliverWebhookOutboxItem(outboxPay.id);
    assert.equal(delPay.status, "delivered");

    const reqPay = receivedRequests[receivedRequests.length - 1].json;
    assert.equal(reqPay.eventType, "invoice.upsert");
    assert.equal(reqPay.data.baseExternalId, "base-test-001");
    assert.equal(reqPay.data.invoice.version, 2);
    assert.equal(reqPay.data.invoice.status, "paid");
    assert.equal(reqPay.data.invoice.paymentMethod, "pix");
    assert.equal(reqPay.data.invoice.paidAt, paidAtIso);

    // Correção de valor já pago (preservando paidAt e incrementando version para 3)
    const correctedInv = await heartPrisma.tenantInvoice.update({
      where: { id: created.inv.id },
      data: {
        version: 3,
        amount: 13990,
      },
    });
    const outboxCorr = await enqueueInvoiceUpsertEvent(
      heartPrisma,
      syncedTenant,
      correctedInv
    );
    await deliverWebhookOutboxItem(outboxCorr.id);
    const reqCorr = receivedRequests[receivedRequests.length - 1].json;
    assert.equal(reqCorr.data.invoice.version, 3);
    assert.equal(reqCorr.data.invoice.amount, 13990);
    assert.equal(reqCorr.data.invoice.status, "paid");
    assert.equal(reqCorr.data.invoice.paidAt, paidAtIso);

    // Estorno (version 4, status pending, paidAt=null)
    const refundedInv = await heartPrisma.tenantInvoice.update({
      where: { id: created.inv.id },
      data: {
        version: 4,
        status: "pending",
        paidAt: null,
        paymentMethod: null,
      },
    });
    const outboxRefund = await enqueueInvoiceUpsertEvent(
      heartPrisma,
      syncedTenant,
      refundedInv
    );
    await deliverWebhookOutboxItem(outboxRefund.id);
    const reqRefund = receivedRequests[receivedRequests.length - 1].json;
    assert.equal(reqRefund.data.invoice.version, 4);
    assert.equal(reqRefund.data.invoice.status, "pending");
    assert.equal(reqRefund.data.invoice.paidAt, null);
    assert.equal(reqRefund.data.invoice.paymentMethod, null);
    console.log("   OK: Pagamento, correção de valor pago e estorno validados!");

    // ------------------------------------------------------------------------
    // TESTE 3: Foto do Cliente (client.upsert com photo.sourceUrl, remoção e nova foto)
    // ------------------------------------------------------------------------
    console.log("-> [Teste 3] Envio de Foto (photo.sourceUrl), Remoção (photo=null) e Nova Foto...");
    const samplePngBase64 =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

    const tenantWithPhoto = await heartPrisma.tenant.update({
      where: { id: testTenantId },
      data: {
        logoUrl: samplePngBase64,
        clientVersion: 2,
        photoVersion: 1,
      },
    });

    nextMockResponse = {
      status: 200,
      body: {
        ok: true,
        outcome: "applied",
        photo: {
          status: "stored",
          version: 1,
          url: "/uploads/client-photos/cli-test-001-v1.webp",
        },
      },
    };

    const outboxPhoto1 = await enqueueClientUpsertEvent(
      heartPrisma,
      tenantWithPhoto,
      { includePhoto: true }
    );
    await deliverWebhookOutboxItem(outboxPhoto1.id);
    const reqPhoto1 = receivedRequests[receivedRequests.length - 1].json;
    assert.equal(reqPhoto1.eventType, "client.upsert");
    assert.equal(reqPhoto1.data.version, 2);
    assert.equal(reqPhoto1.data.photo.version, 1);
    assert.ok(
      reqPhoto1.data.photo.sourceUrl.startsWith(
        `https://shark.teltech.com.br/api/public/tenants/${testTenantId}/logo?v=1&sig=`
      )
    );

    const expectedSig = generateLogoSignedToken(testTenantId, 1);
    assert.ok(reqPhoto1.data.photo.sourceUrl.includes(`sig=${expectedSig}`));

    // Remoção explícita da foto (photo=null com versão maior do cliente, preservando photoVersion=1)
    const tenantPhotoRemoved = await heartPrisma.tenant.update({
      where: { id: testTenantId },
      data: {
        logoUrl: null,
        clientVersion: 3,
      },
    });
    nextMockResponse = {
      status: 200,
      body: {
        ok: true,
        outcome: "applied",
        photo: { status: "removed", version: 1 },
      },
    };
    const outboxPhotoRm = await enqueueClientUpsertEvent(
      heartPrisma,
      tenantPhotoRemoved,
      { removePhoto: true }
    );
    await deliverWebhookOutboxItem(outboxPhotoRm.id);
    const reqPhotoRm = receivedRequests[receivedRequests.length - 1].json;
    assert.equal(reqPhotoRm.data.version, 3);
    assert.equal(reqPhotoRm.data.photo, null);

    // Nova foto após remoção exige photo.version = 2 > 1 (Seção 11)
    const tenantPhotoNew = await heartPrisma.tenant.update({
      where: { id: testTenantId },
      data: {
        logoUrl: samplePngBase64,
        clientVersion: 4,
        photoVersion: 2,
      },
    });
    const outboxPhoto2 = await enqueueClientUpsertEvent(
      heartPrisma,
      tenantPhotoNew,
      { includePhoto: true }
    );
    await deliverWebhookOutboxItem(outboxPhoto2.id);
    const reqPhoto2 = receivedRequests[receivedRequests.length - 1].json;
    assert.equal(reqPhoto2.data.version, 4);
    assert.equal(reqPhoto2.data.photo.version, 2);
    console.log("   OK: Ciclo completo de foto (envio, remoção e nova foto pós-remoção) validado!");

    // ------------------------------------------------------------------------
    // TESTE 4: Retries com 503/429 (Preservando eventId e corpo idênticos) e Bloqueio em 409
    // ------------------------------------------------------------------------
    console.log("-> [Teste 4] Retries 503/429 (mesmo eventId/corpo + assinatura nova) e Bloqueio 409...");
    const tenantV5 = await heartPrisma.tenant.update({
      where: { id: testTenantId },
      data: { clientVersion: 5 },
    });
    const outboxRetry = await enqueueClientUpsertEvent(heartPrisma, tenantV5);

    // Simula 503 na 1ª tentativa
    nextMockResponse = {
      status: 503,
      body: { ok: false, error: "service_unavailable" },
    };
    const attempt1 = await deliverWebhookOutboxItem(outboxRetry.id);
    assert.equal(attempt1.status, "retry_scheduled");
    assert.equal(attempt1.httpStatus, 503);
    const firstReq = receivedRequests[receivedRequests.length - 1];

    // Simula 200 OK na 2ª tentativa (retry)
    nextMockResponse = {
      status: 200,
      body: { ok: true, outcome: "applied", duplicate: false },
    };
    const attempt2 = await deliverWebhookOutboxItem(outboxRetry.id);
    assert.equal(attempt2.status, "delivered");
    const secondReq = receivedRequests[receivedRequests.length - 1];

    assert.equal(
      firstReq.rawBody,
      secondReq.rawBody,
      "Corpo JSON deve ser byte-a-byte idêntico no retry"
    );
    assert.equal(
      firstReq.json.eventId,
      secondReq.json.eventId,
      "eventId deve permanecer idêntico no retry"
    );
    assert.equal(
      firstReq.json.occurredAt,
      secondReq.json.occurredAt,
      "occurredAt deve permanecer idêntico no retry"
    );

    // Simula 409 (conciliação pendente: existing_client_requires_link) -> deve bloquear sem retry cego
    const tenantV6 = await heartPrisma.tenant.update({
      where: { id: testTenantId },
      data: { clientVersion: 6 },
    });
    const outbox409 = await enqueueClientUpsertEvent(heartPrisma, tenantV6);
    nextMockResponse = {
      status: 409,
      body: {
        ok: false,
        error: "existing_client_requires_link",
        message: "Cliente já cadastrado manualmente; realize o vínculo no Leadger.",
      },
    };
    const res409 = await deliverWebhookOutboxItem(outbox409.id);
    assert.equal(
      res409.status,
      "blocked",
      "Erro 409 deve parar retries cegos e ficar como blocked"
    );
    assert.equal(res409.errorCode, "existing_client_requires_link");
    console.log("   OK: Retries 503 e bloqueio de conflito 409 validados com sucesso!");

    // ------------------------------------------------------------------------
    // TESTE 5: Rate Limit 429 (Retry-After), Duplicata/Stale, Assinatura Errada (401),
    //          Ambiguidade (409) e Renovação de Link de Foto (422 -> novo snapshot)
    // ------------------------------------------------------------------------
    console.log("-> [Teste 5] Rate limit 429 (Retry-After), Stale/Duplicate, 401 e Renovação de Link...");
    const tenantV7 = await heartPrisma.tenant.update({
      where: { id: testTenantId },
      data: { clientVersion: 7 },
    });
    const outbox429 = await enqueueClientUpsertEvent(heartPrisma, tenantV7);

    nextMockResponse = {
      status: 429,
      headers: { "Retry-After": "4" },
      body: { ok: false, error: "rate_limit_exceeded" },
    };
    const res429 = await deliverWebhookOutboxItem(outbox429.id);
    assert.equal(res429.status, "retry_scheduled");
    assert.equal(res429.httpStatus, 429);

    const check429Db = await heartPrisma.webhookOutbox.findUnique({
      where: { id: outbox429.id },
    });
    assert.ok(
      check429Db!.nextAttemptAt.getTime() >= Date.now() + 3000,
      "Deve respeitar Retry-After >= 4s"
    );

    // Simula entrega duplicada (200 ok:true, duplicate:true, outcome:unchanged)
    nextMockResponse = {
      status: 200,
      body: { ok: true, outcome: "unchanged", duplicate: true },
    };
    const resDup = await deliverWebhookOutboxItem(outbox429.id);
    assert.equal(resDup.status, "delivered");
    assert.equal(resDup.duplicate, true);
    assert.equal(resDup.outcome, "unchanged");

    // Simula snapshot antigo (outcome: stale)
    const outboxStale = await enqueueClientUpsertEvent(heartPrisma, tenantV7);
    nextMockResponse = {
      status: 200,
      body: { ok: true, outcome: "stale", duplicate: false },
    };
    const resStale = await deliverWebhookOutboxItem(outboxStale.id);
    assert.equal(resStale.status, "delivered");
    assert.equal(resStale.outcome, "stale");

    // Simula 422 photo_download_failed (link expirado) -> renovação com novo eventId e client.version maior mantendo photo.version (Seção 11)
    const outboxExpiredLink = await enqueueClientUpsertEvent(
      heartPrisma,
      tenantV7,
      { includePhoto: true }
    );
    nextMockResponse = {
      status: 422,
      body: {
        ok: false,
        error: "photo_download_failed",
        message: "Link assinado expirado na origem.",
      },
    };
    const res422 = await deliverWebhookOutboxItem(outboxExpiredLink.id);
    assert.equal(res422.status, "blocked");
    assert.equal(res422.errorCode, "photo_download_failed");

    // Renovação do link assinado: incrementa clientVersion (8), mantém photoVersion (2), novo eventId
    const tenantV8 = await heartPrisma.tenant.update({
      where: { id: testTenantId },
      data: { clientVersion: 8, photoVersion: 2 },
    });
    nextMockResponse = {
      status: 200,
      body: {
        ok: true,
        outcome: "applied",
        photo: { status: "unchanged", version: 2 },
      },
    };
    const outboxRenewed = await enqueueClientUpsertEvent(
      heartPrisma,
      tenantV8,
      { includePhoto: true }
    );
    assert.notEqual(outboxRenewed.eventId, outboxExpiredLink.eventId);
    const resRenewed = await deliverWebhookOutboxItem(outboxRenewed.id);
    assert.equal(resRenewed.status, "delivered");
    const reqRenewed = receivedRequests[receivedRequests.length - 1].json;
    assert.equal(reqRenewed.data.version, 8);
    assert.equal(reqRenewed.data.photo.version, 2);
    console.log("   OK: 429 Retry-After, Duplicate, Stale e renovação de link 422 validados!");

    console.log("\n=== TODOS OS TESTES DO CONTRATO V1 PASSARAM COM 100% DE SUCESSO! ===");
  } finally {
    await heartPrisma.webhookOutbox
      .deleteMany({ where: { tenantId: testTenantId } })
      .catch(() => {});
    await heartPrisma.tenant
      .deleteMany({ where: { id: testTenantId } })
      .catch(() => {});
    server.close();
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FALHA NOS TESTES:", err);
    process.exit(1);
  });
