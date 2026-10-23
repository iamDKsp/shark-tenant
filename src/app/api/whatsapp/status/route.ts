import { NextResponse } from "next/server";
import { getWhatsappApiUrl, resolveCurrentTenantId } from "@/lib/whatsapp";

export async function GET(req: Request) {
  const WHATSAPP_API = getWhatsappApiUrl();
  const url = new URL(req.url);
  const qTenant = url.searchParams.get("tenantId") || url.searchParams.get("tenant_id");
  const tenantId = qTenant || (await resolveCurrentTenantId());

  try {
    const res = await fetch(`${WHATSAPP_API}/status?tenantId=${encodeURIComponent(tenantId)}`, {
      cache: "no-store",
      headers: { "x-tenant-id": tenantId },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    return NextResponse.json({ ...data, tenantId });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "disconnected",
        tenantId,
        error: error.message || "Offline",
        url: WHATSAPP_API,
      },
      { status: 500 }
    );
  }
}
