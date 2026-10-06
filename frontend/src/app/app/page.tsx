import type { Metadata } from "next";
import { ChatWorkspace } from "@/components/chat/chat-workspace";

export const metadata: Metadata = { title: "PickyTalker app" };

export default function AppPage() {
  return <ChatWorkspace />;
}
