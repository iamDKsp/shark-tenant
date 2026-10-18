import { PrismaClient as HeartPrismaClient } from "@/generated/heart-client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool, Client } from "pg";

/**
 * Substitui o nome do banco de dados em uma URL de conexão PostgreSQL.
 */
export function buildDatabaseUrl(baseUrl: string, dbName: string): string {
  const parsed = new URL(baseUrl);
  parsed.pathname = `/${dbName}`;
  return parsed.toString();
}

/**
 * Retorna a URL base administrativa do PostgreSQL (usada para CREATE/DROP DATABASE).
 */
export function getAdminDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL || process.env.DATABASE_URL_HEART;
  if (!raw) {
    return "postgresql://postgres:postgres@localhost:5432/postgres";
  }
  return raw;
}

/**
 * Retorna a URL de conexão do banco mestre `heart`.
 */
export function getHeartDatabaseUrl(): string {
  if (process.env.DATABASE_URL_HEART) {
    return process.env.DATABASE_URL_HEART;
  }
  const base = getAdminDatabaseUrl();
  return buildDatabaseUrl(base, "heart");
}

/**
 * Garante que um banco de dados PostgreSQL exista na instância.
 * Retorna a connectionString completa apontando para o banco criado/existente.
 */
export async function ensurePostgresDatabase(dbName: string): Promise<string> {
  const sanitized = dbName.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
  const adminUrl = getAdminDatabaseUrl();

  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const res = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [sanitized]
    );
    if (res.rowCount === 0) {
      await client.query(`CREATE DATABASE "${sanitized}"`);
    }
  } finally {
    await client.end().catch(() => {});
  }

  return buildDatabaseUrl(adminUrl, sanitized);
}

/**
 * Encerra conexões ativas e remove um banco de dados PostgreSQL de um tenant.
 */
export async function dropPostgresDatabase(dbName: string): Promise<void> {
  const sanitized = dbName.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
  if (sanitized === "heart" || sanitized === "postgres" || sanitized === "railway") {
    throw new Error(`Proibido remover o banco de sistema "${sanitized}".`);
  }

  const adminUrl = getAdminDatabaseUrl();
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [sanitized]
    );
    await client.query(`DROP DATABASE IF EXISTS "${sanitized}"`);
  } finally {
    await client.end().catch(() => {});
  }
}

const globalForHeart = globalThis as unknown as {
  heartPrisma: HeartPrismaClient | undefined;
  heartPool: Pool | undefined;
};

function createHeartPrismaClient(): HeartPrismaClient {
  const connectionString = getHeartDatabaseUrl();
  const pool =
    globalForHeart.heartPool ??
    new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForHeart.heartPool = pool;
  }

  const adapter = new PrismaPg(pool);
  return new HeartPrismaClient({ adapter });
}

export const heartPrisma: HeartPrismaClient =
  globalForHeart.heartPrisma ?? createHeartPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForHeart.heartPrisma = heartPrisma;
}
