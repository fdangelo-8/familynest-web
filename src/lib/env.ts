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
