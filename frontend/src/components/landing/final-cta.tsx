import Link from "next/link";

export function FinalCta() {
  return (
    <section className="final-cta section-wrap" aria-labelledby="final-cta-title">
      <div className="final-cta-content">
        <span className="section-kicker">A voice of your own</span>
        <h2 id="final-cta-title">Your AI should not sound like everyone else&apos;s.</h2>
        <Link className="button button-cream" href="/signin">
          Get started <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  );
}
