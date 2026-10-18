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
    const logs = await heartPrisma.paymentLog.findMany({
      where: { tenantId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(logs);
  } catch (error: any) {
    console.error("GET /api/tenants/setup/[id]/payment-history error:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao consultar histórico de pagamentos." },
      { status: 500 }
    );
  }
}
