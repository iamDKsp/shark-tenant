import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/heart.schema.prisma",
  datasource: {
    url:
      process.env["DATABASE_URL_HEART"] ||
      process.env["DATABASE_URL"] ||
      "postgresql://postgres:postgres@localhost:5432/heart",
  },
});
