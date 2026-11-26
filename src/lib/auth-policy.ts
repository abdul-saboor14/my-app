export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export const emailRegex = /^[^\s@\p{C}]+@[^\s@\p{C}]+\.[^\s@\p{C}]+$/u;
export const usernameRegex = /^[a-z][a-z0-9_]{2,29}$/;

export const passwordHelp = "Use 12–128 characters with an uppercase letter, a lowercase letter, a number, and a special character.";

export function validatePassword(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 12 && value.length <= 128
    && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value)
    && /[\p{P}\p{S}]/u.test(value) && !/\p{C}/u.test(value);
}
