const { Client } = require("pg");
const { execSync } = require("child_process");

async function initHeart() {
  const baseUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_HEART;
  if (!baseUrl) {
    console.log("[init-heart] DATABASE_URL não definida, pulando inicialização automática.");
    return;
  }

  try {
    console.log("[init-heart] Verificando banco mestre 'heart' no PostgreSQL...");
    const client = new Client({ connectionString: baseUrl });
    await client.connect();
    try {
      const res = await client.query(
        "SELECT 1 FROM pg_database WHERE datname = $1",
        ["heart"]
      );
      if (res.rowCount === 0) {
        console.log("[init-heart] Criando database 'heart'...");
        await client.query('CREATE DATABASE "heart"');
      }
    } finally {
      await client.end().catch(() => {});
    }

    let heartUrl = process.env.DATABASE_URL_HEART;
    if (!heartUrl) {
      const parsed = new URL(baseUrl);
      parsed.pathname = "/heart";
      heartUrl = parsed.toString();
    }

    console.log("[init-heart] Sincronizando schema do banco mestre (heart.schema.prisma)...");
    execSync(
      `npx prisma db push --config=prisma.heart.config.ts --url="${heartUrl}" --accept-data-loss`,
      {
        stdio: "inherit",
        env: {
          ...process.env,
          DATABASE_URL_HEART: heartUrl,
        },
      }
    );
    console.log("[init-heart] Banco mestre 'heart' pronto!");
  } catch (err) {
    console.error("[init-heart] Aviso ao inicializar banco heart:", err.message);
  }
}

initHeart();
