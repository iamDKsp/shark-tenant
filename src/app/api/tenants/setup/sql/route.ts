import { NextRequest, NextResponse } from "next/server";
import { verifySqlPin } from "@/lib/setup-auth";
import {
  heartPrisma,
  getHeartDatabaseUrl,
  buildDatabaseUrl,
  getAdminDatabaseUrl,
} from "@/lib/heart-db";
import { Client } from "pg";

export async function POST(request: NextRequest) {
  const pinError = verifySqlPin(request);
  if (pinError) return pinError;

  try {
    const body = await request.json();
    const rawQuery = (body.sql ?? body.query ?? "") as string;
    const targetTenantId = (body.tenantId ??
      (body.target && body.target !== "heart" ? body.target : undefined)) as
      | string
      | undefined;
    const useHeart =
      body.useHeart === true ||
      body.target === "heart" ||
      !targetTenantId;

    if (!rawQuery || !String(rawQuery).trim()) {
      return NextResponse.json(
        { error: "A query SQL não pode estar vazia." },
        { status: 400 }
      );
    }

    let connectionString: string;
    let targetLabel: string;

    if (useHeart) {
      connectionString = getHeartDatabaseUrl();
      targetLabel = "heart (Banco Mestre)";
    } else {
      const tenant = await heartPrisma.tenant.findFirst({
        where: {
          OR: [{ id: targetTenantId }, { databaseName: targetTenantId }],
        },
      });

      if (!tenant) {
        return NextResponse.json(
          { error: `Tenant '${targetTenantId}' não encontrado.` },
          { status: 404 }
        );
      }

      connectionString = buildDatabaseUrl(
        getAdminDatabaseUrl(),
        tenant.databaseName
      );
      targetLabel = `${tenant.nomeFantasia || tenant.name || tenant.databaseName} (${tenant.databaseName})`;
    }

    let trimmed = String(rawQuery).trim().replace(/;\s*$/, "");

    // Compatibilidade amigável: traduz SHOW TABLES para PostgreSQL information_schema
    if (/^SHOW\s+TABLES$/i.test(trimmed)) {
      trimmed =
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name";
    }

    const isSelect = /^SELECT\b/i.test(trimmed);
    const isShowOrExplain = /^(SHOW|EXPLAIN|WITH)\b/i.test(trimmed);
    const isQuery = isSelect || isShowOrExplain;
    const SQL_LIMIT = 500;

    let finalSql = trimmed;
    if (isSelect && !/\bLIMIT\s+\d+/i.test(trimmed)) {
      finalSql = `${trimmed} LIMIT ${SQL_LIMIT}`;
    }

    const start = Date.now();
    const client = new Client({ connectionString });
    await client.connect();

    try {
      const res = await client.query(finalSql);
      const durationMs = Date.now() - start;

      const actualRes = Array.isArray(res) ? res[res.length - 1] : res;

      if (isQuery || (actualRes?.rows && actualRes.fields && actualRes.fields.length > 0)) {
        const columns = (actualRes?.fields || []).map((f: any) => f.name);
        const rawRows = actualRes?.rows || [];
        const data = rawRows.map((row: any) =>
          columns.map((col: string) => {
            const val = row[col];
            if (val === null || val === undefined) return null;
            if (val instanceof Date) return val.toISOString();
            if (Buffer.isBuffer(val)) return `[Binary ${val.length}b]`;
            if (typeof val === "bigint") return val.toString();
            if (typeof val === "object") return JSON.stringify(val);
            return val;
          })
        );

        return NextResponse.json({
          type: "query",
          target: targetLabel,
          command: actualRes?.command || "SELECT",
          columns,
          fields: columns,
          rows: data,
          rowObjects: rawRows,
          rowCount: rawRows.length,
          durationMs,
          limited: isSelect && rawRows.length >= SQL_LIMIT,
        });
      } else {
        const affected = actualRes?.rowCount ?? 0;
        return NextResponse.json({
          type: "exec",
          target: targetLabel,
          command: actualRes?.command || "EXEC",
          rowsAffected: Number(affected),
          rowCount: Number(affected),
          columns: [],
          rows: [],
          durationMs,
        });
      }
    } finally {
      await client.end().catch(() => {});
    }
  } catch (error: any) {
    console.error("POST /api/tenants/setup/sql error:", error);
    return NextResponse.json(
      {
        error: error?.message || "Erro ao executar comando SQL.",
        message: error?.message || "Erro ao executar comando SQL.",
        code: error?.code,
        detail: error?.detail,
        hint: error?.hint,
      },
      { status: 400 }
    );
  }
}
