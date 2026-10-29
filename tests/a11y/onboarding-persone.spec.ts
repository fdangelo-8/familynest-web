import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";
import {
  actionAnswer,
  addButton,
  continueButton,
  FAMILY,
  isAction,
  MORE,
  openAddSheet,
  openEditSheet,
  openPeople,
  settle,
  userWithNest,
  type HouseholdType,
} from "../visual/persone-helpers";

// Accessibility of onboarding step 2 "Chi c'è nel Nest?" (#13), at 390 and
// 1280 px (the two projects): axe on every state, focus order and visible
// focus, no trap, keyboard in the sheet and in the colour group, touch
// targets of 44 px on mobile. Each test has its own throwaway user (marked in
// app_metadata, deleted at the end); the saves of the sheet are answered by
// the test when the state is an error. Skipped when the keys are not set.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.skip(!throwawayConfigured(), throwawaySkipReason);

const isMobile = () => test.info().project.name === "mobile";

async function withNest(
  type: HouseholdType,
  members: Parameters<typeof userWithNest>[1],
  page: Page,
  baseURL: string | undefined,
  body: () => Promise<void>,
) {
  const user = await userWithNest(type, members);
  try {
    await openPeople(page, user, baseURL);
    await body();
  } finally {
    await user.remove();
  }
}

async function expectNoBlocking(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations
      .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
}

/** What the focused element is called (label, aria-label or text). */
function focusedName(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return "(body)";
    const labelled = el.getAttribute("aria-label");
    if (labelled) return labelled;
    const label = (el as HTMLInputElement).labels?.[0]?.textContent;
    if (label) return label.trim();
    return (el.textContent ?? "").trim() || el.tagName;
  });
}

function focusRingVisible(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    const s = getComputedStyle(el);
    return (
      (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) ||
      s.boxShadow !== "none"
    );
  });
}

/**
 * Presses Tab `count` times and returns the names of the stops (a native date
 * field has several inner stops: repeated names are collapsed). Every stop
 * must show a focus ring.
 */
async function tabStops(page: Page, count: number): Promise<string[]> {
  const names: string[] = [];
  for (let i = 0; i < count; i += 1) {
    await page.keyboard.press("Tab");
    const name = await focusedName(page);
    expect(await focusRingVisible(page), `anello di fuoco su «${name}»`).toBe(
      true,
    );
    if (names[names.length - 1] !== name) names.push(name);
  }
  return names;
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
  // A control at least as big as the area (a bar, a wide button) only needs
  // the height and the width of the box.
  const bigEnough = result.width >= 44 && result.height >= 44;
  expect(
    bigEnough || result.misses.length === 0,
    `${what}: ${Math.round(result.width)}x${Math.round(result.height)} px, area di 44 px non raggiunta (${result.misses.join("; ")})`,
  ).toBe(true);
}

test.describe("onboarding · chi c'è nel Nest · accessibilità", () => {
  test("lista con membri: axe, un h1, lista con nome", async ({
    page,
    baseURL,
  }) => {
    await withNest("family_with_children", FAMILY, page, baseURL, async () => {
      await expect(page.locator("h1:visible")).toHaveCount(1);
      await expect(page.locator("h1:visible")).toHaveText("Chi c'è nel Nest?");
      await expect(page).toHaveTitle("FamilyNest · Chi c'è nel Nest?");
      const list = page
        .getByRole("list", { name: "Persone del Nest" })
        .filter({ visible: true });
      await expect(list.getByRole("listitem")).toHaveCount(5);
      // The avatar is decorative: the name is written beside it.
      await expect(list.locator('[role="img"]')).toHaveCount(0);
      const bar = page.getByRole("progressbar").filter({ visible: true });
      await expect(bar).toHaveCount(1);
      await expect(bar).toHaveAttribute("aria-valuenow", "2");
      await expect(bar).toHaveAttribute("aria-valuemax", "4");
      await expectNoBlocking(page);
    });
  });

  test("solo tu e tre passi: axe", async ({ page, baseURL }) => {
    await withNest("single", [], page, baseURL, async () => {
      const bar = page.getByRole("progressbar").filter({ visible: true });
      await expect(bar).toHaveAttribute("aria-valuemax", "3");
      await expect(bar).toHaveAccessibleName("Passo 2 di 3");
      await expectNoBlocking(page);
    });
  });

  test("lista vuota: la pagina non ha uno scorrimento in più", async ({
    page,
    baseURL,
  }) => {
    await withNest("couple", [], page, baseURL, async () => {
      await settle(page);
      const { scroll, inner } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollHeight,
        inner: window.innerHeight,
      }));
      // The mockup frame is exactly one screen high (844 / 800 px).
      expect(scroll).toBeLessThanOrEqual(inner);
    });
  });

  test("Nest al completo: axe, messaggio collegato al bottone", async ({
    page,
    baseURL,
  }) => {
    await withNest(
      "family_with_children",
      [...FAMILY, ...MORE],
      page,
      baseURL,
      async () => {
        const add = addButton(page);
        await expect(add).toBeDisabled();
        const describedBy = await add.getAttribute("aria-describedby");
        expect(describedBy).toBeTruthy();
        await expect(page.locator(`[id="${describedBy}"]`)).toHaveText(
          "Il Nest è al completo: ci stanno al massimo 10 tra persone e animali.",
        );
        // The pencils and "Continua" stay active.
        await expect(
          page
            .getByRole("button", { name: "Modifica Luca" })
            .filter({ visible: true }),
        ).toBeEnabled();
        await expect(continueButton(page)).toBeEnabled();
        await expectNoBlocking(page);
      },
    );
  });

  test("caricamento: axe e scheletro annunciato", async ({ page, baseURL }) => {
    const user = await userWithNest("family_with_children", FAMILY);
    try {
      await user.signInContext(page.context(), baseURL as string);
      // Without the scripts of the page nothing replaces the skeleton.
      await page.route("**/onboarding/persone", async (route) => {
        if (route.request().resourceType() !== "document") {
          return route.continue();
        }
        const response = await route.fetch();
        const html = (await response.text()).replace(
          /<script\b[\s\S]*?<\/script>/g,
          "",
        );
        await route.fulfill({ response, body: html });
      });
      await page.goto("/onboarding/persone");
      const busy = page
        .locator('[aria-busy="true"]')
        .filter({ hasText: "Caricamento in corso" })
        .first();
      await expect(busy).toBeAttached();
      await expect(
        page
          .getByRole("button", { name: "Continua" })
          .filter({ visible: true }),
      ).toBeDisabled();
      await expectNoBlocking(page);
    } finally {
      await user.remove();
    }
  });

  test("tastiera sulla pagina: ordine del fuoco, anello visibile", async ({
    page,
    baseURL,
  }) => {
    await withNest("family_with_children", FAMILY, page, baseURL, async () => {
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur(),
      );
      const pencils = FAMILY.map((p) => `Modifica ${p.name}`);
      const order = isMobile()
        ? [
            "Indietro",
            "Modifica Marco",
            ...pencils,
            "Aggiungi una persona o un animale",
            "Continua",
          ]
        : [
            "Modifica Marco",
            ...pencils,
            "Aggiungi una persona o un animale",
            "Indietro",
            "Continua",
          ];
      expect(await tabStops(page, order.length)).toEqual(order);
    });
  });

  test("fuoco dopo il decimo membro: va su «Continua»", async ({
    page,
    baseURL,
  }) => {
    await withNest(
      "family_with_children",
      [...FAMILY, ...MORE.slice(0, 4)],
      page,
      baseURL,
      async () => {
        const dialog = await openAddSheet(page);
        await dialog.getByLabel("Nome").fill("Luca");
        await dialog.getByRole("button", { name: "Aggiungi Luca" }).click();
        await expect(dialog).toBeHidden();
        await expect(
          page.getByText("Il Nest è al completo").filter({ visible: true }),
        ).toBeVisible();
        await expect(continueButton(page)).toBeFocused();
        // The announcement of the outcome is in a status region.
        await expect(page.getByRole("status")).toContainText(
          "Luca è nel Nest.",
        );
      },
    );
  });

  test.describe("foglio", () => {
    test("aggiunta: axe, nome, fuoco, ordine, trappola, Esc", async ({
      page,
      baseURL,
    }) => {
      await withNest(
        "family_with_children",
        FAMILY,
        page,
        baseURL,
        async () => {
          const dialog = await openAddSheet(page);
          await expect(dialog).toHaveAttribute("aria-modal", "true");
          await expect(dialog).toHaveAccessibleName("Aggiungi una persona");
          await expect(dialog.getByLabel("Nome")).toBeFocused();
          await expectNoBlocking(page);

          // Order after Nome: the three roles, the date, the colours, the
          // action. Then the focus wraps to "Chiudi": it never leaves.
          const expected = [
            "Adulto",
            "Figlio o figlia",
            "Animale",
            "Data di nascita",
            "Lampone",
            ...(isMobile() ? [] : ["Annulla"]),
            "Aggiungi",
            "Chiudi",
            "Nome",
            "Adulto",
          ];
          // The native date field has more than one inner stop.
          const stops = await tabStops(page, 18);
          expect(stops.slice(0, expected.length)).toEqual(expected);
          const inside = await page.evaluate(() =>
            document
              .querySelector('[role="dialog"]')!
              .contains(document.activeElement),
          );
          expect(inside).toBe(true);

          // Escape closes and gives the focus back to the button.
          await page.keyboard.press("Escape");
          await expect(dialog).toBeHidden();
          await expect(addButton(page)).toBeFocused();
        },
      );
    });

    test("modifica: axe e fuoco restituito alla matita", async ({
      page,
      baseURL,
    }) => {
      await withNest(
        "family_with_children",
        FAMILY,
        page,
        baseURL,
        async () => {
          const dialog = await openEditSheet(page, "Sofia");
          await expect(dialog.getByLabel("Nome")).toBeFocused();
          await expectNoBlocking(page);
          await dialog.getByRole("button", { name: "Chiudi" }).click();
          await expect(dialog).toBeHidden();
          await expect(
            page
              .getByRole("button", { name: "Modifica Sofia" })
              .filter({ visible: true }),
          ).toBeFocused();
        },
      );
    });

    test("modifica di te: ruoli bloccati e spiegati, axe", async ({
      page,
      baseURL,
    }) => {
      await withNest(
        "family_with_children",
        FAMILY,
        page,
        baseURL,
        async () => {
          const dialog = await openEditSheet(page, "Marco");
          const roles = dialog.getByRole("group", { name: "Chi è" });
          await expect(
            roles.getByRole("button", { name: "Adulto" }),
          ).toHaveAttribute("aria-pressed", "true");
          await expect(
            roles.getByRole("button", { name: "Figlio o figlia" }),
          ).toBeDisabled();
          await expect(
            roles.getByRole("button", { name: "Animale" }),
          ).toBeDisabled();
          await expect(roles).toHaveAccessibleDescription(
            "Chi usa FamilyNest con il suo account è sempre un adulto.",
          );
          await expectNoBlocking(page);
        },
      );
    });

    test("colori: un solo Tab, frecce, presi saltati, nomi", async ({
      page,
      baseURL,
    }) => {
      await withNest(
        "family_with_children",
        FAMILY,
        page,
        baseURL,
        async () => {
          const dialog = await openAddSheet(page);
          const colors = dialog.getByRole("radiogroup", { name: "Colore" });
          await expect(colors.getByRole("radio")).toHaveCount(10);
          // A taken colour says why it is off.
          await expect(
            colors.getByRole("radio", { name: "Pomodoro (già di Marco)" }),
          ).toBeDisabled();
          await expect(
            colors.getByRole("radio", { name: "Lampone" }),
          ).toBeChecked();
          await colors.getByRole("radio", { name: "Lampone" }).focus();
          await page.keyboard.press("ArrowRight");
          await expect(
            colors.getByRole("radio", { name: "Ceruleo" }),
          ).toBeChecked();
          await page.keyboard.press("ArrowDown");
          await expect(
            colors.getByRole("radio", { name: "Peonia" }),
          ).toBeChecked();
          await page.keyboard.press("ArrowLeft");
          await page.keyboard.press("ArrowLeft");
          await page.keyboard.press("ArrowLeft");
          // Before the first free one: back to the tenth.
          await expect(
            colors.getByRole("radio", { name: "Cannella" }),
          ).toBeChecked();
          await page.keyboard.press("ArrowUp");
          await expect(
            colors.getByRole("radio", { name: "Basilico" }),
          ).toBeChecked();
        },
      );
    });

    test("errore del nome: aria-invalid, descrizione, fuoco, axe", async ({
      page,
      baseURL,
    }) => {
      await withNest(
        "family_with_children",
        FAMILY.slice(0, 1),
        page,
        baseURL,
        async () => {
          const dialog = await openAddSheet(page);
          await dialog
            .getByRole("button", { name: "Aggiungi", exact: true })
            .click();
          const name = dialog.getByLabel("Nome");
          await expect(name).toBeFocused();
          await expect(name).toHaveAttribute("aria-invalid", "true");
          await expect(name).toHaveAccessibleDescription(
            "Scrivi il nome per continuare.",
          );
          await expectNoBlocking(page);
        },
      );
    });

    test("errore della data: aria-invalid, descrizione, fuoco, axe", async ({
      page,
      baseURL,
    }) => {
      await withNest(
        "family_with_children",
        FAMILY.slice(0, 1),
        page,
        baseURL,
        async () => {
          const dialog = await openAddSheet(page);
          await dialog.getByLabel("Nome").fill("Sofia");
          const date = dialog.getByLabel("Data di nascita");
          await date.fill("2030-01-01");
          await dialog.getByRole("button", { name: "Aggiungi Sofia" }).click();
          await expect(date).toBeFocused();
          await expect(date).toHaveAttribute("aria-invalid", "true");
          await expect(date).toHaveAccessibleDescription(
            /Questa data è nel futuro: scegli un giorno fino a oggi\./,
          );
          await expectNoBlocking(page);
        },
      );
    });

    test("colore preso nel frattempo: errore annunciato, fuoco sui colori, axe", async ({
      page,
      baseURL,
    }) => {
      await withNest(
        "family_with_children",
        FAMILY.slice(0, 1),
        page,
        baseURL,
        async () => {
          await page.route("**/onboarding/persone", (route) =>
            isAction(route)
              ? route.fulfill(
                  actionAnswer({ ok: false, reason: "color-taken" }),
                )
              : route.continue(),
          );
          const dialog = await openAddSheet(page);
          await dialog.getByLabel("Nome").fill("Sofia");
          await dialog.getByRole("button", { name: "Aggiungi Sofia" }).click();
          const group = dialog.getByRole("radiogroup", { name: "Colore" });
          await expect(group).toHaveAttribute("aria-invalid", "true");
          await expect(
            dialog.getByText("Questo colore l'ha appena preso"),
          ).toBeVisible();
          await expect(group.getByRole("radio", { checked: true })).toHaveCount(
            0,
          );
          await expect(
            group.getByRole("radio", { name: /^Salvia/ }),
          ).toBeDisabled();
          await expect(page.locator('[role="radio"]:focus')).toHaveCount(1);
          await expectNoBlocking(page);
        },
      );
    });

    for (const [label, answer] of [
      ["rete", "abort"],
      ["server", { ok: false, reason: "server" }],
      ["Nest al completo", { ok: false, reason: "full" }],
    ] as const) {
      test(`salvataggio non riuscito (${label}): avviso annunciato, axe`, async ({
        page,
        baseURL,
      }) => {
        await withNest("couple", [FAMILY[0]!], page, baseURL, async () => {
          await page.route("**/onboarding/persone", (route) => {
            if (!isAction(route)) return route.continue();
            return answer === "abort"
              ? route.abort()
              : route.fulfill(actionAnswer(answer));
          });
          const dialog = await openAddSheet(page);
          await dialog.getByLabel("Nome").fill("Sofia");
          await dialog.getByRole("button", { name: "Aggiungi Sofia" }).click();
          const alert = dialog.getByRole("alert");
          await expect(alert).toBeVisible();
          // The fields keep what was typed.
          await expect(dialog.getByLabel("Nome")).toHaveValue("Sofia");
          await expectNoBlocking(page);
        });
      });
    }
  });

  test("aree di tocco da 44 px (mobile)", async ({ page, baseURL }) => {
    test.skip(!isMobile(), "Le aree di 44 px valgono sul telefono");
    await withNest("family_with_children", FAMILY, page, baseURL, async () => {
      await expectTouchArea(
        page.getByRole("link", { name: "Indietro" }).filter({ visible: true }),
        "freccia Indietro",
      );
      for (const person of FAMILY) {
        await expectTouchArea(
          page
            .getByRole("button", { name: `Modifica ${person.name}` })
            .filter({ visible: true }),
          `matita di ${person.name}`,
        );
      }
      await expectTouchArea(addButton(page), "Aggiungi una persona");
      await expectTouchArea(continueButton(page), "Continua");

      const dialog = await openAddSheet(page);
      await expectTouchArea(
        dialog.getByRole("button", { name: "Chiudi" }),
        "Chiudi",
      );
      for (const role of ["Adulto", "Figlio o figlia", "Animale"]) {
        await expectTouchArea(
          dialog.getByRole("button", { name: role }),
          `voce «${role}»`,
        );
      }
      const free = dialog
        .getByRole("radiogroup", { name: "Colore" })
        .getByRole("radio")
        .and(page.locator(":enabled"));
      const count = await free.count();
      expect(count).toBe(5);
      for (let i = 0; i < count; i += 1) {
        await expectTouchArea(free.nth(i), `colore libero ${i + 1}`);
      }
      await expectTouchArea(
        dialog.getByRole("button", { name: "Aggiungi", exact: true }),
        "Aggiungi (foglio)",
      );
    });
  });
});
