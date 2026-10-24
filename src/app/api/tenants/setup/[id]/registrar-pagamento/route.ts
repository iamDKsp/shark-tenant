import { NextRequest, NextResponse } from "next/server";
import { verifySetupPin } from "@/lib/setup-auth";
import { heartPrisma } from "@/lib/heart-db";
import {
  enqueueBaseUpsertEvent,
  enqueueInvoiceUpsertEvent,
  getInvoiceExternalId,
  normalizePaymentMethod,
  toCents,
  toDateOnlyString,
  toReferenceMonth,
  triggerOutboxWorkerAsync,
} from "@/lib/leadger-webhook";

/**
 * Avança a data em exatamente 1 mês preservando o dia original sem overflow (ex: 31/Jan -> 28/Fev).
 */
function addOneMonthSafe(date: Date, preferredDay?: number | null): Date {
  const originalDay =
    preferredDay && preferredDay >= 1 && preferredDay <= 31
      ? preferredDay
      : date.getUTCDate();
  const d = new Date(date);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const lastDayOfNextMonth = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)
  ).getUTCDate();
  d.setUTCDate(Math.min(originalDay, lastDayOfNextMonth));
  return d;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const pinError = verifySetupPin(request);
  if (pinError) return pinError;

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const {
      valor,
      paymentMethod,
      observacao,
      registradoPor,
      invoiceId,
      paidAt: customPaidAt,
    } = body;

    const tenant = await heartPrisma.tenant.findUnique({
      where: { id },
      include: { users: { select: { email: true }, take: 1 } },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant não encontrado." },
        { status: 404 }
      );
    }

    const displayName = String(
      tenant.nomeFantasia ||
        tenant.name ||
        tenant.razaoSocial ||
        tenant.databaseName
    ).trim();

    const vencimentoAntes = tenant.mensalidadeVencimento
      ? new Date(tenant.mensalidadeVencimento)
      : new Date();

    const vencimentoApos = addOneMonthSafe(
      vencimentoAntes,
      tenant.billingDay
    );

    const valorCobrado =
      valor !== undefined && valor !== "" && Number(valor) > 0
        ? Number(valor)
        : Number(tenant.mensalidadeValor || 0);

    const amountCents = Math.max(100, toCents(valorCobrado));
    const resolvedMethod = normalizePaymentMethod(paymentMethod) || "pix";
    const paidAtDate = customPaidAt ? new Date(customPaidAt) : new Date();

    const result = await heartPrisma.$transaction(async (tx) => {
      // 1. Localiza ou cria a fatura da competência atual sendo quitada
      let targetInvoice = invoiceId
        ? await tx.tenantInvoice.findUnique({ where: { id: invoiceId } })
        : null;

      const currentDueStr = toDateOnlyString(vencimentoAntes);
      const currentRefMonth = toReferenceMonth(currentDueStr);

      if (!targetInvoice) {
        targetInvoice = await tx.tenantInvoice.findUnique({
          where: {
            tenantId_referenceMonth: {
              tenantId: id,
              referenceMonth: currentRefMonth,
            },
          },
        });
      }

      let paidInvoice;
      if (targetInvoice) {
        paidInvoice = await tx.tenantInvoice.update({
          where: { id: targetInvoice.id },
          data: {
            version: targetInvoice.version + 1,
            amount: amountCents,
            status: "paid",
            paidAt: paidAtDate,
            paymentMethod: resolvedMethod,
            notes: observacao || targetInvoice.notes,
          },
        });
      } else {
        const [y, m] = currentRefMonth.split("-");
        paidInvoice = await tx.tenantInvoice.create({
          data: {
            tenantId: id,
            externalId: getInvoiceExternalId(id, currentRefMonth),
            version: 1,
            description: `${displayName} — Mensalidade ${m}/${y}`.slice(0, 300),
            amount: amountCents,
            dueDate: currentDueStr,
            referenceMonth: currentRefMonth,
            status: "paid",
            paidAt: paidAtDate,
            paymentMethod: resolvedMethod,
            notes: observacao || null,
          },
        });
      }

      // 2. Avança o vencimento do tenant (+1 mês)
      const updatedTenant = await tx.tenant.update({
        where: { id },
        data: {
          mensalidadeVencimento: vencimentoApos,
          ...(valor !== undefined && valor !== "" && Number(valor) > 0
            ? { mensalidadeValor: valorCobrado }
            : {}),
        },
        include: { users: { select: { email: true }, take: 1 } },
      });

      // 3. Gera a fatura pendente da próxima competência (o Leadger não gera faturas futuras sozinho)
      const nextDueStr = toDateOnlyString(vencimentoApos);
      const nextRefMonth = toReferenceMonth(nextDueStr);
      const nextAmountCents =
        toCents(updatedTenant.mensalidadeValor) || amountCents;

      let nextInvoice = await tx.tenantInvoice.findUnique({
        where: {
          tenantId_referenceMonth: {
            tenantId: id,
            referenceMonth: nextRefMonth,
          },
        },
      });

      let nextInvoiceCreated = false;
      if (!nextInvoice && nextAmountCents > 0) {
        const [ny, nm] = nextRefMonth.split("-");
        nextInvoice = await tx.tenantInvoice.create({
          data: {
            tenantId: id,
            externalId: getInvoiceExternalId(id, nextRefMonth),
            version: 1,
            description: `${displayName} — Mensalidade ${nm}/${ny}`.slice(
              0,
              300
            ),
            amount: nextAmountCents,
            dueDate: nextDueStr,
            referenceMonth: nextRefMonth,
            status: "pending",
            paidAt: null,
            paymentMethod: null,
          },
        });
        nextInvoiceCreated = true;
      }

      // 4. Registra o PaymentLog vinculado à fatura
      const log = await tx.paymentLog.create({
        data: {
          tenantId: id,
          invoiceId: paidInvoice.id,
          valor: valorCobrado,
          vencimentoAntes,
          vencimentoApos,
          paymentMethod: resolvedMethod,
          tipo: "payment",
          observacao: observacao || null,
          registradoPor: registradoPor || "Admin (/sys-init)",
        },
      });

      // 5. Se integrado ao Leadger, grava os eventos na Outbox na mesma transação
      if (updatedTenant.leadgerSyncEnabled || updatedTenant.leadgerSynced) {
        if (!updatedTenant.leadgerSynced) {
          const allInvoices = await tx.tenantInvoice.findMany({
            where: { tenantId: id },
            orderBy: { dueDate: "asc" },
          });
          await enqueueBaseUpsertEvent(tx, updatedTenant, allInvoices);
        } else {
          await enqueueInvoiceUpsertEvent(tx, updatedTenant, paidInvoice);
          if (nextInvoice && nextInvoiceCreated) {
            await enqueueInvoiceUpsertEvent(tx, updatedTenant, nextInvoice);
          }
        }
      }

      return {
        tenant: {
          ...updatedTenant,
          ultimoPagamento: log.createdAt,
        },
        paymentLog: {
          ...log,
          dataPagamento: log.createdAt,
          vencimentoAnterior: log.vencimentoAntes,
          vencimentoNovo: log.vencimentoApos,
        },
        paidInvoice,
        nextInvoice,
      };
    });

    if (result.tenant.leadgerSyncEnabled || result.tenant.leadgerSynced) {
      triggerOutboxWorkerAsync(id);
    }

    return NextResponse.json({
      success: true,
      message: "Pagamento registrado e vencimento renovado (+1 mês)!",
      ...result,
    });
  } catch (error: any) {
    console.error(
      "POST /api/tenants/setup/[id]/registrar-pagamento error:",
      error
    );
    return NextResponse.json(
      { error: error?.message || "Erro ao registrar pagamento." },
      { status: 500 }
    );
  }
}
