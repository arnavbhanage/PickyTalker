ALTER TABLE "users" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "email_verification_codes" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resend_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "grant_hash" TEXT,
  "grant_expires_at" TIMESTAMP(3),
  CONSTRAINT "email_verification_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_verification_codes_purpose_check" CHECK ("purpose" IN ('verify', 'reset'))
);
CREATE UNIQUE INDEX "email_verification_codes_email_purpose_key" ON "email_verification_codes"("email", "purpose");
CREATE INDEX "email_verification_codes_expires_at_idx" ON "email_verification_codes"("expires_at");
