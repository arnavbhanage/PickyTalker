"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthControls, type AuthUserSummary } from "@/components/auth/auth-controls";
import { SITE_LINKS } from "@/lib/site-links";
import { SocialControls } from "./social-controls";

export function NavbarClient({ user }: { user: AuthUserSummary | null }) {
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="site-header">
      <nav className="nav-shell" aria-label="Main navigation">
        <Link className="wordmark" href="/" aria-label="PickyTalker home" onClick={closeMenu}>
          <span className="wordmark-mark" aria-hidden="true">P</span>
          <span>PickyTalker</span>
        </Link>

        <div className="desktop-nav-links">
          <Link href={SITE_LINKS.product}>Product</Link>
          <Link href={SITE_LINKS.contact}>Contact</Link>
        </div>

        <div className="desktop-nav-actions">
          <SocialControls />
          <AuthControls user={user} signedOutLabel="Get started" compact />
        </div>

        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
        </button>
      </nav>

      <div className="mobile-menu" id="mobile-navigation" hidden={!menuOpen}>
        <Link href={SITE_LINKS.product} onClick={closeMenu}>
          Product
        </Link>
        <Link href={SITE_LINKS.contact} onClick={closeMenu}>
          Contact
        </Link>
        <div className="mobile-menu-socials">
          <SocialControls />
        </div>
        <AuthControls user={user} signedOutLabel="Get started" />
      </div>
    </header>
  );
}
