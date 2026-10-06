import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { VerificationForm } from "@/components/auth/verification-form";
import { readChallenge, readResetGrant } from "@/lib/auth/challenge-cookie";
export const metadata: Metadata = { title: "Reset your password" };
export default async function VerifyResetPage() {
  const challenge = await readChallenge("reset");
  if (!challenge) redirect("/forgot-password");
  const resetVerified = !!(challenge.usedAt && challenge.grantExpiresAt && challenge.grantExpiresAt > new Date() && await readResetGrant());
  return <AuthPageShell title="Let’s get you back in." description="Verify your email, then choose a new password."><VerificationForm purpose="reset" email={challenge.email} initialResendAt={challenge.resendAt.getTime()} resetVerified={resetVerified} /></AuthPageShell>;
}
