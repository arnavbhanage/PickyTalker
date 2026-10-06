import type { Metadata } from "next";
import { PublicPageShell } from "@/components/shared/public-page-shell";
import { CONTACT_EMAIL } from "@/lib/links";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <PublicPageShell
      eyebrow="Last updated October 6, 2026"
      title="Privacy Policy"
      introduction="This policy describes how the current PickyTalker student and demonstration project handles information. It reflects the system as it exists today and has not been reviewed by a lawyer."
    >
      <section>
        <h2>1. Information you provide</h2>
        <p>Depending on the feature you use, you may provide:</p>
        <ul>
          <li>past writing samples used to estimate your communication style;</li>
          <li>incoming messages that you want help answering;</li>
          <li>prompts and response-generation requests; and</li>
          <li>candidate replies submitted for personalized ranking.</li>
        </ul>
        <p>
          Avoid submitting sensitive personal information or content you do not have permission
          to process.
        </p>
      </section>

      <section>
        <h2>2. How the current system uses information</h2>
        <p>
          The FastAPI backend processes submitted text in memory to create a style profile, rank
          candidates, or prepare a generation request. It limits the working history to the most
          recent 100 messages. PickyTalker does not intentionally persist conversations, writing
          histories, incoming messages, or generated replies.
        </p>
        <p>
          Account authentication is stored separately in a PostgreSQL database. That storage is
          limited to account details, linked Google provider records, and one-way password hashes
          for email accounts. Login state is carried in an encrypted session cookie. Conversation
          and style-profile persistence are not implemented. Account self-service deletion is also
          not available yet; contact the project owner with a deletion request.
        </p>
      </section>

      <section>
        <h2>3. Operational logging</h2>
        <p>
          The backend logs request identifiers, endpoint paths, response status codes, and request
          latency for reliability and debugging. It is designed not to log raw writing history,
          incoming-message text, candidate text, generated replies, API keys, or provider response
          bodies. New frontend code does not log submitted text.
        </p>
      </section>

      <section>
        <h2>4. External AI provider</h2>
        <p>
          When you request AI generation, relevant writing history, the incoming message, and
          generation instructions may be transmitted to the external AI provider configured by
          the operator. That provider processes the request under its own terms and privacy
          practices. PickyTalker does not make claims about the provider&apos;s retention periods or
          other practices; check the configured provider&apos;s current policy before using generation
          with personal or confidential material.
        </p>
        <p>
          Style profiling and ranking are performed by the PickyTalker backend. The browser does
          not contact the external AI provider directly.
        </p>
      </section>

      <section>
        <h2>5. Accounts, cookies, and analytics</h2>
        <p>
          PickyTalker uses Auth.js with Google OAuth or an email-and-password account. Google
          provides basic profile information such as your name, email address, and profile image.
          For email accounts, PickyTalker stores a one-way password hash rather than the password
          itself. Auth.js uses an encrypted, essential session cookie to keep you signed in.
          PickyTalker does not add analytics, advertising trackers, or non-essential cookies, so it
          does not display a cookie-consent banner for the current feature set.
        </p>
      </section>

      <section>
        <h2>6. Data security and choices</h2>
        <p>
          Reasonable technical measures are used to limit exposure, including backend-only
          provider credentials and privacy-safe application logging. No system is completely
          secure, so submit only information you are comfortable processing through the service.
          You can choose not to use AI generation or not to provide writing samples.
        </p>
      </section>

      <section>
        <h2>7. Future changes</h2>
        <p>
          Privacy practices may change if later versions introduce conversation persistence,
          analytics, additional sign-in methods, or additional AI providers. Before those features
          are launched, this policy and relevant user controls should be updated to explain what is
          collected, why it is used, how long it is kept, and how it can be deleted or changed.
        </p>
      </section>

      <section>
        <h2>8. Contact</h2>
        <p>
          Privacy questions can be sent to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </PublicPageShell>
  );
}
