import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { formatAge } from "../../src/lib/datetime";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import { SEED_HOME_A } from "../fixtures/invito";
import {
  BLOCKED_NOTE,
  DEFAULT_STATES,
  LAST_ADULT_LEAVE_TEXT,
  LEAVE_NETWORK_ERROR,
  NORMAL_LEAVE_TEXT,
  NOTIFICATIONS,
  PAGE_TITLE,
  backLink,
  controlActions,
  dialog,
  errorTextOf,
  expectPeople,
  h1,
  householdExists,
  leaveButton,
  mainNav,
  notificationsSection,
  openSettings,
  peopleSection,
  prefsOf,
  saveAlert,
  settingsNav,
  switchOf,
  switchStates,
  waitHydrated,
} from "../fixtures/impostazioni-ca";
import {
  IDS,
  adminClient,
  memberById,
  pageText,
  withMemberNest,
  withRita,
  yearsAgo,
} from "../fixtures/membro";
import {
  throwawayConfigured,
  throwawaySkipReason,
  type ThrowawayUser,
} from "../fixtures/throwaway-user";

// "Impostazioni della casa" (#41, /impostazioni): one test or more for every
// acceptance criterion CA-1 ... CA-40. Seeded users A, B, B2, C only read;
// every test that writes uses its own throwaway user U (and U2), deleted at
// the end. A criterion without "(anche 1280)" holds at 390 px: on desktop it
// is skipped. Decisions of the coordinator on the PR (comment of 04/11) replace
// the old text of CA-21, CA-24, CA-26 and CA-28. CA-37 (axe) is in
// tests/a11y/impostazioni.spec.ts.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const NEST_A = "Casa D'Angelo";
const NEST_B = "Casa Bianchi";
const SOFIA_BIRTH = "2016-12-14";
const TOMMASO_BIRTH = "2020-04-02";
const LEO_BIRTH = "2019-09-05";

const isMobile = () => test.info().project.name === "mobile";

function onlyMobile() {
  test.skip(!isMobile(), "Criterio valido solo a 390 px");
}

function needsUsers(...keys: Parameters<typeof usersConfigured>) {
  test.skip(!usersConfigured(...keys), skipReason(...keys));
}

function needsThrowaway() {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
}

async function signIn(
  page: Page,
  baseURL: string | undefined,
  key: "A" | "B" | "B2" | "C",
) {
  await signInAs(page.context(), baseURL as string, key);
}

/** Server-rendered HTML of /impostazioni, as the browser receives it. */
async function htmlOf(page: Page) {
  const response = await page.request.get("/impostazioni");
  return { response, text: await response.text() };
}

/** A second browser session, signed in as the given throwaway user. */
async function newSession(
  page: Page,
  baseURL: string | undefined,
  user: ThrowawayUser,
) {
  const context = await page.context().browser()!.newContext({
    baseURL,
    locale: "it-IT",
    timezoneId: "Europe/Rome",
  });
  await user.signInContext(context, baseURL as string);
  return { context, page: await context.newPage() };
}

const SEED_ROWS = (age: { sofia: string; tommaso: string }) => [
  {
    title: "Marco, tu",
    info: null,
    tag: "Amministratore",
    initial: "M",
    color: "pomodoro",
  },
  {
    title: "Laura",
    info: "Invito in attesa",
    tag: "Adulto",
    initial: "L",
    color: "glicine",
  },
  {
    title: "Sofia",
    info: age.sofia,
    tag: "Figlio o figlia",
    initial: "S",
    color: "salvia",
  },
  {
    title: "Tommaso",
    info: age.tommaso,
    tag: "Figlio o figlia",
    initial: "T",
    color: "cobalto",
  },
  {
    title: "Biscotto",
    info: null,
    tag: "Animale",
    initial: "B",
    color: "zafferano",
  },
];

// ------------------------------------------------- accesso e isolamento

test.describe("accesso e isolamento", () => {
  test("CA-1: senza sessione arriva a /accesso", async ({ page }) => {
    onlyMobile();
    await page.goto("/impostazioni");
    await expect(page).toHaveURL(/\/accesso/);
  });

  test("CA-2: utente senza Nest arriva a /onboarding", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsUsers("C");
    await signIn(page, baseURL, "C");
    await page.goto("/impostazioni");
    await expect(page).toHaveURL(/\/onboarding/);
  });

  test("CA-3: ogni Nest vede solo i propri dati, anche nell'HTML", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsUsers("A", "B");

    await signIn(page, baseURL, "B");
    await page.goto("/impostazioni");
    await expect(h1(page)).toHaveText(NEST_B);
    const fromB = await htmlOf(page);
    for (const forbidden of [
      /Casa D(?:'|&#x27;|&#39;|\\u0027)Angelo/,
      /\bMarco\b/,
      /\bLaura\b/,
      /\bSofia\b/,
      /\bTommaso\b/,
      /\bBiscotto\b/,
    ]) {
      expect(
        fromB.text,
        `Nell'HTML di B non deve esserci ${forbidden}`,
      ).not.toMatch(forbidden);
    }

    await page.context().clearCookies();
    await signIn(page, baseURL, "A");
    await page.goto("/impostazioni");
    await expect(h1(page)).toHaveText(NEST_A);
    const fromA = await htmlOf(page);
    for (const forbidden of [
      /Casa Bianchi/,
      /\bGiulia\b/,
      /\bPaolo\b/,
      /\bLeo\b/,
      /\bAnna\b/,
    ]) {
      expect(
        fromA.text,
        `Nell'HTML di A non deve esserci ${forbidden}`,
      ).not.toMatch(forbidden);
    }
  });

  test("CA-4: le scelte di notifica di un adulto non le vede né le cambia un altro", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withRita(async ({ user, nest, adminMemberId, ritaId, u2 }) => {
      await user.signInContext(page.context(), baseURL as string);
      await openSettings(page, nest);
      await switchOf(page, "Impegni e cambi d'orario").click();
      await expect
        .poll(async () => (await prefsOf(adminMemberId))?.events)
        .toBe(false);

      const other = await newSession(page, baseURL, u2);
      try {
        await openSettings(other.page, nest);
        await expect(
          switchOf(other.page, "Impegni e cambi d'orario"),
        ).toHaveAttribute("aria-checked", "true");
      } finally {
        await other.context.close();
      }

      // U2 reads only its own row (here: none) and cannot change the one of U.
      const read = await u2.client
        .from("notification_preferences")
        .select("member_id");
      expect(read.error).toBeNull();
      expect(
        (read.data ?? []).map((row) => row.member_id),
        "U2 non deve leggere la riga di U",
      ).not.toContain(adminMemberId);
      await u2.client
        .from("notification_preferences")
        .update({ events: true })
        .eq("member_id", adminMemberId);
      await u2.client
        .from("notification_preferences")
        .delete()
        .eq("member_id", adminMemberId);
      expect((await prefsOf(adminMemberId))?.events).toBe(false);
      expect(await prefsOf(ritaId)).toBeNull();
    });
  });

  test("CA-5: da un altro Nest non si leggono le preferenze né si toglie un membro", async () => {
    onlyMobile();
    needsUsers("A");
    needsThrowaway();
    await withMemberNest(async ({ user }) => {
      const read = await user.client
        .from("notification_preferences")
        .select("household_id");
      expect(read.error).toBeNull();
      expect(
        (read.data ?? []).filter((row) => row.household_id === SEED_HOME_A),
      ).toEqual([]);

      await user.client.from("household_members").delete().eq("id", IDS.laura);
      expect(await memberById(IDS.laura)).not.toBeNull();
    });
  });
});

// ------------------------------------------------------------- contenuto

test.describe("contenuto", () => {
  test("CA-6: A a 390 px vede titolo, un solo h1, «Indietro» e nessuna navigazione principale", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsUsers("A");
    await signIn(page, baseURL, "A");
    await openSettings(page, NEST_A);
    await expect(page).toHaveTitle(PAGE_TITLE);
    await expect(h1(page)).toHaveCount(1);
    await expect(h1(page)).toHaveText(NEST_A);
    await expect(backLink(page)).toBeVisible();
    await expect(mainNav(page)).toHaveCount(0);
  });

  test("CA-7: A a 1280 px vede le due navigazioni, la voce del Nest attiva e niente «Indietro»", async ({
    page,
    baseURL,
  }) => {
    test.skip(isMobile(), "Criterio valido solo a 1280 px");
    needsUsers("A");
    await signIn(page, baseURL, "A");
    await openSettings(page, NEST_A);
    await expect(mainNav(page)).toBeVisible();
    await expect(settingsNav(page)).toBeVisible();
    await expect(
      settingsNav(page).getByRole("link", { name: NEST_A, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(backLink(page)).toHaveCount(0);
    await expect(h1(page)).toHaveCount(1);
    await expect(h1(page)).toHaveText(NEST_A);
  });

  test("CA-8: «Chi c’è» di A, righe, ordine, etichette, avatar (anche 1280)", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    await signIn(page, baseURL, "A");
    await openSettings(page, NEST_A);
    await expect(
      page.getByRole("heading", { level: 2, name: "Chi c’è" }),
    ).toBeVisible();
    await expectPeople(
      page,
      SEED_ROWS({
        sofia: formatAge(SOFIA_BIRTH),
        tommaso: formatAge(TOMMASO_BIRTH),
      }),
    );
    for (const old of ["Figlia", "Figlio", "Cane"]) {
      await expect(page.getByText(old, { exact: true })).toHaveCount(0);
    }
  });

  test("CA-9: le righe di «Chi c’è» portano dove devono (anche 1280)", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    await signIn(page, baseURL, "A");
    await page.goto("/nest");
    await expect(h1(page)).toBeVisible();
    const nestLinks = {
      sofia: await page
        .getByRole("main")
        .getByRole("link", { name: /Sofia/ })
        .evaluateAll((els) => els.map((el) => el.getAttribute("href"))),
      tommaso: await page
        .getByRole("main")
        .getByRole("link", { name: /Tommaso/ })
        .evaluateAll((els) => els.map((el) => el.getAttribute("href"))),
    };

    await openSettings(page, NEST_A);
    const people = peopleSection(page);
    await expect(
      people.getByRole("link", { name: /^Marco, tu/ }),
    ).toHaveAttribute("href", "/profilo");
    await expect(people.getByRole("link", { name: /^Laura/ })).toHaveAttribute(
      "href",
      `/membri/${IDS.laura}`,
    );
    await expect(
      people.getByRole("link", { name: /^Biscotto/ }),
    ).toHaveAttribute("href", `/membri/${IDS.biscotto}`);
    // The children lead where they lead in «Il tuo Nest» (today: nowhere).
    for (const [name, expected] of [
      ["Sofia", nestLinks.sofia],
      ["Tommaso", nestLinks.tommaso],
    ] as const) {
      const links = people.getByRole("link", { name: new RegExp(`^${name}`) });
      expect(
        await links.evaluateAll((els) =>
          els.map((el) => el.getAttribute("href")),
        ),
        `Destinazione di ${name}`,
      ).toEqual(expected);
    }
  });

  test("CA-10: «Chi c’è» di B", async ({ page, baseURL }) => {
    onlyMobile();
    needsUsers("B");
    await signIn(page, baseURL, "B");
    await openSettings(page, NEST_B);
    await expectPeople(page, [
      { title: "Giulia, tu", info: null, tag: "Amministratore" },
      { title: "Paolo", info: null, tag: "Adulto" },
      { title: "Leo", info: formatAge(LEO_BIRTH), tag: "Figlio o figlia" },
      { title: "Anna", info: "Invito scaduto", tag: "Adulto" },
    ]);
  });

  test("CA-11: chi non è amministratore non vede gli inviti e può uscire", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsUsers("B2");
    await signIn(page, baseURL, "B2");
    await openSettings(page, NEST_B);
    await expectPeople(page, [
      { title: "Giulia", info: null, tag: "Amministratore" },
      { title: "Paolo, tu", info: null, tag: "Adulto" },
      { title: "Leo", info: formatAge(LEO_BIRTH), tag: "Figlio o figlia" },
      { title: "Anna", info: null, tag: "Adulto" },
    ]);
    const text = await pageText(page);
    for (const forbidden of ["Invito", "invito scaduto", "Da invitare"]) {
      expect(text, `Il testo non deve contenere «${forbidden}»`).not.toContain(
        forbidden,
      );
    }
    await expect(leaveButton(page, NEST_B)).toBeVisible();
    await expect(leaveButton(page, NEST_B)).toBeEnabled();
  });

  test("CA-12: cinque interruttori di A, nell'ordine e con i valori di partenza (anche 1280)", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    await signIn(page, baseURL, "A");
    await openSettings(page, NEST_A);
    await expect(
      page.getByRole("heading", { level: 2, name: "Notifiche" }),
    ).toBeVisible();
    await expect(notificationsSection(page)).toHaveAttribute("id", "notifiche");
    await expect(notificationsSection(page).getByRole("switch")).toHaveCount(5);
    expect(await switchStates(page)).toEqual(
      NOTIFICATIONS.map((n, i) => [n.title, DEFAULT_STATES[i]]),
    );
    await expect(notificationsSection(page)).toContainText(
      "Raggruppate, una volta al giorno",
    );
    await expect(switchOf(page, "Spesa")).toHaveAccessibleDescription(
      "Raggruppate, una volta al giorno",
    );
    await expect(notificationsSection(page)).toContainText(
      "Valgono solo per te: gli altri scelgono le loro.",
    );
  });

  test("CA-13: niente piano, Premium, aspetto o tema (anche 1280)", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    await signIn(page, baseURL, "A");
    await openSettings(page, NEST_A);
    const text = await pageText(page);
    for (const forbidden of [
      "Piano",
      "Premium",
      "Aspetto",
      "Tema",
      "Chiaro",
      "Scuro",
      "Sistema",
    ]) {
      expect(text, `Il testo non deve contenere «${forbidden}»`).not.toContain(
        forbidden,
      );
    }
    await expect(page.getByRole("group", { name: "Tema" })).toHaveCount(0);
  });

  test("CA-14: l'ultimo elemento interattivo è «Esci da…», dopo «Notifiche» (anche 1280)", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    await signIn(page, baseURL, "A");
    await openSettings(page, NEST_A);
    const last = await page.locator("main").evaluate((main) => {
      const selector =
        'a[href], button:not([disabled]), [role="switch"], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const items = [...main.querySelectorAll(selector)];
      const lastItem = items.at(-1);
      const digest = main.querySelector('[aria-label="Sintesi del mattino"]');
      return {
        text: lastItem?.textContent?.trim() ?? null,
        after: !!(
          lastItem &&
          digest &&
          digest.compareDocumentPosition(lastItem) &
            Node.DOCUMENT_POSITION_FOLLOWING
        ),
      };
    });
    expect(last.text).toBe(`Esci da ${NEST_A}`);
    expect(last.after).toBe(true);
  });

  test("CA-15 (stato vuoto): un Nest con una sola persona e nessuna scelta salvata", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withMemberNest(async ({ user, nest, adminMemberId }) => {
      await user.signInContext(page.context(), baseURL as string);
      await openSettings(page, nest);
      await expect(h1(page)).toHaveText(nest);
      await expectPeople(page, [
        { title: "Ilaria, tu", info: null, tag: "Amministratore" },
      ]);
      expect((await switchStates(page)).map((s) => s[1])).toEqual(
        DEFAULT_STATES,
      );
      expect(await prefsOf(adminMemberId)).toBeNull();
    });
  });

  test("CA-16: un animale con la data di nascita mostra l'età e non la data", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withMemberNest(async ({ user, nest, addPet }) => {
      const birth = yearsAgo(3);
      await addPet("Fido", "glicine", birth);
      await user.signInContext(page.context(), baseURL as string);
      await openSettings(page, nest);
      const row = peopleSection(page).locator("ul > li").filter({
        hasText: "Fido",
      });
      await expect(row.locator(".riga-lista__info")).toHaveText("3 anni");
      await expect(row.locator(".etichetta")).toHaveText("Animale");
      const { text } = await htmlOf(page);
      expect(text).not.toContain(birth);
    });
  });

  test("CA-17: un nome di 60 caratteri resta intero e la pagina non scorre di lato", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withMemberNest(async ({ user, householdId }) => {
      const longName = `${"Abcdefghij ".repeat(5)}Abcd`.slice(0, 59) + "Z";
      expect(longName).toHaveLength(60);
      const { error } = await user.client
        .from("households")
        .update({ name: longName })
        .eq("id", householdId);
      expect(error).toBeNull();
      await user.signInContext(page.context(), baseURL as string);
      await openSettings(page, longName);
      await expect(h1(page)).toHaveText(longName);
      await expect(leaveButton(page, longName)).toBeVisible();
      expect(await h1(page).innerText()).not.toContain("…");
      expect(await leaveButton(page, longName).innerText()).not.toContain("…");
      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      expect(scrollWidth).toBeLessThanOrEqual(390);
    });
  });
});

// ------------------------------------------------------------- notifiche

test.describe("notifiche", () => {
  test("CA-18: «Spesa» si accende e si spegne, e la scelta resta dopo il ricaricamento", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withMemberNest(async ({ user, nest, adminMemberId }) => {
      await user.signInContext(page.context(), baseURL as string);
      await openSettings(page, nest);
      const spesa = switchOf(page, "Spesa");

      await spesa.click();
      await expect(spesa).toHaveAttribute("aria-checked", "true");
      await expect
        .poll(async () => (await prefsOf(adminMemberId))?.shopping)
        .toBe(true);
      await openSettings(page, nest);
      await expect(switchOf(page, "Spesa")).toHaveAttribute(
        "aria-checked",
        "true",
      );

      await switchOf(page, "Spesa").click();
      await expect(switchOf(page, "Spesa")).toHaveAttribute(
        "aria-checked",
        "false",
      );
      await expect
        .poll(async () => (await prefsOf(adminMemberId))?.shopping)
        .toBe(false);
      await openSettings(page, nest);
      await expect(switchOf(page, "Spesa")).toHaveAttribute(
        "aria-checked",
        "false",
      );
    });
  });

  test("CA-19: quattro interruttori spenti uno alla volta restano spenti dopo il ricaricamento", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withMemberNest(async ({ user, nest, adminMemberId }) => {
      await user.signInContext(page.context(), baseURL as string);
      await openSettings(page, nest);
      const four = NOTIFICATIONS.filter((n) => n.column !== "shopping");
      for (const { column, title } of four) {
        await switchOf(page, title).click();
        await expect(switchOf(page, title)).toHaveAttribute(
          "aria-checked",
          "false",
        );
        await expect
          .poll(async () => (await prefsOf(adminMemberId))?.[column])
          .toBe(false);
      }
      await openSettings(page, nest);
      expect((await switchStates(page)).map((s) => s[1])).toEqual([
        "false",
        "false",
        "false",
        "false",
        "false",
      ]);
      const row = await prefsOf(adminMemberId);
      expect(row).toEqual({
        events: false,
        assigned_todos: false,
        shopping: false,
        free_together: false,
        morning_digest: false,
      });
    });
  });

  test("CA-20: la scelta di U non cambia quella di Rita", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withRita(async ({ user, nest, adminMemberId, ritaId, u2 }) => {
      await user.signInContext(page.context(), baseURL as string);
      await openSettings(page, nest);
      await switchOf(page, "Da fare assegnati a me").click();
      await expect
        .poll(async () => (await prefsOf(adminMemberId))?.assigned_todos)
        .toBe(false);

      const rita = await prefsOf(ritaId);
      expect(rita === null || rita.assigned_todos === true).toBe(true);

      const other = await newSession(page, baseURL, u2);
      try {
        await openSettings(other.page, nest);
        await expect(
          switchOf(other.page, "Da fare assegnati a me"),
        ).toHaveAttribute("aria-checked", "true");
      } finally {
        await other.context.close();
      }
    });
  });

  test("CA-21 (errore): se il salvataggio non riesce l'interruttore torna indietro e compare l'avviso", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withMemberNest(async ({ user, nest, adminMemberId }) => {
      await user.signInContext(page.context(), baseURL as string);
      const actions = await controlActions(page, { abort: true });
      await openSettings(page, nest);
      const liberi = switchOf(page, "Liberi insieme");

      await liberi.click();
      await expect(saveAlert(page)).toHaveText(errorTextOf("Liberi insieme"));
      await expect(liberi).toHaveAttribute("aria-checked", "true");
      expect(actions.count).toBe(1);
      const row = await prefsOf(adminMemberId);
      expect(row === null || row.free_together === true).toBe(true);

      // The network is back: the next tap saves and the notice goes away.
      actions.abort = false;
      await liberi.click();
      await expect(liberi).toHaveAttribute("aria-checked", "false");
      await expect(saveAlert(page)).toHaveCount(0);
      await expect
        .poll(async () => (await prefsOf(adminMemberId))?.free_together)
        .toBe(false);
    });
  });

  test("CA-22: due tocchi su «Spesa» mandano una sola richiesta", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withMemberNest(async ({ user, nest, adminMemberId }) => {
      await user.signInContext(page.context(), baseURL as string);
      const actions = await controlActions(page, { delayMs: 2000 });
      await openSettings(page, nest);
      const spesa = switchOf(page, "Spesa");

      await spesa.click();
      await spesa.click();
      await expect
        .poll(async () => (await prefsOf(adminMemberId))?.shopping)
        .toBe(true);
      await expect(spesa).toHaveAttribute("aria-checked", "true");
      await expect(spesa.locator("xpath=ancestor::li[1]")).not.toHaveAttribute(
        "aria-busy",
        "true",
      );
      expect(actions.count).toBe(1);
    });
  });

  test("CA-23: «Notifiche» del menu laterale porta a /impostazioni#notifiche", async ({
    page,
    baseURL,
  }) => {
    test.skip(isMobile(), "Criterio valido solo a 1280 px");
    needsUsers("A");
    await signIn(page, baseURL, "A");
    await page.goto(`/membri/${IDS.laura}`);
    await expect(h1(page)).toHaveText("Laura");
    const link = settingsNav(page).getByRole("link", {
      name: "Notifiche",
      exact: true,
    });
    await waitHydrated(link);
    await link.click();
    await expect(page).toHaveURL(/\/impostazioni#notifiche$/);
    await expect(
      page.getByRole("heading", { level: 2, name: "Notifiche" }),
    ).toBeInViewport();
  });

  test("CA-36 (tastiera): Tab porta il fuoco su «Spesa» e Spazio la accende", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withMemberNest(async ({ user, nest, adminMemberId }) => {
      await user.signInContext(page.context(), baseURL as string);
      await openSettings(page, nest);
      await switchOf(page, "Da fare assegnati a me").focus();
      await page.keyboard.press("Tab");
      const spesa = switchOf(page, "Spesa");
      await expect(spesa).toBeFocused();
      await page.keyboard.press("Space");
      await expect(spesa).toHaveAttribute("aria-checked", "true");
      await expect(spesa).toBeFocused();
      await expect
        .poll(async () => (await prefsOf(adminMemberId))?.shopping)
        .toBe(true);
    });
  });
});

// --------------------------------------------------- esci: il dialogo

test.describe("esci dalla casa: dialogo", () => {
  async function checkCancelAndEscape(page: Page, nest: string) {
    const button = leaveButton(page, nest);
    await waitHydrated(button);
    await expect(button).toHaveAttribute("aria-haspopup", "dialog");

    await button.click();
    await expect(dialog(page)).toBeVisible();
    await expect(
      dialog(page).getByRole("button", { name: "Annulla", exact: true }),
    ).toBeFocused();
    await dialog(page).getByRole("button", { name: "Annulla" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(button).toBeFocused();

    await button.click();
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await expect(button).toBeFocused();
  }

  test("CA-24: A, ultimo adulto con account, vede il dialogo che cancella la casa (anche 1280)", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    await signIn(page, baseURL, "A");
    await openSettings(page, NEST_A);
    await leaveButton(page, NEST_A).click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page)).toHaveAccessibleName(`Uscire da ${NEST_A}?`);
    await expect(dialog(page)).toHaveAccessibleDescription(
      LAST_ADULT_LEAVE_TEXT,
    );
    await expect(
      dialog(page).getByRole("button", { name: "Esci e cancella la casa" }),
    ).toBeVisible();
    await expect(
      dialog(page).getByRole("button", { name: "Annulla", exact: true }),
    ).toBeFocused();
    await dialog(page).getByRole("button", { name: "Annulla" }).click();
    await expect(dialog(page)).toHaveCount(0);

    await checkCancelAndEscape(page, NEST_A);

    expect(await memberById(IDS.marco)).not.toBeNull();
    expect(await householdExists(SEED_HOME_A)).toBe(true);
  });

  test("CA-25: B2 vede il dialogo normale e annulla", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsUsers("B2");
    await signIn(page, baseURL, "B2");
    await openSettings(page, NEST_B);
    await leaveButton(page, NEST_B).click();
    await expect(dialog(page)).toHaveAccessibleName(`Uscire da ${NEST_B}?`);
    await expect(dialog(page)).toHaveAccessibleDescription(NORMAL_LEAVE_TEXT);
    await expect(
      dialog(page).getByRole("button", { name: "Esci dalla casa" }),
    ).toBeVisible();
    await dialog(page).getByRole("button", { name: "Annulla" }).click();
    await expect(dialog(page)).toHaveCount(0);
    expect(await memberById(IDS.paolo)).not.toBeNull();
  });

  test("CA-26: B, unica amministratrice con un altro adulto con account, non può uscire e legge la nota", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsUsers("B");
    await signIn(page, baseURL, "B");
    await openSettings(page, NEST_B);
    const button = leaveButton(page, NEST_B);
    await expect(button).toBeDisabled();
    await expect(page.getByText(BLOCKED_NOTE, { exact: true })).toBeVisible();
    await expect(button).toHaveAccessibleDescription(BLOCKED_NOTE);
    await expect(dialog(page)).toHaveCount(0);
    expect(await memberById(IDS.giulia)).not.toBeNull();
    expect(await memberById(IDS.paolo)).not.toBeNull();
  });
});

// ------------------------------------------------- esci: la conferma

test.describe("esci dalla casa: conferma", () => {
  test("CA-27 (caso a): U esce, arriva a /onboarding e il database fa il resto", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withRita(
      async ({ user, nest, householdId, adminMemberId, ritaId, u2 }) => {
        const promoted = await user.client
          .from("household_members")
          .update({ is_admin: true })
          .eq("id", ritaId);
        expect(promoted.error).toBeNull();
        expect((await memberById(ritaId))?.is_admin).toBe(true);
        for (const [title, isPrivate] of [
          ["Solo io di prova", true],
          ["Per tutti di prova", false],
        ] as const) {
          const { error } = await user.client
            .from("todos")
            .insert({ title, is_private: isPrivate });
          expect(error).toBeNull();
        }

        await user.signInContext(page.context(), baseURL as string);
        await openSettings(page, nest);
        await leaveButton(page, nest).click();
        await expect(dialog(page)).toHaveAccessibleDescription(
          NORMAL_LEAVE_TEXT,
        );
        await dialog(page)
          .getByRole("button", { name: "Esci dalla casa" })
          .click();
        await expect(page).toHaveURL(/\/onboarding/);
        await page.goBack();
        await expect(page).not.toHaveURL(/\/impostazioni/);

        expect(await memberById(adminMemberId)).toBeNull();
        expect(await householdExists(householdId)).toBe(true);
        const { data: todos, error } = await adminClient()
          .from("todos")
          .select("title, created_by_member_id")
          .eq("household_id", householdId);
        expect(error).toBeNull();
        expect(todos).toEqual([
          { title: "Per tutti di prova", created_by_member_id: null },
        ]);

        const other = await newSession(page, baseURL, u2);
        try {
          await openSettings(other.page, nest);
          await expectPeople(other.page, [
            { title: "Rita, tu", info: null, tag: "Amministratore" },
          ]);
        } finally {
          await other.context.close();
        }
      },
    );
  });

  test("CA-28 (caso b): U, unico amministratore con Rita che ha un account, non può uscire", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withRita(async ({ user, nest, adminMemberId, ritaId }) => {
      await user.signInContext(page.context(), baseURL as string);
      await openSettings(page, nest);
      const button = leaveButton(page, nest);
      await expect(button).toBeDisabled();
      await expect(page.getByText(BLOCKED_NOTE, { exact: true })).toBeVisible();
      await expect(button).toHaveAccessibleDescription(BLOCKED_NOTE);
      await expect(dialog(page)).toHaveCount(0);
      expect(await memberById(adminMemberId)).not.toBeNull();
      expect((await memberById(ritaId))?.is_admin).toBe(false);
    });
  });

  test("CA-29 (caso c): l'ultimo adulto con account cancella la casa con tutti i dati", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withMemberNest(
      async ({ user, nest, householdId, adminMemberId, addAdult, invite }) => {
        const admin = adminClient();
        const { data: leo, error: leoError } = await admin
          .from("household_members")
          .insert({
            household_id: householdId,
            kind: "child",
            name: "Leo",
            color: "salvia",
            birth_date: yearsAgo(5),
          })
          .select("id")
          .single();
        expect(leoError).toBeNull();
        const lauraId = await addAdult("Laura", "glicine");
        const invitation = await invite(lauraId);
        const saved = await user.client.rpc("set_notification_preference", {
          p_preference: "events",
          p_enabled: false,
        });
        expect(saved.error).toBeNull();
        const item = await user.client
          .from("shopping_items")
          .insert({ name: "Latte di prova" });
        expect(item.error).toBeNull();

        await user.signInContext(page.context(), baseURL as string);
        await openSettings(page, nest);
        await leaveButton(page, nest).click();
        await expect(dialog(page)).toHaveAccessibleDescription(
          LAST_ADULT_LEAVE_TEXT,
        );
        await dialog(page)
          .getByRole("button", { name: "Esci e cancella la casa" })
          .click();
        await expect(page).toHaveURL(/\/onboarding/);

        expect(await householdExists(householdId)).toBe(false);
        for (const id of [adminMemberId, lauraId, leo!.id as string]) {
          expect(
            await memberById(id),
            `Il membro ${id} non deve esserci`,
          ).toBeNull();
        }
        expect(await prefsOf(adminMemberId)).toBeNull();
        const invitations = await admin
          .from("invitations")
          .select("id")
          .eq("id", invitation.id);
        expect(invitations.data).toEqual([]);
        const shopping = await admin
          .from("shopping_items")
          .select("id")
          .eq("household_id", householdId);
        expect(shopping.data).toEqual([]);

        const anon = createClient(
          supabaseUrl as string,
          publishableKey as string,
          {
            auth: { persistSession: false },
          },
        );
        const preview = await anon.rpc("invitation_preview", {
          p_token: invitation.token,
        });
        expect(preview.error).toBeNull();
        expect((preview.data as { status: string }[])[0]?.status).toBe(
          "invalid",
        );
      },
    );
  });

  test("CA-30 (errore): se la richiesta di uscita cade il dialogo resta aperto con l'avviso", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withMemberNest(async ({ user, nest, householdId, adminMemberId }) => {
      await user.signInContext(page.context(), baseURL as string);
      const actions = await controlActions(page, { abort: true });
      await openSettings(page, nest);
      await leaveButton(page, nest).click();
      await dialog(page)
        .getByRole("button", { name: "Esci e cancella la casa" })
        .click();
      await expect(page.getByTestId("dialogo-errore")).toHaveText(
        LEAVE_NETWORK_ERROR,
      );
      await expect(dialog(page)).toBeVisible();
      await expect(page).toHaveURL(/\/impostazioni$/);
      expect(actions.count).toBe(1);
      expect(await memberById(adminMemberId)).not.toBeNull();
      expect(await householdExists(householdId)).toBe(true);
    });
  });

  test("CA-31: due tocchi su «Esci e cancella la casa» mandano una sola richiesta", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withMemberNest(async ({ user, nest }) => {
      await user.signInContext(page.context(), baseURL as string);
      const actions = await controlActions(page, { delayMs: 2000 });
      await openSettings(page, nest);
      await leaveButton(page, nest).click();
      const confirm = dialog(page).getByRole("button", {
        name: "Esci e cancella la casa",
      });
      await confirm.click();
      await expect(confirm).toHaveAttribute("aria-busy", "true");
      // The second tap lands on a button that is inactive: it must do nothing.
      await confirm.click({ force: true });
      await expect(page).toHaveURL(/\/onboarding/);
      expect(actions.count).toBe(1);
    });
  });

  test("CA-32: se Rita è già stata tolta da un'altra scheda, uscire vale come riuscito", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withRita(async ({ user, nest, ritaId, u2 }) => {
      await u2.signInContext(page.context(), baseURL as string);
      await openSettings(page, nest);
      await leaveButton(page, nest).click();
      await expect(dialog(page)).toBeVisible();

      // Meanwhile U removes Rita from the Nest.
      const removed = await user.client
        .from("household_members")
        .delete()
        .eq("id", ritaId);
      expect(removed.error).toBeNull();
      expect(await memberById(ritaId)).toBeNull();

      await dialog(page)
        .getByRole("button", { name: "Esci dalla casa" })
        .click();
      await expect(page).toHaveURL(/\/onboarding/);
    });
  });
});

// ------------------------------------------------- sicurezza e privacy

test.describe("sicurezza e privacy", () => {
  test("CA-33: nell'HTML non c'è nessun dato che non deve arrivare al browser", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsUsers("A");
    const { data: marco } = await adminClient()
      .from("household_members")
      .select("user_id")
      .eq("id", IDS.marco)
      .single();
    const { data: invite } = await adminClient()
      .from("invitations")
      .select("token")
      .eq("member_id", IDS.laura)
      .eq("status", "pending")
      .single();
    const forbidden = [
      process.env.TEST_USER_A_EMAIL ?? "",
      marco!.user_id as string,
      SOFIA_BIRTH,
      TOMMASO_BIRTH,
      "4821",
      invite!.token as string,
    ].filter(Boolean);
    expect(forbidden.length).toBeGreaterThanOrEqual(5);

    const origins = new Set<string>();
    page.on("request", (request) => {
      if (/^https?:/.test(request.url())) {
        origins.add(new URL(request.url()).origin);
      }
    });

    await signIn(page, baseURL, "A");
    await openSettings(page, NEST_A);
    const { response, text } = await htmlOf(page);
    const cache = response.headers()["cache-control"] ?? "";
    expect(cache).toMatch(/private|no-store/);
    for (const value of forbidden) {
      expect(text, "L'HTML non deve contenere un dato riservato").not.toContain(
        value,
      );
    }

    await leaveButton(page, NEST_A).click();
    await expect(dialog(page)).toBeVisible();
    const content = await page.content();
    for (const value of forbidden) {
      expect(
        content,
        "Il documento non deve contenere un dato riservato",
      ).not.toContain(value);
    }

    const allowed = new Set([
      new URL(page.url()).origin,
      new URL(supabaseUrl as string).origin,
    ]);
    expect([...origins].filter((origin) => !allowed.has(origin))).toEqual([]);
  });

  test("CA-34: nessun indirizzo contiene nomi o scelte, e le azioni usano solo il client della sessione", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withMemberNest(async ({ user, nest, adminMemberId }) => {
      const addresses: string[] = [];
      page.on("request", (request) => {
        addresses.push(request.url());
      });
      await user.signInContext(page.context(), baseURL as string);
      await openSettings(page, nest);
      await switchOf(page, "Spesa").click();
      await expect
        .poll(async () => (await prefsOf(adminMemberId))?.shopping)
        .toBe(true);
      await leaveButton(page, nest).click();
      await dialog(page)
        .getByRole("button", { name: "Esci e cancella la casa" })
        .click();
      await expect(page).toHaveURL(/\/onboarding/);

      expect(addresses.length).toBeGreaterThan(0);
      for (const address of addresses) {
        const decoded = decodeURIComponent(address);
        for (const word of [nest, "Ilaria", "De Santis"]) {
          expect(decoded, `Indirizzo con «${word}»`).not.toContain(word);
        }
        const url = new URL(address);
        for (const name of [
          "assigned_todos",
          "free_together",
          "morning_digest",
        ]) {
          expect(decodeURIComponent(url.pathname + url.search)).not.toContain(
            name,
          );
        }
        expect(decodeURIComponent(url.search)).not.toMatch(
          /\b(events|shopping)\b/,
        );
      }
    });

    // Static part: the server actions use the session client only and receive
    // nothing that names a Nest or a member.
    const actions = readFileSync(
      join(process.cwd(), "src/app/(app)/impostazioni/actions.ts"),
      "utf8",
    );
    expect(actions).toMatch(
      /import \{ createClient \} from "@\/lib\/supabase\/server"/,
    );
    expect(actions).not.toMatch(/SUPABASE_SECRET_KEY|supabase\/admin/);
    expect(actions).not.toMatch(/household_?id|member_?id/i);
    expect(actions).toMatch(
      /function setNotificationPreference\(\s*preference/,
    );
    expect(actions).toMatch(/function leaveHousehold\(\)/);
  });

  test("CA-35: la pagina controlla Nest e sessione prima di leggere e mostra l'errore di pagina", async () => {
    onlyMobile();
    const root = join(process.cwd(), "src/app/(app)/impostazioni");
    const page = readFileSync(join(root, "page.tsx"), "utf8");
    const body = page.slice(page.indexOf("export default async function Page"));
    expect(body).toContain("await requireNest()");
    expect(body.indexOf("await requireNest()")).toBeLessThan(
      body.indexOf("load("),
    );
    expect(body).toMatch(/if \(!loaded\) return <SettingsError \/>/);
    // Every read that can fail ends in `null`, that is the page error.
    expect(page).toMatch(/householdError/);
    expect(page).toMatch(/members\.error \|\| preferences\.error/);
    expect(page).toMatch(/if \(error\) return null/);
    expect(page).not.toMatch(/SUPABASE_SECRET_KEY|supabase\/admin/);
    const error = readFileSync(
      join(process.cwd(), "src/components/impostazioni/SettingsError.tsx"),
      "utf8",
    );
    expect(error).toContain("PageError");
    expect(error).toContain("onRetry");
  });
});

// ------------------------------------------------- altre pagine

test.describe("altre pagine", () => {
  test("CA-38: «Il tuo Nest» porta alle impostazioni con il testo nuovo (anche 1280)", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    await signIn(page, baseURL, "A");
    await page.goto("/nest");
    await expect(h1(page)).toBeVisible();
    const link = page
      .getByRole("main")
      .getByRole("link", { name: /^Impostazioni della casa/ });
    await expect(link).toHaveAttribute("href", "/impostazioni");
    await expect(link).toContainText("Chi c’è e notifiche");
    expect(await page.getByRole("main").innerText()).not.toContain("Piano");
  });

  test("CA-39: la pagina di un amministratore dice «Può invitare e togliere persone»", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsUsers("B");
    await signIn(page, baseURL, "B");
    await page.goto(`/membri/${IDS.paolo}`);
    await expect(h1(page)).toHaveText("Paolo");
    await expect(
      page.getByText("Può invitare e togliere persone", { exact: true }),
    ).toBeVisible();
    expect((await pageText(page)).toLowerCase()).not.toContain("piano");
  });

  test("CA-40: da «Il tuo Nest» alle impostazioni e «Indietro»; aperta da sola, «Indietro» va a /nest", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsUsers("A");
    await signIn(page, baseURL, "A");
    await page.goto("/nest");
    await expect(h1(page)).toBeVisible();
    const link = page
      .getByRole("main")
      .getByRole("link", { name: /^Impostazioni della casa/ });
    await waitHydrated(link);
    await link.click();
    await expect(page).toHaveURL(/\/impostazioni$/);
    await expect(h1(page)).toHaveText(NEST_A);
    await waitHydrated(backLink(page));
    await backLink(page).click();
    await expect(page).toHaveURL(/\/nest$/);

    const fresh = await page.context().newPage();
    await fresh.goto("/impostazioni");
    await expect(h1(fresh)).toHaveText(NEST_A);
    await waitHydrated(backLink(fresh));
    await backLink(fresh).click();
    await expect(fresh).toHaveURL(/\/nest$/);
  });
});
