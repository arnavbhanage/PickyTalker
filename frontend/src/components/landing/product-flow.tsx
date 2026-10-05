const steps = [
  {
    number: "01",
    title: "Learn your style",
    description: "PickyTalker studies how you naturally write.",
  },
  {
    number: "02",
    title: "Generate possibilities",
    description: "AI models create relevant reply options.",
  },
  {
    number: "03",
    title: "Choose what sounds like you",
    description: "PickyTalker ranks replies by your communication style.",
  },
];

export function ProductFlow() {
  return (
    <section className="flow-section section-wrap" id="product" aria-labelledby="flow-title">
      <div className="section-heading">
        <span className="section-kicker">How it works</span>
        <h2 id="flow-title">A little more you in every reply.</h2>
        <p>Three simple steps, with your communication style at the center.</p>
      </div>
      <div className="flow-grid">
        {steps.map((step) => (
          <article className="flow-card" key={step.number}>
            <span className="flow-number">{step.number}</span>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
