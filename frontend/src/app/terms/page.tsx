import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/landing/placeholder-page";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <PlaceholderPage
      title="Terms"
      description="Terms have not been published yet. This placeholder is not legal advice or a statement of current terms."
    />
  );
}
