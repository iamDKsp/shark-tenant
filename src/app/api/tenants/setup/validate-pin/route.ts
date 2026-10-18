import { NextRequest, NextResponse } from "next/server";
import { getSetupPin, ensureAndPushHeartSchema } from "@/lib/setup-auth";
import { heartPrisma } from "@/lib/heart-db";

export async function POST(request: NextRequest) {
  let pin = request.headers.get("x-setup-pin") || "";
  if (!pin) {
    try {
      const body = await request.json();
      pin = body?.pin || "";
    } catch {
      // sem body JSON
    }
  }

  if (!pin || pin !== getSetupPin()) {
    return NextResponse.json(
      { error: "PIN de acesso inválido ou ausente." },
      { status: 401 }
    );
  }

  try {
    try {
      await heartPrisma.tenant.count();
    } catch {
      await ensureAndPushHeartSchema();
    }

    return NextResponse.json({ valid: true });
  } catch (error: any) {
    console.error("Erro ao validar PIN / inicializar heart:", error);
    return NextResponse.json({
      valid: true,
      warning: error?.message || "Banco heart ainda sendo preparado.",
    });
  }
}
