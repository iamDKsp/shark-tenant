import { NextRequest, NextResponse } from "next/server";
import {
  verifySetupPin,
  ensureAndPushHeartSchema,
  pushTenantSchema,
} from "@/lib/setup-auth";
import { heartPrisma, ensurePostgresDatabase } from "@/lib/heart-db";

export async function POST(request: NextRequest) {
  const pinError = verifySetupPin(request);
  if (pinError) return pinError;

  try {
    const body = await request.json().catch(() => ({}));
    const { tenantIds, includeHeart = false } = body as {
      tenantIds?: string[];
      includeHeart?: boolean;
    };

    const results: Array<{
      tenantId: string;
      id: string;
      name: string;
      databaseName: string;
      status: "success" | "error";
      message: string;
      output: string;
    }> = [];

    if (includeHeart) {
      try {
        const { stdout, stderr } = await ensureAndPushHeartSchema();
        results.push({
          tenantId: "__heart__",
          id: "heart",
          name: "🫀 Banco Heart (master)",
          databaseName: "heart",
          status: "success",
          message: "Schema heart.schema.prisma sincronizado com sucesso.",
          output:
            [stdout, stderr].filter(Boolean).join("\n").trim() ||
            "Schema Heart atualizado com sucesso.",
        });
      } catch (err: any) {
        results.push({
          tenantId: "__heart__",
          id: "heart",
          name: "🫀 Banco Heart (master)",
          databaseName: "heart",
          status: "error",
          message: err?.message || "Falha ao sincronizar banco heart.",
          output: `Erro na migração Heart:\n${err?.stderr || err?.message || ""}\n${err?.stdout || ""}`.trim(),
        });
      }
    }

    const tenants =
      Array.isArray(tenantIds) && tenantIds.length > 0
        ? await heartPrisma.tenant.findMany({
            where: { id: { in: tenantIds } },
            orderBy: { createdAt: "asc" },
          })
        : [];

    for (const tenant of tenants) {
      const displayName =
        tenant.nomeFantasia ||
        tenant.razaoSocial ||
        tenant.name ||
        tenant.databaseName;
      try {
        const dbUrl = await ensurePostgresDatabase(tenant.databaseName);
        const { stdout, stderr } = await pushTenantSchema(dbUrl);

        if (tenant.databaseUrl !== dbUrl) {
          await heartPrisma.tenant.update({
            where: { id: tenant.id },
            data: { databaseUrl: dbUrl },
          });
        }

        results.push({
          tenantId: tenant.id,
          id: tenant.id,
          name: displayName,
          databaseName: tenant.databaseName,
          status: "success",
          message: "Schema prisma/schema.prisma sincronizado com sucesso.",
          output:
            [stdout, stderr].filter(Boolean).join("\n").trim() ||
            "Schema do tenant atualizado com sucesso.",
        });
      } catch (err: any) {
        results.push({
          tenantId: tenant.id,
          id: tenant.id,
          name: displayName,
          databaseName: tenant.databaseName,
          status: "error",
          message: err?.message || "Erro ao sincronizar banco do tenant.",
          output: `Erro na migração de ${tenant.databaseName}:\n${err?.stderr || err?.message || ""}\n${err?.stdout || ""}`.trim(),
        });
      }
    }

    return NextResponse.json(results);
  } catch (error: any) {
    console.error("POST /api/tenants/setup/migrate error:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao executar migração em lote." },
      { status: 500 }
    );
  }
}
