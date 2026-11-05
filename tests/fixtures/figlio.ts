import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, type Locator, type Page } from "@playwright/test";
import { waitForAnimationsToEnd } from "./animations";
import {
  buildNest,
  setClock,
  type CasaNest,
  type DeadlineSpec,
  type MemberSpec,
} from "./casa";
import { createEvent, type EventSpec } from "./impegni";

// Helpers of the tests of «Profilo di un figlio» (#31, /figli/<id>, PR #245).
// Every test that writes builds its own throwaway Nests (buildNest) and is
// deleted at the end; the seed users only read. The data are those of the
// «Utenti e dati dei test» of the issue: U = Ugo, U2 = Vera, Mia, Nico, Fido,
// and the events E1 ... E6 and deadlines D1 ... D4.

export const NOT_FOUND = "Questa pagina non c’è";
export const LOAD_ERROR = "Questa pagina non si è caricata";
export const PAGE_TITLE = "FamilyNest · Profilo di un figlio";

/** martedì 20 ottobre 2026, 15:52 a Roma (CEST, UTC+2) */
export const TODAY = new Date("2026-10-20T13:52:00Z");

export const SOFIA = "a1000000-0000-4000-8000-000000000003";
export const TOMMASO = "a1000000-0000-4000-8000-000000000004";
export const LAURA = "a1000000-0000-4000-8000-000000000002";
export const MARCO = "a1000000-0000-4000-8000-000000000001";
export const BISCOTTO = "a1000000-0000-4000-8000-000000000005";
export const LEO = "b1000000-0000-4000-8000-000000000003";

export const childPath = (id: string) => `/figli/${id}`;

// ------------------------------------------------------------------- locators

export const h1 = (page: Page) => page.getByRole("heading", { level: 1 });
export const subtitle = (page: Page) => page.locator(".intestazione__sotto");

/** The pencil of the bar (390) or the button of the head (1280). */
export const pencil = (page: Page, name: string) =>
  page.getByRole("button", {
    name: `Modifica il profilo di ${name}`,
    exact: true,
  });

export const sheetOf = (page: Page, name: string) =>
  page.getByRole("dialog", {
    name: `Modifica il profilo di ${name}`,
    exact: true,
  });

/** A section of the page by the text of its h2. */
export const section = (page: Page, title: string) =>
  page.locator("section.sezione").filter({
    has: page.getByRole("heading", { level: 2, name: title, exact: true }),
  });

export const counters = (page: Page) =>
  page.locator(".griglia-contatori--tre > *");

export const toastOf = (page: Page, text: string) =>
  page.getByRole("status").filter({ hasText: text });

/** Any visible toast with text (the Next route announcer is empty). */
export const anyToast = (page: Page) =>
  page.getByTestId("toast").filter({ hasText: /\S/ });

export const pageText = (page: Page) => page.locator("body").innerText();

export const field = (scope: Locator, label: string) =>
  scope.getByLabel(label, { exact: true });

export const saveButton = (dialog: Locator) =>
  dialog.getByRole("button", { name: "Salva le modifiche", exact: true });

export const teacherGroup = (dialog: Locator, index: number) =>
  dialog.getByRole("group", { name: `Maestra ${index}`, exact: true });

export const colorRadio = (dialog: Locator, label: string) =>
  dialog.getByRole("radio", { name: label, exact: true });

export function escapeRx(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --------------------------------------------------------------------- Nests

/** U = Ugo (administrator), U2 = Vera (adult with account), Mia, Nico, Fido. */
export const PEOPLE: MemberSpec[] = [
  { name: "Ugo", kind: "adult", color: "pomodoro", account: true },
  { name: "Vera", kind: "adult", color: "lampone", account: true },
  { name: "Mia", kind: "child", color: "salvia" },
  { name: "Nico", kind: "child", color: "cobalto" },
  { name: "Fido", kind: "pet", color: "zafferano" },
];

export type FigliCtx = {
  nest: CasaNest;
  admin: SupabaseClient;
  householdId: string;
  mia: string;
  nico: string;
  fido: string;
};

/**
 * «Casa Prova» as in the issue: Mia and Nico born on 14/12/2016, no profile,
 * no events, no deadlines. Everything is deleted at the end.
 */
export async function withFigli(
  body: (ctx: FigliCtx) => Promise<void>,
  births: Partial<
    Record<"Ugo" | "Vera" | "Mia" | "Nico" | "Fido", string>
  > = {},
) {
  const { nest, cleanup } = await buildNest("Casa Prova", PEOPLE);
  try {
    const admin = nest.users["Ugo"]!.admin;
    const dates = { Mia: "2016-12-14", Nico: "2016-12-14", ...births };
    for (const [name, date] of Object.entries(dates)) {
      if (date) await setBirth(admin, nest.members[name]!, date);
    }
    await body({
      nest,
      admin,
      householdId: nest.householdId,
      mia: nest.members["Mia"]!,
      nico: nest.members["Nico"]!,
      fido: nest.members["Fido"]!,
    });
  } finally {
    await cleanup();
  }
}

/** V: another user with his own Nest «Casa Altra» and a daughter «Nina». */
export async function withAltraCasa(
  body: (altra: { nest: CasaNest; nina: string }) => Promise<void>,
) {
  const { nest, cleanup } = await buildNest("Casa Altra", [
    { name: "Vito", kind: "adult", color: "pomodoro", account: true },
    { name: "Nina", kind: "child", color: "salvia" },
  ]);
  try {
    await body({ nest, nina: nest.members["Nina"]! });
  } finally {
    await cleanup();
  }
}

async function must(
  query: PromiseLike<{ error: { message: string } | null }>,
  what: string,
) {
  const { error } = await query;
  if (error) throw new Error(`${what} fallito`);
}

export async function setBirth(
  admin: SupabaseClient,
  memberId: string,
  date: string | null,
) {
  await must(
    admin
      .from("household_members")
      .update({ birth_date: date })
      .eq("id", memberId),
    "Data di nascita di prova",
  );
}

// ------------------------------------------------------------------- profiles

export type ProfileSpec = {
  schoolName?: string;
  schoolClass?: string;
  startsAt?: string;
  endsAt?: string;
  days?: number[];
  note?: string;
  shoe?: string;
  clothing?: string;
  pajama?: string;
  /** Instant of the last change of the sizes (the administrator may set it) */
  sizesUpdatedAt?: string;
  teachers?: { name: string; subject?: string; phone?: string }[];
};

/** «Profilo di Mia» of the issue. */
export const FULL_MIA: ProfileSpec = {
  schoolName: "scuola Manzoni",
  schoolClass: "4ª B",
  startsAt: "08:15",
  endsAt: "16:15",
  days: [1, 2, 3, 4, 5],
  note: "mensa compresa",
  shoe: "33",
  clothing: "9–10",
  pajama: "140",
  sizesUpdatedAt: "2026-09-15T10:00:00Z",
  teachers: [
    {
      name: "Maestra Bianchi",
      subject: "Italiano e storia",
      phone: "039 234 5678",
    },
    { name: "Maestro Rossi" },
  ],
};

/** Replaces the whole profile (school, sizes, teachers) of a child. */
export async function writeProfile(
  ctx: FigliCtx,
  childId: string,
  spec: ProfileSpec,
) {
  const { admin, householdId } = ctx;
  await must(
    admin.from("child_teachers").delete().eq("member_id", childId),
    "Pulizia delle maestre di prova",
  );
  await must(
    admin.from("child_profiles").delete().eq("member_id", childId),
    "Pulizia del profilo di prova",
  );
  const hasRow = [
    spec.schoolName,
    spec.schoolClass,
    spec.startsAt,
    spec.endsAt,
    spec.note,
    spec.shoe,
    spec.clothing,
    spec.pajama,
  ].some((value) => value !== undefined);
  if (hasRow) {
    await must(
      admin.from("child_profiles").insert({
        household_id: householdId,
        member_id: childId,
        school_name: spec.schoolName ?? null,
        school_class: spec.schoolClass ?? null,
        school_starts_at: spec.startsAt ?? null,
        school_ends_at: spec.endsAt ?? null,
        school_days: spec.days ?? [],
        school_note: spec.note ?? null,
        shoe_size: spec.shoe ?? null,
        clothing_size: spec.clothing ?? null,
        pajama_size: spec.pajama ?? null,
        ...(spec.sizesUpdatedAt
          ? { sizes_updated_at: spec.sizesUpdatedAt }
          : {}),
      }),
      "Profilo di prova",
    );
  }
  const teachers = spec.teachers ?? [];
  if (teachers.length > 0) {
    await must(
      admin.from("child_teachers").insert(
        teachers.map((teacher, index) => ({
          household_id: householdId,
          member_id: childId,
          sort_order: index + 1,
          name: teacher.name,
          subject: teacher.subject ?? null,
          phone: teacher.phone ?? null,
        })),
      ),
      "Maestre di prova",
    );
  }
}

export type ProfileRow = {
  school_name: string | null;
  school_class: string | null;
  school_starts_at: string | null;
  school_ends_at: string | null;
  school_days: number[];
  school_note: string | null;
  shoe_size: string | null;
  clothing_size: string | null;
  pajama_size: string | null;
  sizes_updated_at: string | null;
};

export type TeacherRow = {
  name: string;
  subject: string | null;
  phone: string | null;
  sort_order: number;
};

export type ProfileState = {
  /** `null` when there is no row; an empty row is judged by its fields */
  row: ProfileRow | null;
  teachers: TeacherRow[];
  member: { name: string; color: string; birth_date: string | null };
};

/** Everything saved for a child, read with the administrative client. */
export async function readProfile(
  ctx: FigliCtx,
  childId: string,
): Promise<ProfileState> {
  const profile = await ctx.admin
    .from("child_profiles")
    .select(
      "school_name, school_class, school_starts_at, school_ends_at, school_days, school_note, shoe_size, clothing_size, pajama_size, sizes_updated_at",
    )
    .eq("member_id", childId)
    .maybeSingle();
  const teachers = await ctx.admin
    .from("child_teachers")
    .select("name, subject, phone, sort_order")
    .eq("member_id", childId)
    .order("sort_order", { ascending: true });
  const member = await ctx.admin
    .from("household_members")
    .select("name, color, birth_date")
    .eq("id", childId)
    .single();
  if (profile.error || teachers.error || member.error) {
    throw new Error("Lettura del profilo di prova fallita");
  }
  return {
    row: profile.data as ProfileRow | null,
    teachers: teachers.data as TeacherRow[],
    member: member.data as ProfileState["member"],
  };
}

/** True when a row has no school and no size at all (the row may exist empty). */
export function isEmptyRow(row: ProfileRow | null): boolean {
  if (!row) return true;
  return (
    row.school_name === null &&
    row.school_class === null &&
    row.school_starts_at === null &&
    row.school_ends_at === null &&
    row.school_note === null &&
    row.shoe_size === null &&
    row.clothing_size === null &&
    row.pajama_size === null
  );
}

export async function setSchoolDays(
  ctx: FigliCtx,
  childId: string,
  days: number[],
  note: string | null = "mensa compresa",
) {
  await must(
    ctx.admin
      .from("child_profiles")
      .update({ school_days: days, school_note: note })
      .eq("member_id", childId),
    "Giorni di scuola di prova",
  );
}

// --------------------------------------------------------------------- events

export type EventKey = "E1" | "E2" | "E3" | "E4" | "E5" | "E6";

const EVENTS: Record<EventKey, { by: "Ugo" | "Vera"; spec: EventSpec }> = {
  E1: {
    by: "Ugo",
    spec: {
      title: "Pagella",
      day: "2026-10-19",
      from: "17:00",
      to: "18:00",
      members: ["Mia"],
    },
  },
  E2: {
    by: "Ugo",
    spec: {
      title: "Nuoto",
      day: "2026-10-22",
      from: "17:00",
      to: "18:00",
      place: "piscina comunale",
      members: ["Mia"],
    },
  },
  E3: {
    by: "Ugo",
    spec: {
      title: "Festa di Giulia",
      day: "2026-10-24",
      from: "16:00",
      to: "19:00",
      place: "via Verdi 8",
      members: ["Mia", "Nico"],
    },
  },
  E4: {
    by: "Ugo",
    spec: {
      title: "Calcetto",
      day: "2026-10-21",
      from: "18:00",
      to: "19:00",
      members: ["Nico"],
    },
  },
  E5: {
    by: "Ugo",
    spec: {
      title: "Gita",
      day: "2026-10-26",
      from: "09:00",
      to: "17:00",
      members: ["Mia"],
    },
  },
  E6: {
    by: "Vera",
    spec: {
      title: "Prova del saggio",
      day: "2026-10-22",
      from: "10:00",
      to: "11:00",
      visibility: "busy",
      members: ["Mia"],
    },
  },
};

/** Creates the events of the issue with the session of their author. */
export async function createEvents(
  ctx: FigliCtx,
  keys: EventKey[] = ["E1", "E2", "E3", "E4", "E5", "E6"],
): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const key of keys) {
    const { by, spec } = EVENTS[key];
    ids[key] = await createEvent(ctx.nest, by, spec);
  }
  return ids;
}

// ------------------------------------------------------------------ deadlines

export type DeadlineKey = "D1" | "D2" | "D3" | "D4";

export const D1_TITLE = "Rinnovo carta d'identità di Mia";
export const D2_TITLE = "Iscrizione al corso di nuoto";
export const D3_TITLE = "Quota della gita";
export const D4_TITLE = "Comprare il regalo per Mia";

const DEADLINES: Record<
  DeadlineKey,
  { by: "Ugo" | "Vera"; spec: DeadlineSpec }
> = {
  D1: {
    by: "Ugo",
    spec: { title: D1_TITLE, due: "2026-11-03", forMember: "Mia" },
  },
  D2: {
    by: "Ugo",
    spec: { title: D2_TITLE, due: "2026-12-01", assignee: "Mia" },
  },
  D3: {
    by: "Ugo",
    spec: { title: D3_TITLE, due: "2026-10-15", forMember: "Mia" },
  },
  D4: {
    by: "Vera",
    spec: {
      title: D4_TITLE,
      due: "2026-10-25",
      forMember: "Mia",
      priv: true,
    },
  },
};

/** Creates the deadlines of the issue (D3, the past one, only when asked). */
export async function createDeadlines(
  ctx: FigliCtx,
  keys: DeadlineKey[] = ["D1", "D2", "D4"],
): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const key of keys) {
    const { by, spec } = DEADLINES[key];
    ids[key] = await ctx.nest.deadline(by, spec);
  }
  return ids;
}

export async function moveDeadline(ctx: FigliCtx, id: string, due: string) {
  await must(
    ctx.admin.from("deadlines").update({ due_date: due }).eq("id", id),
    "Scadenza di prova spostata",
  );
}

export async function removeDeadlines(ctx: FigliCtx, ids: string[]) {
  await must(
    ctx.admin.from("deadlines").delete().in("id", ids),
    "Scadenze di prova cancellate",
  );
}

/** «Il caso di CA-7»: profile of Mia, events E1 ... E6, deadlines D1, D2, D4. */
export async function standardCase(ctx: FigliCtx) {
  await writeProfile(ctx, ctx.mia, FULL_MIA);
  const events = await createEvents(ctx);
  const deadlines = await createDeadlines(ctx);
  return { events, deadlines };
}

// ----------------------------------------------------------------- navigation

/**
 * Signs `who` in, fixes the clock at TODAY (it keeps running), opens the page
 * of the child and waits for the h1 with its name: the data are read in the
 * browser, so the h1 means the page is loaded and hydrated.
 */
export async function openChild(
  page: Page,
  baseURL: string | undefined,
  ctx: FigliCtx,
  who: string,
  childId: string,
  name: string,
  options: { clock?: boolean } = {},
) {
  if (options.clock !== false) await setClock(page, TODAY);
  await ctx.nest.signIn(page, baseURL, who);
  await page.goto(childPath(childId));
  await expect(h1(page)).toHaveText(name);
}

/** Opens the edit sheet with the pencil (390) or the button of the head (1280). */
export async function openSheet(page: Page, name: string): Promise<Locator> {
  await pencil(page, name).click();
  const dialog = sheetOf(page, name);
  await expect(dialog).toBeVisible();
  await waitForAnimationsToEnd(page);
  return dialog;
}

export async function closeSheet(page: Page, dialog: Locator) {
  await dialog.getByRole("button", { name: "Chiudi", exact: true }).click();
  await expect(dialog).toBeHidden();
}

// ------------------------------------------------------------------- network

/**
 * Records the text of every HTML, JSON and Flight (Next.js data) response the
 * page receives, to look for data that must not arrive. Scripts, styles and
 * images are left out. Start it before `goto`.
 */
export function recordResponses(page: Page) {
  const pending: Promise<string>[] = [];
  page.on("response", (response) => {
    const type = response.headers()["content-type"] ?? "";
    if (!/html|json|x-component|text\/plain/.test(type)) return;
    pending.push(response.text().catch(() => ""));
  });
  return {
    async text(): Promise<string> {
      return (await Promise.all(pending)).join("\n");
    },
  };
}

/** Every URL the browser asked for (path and parameters). Start before `goto`. */
export function recordUrls(page: Page): string[] {
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));
  return urls;
}

const UUID_RX =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * The part of a URL that can carry data: no static files of Next (their
 * hashes are random) and no uuids (random hex digits that may spell «234»).
 */
export function dataPartOfUrl(url: string): string | null {
  const parsed = new URL(url);
  if (parsed.pathname.startsWith("/_next/static/")) return null;
  if (parsed.pathname.startsWith("/_next/image")) return null;
  if (/\.(?:png|jpg|jpeg|svg|ico|woff2?|css|js|map)$/.test(parsed.pathname)) {
    return null;
  }
  // `_rsc` is a short random token that Next adds to its data requests.
  const search = parsed.search.replace(/[?&]_rsc=[^&]*/g, "");
  const raw = `${parsed.pathname}${search}`;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // keep the raw form
  }
  return `${raw}\n${decoded}`.replace(UUID_RX, "");
}

export const SAVE_RPC = /\/rest\/v1\/rpc\/save_child_profile/;
export const PROFILE_TABLE = /\/rest\/v1\/child_profiles/;

export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
};

/** Holds every call that matches `url` until `release()` (the preflight passes). */
export async function holdRequests(page: Page, url: RegExp) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(url, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.continue();
      return;
    }
    await gate;
    await route.continue();
  });
  return { release };
}

/** Answers every call that matches `url` with a 500 (the preflight passes). */
export async function failRequests(page: Page, url: RegExp) {
  await page.route(url, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify({ code: "XX000", message: "boom internal detail" }),
    });
  });
}

// ---------------------------------------------------------------------- dates

/** «aggiornate a novembre» (the year only when it is not the one of the clock). */
export function sizesUpdatedLabel(iso: string, clockYear = 2026): string {
  const when = new Date(iso);
  const month = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    month: "long",
  }).format(when);
  const year = Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Rome",
      year: "numeric",
    }).format(when),
  );
  return `aggiornate a ${month}${year === clockYear ? "" : ` ${year}`}`;
}
