import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";

export function AuthPageShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <Navbar />
    <main id="main-content" className="auth-page">
      <div className="auth-layout">
        <aside className="auth-story">
          <Link href="/" className="auth-back"><ArrowLeft size={15} aria-hidden="true" /> Back to PickyTalker</Link>
          <span className="auth-eyebrow"><Sparkles size={15} aria-hidden="true" /> A little more you.</span>
          <h2>Your words.<br />Your way.</h2>
          <p>A thoughtful space to find your voice and make every conversation feel more natural.</p>
          <div className="auth-story-note"><span><Check size={16} aria-hidden="true" /></span> Thoughtful by design. Personal by default.</div>
          <div className="auth-orbit" aria-hidden="true"><span /><span /><span /></div>
        </aside>
        <Card className="auth-card">
          <CardContent className="auth-card-content">
            <div className="auth-heading"><span className="auth-wordmark">PickyTalker<span>.</span></span><h1>{title}</h1><p>{description}</p></div>
            {children}
          </CardContent>
        </Card>
      </div>
    </main>
    <Footer />
  </>;
}
