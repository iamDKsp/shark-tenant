import { NextRequest, NextResponse } from "next/server";
import { verifySetupPin } from "@/lib/setup-auth";
import { heartPrisma, dropPostgresDatabase } from "@/lib/heart-db";
import { evictTenantClient } from "@/lib/tenant-manager";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const pinError = verifySetupPin(request);
  if (pinError) return pinError;

  try {
    const { id } = await context.params;
    const body = await request.json();

    const existing = await heartPrisma.tenant.findUnique({ where: { id } });
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
      "logoUrl",
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
    ];

    for (const field of stringFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field] === "" ? null : body[field];
      }
    }

    if (body.name === "" && (body.nomeFantasia || existing.nomeFantasia)) {
      updateData.name = body.nomeFantasia || existing.nomeFantasia;
    } else if (body.nomeFantasia && !body.name) {
      updateData.name = body.nomeFantasia;
    }

    if (body.cnpj !== undefined) {
      const cleanCnpj = body.cnpj ? String(body.cnpj).replace(/\D/g, "") : null;
      updateData.cnpj = cleanCnpj || null;
    }

    if (body.modulos !== undefined) {
      updateData.modulos = body.modulos;
    }

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
    }

    const updated = await heartPrisma.tenant.update({
      where: { id },
      data: updateData,
    });

    // Invalida cache de conexão do tenant para aplicar novo status/configuração imediatamente
    await evictTenantClient(id);

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PATCH /api/tenants/setup/[id] error:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar tenant." },
      { status: 500 }
    );
  }
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
