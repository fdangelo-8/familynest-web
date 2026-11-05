"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MEMBER_COLORS, type MemberColor } from "@/components/ui/Avatar/Avatar";
import { createClient } from "@/lib/supabase/client";
import { photoSrcOf, type WishItem, type WishlistData } from "./model";

export type WishlistStatus = "loading" | "ready" | "error" | "missing";

type ReadResult =
  { kind: "ok"; data: WishlistData } | { kind: "missing" } | { kind: "error" };

const isMemberColor = (value: string): value is MemberColor =>
  (MEMBER_COLORS as ReadonlyArray<string>).includes(value);

/** PostgREST gives an object for a one-to-one link and an array otherwise. */
function asList<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

/**
 * Reads the child and the list with the session of the signed-in user (RLS
 * decides what is visible). «Now» is taken here, in the browser. The code of
 * the link is not read: it is only needed when sharing. On a failure only the
 * fact is kept: the error objects can carry the rows, so they are never read,
 * shown or logged.
 */
async function readWishlist(childId: string): Promise<ReadResult> {
  try {
    const supabase = createClient();
    const now = new Date();
    const [member, list] = await Promise.all([
      supabase
        .from("household_members")
        .select("id, kind, name, color, birth_date")
        .eq("id", childId)
        .maybeSingle(),
      supabase
        .from("wishlists")
        .select(
          "id, wishlist_items(id, title, url, shop_name, price_cents, note, created_at, wishlist_item_photos(content_type, data), wishlist_reservations(giver_name, created_at)), wishlist_share_links(expires_at, disabled_at, created_at)",
        )
        .eq("member_id", childId)
        .maybeSingle(),
    ]);
    if (member.error || list.error) return { kind: "error" };

    const child = member.data;
    if (!child || child.kind !== "child") return { kind: "missing" };
    if (!isMemberColor(child.color)) return { kind: "error" };

    const items: WishItem[] = asList(list.data?.wishlist_items).map((item) => {
      const photo = asList(item.wishlist_item_photos)[0];
      const reservation = asList(item.wishlist_reservations)[0];
      return {
        id: item.id,
        title: item.title,
        url: item.url,
        shopName: item.shop_name,
        priceCents: item.price_cents,
        note: item.note,
        photoSrc: photoSrcOf(photo?.content_type, photo?.data),
        createdAt: item.created_at,
        giverName: reservation?.giver_name ?? null,
        takenAt: reservation?.created_at ?? null,
      };
    });
    const active = asList(list.data?.wishlist_share_links).find(
      (link) => link.disabled_at === null && new Date(link.expires_at) > now,
    );
    const latest = active
      ? undefined
      : [...asList(list.data?.wishlist_share_links)].sort((a, b) =>
          b.created_at.localeCompare(a.created_at),
        )[0];

    return {
      kind: "ok",
      data: {
        child: {
          id: child.id,
          name: child.name,
          color: child.color,
          birthDate: child.birth_date,
        },
        items,
        activeLinkExpiresAt: active?.expires_at ?? null,
        endedLink: latest
          ? {
              kind: latest.disabled_at === null ? "expired" : "disabled",
              expiresAt: latest.expires_at,
            }
          : null,
        readAt: now,
      },
    };
  } catch {
    return { kind: "error" };
  }
}

export type Wishlist = {
  status: WishlistStatus;
  data: WishlistData | null;
  /** The page was loaded, but the last reading failed (no network) */
  offline: boolean;
  /** «Riprova» is reading */
  retrying: boolean;
  /** «Riprova» of the page error and of the offline notice */
  retry: () => Promise<boolean>;
  /** Reads again after a change. Resolves with `false` if the reading failed. */
  reload: () => Promise<boolean>;
};

/**
 * Reads the list in the browser, so the server HTML carries nothing of the
 * child and the page has its own loading and error states.
 */
export function useWishlist(childId: string): Wishlist {
  const [status, setStatus] = useState<WishlistStatus>("loading");
  const [data, setData] = useState<WishlistData | null>(null);
  const [offline, setOffline] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const alive = useRef(true);
  const sequence = useRef(0);
  const loaded = useRef(false);

  const run = useCallback(async (): Promise<boolean> => {
    const mine = ++sequence.current;
    const result = await readWishlist(childId);
    // A newer reading took over, or the page is gone.
    if (!alive.current || mine !== sequence.current)
      return result.kind === "ok";
    if (result.kind === "ok") {
      loaded.current = true;
      setData(result.data);
      setStatus("ready");
      setOffline(false);
      return true;
    }
    if (loaded.current && result.kind === "error") {
      // Keep what is on screen and say that it may be old.
      setOffline(true);
    } else {
      setStatus(result.kind);
    }
    return false;
  }, [childId]);

  useEffect(() => {
    alive.current = true;
    // Reads once when the page opens.
    const first = () => void run();
    first();
    return () => {
      alive.current = false;
    };
  }, [run]);

  // The network goes away or comes back while the page is open.
  useEffect(() => {
    const goOffline = () => {
      if (loaded.current) setOffline(true);
    };
    const comeBack = () => {
      if (loaded.current) void run();
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", comeBack);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", comeBack);
    };
  }, [run]);

  const retry = useCallback(async () => {
    setRetrying(true);
    const ok = await run();
    if (alive.current) setRetrying(false);
    return ok;
  }, [run]);

  return { status, data, offline, retrying, retry, reload: run };
}
