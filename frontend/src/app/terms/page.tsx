import type { Metadata } from "next";
import { PublicPageShell } from "@/components/shared/public-page-shell";
import { CONTACT_EMAIL } from "@/lib/links";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <PublicPageShell
      eyebrow="Last updated October 6, 2026"
      title="Terms of Service"
      introduction="These terms explain the ground rules for using PickyTalker, a student and demonstration AI project. They are written in plain English and have not been reviewed by a lawyer."
    >
      <section>
        <h2>1. About PickyTalker</h2>
        <p>
          PickyTalker analyzes writing samples to estimate communication-style tendencies,
          generates possible replies through a configured third-party AI provider, and ranks
          those replies by how closely they match the estimated style. The service is an
          experimental project, not a professional communication service.
        </p>
      </section>

      <section>
        <h2>2. AI-generated output</h2>
        <p>
          AI output can be incomplete, inaccurate, inappropriate, or misleading. PickyTalker
          does not guarantee that a response is correct, safe, suitable, or a perfect match for
          your voice. Review and edit every response before you use or send it. You are
          responsible for the messages you choose to send and any consequences of using them.
        </p>
        <p>
          Do not rely on PickyTalker for medical, legal, financial, emergency, safety-critical,
          or other high-stakes decisions. Consult a qualified professional when appropriate.
        </p>
      </section>

      <section>
        <h2>3. Acceptable use</h2>
        <p>Use PickyTalker lawfully and with respect for other people. You must not use it to:</p>
        <ul>
          <li>harass, threaten, defraud, exploit, or impersonate another person;</li>
          <li>create or distribute illegal, harmful, or deceptive material;</li>
          <li>violate privacy, confidentiality, intellectual-property, or other rights;</li>
          <li>probe, disrupt, overload, bypass, or interfere with the service or its security; or</li>
          <li>submit content you do not have permission to use.</li>
        </ul>
      </section>

      <section>
        <h2>4. Your content</h2>
        <p>
          You keep ownership of your original writing and other content you provide. You give
          PickyTalker permission to process that content only as needed to provide the requested
          features. You are responsible for having the rights and permissions needed to submit it.
        </p>
      </section>

      <section>
        <h2>5. Project materials</h2>
        <p>
          PickyTalker&apos;s software, interface, project name, documentation, and original project
          materials remain the property of their respective owners and are protected where
          applicable. These terms do not transfer ownership of the project or of third-party
          materials to you.
        </p>
      </section>

      <section>
        <h2>6. Third-party AI services</h2>
        <p>
          Response generation depends on a configured external AI provider. Your generation
          request may be sent to that provider and is also subject to its terms and practices.
          PickyTalker does not control the provider&apos;s models, availability, output, or policies.
        </p>
      </section>

      <section>
        <h2>7. Availability and changes</h2>
        <p>
          The service may be slow, unavailable, changed, suspended, or discontinued at any time.
          Features may change as the project develops, and external generation can time out. No
          particular level of availability or continued access is promised.
        </p>
      </section>

      <section>
        <h2>8. Limitation of liability</h2>
        <p>
          To the fullest extent allowed by applicable law, PickyTalker is provided “as is” and
          without warranties. The project&apos;s creators are not liable for indirect, incidental,
          special, consequential, or similar losses arising from use of, inability to use, or
          reliance on the service or its output. Some laws may not allow every limitation in this
          section, so those limitations apply only where permitted.
        </p>
      </section>

      <section>
        <h2>9. Changes to these terms</h2>
        <p>
          These terms may be updated as the project changes. The date at the top will be revised
          when material updates are published. Continuing to use the service after an update means
          you accept the revised terms.
        </p>
      </section>

      <section>
        <h2>10. Contact</h2>
        <p>
          Questions about these terms can be sent to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </PublicPageShell>
  );
}
