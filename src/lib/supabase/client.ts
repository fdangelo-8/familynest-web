import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export function createClient() {
  const { supabaseUrl, supabasePublishableKey } = getPublicEnv();
  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
}
