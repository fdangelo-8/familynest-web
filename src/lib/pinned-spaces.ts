import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { SpaceKey } from "@/lib/spaces";

/**
 * The only place where pages read and change the spaces pinned by the member
 * (issue #188, for Esplora #28, «In arrivo» #29 and Oggi #30). Works with the
 * server and the browser client alike. Errors are returned, never swallowed:
 * the page decides what to say (see `isPinLimitError` in `spaces.ts`).
 */
type Client = SupabaseClient<Database>;

type DbError = { code?: string | null; message?: string | null };

export type PinnedSpacesResult =
  { error: null; spaces: SpaceKey[] } | { error: DbError; spaces: null };

/**
 * My pinned spaces, from the oldest pinned to the newest. The policy of the
 * table already returns only the rows of the caller. Includes spaces that are
 * not available any more: filter them with `isSpaceAvailable`.
 */
export async function getPinnedSpaces(
  supabase: Client,
): Promise<PinnedSpacesResult> {
  const { data, error } = await supabase
    .from("pinned_spaces")
    .select("space")
    .order("pinned_at", { ascending: true });
  if (error) return { error, spaces: null };
  return { error: null, spaces: data.map((row) => row.space) };
}

/** Pins a space at the end of mine. Pinning twice leaves one row. */
export async function pinSpace(
  supabase: Client,
  space: SpaceKey,
): Promise<{ error: DbError | null }> {
  const { error } = await supabase.rpc("pin_space", { p_space: space });
  return { error };
}

/** Removes a space from mine. Removing a space that is not pinned is fine. */
export async function unpinSpace(
  supabase: Client,
  space: SpaceKey,
): Promise<{ error: DbError | null }> {
  const { error } = await supabase.rpc("unpin_space", { p_space: space });
  return { error };
}
