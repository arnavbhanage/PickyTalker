import type { Metadata } from "next";
import { ArrowRight, Check, Database, MessageSquareText, ShieldCheck, Sparkles } from "lucide-react";
import { auth } from "@/auth";
import { EmptyState } from "@/components/app/status-panels";
import { SectionCard } from "@/components/app/section-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "PickyTalker app" };

export default async function AppPage() {
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0];

  return (
    <div className="app-container">
      <div className="app-orb app-orb-one" aria-hidden="true" />
      <div className="app-orb app-orb-two" aria-hidden="true" />
      <header className="app-intro">
        <Badge className="app-live-badge" variant="outline">
          <span aria-hidden="true" /> Private workspace
        </Badge>
        <h1>{firstName ? `Welcome, ${firstName}.` : "Your voice, ready when you are."}</h1>
        <p>
          Build a style profile, bring in a message, and compare responses that feel naturally
          yours. You always make the final call.
        </p>
      </header>

      <div className="app-trust-grid" aria-label="Workspace highlights">
        <Card className="app-trust-card">
          <CardContent><ShieldCheck aria-hidden="true" /><div><strong>Private by design</strong><span>No conversations stored yet</span></div></CardContent>
        </Card>
        <Card className="app-trust-card">
          <CardContent><Database aria-hidden="true" /><div><strong>Secure account</strong><span>PostgreSQL-backed profiles</span></div></CardContent>
        </Card>
        <Card className="app-trust-card">
          <CardContent><Sparkles aria-hidden="true" /><div><strong>Your final choice</strong><span>AI suggests, you decide</span></div></CardContent>
        </Card>
      </div>

      <div className="app-workflow" aria-label="Planned response workflow">
        <SectionCard
          eyebrow="01 · Learn your voice"
          title="Create your style profile"
          description="Add a few examples of how you naturally write so PickyTalker can understand your rhythm."
        >
          <div className="app-card-preview">
            <span><Check aria-hidden="true" /> Tone and warmth</span>
            <span><Check aria-hidden="true" /> Length and rhythm</span>
            <span><Check aria-hidden="true" /> Punctuation habits</span>
          </div>
        </SectionCard>
        <SectionCard
          eyebrow="02 · Add context"
          title="Bring the message"
          description="Paste the message you want to answer. It stays in the active request, not your account history."
        >
          <div className="app-message-placeholder" aria-hidden="true">
            <MessageSquareText />
            <span>Incoming message</span>
            <ArrowRight />
          </div>
        </SectionCard>
        <SectionCard
          eyebrow="03 · Stay in control"
          title="Compare personalized replies"
          description="Review ranked options and the plain-language reasons behind each match."
          className="app-results-card"
        >
          <EmptyState
            title="Your best-fit reply will appear here"
            message="The generation flow is the next product milestone. This polished workspace is ready for it."
          />
        </SectionCard>
      </div>

      <aside className="app-privacy-note" aria-label="Current data behavior">
        <ShieldCheck aria-hidden="true" />
        <span><strong>Privacy first:</strong> account profiles use secure database storage and encrypted
        session cookies. Conversation history and writing samples are not persisted by this preview.</span>
      </aside>
    </div>
  );
}
