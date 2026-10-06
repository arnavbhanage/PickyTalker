"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { normalizeEmail, validateEmail, validatePassword, validateSignup } from "@/lib/auth/validation";
import { verification } from "@/lib/auth/verification";
import { clearChallenge, clearResetGrant, readChallenge, readResetGrant, setChallenge, setResetGrant } from "@/lib/auth/challenge-cookie";
import { requireEmailConfiguration } from "@/lib/email/send-verification-email";
import { EmailDeliveryError } from "@/lib/email/email-errors";
import type { Purpose } from "@/lib/auth/otp";

export type AuthFormState = { error?: string; message?: string; resendAt?: number; success?: boolean };
const text = (data: FormData, key: string) => String(data.get(key) ?? "");
function deliveryError(error: unknown): AuthFormState {
  return { error: error instanceof EmailDeliveryError ? error.message : "We could not complete this request. Please try again." };
}
export async function signInWithGoogle() { await signIn("google", { redirectTo: "/app" }); }

export async function signInWithEmail(_: AuthFormState, data: FormData): Promise<AuthFormState> {
  const email = normalizeEmail(text(data, "email"));
  const password = text(data, "password");
  if (validateEmail(email) || !password) return { error: "Email or password is incorrect." };
  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.passwordHash && !user.emailVerified && await verifyPassword(password, user.passwordHash)) {
    try {
      requireEmailConfiguration();
      const result = await verification.issue(email, "verify");
      if (result.record) await setChallenge("verify", result.record.id);
      else {
        const active = await prisma.emailVerificationCode.findUnique({ where: { email_purpose: { email, purpose: "verify" } } });
        if (active) await setChallenge("verify", active.id);
      }
    } catch (error) { return deliveryError(error); }
    redirect("/verify-email");
  }
  try {
    await signIn("credentials", { email, password, redirectTo: "/app" });
    return {};
  } catch (error) {
    if (error instanceof AuthError) return { error: "Email or password is incorrect." };
    throw error;
  }
}

export async function signUpWithEmail(_: AuthFormState, data: FormData): Promise<AuthFormState> {
  const fields = { firstName: text(data, "firstName").trim(), lastName: text(data, "lastName").trim(),
    email: normalizeEmail(text(data, "email")), password: text(data, "password"), confirmPassword: text(data, "confirmPassword") };
  const error = validateSignup(fields);
  if (error) return { error };
  try {
    requireEmailConfiguration();
    const existing = await prisma.user.findUnique({ where: { email: fields.email } });
    if (existing) return { error: "An account already exists. Sign in to continue or verify your email." };
    await prisma.user.create({ data: { name: fields.firstName + " " + fields.lastName, email: fields.email, passwordHash: await hashPassword(fields.password) } });
    const result = await verification.issue(fields.email, "verify");
    if (!result.record) return { error: result.error, resendAt: result.resendAt };
    await setChallenge("verify", result.record.id);
  } catch (error) { return deliveryError(error); }
  redirect("/verify-email");
}

export async function requestPasswordReset(_: AuthFormState, data: FormData): Promise<AuthFormState> {
  const email = normalizeEmail(text(data, "email"));
  const error = validateEmail(email);
  if (error) return { error };
  try {
    requireEmailConfiguration();
    const result = await verification.issue(email, "reset");
    if (!result.record) return { error: result.error, resendAt: result.resendAt };
    await clearResetGrant();
    await setChallenge("reset", result.record.id);
  } catch (error) { return deliveryError(error); }
  redirect("/forgot-password/verify");
}

async function resend(purpose: Purpose): Promise<AuthFormState> {
  const challenge = await readChallenge(purpose);
  if (!challenge) return { error: "Start again to request a new code." };
  try {
    requireEmailConfiguration();
    const result = await verification.issue(challenge.email, purpose);
    if (!result.record) return { error: result.error, resendAt: result.resendAt };
    await setChallenge(purpose, result.record.id);
    if (purpose === "reset") await clearResetGrant();
    return { message: "If this account is eligible, a new code has been sent. Check your inbox and spam folder.", resendAt: result.record.resendAt.getTime() };
  } catch (error) { return deliveryError(error); }
}
export async function resendVerificationCode() { return resend("verify"); }
export async function resendResetCode() { return resend("reset"); }

export async function verifyEmailCode(_: AuthFormState, data: FormData): Promise<AuthFormState> {
  const challenge = await readChallenge("verify");
  if (!challenge) return { error: "Your verification session ended. Sign in to request a new code." };
  const result = await verification.verify(challenge.email, "verify", challenge.id, text(data, "code"));
  if (!result.grant) return { error: result.error };
  try {
    await signIn("credentials", { email: challenge.email, challengeId: challenge.id, verificationGrant: result.grant, redirectTo: "/app", redirect: false });
    await clearChallenge("verify");
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) return { error: "Email verified. You can now sign in with your password." };
    throw error;
  }
}
export async function verifyResetCode(_: AuthFormState, data: FormData): Promise<AuthFormState> {
  const challenge = await readChallenge("reset");
  if (!challenge) return { error: "Start again to request a new reset code." };
  const result = await verification.verify(challenge.email, "reset", challenge.id, text(data, "code"));
  if (!result.grant) return { error: result.error };
  await setResetGrant(result.grant);
  return { success: true, message: "Code verified. Choose your new password." };
}
export async function resetPassword(_: AuthFormState, data: FormData): Promise<AuthFormState> {
  const password = text(data, "password");
  const error = validatePassword(password, text(data, "confirmPassword"));
  if (error) return { error };
  const challenge = await readChallenge("reset");
  const grant = await readResetGrant();
  if (!challenge || !grant) return { error: "Verify a reset code before changing your password." };
  const user = await verification.consumeGrant(challenge.email, "reset", challenge.id, grant, await hashPassword(password));
  if (!user) return { error: "Your reset session expired. Request a new code." };
  await clearChallenge("reset");
  await clearResetGrant();
  redirect("/signin?reset=success");
}
export async function signOutCurrentUser() { await signOut({ redirectTo: "/" }); }
