import { NextRequest, NextResponse } from "next/server";
import { verifySetupPin } from "@/lib/setup-auth";
import { heartPrisma } from "@/lib/heart-db";
import { getTenantPrismaClient } from "@/lib/tenant-manager";
import bcrypt from "bcryptjs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; userId: string }> }
) {
  const pinError = verifySetupPin(request);
  if (pinError) return pinError;

  try {
    const { id: tenantId, userId } = await context.params;
    const body = await request.json();
    const { password, newPassword, pin, active, role, name, email } = body;

    const existing = await heartPrisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Usuário não encontrado neste tenant." },
        { status: 404 }
      );
    }

    const updateData: Record<string, any> = {};
    const rawPwd = newPassword ?? password;

    if (rawPwd !== undefined && String(rawPwd).trim() !== "") {
      if (String(rawPwd).length < 4) {
        return NextResponse.json(
          { error: "A senha deve ter no mínimo 4 caracteres." },
          { status: 400 }
        );
      }
      updateData.password = await bcrypt.hash(String(rawPwd), 10);
    }

    if (pin !== undefined) {
      updateData.pin = pin === "" || pin === null ? null : String(pin).trim();
    }

    if (active !== undefined) {
      updateData.active = Boolean(active);
    }

    if (role !== undefined) {
      updateData.role = String(role);
    }

    if (name !== undefined && String(name).trim() !== "") {
      updateData.name = String(name).trim();
    }

    if (email !== undefined && String(email).trim() !== "") {
      const normalized = String(email).trim().toLowerCase();
      const dup = await heartPrisma.user.findFirst({
        where: { email: normalized, NOT: { id: userId } },
      });
      if (dup) {
        return NextResponse.json(
          { error: `E-mail '${normalized}' já está em uso.` },
          { status: 400 }
        );
      }
      updateData.email = normalized;
    }

    const updated = await heartPrisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    try {
      const tenantClient = await getTenantPrismaClient(tenantId, {
        allowInactive: true,
      });
      await tenantClient.perfil.upsert({
        where: { email: updated.email },
        update: {
          nome: updated.name,
          senha: updated.password,
        },
        create: {
          id: updated.id,
          nome: updated.name,
          email: updated.email,
          senha: updated.password,
        },
      });
    } catch {
      // ignora erro secundário
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        pin: updated.pin,
        active: updated.active,
      },
    });
  } catch (error: any) {
    console.error(
      "PATCH /api/tenants/setup/[id]/users/[userId]/password error:",
      error
    );
    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar usuário." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; userId: string }> }
) {
  const pinError = verifySetupPin(request);
  if (pinError) return pinError;

  try {
    const { id: tenantId, userId } = await context.params;

    const existing = await heartPrisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Usuário não encontrado neste tenant." },
        { status: 404 }
      );
    }

    await heartPrisma.user.delete({ where: { id: userId } });

    return NextResponse.json({
      success: true,
      message: `Usuário '${existing.email}' removido com sucesso.`,
    });
  } catch (error: any) {
    console.error("DELETE user error:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao excluir usuário." },
      { status: 500 }
    );
  }
}
