import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageShell } from "@/components/shared/public-page-shell";
import { SITE_LINKS } from "@/lib/links";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <PublicPageShell
      eyebrow="Account access"
      title="Sign in is coming later"
      introduction="PickyTalker does not have active user accounts yet. Authentication will be introduced only when account-backed features are ready."
    >
      <section className="signin-panel">
        <h2>No account required today</h2>
        <p>
          The current product preview does not store conversations or connect activity to an
          identity. Google and Apple sign-in are intentionally not enabled in this milestone.
        </p>
        <Link className="button button-dark" href={SITE_LINKS.app}>
          View the workspace preview
        </Link>
      </section>
    </PublicPageShell>
  );
}
