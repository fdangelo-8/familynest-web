// Password rules (#327). Supabase checks the same limits: 8 is its minimum
// (`minimum_password_length`), 72 is the limit of bcrypt. The password is
// never trimmed or changed in any way.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export type PasswordCheck = "empty" | "short" | "long" | "ok";

/** Length check only, on the text exactly as typed. */
export function checkPassword(value: string): PasswordCheck {
  if (value.length === 0) return "empty";
  if (value.length < PASSWORD_MIN_LENGTH) return "short";
  if (value.length > PASSWORD_MAX_LENGTH) return "long";
  return "ok";
}

/** True when the length is inside the allowed range (the visible rule). */
export function isPasswordLengthValid(value: string): boolean {
  return checkPassword(value) === "ok";
}
