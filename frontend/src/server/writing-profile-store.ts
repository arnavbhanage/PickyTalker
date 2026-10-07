import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { WritingProfileStore } from "./writing-profile-handlers";

export async function currentWritingOwner() {
  const session = await auth();
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true, emailVerified: true } });
  return user?.emailVerified ? user.id : null;
}

export const writingProfileStore: WritingProfileStore = {
  async read(owner) {
    const profile = await prisma.writingProfile.findUnique({ where: { userId: owner }, select: { samples: true, updatedAt: true } });
    return { samples: profile?.samples ?? [], revision: profile?.updatedAt.toISOString() ?? null };
  },
  async write(owner, samples, revision) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const updatedAt = new Date(Math.max(Date.now(), revision ? Date.parse(revision) + 1 : 0));
        if (revision === null) {
          await transaction.writingProfile.create({ data: { userId: owner, samples, updatedAt } });
        } else {
          const result = await transaction.writingProfile.updateMany({
            where: { userId: owner, updatedAt: new Date(revision) }, data: { samples, updatedAt },
          });
          if (result.count !== 1) return null;
        }
        return { samples, revision: updatedAt.toISOString() };
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") return null;
      throw error;
    }
  },
};
