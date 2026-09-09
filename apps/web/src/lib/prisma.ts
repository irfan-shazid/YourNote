import { PrismaClient } from "@prisma/client";

/**
 * Prisma is used for two things only: owning the schema and migrations, and
 * backing Better Auth's adapter. All product data is read and written by the
 * Go API. Next.js hot-reloads modules in development, so the client is cached
 * on globalThis to avoid exhausting Neon's connection limit.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
