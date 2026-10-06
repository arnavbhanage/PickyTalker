import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { AccountForm } from "@/components/auth/account-form";
export const metadata: Metadata = { title: "Create an account" };
export default async function SignUpPage() {
  if ((await auth())?.user) redirect("/app");
  return <AuthPageShell title="Make yourself at home." description="Create your account. Find your voice."><AccountForm kind="signup" /></AuthPageShell>;
}
