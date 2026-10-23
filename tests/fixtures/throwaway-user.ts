import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BrowserContext } from "@playwright/test";

// Throwaway user for the tests that create data (press "Continua", etc.).
// Created with the administrative key, marked with
// app_metadata.familynest_test_user = true (LEZIONI) and deleted at the end of
// the test: deleting the account also deletes its Nest. Keys come only from
// environment variables.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

/** True when the administrative key and the Supabase variables are set. */
export function throwawayConfigured(): boolean {
  return !!supabaseUrl && !!publishableKey && !!secretKey;
}

export const throwawaySkipReason =
  "Chiavi Supabase (URL, chiave pubblica, chiave amministrativa) non impostate";

export type ThrowawayUser = {
  id: string;
  email: string;
  /** Client signed in as this user: reads go through RLS. */
  client: SupabaseClient;
  /** Administrative client (bypasses RLS): only to count rows. */
  admin: SupabaseClient;
  /** Puts this user's session in the browser context. */
  signInContext: (context: BrowserContext, baseURL: string) => Promise<void>;
  /** Number of Nests of the user, read with the administrative key. */
  nestCount: () => Promise<number>;
  /** Deletes the account (and its Nest). Safe to call twice. */
  remove: () => Promise<void>;
};

async function sessionCookies(email: string, password: string) {
  const jar = new Map<string, string>();
  const client = createServerClient(supabaseUrl!, publishableKey!, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll(cookies) {
        for (const { name, value } of cookies) {
          if (value) jar.set(name, value);
          else jar.delete(name);
        }
      },
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Accesso usa e getta fallito");
  await client.auth.getSession();
  return [...jar].map(([name, value]) => ({ name, value }));
}

/**
 * Creates a throwaway user with the given full name (`null` = no name in the
 * account, so `profiles.display_name` stays empty).
 */
export async function createThrowawayUser(
  fullName: string | null,
): Promise<ThrowawayUser> {
  if (!throwawayConfigured()) throw new Error(throwawaySkipReason);
  const admin = createClient(supabaseUrl!, secretKey!, {
    auth: { persistSession: false },
  });
  const email = `onboarding-${randomUUID()}@example.test`;
  const password = randomUUID();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: fullName === null ? {} : { full_name: fullName },
    app_metadata: { familynest_test_user: true },
  });
  if (error || !data.user)
    throw new Error(`Utente usa e getta non creato: ${error?.message}`);
  const id = data.user.id;
  let removed = false;

  const client = createClient(supabaseUrl!, publishableKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) {
    await admin.auth.admin.deleteUser(id);
    throw new Error("Accesso usa e getta fallito");
  }

  return {
    id,
    email,
    client,
    admin,
    async signInContext(context, baseURL) {
      const cookies = await sessionCookies(email, password);
      await context.addCookies(
        cookies.map(({ name, value }) => ({ name, value, url: baseURL })),
      );
    },
    async nestCount() {
      const { count, error: countError } = await admin
        .from("household_members")
        .select("id", { count: "exact", head: true })
        .eq("user_id", id);
      if (countError) throw new Error("Lettura dei membri fallita");
      return count ?? 0;
    },
    async remove() {
      if (removed) return;
      removed = true;
      await admin.auth.admin.deleteUser(id);
    },
  };
}
