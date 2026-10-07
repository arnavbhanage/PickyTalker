export const MAX_WRITING_SAMPLES = 100;
export const MAX_SAMPLE_CHARACTERS = 2000;
export const MAX_TOTAL_SAMPLE_CHARACTERS = 40_000;
export const MIN_STYLE_SAMPLES = 3;

export type WritingProfile = { samples: string[]; revision: string | null };

export function validateWritingSamples(value: unknown): string | null {
  if (!Array.isArray(value) || value.length > MAX_WRITING_SAMPLES) return "Use up to 100 messages you wrote yourself.";
  if (value.some((sample) => typeof sample !== "string" || !sample.trim())) return "Each sample must contain a message you wrote.";
  const counts = (value as string[]).map((sample) => Array.from(sample).length);
  if (counts.some((count) => count > MAX_SAMPLE_CHARACTERS)) return "Keep each sample to 2,000 characters or fewer.";
  if (counts.reduce((total, count) => total + count, 0) > MAX_TOTAL_SAMPLE_CHARACTERS) return "Keep all samples together to 40,000 characters or fewer.";
  if (new Set((value as string[]).map((sample) => sample.trim())).size !== value.length) return "Remove duplicate samples; repeated messages don’t add style evidence.";
  return null;
}

export function isWritingProfile(value: unknown): value is WritingProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<WritingProfile>;
  return validateWritingSamples(profile.samples) === null && (profile.revision === null || (typeof profile.revision === "string" && !Number.isNaN(Date.parse(profile.revision))));
}
