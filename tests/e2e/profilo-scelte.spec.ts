import type { Locator } from "@playwright/test";
import { expect, test } from "../fixtures/casa";
import {
  PHRASE,
  dialogOf,
  eventsOf,
  fieldOf,
  openAdd,
} from "../fixtures/aggiungi";
import { chooseLens, lensButton } from "../fixtures/preferenze";
import {
  COLOR_NETWORK_ERROR,
  COLOR_SERVER_ERROR,
  COLOR_TAKEN_ERROR,
  PREFERENCE_NETWORK_ERROR,
  PREFERENCE_SERVER_ERROR,
  alertWith,
  breakWrites,
  colorGroup,
  colorOf,
  colorRadio,
  countRefreshes,
  headAvatar,
  needsThrowaway,
  openProfile,
  profileOf,
  sheetOf,
  valueOf,
  waitHydrated,
  withMemberNest,
} from "../fixtures/profilo";

// "Il tuo profilo" (#38): the colour and the three choices of "Come usi l'app"
// (CA-10 ... CA-21). Everything here writes, so it uses only throwaway users.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const radioIn = (sheet: Locator, label: RegExp) =>
  sheet.getByRole("radio", { name: label });

// ------------------------------------------------------------------ colore

test.describe("colore", () => {
  test("CA-10: toccare «Lampone» lo sceglie subito, lo salva e la pagina rilegge", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user }) => {
      await user.signInContext(page.context(), baseURL as string);
      await openProfile(page);
      await waitHydrated(colorRadio(page, "Lampone"));
      const refreshes = countRefreshes(page);
      await expect(colorRadio(page, "Pomodoro")).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await expect(headAvatar(page)).toHaveClass(/membro-pomodoro/);

      await colorRadio(page, "Lampone").click();
      await expect(colorRadio(page, "Lampone")).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await expect(headAvatar(page)).toHaveClass(/membro-lampone/);
      await expect.poll(() => colorOf(user.id)).toBe("lampone");
      // router.refresh(): the frame reads the new colour.
      await expect.poll(refreshes).toBeGreaterThan(0);

      await page.reload();
      await expect(colorRadio(page, "Lampone")).toHaveAttribute(
        "aria-checked",
        "true",
      );
    });
  });

  test("CA-11: con le frecce il fuoco e la scelta passano al colore dopo «Pomodoro» e si salva; Tab esce dal gruppo", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user }) => {
      await user.signInContext(page.context(), baseURL as string);
      await openProfile(page);
      await waitHydrated(colorRadio(page, "Pomodoro"));
      // In a Nest where nobody else has a colour the circle after «Pomodoro» is
      // the second of the base order («Glicine»); with other colours taken it
      // is the next free one (for Marco: «Lampone»). The test reads it.
      const radios = colorGroup(page).getByRole("radio");
      const next = radios.nth(1);
      const nextName = (await next.getAttribute("aria-label")) as string;
      expect(nextName).toBeTruthy();
      expect(nextName).not.toMatch(/già usato/);

      await colorRadio(page, "Pomodoro").focus();
      await expect(colorRadio(page, "Pomodoro")).toBeFocused();

      await page.keyboard.press("ArrowRight");
      await expect(next).toBeFocused();
      await expect(next).toHaveAttribute("aria-checked", "true");
      await expect(colorRadio(page, "Pomodoro")).toHaveAttribute(
        "aria-checked",
        "false",
      );
      await expect.poll(() => colorOf(user.id)).toBe(nextName.toLowerCase());

      await page.keyboard.press("Tab");
      await expect(colorGroup(page).locator(":focus")).toHaveCount(0);
    });
  });

  test("CA-12: se qualcuno prende il colore intanto, resta il vecchio e compare l'avviso", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, addPet }) => {
      await user.signInContext(page.context(), baseURL as string);
      await openProfile(page);
      await waitHydrated(colorRadio(page, "Ceruleo"));
      await expect(colorRadio(page, "Ceruleo")).toBeEnabled();

      // Meanwhile an animal with the colour «ceruleo» joins the Nest.
      await addPet("Fido", "ceruleo");

      await colorRadio(page, "Ceruleo").click();
      await expect(alertWith(page, COLOR_TAKEN_ERROR)).toHaveText(
        COLOR_TAKEN_ERROR,
      );
      await expect(colorRadio(page, "Pomodoro")).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await expect(colorRadio(page, "Ceruleo (già usato)")).toBeDisabled();
      expect(await colorOf(user.id)).toBe("pomodoro");
    });
  });

  test("CA-13: se il salvataggio dà 500 resta il colore di prima e c'è l'avviso del server", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user }) => {
      await user.signInContext(page.context(), baseURL as string);
      await breakWrites(page, "household_members", "server");
      await openProfile(page);
      await waitHydrated(colorRadio(page, "Lampone"));
      const refreshes = countRefreshes(page);

      await colorRadio(page, "Lampone").click();
      const alert = alertWith(page, COLOR_SERVER_ERROR);
      await expect(alert).toHaveText(COLOR_SERVER_ERROR);
      await expect(colorRadio(page, "Pomodoro")).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await expect(headAvatar(page)).toHaveClass(/membro-pomodoro/);
      expect(await colorOf(user.id)).toBe("pomodoro");
      // Nothing was saved: the page does not read again.
      expect(refreshes()).toBe(0);
    });
  });

  test("CA-13: se il salvataggio non arriva (rete) il testo parla di connessione", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user }) => {
      await user.signInContext(page.context(), baseURL as string);
      await breakWrites(page, "household_members", "network");
      await openProfile(page);
      await waitHydrated(colorRadio(page, "Lampone"));

      await colorRadio(page, "Lampone").click();
      await expect(alertWith(page, COLOR_NETWORK_ERROR)).toHaveText(
        COLOR_NETWORK_ERROR,
      );
      await expect(colorRadio(page, "Pomodoro")).toHaveAttribute(
        "aria-checked",
        "true",
      );
      expect(await colorOf(user.id)).toBe("pomodoro");
    });
  });
});

// ------------------------------------------------------------ Come usi l'app

test.describe("Come usi l'app: scelte", () => {
  test("CA-15: «All'apertura» = «Nest» chiude il foglio, si salva e la pagina rilegge", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user }) => {
      await user.signInContext(page.context(), baseURL as string);
      await openProfile(page);
      const refreshes = countRefreshes(page);
      await valueOf(page, "All'apertura").click();
      const sheet = sheetOf(page, "All'apertura");
      await expect(sheet).toBeVisible();
      await radioIn(sheet, /^Nest/).click();

      await expect(sheet).toBeHidden();
      await expect(valueOf(page, "All'apertura")).toHaveText("Nest");
      await expect
        .poll(async () => (await profileOf(user.id))?.start_lens)
        .toBe("nest");
      // router.refresh() after a saved preference (note of the coordinator).
      await expect.poll(refreshes).toBeGreaterThan(0);

      await page.reload();
      await expect(valueOf(page, "All'apertura")).toHaveText("Nest");
    });
  });

  test("CA-16: «Sintesi del mattino» ha nove orari come chip, «7:30» scelto; «8:30» si salva", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user }) => {
      await user.signInContext(page.context(), baseURL as string);
      await openProfile(page);
      await valueOf(page, "Sintesi del mattino").click();
      const sheet = sheetOf(page, "Sintesi del mattino");
      await expect(sheet).toBeVisible();
      const chips = sheet.getByRole("button", { name: /^\d{1,2}:\d{2}$/ });
      await expect(chips).toHaveText([
        "6:00",
        "6:30",
        "7:00",
        "7:30",
        "8:00",
        "8:30",
        "9:00",
        "9:30",
        "10:00",
      ]);
      const pressed = await chips.evaluateAll((els) =>
        els
          .filter((el) => el.getAttribute("aria-pressed") === "true")
          .map((el) => el.textContent),
      );
      expect(pressed).toEqual(["7:30"]);

      await chips.filter({ hasText: /^8:30$/ }).click();
      await expect(sheet).toBeHidden();
      await expect(valueOf(page, "Sintesi del mattino")).toHaveText("8:30");
      await expect
        .poll(async () => (await profileOf(user.id))?.morning_digest_time)
        .toMatch(/^08:30/);
    });
  });

  test("CA-17: «Visibilità predefinita» ha tre scelte, «Occupato» scelta; «Solo io» si salva", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user }) => {
      await user.signInContext(page.context(), baseURL as string);
      await openProfile(page);
      const refreshes = countRefreshes(page);
      await valueOf(page, "Visibilità predefinita").click();
      const sheet = sheetOf(page, "Visibilità predefinita");
      await expect(sheet).toBeVisible();
      const radios = sheet.getByRole("radio");
      await expect(radios).toHaveCount(3);
      await expect(radioIn(sheet, /^Solo io/)).toBeVisible();
      await expect(radioIn(sheet, /^Occupato/)).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await expect(radioIn(sheet, /^Tutto il Nest/)).toBeVisible();

      await radioIn(sheet, /^Solo io/).click();
      await expect(sheet).toBeHidden();
      await expect(valueOf(page, "Visibilità predefinita")).toHaveText(
        "Solo io",
      );
      await expect
        .poll(async () => (await profileOf(user.id))?.default_event_visibility)
        .toBe("private");
      await expect.poll(refreshes).toBeGreaterThan(0);
    });
  });

  test("CA-18: Esc chiude il foglio senza cambiare niente", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user }) => {
      await user.signInContext(page.context(), baseURL as string);
      await openProfile(page);
      await valueOf(page, "All'apertura").click();
      const sheet = sheetOf(page, "All'apertura");
      await expect(sheet).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();
      await expect(valueOf(page, "All'apertura")).toHaveText("Io");
      expect((await profileOf(user.id))?.start_lens).toBe("io");
    });
  });

  test("CA-19: se il salvataggio dà 500 la riga resta «Io» e c'è l'avviso del server", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user }) => {
      await user.signInContext(page.context(), baseURL as string);
      await breakWrites(page, "profiles", "server");
      await openProfile(page);
      const refreshes = countRefreshes(page);
      await valueOf(page, "All'apertura").click();
      const sheet = sheetOf(page, "All'apertura");
      await expect(sheet).toBeVisible();
      await radioIn(sheet, /^Nest/).click();

      await expect(alertWith(page, PREFERENCE_SERVER_ERROR)).toHaveText(
        PREFERENCE_SERVER_ERROR,
      );
      await expect(valueOf(page, "All'apertura")).toHaveText("Io");
      expect((await profileOf(user.id))?.start_lens).toBe("io");
      expect(refreshes()).toBe(0);
    });
  });

  test("CA-19: se il salvataggio non arriva (rete) il testo parla di connessione", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user }) => {
      await user.signInContext(page.context(), baseURL as string);
      await breakWrites(page, "profiles", "network");
      await openProfile(page);
      await valueOf(page, "Sintesi del mattino").click();
      const sheet = sheetOf(page, "Sintesi del mattino");
      await expect(sheet).toBeVisible();
      await sheet.getByRole("button", { name: /^9:00$/ }).click();

      await expect(alertWith(page, PREFERENCE_NETWORK_ERROR)).toHaveText(
        PREFERENCE_NETWORK_ERROR,
      );
      await expect(valueOf(page, "Sintesi del mattino")).toHaveText("7:30");
      expect((await profileOf(user.id))?.morning_digest_time).toMatch(/^07:30/);
    });
  });
});

// ------------------------------------------- effetti fuori da questa pagina

test.describe("effetti su Oggi e su Aggiungi", () => {
  test("CA-20: «All'apertura» = «Nest» scelto nel profilo apre Oggi sulla lente «Nest» alla prossima apertura", async ({
    page,
    baseURL,
    browser,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user }) => {
      await user.signInContext(page.context(), baseURL as string);
      await openProfile(page);
      await valueOf(page, "All'apertura").click();
      await radioIn(sheetOf(page, "All'apertura"), /^Nest/).click();
      await expect(valueOf(page, "All'apertura")).toHaveText("Nest");
      await expect
        .poll(async () => (await profileOf(user.id))?.start_lens)
        .toBe("nest");

      // A new session of the browser: the lens starts from the profile.
      const fresh = await browser.newContext({
        baseURL,
        viewport: page.viewportSize() ?? undefined,
      });
      try {
        await user.signInContext(fresh, baseURL as string);
        const oggi = await fresh.newPage();
        await oggi.goto("/oggi");
        await expect(lensButton(oggi, "Nest")).toHaveAttribute(
          "aria-pressed",
          "true",
        );
        // Touching «Io» holds after a reload in the same session.
        await chooseLens(oggi, "Io");
        await oggi.reload();
        await expect(lensButton(oggi, "Io")).toHaveAttribute(
          "aria-pressed",
          "true",
        );
      } finally {
        await fresh.close();
      }
    });
  });

  test("CA-21: la visibilità scelta nel profilo vale in Aggiungi con la lente «Io», non con «Nest»", async ({
    page,
    baseURL,
    casa,
  }) => {
    const marco = casa.users["Marco"]!;
    await casa.signIn(page, baseURL, "Marco");
    await openProfile(page);
    await valueOf(page, "Visibilità predefinita").click();
    await radioIn(sheetOf(page, "Visibilità predefinita"), /^Solo io/).click();
    await expect(valueOf(page, "Visibilità predefinita")).toHaveText("Solo io");
    await expect
      .poll(async () => (await profileOf(marco.id))?.default_event_visibility)
      .toBe("private");

    const save = async (lens: "io" | "nest") => {
      const add = await page.context().newPage();
      await openAdd(add, baseURL, casa, "Marco", { lens });
      await fieldOf(add).fill(PHRASE);
      await dialogOf(add)
        .getByRole("button", { name: "Metti in giovedì 22" })
        .click();
      await expect(dialogOf(add)).toHaveCount(0);
      await add.close();
    };

    await save("io");
    await expect
      .poll(async () => (await eventsOf(casa)).map((r) => r.visibility))
      .toEqual(["private"]);
    await save("nest");
    await expect
      .poll(async () => (await eventsOf(casa)).map((r) => r.visibility).sort())
      .toEqual(["household", "private"]);
  });
});
