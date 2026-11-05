import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { createThrowawayUser, type ThrowawayUser } from "./throwaway-user";

// Helpers shared by tests/visual/lista-desideri.spec.ts and
// tests/a11y/lista-desideri.spec.ts (PR #279: issues #32 and #33). Pages:
// /figli/<id>/lista-desideri (parents) and /desideri/<code> (public, no
// login). Both read in the browser, so each state has a throwaway user with a
// Nest of its own. Every date on screen is counted from FIXED_NOW (the clock
// of the browser): the birthday of Sofia is 14 December 2016, so on FIXED_NOW
// the counter reads «42 giorni» and the public page «Il 14 dicembre».

/** Monday 2 November 2026, 10:00 in Rome. */
export const FIXED_NOW = new Date("2026-11-02T10:00:00+01:00");

export const CHILD = "Sofia";

/** `expires_at` shown by the parents' page: «Attivo fino al 15 dicembre». */
export const LINK_EXPIRES_AT = "2026-12-15T23:00:00+00:00";

export const baseURL = () =>
  test.info().project.use.baseURL ?? "http://localhost:3000";

export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

// 160 x 160 JPEG (1.8 KB), a flat picture: the reduced copy of a shop photo.
const PHOTO_BASE64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCACgAKADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDvaKKKwNAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiqOs/8gub/gP/AKEKBN2Vy9RXE0VXKZe18jtqK4mijlD2vkdtRXE0Ucoe18jtqK4mijlD2vkdtRXE0Ucoe18jtqK4mijlD2vkdtRWX4e/48X/AOup/kK1KTNU7q4UUUUhhRRRQAVR1n/kFzf8B/8AQhV6qOs/8gub/gP/AKEKaFLZnL0UUVZyhRRRQAUU6ON5X2xqWPoKvR6TIwzJIqewGaiVSMd2VGnKWyM+itJ9IcD93MrH3GP8aoTQywttlQqf50RqRlsxypyjuhlFFFWQFFFFAHReHv8Ajxf/AK6n+QrUrL8Pf8eL/wDXU/yFalQ9zph8KCiiikUFFFFABVHWf+QXN/wH/wBCFXqo6z/yC5v+A/8AoQpoUtmcvRRRVnKFOijaWRY0HLHFNrQ0eMNM8hx8gwOPX/8AV+tRUlyxbKpx5pJGja2yW0e1OSfvN61NRRXlttu7PUSSVkFRzQpPGY5BkH9PepKKE7aoGr6M525ga3maNucdDjqKirV1mMGOOXjIO3p1/wA4/WsqvTpT54JnmVYckmgooorQg6Lw9/x4v/11P8hWpWX4e/48X/66n+QrUqHudMPhQUUUUigooooAKo6z/wAgub/gP/oQq9VHWf8AkFzf8B/9CFNClszl6KKKs5QrS0ZwJJU5yQD+X/66zafBKYZkkXqp6etRUjzRaLpy5ZJnSUVHDMk8YkjOQf09qkry2raM9NO+qCiimyOsaF3YKo6k0gKOsuBBGnOS2fyH/wBesip7y4+03BkwQvRQewqCvUow5IJM82rPmm2gooorQzOi8Pf8eL/9dT/IVqVl+Hv+PF/+up/kK1Kh7nTD4UFFFFIoKKKKACqOs/8AILm/4D/6EKvVR1n/AJBc3/Af/QhTQpbM5eiiirOUKKKKAJYLiW3fdE2M9R2NaEerIR+9iYH/AGec1lUVnOlCe6LhVlDZmu+rRAfu4nY++B/jWfcXc1yR5hG0chR0FQUUQowhqkOdWctGwooorQzCiiigDovD3/Hi/wD11P8AIVqVl+Hv+PF/+up/kK1Kh7nTD4UFFFFIoKKKKACqOs/8gub/AID/AOhCr1UdZ/5Bc3/Af/QhTQpbM5eiiirOUKKKKACiiigAooooAKKKKACiiigDovD3/Hi//XU/yFalZfh7/jxf/rqf5CtSoe50w+FBRRRSKCiiigAqK5gS5t2hkLBWxkr165qWigDL/sK1/wCek3/fQ/wo/sK1/wCek3/fQ/wrUop3ZPJHsZf9hWv/AD0m/wC+h/hR/YVr/wA9Jv8Avof4VqUUXYckexl/2Fa/89Jv++h/hR/YVr/z0m/76H+FalFF2HJHsZf9hWv/AD0m/wC+h/hR/YVr/wA9Jv8Avof4VqUUXYckexl/2Fa/89Jv++h/hR/YVr/z0m/76H+FalFF2HJHsZf9hWv/AD0m/wC+h/hR/YVr/wA9Jv8Avof4VqUUXYckexXs7SOziMcRYgtu+Y/59KsUUUikrBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAf//Z";

type Idea = {
  title: string;
  url?: string;
  shop?: string;
  note?: string;
  cents: number;
  /** Taken by this name (the order of `ideas` below is the order on screen) */
  giver?: string;
  photo?: boolean;
};

// The ideas of the mockup, in the order they have on screen. The pages show the
// latest added first, so they are inserted from the last: the first of this
// list ends up on top.
const IDEAS: Idea[] = [
  {
    title: "Diario segreto con lucchetto",
    url: "https://www.lafeltrinelli.it/diario-segreto",
    shop: "Feltrinelli",
    note: "lo vuole tanto",
    cents: 1800,
    photo: true,
  },
  {
    title: "Set di acquerelli con pennelli",
    url: "https://www.amazon.it/acquerelli",
    shop: "Amazon",
    cents: 2400,
  },
  {
    title: "Cuffie senza fili per bambini",
    url: "https://www.mediaworld.it/cuffie",
    shop: "MediaWorld",
    cents: 3900,
    photo: true,
  },
  {
    title: "Biglietti per il musical",
    note: "Un'esperienza da fare con la nonna",
    cents: 6000,
  },
  { title: "Casco per la bici", cents: 3500, giver: "Nonna Anna" },
  { title: "Puzzle da 1000 pezzi", cents: 2200, giver: "Zia Carla" },
];

export type Ideas = "mockup" | "mockup-con-foto" | "tutte-prese" | "nessuna";
export type Share = "mai" | "attivo" | "disattivato";

export type WishNest = {
  user: ThrowawayUser;
  childId: string;
  householdId: string;
  /** The code of the link, if there is one (public page only) */
  code: string | null;
};

const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/** Takes an idea like a stranger would: the public function, no session. */
async function reserveAsStranger(code: string, itemId: string, name: string) {
  const anon = createClient(supabaseUrl(), publishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.rpc("reserve_public_wishlist_item", {
    p_code: code,
    p_item_id: itemId,
    p_name: name,
    p_giver_key: randomUUID().replace(/-/g, ""),
  });
  if (error || data !== "reserved") {
    throw new Error("Regalo di prova non segnato");
  }
}

/**
 * A throwaway user with a Nest and Sofia (born 14 December 2016, «compie 10
 * anni»; `birth: null` = no birth date), with the ideas and the link asked.
 * `login` puts the session in the browser (parents' page); the public page
 * needs none.
 */
export async function wishNest(
  page: Page,
  options: {
    ideas?: Ideas;
    share?: Share;
    birth?: string | null;
    login?: boolean;
  } = {},
): Promise<WishNest> {
  const ideas = options.ideas ?? "mockup";
  const share = options.share ?? "mai";
  const birth = options.birth === undefined ? "2016-12-14" : options.birth;
  const user = await createThrowawayUser("Ilaria De Santis");
  try {
    const created = await user.client.rpc("create_household", {
      name: "Casa De Santis",
      household_type: "family_with_children",
      member_name: "Ilaria",
      color: "pomodoro",
    });
    if (created.error) throw new Error("Nest di prova non creato");
    const { data: householdId } = await user.client.rpc("current_household_id");

    const insert = await user.client.from("household_members").insert({
      household_id: householdId as string,
      kind: "child",
      name: CHILD,
      color: "salvia",
      ...(birth ? { birth_date: birth } : {}),
    });
    if (insert.error) throw new Error("Figlio di prova non aggiunto");
    const { data: row } = await user.client
      .from("household_members")
      .select("id")
      .eq("kind", "child")
      .eq("name", CHILD)
      .single();
    if (!row) throw new Error("Figlio di prova non letto");
    const childId = row.id as string;

    const wanted: Idea[] =
      ideas === "nessuna"
        ? []
        : ideas === "tutte-prese"
          ? IDEAS.map((idea, index) => ({
              ...idea,
              giver:
                idea.giver ?? ["Nonno Piero", "Zio Luca", "Zia Anna"][index],
            }))
          : IDEAS.map((idea) => ({
              ...idea,
              photo: ideas === "mockup-con-foto" ? idea.photo : false,
            }));

    const ids = new Map<string, string>();
    for (const idea of [...wanted].reverse()) {
      const added = await user.client.rpc("add_wishlist_item", {
        p_member_id: childId,
        p_title: idea.title,
        ...(idea.url ? { p_url: idea.url } : {}),
        ...(idea.shop ? { p_shop_name: idea.shop } : {}),
        p_price_cents: idea.cents,
        ...(idea.note ? { p_note: idea.note } : {}),
      });
      if (added.error || !added.data) throw new Error("Idea non aggiunta");
      ids.set(idea.title, added.data as string);
      if (idea.photo) {
        const photo = await user.admin.from("wishlist_item_photos").insert({
          item_id: added.data as string,
          household_id: householdId as string,
          content_type: "image/jpeg",
          data: `\\x${Buffer.from(PHOTO_BASE64, "base64").toString("hex")}`,
        });
        if (photo.error) throw new Error("Foto di prova non salvata");
      }
    }

    let code: string | null = null;
    if (share !== "mai") {
      const shared = await user.client.rpc("share_wishlist", {
        p_member_id: childId,
      });
      const first = Array.isArray(shared.data) ? shared.data[0] : shared.data;
      if (shared.error || !first?.code) throw new Error("Link non creato");
      code = first.code as string;
      // The last one of the list is taken first: the first to be taken is the
      // lowest on screen (the latest taken goes on top).
      for (const idea of [...wanted].reverse()) {
        if (idea.giver) {
          await reserveAsStranger(code, ids.get(idea.title)!, idea.giver);
        }
      }
      if (share === "disattivato") {
        const off = await user.client.rpc("disable_wishlist_share_link", {
          p_member_id: childId,
        });
        if (off.error) throw new Error("Link non disattivato");
      }
    }

    if (options.login) {
      await user.signInContext(page.context(), baseURL());
    }
    return { user, childId, householdId: householdId as string, code };
  } catch (error) {
    await user.remove();
    throw error;
  }
}

/**
 * The expiry of the link is decided by the database clock; the page counts
 * with the clock of the browser. Pins what the page reads, so «Attivo fino al
 * 15 dicembre» does not depend on the day of the run. `null` leaves it alone.
 */
export async function pinLinkExpiry(page: Page, expiresAt: string) {
  await page.route("**/rest/v1/wishlists*", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const response = await route.fetch();
    const json = await response.json();
    type Row = { wishlist_share_links?: Array<{ expires_at: string }> };
    const rows: Row[] = Array.isArray(json) ? json : [json];
    for (const wishlist of rows) {
      for (const link of wishlist?.wishlist_share_links ?? []) {
        link.expires_at = expiresAt;
      }
    }
    return route.fulfill({ response, json });
  });
}

/** Opens /figli/<id>/lista-desideri and waits for the real page (h1). */
export async function openWishlist(page: Page, childId: string) {
  await expect(async () => {
    await page.goto(`/figli/${childId}/lista-desideri`);
    await expect(
      page.getByRole("heading", { level: 1, name: `I desideri di ${CHILD}` }),
    ).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 60_000 });
  await settle(page);
}

/** Opens /desideri/<code> (no session) and waits for the page. */
export async function openPublic(page: Page, code: string) {
  await expect(async () => {
    await page.goto(`/desideri/${code}`);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: `Il compleanno di ${CHILD}`,
      }),
    ).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 60_000 });
  await settle(page);
}

/** Fonts ready, every picture loaded. */
export async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("load");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from(document.images).every(
          (image) => image.complete && image.naturalWidth > 0,
        ),
      ),
    )
    .toBe(true);
}

/** Pointer away, then the reference of the whole page. */
export async function shoot(page: Page, name: string, fullPage = true) {
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot(name, { fullPage });
}

/** The rows of the parents' page, by the name of the title-button. */
export const ideaButton = (page: Page, title: string) =>
  page.getByRole("button", { name: title, exact: true });

/** The reads of the list answer like this; the writes go on. */
export async function answerListReads(
  page: Page,
  answer: "error" | { hold: Promise<void> },
) {
  await page.route("**/rest/v1/wishlists*", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    if (answer === "error") {
      return route.fulfill({
        status: 500,
        headers: { ...CORS, "content-type": "application/json" },
        body: JSON.stringify({ message: "boom" }),
      });
    }
    await answer.hold;
    return route.fallback();
  });
}

/** The public read answers like this (POST of the function). */
export async function answerPublicReads(
  page: Page,
  answer: "error" | { hold: Promise<void> },
) {
  await page.route("**/rest/v1/rpc/get_public_wishlist", async (route) => {
    if (answer === "error") {
      return route.fulfill({
        status: 500,
        headers: { ...CORS, "content-type": "application/json" },
        body: JSON.stringify({ message: "boom" }),
      });
    }
    await answer.hold;
    return route.fallback();
  });
}
