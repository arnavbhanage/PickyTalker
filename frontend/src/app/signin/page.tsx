import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AccountForm } from "@/components/auth/account-form";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

export const metadata: Metadata = { title: "Sign in" };
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; reset?: string }> }) {
  if ((await auth())?.user) redirect("/app");
  const params = await searchParams;
  const notice = params.reset === "success" ? "Password updated. Sign in with your new password."
    : params.error === "OAuthAccountNotLinked" ? "This email already has an account. Sign in using your original method. Google accounts are not automatically merged."
    : params.error ? "We couldn’t complete Google sign-in. Please try again." : undefined;
  return <AuthPageShell title="Good to see you again." description="Sign in to your PickyTalker account."><AccountForm kind="signin" notice={notice} /></AuthPageShell>;
}
