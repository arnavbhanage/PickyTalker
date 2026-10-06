import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import assert from "node:assert/strict";

config({ path: ".env.local", quiet: true });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
async function main() {
  try {
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"pickytalker-auth:read-only-schema-check"}))`;
      const user = await tx.user.findFirst({ select: { sessionVersion: true } });
      assert.ok(!user || typeof user.sessionVersion === "number");
      await tx.emailVerificationCode.findUnique({ where: { email_purpose: { email: "schema-check@example.test", purpose: "verify" } } });
    });
    console.log("Database: new columns, OTP composite lookup and advisory transaction lock passed (no writes)");
  } finally { await prisma.$disconnect(); }
}
void main();
