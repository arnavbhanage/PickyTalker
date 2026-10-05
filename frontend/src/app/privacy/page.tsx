import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/landing/placeholder-page";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <PlaceholderPage
      title="Privacy"
      description="Privacy information has not been published yet. This placeholder is not a privacy policy."
    />
  );
}
