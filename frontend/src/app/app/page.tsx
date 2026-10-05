import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/landing/placeholder-page";

export const metadata: Metadata = { title: "PickyTalker app" };

export default function AppPage() {
  return (
    <PlaceholderPage
      title="The PickyTalker app is coming later"
      description="The product experience is being built in a later milestone. No account or conversation data is collected here."
    />
  );
}
