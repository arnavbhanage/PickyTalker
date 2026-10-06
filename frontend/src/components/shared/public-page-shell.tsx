import type { ReactNode } from "react";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";

type PublicPageShellProps = {
  eyebrow: string;
  title: string;
  introduction: string;
  children: ReactNode;
};

export function PublicPageShell({
  eyebrow,
  title,
  introduction,
  children,
}: PublicPageShellProps) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Navbar />
      <main className="public-page" id="main-content">
        <header className="public-page-hero section-wrap">
          <span className="section-kicker">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{introduction}</p>
        </header>
        <div className="public-page-content section-wrap">{children}</div>
      </main>
      <Footer />
    </>
  );
}
