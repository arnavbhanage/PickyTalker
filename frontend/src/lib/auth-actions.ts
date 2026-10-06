"use server";

import { hash } from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";

export type AuthFormState = {
  error?: string;
};

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  };
}

function validateCredentials(email: string, password: string) {
  if (!/^\S+@\S+\.\S+$/.test(email)) return "Enter a valid email address.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (Buffer.byteLength(password, "utf8") > 72) return "Password is too long.";
  return null;
}

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/app" });
}

export async function signInWithEmail(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { email, password } = readCredentials(formData);
  const validationError = validateCredentials(email, password);
  if (validationError) return { error: validationError };

  try {
    await signIn("credentials", { email, password, redirectTo: "/app" });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email or password is incorrect." };
    }
    throw error;
  }
}

export async function signUpWithEmail(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const { email, password } = readCredentials(formData);
  const validationError = validateCredentials(email, password);

  if (name.length < 2) return { error: "Enter your name." };
  if (name.length > 80) return { error: "Name must be 80 characters or fewer." };
  if (validationError) return { error: validationError };
  if (password !== confirmPassword) return { error: "Passwords do not match." };

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return {
      error: existingUser.passwordHash
        ? "An account with this email already exists. Sign in instead."
        : "This email uses Google sign-in. Continue with Google instead.",
    };
  }

  const passwordHash = await hash(password, 12);

  try {
    await prisma.user.create({
      data: { name, email, passwordHash },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return { error: "An account with this email already exists." };
    }
    return { error: "We could not create your account. Please try again." };
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/app" });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created. Sign in with your email and password." };
    }
    throw error;
  }
}

export async function signOutCurrentUser() {
  await signOut({ redirectTo: "/" });
}
