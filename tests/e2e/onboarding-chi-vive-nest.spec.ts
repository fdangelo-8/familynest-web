import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page, type Route } from "@playwright/test";
import {
  signInAs,
  skipReason,
  usersConfigured,
  type TestUserKey,
} from "../fixtures/auth";
import {
  createThrowawayUser,
  throwawayConfigured,
  throwawaySkipReason,
  type ThrowawayUser,
} from "../fixtures/throwaway-user";

// Onboarding step 1 (#12): the cases that need a throwaway user (CA-9 ... CA-19,
// CA-21) and the checks on the database of the seeded users (CA-2, CA-21).
// Every test that presses "Continua" or "Indietro" uses its own throwaway user
// (marked app_metadata.familynest_test_user, deleted at the end), never C.

const QUESTION = "Chi vive con te?";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

type Answer =
  "Solo io" | "In coppia" | "In famiglia, con figli" | "Con coinquilini";

/** Runs `body` with a throwaway user and always deletes it. */
async function withUser(
  fullName: string | null,
  body: (user: ThrowawayUser) => Promise<void>,
) {
  const user = await createThrowawayUser(fullName);
  try {
    await body(user);
  } finally {
    await user.remove();
  }
}

async function openAs(
  page: Page,
  user: ThrowawayUser,
  baseURL: string | undefined,
  width = 390,
) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
  await user.signInContext(page.context(), baseURL as string);
  await page.goto("/onboarding");
  await expect(page.getByRole("radiogroup", { name: QUESTION })).toBeVisible();
}

/** Clicks an answer, retrying until the page is hydrated. */
async function choose(page: Page, answer: Answer) {
  const radio = page.getByRole("radio", { name: answer });
  await expect(async () => {
    await radio.click();
    await expect(radio).toHaveAttribute("aria-checked", "true", {
      timeout: 1000,
    });
  }).toPass();
}

const continua = (page: Page) => page.getByRole("button", { name: "Continua" });

/** The server action POST of the page (the Next.js route announcer is not it). */
function isSave(route: Route) {
  const request = route.request();
  return request.method() === "POST" && !!request.headers()["next-action"];
}

/**
 * Records, from the first paint to the end of the test, every moment in which
 * our error notice is in the DOM (the Next.js route announcer is also an
 * alert, so only the text of our notice counts).
 */
async function watchErrorNotice(page: Page) {
  const seen: string[] = [];
  await page.exposeFunction("reportErrorNotice", (text: string) => {
    seen.push(text);
  });
  await page.addInitScript(() => {
    const check = () => {
      for (const el of document.querySelectorAll('[role="alert"]')) {
        const text = el.textContent ?? "";
        if (text.includes("Non siamo riusciti")) {
          (
            window as unknown as {
              reportErrorNotice: (t: string) => void;
            }
          ).reportErrorNotice(text);
        }
      }
    };
    new MutationObserver(check).observe(document, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
  });
  return seen;
}

type Nest = {
  name: string;
  household_type: string;
  household_members: {
    name: string;
    color: string;
    is_admin: boolean;
    kind: string;
    user_id: string | null;
  }[];
};

async function readNests(client: SupabaseClient): Promise<Nest[]> {
  const { data, error } = await client
    .from("households")
    .select(
      "name, household_type, household_members(name, color, is_admin, kind, user_id)",
    );
  if (error) throw new Error("Lettura dei Nest fallita");
  return data as Nest[];
}

test.describe("creazione del Nest", () => {
  test.beforeEach(() => {
    test.skip(!throwawayConfigured(), throwawaySkipReason);
  });

  test("CA-9: Continua crea il Nest e porta a /onboarding/persone, senza avvisi durante l'attesa", async ({
    page,
    baseURL,
  }) => {
    await withUser("Ilaria De Santis", async (user) => {
      const notices = await watchErrorNotice(page);
      await openAs(page, user, baseURL);
      await choose(page, "In famiglia, con figli");
      await continua(page).click();
      await expect(page).toHaveURL(/\/onboarding\/persone$/);
      // The page was watched from the first paint to the arrival on /onboarding/persone.
      expect(notices).toEqual([]);

      const nests = await readNests(user.client);
      expect(nests).toHaveLength(1);
      expect(nests[0]!.name).toBe("Casa De Santis");
      expect(nests[0]!.household_type).toBe("family_with_children");
      expect(nests[0]!.household_members).toHaveLength(1);
      expect(nests[0]!.household_members[0]).toEqual({
        name: "Ilaria",
        color: "pomodoro",
        is_admin: true,
        kind: "adult",
        user_id: user.id,
      });
    });
  });

  const TYPES: [Answer, string][] = [
    ["Solo io", "single"],
    ["In coppia", "couple"],
    ["In famiglia, con figli", "family_with_children"],
    ["Con coinquilini", "roommates"],
  ];
  for (const [answer, type] of TYPES) {
    test(`CA-10: «${answer}» salva il tipo ${type}`, async ({
      page,
      baseURL,
    }) => {
      await withUser("Ilaria De Santis", async (user) => {
        await openAs(page, user, baseURL);
        await choose(page, answer);
        await continua(page).click();
        await expect(page).toHaveURL(/\/onboarding\/persone$/);
        const nests = await readNests(user.client);
        expect(nests.map((n) => n.household_type)).toEqual([type]);
      });
    });
  }

  test("CA-11: nome di una sola parola, «Casa di Ilaria»", async ({
    page,
    baseURL,
  }) => {
    await withUser("Ilaria", async (user) => {
      await openAs(page, user, baseURL);
      await expect(
        page.locator("main .intestazione__sopra:visible"),
      ).toHaveText("Ciao Ilaria");
      await choose(page, "Solo io");
      await continua(page).click();
      await expect(page).toHaveURL(/\/onboarding\/persone$/);
      const nests = await readNests(user.client);
      expect(nests).toHaveLength(1);
      expect(nests[0]!.name).toBe("Casa di Ilaria");
      expect(nests[0]!.household_members.map((m) => m.name)).toEqual([
        "Ilaria",
      ]);
    });
  });

  test("CA-12: senza nome nell'account: saluto «Ciao», «Casa mia», «Io»", async ({
    page,
    baseURL,
  }) => {
    await withUser(null, async (user) => {
      await openAs(page, user, baseURL);
      const greeting = page.locator("main .intestazione__sopra:visible");
      await expect(greeting).toHaveText("Ciao");
      await choose(page, "Solo io");
      await continua(page).click();
      await expect(page).toHaveURL(/\/onboarding\/persone$/);
      const nests = await readNests(user.client);
      expect(nests).toHaveLength(1);
      expect(nests[0]!.name).toBe("Casa mia");
      expect(nests[0]!.household_members.map((m) => m.name)).toEqual(["Io"]);
    });
  });

  test("CA-13: nomi molto lunghi tagliati a 40 e 60 caratteri", async ({
    page,
    baseURL,
  }) => {
    await // The account name is cut to 100 characters by the sign-up trigger
    // (profiles.display_name), so 45 + 70 letters cannot reach the app: a first
    // word of 41 letters and a surname of 58 give the same two cuts (40, 60).
    await withUser(`${"a".repeat(41)} ${"b".repeat(58)}`, async (user) => {
      await openAs(page, user, baseURL);
      await choose(page, "In coppia");
      await continua(page).click();
      await expect(page).toHaveURL(/\/onboarding\/persone$/);
      const nests = await readNests(user.client);
      expect(nests).toHaveLength(1);
      expect(nests[0]!.name).toHaveLength(60);
      expect(nests[0]!.name.startsWith("Casa b")).toBe(true);
      expect(nests[0]!.household_members.map((m) => m.name)).toEqual([
        "a".repeat(40),
      ]);
    });
  });

  test("CA-14: l'HTML dal server non contiene mail né id dell'utente", async ({
    page,
    baseURL,
  }) => {
    await withUser("Ilaria De Santis", async (user) => {
      await openAs(page, user, baseURL);
      // Same cookies as the browser: this is what the server sends.
      const response = await page.request.get("/onboarding");
      expect(response.status()).toBe(200);
      const html = await response.text();
      expect(html).toContain("Ciao Ilaria");
      expect(html.toLowerCase()).not.toContain(user.email.toLowerCase());
      expect(html.toLowerCase()).not.toContain(user.id.toLowerCase());
    });
  });

  test("CA-15: caricamento: un solo invio, scelta bloccata, poi /onboarding/persone", async ({
    page,
    baseURL,
  }) => {
    await withUser("Ilaria De Santis", async (user) => {
      const notices = await watchErrorNotice(page);
      await openAs(page, user, baseURL);
      let saves = 0;
      await page.route("**/onboarding", async (route) => {
        if (!isSave(route)) return route.continue();
        saves += 1;
        // The server answer arrives 2 seconds late.
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await route.continue();
      });
      await choose(page, "Solo io");
      await continua(page).click();
      await expect(continua(page)).toHaveAttribute("aria-busy", "true");
      // Second click and another answer while waiting: no effect.
      await continua(page).click({ force: true });
      await page
        .getByRole("radio", { name: "In coppia" })
        .click({ force: true });
      await expect(
        page.getByRole("radio", { name: "Solo io" }),
      ).toHaveAttribute("aria-checked", "true");
      await expect(
        page.getByRole("radio", { name: "In coppia" }),
      ).toHaveAttribute("aria-checked", "false");
      await expect(continua(page)).toHaveAttribute("aria-busy", "true");
      await expect(page).toHaveURL(/\/onboarding\/persone$/);
      expect(saves).toBe(1);
      expect(notices).toEqual([]);
      const nests = await readNests(user.client);
      expect(nests).toHaveLength(1);
      expect(nests[0]!.household_type).toBe("single");
    });
  });

  test("CA-16: errore di rete: avviso con «Riprova», poi riesce", async ({
    page,
    baseURL,
  }) => {
    await withUser("Ilaria De Santis", async (user) => {
      await openAs(page, user, baseURL);
      await page.route("**/onboarding", (route) =>
        isSave(route) ? route.abort() : route.continue(),
      );
      await choose(page, "In coppia");
      await continua(page).click();
      const notice = page
        .getByRole("alert")
        .filter({ hasText: "Non siamo riusciti" });
      await expect(notice).toBeVisible();
      await expect(
        notice.getByRole("button", { name: "Riprova" }),
      ).toBeVisible();
      await expect(page).toHaveURL(/\/onboarding$/);
      await expect(
        page.getByRole("radio", { name: "In coppia" }),
      ).toHaveAttribute("aria-checked", "true");
      await expect(continua(page)).toBeEnabled();
      await expect(continua(page)).not.toHaveAttribute("aria-busy", "true");
      expect(await user.nestCount()).toBe(0);

      await page.unroute("**/onboarding");
      await notice.getByRole("button", { name: "Riprova" }).click();
      await expect(page).toHaveURL(/\/onboarding\/persone$/);
      const nests = await readNests(user.client);
      expect(nests.map((n) => n.household_type)).toEqual(["couple"]);
    });
  });

  test("CA-17: due schede: la seconda va a /oggi senza avviso", async ({
    page,
    baseURL,
  }) => {
    await withUser("Ilaria De Santis", async (user) => {
      await openAs(page, user, baseURL);
      const second = await page.context().newPage();
      const notices = await watchErrorNotice(second);
      await second.setViewportSize({ width: 390, height: 844 });
      await second.goto("/onboarding");
      await expect(
        second.getByRole("radiogroup", { name: QUESTION }),
      ).toBeVisible();

      await choose(page, "Solo io");
      await continua(page).click();
      await expect(page).toHaveURL(/\/onboarding\/persone$/);

      await choose(second, "Con coinquilini");
      await continua(second).click();
      await expect(second).toHaveURL(/\/oggi$/);
      expect(notices).toEqual([]);

      const nests = await readNests(user.client);
      expect(nests).toHaveLength(1);
      expect(nests[0]!.household_type).toBe("single");
    });
  });

  for (const [id, width] of [
    ["CA-18", 390],
    ["CA-19", 1280],
  ] as const) {
    test(`${id}: «Indietro» a ${width} px chiude la sessione e porta a /accesso`, async ({
      page,
      baseURL,
    }) => {
      await withUser("Ilaria De Santis", async (user) => {
        await openAs(page, user, baseURL, width);
        // On mobile it is the arrow button; on desktop the text link next to
        // "Continua" (a form button styled as a link, because it must POST).
        const back = page
          .getByRole("button", { name: "Indietro" })
          .or(page.getByRole("link", { name: "Indietro" }));
        await expect(back).toHaveCount(1);
        await expect(async () => {
          await back.click();
          await expect(page).toHaveURL(/\/accesso$/, { timeout: 2000 });
        }).toPass();
        await expect(
          page.getByRole("button", { name: "Continua con Google" }),
        ).toBeVisible();
        await page.goto("/onboarding");
        await expect(page).toHaveURL(/\/accesso$/);
        expect(await user.nestCount()).toBe(0);
      });
    });
  }
});

// CA-2 and CA-21 read the seeded Nests with the clients of the test users.
async function clientFor(key: TestUserKey): Promise<SupabaseClient> {
  const client = createClient(supabaseUrl!, publishableKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: process.env[`TEST_USER_${key}_EMAIL`] ?? "",
    password: process.env[`TEST_USER_${key}_PASSWORD`] ?? "",
  });
  if (error) throw new Error(`Accesso di prova fallito per ${key}`);
  return client;
}

test("CA-2: A ha già un Nest: /oggi, e Casa D'Angelo resta identica", async ({
  page,
  baseURL,
}) => {
  test.skip(!usersConfigured("A"), skipReason("A"));
  await signInAs(page.context(), baseURL as string, "A");
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/oggi$/);
  const nests = await readNests(await clientFor("A"));
  expect(nests).toHaveLength(1);
  expect(nests[0]!.name).toBe("Casa D'Angelo");
  expect(nests[0]!.household_type).toBe("family_with_children");
  expect(nests[0]!.household_members).toHaveLength(5);
});

test("CA-21: isolamento: A e U vedono solo il proprio Nest", async ({
  page,
  baseURL,
}) => {
  test.skip(!usersConfigured("A", "B"), skipReason("A", "B"));
  test.skip(!throwawayConfigured(), throwawaySkipReason);
  await withUser("Ilaria De Santis", async (user) => {
    await openAs(page, user, baseURL);
    await choose(page, "In famiglia, con figli");
    await continua(page).click();
    await expect(page).toHaveURL(/\/oggi$/);

    const asA = await readNests(await clientFor("A"));
    expect(asA.map((n) => n.name)).toEqual(["Casa D'Angelo"]);
    expect(asA[0]!.household_members).toHaveLength(5);

    const asU = await readNests(user.client);
    expect(asU.map((n) => n.name)).toEqual(["Casa De Santis"]);
    expect(asU[0]!.household_members).toHaveLength(1);

    // The members table on its own, as the policies see it.
    const { data: membersA } = await (
      await clientFor("A")
    )
      .from("household_members")
      .select("user_id");
    expect(membersA).toHaveLength(5);
    expect(membersA!.some((m) => m.user_id === user.id)).toBe(false);
    const { data: membersU } = await user.client
      .from("household_members")
      .select("user_id");
    expect(membersU).toEqual([{ user_id: user.id }]);
  });
});

// Corrections of #69 (CA-2, CA-9, CA-13 of that issue; the names carry the
// issue number because #12 already has criteria with the same codes).
test.describe("correzioni #69: «Solo io»", () => {
  const bar = (page: Page, total: 3 | 4) =>
    page.getByRole("progressbar", { name: `Passo 1 di ${total}` });

  test("#69 CA-2: «Solo io» crea «Casa De Santis» di tipo single con il solo membro «Ilaria»", async ({
    page,
    baseURL,
  }) => {
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    await withUser("Ilaria De Santis", async (user) => {
      await openAs(page, user, baseURL, 390);
      await choose(page, "Solo io");
      await continua(page).click();
      await expect(page).toHaveURL(/\/onboarding\/persone$/);
      const nests = await readNests(user.client);
      expect(nests).toHaveLength(1);
      expect(nests[0]!.name).toBe("Casa De Santis");
      expect(nests[0]!.household_type).toBe("single");
      expect(nests[0]!.household_members).toHaveLength(1);
      expect(nests[0]!.household_members[0]!.name).toBe("Ilaria");
    });
  });

  test("#69 CA-9: durante l'invio e dopo l'errore la barra resta «Passo 1 di 3»", async ({
    page,
    baseURL,
  }) => {
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    await withUser("Ilaria De Santis", async (user) => {
      await openAs(page, user, baseURL, 390);
      await page.route("**/onboarding", async (route) => {
        if (!isSave(route)) return route.continue();
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await route.abort();
      });
      await choose(page, "Solo io");
      await continua(page).click();
      await expect(continua(page)).toHaveAttribute("aria-busy", "true");
      await expect(bar(page, 3)).toBeVisible();
      await expect(bar(page, 4)).toHaveCount(0);

      const notice = page
        .getByRole("alert")
        .filter({ hasText: "Non siamo riusciti" });
      await expect(notice).toBeVisible();
      await expect(
        notice.getByRole("button", { name: "Riprova" }),
      ).toBeVisible();
      await expect(
        page.getByRole("radio", { name: "Solo io" }),
      ).toHaveAttribute("aria-checked", "true");
      await expect(bar(page, 3)).toBeVisible();
      await expect(bar(page, 3)).toHaveAttribute("aria-valuemax", "3");
      await expect(bar(page, 4)).toHaveCount(0);
      await expect(page).toHaveURL(/\/onboarding$/);
      expect(await user.nestCount()).toBe(0);
    });
  });

  test("#69 CA-13: isolamento: il Nest creato con «Solo io» è visibile solo a U", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("A"), skipReason("A"));
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    await withUser("Ilaria De Santis", async (user) => {
      await openAs(page, user, baseURL, 390);
      await choose(page, "Solo io");
      await continua(page).click();
      await expect(page).toHaveURL(/\/onboarding\/persone$/);

      const clientA = await clientFor("A");
      const asA = await readNests(clientA);
      expect(asA.map((n) => n.name)).toEqual(["Casa D'Angelo"]);
      expect(asA[0]!.household_members).toHaveLength(5);
      const { data: membersA } = await clientA
        .from("household_members")
        .select("user_id");
      expect(membersA).toHaveLength(5);
      expect(membersA!.some((m) => m.user_id === user.id)).toBe(false);

      const asU = await readNests(user.client);
      expect(asU.map((n) => n.name)).toEqual(["Casa De Santis"]);
      expect(asU[0]!.household_type).toBe("single");
      expect(asU[0]!.household_members).toHaveLength(1);
      const { data: membersU } = await user.client
        .from("household_members")
        .select("user_id");
      expect(membersU).toEqual([{ user_id: user.id }]);
    });
  });
});
