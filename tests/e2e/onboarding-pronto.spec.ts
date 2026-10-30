import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import {
  signInAs,
  skipReason,
  usersConfigured,
  type TestUserKey,
} from "../fixtures/auth";
import { SEED_HOME_A } from "../fixtures/invito";
import {
  createThrowawayUser,
  throwawayConfigured,
  throwawaySkipReason,
  type ThrowawayUser,
} from "../fixtures/throwaway-user";

// Onboarding step 5, "Pronto" (#15), written from the acceptance criteria
// before the page exists. A, B, B2 and C only read; tests that need other data
// use a throwaway user (U) prepared and cleaned up with the administrative
// client. Selectors use roles and the texts of the issue (with the decision of
// 30/10: "Invito condiviso con", not "Invito mandato a").

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const PATH = "/onboarding/pronto";
const TIP = "Prova a scrivere «spesa: latte e pane»";
const NEST_A = "Casa D'Angelo";
const NEST_B = "Casa Bianchi";
const A_NAMES = "Marco, Laura, Sofia, Tommaso, Biscotto";
const A_INITIALS = ["M", "L", "S", "T", "B"];
const A_COLORS = ["pomodoro", "glicine", "salvia", "cobalto", "zafferano"];

function needsUsers(...keys: TestUserKey[]) {
  test.skip(!usersConfigured(...keys), skipReason(...keys));
}
function needsThrowaway() {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
}

// ---------------------------------------------------------------- helpers

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SECRET_KEY as string,
    { auth: { persistSession: false } },
  );
}

/** Opens the page and waits for the main landmark and the heading (LEZIONI). */
async function openPage(page: Page) {
  const response = await page.goto(PATH);
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return response;
}

async function openAs(
  page: Page,
  baseURL: string | undefined,
  key: TestUserKey,
) {
  await signInAs(page.context(), baseURL as string, key);
  return openPage(page);
}

const summary = (page: Page) => page.getByRole("list").getByRole("listitem");
const goLink = (page: Page) => page.getByRole("link", { name: "Vai a Oggi" });
const avatars = (page: Page, names: string) =>
  page.getByRole("img", { name: names, exact: true });

async function expectAvatars(
  page: Page,
  names: string,
  initials: string[],
  colors?: string[],
) {
  const group = avatars(page, names);
  await expect(group).toBeVisible();
  const items = group.locator(".avatar");
  await expect(items).toHaveCount(initials.length);
  for (const [i, letter] of initials.entries()) {
    await expect(items.nth(i)).toHaveText(letter);
    if (colors) {
      await expect(items.nth(i)).toHaveClass(new RegExp(`membro-${colors[i]}`));
    }
  }
}

async function expectHeading(page: Page, nest: string) {
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toHaveCount(1);
  await expect(h1).toHaveAccessibleName(`${nest} è pronta.`);
  await expect(h1.locator("b")).toHaveText("è pronta.");
}

type NestContext = {
  user: ThrowawayUser;
  nest: string;
  householdId: string;
  addAdult: (name: string) => Promise<string>;
  invite: (
    memberId: string,
    status?: "pending" | "revoked" | "accepted",
  ) => Promise<void>;
};

/** Throwaway user with a Nest created the way step 1 creates it. */
async function withNest(body: (ctx: NestContext) => Promise<void>) {
  const user = await createThrowawayUser("Ilaria De Santis");
  try {
    const nest = "Casa di Ilaria";
    const { error } = await user.client.rpc("create_household", {
      name: nest,
      household_type: "single",
      member_name: "Ilaria",
      color: "pomodoro",
    });
    if (error) throw new Error("Creazione del Nest di prova fallita");
    const { data } = await user.client.rpc("current_household_id");
    const householdId = data as string;
    // Each member of a Nest has its own colour (Ilaria has pomodoro).
    const colors = [
      "glicine",
      "salvia",
      "cobalto",
      "zafferano",
      "lampone",
      "ceruleo",
      "peonia",
      "basilico",
      "cannella",
    ];
    let next = 0;
    const addAdult = async (name: string) => {
      const { data: row, error: insertError } = await user.admin
        .from("household_members")
        .insert({
          household_id: householdId,
          kind: "adult",
          name,
          color: colors[next++],
        })
        .select("id")
        .single();
      if (insertError || !row)
        throw new Error(`Membro di prova non aggiunto: ${name}`);
      return row.id as string;
    };
    const invite = async (
      memberId: string,
      status: "pending" | "revoked" | "accepted" = "pending",
    ) => {
      const { data: row, error: insertError } = await user.admin
        .from("invitations")
        .insert({ household_id: householdId, member_id: memberId })
        .select("id")
        .single();
      if (insertError || !row) throw new Error("Invito di prova non creato");
      if (status !== "pending") {
        const { error: updateError } = await user.admin
          .from("invitations")
          .update(
            status === "accepted"
              ? { status, accepted_at: new Date().toISOString() }
              : { status },
          )
          .eq("id", row.id);
        if (updateError) throw new Error("Invito di prova non aggiornato");
      }
    };
    await body({ user, nest, householdId, addAdult, invite });
  } finally {
    await user.remove();
  }
}

// ================================================================ content

test.describe("contenuto", () => {
  test.beforeEach(() => needsUsers("A"));

  test("CA-1 e CA-2: A vede titolo, avatar, due righe e il link «Vai a Oggi»", async ({
    page,
    baseURL,
  }) => {
    await openAs(page, baseURL, "A");
    await expectHeading(page, NEST_A);
    await expectAvatars(page, A_NAMES, A_INITIALS, A_COLORS);
    await expect(summary(page)).toHaveCount(2);
    await expect(summary(page).nth(0)).toHaveText("Invito condiviso con Laura");
    await expect(summary(page).nth(1)).toHaveText(TIP);
    await expect(goLink(page)).toHaveAttribute("href", "/oggi");
    await expect(page.getByRole("progressbar")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Indietro" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Indietro" })).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Navigazione principale" }),
    ).toHaveCount(0);
  });

  test("CA-3: con Tab solo «Vai a Oggi» riceve il fuoco", async ({
    page,
    baseURL,
  }) => {
    await openAs(page, baseURL, "A");
    const focusable = await page.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLElement>(
          'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]',
        ),
      ]
        .filter((el) => el.getClientRects().length > 0)
        .filter((el) => el.tabIndex >= 0)
        .map((el) => el.textContent?.trim()),
    );
    expect(focusable).toEqual(["Vai a Oggi"]);
    await page.keyboard.press("Tab");
    await expect(goLink(page)).toBeFocused();
    await expect(summary(page).getByRole("link")).toHaveCount(0);
  });

  test("CA-4: il clic su «Vai a Oggi» porta a /oggi senza scrivere nel database", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    const admin = adminClient();
    const snapshot = async () => {
      const { data: households } = await admin
        .from("households")
        .select("id, updated_at")
        .eq("id", SEED_HOME_A);
      const id = households?.[0]?.id as string;
      const { data: members } = await admin
        .from("household_members")
        .select("id, updated_at")
        .eq("household_id", id)
        .order("id");
      const { data: invitations } = await admin
        .from("invitations")
        .select("id, updated_at")
        .eq("household_id", id)
        .order("id");
      return { households, members, invitations };
    };
    const before = await snapshot();
    expect(before.members).toHaveLength(5);
    await openAs(page, baseURL, "A");
    await goLink(page).click();
    await expect(page).toHaveURL(/\/oggi$/);
    expect(await snapshot()).toEqual(before);
  });

  test("CA-4: con Tab e Invio si arriva a /oggi", async ({ page, baseURL }) => {
    await openAs(page, baseURL, "A");
    await page.keyboard.press("Tab");
    await expect(goLink(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/oggi$/);
  });

  test("CA-5: B, con invito scaduto, non vede righe sugli inviti", async ({
    page,
    baseURL,
  }) => {
    needsUsers("B");
    await openAs(page, baseURL, "B");
    await expectHeading(page, NEST_B);
    await expectAvatars(page, "Giulia, Paolo, Leo, Anna", ["G", "P", "L", "A"]);
    await expect(summary(page)).toHaveCount(1);
    await expect(summary(page).first()).toHaveText(TIP);
    await expect(summary(page).filter({ hasText: /Invit/ })).toHaveCount(0);
  });

  test("CA-11: A non vede la riga del calendario (provvisorio, #37)", async ({
    page,
    baseURL,
  }) => {
    await openAs(page, baseURL, "A");
    // Provisional: the calendar row arrives with #37 or #34.
    for (const text of ["impegni arrivati", "Outlook", "Google", "iCloud"]) {
      await expect(page.getByText(text)).toHaveCount(0);
    }
  });

  test("CA-23: titolo della scheda, Cache-Control privato, indirizzo senza parametri", async ({
    page,
    baseURL,
  }) => {
    const response = await openAs(page, baseURL, "A");
    await expect(page).toHaveTitle("FamilyNest · Pronto");
    expect(response?.headers()["cache-control"] ?? "").toMatch(
      /private|no-store/,
    );
    const url = new URL(page.url());
    expect(url.pathname).toBe(PATH);
    expect(url.search).toBe("");
  });
});

// ================================================================ throwaway data

test.describe("dati preparati dal test", () => {
  test.beforeEach(() => needsThrowaway());

  test("CA-6 (stato vuoto): Nest «Solo io» con un avatar e il solo consiglio", async ({
    page,
    baseURL,
  }) => {
    await withNest(async ({ user, nest }) => {
      await user.signInContext(page.context(), baseURL as string);
      await openPage(page);
      await expectHeading(page, nest);
      await expectAvatars(page, "Ilaria", ["I"]);
      await expect(summary(page)).toHaveCount(1);
      await expect(summary(page).first()).toHaveText(TIP);
      await expect(goLink(page)).toBeVisible();
    });
  });

  test("CA-7: due inviti validi danno una sola riga «Inviti condivisi con Laura e Carla»", async ({
    page,
    baseURL,
  }) => {
    await withNest(async ({ user, addAdult, invite }) => {
      await invite(await addAdult("Laura"));
      await invite(await addAdult("Carla"));
      await user.signInContext(page.context(), baseURL as string);
      await openPage(page);
      await expect(summary(page)).toHaveCount(2);
      await expect(summary(page).nth(0)).toHaveText(
        "Inviti condivisi con Laura e Carla",
      );
    });
  });

  test("CA-8: tre inviti validi danno «Inviti condivisi con 3 persone»", async ({
    page,
    baseURL,
  }) => {
    await withNest(async ({ user, addAdult, invite }) => {
      for (const name of ["Laura", "Carla", "Piero"]) {
        await invite(await addAdult(name));
      }
      await user.signInContext(page.context(), baseURL as string);
      await openPage(page);
      await expect(summary(page)).toHaveCount(2);
      await expect(summary(page).nth(0)).toHaveText(
        "Inviti condivisi con 3 persone",
      );
    });
  });

  test("CA-9: l'invito revocato non conta, resta «Invito condiviso con Carla»", async ({
    page,
    baseURL,
  }) => {
    await withNest(async ({ user, addAdult, invite }) => {
      await invite(await addAdult("Laura"), "revoked");
      await invite(await addAdult("Carla"));
      await user.signInContext(page.context(), baseURL as string);
      await openPage(page);
      await expect(summary(page)).toHaveCount(2);
      await expect(summary(page).nth(0)).toHaveText(
        "Invito condiviso con Carla",
      );
    });
  });

  test("CA-10: dopo l'accettazione dell'invito la riga sparisce", async ({
    page,
    baseURL,
  }) => {
    await withNest(async ({ user, addAdult, invite }) => {
      const laura = await addAdult("Laura");
      await invite(laura);
      await user.signInContext(page.context(), baseURL as string);
      await openPage(page);
      await expect(summary(page).nth(0)).toHaveText(
        "Invito condiviso con Laura",
      );
      const { error } = await user.admin
        .from("invitations")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("member_id", laura);
      expect(error).toBeNull();
      await page.reload();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(summary(page).filter({ hasText: /Invit/ })).toHaveCount(0);
    });
  });

  test("CA-12: con 10 membri l'immagine ha tutti i nomi e 10 avatar", async ({
    page,
    baseURL,
  }) => {
    await withNest(async ({ user, addAdult }) => {
      const names = ["Ilaria"];
      for (let i = 2; i <= 10; i++) {
        await addAdult(`M${i}`);
        names.push(`M${i}`);
      }
      await user.signInContext(page.context(), baseURL as string);
      await openPage(page);
      const group = avatars(page, names.join(", "));
      await expect(group).toBeVisible();
      await expect(group.locator(".avatar")).toHaveCount(10);
      // No sideways scroll, also with several rows of avatars on mobile.
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  });

  test("CA-20: da «Chi c'è nel Nest?» con «Solo io», «Continua» porta a /onboarding/pronto", async ({
    page,
    baseURL,
  }) => {
    await withNest(async ({ user }) => {
      await user.signInContext(page.context(), baseURL as string);
      await page.goto("/onboarding/persone");
      await expect(
        page.getByRole("heading", { level: 1, name: "Chi c'è nel Nest?" }),
      ).toBeVisible();
      const next = page
        .getByRole("button", { name: "Continua" })
        .filter({ visible: true });
      await expect(async () => {
        await next.click();
        await expect(page).toHaveURL(/\/onboarding\/pronto$/, {
          timeout: 1000,
        });
      }).toPass();
    });
  });

  // CA-21 and CA-22 hold when #14 (the Invito step) is on main.
  const invitoExists = existsSync("src/app/onboarding/invito/page.tsx");

  test("CA-21: da Invito, «Lo faccio dopo» (mobile) e «Ho finito» (desktop) portano a /onboarding/pronto", async ({
    page,
    baseURL,
  }) => {
    test.skip(!invitoExists, "Il passo Invito (#14) non è ancora su main");
    needsUsers("A");
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto("/onboarding/invito");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const mobile = test.info().project.name === "mobile";
    const button = page
      .getByRole("button", { name: mobile ? "Lo faccio dopo" : "Ho finito" })
      .filter({ visible: true });
    await expect(async () => {
      await button.click();
      await expect(page).toHaveURL(/\/onboarding\/pronto$/, { timeout: 1000 });
    }).toPass();
  });

  test("CA-22: Invito senza adulti da invitare porta a /onboarding/pronto, senza inviti", async ({
    page,
    baseURL,
  }) => {
    test.skip(!invitoExists, "Il passo Invito (#14) non è ancora su main");
    await withNest(async ({ user, householdId }) => {
      await user.signInContext(page.context(), baseURL as string);
      await page.goto("/onboarding/invito");
      await expect(page).toHaveURL(/\/onboarding\/pronto$/);
      const { count } = await user.admin
        .from("invitations")
        .select("id", { count: "exact", head: true })
        .eq("household_id", householdId);
      expect(count).toBe(0);
    });
  });
});

// ================================================================ access

test.describe("accesso alla pagina", () => {
  test("CA-13: senza sessione si arriva a /accesso", async ({ page }) => {
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/accesso/);
  });

  test("CA-14: C, senza Nest, arriva a /onboarding", async ({
    page,
    baseURL,
  }) => {
    needsUsers("C");
    await signInAs(page.context(), baseURL as string, "C");
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test("CA-15: B2, non amministratore, arriva a /oggi", async ({
    page,
    baseURL,
  }) => {
    needsUsers("B2");
    await signInAs(page.context(), baseURL as string, "B2");
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/oggi$/);
  });
});

// ================================================================ privacy

test.describe("isolamento e minimizzazione", () => {
  test("CA-16: B e A non vedono i dati dell'altro Nest", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A", "B");
    const check = async (key: TestUserKey, forbidden: string[]) => {
      await signInAs(page.context(), baseURL as string, key);
      await openPage(page);
      const text = await page.locator("body").innerText();
      const html = await (await page.request.get(PATH)).text();
      for (const word of forbidden) {
        expect(text, `testo (${key}): ${word}`).not.toContain(word);
        expect(html, `HTML (${key}): ${word}`).not.toContain(word);
      }
      await page.context().clearCookies();
    };
    await check("B", [
      NEST_A,
      "Marco",
      "Laura",
      "Sofia",
      "Tommaso",
      "Biscotto",
    ]);
    await check("A", [NEST_B, "Giulia", "Paolo", "Leo", "Anna"]);
  });

  test("CA-17: l'HTML di A non contiene date di nascita, token, codice breve né id dei membri", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    needsThrowaway();
    await openAs(page, baseURL, "A");
    const html = await (await page.request.get(PATH)).text();
    const admin = adminClient();
    const { data: nest } = await admin
      .from("households")
      .select("id")
      .eq("id", SEED_HOME_A)
      .single();
    const { data: members } = await admin
      .from("household_members")
      .select("id")
      .eq("household_id", nest!.id);
    const { data: invitations } = await admin
      .from("invitations")
      .select("token, short_code")
      .eq("household_id", nest!.id);
    expect(members).toHaveLength(5);
    const secrets = [
      "2016-12-14",
      "2020-04-02",
      ...members!.map((m) => m.id as string),
      ...invitations!.map((i) => i.token as string),
      ...invitations!.map((i) => i.short_code as string),
    ];
    expect(secrets).toContain("4821");
    for (const secret of secrets) expect(html).not.toContain(secret);
  });
});

// ================================================================ states

test.describe("stati di errore e di caricamento", () => {
  const page15 = () =>
    readFileSync("src/app/onboarding/pronto/page.tsx", "utf8");

  test("CA-18: la pagina rende OnboardingError se la lettura fallisce", () => {
    const source = page15();
    expect(source).toMatch(
      /import\s*\{[^}]*OnboardingError[^}]*\}\s*from\s*"@\/components\/onboarding\/OnboardingError"/,
    );
    expect(source).toMatch(/<OnboardingError/);
    expect(source).not.toMatch(/FrameError|ErrorMain/);
    expect(source).toContain("requireUser");
    // The Nest, member and invitation reads share one error check.
    expect(source).toMatch(
      /nest\.error\s*\|\|\s*members\.error\s*\|\|\s*invitations\.error/,
    );
    // The runtime check needs Supabase stopped after sign-in: done by hand.
  });

  test("CA-19: il caricamento è un fallback Suspense, senza loading.tsx", () => {
    const source = page15();
    expect(source).toMatch(/<Suspense[^>]*fallback=/);
    expect(existsSync("src/app/onboarding/pronto/loading.tsx")).toBe(false);
    expect(source).toMatch(/fallback=\{<ReadyLoading\s*\/>\}/);
    const screen = readFileSync(
      "src/components/onboarding/ReadyScreen.tsx",
      "utf8",
    );
    const loading = screen.slice(screen.indexOf("function LoadingBody"));
    expect(loading).not.toContain('href="/oggi"');
    const all = loading;
    expect(all).toContain("Stiamo preparando la casa");
    expect(all).toContain("Preparazione in corso");
  });
});
