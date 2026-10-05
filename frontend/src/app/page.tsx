import { FinalCta } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { LlmEcosystem } from "@/components/landing/llm-ecosystem";
import { Navbar } from "@/components/landing/navbar";
import { ProductFlow } from "@/components/landing/product-flow";
import { ProductPreview } from "@/components/landing/product-preview";

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Navbar />
      <main id="main-content">
        <Hero />
        <LlmEcosystem />
        <ProductFlow />
        <ProductPreview />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
