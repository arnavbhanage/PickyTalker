import Link from "next/link";
import { CONTACT_EMAIL, SITE_LINKS, SOCIAL_LINKS } from "@/lib/links";
import { MagneticButton } from "./magnetic-button";

function FooterSocial({ kind }: { kind: "linkedin" | "github" }) {
  const href = SOCIAL_LINKS[kind];
  const label = kind === "linkedin" ? "LinkedIn" : "GitHub";
  return (
    <MagneticButton label={`PickyTalker on ${label}`} href={href}>
      <span className="footer-social-text">{label}</span>
    </MagneticButton>
  );
}

export function Footer() {
  return (
    <footer className="site-footer" id="contact">
      <div className="footer-main section-wrap">
        <div className="footer-brand">
          <Link className="wordmark" href="/" aria-label="PickyTalker home">
            <span>PickyTalker</span>
          </Link>
          <p>AI responses that sound more like you.</p>
        </div>
        <div className="footer-links">
          <div>
            <span className="footer-heading">Product</span>
            <Link href={SITE_LINKS.product}>How it works</Link>
          </div>
          <div>
            <span className="footer-heading">Information</span>
            <Link href={SITE_LINKS.privacy}>Privacy</Link>
            <Link href={SITE_LINKS.terms}>Terms</Link>
          </div>
          <div>
            <span className="footer-heading">Connect</span>
            {CONTACT_EMAIL ? (
              <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
            ) : (
              <span className="footer-placeholder" title="Add contact details in src/lib/links.ts">
                Contact details coming soon
              </span>
            )}
            <FooterSocial kind="github" />
            <FooterSocial kind="linkedin" />
          </div>
        </div>
      </div>
      <div className="footer-bottom section-wrap">
        <span>© {new Date().getFullYear()} PickyTalker</span>
        <span>Thoughtful replies, in your own voice.</span>
      </div>
    </footer>
  );
}
