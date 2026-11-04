import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "../fixtures/auth";
import {
  IDS,
  LOAD_ERROR,
  PAGE_TITLE,
  PATH,
  adminClient,
  colorGroup,
  colorRadio,
  h1,
  infoOf,
  isMobile,
  mainOf,
  needsThrowaway,
  needsUsers,
  profileOf,
  rowOf,
  subtitle,
  valueOf,
  withMemberNest,
} from "../fixtures/profilo";
import { createThrowawayUser } from "../fixtures/throwaway-user";

// "Il tuo profilo" (#38, /profilo): access, frame, head, colours as they are
// read, "Come usi l'app" as it is read, the "Account" rows and the states
// (CA-1 ... CA-9, CA-14, CA-22 ... CA-24, CA-41 ... CA-43). The seeded users
// only read; what needs a write is in the other profilo-* specs.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const settingsMenu = (page: Page) =>
  page.getByRole("navigation", { name: "Impostazioni" });

// ------------------------------------------------------- accesso e cornice

test.describe("accesso e cornice", () => {
  test("CA-1: senza sessione arriva a /accesso", async ({ page }) => {
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/accesso/);
  });

  test("CA-2: l'utente senza Nest arriva a /onboarding", async ({
    page,
    baseURL,
  }) => {
    needsUsers("C");
    await signInAs(page.context(), baseURL as string, "C");
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/onboarding/);
  });

  test("CA-3: su mobile la barra ha il titolo, «Indietro» porta a /nest e il titolo del browser è giusto", async ({
    page,
    baseURL,
  }) => {
    test.skip(!isMobile(), "Criterio valido a 390 px");
    needsUsers("A");
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto(PATH);
    await expect(h1(page)).toBeVisible();
    await expect(page).toHaveTitle(PAGE_TITLE);
    const bar = page.locator("header").filter({ visible: true });
    await expect(bar).toContainText("Il tuo profilo");
    const back = bar.getByLabel("Indietro", { exact: true });
    await expect(back).toBeVisible();
    await back.click();
    await expect(page).toHaveURL(/\/nest$/);
  });

  test("CA-4: su desktop il menu «Impostazioni» segna «Il tuo profilo»; su mobile non si vede", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto(PATH);
    await expect(h1(page)).toBeVisible();
    if (isMobile()) {
      await expect(settingsMenu(page)).toHaveCount(0);
      return;
    }
    const menu = settingsMenu(page);
    await expect(menu).toBeVisible();
    await expect(
      menu.getByRole("link", { name: "Il tuo profilo", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      menu.getByRole("link", { name: "Calendari collegati", exact: true }),
    ).not.toHaveAttribute("aria-current", /.*/);
  });

  test("CA-5: la riga «Marco, tu» di /nest e /membri/<Marco> portano a /profilo", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto("/nest");
    const link = page.getByRole("link", { name: /Marco, tu/ }).first();
    await expect(link).toHaveAttribute("href", PATH);
    await link.click();
    await expect(page).toHaveURL(/\/profilo$/);
    await expect(h1(page)).toBeVisible();

    await page.goto(`/membri/${IDS.marco}`);
    await expect(page).toHaveURL(/\/profilo$/);
  });
});

// ------------------------------------------------------------ testa e colore

test.describe("testa e colore, come si leggono", () => {
  test("CA-6: Marco vede il nome dell'account come h1 e «mail · Adulto in Casa D'Angelo»", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    await signInAs(page.context(), baseURL as string, "A");
    const response = await page.goto(PATH);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(h1(page)).toHaveText("Marco D'Angelo");
    await expect(subtitle(page)).toHaveText(
      `${process.env.TEST_USER_A_EMAIL} · Adulto in Casa D'Angelo`,
    );
    // The page is the real one, no longer the placeholder.
    await expect(page.getByTestId("pagina-segnaposto")).toHaveCount(0);
  });

  test("CA-7: senza nome dell'account l'h1 è il nome nel Nest; con un nome è quello dell'account", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    // Account without a name: the h1 is the name in the Nest.
    const nameless = await createThrowawayUser(null);
    try {
      const created = await nameless.client.rpc("create_household", {
        name: "Casa di Ilaria",
        household_type: "couple",
        member_name: "Ilaria",
        color: "pomodoro",
      });
      expect(created.error).toBeNull();
      await nameless.signInContext(page.context(), baseURL as string);
      await page.goto(PATH);
      await expect(h1(page)).toHaveText("Ilaria");
    } finally {
      await nameless.remove();
    }

    // Account with a name: the h1 is the name of the account.
    await page.context().clearCookies();
    await withMemberNest(async ({ user }) => {
      await user.signInContext(page.context(), baseURL as string);
      await page.goto(PATH);
      await expect(h1(page)).toHaveText("Ilaria De Santis");
    });
  });

  test("CA-8: Marco vede i 10 colori nell'ordine giusto, il suo scelto e quattro spenti", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto(PATH);
    await expect(h1(page)).toBeVisible();
    const radios = colorGroup(page).getByRole("radio");
    await expect(radios).toHaveCount(10);
    const names = await radios.evaluateAll((els) =>
      els.map((el) => el.getAttribute("aria-label")),
    );
    expect(names).toEqual([
      "Pomodoro",
      "Lampone",
      "Ceruleo",
      "Peonia",
      "Basilico",
      "Cannella",
      "Glicine (già usato)",
      "Salvia (già usato)",
      "Cobalto (già usato)",
      "Zafferano (già usato)",
    ]);
    await expect(colorRadio(page, "Pomodoro")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    const disabled = await radios.evaluateAll((els) =>
      els.map((el) => (el as HTMLButtonElement).disabled),
    );
    expect(disabled).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      true,
      true,
      true,
      true,
    ]);
  });

  test("CA-9: Giulia vede «Glicine» libero e gli altri tre colori spenti, senza nulla di Casa D'Angelo", async ({
    page,
    baseURL,
  }) => {
    needsUsers("B");
    await signInAs(page.context(), baseURL as string, "B");
    await page.goto(PATH);
    await expect(h1(page)).toBeVisible();
    await expect(colorRadio(page, "Glicine")).toBeEnabled();
    for (const taken of [
      "Pomodoro (già usato)",
      "Salvia (già usato)",
      "Zafferano (già usato)",
    ]) {
      await expect(colorRadio(page, taken)).toBeDisabled();
    }
    const text = await page.locator("body").innerText();
    const html = await (await page.request.get(PATH)).text();
    for (const forbidden of [
      "Casa D'Angelo",
      "Marco",
      "Laura",
      "Sofia",
      "Tommaso",
      "Biscotto",
    ]) {
      expect(text, `Il testo non deve contenere ${forbidden}`).not.toContain(
        forbidden,
      );
      expect(html, `L'HTML non deve contenere ${forbidden}`).not.toContain(
        forbidden,
      );
    }
  });
});

// --------------------------------------------------------- Come usi l'app

test.describe("Come usi l'app, come si legge", () => {
  test("CA-14: senza scelte fatte le righe dicono Io, 7:30, Occupato e Nessuno collegato", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto(PATH);
    await expect(h1(page)).toBeVisible();
    await expect(valueOf(page, "All'apertura")).toHaveText("Io");
    await expect(valueOf(page, "Sintesi del mattino")).toHaveText("7:30");
    await expect(valueOf(page, "Visibilità predefinita")).toHaveText(
      "Occupato",
    );
    await expect(infoOf(page, "Calendari collegati")).toHaveText(
      "Nessuno collegato",
    );
    // No count next to «Calendari collegati».
    await expect(valueOf(page, "Calendari collegati")).not.toHaveText(/\d/);
  });

  test("CA-22: «Calendari collegati» porta a /calendari-collegati", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto(PATH);
    await expect(h1(page)).toBeVisible();
    await mainOf(page)
      .getByRole("link", {
        name: "Calendari collegati Nessuno collegato",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/\/calendari-collegati$/);
  });

  test("CA-23: Giulia non legge né cambia le preferenze di Marco", async () => {
    needsUsers("A", "B");
    const admin = adminClient();
    const { data: marcoMember, error } = await admin
      .from("household_members")
      .select("user_id")
      .eq("id", IDS.marco)
      .single();
    expect(error).toBeNull();
    const marcoUserId = marcoMember!.user_id as string;
    const before = await profileOf(marcoUserId);
    expect(before).not.toBeNull();

    const giulia = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const signedIn = await giulia.auth.signInWithPassword({
      email: process.env.TEST_USER_B_EMAIL as string,
      password: process.env.TEST_USER_B_PASSWORD as string,
    });
    expect(signedIn.error).toBeNull();

    try {
      const read = await giulia
        .from("profiles")
        .select("start_lens, morning_digest_time, default_event_visibility")
        .eq("id", marcoUserId);
      expect(read.data ?? []).toEqual([]);

      await giulia
        .from("profiles")
        .update({
          start_lens: "nest",
          morning_digest_time: "10:00",
          default_event_visibility: "private",
        })
        .eq("id", marcoUserId);
      expect(await profileOf(marcoUserId)).toEqual(before);
    } finally {
      // Whatever happened, Marco's seed row goes back to what it was.
      await admin
        .from("profiles")
        .update({
          start_lens: before!.start_lens,
          morning_digest_time: before!.morning_digest_time,
          default_event_visibility: before!.default_event_visibility,
        })
        .eq("id", marcoUserId);
    }
  });
});

// ------------------------------------------------------------------ Account

test.describe("Account", () => {
  test("CA-24: «Accesso» non si tocca e «I tuoi dati» dice cosa scarica", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto(PATH);
    await expect(h1(page)).toBeVisible();
    const access = rowOf(page, "Accesso");
    await expect(access).toBeVisible();
    await expect(infoOf(page, "Accesso")).toHaveText("Con la mail");
    await expect(
      mainOf(page).getByRole("button", { name: /^Accesso/ }),
    ).toHaveCount(0);
    await expect(
      mainOf(page).getByRole("link", { name: /^Accesso/ }),
    ).toHaveCount(0);
    await expect(infoOf(page, "I tuoi dati")).toHaveText(
      "Scarica tutto quello che hai inserito",
    );
  });
});

// ------------------------------------------------------------------- stati

test.describe("stati", () => {
  test("CA-41: mentre la pagina si apre ci sono gli scheletri con aria-busy, poi il nome", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    await signInAs(page.context(), baseURL as string, "A");

    // Only the navigation is slowed down: the prefetch (which brings the
    // loading boundary) goes through.
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/profilo(\?|$)/, async (route) => {
      const headers = route.request().headers();
      if (
        route.request().resourceType() === "document" ||
        headers["rsc"] !== "1" ||
        headers["next-router-prefetch"]
      ) {
        await route.continue();
        return;
      }
      await gate;
      await route.continue();
    });
    const prefetched = page.waitForRequest(
      (request) =>
        new URL(request.url()).pathname === PATH &&
        !!request.headers()["next-router-prefetch"],
    );

    try {
      await page.goto("/nest");
      const link = page.getByRole("link", { name: /Marco, tu/ }).first();
      await expect(link).toBeVisible();
      await prefetched;
      await link.click();
      const busy = page.locator('[aria-busy="true"]').first();
      await expect(busy).toBeAttached();
      await expect(busy).toContainText("Caricamento in corso");
      await expect(h1(page)).toHaveCount(0);
    } finally {
      release();
    }
    await expect(h1(page)).toHaveText("Marco D'Angelo");
    await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
  });

  test("CA-42: se non si legge il profilo c'è la pagina d'errore, senza mail né nome", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user }) => {
      // The server cannot read the profile of the account: a real failure of
      // the reading, which the browser cannot simulate.
      const removed = await adminClient()
        .from("profiles")
        .delete()
        .eq("id", user.id);
      expect(removed.error).toBeNull();
      await user.signInContext(page.context(), baseURL as string);
      await page.goto(PATH);
      await expect(page.getByText(LOAD_ERROR)).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Riprova", exact: true }),
      ).toBeVisible();
      const text = await page.locator("main").innerText();
      expect(text).not.toContain(user.email);
      expect(text).not.toContain("Ilaria De Santis");
      await expect(rowOf(page, "I tuoi dati")).toHaveCount(0);
    });
  });

  test("CA-43: l'HTML di /profilo non ha date di nascita né mail di altri", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    const { data, error } = await adminClient()
      .from("household_members")
      .select("birth_date")
      .in("id", [IDS.sofia, IDS.tommaso, IDS.biscotto]);
    expect(error).toBeNull();
    // Pets may have no birth date: only the ones that exist are searched for.
    const birthDates = (data ?? [])
      .map((row) => row.birth_date as string | null)
      .filter((date): date is string => !!date);
    expect(birthDates.length).toBeGreaterThan(0);

    await signInAs(page.context(), baseURL as string, "A");
    const response = await page.request.get(PATH);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("Marco");
    for (const date of birthDates) {
      expect(html, `L'HTML non deve contenere ${date}`).not.toContain(date);
    }
    const mails = new Set(html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g));
    const own = (process.env.TEST_USER_A_EMAIL as string).toLowerCase();
    for (const mail of mails) {
      expect(mail.toLowerCase(), "Solo la mail di Marco").toBe(own);
    }
  });
});
