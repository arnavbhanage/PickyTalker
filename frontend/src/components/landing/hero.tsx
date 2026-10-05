import Link from "next/link";
import { BackgroundBeamsWithCollision } from "@/components/ui/background-beams-with-collision";

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <BackgroundBeamsWithCollision />
      <div className="hero-copy section-wrap">
        <p className="eyebrow">
          PERSONALIZED AI COMMUNICATION
        </p>
        <h1 id="hero-title">
          <span>AI responses that</span>
          <span className="hero-highlight">sound like you.</span>
        </h1>
        <p className="hero-description">
          PickyTalker learns the way you communicate and helps choose replies
          that better match your natural writing style.
        </p>
        <div className="hero-actions">
          <Link className="button button-dark" href="/signin">
            Get started <span aria-hidden="true">↗</span>
          </Link>
          <a className="button button-light" href="#product">
            See how it works <span aria-hidden="true">↓</span>
          </a>
        </div>
        <p className="hero-note">Your words, your voice, your choice.</p>
      </div>
    </section>
  );
}
