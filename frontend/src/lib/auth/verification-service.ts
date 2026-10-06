import { checkCode, generateSecret, makeChallenge, matchesSecret, secretHash, MAX_ATTEMPTS, type Challenge, type Purpose } from "./otp-core";

export type AuthUser = { id: string; email: string | null; passwordHash: string | null; emailVerified: Date | null };
export interface VerificationStore {
  get(email: string, purpose: Purpose): Promise<Challenge | null>;
  save(record: Challenge): Promise<void>;
  user(email: string): Promise<AuthUser | null>;
  verifyUser(id: string, at: Date): Promise<void>;
  resetPassword(id: string, hash: string): Promise<void>;
}
type Dependencies = {
  transaction: <T>(email: string, work: (store: VerificationStore) => Promise<T>) => Promise<T>;
  send: (email: string, code: string, expiresAt: Date, purpose: Purpose, challengeId: string) => Promise<void>;
  key: string;
  now?: () => Date;
};

export function createVerificationService({ transaction, send, key, now = () => new Date() }: Dependencies) {
  return {
    async issue(email: string, purpose: Purpose) {
      return transaction(email, async store => {
        const previous = await store.get(email, purpose);
        const at = now();
        if (previous && previous.resendAt > at) return { error: "Please wait before requesting another code.", resendAt: previous.resendAt.getTime() };
        const user = await store.user(email);
        const eligible = !!user && (purpose === "verify" ? !!user.passwordHash && !user.emailVerified : !!user.passwordHash);
        const { code, record } = makeChallenge(email, purpose, at, key, previous);
        await store.save(record);
        if (eligible) await send(email, code, record.expiresAt, purpose, record.id);
        return { record };
      });
    },
    async verify(email: string, purpose: Purpose, id: string, code: string) {
      return transaction(email, async store => {
        const record = await store.get(email, purpose);
        const at = now();
        if (!record || record.id !== id) return { error: "This code has been replaced. Request a new code." };
        const error = checkCode(record, code, at, key);
        if (error) {
          if (!record.usedAt && record.expiresAt > at && record.attempts < MAX_ATTEMPTS) await store.save({ ...record, attempts: record.attempts + 1 });
          return { error };
        }
        const user = await store.user(email);
        if (!user?.passwordHash) return { error: "This code is no longer active. Request a new code." };
        const grant = generateSecret();
        await store.save({ ...record, usedAt: at, grantHash: secretHash(grant, record.id + ":grant", key), grantExpiresAt: new Date(at.getTime() + 5 * 60_000) });
        if (purpose === "verify") await store.verifyUser(user.id, at);
        return { grant };
      });
    },
    async consumeGrant(email: string, purpose: Purpose, id: string, grant: string, newPasswordHash?: string) {
      return transaction(email, async store => {
        const record = await store.get(email, purpose);
        if (!record || record.id !== id || !record.usedAt || !record.grantHash || !record.grantExpiresAt || record.grantExpiresAt <= now() || !matchesSecret(grant, record.grantHash, id + ":grant", key)) return null;
        const user = await store.user(email);
        if (!user || (purpose === "reset" && !newPasswordHash)) return null;
        await store.save({ ...record, grantHash: null, grantExpiresAt: null });
        if (purpose === "reset") await store.resetPassword(user.id, newPasswordHash!);
        return user;
      });
    },
  };
}
