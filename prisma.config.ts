import { defineConfig } from "prisma/config";

try {
  process.loadEnvFile();
} catch {
  // .env is optional; DATABASE_URL falls back to the local SQLite file.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: process.env.DATABASE_URL ?? "file:./dev.db" },
});
