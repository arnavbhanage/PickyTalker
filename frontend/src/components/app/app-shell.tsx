import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_LINKS } from "@/lib/links";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#app-content">
        Skip to workspace
      </a>
      <header className="app-header">
        <div className="app-header-inner">
          <Link className="wordmark" href={SITE_LINKS.home} aria-label="PickyTalker home">
            PickyTalker
          </Link>
          <span className="app-preview-badge">Workspace preview</span>
          <nav className="app-header-actions" aria-label="Application navigation">
            <Link href={SITE_LINKS.home}>Home</Link>
            <Link className="button button-dark button-small" href={SITE_LINKS.signIn}>
              Sign in
            </Link>
          </nav>
        </div>
      </header>
      <main className="app-main" id="app-content">
        {children}
      </main>
    </div>
  );
}
