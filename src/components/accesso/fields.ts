import type { AuthError } from "@supabase/supabase-js";
import { checkPassword } from "@/lib/auth/password";

// Texts and checks shared by the mail and password screens (#327). Texts are
// the ones of the graphic specification, word for word.

const MAX_EMAIL_LENGTH = 254;

export const EMAIL_INVALID =
  "Controlla la mail: dovrebbe essere come nome@esempio.it.";

export const PASSWORD_TEXT = {
  short: "La password è troppo corta: servono almeno 8 caratteri.",
  long: "La password è troppo lunga: al massimo 72 caratteri.",
  weak: "Questa password è troppo facile da indovinare: scegline una più lunga.",
} as const;

/** Trimmed address in, error text out (null = valid). */
export function validateEmail(value: string, emptyText: string): string | null {
  if (!value) return emptyText;
  if (value.length > MAX_EMAIL_LENGTH) return EMAIL_INVALID;
  if (/\s/.test(value)) return EMAIL_INVALID;
  const parts = value.split("@");
  if (parts.length !== 2) return EMAIL_INVALID;
  const [local, domain] = parts as [string, string];
  if (local.length < 1) return EMAIL_INVALID;
  if (domain.indexOf(".") < 1 || domain.endsWith(".")) return EMAIL_INVALID;
  return null;
}

/** New password, exactly as typed (never trimmed): error text, or null. */
export function validateNewPassword(
  value: string,
  emptyText: string,
): string | null {
  switch (checkPassword(value)) {
    case "empty":
      return emptyText;
    case "short":
      return PASSWORD_TEXT.short;
    case "long":
      return PASSWORD_TEXT.long;
    case "ok":
      return null;
  }
}

/** Supabase says "too many requests": 429, or one of its rate-limit codes. */
export function isRateLimit(error: AuthError): boolean {
  return (
    error.status === 429 ||
    error.code === "over_email_send_rate_limit" ||
    error.code === "over_request_rate_limit"
  );
}

/** The address a link goes back to (#326): always `<origin>/auth/confirm`. */
export function confirmUrl(): string {
  return `${window.location.origin}/auth/confirm`;
}

/** Plural of the wait text: «tra 1 secondo», «tra 42 secondi». */
export function seconds(count: number): string {
  return `${count} ${count === 1 ? "secondo" : "secondi"}`;
}
