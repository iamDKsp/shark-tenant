import { NextRequest, NextResponse } from "next/server";
import { verifySetupPin } from "@/lib/setup-auth";
import { heartPrisma, getAdminDatabaseUrl } from "@/lib/heart-db";
import { getTenantPrismaClient } from "@/lib/tenant-manager";
import { Client } from "pg";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const pinError = verifySetupPin(request);
  if (pinError) return pinError;

  try {
    const { id: tenantId } = await context.params;
    const tenant = await heartPrisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant não encontrado." },
        { status: 404 }
      );
    }

    const client = await getTenantPrismaClient(tenantId, {
      allowInactive: true,
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      clientesCount,
      blacklistCount,
      emprestimosAtivosCount,
      emprestimosQuitadosCount,
      parcelasAbertasCount,
      parcelasAtrasadasCount,
      chequesCount,
      parceirosCount,
      mensagensCount,
      empAgg,
      parcPagasAgg,
    ] = await Promise.all([
      client.cliente.count().catch(() => 0),
      client.cliente.count({ where: { blacklist: true } }).catch(() => 0),
      client.emprestimo.count({ where: { status: "ativo" } }).catch(() => 0),
      client.emprestimo.count({ where: { status: "quitado" } }).catch(() => 0),
      client.parcela.count({ where: { status: { not: "pago" } } }).catch(() => 0),
      client.parcela
        .count({
          where: {
            status: { not: "pago" },
            data_vencimento: { lt: today },
          },
        })
        .catch(() => 0),
      client.cheque.count().catch(() => 0),
      client.parceiro.count().catch(() => 0),
      client.mensagemLog.count().catch(() => 0),
      client.emprestimo
        .aggregate({
          _sum: { valor_emprestado: true },
          where: { status: "ativo" },
        })
        .catch(() => ({ _sum: { valor_emprestado: null } })),
      client.parcela
        .aggregate({
          _sum: { valor_pago: true },
          where: { status: "pago" },
        })
        .catch(() => ({ _sum: { valor_pago: null } })),
    ]);

    let dbSizeBytes = 0;
    try {
      const pgClient = new Client({ connectionString: getAdminDatabaseUrl() });
      await pgClient.connect();
      try {
        const sizeRes = await pgClient.query(
          "SELECT pg_database_size($1) as size",
          [tenant.databaseName]
        );
        dbSizeBytes = Number(sizeRes.rows?.[0]?.size || 0);
      } finally {
        await pgClient.end().catch(() => {});
      }
    } catch {
      // ignora falha de consulta de tamanho
    }

    return NextResponse.json({
      tenantId: tenant.id,
      databaseName: tenant.databaseName,
      clientesCount,
      blacklistCount,
      emprestimosAtivosCount,
      emprestimosQuitadosCount,
      parcelasAbertasCount,
      parcelasAtrasadasCount,
      chequesCount,
      parceirosCount,
      mensagensCount,
      volumeEmprestadoAtivo: Number(empAgg?._sum?.valor_emprestado || 0),
      totalRecebidoParcelas: Number(parcPagasAgg?._sum?.valor_pago || 0),
      dbSizeBytes,
    });
  } catch (error: any) {
    console.error("GET /api/tenants/setup/[id]/stats error:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao consultar estatísticas do tenant." },
      { status: 500 }
    );
  }
}
