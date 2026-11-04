import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { waitForAnimationsToEnd } from "../fixtures/animations";
import { hasTestUser, signInAs } from "../fixtures/visual-login";
import {
  baseURL,
  failWrites,
  fakeDeletion,
  openProfile,
} from "../fixtures/profilo-visuale";

// PR #235 (#38): axe on every state of /profilo (normal, the three sheets, the
// two dialogs, the errors, the toast) and on /accesso?account=eliminato, plus
// the keyboard: order of the focus, visible ring, Esc and return of the focus,
// no trap, 44 px touch areas at 390 px. Only read paths and fake answers: no
// data is written.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
  acceptDownloads: true,
});

type Key = "A" | "B" | "B2";
async function signIn(page: Page, key: Key) {
  const ok =
    hasTestUser(key as "A") &&
    (await signInAs(page.context(), baseURL(), key as "A"));
  test.skip(!ok, `Utente di prova ${key} non disponibile`);
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations
      .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
}

const dialog = (page: Page) => page.getByRole("alertdialog");

const freeColor = (page: Page) =>
  page.locator('[role="radio"][aria-checked="false"]:not([disabled])').first();

/** True when the 44 x 44 area centred on the element hits the element. */
async function hasTouchArea(page: Page, target: Locator) {
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;
  const handle = await target.elementHandle();
  return page.evaluate(
    ({ x, y, el }) =>
      [
        [x - 21, y],
        [x + 21, y],
        [x, y - 21],
        [x, y + 21],
      ].every(([px, py]) => {
        const hit = document.elementFromPoint(px!, py!);
        return !!hit && (el!.contains(hit) || hit.contains(el!));
      }),
    { x: cx, y: cy, el: handle },
  );
}

const focusedText = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return "";
    return (el.getAttribute("aria-label") ?? el.textContent ?? "")
      .replace(/\s+/g, " ")
      .trim();
  });

const focusRingVisible = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    const s = getComputedStyle(el);
    return (
      (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) ||
      s.boxShadow !== "none"
    );
  });

test.describe("pagina (utente A)", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "A");
    await openProfile(page, "Marco D'Angelo");
  });

  test("#38: normale, un solo h1, titoli, colori e righe con il nome giusto", async ({
    page,
  }) => {
    await expect(page.locator("h1:visible")).toHaveCount(1);
    await expect(page.locator("main")).toHaveCount(1);
    for (const name of ["Come usi l'app", "Account"]) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    }
    await expect(
      page.getByRole("button", {
        name: "All'apertura La lente con cui si apre Oggi Io",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: "Calendari collegati Nessuno collegato",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "I tuoi dati Scarica tutto quello che hai inserito",
      }),
    ).toBeVisible();
    // «Accesso» is information only: no button, no link, no arrow.
    await expect(page.getByRole("button", { name: /^Accesso/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Accesso/ })).toHaveCount(0);
    // The ten colours, the taken ones are off and say so.
    await expect(page.getByRole("radio")).toHaveCount(10);
    await expect(
      page.locator('[role="radio"][disabled][aria-label$="(già usato)"]'),
    ).not.toHaveCount(0);
    await axe(page);
  });

  for (const [row, title] of [
    [/^All'apertura/, "All'apertura"],
    [/^Sintesi del mattino/, "Sintesi del mattino"],
    [/^Visibilità predefinita/, "Visibilità predefinita"],
  ] as const) {
    test(`#38: foglio «${title}»: axe, Esc, fuoco di ritorno`, async ({
      page,
    }) => {
      const trigger = page.getByRole("button", { name: row });
      await trigger.click();
      await expect(page.getByRole("dialog", { name: title })).toBeVisible();
      await waitForAnimationsToEnd(page);
      await axe(page);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: title })).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });
  }

  test("#38: fogli a scelta, frecce spostano solo il fuoco", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /^All'apertura/ }).click();
    const group = page.getByRole("radiogroup", { name: "All'apertura" });
    await expect(group).toBeVisible();
    await waitForAnimationsToEnd(page);
    await expect(group.getByRole("radio", { name: /^Io/ })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(group.getByRole("radio", { name: /^Nest/ })).toBeFocused();
    // The sheet is still open and nothing was chosen.
    await expect(group.getByRole("radio", { name: /^Io/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.keyboard.press("ArrowDown");
    await expect(group.getByRole("radio", { name: /^Io/ })).toBeFocused();
  });

  test("#38: foglio «Sintesi del mattino»: chip, uno scelto", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /^Sintesi del mattino/ }).click();
    const chips = page.getByRole("group", { name: "Ora della sintesi" });
    await expect(chips.getByRole("button")).toHaveCount(9);
    await expect(chips.locator('[aria-pressed="true"]')).toHaveCount(1);
    await waitForAnimationsToEnd(page);
    await axe(page);
  });

  test("#38: dialogo «Esci»: axe, fuoco su «Annulla», Esc, ritorno", async ({
    page,
  }) => {
    const trigger = page.getByRole("button", { name: "Esci", exact: true });
    await trigger.click();
    await expect(dialog(page)).toContainText("Uscire da FamilyNest?");
    await waitForAnimationsToEnd(page);
    await expect(
      dialog(page).getByRole("button", { name: "Annulla" }),
    ).toBeFocused();
    await axe(page);
    // The focus does not leave the dialog: three Tab presses and it is still inside.
    for (let i = 0; i < 3; i++) await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => !!document.activeElement?.closest('[role="alertdialog"]'),
      ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("#38: dialogo «Esci», non riuscito: axe e avviso annunciato", async ({
    page,
  }) => {
    await page.route("**/auth/signout", (route) => route.abort("failed"));
    await page.getByRole("button", { name: "Esci", exact: true }).click();
    await dialog(page).getByRole("button", { name: "Esci" }).click();
    await expect(dialog(page).getByRole("alert")).toContainText(
      "Non siamo riusciti a farti uscire",
    );
    await axe(page);
  });

  test("#38: dialogo «Elimina l'account» (ultimo adulto): axe e fuoco", async ({
    page,
  }) => {
    const trigger = page.getByRole("button", { name: "Elimina l'account" });
    await trigger.click();
    await expect(
      dialog(page).getByRole("button", { name: "Esci e cancella la casa" }),
    ).toBeVisible();
    await waitForAnimationsToEnd(page);
    await expect(
      dialog(page).getByRole("button", { name: "Annulla" }),
    ).toBeFocused();
    await axe(page);
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("#38: dialogo «Elimina l'account», errore: axe", async ({ page }) => {
    await fakeDeletion(page, "server");
    await page.getByRole("button", { name: "Elimina l'account" }).click();
    await dialog(page)
      .getByRole("button", { name: "Esci e cancella la casa" })
      .click();
    await expect(dialog(page).getByRole("alert")).toContainText(
      "per un problema nostro",
    );
    await axe(page);
  });

  test("#38: avvisi di colore e di preferenza: axe e role=alert", async ({
    page,
  }) => {
    await failWrites(page, "household_members", "server");
    await failWrites(page, "profiles", "network");
    await freeColor(page).click();
    await expect(page.getByRole("alert")).toHaveCount(1);
    await page.getByRole("button", { name: /^All'apertura/ }).click();
    await page.getByRole("radio", { name: /^Nest/ }).click();
    // One alert per block: colour and preferences together.
    await expect(page.getByRole("alert")).toHaveCount(2);
    await axe(page);
  });

  test("#38: «I tuoi dati»: attesa, errore e toast", async ({ page }) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/profilo/dati", async (route) => {
      await gate;
      await route.fulfill({ status: 500, json: { ok: false } });
    });
    const row = page.getByRole("button", { name: /^I tuoi dati/ });
    await row.click();
    await expect(row).toHaveAttribute("aria-busy", "true");
    await expect(row).toHaveAttribute("aria-disabled", "true");
    await axe(page);
    release();
    await expect(page.getByRole("alert")).toContainText(
      "per un problema nostro",
    );
    await axe(page);
    await page.unroute("**/profilo/dati");
    const download = page.waitForEvent("download");
    await row.click();
    await download;
    await expect(page.getByRole("status")).toContainText("Dati scaricati");
    await waitForAnimationsToEnd(page);
    await axe(page);
  });

  test("#38: tastiera, ordine del fuoco e anello visibile", async ({
    page,
  }, testInfo) => {
    const expected = [
      "Il tuo colore", // the group: one tab stop (the chosen colour)
      "All'apertura",
      "Sintesi del mattino",
      "Visibilità predefinita",
      "Calendari collegati",
      "I tuoi dati",
      "Esci",
      "Elimina l'account",
    ];
    const seen: string[] = [];
    let ring = true;
    for (let i = 0; i < 40 && seen.at(-1) !== "Elimina l'account"; i++) {
      await page.keyboard.press("Tab");
      const text = await focusedText(page);
      const inColors = await page.evaluate(
        () =>
          document.activeElement?.getAttribute("role") === "radio" &&
          !!document.activeElement.closest('[role="radiogroup"]'),
      );
      seen.push(inColors ? "Il tuo colore" : text);
      if (!(await focusRingVisible(page))) ring = false;
    }
    expect(ring, "anello di focus visibile su ogni elemento").toBe(true);
    // The colour group is a single tab stop and «Accesso» takes no focus.
    expect(seen.filter((s) => s === "Il tuo colore")).toHaveLength(1);
    expect(seen.some((s) => s.startsWith("Accesso"))).toBe(false);
    // The page's own stops come in this order (the frame comes before).
    const own = seen.slice(seen.indexOf("Il tuo colore"));
    expect(own.length).toBe(expected.length);
    expected.forEach((name, i) => {
      expect(own[i]!.startsWith(name), `${i}: ${own[i]}`).toBe(true);
    });
    if (testInfo.project.name === "mobile") {
      expect(seen.indexOf("Indietro")).toBeGreaterThanOrEqual(0);
      expect(seen.indexOf("Indietro")).toBeLessThan(
        seen.indexOf("Il tuo colore"),
      );
    } else {
      expect(seen[0]).toBe("Vai al contenuto");
    }
  });

  test("#38: frecce nei colori: saltano i colori già usati", async ({
    page,
  }) => {
    const group = page.getByRole("radiogroup", { name: "Il tuo colore" });
    await group.locator('[role="radio"][aria-checked="true"]').focus();
    const visited: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("ArrowRight");
      visited.push(await focusedText(page));
    }
    expect(visited.some((n) => n.includes("(già usato)"))).toBe(false);
  });

  test("#38: aree di tocco di almeno 44 px (390)", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "solo mobile");
    const targets: Locator[] = [
      page.getByRole("link", { name: "Indietro" }),
      page.locator('[role="radio"][aria-checked="true"]'),
      page.locator('[role="radio"]:not([disabled])').last(),
      page.getByRole("button", { name: /^All'apertura/ }),
      page.getByRole("button", { name: /^Sintesi del mattino/ }),
      page.getByRole("button", { name: /^Visibilità predefinita/ }),
      page.getByRole("link", { name: /^Calendari collegati/ }),
      page.getByRole("button", { name: /^I tuoi dati/ }),
      page.getByRole("button", { name: "Esci", exact: true }),
      page.getByRole("button", { name: "Elimina l'account" }),
    ];
    for (const target of targets) {
      const box = await target.boundingBox();
      expect(box, String(target)).not.toBeNull();
      const wide = box!.width >= 44 && box!.height >= 44;
      expect(wide || (await hasTouchArea(page, target)), String(target)).toBe(
        true,
      );
    }
    // The chips of the time sheet and the buttons of the dialogs.
    await page.getByRole("button", { name: /^Sintesi del mattino/ }).click();
    await waitForAnimationsToEnd(page);
    const chip = page
      .getByRole("group", { name: "Ora della sintesi" })
      .getByRole("button")
      .first();
    expect(await hasTouchArea(page, chip)).toBe(true);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Esci", exact: true }).click();
    await waitForAnimationsToEnd(page);
    for (const name of ["Esci", "Annulla"]) {
      const box = await dialog(page)
        .getByRole("button", { name })
        .boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe("dialogo dell'altro adulto (utente B e B2)", () => {
  for (const key of ["B", "B2"] as const) {
    test(`#38: «Elimina l'account», resta un altro adulto (${key}): axe`, async ({
      page,
    }) => {
      await signIn(page, key);
      await openProfile(page);
      await page.getByRole("button", { name: "Elimina l'account" }).click();
      await expect(dialog(page)).toContainText("resterà a");
      await expect(
        dialog(page).getByRole("button", { name: "Elimina l'account" }),
      ).toBeVisible();
      await waitForAnimationsToEnd(page);
      await axe(page);
    });
  }
});

test.describe("accesso dopo l'eliminazione", () => {
  test("#38: avviso su /accesso?account=eliminato: axe, role=status", async ({
    page,
  }) => {
    await page.goto("/accesso?account=eliminato");
    await expect(page.locator("h1:visible")).toHaveCount(1);
    await expect(page.getByRole("status")).toContainText(
      "Il tuo account è stato eliminato.",
    );
    await axe(page);
  });
});
