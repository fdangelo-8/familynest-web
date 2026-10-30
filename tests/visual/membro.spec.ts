import { expect, test, type Page } from "@playwright/test";
import { hasTestUser, signInAs } from "../fixtures/visual-login";
import {
  throwawayConfigured,
  throwawaySkipReason,
  type ThrowawayUser,
} from "../fixtures/throwaway-user";
import {
  ANNA_B,
  BISCOTTO_A,
  FIXED_NOW,
  LAURA_A,
  PAOLO_B,
  baseURL,
  addMember,
  openMember,
  shoot,
  withLaura,
  withRita,
} from "../fixtures/membro-visuale";

// PR #131 (#18): references of the member page (/membri/<id>) at 390 and
// 1280 px. States: valid invitation, expired, "to invite", adult with account
// (switch off and on), not an administrator, pet, "Togli" dialog, loading,
// "Manda l'invito" in progress and failed, toasts.
// The whole-page error cannot be provoked from the browser (the database
// read happens on the server): checked by hand, no reference.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
});

type Key = "A" | "B" | "C";
async function signIn(page: Page, key: Key | "B2") {
  const ok = await signInAs(page.context(), baseURL(), key as Key);
  test.skip(!ok, `Utente di prova ${key} non disponibile`);
}

test.describe("utenti del seed", () => {
  test("#18: invito valido (Laura, vista di Marco)", async ({ page }) => {
    test.skip(!hasTestUser("A"), "Utente A non configurato");
    await signIn(page, "A");
    await openMember(page, LAURA_A, "Laura");
    await shoot(page, "membro-invito-valido.png");
  });

  test("#18: dialogo «Togli»", async ({ page }) => {
    test.skip(!hasTestUser("A"), "Utente A non configurato");
    await signIn(page, "A");
    await openMember(page, LAURA_A, "Laura");
    await page.getByRole("button", { name: "Togli Laura dal Nest" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await shoot(page, "membro-dialogo-togli.png", false);
  });

  test("#18: animale (Biscotto)", async ({ page }) => {
    test.skip(!hasTestUser("A"), "Utente A non configurato");
    await signIn(page, "A");
    await openMember(page, BISCOTTO_A, "Biscotto");
    await shoot(page, "membro-animale.png");
  });

  test("#18: invito scaduto (Anna, vista di Giulia)", async ({ page }) => {
    test.skip(!hasTestUser("B"), "Utente B non configurato");
    await signIn(page, "B");
    await openMember(page, ANNA_B, "Anna");
    await expect(page.getByText("Adulto · invito scaduto")).toBeVisible();
    await shoot(page, "membro-invito-scaduto.png");
  });

  test("#18: adulto con account (Paolo, vista di Giulia)", async ({ page }) => {
    test.skip(!hasTestUser("B"), "Utente B non configurato");
    await signIn(page, "B");
    await openMember(page, PAOLO_B, "Paolo");
    await shoot(page, "membro-adulto-con-account.png");
  });

  test("#18: non amministratore (Anna, vista di Paolo)", async ({ page }) => {
    test.skip(!hasTestUser("B2" as "A"), "Utente B2 non configurato");
    await signIn(page, "B2");
    await openMember(page, ANNA_B, "Anna");
    await expect(page.getByRole("switch")).toHaveCount(0);
    await shoot(page, "membro-non-amministratore.png");
  });

  test("#18: caricamento (scheletro)", async ({ page }) => {
    test.skip(!hasTestUser("A"), "Utente A non configurato");
    await signIn(page, "A");
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    // Only the real navigation is held; the prefetch of the link goes on.
    await page.route(/\/membri\//, async (route) => {
      if (!route.request().headers()["next-router-prefetch"]) await gate;
      await route.continue();
    });
    const prefetched = page.waitForResponse(
      (r) =>
        r.url().includes(`/membri/${LAURA_A}`) &&
        !!r.request().headers()["next-router-prefetch"],
    );
    await page.goto("/nest");
    await expect(page.getByRole("link", { name: /Laura/ })).toBeVisible();
    await page.waitForLoadState("load");
    await prefetched;
    await page.getByRole("link", { name: /Laura/ }).click();
    await expect(page.getByText("Caricamento in corso")).toBeAttached();
    await shoot(page, "membro-caricamento.png");
    release();
    await expect(
      page.getByRole("heading", { level: 1, name: "Laura" }),
    ).toBeVisible();
  });

  test("#18: toast, link condiviso", async ({ page }) => {
    test.skip(!hasTestUser("A"), "Utente A non configurato");
    await signIn(page, "A");
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        value: () => Promise.resolve(),
        configurable: true,
      });
    });
    await openMember(page, LAURA_A, "Laura");
    await page.getByRole("button", { name: /Manda di nuovo/ }).click();
    await expect(page.getByRole("status")).toContainText(
      "Invito mandato di nuovo a Laura.",
    );
    await shoot(page, "membro-toast-condiviso.png", false);
  });

  test("#18: toast, copia riuscita", async ({ page }) => {
    test.skip(!hasTestUser("A"), "Utente A non configurato");
    await signIn(page, "A");
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        value: undefined,
        configurable: true,
      });
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.resolve() },
        configurable: true,
      });
    });
    await openMember(page, LAURA_A, "Laura");
    await page.getByRole("button", { name: /Manda di nuovo/ }).click();
    await expect(page.getByRole("status")).toContainText("Link copiato.");
    await shoot(page, "membro-toast-copiato.png", false);
  });

  test("#18: toast, copia non riuscita (senza icona)", async ({ page }) => {
    test.skip(!hasTestUser("A"), "Utente A non configurato");
    await signIn(page, "A");
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        value: undefined,
        configurable: true,
      });
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.reject(new Error("no")) },
        configurable: true,
      });
    });
    await openMember(page, LAURA_A, "Laura");
    await page.getByRole("button", { name: /Manda di nuovo/ }).click();
    await expect(page.getByRole("status")).toContainText(
      "Non siamo riusciti a copiare il link. Riprova.",
    );
    await shoot(page, "membro-toast-copia-fallita.png", false);
  });
});

test.describe("#144: modifica nome e colore (utenti del seed)", () => {
  test("#144: foglio aperto, adulto senza account (Laura)", async ({
    page,
  }) => {
    test.skip(!hasTestUser("A"), "Utente A non configurato");
    await signIn(page, "A");
    await openMember(page, LAURA_A, "Laura");
    await page.getByRole("button", { name: "Modifica nome e colore" }).click();
    await expect(
      page.getByRole("dialog", { name: "Modifica Laura" }),
    ).toBeVisible();
    await shoot(page, "membro-modifica-foglio.png", false);
  });

  test("#144: foglio aperto, animale (Biscotto)", async ({ page }) => {
    test.skip(!hasTestUser("A"), "Utente A non configurato");
    await signIn(page, "A");
    await openMember(page, BISCOTTO_A, "Biscotto");
    await page.getByRole("button", { name: "Modifica nome e colore" }).click();
    await expect(
      page.getByRole("dialog", { name: "Modifica Biscotto" }),
    ).toBeVisible();
    await shoot(page, "membro-modifica-foglio-animale.png", false);
  });
});

test.describe("con utenti usa e getta", () => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);

  const cleanup: ThrowawayUser[] = [];
  test.afterEach(async () => {
    for (const u of cleanup.splice(0)) await u.remove();
  });

  test("#18: adulto da invitare (Laura)", async ({ page }) => {
    const { user } = await withLaura(page);
    cleanup.push(user);
    await openMember(page, (await laura(user)) ?? "", "Laura");
    await expect(page.getByText("Adulto · da invitare")).toBeVisible();
    await shoot(page, "membro-da-invitare.png");
  });

  test("#18: adulto con account, interruttore acceso (Rita)", async ({
    page,
  }) => {
    const { user, user2, ritaId } = await withRita(page);
    cleanup.push(user, user2);
    await openMember(page, ritaId, "Rita");
    await page.getByRole("switch", { name: "Amministratore" }).click();
    await expect(
      page.getByRole("switch", { name: "Amministratore" }),
    ).toHaveAttribute("aria-checked", "true");
    await shoot(page, "membro-ruolo-acceso.png");
  });

  test("#18: «Manda l'invito» in corso", async ({ page }) => {
    const { user } = await withLaura(page);
    cleanup.push(user);
    const id = (await laura(user)) ?? "";
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        value: () => Promise.resolve(),
        configurable: true,
      });
    });
    await openMember(page, id, "Laura");
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(/\/membri\//, async (route) => {
      if (route.request().method() === "POST") await gate;
      await route.continue();
    });
    await page.getByRole("button", { name: /Manda l'invito/ }).click();
    await expect(
      page.getByRole("button", { name: /Manda l'invito/ }),
    ).toHaveAttribute("aria-busy", "true");
    await shoot(page, "membro-invito-in-corso.png");
    release();
    await expect(
      page.getByRole("button", { name: /Manda di nuovo/ }),
    ).toBeVisible();
  });

  test("#18: «Manda l'invito» non riuscito (rete)", async ({ page }) => {
    const { user } = await withLaura(page);
    cleanup.push(user);
    await openMember(page, (await laura(user)) ?? "", "Laura");
    await page.route(/\/membri\//, async (route) => {
      if (route.request().method() === "POST") await route.abort();
      else await route.continue();
    });
    await page.getByRole("button", { name: /Manda l'invito/ }).click();
    await expect(page.locator('[role="alert"].avviso')).toContainText(
      "Non siamo riusciti a preparare l'invito. Controlla la connessione e riprova.",
    );
    await shoot(page, "membro-invito-errore.png");
  });

  test("#18: «Togli» non riuscito (rete)", async ({ page }) => {
    const { user } = await withLaura(page);
    cleanup.push(user);
    await openMember(page, (await laura(user)) ?? "", "Laura");
    await page.route(/\/membri\//, async (route) => {
      if (route.request().method() === "POST") await route.abort();
      else await route.continue();
    });
    await page.getByRole("button", { name: "Togli Laura dal Nest" }).click();
    await page
      .getByRole("button", { name: "Togli Laura", exact: true })
      .click();
    await expect(page.locator('[role="alert"].avviso')).toContainText(
      "Non siamo riusciti a togliere Laura. Controlla la connessione e riprova.",
    );
    await shoot(page, "membro-togli-errore.png");
  });
});

test.describe("#144: modifica nome e colore (utenti usa e getta)", () => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);

  const cleanup: ThrowawayUser[] = [];
  test.afterEach(async () => {
    for (const u of cleanup.splice(0)) await u.remove();
  });

  async function rename(page: Page, to: string) {
    await page.getByRole("button", { name: "Modifica nome e colore" }).click();
    const dialog = page.getByRole("dialog", { name: "Modifica Laura" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Nome").fill(to);
    await dialog.getByRole("button", { name: "Salva le modifiche" }).click();
    await expect(dialog).toBeHidden();
  }

  test("#144: toast «Modifiche salvate.» con «Annulla»", async ({ page }) => {
    const { user, lauraId } = await withLaura(page);
    cleanup.push(user);
    await openMember(page, lauraId, "Laura");
    await rename(page, "Lara");
    await expect(page.getByRole("status")).toContainText("Modifiche salvate.");
    await expect(
      page.getByRole("heading", { level: 1, name: "Lara" }),
    ).toBeVisible();
    await shoot(page, "membro-modifica-toast.png", false);
  });

  test("#144: toast «Annulla» non riuscito (senza icona)", async ({ page }) => {
    const { user, lauraId } = await withLaura(page);
    cleanup.push(user);
    await openMember(page, lauraId, "Laura");
    await rename(page, "Lara");
    await expect(page.getByRole("status")).toContainText("Modifiche salvate.");
    await page.route(/\/membri\//, async (route) => {
      if (route.request().method() === "POST") await route.abort();
      else await route.continue();
    });
    await page.getByRole("button", { name: "Annulla" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Non siamo riusciti ad annullare. Le modifiche sono rimaste.",
    );
    await shoot(page, "membro-modifica-toast-errore.png", false);
  });

  test("#144: foglio con colore già preso", async ({ page }) => {
    const { user, lauraId } = await withLaura(page);
    cleanup.push(user);
    await openMember(page, lauraId, "Laura");
    await page.getByRole("button", { name: "Modifica nome e colore" }).click();
    const dialog = page.getByRole("dialog", { name: "Modifica Laura" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("radio", { name: "Salvia", exact: true }).click();
    // Someone else takes Salvia while the sheet is open.
    await addMember(user, { name: "Marta", kind: "adult" });
    await dialog.getByRole("button", { name: "Salva le modifiche" }).click();
    await expect(dialog).toContainText(
      "Questo colore l'ha appena preso qualcun altro: scegline un altro.",
    );
    await shoot(page, "membro-modifica-colore-preso.png", false);
  });
});

/** Id of Laura in the Nest of a throwaway user. */
async function laura(user: ThrowawayUser): Promise<string | null> {
  const { data } = await user.client
    .from("household_members")
    .select("id")
    .eq("name", "Laura")
    .single();
  return data?.id ?? null;
}
