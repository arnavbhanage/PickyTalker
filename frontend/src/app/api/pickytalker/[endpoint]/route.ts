import { auth } from "@/auth";
import { createBurstGuard, forwardBackend } from "@/server/backend-proxy";

export const runtime = "nodejs";
export const maxDuration = 300;
const allowBurst = createBurstGuard();

async function handle(request: Request, context: { params: Promise<{ endpoint: string }> }) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ detail: "Sign in to continue." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const { endpoint } = await context.params;
  if (request.method === "POST" && !allowBurst(session.user.email)) {
    return Response.json({ detail: "Too many requests. Please wait a minute and try again." }, {
      status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" },
    });
  }
  return forwardBackend(request, endpoint, {
    backendUrl: process.env.PICKYTALKER_BACKEND_URL,
    apiKey: process.env.PICKYTALKER_API_KEY,
    production: process.env.NODE_ENV === "production",
  });
}

export { handle as GET, handle as POST };
