import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";
import {
  answerContinue,
  caseNest,
  caseVisitor,
  giuliaInOtherNest,
  holdProviderSignIn,
  openColor,
  openLink,
  removeShared,
  shown,
  shownText,
  signIn,
  tabNames,
  waitBusyButton,
  waitWelcome,
} from "../visual/invito-ingresso-helpers";

// Accessibility of the invitation entry (#16), visual tester: axe on every
// state of Benvenuto (/invito) and Il tuo colore (/invito/colore), one visible
// h1, no duplicate id, focus order and visible focus, no trap, arrows in the
// colour group, touch areas of 44 px on mobile, roles of the notices. Each
// test has its own throwaway users. Skipped when the keys are not set.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.skip(!throwawayConfigured(), throwawaySkipReason);
test.afterAll(removeShared);

const isMobile = () => test.info().project.name === "mobile";

async function expectNoBlocking(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations
      .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
}

async function expectStructure(page: Page) {
  await expect(page.locator("h1:visible")).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
  const dup = await page.evaluate(() => {
    const ids = Array.from(document.querySelectorAll("[id]")).map((e) => e.id);
    return ids.filter((id, i) => ids.indexOf(id) !== i);
  });
  expect(dup).toEqual([]);
}

/** The four corners of a 44 x 44 box around the control reach the control. */
async function expectTouchArea(locator: Locator, what: string) {
  await locator.scrollIntoViewIfNeeded();
  const result = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const misses: string[] = [];
    for (const [dx, dy] of [
      [-21, -21],
      [21, -21],
      [-21, 21],
      [21, 21],
    ] as const) {
      const hit = document.elementFromPoint(cx + dx, cy + dy);
      if (!hit || !(el === hit || el.contains(hit))) {
        misses.push(`${dx},${dy} -> ${hit?.tagName}.${hit?.className}`);
      }
    }
    return { width: r.width, height: r.height, misses };
  });
  const bigEnough = result.width >= 44 && result.height >= 44;
  expect(
    bigEnough || result.misses.length === 0,
    `${what}: ${Math.round(result.width)}x${Math.round(result.height)} px, area di 44 px non raggiunta (${result.misses.join("; ")})`,
  ).toBe(true);
}

/** The focused element has a visible ring (outline or shadow). */
async function focusRing(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const cs = getComputedStyle(el);
    const outline =
      cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
    const shadow = cs.boxShadow !== "none";
    return {
      name: el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "",
      visible: outline || shadow,
    };
  });
}

async function expectFocusOrder(page: Page, expected: string[]) {
  const names = await tabNames(page, expected.length);
  expect(names).toEqual(expected);
}

const PRIVATE = ["Sofia", "Tommaso", "Biscotto", "2016-12-14", "2020-04-02"];

test.describe("invito · benvenuto (07) · accessibilità", () => {
  test("normale: axe, un h1, nome del gruppo, nessun nome dei membri", async ({
    page,
  }) => {
    const nest = await caseNest("mockup");
    await openLink(page, nest.token);
    await waitWelcome(page);
    await expectNoBlocking(page);
    await expectStructure(page);
    await expect(
      page.getByRole("img", { name: "Marco e altri 3 nel Nest" }).first(),
    ).toBeAttached();
    // D-1: only initials and colours before the sign-in.
    const html = await page.content();
    for (const secret of [...PRIVATE, nest.token, nest.inviteeId]) {
      expect(html, `la pagina contiene «${secret}»`).not.toContain(secret);
    }
    await expect(page.locator("[title]")).toHaveCount(0);
  });

  test("molti membri: axe, +N, nome del gruppo", async ({ page }) => {
    const nest = await caseNest("molti");
    await openLink(page, nest.token);
    await waitWelcome(page);
    await expectNoBlocking(page);
    await expectStructure(page);
    await expect(
      page.getByRole("img", { name: "Marco e altri 8 nel Nest" }).first(),
    ).toBeAttached();
    await expect(
      page.locator(".avatar--altri").filter({ visible: true }),
    ).toHaveText("+6");
  });

  test("tastiera: ordine del fuoco, anello visibile, nessuna trappola, aree di tocco", async ({
    page,
  }) => {
    const nest = await caseNest("mockup");
    await openLink(page, nest.token);
    await waitWelcome(page);
    const expected = [
      "Entra con Apple",
      "Entra con Google",
      "Usa la mail",
      "Termini d'uso",
      "Informativa sulla privacy",
    ];
    await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.blur(),
    );
    const seen: string[] = [];
    for (let i = 0; i < expected.length; i += 1) {
      await page.keyboard.press("Tab");
      const ring = await focusRing(page);
      seen.push(ring.name);
      expect(ring.visible, `anello su ${ring.name}`).toBe(true);
    }
    expect(seen).toEqual(expected);
    // No trap: one more Tab leaves the last control.
    await page.keyboard.press("Tab");
    const after = await page.evaluate(
      () => document.activeElement?.textContent?.trim() ?? "",
    );
    expect(after).not.toBe("Informativa sulla privacy");
    if (isMobile()) {
      for (const name of ["Entra con Apple", "Entra con Google"]) {
        await expectTouchArea(shown(page, "button", name), name);
      }
      await expectTouchArea(shown(page, "link", "Usa la mail"), "Usa la mail");
    }
  });

  test("accesso in corso: axe, aria-busy, altro bottone e «Usa la mail» spenti", async ({
    page,
  }) => {
    const nest = await caseNest("mockup");
    await holdProviderSignIn(page);
    await openLink(page, nest.token);
    await waitWelcome(page);
    await shown(page, "button", "Entra con Google").click({
      noWaitAfter: true,
    });
    await waitBusyButton(page, "Accesso con Google in corso");
    const state = await page.evaluate(() => ({
      appleDisabled: Array.from(document.querySelectorAll("button"))
        .filter((b) => b.getBoundingClientRect().width > 0)
        .find((b) => b.textContent?.includes("Entra con Apple"))?.disabled,
      mailDisabled: Array.from(document.querySelectorAll("a"))
        .filter((a) => a.getBoundingClientRect().width > 0)
        .find((a) => a.textContent?.trim() === "Usa la mail")
        ?.getAttribute("aria-disabled"),
    }));
    expect(state).toEqual({ appleDisabled: true, mailDisabled: "true" });
    await expectNoBlocking(page);
  });

  test("accesso non riuscito e annullato: ruoli e axe", async ({ page }) => {
    const nest = await caseNest("mockup");
    await openLink(page, nest.token);
    await page.goto("/invito?errore=google");
    const failed = shownText(page, "alert", "Accesso con Google non riuscito.");
    await expect(failed).toBeVisible();
    await expect(failed.getByRole("button", { name: "Riprova" })).toBeVisible();
    await expectNoBlocking(page);
    await expectStructure(page);
    await page.goto("/invito?errore=google&annullato=1");
    await expect(
      shownText(page, "status", "Accesso con Google annullato."),
    ).toBeVisible();
    await expectNoBlocking(page);
  });

  test("invito scaduto: axe, un h1, un solo controllo", async ({ page }) => {
    await page.goto(`/invito/${"a1".repeat(32)}`);
    await page.locator("h1:visible").first().waitFor();
    await expectNoBlocking(page);
    await expectStructure(page);
    await expect(page.locator("h1:visible")).toHaveText(
      isMobile() ? /Questo invito\s*non vale più\./ : "Invito non più valido",
    );
    await expectFocusOrder(page, ["Entra in FamilyNest"]);
    if (isMobile()) {
      await expectTouchArea(
        shown(page, "link", "Entra in FamilyNest"),
        "Entra in FamilyNest",
      );
    }
  });

  test("già in un altro Nest: axe, un h1, un solo controllo", async ({
    page,
    baseURL,
  }) => {
    const nest = await caseNest("mockup");
    const giulia = await giuliaInOtherNest();
    await signIn(page, baseURL, giulia);
    await page.goto(`/invito/${nest.token}`);
    await page.locator("h1:visible").first().waitFor();
    await expectNoBlocking(page);
    await expectStructure(page);
    await expect(page.locator("h1:visible")).toHaveText(
      isMobile() ? /Sei già\s*in un altro Nest\./ : "Già in un altro Nest",
    );
    await expectFocusOrder(page, ["Vai a Oggi"]);
    const html = await page.content();
    for (const secret of ["Casa D'Angelo", "Marco", "Laura"]) {
      expect(html, `la pagina contiene «${secret}»`).not.toContain(secret);
    }
  });

  test.describe("caricamento della pagina", () => {
    test.use({ javaScriptEnabled: false });

    test("scheletro: aria-busy, nessun h1, forme nascoste", async ({
      page,
    }) => {
      await page.goto("/invito");
      await expect(
        page.getByText("Caricamento in corso").first(),
      ).toBeAttached();
      await expect(page.locator("[aria-busy='true']").first()).toBeAttached();
      await expect(page.locator("h1:visible")).toHaveCount(0);
      // axe needs scripts, which are off here: the shapes are aria-hidden.
      await expect(
        page.locator(".skeleton:not([aria-hidden='true'])"),
      ).toHaveCount(0);
    });
  });
});

test.describe("invito · il tuo colore (08) · accessibilità", () => {
  test("normale: axe, un h1, barra dei passi, gruppo di dieci colori", async ({
    page,
    baseURL,
  }) => {
    const nest = await caseNest("mockup");
    const laura = await caseVisitor("mockup");
    await openColor(page, baseURL, laura, nest.token);
    await expectNoBlocking(page);
    await expectStructure(page);
    await expect(
      page.getByRole("progressbar", { name: "Passo 1 di 3" }).filter({
        visible: true,
      }),
    ).toHaveAttribute("aria-valuenow", "1");
    const group = shown(page, "radiogroup", "Il tuo colore");
    await expect(group.getByRole("radio")).toHaveCount(10);
    await expect(group.getByRole("radio", { name: "Glicine" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    for (const name of [
      "Pomodoro (già di Marco)",
      "Salvia (già di Sofia)",
      "Cobalto (già di Tommaso)",
      "Zafferano (già di Biscotto)",
    ]) {
      await expect(group.getByRole("radio", { name })).toBeDisabled();
    }
  });

  test("tastiera: ordine del fuoco, frecce, anello visibile, aree di tocco", async ({
    page,
    baseURL,
  }) => {
    const nest = await caseNest("mockup");
    const laura = await caseVisitor("mockup");
    await openColor(page, baseURL, laura, nest.token);
    const expected = isMobile()
      ? ["Indietro", "Glicine", "Continua"]
      : ["Glicine", "Indietro", "Continua"];
    await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.blur(),
    );
    const seen: string[] = [];
    for (let i = 0; i < expected.length; i += 1) {
      await page.keyboard.press("Tab");
      const ring = await focusRing(page);
      seen.push(ring.name);
      expect(ring.visible, `anello su ${ring.name}`).toBe(true);
    }
    expect(seen).toEqual(expected);
    // No trap: one more Tab leaves «Continua».
    await page.keyboard.press("Tab");
    const after = await page.evaluate(
      () => document.activeElement?.textContent?.trim() ?? "",
    );
    expect(after).not.toBe("Continua");

    // Arrows: one stop in the group, the order shown, disabled colours skipped.
    await shown(page, "radio", "Glicine").focus();
    const active = () =>
      page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    const walked: (string | null | undefined)[] = [];
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("ArrowRight");
      walked.push(await active());
    }
    expect(walked).toEqual([
      "Lampone",
      "Ceruleo",
      "Peonia",
      "Basilico",
      "Cannella",
      "Glicine",
    ]);
    await page.keyboard.press("ArrowLeft");
    expect(await active()).toBe("Cannella");
    await expect(shown(page, "radio", "Cannella")).toHaveAttribute(
      "aria-checked",
      "true",
    );

    if (isMobile()) {
      for (const name of ["Indietro", "Continua"]) {
        await expectTouchArea(
          shown(page, name === "Indietro" ? "link" : "button", name),
          name,
        );
      }
      for (const name of [
        "Glicine",
        "Lampone",
        "Ceruleo",
        "Peonia",
        "Basilico",
        "Cannella",
      ]) {
        await expectTouchArea(shown(page, "radio", name), name);
      }
    }
  });

  test("continua in corso: aria-busy, colori spenti, axe", async ({
    page,
    baseURL,
  }) => {
    const nest = await caseNest("mockup");
    const laura = await caseVisitor("mockup");
    await answerContinue(page, "hold");
    await openColor(page, baseURL, laura, nest.token);
    await shown(page, "button", "Continua").click();
    await expect(shown(page, "button", "Continua")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(
      shown(page, "radiogroup", "Il tuo colore").getByRole("radio", {
        name: "Glicine",
      }),
    ).toBeDisabled();
    await expect(shown(page, "link", "Indietro")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expectNoBlocking(page);
  });

  test("colore preso: avviso role alert, fuoco sul colore, axe", async ({
    page,
    baseURL,
  }) => {
    const nest = await caseNest("mockup");
    const laura = await caseVisitor("mockup");
    await answerContinue(page, {
      status: "taken",
      taken: [
        { color: "pomodoro", by: "Marco" },
        { color: "peonia", by: "Pietro" },
      ],
    });
    await openColor(page, baseURL, laura, nest.token);
    await shown(page, "radio", "Peonia").click();
    await shown(page, "button", "Continua").click();
    await expect(
      shownText(
        page,
        "alert",
        "Pietro ha appena preso la peonia. Scegli un altro colore.",
      ),
    ).toBeVisible();
    // The focus goes back to the colour the inviter gave.
    await expect(shown(page, "radio", "Glicine")).toBeFocused();
    await expect(shown(page, "radio", "Peonia (già di Pietro)")).toBeDisabled();
    await expectNoBlocking(page);
    await expectStructure(page);
  });

  test("nessun colore scelto: errore del gruppo collegato, axe", async ({
    page,
    baseURL,
  }) => {
    const nest = await caseNest("mockup");
    const laura = await caseVisitor("mockup");
    await answerContinue(page, {
      status: "taken",
      taken: [{ color: "glicine", by: "Pietro" }],
    });
    await openColor(page, baseURL, laura, nest.token);
    await shown(page, "button", "Continua").click();
    await expect(
      page.locator(".avviso").filter({ visible: true }),
    ).toBeVisible();
    await shown(page, "button", "Continua").click();
    const error = page
      .getByText("Scegli un colore per continuare.")
      .filter({ visible: true });
    await expect(error).toBeVisible();
    const group = shown(page, "radiogroup", "Il tuo colore");
    await expect(group).toHaveAttribute("aria-invalid", "true");
    const described = await group.getAttribute("aria-describedby");
    expect(described).toContain((await error.getAttribute("id")) as string);
    await expectNoBlocking(page);
    await expectStructure(page);
  });

  for (const [label, answer, text] of [
    [
      "rete",
      { status: "error", kind: "network" },
      "Non siamo riusciti ad andare avanti. Controlla la connessione e riprova.",
    ],
    [
      "server",
      { status: "error", kind: "server" },
      "Non siamo riusciti ad andare avanti per un problema nostro.",
    ],
  ] as const) {
    test(`errore di ${label}: role alert con «Riprova», axe`, async ({
      page,
      baseURL,
    }) => {
      const nest = await caseNest("mockup");
      const laura = await caseVisitor("mockup");
      await answerContinue(page, answer);
      await openColor(page, baseURL, laura, nest.token);
      await shown(page, "button", "Continua").click();
      const alert = shownText(page, "alert", text);
      await expect(alert).toBeVisible();
      await expect(
        alert.getByRole("button", { name: "Riprova" }),
      ).toBeVisible();
      await expectNoBlocking(page);
      await expectStructure(page);
    });
  }

  test("Nest al completo: avviso senza azione, controlli spenti, axe", async ({
    page,
    baseURL,
  }) => {
    const nest = await caseNest("mockup");
    const laura = await caseVisitor("mockup");
    await answerContinue(page, { status: "full" });
    await openColor(page, baseURL, laura, nest.token);
    await shown(page, "button", "Continua").click();
    const alert = shownText(
      page,
      "alert",
      "Il Nest è al completo: ci stanno al massimo 10 tra persone e animali.",
    );
    await expect(alert).toBeVisible();
    await expect(alert.getByRole("button")).toHaveCount(0);
    await expect(shown(page, "button", "Continua")).toBeDisabled();
    await expectNoBlocking(page);
    await expectStructure(page);
  });

  test.describe("caricamento della pagina", () => {
    test.use({ javaScriptEnabled: false });

    test("scheletro: aria-busy, forme nascoste", async ({ page, baseURL }) => {
      const nest = await caseNest("mockup");
      const laura = await caseVisitor("mockup");
      await signIn(page, baseURL, laura);
      await page.goto(`/invito/${nest.token}`);
      await page.goto("/invito/colore");
      await expect(
        page.getByText("Caricamento in corso").first(),
      ).toBeAttached();
      await expect(page.locator("[aria-busy='true']").first()).toBeAttached();
      await expect(
        page.locator(".skeleton:not([aria-hidden='true'])"),
      ).toHaveCount(0);
    });
  });
});
