import type { Metadata } from "next";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { currentWritingOwner, writingProfileStore } from "@/server/writing-profile-store";
import type { WritingProfile } from "@/lib/writing-profile";

export const metadata: Metadata = { title: "PickyTalker app" };

export default async function AppPage() {
  let profile: WritingProfile | undefined;
  let unavailable = false;
  try {
    const owner = await currentWritingOwner();
    if (owner) profile = await writingProfileStore.read(owner);
  } catch {
    // A missing migration must not crash auth or the existing chat flow.
    unavailable = true;
  }
  return <ChatWorkspace initialWritingProfile={profile} writingProfileUnavailable={unavailable} />;
}
