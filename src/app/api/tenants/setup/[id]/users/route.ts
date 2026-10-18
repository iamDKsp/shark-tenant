import { NextRequest, NextResponse } from "next/server";
import { verifySetupPin } from "@/lib/setup-auth";
import { heartPrisma } from "@/lib/heart-db";
import { getTenantPrismaClient } from "@/lib/tenant-manager";
import bcrypt from "bcryptjs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const pinError = verifySetupPin(request);
  if (pinError) return pinError;

  try {
    const { id } = await context.params;
    const users = await heartPrisma.user.findMany({
      where: { tenantId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        role: true,
        pin: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(users);
  } catch (error: any) {
    console.error("GET /api/tenants/setup/[id]/users error:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao listar usuários do tenant." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const pinError = verifySetupPin(request);
  if (pinError) return pinError;

  try {
    const { id: tenantId } = await context.params;
    const body = await request.json();
    const { name, email, password, role, pin } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nome, e-mail e senha são obrigatórios." },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await heartPrisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return NextResponse.json(
        { error: `O e-mail '${normalizedEmail}' já está em uso no sistema.` },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);

    const created = await heartPrisma.user.create({
      data: {
        tenantId,
        name: String(name).trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: role || "admin",
        pin: pin ? String(pin).trim() : null,
        active: true,
      },
    });

    // Sincroniza na tabela perfis do banco do tenant
    try {
      const tenantClient = await getTenantPrismaClient(tenantId, {
        allowInactive: true,
      });
      await tenantClient.perfil.upsert({
        where: { email: created.email },
        update: {
          nome: created.name,
          senha: hashedPassword,
        },
        create: {
          id: created.id,
          nome: created.name,
          email: created.email,
          senha: hashedPassword,
        },
      });
    } catch {
      // ignora erro caso banco do tenant esteja inacessível
    }

    return NextResponse.json({
      id: created.id,
      tenantId: created.tenantId,
      name: created.name,
      email: created.email,
      role: created.role,
      pin: created.pin,
      active: created.active,
      createdAt: created.createdAt,
    });
  } catch (error: any) {
    console.error("POST /api/tenants/setup/[id]/users error:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao criar usuário no tenant." },
      { status: 500 }
    );
  }
}
