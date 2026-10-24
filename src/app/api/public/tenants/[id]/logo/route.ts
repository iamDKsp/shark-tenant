import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { heartPrisma } from "@/lib/heart-db";
import { generateLogoSignedToken } from "@/lib/leadger-webhook";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5 MiB (limite do contrato v1)

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { searchParams } = request.nextUrl;
    const versionParam = Number(searchParams.get("v") || "0");
    const sigParam = searchParams.get("sig") || "";

    const tenant = await heartPrisma.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        logoUrl: true,
        photoVersion: true,
      },
    });

    if (!tenant || !tenant.logoUrl) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Valida assinatura do link caso tenha sido informada
    const targetVersion =
      versionParam > 0 ? versionParam : Number(tenant.photoVersion || 1);
    const expectedSig = generateLogoSignedToken(tenant.id, targetVersion);

    if (sigParam) {
      const a = Buffer.from(sigParam, "utf8");
      const b = Buffer.from(expectedSig, "utf8");
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    const rawLogo = tenant.logoUrl.trim();

    // Formato Data URL: data:image/png;base64,iVBORw0KGgo...
    const dataUrlMatch = rawLogo.match(
      /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i
    );
    if (!dataUrlMatch) {
      return new NextResponse("Unsupported Media Format", { status: 415 });
    }

    let mimeType = dataUrlMatch[1].toLowerCase();
    if (mimeType === "image/jpg") mimeType = "image/jpeg";

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return new NextResponse("Unsupported Image Type", { status: 415 });
    }

    const buffer = Buffer.from(dataUrlMatch[2], "base64");
    if (buffer.length === 0 || buffer.length > MAX_LOGO_BYTES) {
      return new NextResponse("Image Size Invalid", { status: 422 });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=86400, immutable",
        "Content-Encoding": "identity",
      },
    });
  } catch (error) {
    console.error("GET /api/public/tenants/[id]/logo error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
