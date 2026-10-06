export function normalizeEmail(value: string) { return value.trim().toLowerCase(); }

export function validateEmail(email: string) {
  return email.length <= 254 && email.split("@")[0].length <= 64 && /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,63}$/.test(email)
    ? undefined : "Enter a valid email address.";
}

export function validatePassword(password: string, confirmation: string) {
  if (!password || !confirmation) return "Enter and confirm your password.";
  if (password !== confirmation) return "Passwords do not match.";
  if (password.length < 8) return "Use at least 8 characters for your password.";
  // bcrypt operates on UTF-8 bytes, not character count.
  if (new TextEncoder().encode(password).length > 72) return "Use a password of 72 UTF-8 bytes or fewer.";
}

export function validateSignup(fields: { firstName: string; lastName: string; email: string; password: string; confirmPassword: string }) {
  if (!fields.firstName.trim() || !fields.lastName.trim()) return "Enter your first and last name.";
  if (fields.firstName.length > 40 || fields.lastName.length > 40) return "Each name must be 40 characters or fewer.";
  return validateEmail(fields.email) ?? validatePassword(fields.password, fields.confirmPassword);
}

export function isVerifiedGoogle(profile: { email_verified?: unknown } | undefined) {
  return profile?.email_verified === true;
}
