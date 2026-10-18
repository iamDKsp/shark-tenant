import { NextRequest, NextResponse } from "next/server";
import { getSetupPin, pushTenantSchema } from "@/lib/setup-auth";
import { heartPrisma, ensurePostgresDatabase } from "@/lib/heart-db";
import { getTenantPrismaClient } from "@/lib/tenant-manager";
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
      numero,
      complemento,
      bairro,
      municipio,
      uf,
      cep,
      modulos,
      mensalidadeValor,
      mensalidadeVencimento,
      telefoneContato,
      emailContato,
      observacoes,
      seedDefaults = true,
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

    // 3. Registra o Tenant e o usuário Admin no banco mestre (heart)
    const hashedPassword = await bcrypt.hash(String(adminPassword), 10);
    const displayName = resolvedNomeFantasia || razaoSocial || sanitizedDbName;

    const result = await heartPrisma.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({
        data: {
          databaseName: sanitizedDbName,
          databaseUrl: tenantDbUrl,
          name: displayName,
          status: "active",
          razaoSocial: razaoSocial || null,
          nomeFantasia: displayName,
          cnpj: cleanCnpj || null,
          telefone: telefone || telefoneContato || null,
          logradouro: logradouro || null,
          numero: numero || null,
          complemento: complemento || null,
          bairro: bairro || null,
          municipio: municipio || null,
          uf: uf || null,
          cep: cep || null,
          modulos: modulos ?? {
            emprestimos: true,
            cheques: true,
            parceiros: true,
            whatsapp: true,
            relatorios: true,
            dashboardMobile: true,
          },
          mensalidadeValor:
            mensalidadeValor !== undefined && mensalidadeValor !== ""
              ? Number(mensalidadeValor)
              : 0,
          mensalidadeVencimento: mensalidadeVencimento
            ? new Date(
                mensalidadeVencimento.includes("T")
                  ? mensalidadeVencimento
                  : `${String(mensalidadeVencimento).split("T")[0]}T12:00:00Z`
              )
            : null,
          telefoneContato: telefoneContato || telefone || null,
          emailContato: emailContato || normalizedEmail,
          observacoes: observacoes || null,
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

      return { tenant: createdTenant, adminUser: createdUser };
    });

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
