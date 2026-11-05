// Environment variables are read lazily so that importing this module
// (e.g. during `next build`) never fails when variables are missing.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

// NEXT_PUBLIC_* variables must be referenced statically so Next.js can inline them.
export function getPublicEnv() {
  return {
    supabaseUrl: required(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    supabasePublishableKey: required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}

// Server-only: never call this from client code.
export function getSecretKey(): string {
  return required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);
}

// Server-only (wish list, #32): the ONE origin of a test shop that the link
// reader may open even if it is local (e.g. `http://127.0.0.1:4010`). Used by
// the tests only; always ignored when the app runs on Vercel.
export function getShopLinkTestOrigin(): string | null {
  if (process.env.VERCEL) return null;
  const raw = process.env.SHOP_LINK_TEST_ORIGIN;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Linked calendars (#272, for #34, #35, #37). Server-only: none of these names
// starts with NEXT_PUBLIC_, so Next.js never sends them to the browser. Only
// the NAMES are in the repository (and in `.env.example`); the values live in
// the environment of the server.
// ---------------------------------------------------------------------------

// Secret of the synchronisation service: the scheduled job of the database
// (pg_cron + pg_net) sends it as a bearer token (the same value is kept in the
// Vault of Supabase as `calendar_sync_secret`). At least 32 characters.
export function getCalendarSyncSecret(): string | null {
  const value = process.env.CALENDAR_SYNC_SECRET;
  return value && value.length >= 32 ? value : null;
}

// Key that encrypts the credentials of the external accounts: 32 random bytes
// in base64. It never enters the database. `CALENDAR_ENCRYPTION_KEY_VERSION`
// (1-999, default 1) is the version written in front of every new ciphertext
// («v<version>:...»); after a rotation the key of an older version stays
// available for reading in `CALENDAR_ENCRYPTION_KEY_V<version>`.
export function getCalendarEncryptionKey(version?: number): {
  version: number;
  key: Buffer;
} {
  const rawCurrent = process.env.CALENDAR_ENCRYPTION_KEY_VERSION;
  const current = rawCurrent ? Number(rawCurrent) : 1;
  if (!Number.isInteger(current) || current < 1 || current > 999) {
    throw new Error(
      "Invalid environment variable CALENDAR_ENCRYPTION_KEY_VERSION.",
    );
  }
  const wanted = version ?? current;
  const name =
    wanted === current
      ? "CALENDAR_ENCRYPTION_KEY"
      : `CALENDAR_ENCRYPTION_KEY_V${wanted}`;
  const raw = required(name, process.env[name]);
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(`Environment variable ${name} must be 32 bytes in base64.`);
  }
  return { version: wanted, key };
}

// The fake calendar provider (#34 §11) for development and tests: it needs the
// variable, and it never exists in production, whatever the variable says.
export function isFakeCalendarProviderEnabled(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  return process.env.CALENDAR_FAKE_PROVIDER === "1";
}

type OAuthClient = { clientId: string; clientSecret: string };

function oauthClient(idName: string, secretName: string): OAuthClient | null {
  const clientId = process.env[idName];
  const clientSecret = process.env[secretName];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

// OAuth client of the calendar permissions at Google (a client of its own,
// separate from the one of the sign-in). Null until it is configured.
export function getGoogleCalendarClient(): OAuthClient | null {
  return oauthClient(
    "GOOGLE_CALENDAR_CLIENT_ID",
    "GOOGLE_CALENDAR_CLIENT_SECRET",
  );
}

// OAuth client for Outlook (#35). Null until it is configured.
export function getMicrosoftCalendarClient(): OAuthClient | null {
  return oauthClient(
    "MICROSOFT_CALENDAR_CLIENT_ID",
    "MICROSOFT_CALENDAR_CLIENT_SECRET",
  );
}
