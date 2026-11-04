import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { SpaceKey } from "@/lib/spaces";

/**
 * «Avvisami quando è pronto» of the «In arrivo» pages (#29, database #216):
 * read, register and remove my interest in a space. Same shape as
 * `pinned-spaces.ts`; works with the server and the browser client. A plain
 * module, without "use client". Errors are returned, never swallowed. Only the
 * space key travels: the member and the Nest are decided by the database.
 * An unavailable space is refused with `FN002` (`isSpaceUnavailableError`).
 */
type Client = SupabaseClient<Database>;

type DbError = { code?: string | null; message?: string | null };

export type SpaceInterestsResult =
  { error: null; spaces: SpaceKey[] } | { error: DbError; spaces: null };

/** The spaces I asked to be told about (the policy returns only my rows). */
export async function getSpaceInterests(
  supabase: Client,
): Promise<SpaceInterestsResult> {
  const { data, error } = await supabase
    .from("space_interests")
    .select("space");
  if (error) return { error, spaces: null };
  return { error: null, spaces: data.map((row) => row.space) };
}

/** Registers my interest. Registering twice leaves one row, without error. */
export async function addSpaceInterest(
  supabase: Client,
  space: SpaceKey,
): Promise<{ error: DbError | null }> {
  const { error } = await supabase.rpc("add_space_interest", {
    p_space: space,
  });
  return { error };
}

/** Removes my interest. Removing one that is not there is fine. */
export async function removeSpaceInterest(
  supabase: Client,
  space: SpaceKey,
): Promise<{ error: DbError | null }> {
  const { error } = await supabase.rpc("remove_space_interest", {
    p_space: space,
  });
  return { error };
}
