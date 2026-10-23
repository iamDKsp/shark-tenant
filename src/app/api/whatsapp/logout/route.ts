import { NextResponse } from "next/server";
import { getWhatsappApiUrl, resolveCurrentTenantId } from "@/lib/whatsapp";

export async function POST(req: Request) {
  const WHATSAPP_API = getWhatsappApiUrl();

  try {
    let tenantId = await resolveCurrentTenantId();
    try {
      const body = await req.json();
      if (body?.tenantId || body?.tenant_id) {
        tenantId = body.tenantId || body.tenant_id;
      }
    } catch (_) {}

    const res = await fetch(`${WHATSAPP_API}/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": tenantId,
      },
      body: JSON.stringify({ tenantId }),
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json();
    return NextResponse.json({ ...data, tenantId });
  } catch (err: any) {
    return NextResponse.json({ error: "Falha ao desconectar do servidor." }, { status: 500 });
  }
}
