import { createWritingProfileHandlers } from "@/server/writing-profile-handlers";
import { currentWritingOwner, writingProfileStore } from "@/server/writing-profile-store";

export const runtime = "nodejs";
const handlers = createWritingProfileHandlers(currentWritingOwner, writingProfileStore);
export const GET = handlers.GET;
export const PUT = handlers.PUT;
