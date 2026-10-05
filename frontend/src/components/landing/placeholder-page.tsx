import Link from "next/link";

type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <main className="placeholder-page">
      <Link className="wordmark" href="/">
        <span className="wordmark-mark" aria-hidden="true">
          p
        </span>
        <span>PickyTalker</span>
      </Link>
      <div className="placeholder-card">
        <span className="section-kicker">Coming in a later milestone</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <Link className="button button-dark" href="/">
          Back to home
        </Link>
      </div>
    </main>
  );
}
