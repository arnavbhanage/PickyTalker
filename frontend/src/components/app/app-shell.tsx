import Link from "next/link";
import type { ReactNode } from "react";
import type { AuthUserSummary } from "@/components/auth/auth-controls";
import { signOutCurrentUser } from "@/lib/auth-actions";
import { AccountControl } from "./account-control";
import { SocialControls } from "@/components/landing/social-controls";
import { SITE_LINKS } from "@/lib/site-links";
import styles from "./app-shell.module.css";

export function AppShell({ children, user }: { children: ReactNode; user: AuthUserSummary }) {
  return (
    <div className={`app-shell ${styles.shell}`}>
      <a className="skip-link" href="#app-content">
        Skip to workspace
      </a>
      <header className="app-header">
        <div className="app-header-inner">
          <Link className="wordmark" href={SITE_LINKS.home} aria-label="PickyTalker home">
            <span className="wordmark-mark" aria-hidden="true">P</span>
            PickyTalker
          </Link>
          <nav className="app-header-actions" aria-label="Application navigation">
            <Link href={SITE_LINKS.home}>Home</Link>
            <SocialControls />
            <AccountControl user={user} signOutAction={signOutCurrentUser} />
          </nav>
        </div>
      </header>
      <main className={`app-main ${styles.main}`} id="app-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
