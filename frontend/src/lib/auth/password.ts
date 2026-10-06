import { compare, hash } from "bcryptjs";

// Versioned format allows a future algorithm change, without reversible encryption.
const PREFIX = "bcrypt-v1:";
export async function hashPassword(password: string) {
  return PREFIX + await hash(password, 12);
}
export async function verifyPassword(password: string, stored: string) {
  if (new TextEncoder().encode(password).length > 72) return false;
  const encoded = stored.startsWith(PREFIX) ? stored.slice(PREFIX.length) : stored;
  if (!/^\$2[aby]\$/.test(encoded)) return false;
  return compare(password, encoded);
}
