"use client";

import Link from "next/link";
import { useState } from "react";
import { SITE_LINKS, SOCIAL_LINKS } from "@/lib/links";
import { MagneticButton } from "./magnetic-button";

function LinkedInIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.2 3.6a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4ZM3.4 9.5H7v11.1H3.4V9.5Zm5.8 0h3.4V11h.1c.5-.9 1.7-1.9 3.5-1.9 3.7 0 4.4 2.4 4.4 5.5v6h-3.6v-5.3c0-1.3 0-3-1.9-3s-2.2 1.4-2.2 2.9v5.4H9.2V9.5Z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .9a11.1 11.1 0 0 0-3.5 21.6c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.4-4-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.8.1-.8.1-.8 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.4-5.5-6.1 0-1.4.5-2.5 1.2-3.4-.1-.3-.5-1.6.1-3.3 0 0 1-.3 3.4 1.3a11.8 11.8 0 0 1 6.2 0c2.4-1.6 3.4-1.3 3.4-1.3.7 1.7.3 3 .1 3.3.8.9 1.2 2 1.2 3.4 0 4.7-2.8 5.8-5.5 6.1.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A11.1 11.1 0 0 0 12 .9Z" />
    </svg>
  );
}

function SocialControls() {
  return (
    <div className="social-controls" role="group" aria-label="Social links">
      <MagneticButton label="PickyTalker on LinkedIn" href={SOCIAL_LINKS.linkedin}>
        <LinkedInIcon />
      </MagneticButton>
      <MagneticButton label="PickyTalker on GitHub" href={SOCIAL_LINKS.github}>
        <GitHubIcon />
      </MagneticButton>
    </div>
  );
}

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="site-header">
      <nav className="nav-shell" aria-label="Main navigation">
        <Link className="wordmark" href="/" aria-label="PickyTalker home" onClick={closeMenu}>
          <span>PickyTalker</span>
        </Link>

        <div className="desktop-nav-links">
          <Link href={SITE_LINKS.product}>Product</Link>
          <Link href={SITE_LINKS.contact}>Contact</Link>
        </div>

        <div className="desktop-nav-actions">
          <SocialControls />
          <Link className="button button-dark button-small" href={SITE_LINKS.signIn}>
            Get started
          </Link>
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
        <Link className="button button-dark" href={SITE_LINKS.signIn} onClick={closeMenu}>
          Get started
        </Link>
      </div>
    </header>
  );
}
