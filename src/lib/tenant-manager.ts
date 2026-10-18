import { AsyncLocalStorage } from "async_hooks";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { heartPrisma, buildDatabaseUrl, getAdminDatabaseUrl } from "./heart-db";

export interface TenantContextStore {
  tenantId: string;
  userId?: string;
  userEmail?: string;
  role?: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContextStore>();

/**
 * Executa uma função dentro do contexto explícito de um tenant específico (útil em jobs/scripts/provisionamento).
 */
export function runWithTenant<T>(
  context: TenantContextStore,
  fn: () => Promise<T>
): Promise<T> {
  return tenantStorage.run(context, fn);
}

interface ClientEntry {
  client: PrismaClient;
  pool: Pool;
  lastUsed: number;
}

interface CachedUrlEntry {
  url: string;
  status: string;
  expiresAt: number;
}

const MAX_CLIENTS = 50;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos
const URL_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

const globalForTenants = globalThis as unknown as {
  tenantClients: Map<string, ClientEntry> | undefined;
  tenantUrlCache: Map<string, CachedUrlEntry> | undefined;
  tenantConnectionPromises: Map<string, Promise<PrismaClient>> | undefined;
};

const clients =
  globalForTenants.tenantClients ?? new Map<string, ClientEntry>();
const urlCache =
  globalForTenants.tenantUrlCache ?? new Map<string, CachedUrlEntry>();
const connectionPromises =
  globalForTenants.tenantConnectionPromises ??
  new Map<string, Promise<PrismaClient>>();

if (process.env.NODE_ENV !== "production") {
  globalForTenants.tenantClients = clients;
  globalForTenants.tenantUrlCache = urlCache;
  globalForTenants.tenantConnectionPromises = connectionPromises;
}

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(
    process.env.JWT_SECRET || "solucoes-financeiras-super-secret-key-2026"
  );
}

/**
 * Resolve o contexto do usuário/tenant atual via AsyncLocalStorage ou cookie JWT `sol_auth_token`.
 */
export async function resolveCurrentTenantContext(): Promise<TenantContextStore> {
  const store = tenantStorage.getStore();
  if (store?.tenantId) {
    return store;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("sol_auth_token")?.value;

  if (!token) {
    throw new Error("Sessão não autenticada (token ausente). Faça login novamente.");
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const tenantId = payload.tenantId as string | undefined;
    if (!tenantId) {
      throw new Error("Token de sessão não possui tenantId vinculado. Faça login novamente.");
    }
    return {
      tenantId,
      userId: (payload.sub as string) || (payload.id as string),
      userEmail: payload.email as string | undefined,
      role: payload.role as string | undefined,
    };
  } catch (err: any) {
    throw new Error(err?.message || "Token de sessão inválido ou expirado.");
  }
}

/**
 * Invalida o cache de URL e desconecta o PrismaClient de um tenant específico.
 */
export async function evictTenantClient(tenantId: string): Promise<void> {
  urlCache.delete(tenantId);
  connectionPromises.delete(tenantId);

  const entry = clients.get(tenantId);
  if (entry) {
    clients.delete(tenantId);
    await entry.client.$disconnect().catch(() => {});
    await entry.pool.end().catch(() => {});
  }
}

/**
 * Limpa conexões ociosas ou aplica política LRU caso o limite MAX_CLIENTS seja atingido.
 */
async function cleanupConnectionsIfNeeded(): Promise<void> {
  const now = Date.now();

  for (const [id, entry] of clients.entries()) {
    if (now - entry.lastUsed > IDLE_TIMEOUT_MS) {
      await evictTenantClient(id);
    }
  }

  if (clients.size >= MAX_CLIENTS) {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, entry] of clients.entries()) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldestId = id;
      }
    }

    if (oldestId) {
      await evictTenantClient(oldestId);
    }
  }
}

/**
 * Obtém (ou cria) o PrismaClient isolado do banco de dados de um tenant específico.
 */
export async function getTenantPrismaClient(
  tenantId: string,
  options?: { allowInactive?: boolean }
): Promise<PrismaClient> {
  const existing = clients.get(tenantId);
  if (existing) {
    const cachedUrl = urlCache.get(tenantId);
    if (
      !options?.allowInactive &&
      cachedUrl &&
      cachedUrl.status !== "active"
    ) {
      throw new Error(`Acesso bloqueado: o tenant encontra-se com status '${cachedUrl.status}'.`);
    }
    existing.lastUsed = Date.now();
    return existing.client;
  }

  const pending = connectionPromises.get(tenantId);
  if (pending) {
    return pending;
  }

  const connectPromise = (async () => {
    try {
      await cleanupConnectionsIfNeeded();

      const now = Date.now();
      let cached = urlCache.get(tenantId);

      if (!cached || cached.expiresAt < now) {
        const tenant = await heartPrisma.tenant.findUnique({
          where: { id: tenantId },
          select: { databaseUrl: true, databaseName: true, status: true },
        });

        if (!tenant) {
          throw new Error(`Tenant '${tenantId}' não encontrado no banco mestre (heart).`);
        }

        // Reconstrói a URL usando o host atual de DATABASE_URL caso tenha mudado de ambiente,
        // mantendo o databaseName isolado do tenant
        let resolvedUrl = tenant.databaseUrl;
        try {
          const baseAdmin = getAdminDatabaseUrl();
          if (tenant.databaseName) {
            resolvedUrl = buildDatabaseUrl(baseAdmin, tenant.databaseName);
          }
        } catch {
          // fallback para tenant.databaseUrl salvo no banco
        }

        cached = {
          url: resolvedUrl,
          status: tenant.status,
          expiresAt: now + URL_CACHE_TTL_MS,
        };
        urlCache.set(tenantId, cached);
      }

      if (!options?.allowInactive && cached.status !== "active") {
        throw new Error(`Acesso bloqueado: a conta desta empresa está '${cached.status}'.`);
      }

      const pool = new Pool({
        connectionString: cached.url,
        max: 5,
        idleTimeoutMillis: 30000,
      });
      const adapter = new PrismaPg(pool);
      const client = new PrismaClient({ adapter });

      clients.set(tenantId, {
        client,
        pool,
        lastUsed: Date.now(),
      });

      return client;
    } finally {
      connectionPromises.delete(tenantId);
    }
  })();

  connectionPromises.set(tenantId, connectPromise);
  return connectPromise;
}

/**
 * Obtém o PrismaClient correspondente ao tenant logado na requisição atual.
 */
export async function getCurrentTenantClient(): Promise<PrismaClient> {
  const { tenantId } = await resolveCurrentTenantContext();
  return getTenantPrismaClient(tenantId);
}
