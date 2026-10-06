import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: ".env.local" });

// Supabase's direct/session endpoint is required by Prisma Migrate. The pooled
// DATABASE_URL remains the connection used by the running application.
const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
