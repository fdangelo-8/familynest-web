import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv, getSecretKey } from "@/lib/env";
import type { Database } from "@/types/database";

// Privileged client that bypasses RLS. Server-side use only.
export function createAdminClient() {
  const { supabaseUrl } = getPublicEnv();
  return createClient<Database>(supabaseUrl, getSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
