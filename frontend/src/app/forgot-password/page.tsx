import type { Metadata } from "next";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { AccountForm } from "@/components/auth/account-form";
export const metadata: Metadata = { title: "Forgot password" };
export default function ForgotPasswordPage() {
  return <AuthPageShell title="A fresh start." description="Enter your email and we’ll help you reset your password."><AccountForm kind="forgot" /></AuthPageShell>;
}
