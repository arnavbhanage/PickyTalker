import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { VerificationForm } from "@/components/auth/verification-form";
import { readChallenge } from "@/lib/auth/challenge-cookie";
export const metadata: Metadata = { title: "Verify your email" };
export default async function VerifyEmailPage() {
  const challenge = await readChallenge("verify");
  if (!challenge) redirect("/signin");
  return <AuthPageShell title="Check your inbox." description="One small step to keep your account yours."><VerificationForm purpose="verify" email={challenge.email} initialResendAt={challenge.resendAt.getTime()} /></AuthPageShell>;
}
