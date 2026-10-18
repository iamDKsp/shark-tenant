import { PrismaClient } from "@prisma/client";
import { getCurrentTenantClient } from "./tenant-manager";

/**
 * Proxy dinâmico Multi-Tenant para o PrismaClient.
 *
 * Redireciona automaticamente todas as chamadas (`prisma.cliente.*`, `prisma.emprestimo.*`,
 * `prisma.$transaction(...)`, etc.) para o banco de dados PostgreSQL exclusivo do tenant
 * autenticado na requisição atual (via cookie JWT `sol_auth_token` ou `AsyncLocalStorage`).
 */
function createMultiTenantPrismaProxy(): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get(_target, prop: string | symbol) {
      if (typeof prop === "symbol" || prop === "then") {
        return undefined;
      }

      // Métodos de nível raiz do PrismaClient ($transaction, $queryRaw, $executeRaw, etc.)
      if (prop.startsWith("$")) {
        return async (...args: any[]) => {
          const client = await getCurrentTenantClient();
          const fn = (client as any)[prop];
          if (typeof fn !== "function") {
            return fn;
          }
          return fn.apply(client, args);
        };
      }

      // Delegates de modelos (prisma.cliente, prisma.emprestimo, prisma.parcela, etc.)
      return new Proxy(
        {},
        {
          get(_modelTarget, methodProp: string | symbol) {
            if (typeof methodProp === "symbol" || methodProp === "then") {
              return undefined;
            }
            return async (...args: any[]) => {
              const client = await getCurrentTenantClient();
              const modelDelegate = (client as any)[prop];
              if (!modelDelegate) {
                throw new Error(
                  `Modelo '${String(prop)}' não existe no PrismaClient do tenant.`
                );
              }
              const method = modelDelegate[methodProp];
              if (typeof method !== "function") {
                return method;
              }
              return method.apply(modelDelegate, args);
            };
          },
        }
      );
    },
  });
}

export const prisma: PrismaClient = createMultiTenantPrismaProxy();
