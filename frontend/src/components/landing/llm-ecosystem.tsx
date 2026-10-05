import Image from "next/image";

const models = [
  { name: "ChatGPT", provider: "OpenAI", icon: "/models/openai.svg" },
  { name: "Claude", provider: "Anthropic", icon: "/models/anthropic.svg" },
  { name: "Meta", provider: "Meta", icon: "/models/meta.svg" },
  { name: "DeepSeek", provider: "DeepSeek", icon: "/models/deepseek.svg" },
];

export function LlmEcosystem() {
  return (
    <section className="ecosystem-section section-wrap" aria-labelledby="ecosystem-title">
      <div className="section-heading ecosystem-heading">
        <span className="section-kicker">A more personal kind of AI</span>
        <h2 id="ecosystem-title">Many possible replies. One that feels like you.</h2>
        <p>
          AI can suggest different ways to respond. PickyTalker is about finding
          the one that fits how you communicate.
        </p>
      </div>

      <div className="ecosystem-panel">
        <div className="ecosystem-models">
          <span className="ecosystem-label">A changing model landscape</span>
          <ul className="model-grid">
            {models.map((model) => (
              <li className="model-card" key={model.name}>
                <span className="model-icon">
                  <Image src={model.icon} alt="" width={27} height={27} />
                </span>
                <span>
                  <span className="model-name">{model.name}</span>
                  <span className="model-provider">{model.provider}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="ecosystem-transition" aria-hidden="true">
          <span>possibilities</span>
          <span className="ecosystem-arrow">→</span>
        </div>

        <div className="personalizer-card">
          <span className="personalizer-kicker">A personal touch</span>
          <span className="personalizer-name">PickyTalker</span>
          <p>Find the reply that sounds more like you.</p>
          <div className="personalizer-traits">
            <span>Your tone</span>
            <span>Your phrasing</span>
          </div>
        </div>
      </div>

      <p className="ecosystem-note">
        Conceptual model examples only — not active integrations or endorsements.
      </p>
    </section>
  );
}
