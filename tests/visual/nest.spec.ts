import { expect, test, type Page } from "@playwright/test";
import { hasTestUser, signInAs } from "../fixtures/visual-login";
import {
  createThrowawayUser,
  throwawayConfigured,
  throwawaySkipReason,
  type ThrowawayUser,
} from "../fixtures/throwaway-user";

// PR #103 (#17): references of "Il tuo Nest" (/nest) at 390 and 1280 px.
// States: administrator and non-administrator views, pending / expired /
// "to invite" invitations, only-you Nest, full Nest, the "Invita qualcuno"
// sheet (open, empty name, saving, colour taken, network down, full at save)
// and the loading skeleton.
//
// The server renders the ages ("9 anni") from the real clock, which the
// browser clock cannot change: freezeAges() pins them, so the references
// do not change when someone has a birthday.
// The whole-page error cannot be provoked from the browser (the database
// read happens on the server): it is checked by hand, no reference.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

const FIXED_NOW = new Date("2026-10-29T12:00:00+01:00");
const AGES: Record<string, string> = {
  Sofia: "Figlio o figlia, 9 anni",
  Tommaso: "Figlio o figlia, 6 anni",
  Leo: "Figlio o figlia, 7 anni",
};
// Typed as "A" only because the shared helper lists three users; it reads
// the TEST_USER_<key>_* variables, so B2 works at runtime.
const B2 = "B2" as unknown as "A";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
});

/**
 * Opens /nest and waits for the real page (not the loading skeleton) and for
 * React to take over: a click before hydration does nothing. A slow database
 * read shows the page error once: the load is retried.
 */
async function openNest(page: Page, heading: string) {
  await expect(async () => {
    await page.goto("/nest");
    await expect(
      page.getByRole("heading", { level: 1, name: heading }),
    ).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("load");
  await freezeAges(page);
}

async function freezeAges(page: Page) {
  const ages = await page.evaluate((fixed) => {
    const seen: string[] = [];
    for (const row of document.querySelectorAll("ul[aria-label] li")) {
      const title = row.querySelector(".riga-lista__titolo")?.textContent ?? "";
      const info = row.querySelector(".riga-lista__info");
      if (info && fixed[title] && /, \d+ anni?$/.test(info.textContent ?? "")) {
        seen.push(info.textContent ?? "");
        info.textContent = fixed[title]!;
      }
    }
    return seen;
  }, AGES);
  return ages;
}

async function signIn(page: Page, key: "A" | "B" | "C") {
  const ok = await signInAs(
    page.context(),
    test.info().project.use.baseURL ?? "http://localhost:3000",
    key,
  );
  test.skip(!ok, `Utente di prova ${key} non disponibile`);
}

async function shoot(page: Page, name: string, fullPage = true) {
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot(name, { fullPage });
}

test("#17: amministratore (Marco), con inviti in attesa", async ({ page }) => {
  test.skip(!hasTestUser("A"), "Utente A non configurato");
  await signIn(page, "A");
  await openNest(page, "Casa D'Angelo");
  await expect(page.getByText("Adulto · invito in attesa")).toBeVisible();
  await shoot(page, "nest-amministratore.png");
});

test("#17: amministratrice con invito scaduto (Giulia)", async ({ page }) => {
  test.skip(!hasTestUser("B"), "Utente B non configurato");
  await signIn(page, "B");
  await openNest(page, "Casa Bianchi");
  await expect(page.getByText("Adulto · invito scaduto")).toBeVisible();
  await shoot(page, "nest-invito-scaduto.png");
});

test("#17: non amministratore (Paolo)", async ({ page }) => {
  test.skip(!hasTestUser(B2), "Utente B2 non configurato");
  await signIn(page, B2);
  await openNest(page, "Casa Bianchi");
  await expect(page.getByText("Invita qualcuno")).toHaveCount(0);
  await shoot(page, "nest-non-amministratore.png");
});

// --- throwaway user with a Nest ------------------------------------------

const COLORS = [
  "pomodoro",
  "glicine",
  "salvia",
  "cobalto",
  "zafferano",
  "lampone",
  "ceruleo",
  "peonia",
  "basilico",
  "cannella",
] as const;

async function userWithNest(
  page: Page,
  type: "single" | "family_with_children" = "family_with_children",
): Promise<ThrowawayUser> {
  const user = await createThrowawayUser("Ilaria De Santis");
  const { error } = await user.client.rpc("create_household", {
    name: "Casa De Santis",
    household_type: type,
    member_name: "Ilaria",
    color: "pomodoro",
  });
  if (error) {
    await user.remove();
    throw new Error("Nest di prova non creato");
  }
  await user.signInContext(
    page.context(),
    test.info().project.use.baseURL ?? "http://localhost:3000",
  );
  return user;
}

async function addMembers(
  user: ThrowawayUser,
  members: Array<{ name: string; kind: "adult" | "child" | "pet" }>,
) {
  const { data: householdId } = await user.client.rpc("current_household_id");
  const { data: used } = await user.client
    .from("household_members")
    .select("color");
  const taken = new Set((used ?? []).map((m) => m.color));
  const free = COLORS.filter((c) => !taken.has(c));
  for (const [i, m] of members.entries()) {
    const { error } = await user.client.from("household_members").insert({
      household_id: householdId as string,
      kind: m.kind,
      name: m.name,
      color: free[i]!,
    });
    if (error) throw new Error("Membro di prova non aggiunto");
  }
}

test.describe("con un utente usa e getta", () => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);

  let user: ThrowawayUser | null = null;
  test.afterEach(async () => {
    await user?.remove();
    user = null;
  });

  test("#17: solo tu (Nest «Solo io»)", async ({ page }) => {
    user = await userWithNest(page, "single");
    await openNest(page, "Casa De Santis");
    await expect(
      page.getByRole("listitem").filter({ hasText: "tu" }),
    ).toHaveCount(1);
    await shoot(page, "nest-solo-tu.png");
  });

  test("#17: adulto da invitare", async ({ page }) => {
    user = await userWithNest(page);
    await addMembers(user, [{ name: "Laura", kind: "adult" }]);
    await openNest(page, "Casa De Santis");
    await expect(page.getByText("Adulto · da invitare")).toBeVisible();
    await shoot(page, "nest-da-invitare.png");
  });

  test("#17: Nest al completo, bottone spento e messaggio", async ({
    page,
  }) => {
    user = await userWithNest(page);
    await addMembers(user, [
      { name: "Laura", kind: "adult" },
      { name: "Sofia", kind: "child" },
      { name: "Tommaso", kind: "child" },
      { name: "Biscotto", kind: "pet" },
      { name: "Nonna", kind: "adult" },
      { name: "Zio", kind: "adult" },
      { name: "Micio", kind: "pet" },
      { name: "Anna", kind: "adult" },
      { name: "Piero", kind: "adult" },
    ]);
    await openNest(page, "Casa De Santis");
    await expect(
      page.getByRole("button", { name: "Invita qualcuno" }),
    ).toBeDisabled();
    await expect(
      page.getByText("Il Nest è al completo: ci stanno al massimo 10"),
    ).toBeVisible();
    await shoot(page, "nest-al-completo.png");
  });

  // --- the sheet ----------------------------------------------------------

  async function openSheet(page: Page) {
    await openNest(page, "Casa De Santis");
    const dialog = page.getByRole("dialog", { name: "Invita qualcuno" });
    await expect(async () => {
      if (!(await dialog.isVisible())) {
        await page.getByRole("button", { name: "Invita qualcuno" }).click();
      }
      await expect(dialog).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 30_000 });
    await expect(dialog.getByLabel("Nome")).toBeFocused();
    return dialog;
  }

  test("#17: foglio «Invita qualcuno», aperto", async ({ page }) => {
    user = await userWithNest(page);
    await addMembers(user, [{ name: "Laura", kind: "adult" }]);
    await openSheet(page);
    await shoot(page, "nest-foglio-aperto.png", false);
  });

  test("#17: foglio, nome vuoto", async ({ page }) => {
    user = await userWithNest(page);
    const dialog = await openSheet(page);
    await dialog.getByRole("button", { name: "Continua" }).click();
    await expect(
      dialog.getByText("Scrivi il nome per continuare."),
    ).toBeVisible();
    await shoot(page, "nest-foglio-nome-vuoto.png", false);
  });

  test("#17: foglio, salvataggio in corso", async ({ page }) => {
    user = await userWithNest(page);
    const dialog = await openSheet(page);
    await dialog.getByLabel("Nome").fill("Rita");
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/nest", async (route) => {
      if (route.request().method() === "POST") await gate;
      await route.continue();
    });
    await dialog.getByRole("button", { name: "Continua" }).click();
    await expect(
      dialog.getByRole("button", { name: "Continua" }),
    ).toHaveAttribute("aria-busy", "true");
    await shoot(page, "nest-foglio-salvataggio.png", false);
    release();
    await expect(dialog).toBeHidden();
  });

  test("#17: foglio, colore preso nel frattempo", async ({ page }) => {
    user = await userWithNest(page);
    const dialog = await openSheet(page);
    await dialog.getByLabel("Nome").fill("Rita");
    await dialog.getByRole("radio", { name: "Glicine" }).click();
    await addMembers(user!, [{ name: "Rubata", kind: "child" }]);
    await dialog.getByRole("button", { name: "Continua" }).click();
    await expect(dialog.getByText("appena preso qualcun altro")).toBeVisible();
    await shoot(page, "nest-foglio-colore-preso.png", false);
  });

  test("#17: foglio, rete non raggiungibile", async ({ page }) => {
    user = await userWithNest(page);
    const dialog = await openSheet(page);
    await dialog.getByLabel("Nome").fill("Rita");
    await page.route("**/nest", async (route) => {
      if (route.request().method() === "POST") await route.abort();
      else await route.continue();
    });
    await dialog.getByRole("button", { name: "Continua" }).click();
    await expect(
      dialog.getByText(
        "Non siamo riusciti a salvare. Controlla la connessione",
      ),
    ).toBeVisible();
    await shoot(page, "nest-foglio-rete.png", false);
  });

  test("#17: foglio, Nest al completo al salvataggio", async ({ page }) => {
    user = await userWithNest(page);
    await addMembers(user, [
      { name: "Laura", kind: "adult" },
      { name: "Sofia", kind: "child" },
      { name: "Tommaso", kind: "child" },
      { name: "Biscotto", kind: "pet" },
      { name: "Nonna", kind: "adult" },
      { name: "Zio", kind: "adult" },
      { name: "Micio", kind: "pet" },
      { name: "Anna", kind: "adult" },
    ]);
    const dialog = await openSheet(page);
    await dialog.getByLabel("Nome").fill("Rita");
    const { data: householdId } = await user.client.rpc("current_household_id");
    const { error } = await user.client.from("household_members").insert({
      household_id: householdId as string,
      kind: "adult",
      name: "Ultimo",
      color: "cannella",
    });
    expect(error).toBeNull();
    await dialog.getByRole("button", { name: "Continua" }).click();
    await expect(
      dialog.getByRole("alert").getByText("Il Nest è al completo"),
    ).toBeVisible();
    await shoot(page, "nest-foglio-completo.png", false);
  });

  test("#17: dopo il salvataggio, la riga nuova in fondo", async ({ page }) => {
    user = await userWithNest(page);
    const dialog = await openSheet(page);
    await dialog.getByLabel("Nome").fill("Rita");
    await dialog.getByRole("button", { name: "Continua" }).click();
    // Since #18 «Continua» opens the page of the new adult (CA-40 of #18);
    // the list with the new row is shown by opening /nest again.
    await expect(page).toHaveURL(/\/membri\/[0-9a-f-]{36}$/);
    await openNest(page, "Casa De Santis");
    await expect(page.getByText("Adulto · da invitare")).toBeVisible();
    await shoot(page, "nest-salvato.png");
  });

  test("#17: caricamento", async ({ page }) => {
    user = await userWithNest(page);
    await page.goto("/oggi");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(/\/nest\?_rsc=/, async (route) => {
      await gate;
      await route.continue();
    });
    await page.getByRole("link", { name: /^Apri Casa De Santis/ }).click();
    await expect(page.getByText("Caricamento in corso")).toBeAttached();
    await shoot(page, "nest-caricamento.png", false);
    release();
    await expect(
      page.getByRole("heading", { level: 1, name: "Casa De Santis" }),
    ).toBeVisible();
  });
});
