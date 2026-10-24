import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSetupPin, pushTenantSchema } from "@/lib/setup-auth";
import { heartPrisma, ensurePostgresDatabase } from "@/lib/heart-db";
import { getTenantPrismaClient } from "@/lib/tenant-manager";
import {
  ensureCurrentTenantInvoice,
  enqueueBaseUpsertEvent,
  toDateOnlyString,
  toCents,
  triggerOutboxWorkerAsync,
} from "@/lib/leadger-webhook";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headerPin = request.headers.get("x-setup-pin") || body.pin || "";
    if (!headerPin || headerPin !== getSetupPin()) {
      return NextResponse.json(
        { error: "PIN de acesso inválido ou ausente." },
        { status: 401 }
      );
    }

    const {
      databaseName,
      dbName,
      tenantName,
      adminName,
      adminEmail,
      adminPassword,
      razaoSocial,
      nomeFantasia,
      cnpj,
      telefone,
      logradouro,
      endereco,
      numero,
      complemento,
      bairro,
      municipio,
      cidade,
      uf,
      cep,
      modulos,
      modules,
      logo,
      logoUrl,
      mensalidadeValor,
      mensalidadeVencimento,
      billingDay,
      telefoneContato,
      emailContato,
      observacoes,
      seedDefaults = true,
      syncWithLeadger = false,
    } = body;

    const rawDbName = databaseName || dbName || "";
    const resolvedNomeFantasia = nomeFantasia || tenantName || "";

    if (!rawDbName || !adminEmail || !adminPassword) {
      return NextResponse.json(
        {
          error:
            "Nome do banco (dbName), e-mail do administrador e senha são obrigatórios.",
        },
        { status: 400 }
      );
    }

    const sanitizedDbName = String(rawDbName)
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();

    if (
      !sanitizedDbName ||
      sanitizedDbName === "heart" ||
      sanitizedDbName === "postgres" ||
      sanitizedDbName === "railway"
    ) {
      return NextResponse.json(
        {
          error: `Nome de banco de dados '${sanitizedDbName}' é reservado ou inválido.`,
        },
        { status: 400 }
      );
    }

    const normalizedEmail = String(adminEmail).trim().toLowerCase();

    const existingTenant = await heartPrisma.tenant.findUnique({
      where: { databaseName: sanitizedDbName },
    });
    if (existingTenant) {
      return NextResponse.json(
        {
          error: `Já existe um tenant utilizando o banco '${sanitizedDbName}'.`,
        },
        { status: 400 }
      );
    }

    const existingUser = await heartPrisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      return NextResponse.json(
        {
          error: `O e-mail '${normalizedEmail}' já está cadastrado em outro tenant.`,
        },
        { status: 400 }
      );
    }

    const cleanCnpj = cnpj ? String(cnpj).replace(/\D/g, "") : null;
    if (cleanCnpj) {
      const existingCnpj = await heartPrisma.tenant.findUnique({
        where: { cnpj: cleanCnpj },
      });
      if (existingCnpj) {
        return NextResponse.json(
          { error: `O CNPJ informado já está vinculado a outro tenant.` },
          { status: 400 }
        );
      }
    }

    // 1. Cria o banco de dados PostgreSQL isolado para o tenant
    const tenantDbUrl = await ensurePostgresDatabase(sanitizedDbName);

    // 2. Aplica todas as tabelas do Shark (prisma/schema.prisma) no novo banco
    await pushTenantSchema(tenantDbUrl);

    // 3. Registra o Tenant, usuário Admin, fatura inicial e Outbox no banco mestre (heart)
    const hashedPassword = await bcrypt.hash(String(adminPassword), 10);
    const displayName = resolvedNomeFantasia || razaoSocial || sanitizedDbName;
    const generatedTenantId = randomUUID();
    const resolvedLogo = logoUrl || logo || null;
    const resolvedValor =
      mensalidadeValor !== undefined && mensalidadeValor !== ""
        ? Number(mensalidadeValor)
        : 0;

    const resolvedVencimentoDate = mensalidadeVencimento
      ? new Date(
          String(mensalidadeVencimento).includes("T")
            ? mensalidadeVencimento
            : `${String(mensalidadeVencimento).split("T")[0]}T12:00:00Z`
        )
      : resolvedValor > 0
      ? new Date()
      : null;

    const todayStr = toDateOnlyString(new Date());
    const dueStr = resolvedVencimentoDate
      ? toDateOnlyString(resolvedVencimentoDate)
      : todayStr;
    const resolvedBillingDay = billingDay
      ? Math.min(31, Math.max(1, Number(billingDay)))
      : Number(dueStr.split("-")[2]) || 10;
    const startDate = dueStr < todayStr ? dueStr : todayStr;

    const autoSync =
      Boolean(syncWithLeadger) || process.env.LEADGER_AUTO_SYNC_NEW === "true";

    const result = await heartPrisma.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({
        data: {
          id: generatedTenantId,
          databaseName: sanitizedDbName,
          databaseUrl: tenantDbUrl,
          name: displayName,
          status: "active",
          logoUrl: resolvedLogo,
          razaoSocial: razaoSocial || null,
          nomeFantasia: displayName,
          cnpj: cleanCnpj || null,
          telefone: telefone || telefoneContato || null,
          logradouro: logradouro || endereco || null,
          numero: numero || null,
          complemento: complemento || null,
          bairro: bairro || null,
          municipio: municipio || cidade || null,
          uf: uf || null,
          cep: cep || null,
          modulos: modulos ??
            modules ?? {
              emprestimos: true,
              cheques: true,
              cobrancas: true,
              parceiros: true,
              whatsapp: true,
              clientes: true,
              relatorios: true,
              dashboardMobile: true,
            },
          mensalidadeValor: resolvedValor,
          mensalidadeVencimento: resolvedVencimentoDate,
          billingDay: resolvedBillingDay,
          contractStartDate: startDate,
          effectiveDate: todayStr >= startDate ? todayStr : startDate,
          telefoneContato: telefoneContato || telefone || null,
          emailContato: (emailContato || normalizedEmail).trim().toLowerCase(),
          observacoes: observacoes || null,
          clientExternalId: `cli-${generatedTenantId}`,
          baseExternalId: `base-${generatedTenantId}`,
          clientVersion: 1,
          baseVersion: 1,
          photoVersion: resolvedLogo ? 1 : 0,
          leadgerSyncEnabled: autoSync,
        },
      });

      const createdUser = await tx.user.create({
        data: {
          tenantId: createdTenant.id,
          name: adminName ? String(adminName).trim() : "Administrador",
          email: normalizedEmail,
          password: hashedPassword,
          role: "admin",
          active: true,
        },
      });

      // Cria a fatura inicial se houver mensalidade > 0
      const initialInvoice = await ensureCurrentTenantInvoice(
        tx,
        createdTenant
      );

      // Se a sincronização com o Leadger estiver ativa e a mensalidade for > 0, grava base.upsert na outbox
      if (autoSync && toCents(createdTenant.mensalidadeValor) > 0 && initialInvoice) {
        await enqueueBaseUpsertEvent(tx, createdTenant, [initialInvoice]);
      }

      return {
        tenant: createdTenant,
        adminUser: createdUser,
        initialInvoice,
      };
    });

    // Dispara worker em background se enfileirou evento
    if (autoSync && toCents(result.tenant.mensalidadeValor) > 0) {
      triggerOutboxWorkerAsync(result.tenant.id);
    }

    // 4. Sincroniza o usuário admin e configurações iniciais no banco do tenant
    try {
      const tenantClient = await getTenantPrismaClient(result.tenant.id);
      await tenantClient.perfil.upsert({
        where: { email: result.adminUser.email },
        update: {
          nome: result.adminUser.name,
          senha: hashedPassword,
        },
        create: {
          id: result.adminUser.id,
          nome: result.adminUser.name,
          email: result.adminUser.email,
          senha: hashedPassword,
        },
      });

      if (seedDefaults) {
        await tenantClient.configuracao.upsert({
          where: { chave: "empresa_nome" },
          update: { valor: displayName },
          create: { chave: "empresa_nome", valor: displayName },
        });
      }
    } catch (e) {
      console.warn("Aviso ao criar perfil/config inicial no banco do tenant:", e);
    }

    return NextResponse.json({
      success: true,
      message: `Tenant '${displayName}' provisionado com sucesso no banco '${sanitizedDbName}'!`,
      tenant: result.tenant,
      adminUser: {
        id: result.adminUser.id,
        name: result.adminUser.name,
        email: result.adminUser.email,
        role: result.adminUser.role,
      },
    });
  } catch (error: any) {
    console.error("POST /api/tenants/setup error:", error);
    return NextResponse.json(
      {
        error: error?.message || "Erro interno ao provisionar novo tenant.",
      },
      { status: 500 }
    );
  }
}
