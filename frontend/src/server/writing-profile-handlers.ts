import { validateWritingSamples, type WritingProfile } from "@/lib/writing-profile";

export type WritingProfileStore = {
  read: (owner: string) => Promise<WritingProfile>;
  write: (owner: string, samples: string[], revision: string | null) => Promise<WritingProfile | null>;
};

const reply = (payload: unknown, status = 200) => Response.json(payload, { status, headers: { "Cache-Control": "no-store" } });

export function createWritingProfileHandlers(authenticate: () => Promise<string | null>, store: WritingProfileStore) {
  return {
    async GET() {
      try {
        const owner = await authenticate();
        if (!owner) return reply({ error: "Sign in to manage your writing samples." }, 401);
        return reply(await store.read(owner));
      } catch { return reply({ error: "Your writing samples couldn’t be loaded. Please try again." }, 503); }
    },
    async PUT(request: Request) {
      try {
        const owner = await authenticate();
        if (!owner) return reply({ error: "Sign in to manage your writing samples." }, 401);
        if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Request origin is not allowed." }, 403);
        if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return reply({ error: "JSON is required." }, 415);
        if (Number(request.headers.get("content-length")) > 200_000) return reply({ error: "Samples are too large." }, 413);
        const reader = request.body?.getReader();
        if (!reader) return reply({ error: "Invalid samples." }, 422);
        const chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 200_000) { await reader.cancel(); return reply({ error: "Samples are too large." }, 413); }
          chunks.push(chunk.value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        let body: Record<string, unknown>;
        try { body = JSON.parse(new TextDecoder().decode(bytes)); }
        catch { return reply({ error: "Invalid samples." }, 422); }
        if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => !["samples", "revision"].includes(key))) return reply({ error: "Invalid samples." }, 422);
        const error = validateWritingSamples(body.samples);
        if (error) return reply({ error }, 422);
        if (body.revision !== null && (typeof body.revision !== "string" || Number.isNaN(Date.parse(body.revision)))) return reply({ error: "Reload your samples before saving." }, 422);
        const result = await store.write(owner, body.samples as string[], body.revision as string | null);
        if (!result) return reply({ error: "Your samples changed in another tab. Close and reopen this editor to reload them." }, 409);
        return reply(result);
      } catch { return reply({ error: "Your samples weren’t saved. Your draft is still here; please try again." }, 503); }
    },
  };
}
