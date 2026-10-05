import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/landing/placeholder-page";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <PlaceholderPage
      title="Sign in"
      description="Account access is not part of this landing-page milestone."
    />
  );
}
