import { NextRequest, NextResponse } from "next/server";
import { verifySetupPin } from "@/lib/setup-auth";
import { heartPrisma, dropPostgresDatabase } from "@/lib/heart-db";
import { evictTenantClient } from "@/lib/tenant-manager";
import {
  ensureCurrentTenantInvoice,
  enqueueBaseUpsertEvent,
  enqueueClientUpsertEvent,
  getLeadgerWebhookConfig,
  sanitizeExternalId,
  toCents,
  toDateOnlyString,
  triggerOutboxWorkerAsync,
} from "@/lib/leadger-webhook";

async function handleUpdateTenant(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const pinError = verifySetupPin(request);
  if (pinError) return pinError;

  try {
    const { id } = await context.params;
    const body = await request.json();

    const existing = await heartPrisma.tenant.findUnique({
      where: { id },
      include: {
        users: { select: { email: true }, take: 1 },
        invoices: { orderBy: { dueDate: "asc" } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Tenant não encontrado." },
        { status: 404 }
      );
    }

    const updateData: Record<string, any> = {};
    const stringFields = [
      "name",
      "status",
      "razaoSocial",
      "nomeFantasia",
      "telefone",
      "logradouro",
      "numero",
      "complemento",
      "bairro",
      "municipio",
      "uf",
      "cep",
      "telefoneContato",
      "emailContato",
      "observacoes",
      "contractStartDate",
      "contractEndDate",
      "effectiveDate",
    ];

    for (const field of stringFields) {
      if (body[field] !== undefined) {
        updateData[field] =
          body[field] === "" || body[field] === null
            ? null
            : String(body[field]).trim();
      }
    }

    // Compatibilidade com campos do /sys-init (endereco, cidade, logo, modules)
    if (body.endereco !== undefined && body.logradouro === undefined) {
      updateData.logradouro =
        body.endereco === "" || body.endereco === null
          ? null
          : String(body.endereco).trim();
    }

    if (body.cidade !== undefined && body.municipio === undefined) {
      const rawCidade = String(body.cidade || "").trim();
      if (!rawCidade) {
        updateData.municipio = null;
      } else if (rawCidade.includes(" - ")) {
        const parts = rawCidade.split(" - ");
        updateData.municipio = parts[0].trim() || null;
        if (parts[1] && body.uf === undefined) {
          updateData.uf = parts[1].trim().slice(0, 2).toUpperCase() || null;
        }
      } else {
        updateData.municipio = rawCidade;
      }
    }

    if (body.telefone !== undefined && body.telefoneContato === undefined) {
      updateData.telefoneContato =
        body.telefone === "" || body.telefone === null
          ? null
          : String(body.telefone).trim();
    }

    if (updateData.emailContato) {
      updateData.emailContato = String(updateData.emailContato)
        .trim()
        .toLowerCase();
    }

    if (body.name === "" && (body.nomeFantasia || existing.nomeFantasia)) {
      updateData.name = body.nomeFantasia || existing.nomeFantasia;
    } else if (body.nomeFantasia && !body.name && !existing.name) {
      updateData.name = body.nomeFantasia;
    }

    if (body.cnpj !== undefined) {
      const cleanCnpj = body.cnpj ? String(body.cnpj).replace(/\D/g, "") : null;
      updateData.cnpj = cleanCnpj || null;
    }

    // Módulos (aceita modulos ou modules)
    const rawModules =
      body.modulos !== undefined ? body.modulos : body.modules;
    if (rawModules !== undefined) {
      if (typeof rawModules === "string") {
        try {
          updateData.modulos = JSON.parse(rawModules);
        } catch {
          updateData.modulos = rawModules;
        }
      } else {
        updateData.modulos = rawModules;
      }
    }

    // Logo / Foto (aceita logoUrl ou logo)
    const rawLogo = body.logoUrl !== undefined ? body.logoUrl : body.logo;
    let photoChanged = false;
    let photoRemoved = false;

    if (rawLogo !== undefined) {
      const normalizedLogo =
        rawLogo === "" || rawLogo === null ? null : String(rawLogo).trim();
      if (normalizedLogo !== (existing.logoUrl || null)) {
        updateData.logoUrl = normalizedLogo;
        if (normalizedLogo === null && existing.logoUrl) {
          // Remoção explícita: preserva photoVersion anterior (Seção 11) e incrementa clientVersion
          photoRemoved = true;
        } else if (normalizedLogo !== null) {
          photoChanged = true;
          updateData.photoVersion = Number(existing.photoVersion || 0) + 1;
        }
      }
    }

    // Mensalidade e vencimento
    if (body.mensalidadeValor !== undefined) {
      updateData.mensalidadeValor =
        body.mensalidadeValor === null || body.mensalidadeValor === ""
          ? 0
          : Number(body.mensalidadeValor);
    }

    if (body.mensalidadeVencimento !== undefined) {
      updateData.mensalidadeVencimento = body.mensalidadeVencimento
        ? new Date(
            `${String(body.mensalidadeVencimento).split("T")[0]}T12:00:00Z`
          )
        : null;
      if (updateData.mensalidadeVencimento && body.billingDay === undefined) {
        updateData.billingDay = updateData.mensalidadeVencimento.getUTCDate();
      }
    }

    if (body.billingDay !== undefined) {
      updateData.billingDay = body.billingDay
        ? Math.min(31, Math.max(1, Number(body.billingDay)))
        : null;
    }

    if (body.leadgerSyncEnabled !== undefined) {
      updateData.leadgerSyncEnabled = Boolean(body.leadgerSyncEnabled);
    }

    if (body.clientExternalId !== undefined && body.clientExternalId) {
      updateData.clientExternalId = sanitizeExternalId(
        body.clientExternalId,
        "cli"
      );
    }

    if (body.baseExternalId !== undefined && body.baseExternalId) {
      updateData.baseExternalId = sanitizeExternalId(
        body.baseExternalId,
        "base"
      );
    }

    if (!existing.clientExternalId && !updateData.clientExternalId) {
      updateData.clientExternalId = `cli-${existing.id}`;
    }
    if (!existing.baseExternalId && !updateData.baseExternalId) {
      updateData.baseExternalId = `base-${existing.id}`;
    }

    // Detecta se houve alteração de Cliente ou de Base para incrementar versões independentes (Seção 4)
    const clientChanged =
      photoChanged ||
      photoRemoved ||
      (updateData.name !== undefined && updateData.name !== existing.name) ||
      (updateData.nomeFantasia !== undefined &&
        updateData.nomeFantasia !== existing.nomeFantasia) ||
      (updateData.razaoSocial !== undefined &&
        updateData.razaoSocial !== existing.razaoSocial) ||
      (updateData.cnpj !== undefined && updateData.cnpj !== existing.cnpj) ||
      (updateData.emailContato !== undefined &&
        updateData.emailContato !== existing.emailContato) ||
      (updateData.telefone !== undefined &&
        updateData.telefone !== existing.telefone) ||
      (updateData.telefoneContato !== undefined &&
        updateData.telefoneContato !== existing.telefoneContato) ||
      (updateData.observacoes !== undefined &&
        updateData.observacoes !== existing.observacoes) ||
      (updateData.status !== undefined &&
        updateData.status !== existing.status);

    const oldAmountCents = toCents(existing.mensalidadeValor);
    const newAmountCents =
      updateData.mensalidadeValor !== undefined
        ? toCents(updateData.mensalidadeValor)
        : oldAmountCents;

    const oldDueStr = existing.mensalidadeVencimento
      ? toDateOnlyString(existing.mensalidadeVencimento)
      : "";
    const newDueStr =
      updateData.mensalidadeVencimento !== undefined
        ? updateData.mensalidadeVencimento
          ? toDateOnlyString(updateData.mensalidadeVencimento)
          : ""
        : oldDueStr;

    const baseChanged =
      newAmountCents !== oldAmountCents ||
      newDueStr !== oldDueStr ||
      (updateData.billingDay !== undefined &&
        updateData.billingDay !== existing.billingDay) ||
      (updateData.contractStartDate !== undefined &&
        updateData.contractStartDate !== existing.contractStartDate) ||
      (updateData.contractEndDate !== undefined &&
        updateData.contractEndDate !== existing.contractEndDate) ||
      (updateData.effectiveDate !== undefined &&
        updateData.effectiveDate !== existing.effectiveDate) ||
      (updateData.status !== undefined &&
        updateData.status !== existing.status) ||
      (updateData.nomeFantasia !== undefined &&
        updateData.nomeFantasia !== existing.nomeFantasia);

    if (clientChanged && existing.leadgerSynced) {
      updateData.clientVersion = Number(existing.clientVersion || 1) + 1;
    }

    if (baseChanged && existing.leadgerSynced) {
      updateData.baseVersion = Number(existing.baseVersion || 1) + 1;
      if (!updateData.effectiveDate) {
        updateData.effectiveDate = toDateOnlyString(new Date());
      }
    }

    const updated = await heartPrisma.$transaction(async (tx) => {
      const savedTenant = await tx.tenant.update({
        where: { id },
        data: updateData,
        include: {
          users: { select: { email: true }, take: 1 },
        },
      });

      // Se o valor mensal mudou para um valor positivo, recalcula faturas pending com vencimento >= effectiveDate (Seção 6)
      const effDate =
        savedTenant.effectiveDate || toDateOnlyString(new Date());
      if (newAmountCents > 0 && newAmountCents !== oldAmountCents) {
        const pendingInvoices = await tx.tenantInvoice.findMany({
          where: {
            tenantId: id,
            status: "pending",
            dueDate: { gte: effDate },
          },
        });

        for (const inv of pendingInvoices) {
          if (inv.amount !== newAmountCents) {
            await tx.tenantInvoice.update({
              where: { id: inv.id },
              data: {
                amount: newAmountCents,
                version: inv.version + 1,
              },
            });
          }
        }
      }

      // Garante fatura atual se mensalidade > 0 e vencimento configurado
      await ensureCurrentTenantInvoice(tx, savedTenant);

      const allInvoices = await tx.tenantInvoice.findMany({
        where: { tenantId: id },
        orderBy: { dueDate: "asc" },
      });

      const shouldSync =
        savedTenant.leadgerSyncEnabled || savedTenant.leadgerSynced;

      if (shouldSync) {
        if (
          (baseChanged || !savedTenant.leadgerSynced) &&
          toCents(savedTenant.mensalidadeValor) > 0 &&
          allInvoices.length > 0
        ) {
          await enqueueBaseUpsertEvent(tx, savedTenant, allInvoices);
        } else if (clientChanged && savedTenant.leadgerSynced && !photoChanged && !photoRemoved) {
          await enqueueClientUpsertEvent(tx, savedTenant, {
            includePhoto: false,
          });
        }

        // Se a foto mudou ou foi removida, envia client.upsert separado (Seção 11)
        const cfg = getLeadgerWebhookConfig();
        if (
          savedTenant.leadgerSynced &&
          (photoChanged || photoRemoved) &&
          (cfg.photoEnabled || photoRemoved)
        ) {
          await enqueueClientUpsertEvent(tx, savedTenant, {
            includePhoto: photoChanged,
            removePhoto: photoRemoved,
          });
        }
      }

      return savedTenant;
    });

    // Dispara worker em background se o tenant estiver integrado
    if (updated.leadgerSyncEnabled || updated.leadgerSynced) {
      triggerOutboxWorkerAsync(updated.id);
    }

    // Invalida cache de conexão do tenant para aplicar novo status/configuração imediatamente
    await evictTenantClient(id);

    const cidadeFormatada = [updated.municipio, updated.uf]
      .filter(Boolean)
      .join(" - ");

    return NextResponse.json({
      ...updated,
      logo: updated.logoUrl || "",
      modules: updated.modulos,
      endereco: updated.logradouro || "",
      cidade: cidadeFormatada || "",
    });
  } catch (error: any) {
    console.error("PATCH/PUT /api/tenants/setup/[id] error:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar tenant." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleUpdateTenant(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleUpdateTenant(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const pinError = verifySetupPin(request);
  if (pinError) return pinError;

  try {
    const { id } = await context.params;
    const existing = await heartPrisma.tenant.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: "Tenant não encontrado." },
        { status: 404 }
      );
    }

    // 1. Desconecta e remove do pool de conexões em memória
    await evictTenantClient(id);

    // 2. Remove o registro do tenant (e usuários/pagamentos em cascata) no heart
    await heartPrisma.tenant.delete({ where: { id } });

    // 3. Dropa o banco de dados PostgreSQL isolado do tenant
    let dbDropped = true;
    let dropWarning: string | undefined;
    try {
      await dropPostgresDatabase(existing.databaseName);
    } catch (dropErr: any) {
      dbDropped = false;
      dropWarning = dropErr?.message;
      console.warn(
        `Aviso ao dropar banco PostgreSQL '${existing.databaseName}':`,
        dropErr
      );
    }

    return NextResponse.json({
      success: true,
      dbDropped,
      warning: dropWarning,
      message: `Tenant '${existing.nomeFantasia || existing.databaseName}' excluído com sucesso.`,
    });
  } catch (error: any) {
    console.error("DELETE /api/tenants/setup/[id] error:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao excluir tenant." },
      { status: 500 }
    );
  }
}
