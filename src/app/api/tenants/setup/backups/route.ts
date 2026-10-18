import { NextRequest, NextResponse } from "next/server";
import { verifySetupPin } from "@/lib/setup-auth";
import {
  heartPrisma,
  getHeartDatabaseUrl,
  buildDatabaseUrl,
  getAdminDatabaseUrl,
} from "@/lib/heart-db";
import { Client } from "pg";
import fs from "fs";
import path from "path";
import os from "os";

const BACKUP_DIR = path.join(os.tmpdir(), "shark-backups");

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

async function dumpDatabaseToJson(connectionString: string, dbName: string) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const tablesRes = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    const tables: Record<string, any[]> = {};
    for (const row of tablesRes.rows) {
      const tName = row.table_name;
      const dataRes = await client.query(`SELECT * FROM "${tName}"`);
      tables[tName] = dataRes.rows;
    }
    return {
      databaseName: dbName,
      exportedAt: new Date().toISOString(),
      tables,
    };
  } finally {
    await client.end().catch(() => {});
  }
}

export async function GET(request: NextRequest) {
  const pinError = verifySetupPin(request);
  if (pinError) return pinError;

  try {
    ensureBackupDir();
    const downloadFile = request.nextUrl.searchParams.get("download");

    if (downloadFile) {
      const safeName = path.basename(downloadFile);
      const filePath = path.join(BACKUP_DIR, safeName);
      if (!fs.existsSync(filePath)) {
        return NextResponse.json(
          { error: "Arquivo de backup não encontrado." },
          { status: 404 }
        );
      }
      const content = fs.readFileSync(filePath);
      return new NextResponse(content, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${safeName}"`,
        },
      });
    }

    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((filename) => {
        const fullPath = path.join(BACKUP_DIR, filename);
        const stat = fs.statSync(fullPath);
        const isHeart = filename.startsWith("heart_");
        const dbPart = filename.split("__")[0] || "backup";
        return {
          filename,
          databaseName: dbPart,
          isHeart,
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString(),
        };
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    return NextResponse.json(files);
  } catch (error: any) {
    console.error("GET /api/tenants/setup/backups error:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao listar backups." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const pinError = verifySetupPin(request);
  if (pinError) return pinError;

  try {
    ensureBackupDir();
    const body = await request.json().catch(() => ({}));
    const { target = "all" } = body as { target?: string };

    const createdFiles: any[] = [];
    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);

    if (target === "all" || target === "heart") {
      const dump = await dumpDatabaseToJson(getHeartDatabaseUrl(), "heart");
      const filename = `heart__${stamp}.json`;
      const fullPath = path.join(BACKUP_DIR, filename);
      fs.writeFileSync(fullPath, JSON.stringify(dump, null, 2), "utf-8");
      createdFiles.push({
        filename,
        databaseName: "heart",
        sizeBytes: fs.statSync(fullPath).size,
      });
    }

    if (target === "all") {
      const tenants = await heartPrisma.tenant.findMany();
      for (const t of tenants) {
        try {
          const url = buildDatabaseUrl(getAdminDatabaseUrl(), t.databaseName);
          const dump = await dumpDatabaseToJson(url, t.databaseName);
          const filename = `${t.databaseName}__${stamp}.json`;
          const fullPath = path.join(BACKUP_DIR, filename);
          fs.writeFileSync(fullPath, JSON.stringify(dump, null, 2), "utf-8");
          createdFiles.push({
            filename,
            databaseName: t.databaseName,
            sizeBytes: fs.statSync(fullPath).size,
          });
        } catch (err) {
          console.warn(`Aviso ao gerar backup de ${t.databaseName}:`, err);
        }
      }
    } else if (target !== "heart") {
      const tenant = await heartPrisma.tenant.findFirst({
        where: { OR: [{ id: target }, { databaseName: target }] },
      });
      if (!tenant) {
        return NextResponse.json(
          { error: "Tenant não encontrado para backup." },
          { status: 404 }
        );
      }
      const url = buildDatabaseUrl(getAdminDatabaseUrl(), tenant.databaseName);
      const dump = await dumpDatabaseToJson(url, tenant.databaseName);
      const filename = `${tenant.databaseName}__${stamp}.json`;
      const fullPath = path.join(BACKUP_DIR, filename);
      fs.writeFileSync(fullPath, JSON.stringify(dump, null, 2), "utf-8");
      createdFiles.push({
        filename,
        databaseName: tenant.databaseName,
        sizeBytes: fs.statSync(fullPath).size,
      });
    }

    return NextResponse.json({
      success: true,
      message: `${createdFiles.length} backup(s) gerado(s) com sucesso!`,
      createdFiles,
    });
  } catch (error: any) {
    console.error("POST /api/tenants/setup/backups error:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao criar backup." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const pinError = verifySetupPin(request);
  if (pinError) return pinError;

  try {
    ensureBackupDir();
    const filename = request.nextUrl.searchParams.get("filename");
    if (!filename) {
      return NextResponse.json(
        { error: "Informe o nome do arquivo para excluir." },
        { status: 400 }
      );
    }
    const safeName = path.basename(filename);
    const fullPath = path.join(BACKUP_DIR, safeName);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao excluir backup." },
      { status: 500 }
    );
  }
}
