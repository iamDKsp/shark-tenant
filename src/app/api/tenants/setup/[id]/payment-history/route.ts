import { NextRequest, NextResponse } from "next/server";
import { verifySetupPin } from "@/lib/setup-auth";
import { heartPrisma } from "@/lib/heart-db";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const pinError = verifySetupPin(request);
  if (pinError) return pinError;

  try {
    const { id } = await context.params;
    const [rawLogs, invoices] = await Promise.all([
      heartPrisma.paymentLog.findMany({
        where: { tenantId: id },
        orderBy: { createdAt: "desc" },
      }),
      heartPrisma.tenantInvoice.findMany({
        where: { tenantId: id },
        orderBy: { dueDate: "desc" },
      }),
    ]);

    const logs = rawLogs.map((log) => ({
      ...log,
      dataPagamento: log.createdAt,
      vencimentoAnterior: log.vencimentoAntes,
      vencimentoNovo: log.vencimentoApos,
    }));

    return NextResponse.json({
      logs,
      invoices,
    });
  } catch (error: any) {
    console.error("GET /api/tenants/setup/[id]/payment-history error:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao consultar histórico de pagamentos." },
      { status: 500 }
    );
  }
}
