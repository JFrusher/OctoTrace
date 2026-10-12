import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "./generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Reuse one client across Next.js hot reloads in dev.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./dev.db" }) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
