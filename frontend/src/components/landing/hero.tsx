import Link from "next/link";
import { BackgroundBeamsWithCollision } from "@/components/ui/background-beams-with-collision";
import { CanvasText } from "@/components/ui/canvas-text";

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <BackgroundBeamsWithCollision className="pointer-events-none absolute inset-0 z-0 h-full w-full bg-background opacity-80 motion-reduce:hidden">
        {null}
      </BackgroundBeamsWithCollision>
      <div className="hero-copy section-wrap relative z-10">
        <p className="eyebrow">
          PERSONALIZED AI COMMUNICATION
        </p>
        <h1 id="hero-title">
          <span>AI responses that</span>
          <CanvasText
            text="sound like you."
            className="hero-highlight"
            backgroundClassName="bg-background"
            colors={["#7086b8", "#98a9cf", "#526995"]}
            animationDuration={6}
            lineWidth={2}
            lineGap={5}
            curveIntensity={18}
          />
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
