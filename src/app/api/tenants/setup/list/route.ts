import { NextRequest, NextResponse } from "next/server";
import { verifySetupPin, ensureAndPushHeartSchema } from "@/lib/setup-auth";
import { heartPrisma } from "@/lib/heart-db";

export async function GET(request: NextRequest) {
  const pinError = verifySetupPin(request);
  if (pinError) return pinError;

  try {
    let tenants;
    try {
      tenants = await heartPrisma.tenant.findMany({
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
          _count: {
            select: { users: true, paymentLogs: true },
          },
        },
      });
    } catch {
      await ensureAndPushHeartSchema();
      tenants = await heartPrisma.tenant.findMany({
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
          _count: {
            select: { users: true, paymentLogs: true },
          },
        },
      });
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
