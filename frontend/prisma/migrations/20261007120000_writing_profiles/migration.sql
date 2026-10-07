-- Additive migration: no existing users, auth records, or passwords are changed.
CREATE TABLE "writing_profiles" (
    "user_id" TEXT NOT NULL,
    "samples" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "writing_profiles_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "writing_profiles_user_id_fkey" FOREIGN KEY ("user_id")
      REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Auth.js identities are not Supabase Auth JWTs. Access only through the
-- authenticated Next.js server; never expose this table to the browser Data API.
ALTER TABLE "writing_profiles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "writing_profiles" FROM anon, authenticated;
