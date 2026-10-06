import type { ReactNode } from "react";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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
        <div className="public-page-decoration public-page-decoration-one" aria-hidden="true" />
        <div className="public-page-decoration public-page-decoration-two" aria-hidden="true" />
        <header className="public-page-hero section-wrap">
          <Badge className="public-page-badge" variant="outline">
            {eyebrow}
          </Badge>
          <h1>{title}</h1>
          <p>{introduction}</p>
        </header>
        <Separator className="public-page-rule section-wrap" />
        <div className="public-page-content section-wrap">{children}</div>
      </main>
      <Footer />
    </>
  );
}
