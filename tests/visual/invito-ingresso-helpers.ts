import {
  expect,
  type BrowserContext,
  type Page,
  type Route,
} from "@playwright/test";
import {
  createThrowawayUser,
  type ThrowawayUser,
} from "../fixtures/throwaway-user";

// Shared by tests/visual/invito-ingresso.spec.ts and
// tests/a11y/invito-ingresso.spec.ts (invitation entry, #16: Benvenuto on
// /invito and Il tuo colore on /invito/colore).
// Every test has its own throwaway users (marked in app_metadata, deleted at
// the end): an administrator with a Nest, whose members and invitation are
// written with the administrative key of the Supabase the tests run against,
// and, where the page needs it, a second user without a Nest who is the
// invited adult. Nothing is ever pressed against the database: the answers of
// the «Continua» server action are given by the test.

type Color =
  | "pomodoro"
  | "glicine"
  | "salvia"
  | "cobalto"
  | "zafferano"
  | "lampone"
  | "ceruleo"
  | "peonia"
  | "basilico"
  | "cannella";

export type Seed = {
  name: string;
  kind: "adult" | "child" | "pet";
  color: Color;
  birth?: string;
};

/** The people of the mockup (Casa D'Angelo). Marco is the administrator. */
export const MOCKUP_OTHERS: Seed[] = [
  { name: "Sofia", kind: "child", color: "salvia", birth: "2016-12-14" },
  { name: "Tommaso", kind: "child", color: "cobalto", birth: "2020-04-02" },
  { name: "Biscotto", kind: "pet", color: "zafferano", birth: "2023-05-01" },
];

/** Marco + 8 others + the invited adult = the 10 members a Nest allows. */
export const MANY_OTHERS: Seed[] = [
  ...MOCKUP_OTHERS,
  { name: "Nonna Rosa", kind: "adult", color: "lampone" },
  { name: "Zio Piero", kind: "adult", color: "ceruleo" },
  { name: "Giulia", kind: "child", color: "peonia", birth: "2024-08-01" },
  { name: "Micio", kind: "pet", color: "basilico" },
  { name: "Luca", kind: "child", color: "cannella", birth: "2026-05-01" },
];

export const MOCKUP_MESSAGE =
  "Ho messo tutto qui: calendario, spesa, le cose dei bimbi. Entra anche tu!";

export const LONG_MESSAGE =
  "Ho messo tutto qui: calendario, spesa, le cose dei bimbi, i turni del nuoto e del calcetto, la lista dei regali e le scadenze di casa. Entra anche tu, così ci vediamo al volo e non scriviamo più su tre chat diverse. La domenica sera sappiamo già chi porta chi.";

/** Limits of the app: 40 characters a person, 60 characters a Nest. */
export const LONG_NEST =
  "Casa Rossi Bianchi Verdi Neri De Santis Dall'Orto Bianconi";
export const LONG_INVITER = "Maria Francesca Giovanna Dall'Orto Bianc";
export const LONG_INVITEE = "Giovanni Battista Alessandro Maria Rossi";

export type InviteFixture = {
  /** Administrator (Marco). */
  admin: ThrowawayUser;
  /** Token of the invitation, read with the administrative key. */
  token: string;
  nest: string;
  inviteeId: string;
  /** Every throwaway user created: removed with `remove()`. */
  remove: () => Promise<void>;
};

/** Noon UTC, `days` calendar days from now in Rome: the same date at Rome. */
function expiryIn(days: number): string {
  const rome = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = rome.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0)).toISOString();
}

export type InviteOptions = {
  nest?: string;
  inviter?: string;
  invitee?: string;
  others?: Seed[];
  message?: string | null;
  /** Calendar days left; 6 is the mockup («ancora 6 giorni»). */
  days?: number;
  /** The administrator leaves no trace on the invitation. */
  inviterGone?: boolean;
};

/**
 * A Nest «Casa D'Angelo» created the way step 1 creates it, with Marco as
 * administrator (pomodoro), the others, the invited adult Laura (glicine,
 * without account) and a pending invitation from Marco to Laura.
 */
export async function inviteFixture(
  options: InviteOptions = {},
): Promise<InviteFixture> {
  const {
    nest = "Casa D'Angelo",
    inviter = "Marco",
    invitee = "Laura",
    others = MOCKUP_OTHERS,
    message = MOCKUP_MESSAGE,
    days = 6,
  } = options;
  const admin = await createThrowawayUser(inviter);
  try {
    const created = await admin.client.rpc("create_household", {
      name: nest,
      household_type: "family_with_children",
      member_name: inviter,
      color: "pomodoro",
    });
    if (created.error) throw new Error("Nest non creato");
    const household = await admin.client.rpc("current_household_id");
    const householdId = household.data as string;
    const me = await admin.admin
      .from("household_members")
      .select("id")
      .eq("user_id", admin.id)
      .single();
    if (me.error || !me.data) throw new Error("Amministratore non trovato");

    // Created in this order, so the avatars keep it.
    const people: Seed[] = [
      { name: invitee, kind: "adult", color: "glicine" },
      ...others,
    ];
    let inviteeId = "";
    for (const person of people) {
      const inserted = await admin.admin
        .from("household_members")
        .insert({
          household_id: householdId,
          name: person.name,
          kind: person.kind,
          color: person.color,
          birth_date: person.birth ?? null,
        })
        .select("id")
        .single();
      if (inserted.error || !inserted.data)
        throw new Error(`Membro non aggiunto: ${person.name}`);
      if (person === people[0]) inviteeId = inserted.data.id as string;
    }

    const invitation = await admin.admin
      .from("invitations")
      .insert({
        household_id: householdId,
        member_id: inviteeId,
        invited_by_member_id: me.data.id,
        message: message ?? null,
        expires_at: expiryIn(days),
      })
      .select("token")
      .single();
    if (invitation.error || !invitation.data)
      throw new Error("Invito non creato");

    return {
      admin,
      token: invitation.data.token as string,
      nest,
      inviteeId,
      async remove() {
        await admin.remove();
      },
    };
  } catch (error) {
    await admin.remove();
    throw error;
  }
}

/** A throwaway user with a Nest of another name (Giulia, Casa Bianchi). */
export async function otherNestUser(): Promise<ThrowawayUser> {
  const user = await createThrowawayUser("Giulia");
  try {
    const { error } = await user.client.rpc("create_household", {
      name: "Casa Bianchi",
      household_type: "couple",
      member_name: "Giulia",
      color: "ceruleo",
    });
    if (error) throw new Error("Nest di Giulia non creato");
    return user;
  } catch (error) {
    await user.remove();
    throw error;
  }
}

/** Someone with an account and no Nest (the invited adult once signed in). */
export const visitor = () => createThrowawayUser("Laura");

/**
 * Opens the invitation link as a visitor: the route stores the token in a
 * cookie and sends the browser to /invito (no token in the address).
 */
export async function openLink(page: Page, token: string) {
  await page.goto(`/invito/${token}`);
  await expect(page).toHaveURL(/\/invito(\?.*)?$/);
}

/** Visible one of the two layouts (one `<main>`, one shown at a time). */
export const shown = (
  page: Page,
  role: Parameters<Page["getByRole"]>[0],
  name?: string | RegExp,
) =>
  page
    .getByRole(role, name === undefined ? {} : { name })
    .filter({ visible: true });

/** Visible alert or status whose text contains `text` (they have no name). */
export const shownText = (
  page: Page,
  role: "alert" | "status",
  text: string | RegExp,
) => page.getByRole(role).filter({ hasText: text }).filter({ visible: true });

/** Waits for the real welcome page (not the skeleton). */
export async function waitWelcome(page: Page) {
  await page.locator("h1:visible").first().waitFor();
  await expect(page.getByText("Caricamento in corso")).toHaveCount(0);
}

/** Opens /invito/colore as the visitor with the token in the cookie. */
export async function openColor(
  page: Page,
  baseURL: string | undefined,
  who: ThrowawayUser,
  token: string,
) {
  await signIn(page, baseURL, who);
  await openLink(page, token);
  await page.goto("/invito/colore");
  await expect(shown(page, "radiogroup", "Il tuo colore")).toBeVisible();
}

/** Fonts loaded, pointer away from any control (no hover state). */
export async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
}

/** True for the POST of a server action (not the route announcer). */
export const isAction = (route: Route) =>
  route.request().method() === "POST" &&
  "next-action" in route.request().headers();

/** The answer a server action gives, in the Flight format. */
export function actionAnswer(value: object): {
  status: number;
  contentType: string;
  body: string;
} {
  return {
    status: 200,
    contentType: "text/x-component",
    body: `0:{"a":"$@1","f":"","b":"x"}\n1:${JSON.stringify(value)}\n`,
  };
}

/** Answers «Continua» (the server action of /invito/colore) with `answer`. */
export async function answerContinue(
  page: Page,
  answer: object | "abort" | "hold",
) {
  await page.route("**/invito/colore", (route) => {
    if (!isAction(route)) return route.continue();
    if (answer === "hold") return new Promise<void>(() => undefined);
    return answer === "abort"
      ? route.abort()
      : route.fulfill(actionAnswer(answer));
  });
}

/**
 * The request that starts the sign-in with the provider is cancelled: the
 * browser stays on the page, which keeps the «in corso» state (nothing waits
 * for a navigation that never ends).
 */
export async function holdProviderSignIn(page: Page) {
  await page.route("**/auth/v1/authorize**", (route) => route.abort("aborted"));
}

/** Waits for a visible button with `aria-busy="true"` (no locator: it would wait for the navigation). */
export async function waitBusyButton(page: Page, text: string) {
  await page.waitForFunction(
    (label) =>
      Array.from(document.querySelectorAll("button[aria-busy='true']")).some(
        (b) =>
          b.getBoundingClientRect().width > 0 &&
          (b.textContent ?? "").includes(label),
      ),
    text,
  );
}

/** Names of the focus stops, in order, after `press` Tabs from the top. */
export async function tabNames(page: Page, count: number): Promise<string[]> {
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  const names: string[] = [];
  for (let i = 0; i < count; i += 1) {
    await page.keyboard.press("Tab");
    names.push(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        return (
          el.getAttribute("aria-label") ??
          el.textContent?.replace(/\s+/g, " ").trim() ??
          ""
        );
      }),
    );
  }
  return names;
}

// ---------------------------------------------------------------- shared data
// The tests only read: the answers of «Continua» are given by the test. So the
// Nests and users are made once per worker and kept until the file ends, which
// also keeps the number of password sign-ins low (the server limits them).

const made = new Map<string, Promise<{ remove: () => Promise<void> }>>();

function shared<T extends { remove: () => Promise<void> }>(
  key: string,
  make: () => Promise<T>,
): Promise<T> {
  let value = made.get(key) as Promise<T> | undefined;
  if (!value) {
    value = make();
    made.set(key, value);
  }
  return value;
}

/** Removes everything made by `shared`: call it in `test.afterAll`. */
export async function removeShared() {
  const all = [...made.values()];
  made.clear();
  for (const value of all) {
    try {
      await (await value).remove();
    } catch {
      // The Nest was never made: nothing to remove.
    }
  }
}

export type Case = "mockup" | "senza-messaggio" | "molti" | "lunghi";

const CASES: Record<Case, InviteOptions> = {
  mockup: {},
  "senza-messaggio": { message: null },
  molti: { others: MANY_OTHERS },
  lunghi: {
    nest: LONG_NEST,
    inviter: LONG_INVITER,
    invitee: LONG_INVITEE,
    message: LONG_MESSAGE,
  },
};

/** The Nest, the people and the invitation of a case (made once). */
export const caseNest = (name: Case) =>
  shared(`nest:${name}`, () => inviteFixture(CASES[name]));

/** The invited adult of a case once signed in, without a Nest (made once). */
export const caseVisitor = (name: Case) =>
  shared(`visitor:${name}`, async () => {
    const user = await visitor();
    return user;
  });

/** Giulia, in another Nest (made once). */
export const giuliaInOtherNest = () => shared("giulia", otherNestUser);

const sessions = new Map<
  string,
  Awaited<ReturnType<BrowserContext["cookies"]>>
>();

/** Puts the user's session in the page's browser (signing in once per user). */
export async function signIn(
  page: Page,
  baseURL: string | undefined,
  user: ThrowawayUser,
) {
  const known = sessions.get(user.id);
  if (known) {
    await page.context().addCookies(known);
    return;
  }
  await user.signInContext(page.context(), baseURL as string);
  sessions.set(user.id, await page.context().cookies());
}
