import { NextRequest, NextResponse } from "next/server";
import { verifySetupPin } from "@/lib/setup-auth";
import { heartPrisma } from "@/lib/heart-db";
import { getTenantPrismaClient } from "@/lib/tenant-manager";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "solucoes-financeiras-super-secret-key-2026"
);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const pinError = verifySetupPin(request);
  if (pinError) return pinError;

  try {
    const { id: tenantId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { userId } = body as { userId?: string };

    const tenant = await heartPrisma.tenant.findUnique({
      where: { id: tenantId },
      include: { users: { orderBy: { createdAt: "asc" } } },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant não encontrado." },
        { status: 404 }
      );
    }

    let targetUser = userId
      ? tenant.users.find((u) => u.id === userId)
      : tenant.users.find((u) => u.role === "admin" && u.active) ||
        tenant.users.find((u) => u.active) ||
        tenant.users[0];

    if (!targetUser) {
      return NextResponse.json(
        { error: "Este tenant não possui nenhum usuário cadastrado para acesso." },
        { status: 400 }
      );
    }

    // Sincroniza o usuário na tabela perfis do banco do tenant
    try {
      const tenantClient = await getTenantPrismaClient(tenant.id, {
        allowInactive: true,
      });
      await tenantClient.perfil.upsert({
        where: { email: targetUser.email },
        update: {
          nome: targetUser.name,
          senha: targetUser.password,
        },
        create: {
          id: targetUser.id,
          nome: targetUser.name,
          email: targetUser.email,
          senha: targetUser.password,
        },
      });
    } catch {
      // ignora falha secundária
    }

    const token = await new SignJWT({
      sub: targetUser.id,
      id: targetUser.id,
      email: targetUser.email,
      nome: targetUser.name,
      tenantId: tenant.id,
      role: targetUser.role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("24h")
      .sign(JWT_SECRET);

    const tenantName =
      tenant.nomeFantasia ||
      tenant.razaoSocial ||
      tenant.name ||
      tenant.databaseName;

    const response = NextResponse.json({
      success: true,
      message: `Sessão iniciada como ${targetUser.name} (${tenantName})!`,
      redirectUrl: "/",
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        tenantId: tenant.id,
        tenantName,
      },
    });

    response.cookies.set({
      name: "sol_auth_token",
      value: token,
      httpOnly: true,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error: any) {
    console.error("POST /api/tenants/setup/[id]/impersonate error:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao acessar painel do tenant." },
      { status: 500 }
    );
  }
}
