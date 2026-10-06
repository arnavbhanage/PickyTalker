import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Purpose } from "./otp";

const name = (purpose: Purpose) => `pt-${purpose}-challenge`;
const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 30 * 60 };
export async function setChallenge(purpose: Purpose, id: string) { (await cookies()).set(name(purpose), id, options); }
export async function readChallenge(purpose: Purpose) {
  const id = (await cookies()).get(name(purpose))?.value;
  if (!id || !/^[a-f0-9]{64}$/.test(id)) return null;
  return prisma.emailVerificationCode.findFirst({ where: { id, purpose } });
}
export async function clearChallenge(purpose: Purpose) { (await cookies()).delete(name(purpose)); }
export async function setResetGrant(grant: string) { (await cookies()).set("pt-reset-grant", grant, { ...options, maxAge: 300 }); }
export async function readResetGrant() { return (await cookies()).get("pt-reset-grant")?.value ?? ""; }
export async function clearResetGrant() { (await cookies()).delete("pt-reset-grant"); }
