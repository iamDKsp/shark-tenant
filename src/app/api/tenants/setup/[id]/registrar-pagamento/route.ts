import { NextRequest, NextResponse } from "next/server";
import { verifySetupPin } from "@/lib/setup-auth";
import { heartPrisma } from "@/lib/heart-db";

/**
 * Avança a data em exatamente 1 mês preservando o dia original sem overflow (ex: 31/Jan -> 28/Fev).
 */
function addOneMonthSafe(date: Date): Date {
  const originalDay = date.getUTCDate();
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
    const { valor, observacao, registradoPor } = body;

    const tenant = await heartPrisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant não encontrado." },
        { status: 404 }
      );
    }

    const vencimentoAntes = tenant.mensalidadeVencimento
      ? new Date(tenant.mensalidadeVencimento)
      : new Date();

    const vencimentoApos = addOneMonthSafe(vencimentoAntes);

    const valorCobrado =
      valor !== undefined && valor !== ""
        ? Number(valor)
        : Number(tenant.mensalidadeValor || 0);

    const result = await heartPrisma.$transaction(async (tx) => {
      const updatedTenant = await tx.tenant.update({
        where: { id },
        data: {
          mensalidadeVencimento: vencimentoApos,
          ...(valor !== undefined && valor !== ""
            ? { mensalidadeValor: valorCobrado }
            : {}),
        },
      });

      const log = await tx.paymentLog.create({
        data: {
          tenantId: id,
          valor: valorCobrado,
          vencimentoAntes,
          vencimentoApos,
          observacao: observacao || null,
          registradoPor: registradoPor || "Admin (/sys-init)",
        },
      });

      return { tenant: updatedTenant, paymentLog: log };
    });

    return NextResponse.json({
      success: true,
      message: "Pagamento registrado e vencimento renovado (+1 mês)!",
      ...result,
    });
  } catch (error: any) {
    console.error("POST /api/tenants/setup/[id]/registrar-pagamento error:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao registrar pagamento." },
      { status: 500 }
    );
  }
}
