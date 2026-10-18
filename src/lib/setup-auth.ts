import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { getHeartDatabaseUrl, ensurePostgresDatabase } from "./heart-db";

const execAsync = promisify(exec);

export function getSetupPin(): string {
  return process.env.SETUP_PIN || "teltech352";
}

export function getSqlPin(): string {
  return process.env.SQL_PIN || "43619835";
}

export function verifySetupPin(request: NextRequest): NextResponse | null {
  const pin = request.headers.get("x-setup-pin");
  if (!pin || pin !== getSetupPin()) {
    return NextResponse.json(
      { error: "PIN de acesso inválido ou ausente." },
      { status: 401 }
    );
  }
  return null;
}

export function verifySqlPin(request: NextRequest): NextResponse | null {
  const setupErr = verifySetupPin(request);
  if (setupErr) return setupErr;

  const sqlPin = request.headers.get("x-sql-pin");
  if (!sqlPin || sqlPin !== getSqlPin()) {
    return NextResponse.json(
      { error: "PIN do SQL Client inválido ou ausente." },
      { status: 401 }
    );
  }
  return null;
}

/**
 * Garante que o banco mestre `heart` exista e esteja com o schema atualizado.
 */
export async function ensureAndPushHeartSchema(): Promise<{
  stdout: string;
  stderr: string;
}> {
  await ensurePostgresDatabase("heart");
  const heartUrl = getHeartDatabaseUrl();
  const cmd = `npx prisma db push --config=prisma.heart.config.ts --url="${heartUrl}" --accept-data-loss`;
  return execAsync(cmd, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL_HEART: heartUrl,
    },
  });
}

/**
 * Aplica o `prisma/schema.prisma` no banco de dados PostgreSQL isolado de um tenant.
 */
export async function pushTenantSchema(databaseUrl: string): Promise<{
  stdout: string;
  stderr: string;
}> {
  const cmd = `npx prisma db push --config=prisma.config.ts --url="${databaseUrl}" --accept-data-loss`;
  return execAsync(cmd, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });
}
