import { NextRequest, NextResponse } from "next/server";
import { verifySetupPin } from "@/lib/setup-auth";
import { heartPrisma } from "@/lib/heart-db";
import {
  centsToReais,
  deliverWebhookOutboxItem,
  ensureCurrentTenantInvoice,
  enqueueBaseUpsertEvent,
  enqueueClientUpsertEvent,
  enqueueInvoiceUpsertEvent,
  getBaseExternalId,
  getClientExternalId,
  getLeadgerWebhookConfig,
  processWebhookOutboxBatch,
  toCents,
  toDateOnlyString,
} from "@/lib/leadger-webhook";

export async function GET(request: NextRequest) {
  const pinError = verifySetupPin(request);
  if (pinError) return pinError;

  try {
    const cfg = getLeadgerWebhookConfig();
    const { searchParams } = request.nextUrl;
    const tenantIdFilter = searchParams.get("tenantId") || undefined;
    const statusFilter = searchParams.get("status") || undefined;

    const [
      tenants,
      outboxItems,
      pendingCount,
      retryCount,
      deliveredCount,
      blockedCount,
      failedCount,
    ] = await Promise.all([
      heartPrisma.tenant.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          users: { select: { email: true, name: true }, take: 1 },
          invoices: { orderBy: { dueDate: "desc" } },
        },
      }),
      heartPrisma.webhookOutbox.findMany({
        where: {
          ...(tenantIdFilter ? { tenantId: tenantIdFilter } : {}),
          ...(statusFilter && statusFilter !== "all"
            ? { status: statusFilter }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              nomeFantasia: true,
              databaseName: true,
              cnpj: true,
              emailContato: true,
            },
          },
        },
      }),
      heartPrisma.webhookOutbox.count({ where: { status: "pending" } }),
      heartPrisma.webhookOutbox.count({ where: { status: "retry_scheduled" } }),
      heartPrisma.webhookOutbox.count({ where: { status: "delivered" } }),
      heartPrisma.webhookOutbox.count({ where: { status: "blocked" } }),
      heartPrisma.webhookOutbox.count({ where: { status: "failed" } }),
    ]);

    const reconciliation = tenants.map((t) => {
      const monthlyAmountCents = toCents(t.mensalidadeValor);
      const dueStr = t.mensalidadeVencimento
        ? toDateOnlyString(t.mensalidadeVencimento)
        : null;
      const email =
        t.emailContato || t.users?.[0]?.email || null;

      return {
        id: t.id,
        databaseName: t.databaseName,
        name: t.nomeFantasia || t.name || t.razaoSocial || t.databaseName,
        razaoSocial: t.razaoSocial || null,
        document: t.cnpj || null,
        email,
        phone: t.telefoneContato || t.telefone || null,
        status: t.status,
        clientExternalId: getClientExternalId(t),
        baseExternalId: getBaseExternalId(t),
        clientVersion: t.clientVersion,
        baseVersion: t.baseVersion,
        photoVersion: t.photoVersion,
        hasLogo: Boolean(t.logoUrl),
        monthlyAmountCents,
        monthlyAmountReais: centsToReais(monthlyAmountCents),
        billingDay:
          t.billingDay || (dueStr ? Number(dueStr.split("-")[2]) : null),
        dueDate: dueStr,
        leadgerSyncEnabled: t.leadgerSyncEnabled,
        leadgerSynced: t.leadgerSynced,
        leadgerClientId: t.leadgerClientId,
        leadgerSaleItemId: t.leadgerSaleItemId,
        leadgerPhotoUrl: t.leadgerPhotoUrl,
        leadgerLastSyncedAt: t.leadgerLastSyncedAt,
        readyForBaseUpsert: monthlyAmountCents > 0 && Boolean(dueStr),
        invoicesCount: t.invoices.length,
        invoices: t.invoices.map((inv) => ({
          id: inv.id,
          externalId: inv.externalId,
          version: inv.version,
          referenceMonth: inv.referenceMonth,
          dueDate: inv.dueDate,
          amountCents: inv.amount,
          amountReais: centsToReais(inv.amount),
          status: inv.status,
          paidAt: inv.paidAt,
          paymentMethod: inv.paymentMethod,
        })),
      };
    });

    return NextResponse.json({
      config: {
        url: cfg.url,
        source: cfg.source,
        configured: cfg.configured,
        photoBaseUrl: cfg.photoBaseUrl,
        photoHost: cfg.photoHost,
        photoEnabled: cfg.photoEnabled,
      },
      stats: {
        totalOutbox:
          pendingCount +
          retryCount +
          deliveredCount +
          blockedCount +
          failedCount,
        pending: pendingCount,
        retryScheduled: retryCount,
        delivered: deliveredCount,
        blocked: blockedCount,
        failed: failedCount,
        syncedTenants: tenants.filter((t) => t.leadgerSynced).length,
        enabledTenants: tenants.filter((t) => t.leadgerSyncEnabled).length,
        totalTenants: tenants.length,
      },
      outbox: outboxItems,
      reconciliation,
    });
  } catch (error: any) {
    console.error("GET /api/tenants/setup/leadger error:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao carregar painel Leadger." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const pinError = verifySetupPin(request);
  if (pinError) return pinError;

  try {
    const body = await request.json().catch(() => ({}));
    const { action } = body;

    // ------------------------------------------------------------------
    // 1. SINCRONIZAR UM TENANT ESPECÍFICO (base.upsert + faturas)
    // ------------------------------------------------------------------
    if (action === "sync_tenant") {
      const { tenantId, includePhoto = false, deliverNow = true } = body;
      if (!tenantId) {
        return NextResponse.json(
          { error: "tenantId é obrigatório." },
          { status: 400 }
        );
      }

      const tenant = await heartPrisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          users: { select: { email: true }, take: 1 },
          invoices: { orderBy: { dueDate: "asc" } },
        },
      });

      if (!tenant) {
        return NextResponse.json(
          { error: "Tenant não encontrado." },
          { status: 404 }
        );
      }

      const amountCents = toCents(tenant.mensalidadeValor);
      if (amountCents <= 0 || !tenant.mensalidadeVencimento) {
        return NextResponse.json(
          {
            error:
              "Configure um valor de mensalidade maior que R$ 0,00 e uma data de vencimento na aba Financeiro antes de sincronizar a base com o Leadger.",
          },
          { status: 422 }
        );
      }

      const outboxCreated = await heartPrisma.$transaction(async (tx) => {
        const updatedTenant = await tx.tenant.update({
          where: { id: tenant.id },
          data: {
            leadgerSyncEnabled: true,
            clientExternalId: getClientExternalId(tenant),
            baseExternalId: getBaseExternalId(tenant),
            ...(tenant.leadgerSynced
              ? { baseVersion: Number(tenant.baseVersion || 1) + 1 }
              : {}),
            ...(tenant.logoUrl && Number(tenant.photoVersion || 0) === 0
              ? { photoVersion: 1 }
              : {}),
          },
          include: { users: { select: { email: true }, take: 1 } },
        });

        await ensureCurrentTenantInvoice(tx, updatedTenant);

        const allInvoices = await tx.tenantInvoice.findMany({
          where: { tenantId: tenant.id },
          orderBy: { dueDate: "asc" },
        });

        const baseEvent = await enqueueBaseUpsertEvent(
          tx,
          updatedTenant,
          allInvoices
        );

        let photoEvent = null;
        if (includePhoto && updatedTenant.logoUrl) {
          const nextClientVer = Number(updatedTenant.clientVersion || 1) + 1;
          const nextPhotoVer = Math.max(
            1,
            Number(updatedTenant.photoVersion || 1)
          );
          const tenantWithPhotoVer = await tx.tenant.update({
            where: { id: tenant.id },
            data: {
              clientVersion: nextClientVer,
              photoVersion: nextPhotoVer,
            },
            include: { users: { select: { email: true }, take: 1 } },
          });
          photoEvent = await enqueueClientUpsertEvent(tx, tenantWithPhotoVer, {
            includePhoto: true,
          });
        }

        return { baseEvent, photoEvent };
      });

      let deliveryResult = null;
      if (deliverNow) {
        deliveryResult = await processWebhookOutboxBatch({
          tenantId: tenant.id,
          limit: 10,
        });
      }

      return NextResponse.json({
        success: true,
        message: `Evento base.upsert (${outboxCreated.baseEvent.eventId}) enfileirado para '${
          tenant.nomeFantasia || tenant.name
        }'.`,
        outboxCreated,
        deliveryResult,
      });
    }

    // ------------------------------------------------------------------
    // 2. SINCRONIZAR APENAS CLIENTE / FOTO (client.upsert)
    // ------------------------------------------------------------------
    if (action === "sync_client" || action === "sync_photo") {
      const {
        tenantId,
        includePhoto = action === "sync_photo",
        removePhoto = false,
        bumpPhotoVersion = false,
        deliverNow = true,
      } = body;

      if (!tenantId) {
        return NextResponse.json(
          { error: "tenantId é obrigatório." },
          { status: 400 }
        );
      }

      const tenant = await heartPrisma.tenant.findUnique({
        where: { id: tenantId },
        include: { users: { select: { email: true }, take: 1 } },
      });

      if (!tenant) {
        return NextResponse.json(
          { error: "Tenant não encontrado." },
          { status: 404 }
        );
      }

      const outboxEvent = await heartPrisma.$transaction(async (tx) => {
        const nextClientVersion = Number(tenant.clientVersion || 1) + 1;
        let nextPhotoVersion = Number(tenant.photoVersion || 0);
        if (includePhoto && !removePhoto) {
          if (nextPhotoVersion === 0 || bumpPhotoVersion) {
            nextPhotoVersion += 1;
          }
        }

        const updatedTenant = await tx.tenant.update({
          where: { id: tenant.id },
          data: {
            clientExternalId: getClientExternalId(tenant),
            clientVersion: nextClientVersion,
            photoVersion: nextPhotoVersion,
            ...(removePhoto ? { logoUrl: null } : {}),
          },
          include: { users: { select: { email: true }, take: 1 } },
        });

        return enqueueClientUpsertEvent(tx, updatedTenant, {
          includePhoto,
          removePhoto,
        });
      });

      let deliveryResult = null;
      if (deliverNow) {
        deliveryResult = await deliverWebhookOutboxItem(outboxEvent.id);
      }

      return NextResponse.json({
        success: true,
        message: `Evento client.upsert (${outboxEvent.eventId}) gerado!`,
        outboxEvent,
        deliveryResult,
      });
    }

    // ------------------------------------------------------------------
    // 3. CARGA INICIAL PAGINADA EM LOTE (Seção 10 — máx 25 por lote)
    // ------------------------------------------------------------------
    if (action === "sync_batch") {
      const { tenantIds, limit = 20, deliverNow = true } = body;
      const batchLimit = Math.min(30, Math.max(1, Number(limit || 20)));

      const candidates = await heartPrisma.tenant.findMany({
        where: {
          ...(Array.isArray(tenantIds) && tenantIds.length > 0
            ? { id: { in: tenantIds } }
            : {}),
        },
        include: {
          users: { select: { email: true }, take: 1 },
        },
        orderBy: { createdAt: "asc" },
        take: batchLimit,
      });

      const enqueued: string[] = [];
      const skipped: Array<{ id: string; name: string; reason: string }> = [];

      for (const t of candidates) {
        const cents = toCents(t.mensalidadeValor);
        if (cents <= 0 || !t.mensalidadeVencimento) {
          skipped.push({
            id: t.id,
            name: t.nomeFantasia || t.name || t.databaseName,
            reason: "Sem mensalidade (> R$ 0) ou sem data de vencimento.",
          });
          continue;
        }

        await heartPrisma.$transaction(async (tx) => {
          const updated = await tx.tenant.update({
            where: { id: t.id },
            data: {
              leadgerSyncEnabled: true,
              clientExternalId: getClientExternalId(t),
              baseExternalId: getBaseExternalId(t),
              ...(t.leadgerSynced
                ? { baseVersion: Number(t.baseVersion || 1) + 1 }
                : {}),
            },
            include: { users: { select: { email: true }, take: 1 } },
          });

          await ensureCurrentTenantInvoice(tx, updated);
          const allInvoices = await tx.tenantInvoice.findMany({
            where: { tenantId: t.id },
            orderBy: { dueDate: "asc" },
          });

          const ev = await enqueueBaseUpsertEvent(tx, updated, allInvoices);
          enqueued.push(ev.eventId);
        });
      }

      let deliveryResult = null;
      if (deliverNow && enqueued.length > 0) {
        deliveryResult = await processWebhookOutboxBatch({
          limit: enqueued.length,
        });
      }

      return NextResponse.json({
        success: true,
        message: `${enqueued.length} base(s) enfileirada(s) para sincronização (${skipped.length} ignorada(s) por falta de valor/vencimento).`,
        enqueuedCount: enqueued.length,
        skipped,
        deliveryResult,
      });
    }

    // ------------------------------------------------------------------
    // 4. REENVIAR UM EVENTO ESPECÍFICO DA FILA (MESMO eventId E CORPO)
    // ------------------------------------------------------------------
    if (action === "retry_event") {
      const { outboxId } = body;
      if (!outboxId) {
        return NextResponse.json(
          { error: "outboxId é obrigatório." },
          { status: 400 }
        );
      }

      await heartPrisma.webhookOutbox.update({
        where: { id: outboxId },
        data: {
          status: "pending",
          nextAttemptAt: new Date(),
        },
      });

      const result = await deliverWebhookOutboxItem(outboxId);
      return NextResponse.json({
        success: result.status === "delivered",
        result,
      });
    }

    // ------------------------------------------------------------------
    // 5. PROCESSAR FILA OUTBOX AGORA (WORKER MANUAL / CRON)
    // ------------------------------------------------------------------
    if (action === "process_outbox") {
      const { limit = 25, includeBlocked = false, tenantId } = body;
      const result = await processWebhookOutboxBatch({
        limit: Number(limit || 25),
        includeBlocked: Boolean(includeBlocked),
        tenantId: tenantId || undefined,
      });
      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    // ------------------------------------------------------------------
    // 6. REGENERAR SNAPSHOT APÓS CORREÇÃO DE DADOS (PARA EVENTO 422/409)
    // ------------------------------------------------------------------
    if (action === "rebuild_blocked_event") {
      const { outboxId } = body;
      const oldItem = await heartPrisma.webhookOutbox.findUnique({
        where: { id: outboxId },
      });

      if (!oldItem || !oldItem.tenantId) {
        return NextResponse.json(
          { error: "Evento de outbox ou tenant associado não encontrado." },
          { status: 404 }
        );
      }

      const tenant = await heartPrisma.tenant.findUnique({
        where: { id: oldItem.tenantId },
        include: { users: { select: { email: true }, take: 1 } },
      });

      if (!tenant) {
        return NextResponse.json(
          { error: "Tenant não encontrado." },
          { status: 404 }
        );
      }

      const newEvent = await heartPrisma.$transaction(async (tx) => {
        // Marca o evento antigo bloqueado como substituído apenas se não foi entregue
        if (oldItem.status !== "delivered") {
          await tx.webhookOutbox.update({
            where: { id: oldItem.id },
            data: {
              status: "superseded",
              lastErrorMessage: `${oldItem.lastErrorMessage || ""} [Substituído por novo snapshot corrigido]`,
            },
          });
        }

        if (oldItem.eventType === "base.upsert") {
          const updatedTenant = await tx.tenant.update({
            where: { id: tenant.id },
            data: {
              clientVersion: Number(tenant.clientVersion || 1) + 1,
              baseVersion: Number(tenant.baseVersion || 1) + 1,
            },
            include: { users: { select: { email: true }, take: 1 } },
          });
          await ensureCurrentTenantInvoice(tx, updatedTenant);
          const allInvoices = await tx.tenantInvoice.findMany({
            where: { tenantId: tenant.id },
            orderBy: { dueDate: "asc" },
          });
          return enqueueBaseUpsertEvent(tx, updatedTenant, allInvoices);
        }

        if (oldItem.eventType === "invoice.upsert" && oldItem.invoiceId) {
          const inv = await tx.tenantInvoice.findUnique({
            where: { id: oldItem.invoiceId },
          });
          if (!inv) {
            throw new Error("Fatura associada ao evento não encontrada.");
          }
          const updatedInv = await tx.tenantInvoice.update({
            where: { id: inv.id },
            data: { version: inv.version + 1 },
          });
          return enqueueInvoiceUpsertEvent(tx, tenant, updatedInv);
        }

        // client.upsert
        const updatedTenant = await tx.tenant.update({
          where: { id: tenant.id },
          data: {
            clientVersion: Number(tenant.clientVersion || 1) + 1,
          },
          include: { users: { select: { email: true }, take: 1 } },
        });
        return enqueueClientUpsertEvent(tx, updatedTenant, {
          includePhoto: Boolean(oldItem.photoVersion && updatedTenant.logoUrl),
        });
      });

      const deliveryResult = await deliverWebhookOutboxItem(newEvent.id);

      return NextResponse.json({
        success: true,
        message: `Novo snapshot (${newEvent.eventId}) gerado e enviado!`,
        newEvent,
        deliveryResult,
      });
    }

    return NextResponse.json(
      { error: `Ação desconhecida: '${action}'.` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("POST /api/tenants/setup/leadger error:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao executar ação Leadger." },
      { status: 500 }
    );
  }
}
