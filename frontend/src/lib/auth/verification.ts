import "server-only";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email/send-verification-email";
import { createVerificationService } from "./verification-service";

export const verification = createVerificationService({
  key: process.env.AUTH_SECRET ?? "",
  send: sendVerificationEmail,
  transaction: (email, work) => prisma.$transaction(async tx => {
    // Serialize issuance, attempts and grant consumption across server processes.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"pickytalker-auth:" + email}))`;
    return work({
      get: (address, purpose) => tx.emailVerificationCode.findUnique({ where: { email_purpose: { email: address, purpose } } }),
      save: async record => { await tx.emailVerificationCode.upsert({ where: { email_purpose: { email: record.email, purpose: record.purpose } }, create: record, update: record }); },
      user: address => tx.user.findUnique({ where: { email: address } }),
      verifyUser: async (id, at) => { await tx.user.update({ where: { id }, data: { emailVerified: at } }); },
      resetPassword: async (id, passwordHash) => {
        await tx.user.update({ where: { id }, data: { passwordHash, emailVerified: new Date(), sessionVersion: { increment: 1 } } });
        await tx.emailVerificationCode.updateMany({ where: { email, purpose: "verify" }, data: { usedAt: new Date(), grantHash: null, grantExpiresAt: null } });
      },
    });
  }, { timeout: 20_000, maxWait: 20_000 }),
});
