import { NextResponse } from "next/server";
import { normalizarTelefone } from "@/lib/mensagens/render";
import { getWhatsappApiUrl, resolveCurrentTenantId } from "@/lib/whatsapp";

export async function POST(req: Request) {
  const WHATSAPP_API = getWhatsappApiUrl();

  try {
    const body = await req.json();
    if (
      !body ||
      !Array.isArray(body.messages) ||
      body.messages.length === 0 ||
      body.messages.length > 5
    ) {
      return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
    }

    const tenantId = body.tenantId || body.tenant_id || (await resolveCurrentTenantId());

    const messages = [];
    for (const item of body.messages) {
      const phone = normalizarTelefone(typeof item?.phone === "string" ? item.phone : "");
      if (!phone) {
        return NextResponse.json({ error: "Telefone inválido." }, { status: 400 });
      }
      messages.push({ ...item, phone });
    }

    const res = await fetch(`${WHATSAPP_API}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": tenantId,
      },
      body: JSON.stringify({ ...body, tenantId, messages }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Falha de conexão com o servidor do WhatsApp." },
      { status: 500 }
    );
  }
}
