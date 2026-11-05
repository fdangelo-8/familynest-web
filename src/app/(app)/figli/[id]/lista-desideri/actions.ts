"use server";

import {
  IDEA_MAX,
  LINK_MAX,
  NOTE_MAX,
  isShopAddress,
  normalizeText,
} from "@/components/lista-desideri/model";
import { readShopLink } from "@/lib/shop-link";
import { createClient } from "@/lib/supabase/server";

/**
 * «Aggiungi alla lista» (#32 §5). The link is read here, on the server, only
 * for a signed-in adult of a Nest: the idea is then written by the database
 * with the session of the user (the Nest is decided by the database, never by
 * the browser), and the administrative client is never used. Titles, notes,
 * links and prices travel only in the body of this call: nothing is logged and
 * no error carries them.
 */

export type AddIdeaResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "empty"
        | "invalid-link"
        | "unreadable"
        | "limit"
        | "network"
        | "server";
    };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (value: unknown, max: number): string =>
  typeof value === "string"
    ? Array.from(normalizeText(value)).slice(0, max).join("")
    : "";

export async function addWishlistIdea(input: {
  childId: string;
  link: string;
  idea: string;
  note: string;
}): Promise<AddIdeaResult> {
  if (typeof input?.childId !== "string" || !UUID.test(input.childId)) {
    return { ok: false, reason: "server" };
  }
  const link = text(input.link, LINK_MAX);
  const idea = text(input.idea, IDEA_MAX);
  const note = text(input.note, NOTE_MAX);

  // The same rules as in the browser, again (§5, rules 1 and 2).
  if (link === "" && idea === "") return { ok: false, reason: "empty" };
  if (link !== "" && !isShopAddress(link)) {
    return { ok: false, reason: "invalid-link" };
  }

  try {
    const supabase = await createClient();
    // The session is verified before any address is opened.
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return { ok: false, reason: "server" };
    const { data: householdId, error: householdError } = await supabase.rpc(
      "current_household_id",
    );
    if (householdError || !householdId) return { ok: false, reason: "server" };

    let title = idea;
    let shopName: string | null = null;
    let priceCents: number | null = null;
    let photo: { contentType: "image/webp"; base64: string } | null = null;
    if (link !== "") {
      const read = await readShopLink(link);
      if (read.ok) {
        // The name written by the parent wins; the page only gives the rest.
        if (title === "") title = read.title ?? "";
        shopName = read.shopName;
        priceCents = read.priceCents;
        photo = read.photo;
      }
      if (title === "") return { ok: false, reason: "unreadable" };
    }

    const { error } = await supabase.rpc("add_wishlist_item", {
      p_member_id: input.childId,
      p_title: title,
      ...(link !== "" ? { p_url: link } : {}),
      ...(shopName ? { p_shop_name: shopName } : {}),
      ...(priceCents !== null ? { p_price_cents: priceCents } : {}),
      ...(note !== "" ? { p_note: note } : {}),
      ...(photo
        ? {
            p_photo_base64: photo.base64,
            p_photo_content_type: photo.contentType,
          }
        : {}),
    });
    if (!error) return { ok: true };
    if (error.code === "FN005") return { ok: false, reason: "limit" };
    return { ok: false, reason: error.code ? "server" : "network" };
  } catch {
    return { ok: false, reason: "server" };
  }
}
