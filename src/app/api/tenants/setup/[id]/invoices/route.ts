import { NextRequest, NextResponse } from "next/server";
import { verifySetupPin } from "@/lib/setup-auth";
import { heartPrisma } from "@/lib/heart-db";
import {
  addMonthsToDateString,
  centsToReais,
  enqueueBaseUpsertEvent,
  enqueueInvoiceUpsertEvent,
  getInvoiceExternalId,
  normalizePaymentMethod,
  toCents,
  toDateOnlyString,
  toReferenceMonth,
  triggerOutboxWorkerAsync,
} from "@/lib/leadger-webhook";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const pinError = verifySetupPin(request);
  if (pinError) return pinError;

  try {
    const { id } = await context.params;
    const invoices = await heartPrisma.tenantInvoice.findMany({
      where: { tenantId: id },
      orderBy: { dueDate: "desc" },
    });
    return NextResponse.json({ invoices });
  } catch (error: any) {
    console.error("GET /api/tenants/setup/[id]/invoices error:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao listar faturas." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const pinError = verifySetupPin(request);
  if (pinError) return pinError;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const { action } = body;

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

    const shouldSync = Boolean(
      tenant.leadgerSyncEnabled || tenant.leadgerSynced
    );

    // ------------------------------------------------------------------
    // 1. GERAR / ANTECIPAR NOVA COMPETÊNCIA
    // ------------------------------------------------------------------
    if (action === "create") {
      const latestInvoice = await heartPrisma.tenantInvoice.findFirst({
        where: { tenantId: id },
        orderBy: { dueDate: "desc" },
      });

      let dueDateStr = body.dueDate
        ? toDateOnlyString(body.dueDate)
        : latestInvoice
        ? addMonthsToDateString(latestInvoice.dueDate, 1, tenant.billingDay)
        : toDateOnlyString(tenant.mensalidadeVencimento || new Date());

      const referenceMonth = body.referenceMonth
        ? String(body.referenceMonth).slice(0, 7)
        : toReferenceMonth(dueDateStr);

      const amountCents =
        body.amount !== undefined
          ? Number(body.amount) > 1000 && Number.isInteger(Number(body.amount)) && body.isCents
            ? Number(body.amount)
            : toCents(body.amount)
          : toCents(tenant.mensalidadeValor);

      if (amountCents <= 0) {
        return NextResponse.json(
          {
            error:
              "Informe um valor positivo (maior que R$ 0,00) para gerar a fatura.",
          },
          { status: 400 }
        );
      }

      const [y, m] = referenceMonth.split("-");
      const description = String(
        body.description || `${displayName} — Mensalidade ${m}/${y}`
      )
        .trim()
        .slice(0, 300);

      const existing = await heartPrisma.tenantInvoice.findUnique({
        where: {
          tenantId_referenceMonth: {
            tenantId: id,
            referenceMonth,
          },
        },
      });

      if (existing) {
        return NextResponse.json(
          {
            error: `Já existe uma fatura gerada para a competência ${referenceMonth}. Edite a fatura existente.`,
          },
          { status: 409 }
        );
      }

      const created = await heartPrisma.$transaction(async (tx) => {
        const inv = await tx.tenantInvoice.create({
          data: {
            tenantId: id,
            externalId: getInvoiceExternalId(
              id,
              referenceMonth,
              body.externalId
            ),
            version: 1,
            description,
            amount: amountCents,
            dueDate: dueDateStr,
            referenceMonth,
            status: "pending",
            paidAt: null,
            paymentMethod: null,
            notes: body.notes || null,
          },
        });

        if (shouldSync) {
          if (!tenant.leadgerSynced) {
            const allInvs = await tx.tenantInvoice.findMany({
              where: { tenantId: id },
              orderBy: { dueDate: "asc" },
            });
            await enqueueBaseUpsertEvent(tx, tenant, allInvs);
          } else {
            await enqueueInvoiceUpsertEvent(tx, tenant, inv);
          }
        }

        return inv;
      });

      if (shouldSync) triggerOutboxWorkerAsync(id);

      return NextResponse.json({
        success: true,
        message: `Fatura da competência ${referenceMonth} criada com sucesso!`,
        invoice: created,
      });
    }

    // ------------------------------------------------------------------
    // 2. EDITAR VALOR / VENCIMENTO / DESCRIÇÃO (OU CORRIGIR VALOR PAGO)
    // ------------------------------------------------------------------
    if (action === "update") {
      const { invoiceId, amount, dueDate, description, paymentMethod, notes } =
        body;
      if (!invoiceId) {
        return NextResponse.json(
          { error: "invoiceId é obrigatório." },
          { status: 400 }
        );
      }

      const existing = await heartPrisma.tenantInvoice.findUnique({
        where: { id: invoiceId },
      });
      if (!existing || existing.tenantId !== id) {
        return NextResponse.json(
          { error: "Fatura não encontrada para este cliente." },
          { status: 404 }
        );
      }

      const newAmountCents =
        amount !== undefined
          ? body.isCents
            ? Number(amount)
            : toCents(amount)
          : existing.amount;

      if (newAmountCents <= 0) {
        return NextResponse.json(
          { error: "O valor da fatura deve ser maior que zero." },
          { status: 400 }
        );
      }

      const newDueDate = dueDate
        ? toDateOnlyString(dueDate)
        : existing.dueDate;
      const newDescription = description
        ? String(description).trim().slice(0, 300)
        : existing.description;
      const newPaymentMethod =
        paymentMethod !== undefined
          ? normalizePaymentMethod(paymentMethod)
          : existing.paymentMethod;

      const updated = await heartPrisma.$transaction(async (tx) => {
        const inv = await tx.tenantInvoice.update({
          where: { id: existing.id },
          data: {
            version: existing.version + 1,
            amount: newAmountCents,
            dueDate: newDueDate,
            description: newDescription,
            paymentMethod:
              existing.status === "paid" ? newPaymentMethod : null,
            notes: notes !== undefined ? notes : existing.notes,
          },
        });

        // Se era uma fatura já paga e o valor mudou, registra log de correção (Seção 7)
        if (existing.status === "paid" && newAmountCents !== existing.amount) {
          await tx.paymentLog.create({
            data: {
              tenantId: id,
              invoiceId: inv.id,
              valor: centsToReais(newAmountCents),
              vencimentoAntes: new Date(`${inv.dueDate}T12:00:00Z`),
              vencimentoApos: new Date(`${inv.dueDate}T12:00:00Z`),
              paymentMethod: inv.paymentMethod,
              tipo: "correction",
              observacao:
                notes ||
                `Correção de valor pago (${inv.referenceMonth}): de R$ ${centsToReais(
                  existing.amount
                ).toFixed(2)} para R$ ${centsToReais(newAmountCents).toFixed(2)}`,
              registradoPor: "Admin (/sys-init)",
            },
          });
        }

        if (shouldSync) {
          if (!tenant.leadgerSynced) {
            const allInvs = await tx.tenantInvoice.findMany({
              where: { tenantId: id },
              orderBy: { dueDate: "asc" },
            });
            await enqueueBaseUpsertEvent(tx, tenant, allInvs);
          } else {
            await enqueueInvoiceUpsertEvent(tx, tenant, inv);
          }
        }

        return inv;
      });

      if (shouldSync) triggerOutboxWorkerAsync(id);

      return NextResponse.json({
        success: true,
        message: `Fatura ${updated.referenceMonth} atualizada (v${updated.version})!`,
        invoice: updated,
      });
    }

    // ------------------------------------------------------------------
    // 3. ESTORNAR PAGAMENTO (REVERSÃO DE SALDO NO LEADGER — SEÇÃO 7)
    // ------------------------------------------------------------------
    if (action === "refund") {
      const {
        invoiceId,
        paymentLogId,
        targetStatus = "pending",
        revertDueDate = true,
        motivo,
      } = body;

      let targetLog = paymentLogId
        ? await heartPrisma.paymentLog.findUnique({
            where: { id: paymentLogId },
          })
        : null;

      let targetInvoice = invoiceId
        ? await heartPrisma.tenantInvoice.findUnique({
            where: { id: invoiceId },
          })
        : null;

      if (!targetInvoice && targetLog?.invoiceId) {
        targetInvoice = await heartPrisma.tenantInvoice.findUnique({
          where: { id: targetLog.invoiceId },
        });
      }

      if (!targetInvoice && targetLog) {
        const refMonth = toReferenceMonth(targetLog.vencimentoAntes);
        targetInvoice = await heartPrisma.tenantInvoice.findUnique({
          where: {
            tenantId_referenceMonth: {
              tenantId: id,
              referenceMonth: refMonth,
            },
          },
        });
      }

      if (!targetLog && targetInvoice) {
        targetLog = await heartPrisma.paymentLog.findFirst({
          where: {
            tenantId: id,
            invoiceId: targetInvoice.id,
            estornado: false,
          },
          orderBy: { createdAt: "desc" },
        });
      }

      const finalStatus =
        targetStatus === "cancelled" ? "cancelled" : "pending";

      const result = await heartPrisma.$transaction(async (tx) => {
        let refundedInvoice = null;

        if (targetInvoice) {
          refundedInvoice = await tx.tenantInvoice.update({
            where: { id: targetInvoice.id },
            data: {
              version: targetInvoice.version + 1,
              status: finalStatus,
              paidAt: null,
              paymentMethod: null,
              notes: motivo
                ? `Estornado: ${motivo}`
                : targetInvoice.notes || "Pagamento estornado",
            },
          });
        } else if (targetLog) {
          const dueStr = toDateOnlyString(targetLog.vencimentoAntes);
          const refMonth = toReferenceMonth(dueStr);
          const [y, m] = refMonth.split("-");
          refundedInvoice = await tx.tenantInvoice.create({
            data: {
              tenantId: id,
              externalId: getInvoiceExternalId(id, refMonth),
              version: 2,
              description: `${displayName} — Mensalidade ${m}/${y}`.slice(
                0,
                300
              ),
              amount: Math.max(100, toCents(targetLog.valor)),
              dueDate: dueStr,
              referenceMonth: refMonth,
              status: finalStatus,
              paidAt: null,
              paymentMethod: null,
              notes: motivo || "Pagamento estornado",
            },
          });
        }

        if (!refundedInvoice) {
          throw new Error(
            "Não foi possível localizar a fatura ou registro de pagamento para estornar."
          );
        }

        if (targetLog) {
          await tx.paymentLog.update({
            where: { id: targetLog.id },
            data: {
              estornado: true,
              estornadoEm: new Date(),
              observacao: motivo
                ? `${targetLog.observacao ? targetLog.observacao + " | " : ""}Estornado: ${motivo}`
                : `${targetLog.observacao ? targetLog.observacao + " | " : ""}Estornado`,
            },
          });
        }

        let updatedTenant = tenant;
        if (revertDueDate && targetLog?.vencimentoAntes) {
          updatedTenant = await tx.tenant.update({
            where: { id },
            data: {
              mensalidadeVencimento: targetLog.vencimentoAntes,
            },
            include: { users: { select: { email: true }, take: 1 } },
          });
        }

        if (shouldSync) {
          if (!tenant.leadgerSynced) {
            const allInvs = await tx.tenantInvoice.findMany({
              where: { tenantId: id },
              orderBy: { dueDate: "asc" },
            });
            await enqueueBaseUpsertEvent(tx, updatedTenant, allInvs);
          } else {
            await enqueueInvoiceUpsertEvent(tx, updatedTenant, refundedInvoice);
          }
        }

        return { refundedInvoice, updatedTenant };
      });

      if (shouldSync) triggerOutboxWorkerAsync(id);

      return NextResponse.json({
        success: true,
        message: `Pagamento estornado com sucesso! Fatura ${result.refundedInvoice.referenceMonth} revertida para '${finalStatus}' (v${result.refundedInvoice.version}).`,
        invoice: result.refundedInvoice,
        tenant: result.updatedTenant,
      });
    }

    // ------------------------------------------------------------------
    // 4. CANCELAR OU REABRIR FATURA PENDENTE
    // ------------------------------------------------------------------
    if (action === "cancel" || action === "reopen") {
      const { invoiceId, notes } = body;
      const existing = await heartPrisma.tenantInvoice.findUnique({
        where: { id: invoiceId },
      });

      if (!existing || existing.tenantId !== id) {
        return NextResponse.json(
          { error: "Fatura não encontrada." },
          { status: 404 }
        );
      }

      const nextStatus = action === "cancel" ? "cancelled" : "pending";

      const updated = await heartPrisma.$transaction(async (tx) => {
        const inv = await tx.tenantInvoice.update({
          where: { id: existing.id },
          data: {
            version: existing.version + 1,
            status: nextStatus,
            paidAt: null,
            paymentMethod: null,
            notes: notes !== undefined ? notes : existing.notes,
          },
        });

        if (shouldSync && tenant.leadgerSynced) {
          await enqueueInvoiceUpsertEvent(tx, tenant, inv);
        }

        return inv;
      });

      if (shouldSync) triggerOutboxWorkerAsync(id);

      return NextResponse.json({
        success: true,
        message:
          action === "cancel"
            ? `Fatura ${updated.referenceMonth} cancelada (v${updated.version}).`
            : `Fatura ${updated.referenceMonth} reaberta como pendente (v${updated.version}).`,
        invoice: updated,
      });
    }

    return NextResponse.json(
      { error: `Ação de fatura desconhecida: '${action}'.` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("POST /api/tenants/setup/[id]/invoices error:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao processar operação de fatura." },
      { status: 500 }
    );
  }
}
