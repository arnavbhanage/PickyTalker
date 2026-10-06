import type { Metadata } from "next";
import { EmptyState } from "@/components/app/status-panels";
import { SectionCard } from "@/components/app/section-card";

export const metadata: Metadata = { title: "PickyTalker app" };

export default function AppPage() {
  return (
    <div className="app-container">
      <header className="app-intro">
        <span className="section-kicker">Prepared for the next milestone</span>
        <h1>Your personalized response workspace</h1>
        <p>
          The product structure is ready. Writing inputs and live AI responses will be
          connected in the next milestone; this preview does not collect or send data.
        </p>
      </header>

      <div className="app-workflow" aria-label="Planned response workflow">
        <SectionCard
          eyebrow="Step 1"
          title="Writing history and style profile"
          description="A dedicated area for writing samples and the resulting measurable style profile."
        >
          <p className="app-card-note">Profile analysis controls are not active yet.</p>
        </SectionCard>
        <SectionCard
          eyebrow="Step 2"
          title="Incoming message"
          description="The future composer will accept the message you want to answer before generation begins."
        >
          <p className="app-card-note">Response generation is not active yet.</p>
        </SectionCard>
        <SectionCard
          eyebrow="Step 3"
          title="Ranked responses and explanation"
          description="The selected reply, alternatives, style scores, and plain-language reasons will appear here."
          className="app-results-card"
        >
          <EmptyState
            title="No response session yet"
            message="Once the chatbot flow is implemented, personalized results will appear in this space."
          />
        </SectionCard>
      </div>

      <aside className="app-privacy-note" aria-label="Current data behavior">
        <strong>Current preview:</strong> no account, conversation history, or writing samples
        are stored by this page.
      </aside>
    </div>
  );
}
