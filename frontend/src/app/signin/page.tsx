import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { auth } from "@/auth";
import { EmailAuthForms } from "@/components/auth/email-auth-forms";
import { PublicPageShell } from "@/components/shared/public-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SITE_LINKS } from "@/lib/site-links";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  const session = await auth();

  return (
    <PublicPageShell
      eyebrow="Account access"
      title="Sign in to PickyTalker"
      introduction="Continue with Google, or create an account using your email and password."
    >
      <section className="signin-panel">
        <Card className="signin-card">
          <CardHeader>
            <Badge className="signin-secure-badge" variant="secondary">
              <LockKeyhole aria-hidden="true" /> Secure account access
            </Badge>
          </CardHeader>
          <CardContent>
          {session?.user ? (
            <div className="signin-card-copy">
            <h2>You&apos;re already signed in</h2>
            <p>Continue to the workspace using your current account.</p>
            <Button asChild className="signin-primary-action" size="lg">
              <Link href={SITE_LINKS.app}>
                Continue to workspace <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            </div>
        ) : (
            <div className="signin-card-copy">
              <h2 className="signin-title">Welcome back—or join us</h2>
              <p>
                Choose Google for one-click access, or use your email to create a PickyTalker
                account.
              </p>
              <EmailAuthForms />
            </div>
          )}
          </CardContent>
        </Card>
      </section>
    </PublicPageShell>
  );
}
