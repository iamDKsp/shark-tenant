import { NextResponse } from "next/server";
import { heartPrisma } from "@/lib/heart-db";
import { getTenantPrismaClient } from "@/lib/tenant-manager";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "solucoes-financeiras-super-secret-key-2026"
);

export async function POST(request: Request) {
  try {
    const { email, password, rememberMe } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-mail e senha são obrigatórios" },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await heartPrisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
      include: {
        tenant: true,
      },
    });

    if (!user || !user.active) {
      return NextResponse.json(
        { error: "Credenciais inválidas ou usuário inativo" },
        { status: 401 }
      );
    }

    if (!user.tenant || user.tenant.status !== "active") {
      return NextResponse.json(
        {
          error:
            user.tenant?.status === "suspended"
              ? "Acesso suspenso temporariamente. Entre em contato com o administrador."
              : "Conta da empresa inativa.",
        },
        { status: 403 }
      );
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return NextResponse.json(
        { error: "Credenciais inválidas" },
        { status: 401 }
      );
    }

    // Sincroniza registro de perfil no banco isolado do tenant (compatibilidade interna)
    try {
      const tenantClient = await getTenantPrismaClient(user.tenantId);
      await tenantClient.perfil.upsert({
        where: { email: user.email },
        update: {
          nome: user.name,
          senha: user.password,
        },
        create: {
          id: user.id,
          nome: user.name,
          email: user.email,
          senha: user.password,
        },
      });
    } catch (syncErr) {
      console.warn("Aviso ao sincronizar perfil no banco do tenant:", syncErr);
    }

    // Tempo de expiração: 30 dias se "Lembrar-me" estiver marcado, senão 24h
    const tokenExp = rememberMe ? "30d" : "24h";
    const cookieMaxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24;

    const token = await new SignJWT({
      sub: user.id,
      id: user.id,
      email: user.email,
      nome: user.name,
      tenantId: user.tenantId,
      role: user.role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(tokenExp)
      .sign(JWT_SECRET);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        tenantName:
          user.tenant.nomeFantasia ||
          user.tenant.razaoSocial ||
          user.tenant.name ||
          user.tenant.databaseName,
      },
    });

    response.cookies.set({
      name: "sol_auth_token",
      value: token,
      httpOnly: true,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: cookieMaxAge,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao realizar login" },
      { status: 500 }
    );
  }
}
