import { NextRequest, NextResponse } from "next/server";
import { verifySetupPin, ensureAndPushHeartSchema } from "@/lib/setup-auth";
import { heartPrisma } from "@/lib/heart-db";
import { getClientExternalId, getBaseExternalId } from "@/lib/leadger-webhook";

async function queryTenantsWithRelations() {
  const tenants = await heartPrisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          pin: true,
          active: true,
          createdAt: true,
        },
      },
      paymentLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        where: { estornado: false },
      },
      invoices: {
        orderBy: { dueDate: "desc" },
        take: 12,
      },
      webhookOutbox: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          eventId: true,
          eventType: true,
          status: true,
          lastHttpStatus: true,
          lastErrorCode: true,
          lastErrorMessage: true,
          outcome: true,
          attempts: true,
          createdAt: true,
          deliveredAt: true,
        },
      },
      _count: {
        select: { users: true, paymentLogs: true, invoices: true, webhookOutbox: true },
      },
    },
  });

  return tenants.map((t) => {
    const lastPayment = t.paymentLogs?.[0] || null;
    const cidadeFormatada = [t.municipio, t.uf].filter(Boolean).join(" - ");
    return {
      ...t,
      clientExternalId: getClientExternalId(t),
      baseExternalId: getBaseExternalId(t),
      // Aliases de compatibilidade para o /sys-init
      logo: t.logoUrl || "",
      modules: t.modulos,
      endereco: t.logradouro || "",
      cidade: cidadeFormatada || "",
      ultimoPagamento: lastPayment ? lastPayment.createdAt : null,
    };
  });
}

export async function GET(request: NextRequest) {
  const pinError = verifySetupPin(request);
  if (pinError) return pinError;

  try {
    let tenants;
    try {
      tenants = await queryTenantsWithRelations();
    } catch {
      await ensureAndPushHeartSchema();
      tenants = await queryTenantsWithRelations();
    }

    return NextResponse.json(tenants);
  } catch (error: any) {
    console.error("GET /api/tenants/setup/list error:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao listar tenants" },
      { status: 500 }
    );
  }
}
