import { createClient } from "@/lib/supabase/client";

/*
 * The calls of the page of the wish list that run in the browser with the
 * session of the user (#32). The Nest is decided by the database from the
 * session: only ids and values are sent, in the body (`rpc` posts). Errors are
 * read only for their code and status, never shown or logged.
 */

export type Failure = "network" | "server";
export type WriteResult = { ok: true } | { ok: false; reason: Failure };

const failureOf = (status: number): Failure =>
  status === 0 ? "network" : "server";

export type ShareResult =
  { ok: true; code: string } | { ok: false; reason: Failure };

/** «Condividi»: the active link of the list, or a new one. */
export async function shareWishlist(childId: string): Promise<ShareResult> {
  try {
    const { data, error, status } = await createClient().rpc("share_wishlist", {
      p_member_id: childId,
    });
    if (error) return { ok: false, reason: failureOf(status) };
    const code = Array.isArray(data) ? data[0]?.code : undefined;
    if (typeof code !== "string") return { ok: false, reason: "server" };
    return { ok: true, code };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/** «Disattiva il link»: it never works again. */
export async function disableWishlistLink(
  childId: string,
): Promise<WriteResult> {
  try {
    const { error, status } = await createClient().rpc(
      "disable_wishlist_share_link",
      { p_member_id: childId },
    );
    return error ? { ok: false, reason: failureOf(status) } : { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/** «Salva le modifiche»: title and note (empty = no note). */
export async function updateWishlistIdea(
  itemId: string,
  title: string,
  note: string,
): Promise<WriteResult> {
  try {
    const { error, status } = await createClient().rpc("update_wishlist_item", {
      p_item_id: itemId,
      p_title: title,
      ...(note !== "" ? { p_note: note } : {}),
    });
    return error ? { ok: false, reason: failureOf(status) } : { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/** «Elimina l'idea»: with its photo, its booking and its notification. */
export async function deleteWishlistIdea(itemId: string): Promise<WriteResult> {
  try {
    const { error, status } = await createClient().rpc("delete_wishlist_item", {
      p_item_id: itemId,
    });
    return error ? { ok: false, reason: failureOf(status) } : { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}
