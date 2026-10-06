import Link from "next/link";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { AuthControls } from "@/components/auth/auth-controls";
import { SITE_LINKS } from "@/lib/site-links";

export async function AppShell({ children }: { children: ReactNode }) {
  const session = await auth();

  return (
    <div className="app-shell">
      <a className="skip-link" href="#app-content">
        Skip to workspace
      </a>
      <header className="app-header">
        <div className="app-header-inner">
          <Link className="wordmark" href={SITE_LINKS.home} aria-label="PickyTalker home">
            <span className="wordmark-mark" aria-hidden="true">P</span>
            PickyTalker
          </Link>
          <span className="app-preview-badge">Workspace preview</span>
          <nav className="app-header-actions" aria-label="Application navigation">
            <Link href={SITE_LINKS.home}>Home</Link>
            <AuthControls user={session?.user ?? null} compact />
          </nav>
        </div>
      </header>
      <main className="app-main" id="app-content">
        {children}
      </main>
    </div>
  );
}
