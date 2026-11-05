import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  STANDARD_FAKE_ACCOUNT,
  fakeCalendar,
  fakeCalendarConfigured,
  fakeCalendarSkipReason,
} from "../fixtures/calendar-fake";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";
import {
  OUTLOOK_ACCOUNT,
  collega,
  forget,
  holdSubmit,
  later,
  leaveResult,
  linkAccount,
  openStep,
  principal,
  settle,
  withRole,
} from "../visual/calendario-helpers";

// Accessibility of onboarding step 3 "Porta qui il tuo calendario" (#37), at
// 390 and 1280 px (the two projects): axe on every state, focus order and
// visible focus, no trap, touch targets of 44 px. Each test has its own
// throwaway user (marked in app_metadata, deleted at the end); accounts come
// from the fake provider. Skipped when the keys are not set.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.skip(!throwawayConfigured(), throwawaySkipReason);
test.skip(!fakeCalendarConfigured(), fakeCalendarSkipReason);

const isMobile = () => test.info().project.name === "mobile";
const visible = { visible: true } as const;

async function expectNoBlocking(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations
      .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
}

/** Every point of the area answers to the control (elementFromPoint). */
async function expectTouchArea(control: Locator, label: string) {
  const area = await control.evaluate((el) => {
    const box = el.getBoundingClientRect();
    // The area may be wider than the drawing (a transparent ::before).
    const before = getComputedStyle(el, "::before");
    const grow = (px: string) => Number.parseFloat(px) || 0;
    const width = Math.max(box.width, grow(before.width));
    const height = Math.max(box.height, grow(before.height));
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const points = [
      [cx, cy],
      [cx - width / 2 + 2, cy],
      [cx + width / 2 - 2, cy],
      [cx, cy - height / 2 + 2],
      [cx, cy + height / 2 - 2],
    ] as const;
    return {
      width,
      height,
      hits: points.map(([x, y]) => {
        const hit = document.elementFromPoint(x, y);
        return !!hit && (hit === el || el.contains(hit) || hit.contains(el));
      }),
    };
  });
  expect(area.height, `altezza di «${label}»`).toBeGreaterThanOrEqual(44);
  expect(area.width, `larghezza di «${label}»`).toBeGreaterThanOrEqual(44);
  expect(area.hits, `punti di «${label}»`).toEqual([
    true,
    true,
    true,
    true,
    true,
  ]);
}

/** The ring of the focused control is drawn and not hidden. */
async function expectRing(control: Locator, label: string) {
  await expect(control, `fuoco su «${label}»`).toBeFocused();
  const ring = await control.evaluate((el) => {
    const s = getComputedStyle(el);
    return { style: s.outlineStyle, width: Number.parseFloat(s.outlineWidth) };
  });
  expect(ring.style, `anello di «${label}»`).not.toBe("none");
  expect(ring.width).toBeGreaterThan(0);
}

/** Names of the controls reached by Tab, in order, until `stopAt` or `max`. */
async function tabOrder(page: Page, max = 12): Promise<string[]> {
  const seen: string[] = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const name = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return "(fuori dalla pagina)";
      const label = el.getAttribute("aria-label");
      return (label ?? el.textContent ?? "").replace(/\s+/g, " ").trim();
    });
    // Past the last control focus leaves the page or wraps to the first.
    if (name === "(fuori dalla pagina)" || seen.includes(name)) break;
    seen.push(name);
  }
  return seen;
}

test.describe("onboarding · calendario · accessibilità", () => {
  test("iniziale (amministratore): axe, un solo h1 e un solo main, nomi dei controlli", async ({
    page,
    baseURL,
  }) => {
    await withRole("couple", async (user) => {
      await openStep(page, user, baseURL);
      await settle(page);
      await expectNoBlocking(page);
      await expect(page.locator("main")).toHaveCount(1);
      await expect(page.locator("h1:visible")).toHaveCount(1);
      await expect(
        page
          .getByRole("list", { name: "Calendari da collegare" })
          .filter(visible),
      ).toBeVisible();
      await expect(collega(page, "Outlook")).toBeVisible();
      await expect(collega(page, "Google")).toBeVisible();
    });
  });

  test("iniziale (Nest da solo e invitato): axe", async ({ page, baseURL }) => {
    for (const role of ["single", "invited"] as const) {
      await withRole(role, async (user) => {
        await openStep(page, user, baseURL);
        await settle(page);
        await expectNoBlocking(page);
        await page.context().clearCookies();
      });
    }
  });

  test("tastiera: l'ordine del fuoco, l'anello e nessuna trappola", async ({
    page,
    baseURL,
  }) => {
    await withRole("couple", async (user) => {
      await openStep(page, user, baseURL);
      await settle(page);
      const order = await tabOrder(page);
      // Specification §4: mobile «Indietro», the rows, the main button and
      // «Più tardi»; desktop the rows, «Più tardi» and the main button.
      expect(order).toEqual(
        isMobile()
          ? [
              "Indietro",
              "Collega Outlook",
              "Collega Google",
              "Continua senza calendario",
              "Più tardi",
            ]
          : [
              "Collega Outlook",
              "Collega Google",
              "Più tardi",
              "Continua senza calendario",
            ],
      );
      // Every control was reached once and the next Tab moved on: no trap.
    });
  });

  test("tastiera: anello visibile su ogni controllo", async ({
    page,
    baseURL,
  }) => {
    await withRole("couple", async (user) => {
      await openStep(page, user, baseURL);
      await settle(page);
      const controls: Array<[Locator, string]> = [
        [collega(page, "Outlook"), "Collega Outlook"],
        [collega(page, "Google"), "Collega Google"],
        [principal(page, "Continua senza calendario"), "Continua"],
        [later(page), "Più tardi"],
      ];
      for (const [control, label] of controls) {
        await control.focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        await expectRing(control, label);
      }
    });
  });

  test("aree di tocco di almeno 44 px", async ({ page, baseURL }) => {
    await withRole("couple", async (user) => {
      await openStep(page, user, baseURL);
      await settle(page);
      await expectTouchArea(collega(page, "Outlook"), "Collega Outlook");
      await expectTouchArea(collega(page, "Google"), "Collega Google");
      await expectTouchArea(
        principal(page, "Continua senza calendario"),
        "Continua senza calendario",
      );
      await expectTouchArea(later(page), "Più tardi");
      if (isMobile()) {
        await expectTouchArea(
          page.getByRole("link", { name: "Indietro" }).filter(visible),
          "Indietro",
        );
        const main = await principal(
          page,
          "Continua senza calendario",
        ).boundingBox();
        expect(main!.height).toBeGreaterThanOrEqual(52);
      }
    });
  });

  test("collegamento in corso: axe, spinner annunciato, principale spento", async ({
    page,
    baseURL,
  }) => {
    await withRole("couple", async (user) => {
      try {
        await fakeCalendar(baseURL as string).setup({
          userId: user.id,
          ...STANDARD_FAKE_ACCOUNT,
        });
        await openStep(page, user, baseURL);
        await holdSubmit(page);
        await collega(page, "Google").click();
        const busy = page
          .locator('.btn-tenue[aria-busy="true"]')
          .filter(visible);
        await expect(busy).toHaveText("Collegamento");
        await expect(
          principal(page, "Continua senza calendario"),
        ).toBeDisabled();
        await settle(page);
        await expectNoBlocking(page);
      } finally {
        await forget(user, baseURL);
      }
    });
  });

  test("collegato: axe, il fuoco va su «Continua», nome della riga", async ({
    page,
    baseURL,
  }) => {
    await withRole("couple", async (user) => {
      try {
        await openStep(page, user, baseURL);
        await linkAccount(page, user, baseURL, "outlook", OUTLOOK_ACCOUNT);
        await expect(principal(page, "Continua")).toBeFocused();
        await expectNoBlocking(page);
        // Back with the keyboard: the focus is not lost on the body.
        await page.keyboard.press("Shift+Tab");
        await expect(page.locator("body")).not.toBeFocused();
      } finally {
        await forget(user, baseURL);
      }
    });
  });

  for (const [name, provider, result, text] of [
    [
      "errore generico",
      "google",
      "failed",
      "Non siamo riusciti a collegare Google. Riprova o salta questo passo.",
    ],
    [
      "permesso del calendario mancante",
      "google",
      "no_calendar_permission",
      "Google ci ha dato l'accesso all'account ma non al calendario.",
    ],
    [
      "approvazione dell'amministratore",
      "outlook",
      "admin_approval",
      "Il tuo account di lavoro non permette di collegare app esterne a Outlook.",
    ],
  ] as const) {
    test(`${name}: axe, avviso con ruolo alert e «Riprova» da tastiera`, async ({
      page,
      baseURL,
    }) => {
      await withRole("couple", async (user) => {
        await leaveResult(page, baseURL, provider, result);
        await openStep(page, user, baseURL);
        await settle(page);
        await expectNoBlocking(page);
        const alert = page.locator('.avviso[role="alert"]').filter(visible);
        await expect(alert).toContainText(text);
        // Specification §4: the action of the notice comes after the rows
        // and before the main button.
        const order = await tabOrder(page);
        expect(order).toEqual(
          isMobile()
            ? [
                "Indietro",
                "Collega Outlook",
                "Collega Google",
                "Riprova",
                "Continua senza calendario",
                "Più tardi",
              ]
            : [
                "Collega Outlook",
                "Collega Google",
                "Riprova",
                "Più tardi",
                "Continua senza calendario",
              ],
        );
        const retry = alert.getByRole("button", { name: "Riprova" });
        await expectTouchArea(retry, "Riprova");
        await retry.focus();
        await expectRing(retry, "Riprova");
      });
    });
  }

  test("offline: axe, avviso annunciato, «Collega» spenti, si può proseguire", async ({
    page,
    baseURL,
  }) => {
    await withRole("couple", async (user) => {
      await openStep(page, user, baseURL);
      await page.context().setOffline(true);
      const alert = page.locator('.avviso[role="alert"]').filter(visible);
      await expect(alert).toContainText("Sei offline");
      await expect(collega(page, "Outlook")).toBeDisabled();
      await expect(collega(page, "Google")).toBeDisabled();
      await expect(principal(page, "Continua senza calendario")).toBeEnabled();
      await expect(later(page)).toBeVisible();
      await settle(page);
      await expectNoBlocking(page);
      await page.context().setOffline(false);
      await expect(alert).toHaveCount(0);
      await expect(collega(page, "Google")).toBeEnabled();
    });
  });

  test("Pronto con la riga degli impegni: axe e un solo h1", async ({
    page,
    baseURL,
  }) => {
    await withRole("single", async (user) => {
      const fake = fakeCalendar(baseURL as string);
      try {
        await openStep(page, user, baseURL);
        await linkAccount(page, user, baseURL, "google", STANDARD_FAKE_ACCOUNT);
        const start = new Date(Date.now() + 86_400_000);
        await fake.setEvents({
          userId: user.id,
          email: STANDARD_FAKE_ACCOUNT.email,
          calendarId: "personale",
          events: [
            {
              id: "evento-0",
              title: "Impegno",
              startsAt: start.toISOString(),
              endsAt: new Date(start.getTime() + 3_600_000).toISOString(),
            },
          ],
        });
        await fake.sync(user.id);
        await page.goto("/onboarding/pronto");
        await expect(
          page.getByText("1 impegno arrivato da Google").filter(visible),
        ).toBeVisible();
        await settle(page);
        await expectNoBlocking(page);
        await expect(page.locator("h1:visible")).toHaveCount(1);
      } finally {
        await forget(user, baseURL);
      }
    });
  });

  test.describe("caricamento", () => {
    test("axe, un solo main, bottoni spenti", async ({ page, baseURL }) => {
      await withRole("couple", async (user) => {
        await user.signInContext(page.context(), baseURL as string);
        // The skeleton is on screen only until the content streams in: the
        // scripts are cut from the answer so it stays (axe needs scripts in
        // the browser, so they cannot be switched off).
        await page.route("**/onboarding/calendario", async (route) => {
          const response = await route.fetch();
          const body = (await response.text()).replace(
            /<script[\s\S]*?<\/script>/g,
            "",
          );
          await route.fulfill({ response, body });
        });
        await page.goto("/onboarding/calendario");
        await expect(
          page.getByText("Caricamento in corso").first(),
        ).toBeAttached();
        await expectNoBlocking(page);
        await expect(page.locator("main:visible")).toHaveCount(1);
        await expect(
          page
            .getByRole("button", { name: "Continua senza calendario" })
            .filter(visible),
        ).toBeDisabled();
        await page.unrouteAll({ behavior: "ignoreErrors" });
      });
    });
  });
});
