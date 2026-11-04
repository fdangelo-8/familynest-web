import { expect, test } from "../fixtures/casa";
import {
  chooseLens,
  lensButton,
  pressedLenses,
  setPreferences,
  watchHydration,
} from "../fixtures/preferenze";

// Initial lens of the app frame (issue #231, tests a-d of the review): the lens
// is the one chosen in the profile (`profiles.start_lens`) until the person
// touches it in this browser session. Each test uses its own throwaway users.

const LENS_KEY = "familynest.lens";

test.describe("lente iniziale (#231)", () => {
  test("a) con start_lens = nest la lente è già «Nest» nell'HTML del server, senza errori di idratazione", async ({
    page,
    baseURL,
    casa,
  }) => {
    await setPreferences(casa.users["Marco"]!, { start_lens: "nest" });
    await casa.signIn(page, baseURL, "Marco");

    // The document as the server writes it, before any script runs.
    const response = await page.request.get("/oggi");
    expect(response.status()).toBe(200);
    expect(pressedLenses(await response.text())).toEqual(["Nest"]);

    const hydrationErrors = watchHydration(page);
    await page.goto("/oggi");
    await expect(lensButton(page, "Nest")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(lensButton(page, "Io")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    // A click that changes the state proves the page is hydrated.
    await chooseLens(page, "Io");
    await chooseLens(page, "Nest");
    expect(hydrationErrors()).toEqual([]);
  });

  test("a) con start_lens = io (predefinito) la lente è «Io» nell'HTML del server", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.signIn(page, baseURL, "Marco");
    const response = await page.request.get("/oggi");
    expect(response.status()).toBe(200);
    expect(pressedLenses(await response.text())).toEqual(["Io"]);
  });

  test("b) «Io» toccato resta dopo un ricaricamento, anche se il profilo dice «Nest»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await setPreferences(casa.users["Marco"]!, { start_lens: "nest" });
    await casa.signIn(page, baseURL, "Marco");
    await page.goto("/oggi");
    await chooseLens(page, "Io");

    await page.reload();
    await expect(lensButton(page, "Io")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(lensButton(page, "Nest")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      await page.evaluate(
        (key) => window.sessionStorage.getItem(key),
        LENS_KEY,
      ),
    ).toBe("io");
  });

  test("c) un contesto nuovo del browser riparte da «Nest»", async ({
    page,
    browser,
    baseURL,
    casa,
  }) => {
    await setPreferences(casa.users["Marco"]!, { start_lens: "nest" });
    await casa.signIn(page, baseURL, "Marco");
    await page.goto("/oggi");
    await chooseLens(page, "Io");

    const fresh = await browser.newContext({
      viewport: page.viewportSize() ?? undefined,
    });
    try {
      await casa.signInContext(fresh, baseURL, "Marco");
      const other = await fresh.newPage();
      await other.goto(`${baseURL}/oggi`);
      await expect(lensButton(other, "Nest")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(lensButton(other, "Io")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    } finally {
      await fresh.close();
    }
  });

  test("d) una lente «io» salvata nella sessione vince su start_lens = nest", async ({
    page,
    baseURL,
    casa,
  }) => {
    await setPreferences(casa.users["Marco"]!, { start_lens: "nest" });
    await page.addInitScript(
      ([key]) => window.sessionStorage.setItem(key!, "io"),
      [LENS_KEY],
    );
    await casa.signIn(page, baseURL, "Marco");
    await page.goto("/oggi");
    await expect(lensButton(page, "Io")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(lensButton(page, "Nest")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("d) una lente «nest» salvata nella sessione vince su start_lens = io", async ({
    page,
    baseURL,
    casa,
  }) => {
    await page.addInitScript(
      ([key]) => window.sessionStorage.setItem(key!, "nest"),
      [LENS_KEY],
    );
    await casa.signIn(page, baseURL, "Marco");
    await page.goto("/oggi");
    await expect(lensButton(page, "Nest")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("isolamento: la lente iniziale di un Nest non cambia quella di un altro", async ({
    page,
    baseURL,
    casa,
    bianchi,
  }) => {
    await setPreferences(bianchi.users["Giulia"]!, { start_lens: "nest" });
    await casa.signIn(page, baseURL, "Marco");
    await page.goto("/oggi");
    await expect(lensButton(page, "Io")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(lensButton(page, "Nest")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
