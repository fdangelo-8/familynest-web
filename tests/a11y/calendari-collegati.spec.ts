import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { holdNavigation } from "../fixtures/held-navigation";
import {
  FIXED_NOW,
  GOOGLE,
  OUTLOOK,
  answerConsent,
  calendarTitle,
  connectFromEmptyState,
  linkBoth,
  openCalendarSheet,
  openCalendars,
  openConnectSheet,
  openTargetSheet,
  putAccountIn,
  withUser,
} from "../fixtures/calendari-collegati-visuale";

// PR #289 (#34 part 1, #35): accessibility of /calendari-collegati. axe on
// every state (empty, notices, linked, «Ricollega», provider error, offline,
// loading, the three sheets, the «Scollega» dialog), the names of the dialogs
// (CA-3, CA-17), the order and the ring of the focus, Esc and the return of
// the focus, no trap, and the 44 px touch areas at 390 px. Every test makes a
// throwaway user and links the fake accounts with the real path of the page.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
});

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations
      .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
}

/** The alerts of the page (the route announcer of Next is a `role="alert"` too). */
const alerts = (page: Page) =>
  page.locator('[role="alert"]:not(#__next-route-announcer__)');

async function focusRingVisible(page: Page) {
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

const focusedName = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return "";
    return (el.getAttribute("aria-label") ?? el.textContent ?? "")
      .replace(/\s+/g, " ")
      .trim();
  });

/**
 * True when the 44 x 44 area centred on `centre` (the element itself unless
 * given) hits the element. The title of a calendar has its area on the column
 * of the text (`.riga-lista--modificabile`, #204): the centre is the column.
 */
async function hasTouchArea(page: Page, target: Locator, centre?: Locator) {
  const box = await (centre ?? target).boundingBox();
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

async function expectTouchAreas(page: Page, targets: Locator[]) {
  for (const target of targets) {
    await target.scrollIntoViewIfNeeded();
    // The title buttons of the rows: the area is the column of the text.
    const isTitle = (await target.getAttribute("aria-describedby")) !== null;
    const centre = isTitle ? target.locator("xpath=..") : undefined;
    expect(await hasTouchArea(page, target, centre), String(target)).toBe(true);
  }
}

test.describe("non collegato", () => {
  test("axe sullo stato vuoto e sugli avvisi del ritorno dal fornitore", async ({
    page,
  }) => {
    await withUser(page, async () => {
      await openCalendars(page, "empty");
      await expect(page.locator("h1:visible")).toHaveCount(1);
      await axe(page);

      // Denied: an information notice, announced at once (CA-7).
      await connectFromEmptyState(page, "Outlook");
      await answerConsent(page, "Nega");
      await expect(alerts(page)).toContainText("annullato");
      await axe(page);

      // An administrator must approve the app (#35).
      await connectFromEmptyState(page, "Outlook");
      await answerConsent(page, "Serve l'approvazione dell'amministratore");
      await expect(alerts(page)).toContainText(
        "non permette di collegare app esterne",
      );
      await axe(page);

      // Calendar permission left off.
      await connectFromEmptyState(page, "Google");
      await answerConsent(page, "Consenti senza calendario");
      await expect(alerts(page)).toContainText("ma non al calendario");
      await axe(page);
    });
  });

  test("tastiera: bottoni «Collega» raggiungibili con il ring e aree di tocco", async ({
    page,
  }, testInfo) => {
    await withUser(page, async () => {
      await openCalendars(page, "empty");
      const outlook = page.getByRole("button", {
        name: "Collega Outlook",
        exact: true,
      });
      const google = page.getByRole("button", {
        name: "Collega Google",
        exact: true,
      });
      // In the page the order is Google, then Outlook.
      await google.focus();
      expect(await focusRingVisible(page)).toBe(true);
      await page.keyboard.press("Tab");
      await expect(outlook).toBeFocused();
      expect(await focusRingVisible(page)).toBe(true);
      if (testInfo.project.name === "mobile") {
        await expectTouchAreas(page, [outlook, google]);
      }
    });
  });

  test("caricamento: axe sullo scheletro", async ({ page }) => {
    await withUser(page, async () => {
      const { release, clickWhenReady } = await holdNavigation(
        page,
        /\/calendari-collegati\?_rsc=/,
      );
      await page.goto("/nest");
      await expect(
        page.getByRole("heading", { level: 1, name: "Casa D'Angelo" }),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await clickWhenReady(
        page.getByRole("main").getByRole("link", {
          name: /^Calendari collegati/,
        }),
      );
      await expect(page.getByText("Caricamento in corso")).toBeAttached();
      // The loading shell has no title of its own while the page is held: the
      // title of the page arrives with the page. Everything else is checked.
      const results = await new AxeBuilder({ page })
        .disableRules("document-title")
        .analyze();
      expect(
        results.violations
          .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
          .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      ).toEqual([]);
      release();
      await expect(
        page.getByText("Nessun calendario collegato", { exact: true }),
      ).toBeVisible();
    });
  });
});

test.describe("collegato", () => {
  test("axe, ordine del fuoco, ring visibile e nessuna trappola", async ({
    page,
  }) => {
    await withUser(page, async (ctx) => {
      await linkBoth(page, ctx);
      await expect(page.locator("h1:visible")).toHaveCount(1);
      // CA-5 / CA-41: one section for each account, named with the provider and the mail.
      await expect(
        page.getByRole("region", { name: `Account Outlook ${OUTLOOK.email}` }),
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: `Account Google ${GOOGLE.email}` }),
      ).toBeVisible();
      await axe(page);

      // Order of the focus: title, switch, calendar by calendar, then the two
      // rows at the bottom. On desktop the side menu comes first.
      const expected = [
        "Lavoro: impostazioni",
        "Sincronizza Lavoro",
        "Ferie del team: impostazioni",
        "Sincronizza Ferie del team",
        "Personale: impostazioni",
        "Sincronizza Personale",
        "Festività in Italia: impostazioni",
        "Sincronizza Festività in Italia",
        "Tennis: impostazioni",
        "Sincronizza Tennis",
        "Collega un altro account",
        "Dove vanno i nuovi impegni",
      ];
      await page.locator("#contenuto").focus();
      const seen: string[] = [];
      const withoutRing: string[] = [];
      for (let i = 0; i < 40; i += 1) {
        await page.keyboard.press("Tab");
        const name = await focusedName(page);
        seen.push(name);
        if (!(await focusRingVisible(page))) withoutRing.push(name);
        if (name.startsWith("Dove vanno i nuovi impegni")) break;
      }
      expect(seen.at(-1)?.startsWith("Dove vanno i nuovi impegni")).toBe(true);
      const mine = seen.filter((name) =>
        expected.some((e) => name === e || name.startsWith(`${e}`)),
      );
      expect(mine.map((n) => expected.find((e) => n.startsWith(e)))).toEqual(
        expected,
      );
      expect(withoutRing).toEqual([]);
    });
  });

  test("aree di tocco di almeno 44 px a 390 px", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "solo mobile");
    await withUser(page, async (ctx) => {
      await linkBoth(page, ctx);
      await expectTouchAreas(page, [
        calendarTitle(page, "Lavoro"),
        page.getByRole("switch", { name: "Sincronizza Lavoro" }),
        calendarTitle(page, "Ferie del team"),
        page.getByRole("switch", { name: "Sincronizza Ferie del team" }),
        calendarTitle(page, "Tennis"),
        page.getByRole("switch", { name: "Sincronizza Tennis" }),
        page.getByRole("button", { name: "Collega un altro account" }),
        page.getByRole("button", { name: /^Dove vanno i nuovi impegni/ }),
      ]);
      // The areas of a title and of its switch do not overlap (12 px between).
      const title = await calendarTitle(page, "Tennis").boundingBox();
      const toggle = await page
        .getByRole("switch", { name: "Sincronizza Tennis" })
        .boundingBox();
      expect(title).not.toBeNull();
      expect(toggle).not.toBeNull();
      expect(title!.x + title!.width).toBeLessThanOrEqual(toggle!.x);
    });
  });

  test("«Ricollega» e errore del fornitore: axe, ruolo degli avvisi, area di tocco", async ({
    page,
  }, testInfo) => {
    await withUser(page, async (ctx) => {
      await linkBoth(page, ctx);
      await putAccountIn(ctx, OUTLOOK.email, {
        status: "reconnect",
        failingMinutesAgo: 5,
      });
      await putAccountIn(ctx, GOOGLE.email, {
        status: "temporary_error",
        failingMinutesAgo: 30 * 60,
        syncedMinutesAgo: 1,
      });
      await openCalendars(page, "linked");
      // CA-9: the «Ricollega» notice is an alert; the provider error is a status.
      await expect(alerts(page)).toContainText(
        "Non riusciamo a sincronizzare Outlook",
      );
      await expect(
        page.getByRole("status").filter({ hasText: "non risponde" }),
      ).toBeVisible();
      const reconnect = page.getByRole("button", {
        name: "Ricollega",
        exact: true,
      });
      await expect(reconnect).toBeVisible();
      await axe(page);
      await reconnect.focus();
      expect(await focusRingVisible(page)).toBe(true);
      const retry = page.getByRole("button", { name: "Riprova", exact: true });
      if (testInfo.project.name === "mobile") {
        await expectTouchAreas(page, [reconnect, retry]);
      }
    });
  });

  test("offline: avviso, controlli disattivati, axe", async ({
    page,
    context,
  }) => {
    await withUser(page, async (ctx) => {
      await linkBoth(page, ctx);
      await context.setOffline(true);
      await expect(alerts(page)).toContainText("Sei offline");
      await expect(
        page.getByRole("switch", { name: "Sincronizza Lavoro" }),
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Collega un altro account" }),
      ).toBeDisabled();
      // The rows of the calendars are disabled too (#34 §4, «Offline»).
      await expect(calendarTitle(page, "Lavoro")).toBeDisabled();
      await axe(page);
      await context.setOffline(false);
      await expect(alerts(page)).toHaveCount(0);
    });
  });
});

test.describe("fogli e dialoghi", () => {
  test("foglio di un calendario: nome (CA-3, CA-17), axe, fuoco, Esc, trappola", async ({
    page,
  }) => {
    await withUser(page, async (ctx) => {
      await linkBoth(page, ctx);
      const sheet = await openCalendarSheet(page, "Lavoro");
      // The name of the dialog is not the title (CA-3, CA-17).
      await expect(sheet).toHaveAccessibleName(
        "Impostazioni del calendario Lavoro",
      );
      await expect(
        sheet.getByRole("heading", { level: 2, name: "Lavoro · Outlook" }),
      ).toBeVisible();
      await expect(
        sheet
          .getByRole("group", { name: "Chi vede questi impegni nel Nest" })
          .getByRole("button", { name: "Occupato", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await axe(page);

      // On opening the focus is on the chosen direction.
      const direction = sheet.getByRole("radio", {
        name: /^Entrata e uscita/,
      });
      await expect(direction).toBeFocused();
      expect(await focusRingVisible(page)).toBe(true);

      // No trap and no way out: Tab and Shift+Tab stay inside the dialog.
      for (let i = 0; i < 14; i += 1) {
        await page.keyboard.press("Tab");
        expect(
          await page.evaluate(() =>
            document.activeElement?.closest('[role="dialog"]') ? true : false,
          ),
        ).toBe(true);
      }
      for (let i = 0; i < 14; i += 1) {
        await page.keyboard.press("Shift+Tab");
        expect(
          await page.evaluate(() =>
            document.activeElement?.closest('[role="dialog"]') ? true : false,
          ),
        ).toBe(true);
      }

      // Esc closes without saving and the focus goes back to the title.
      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();
      await expect(calendarTitle(page, "Lavoro")).toBeFocused();
    });
  });

  test("calendario di sola lettura: «Entrata e uscita» disattivata e spiegata", async ({
    page,
  }) => {
    await withUser(page, async (ctx) => {
      await linkBoth(page, ctx);
      const sheet = await openCalendarSheet(page, "Ferie del team");
      await expect(
        sheet.getByRole("radio", { name: /^Entrata e uscita/ }),
      ).toHaveAttribute("aria-disabled", "true");
      await expect(
        sheet.getByText(
          "Ferie del team è di sola lettura su Outlook: si può solo portare qui.",
        ),
      ).toBeVisible();
      await axe(page);
    });
  });

  test("dialogo «Scollega»: nome, fuoco su «Annulla», axe, Esc", async ({
    page,
  }) => {
    await withUser(page, async (ctx) => {
      await linkBoth(page, ctx);
      await openCalendarSheet(page, "Lavoro");
      const opener = page.getByRole("button", {
        name: "Scollega l'account Outlook",
      });
      await opener.click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAccessibleName(
        `Scollegare «${OUTLOOK.email}»?`,
      );
      await expect(
        dialog.getByRole("button", { name: "Annulla", exact: true }),
      ).toBeFocused();
      await axe(page);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      // Back on the button that opened it, the sheet still open.
      await expect(opener).toBeFocused();
    });
  });

  test("«Collega un altro account»: nomi dei bottoni, fuoco sul primo, axe", async ({
    page,
  }, testInfo) => {
    await withUser(page, async (ctx) => {
      await linkBoth(page, ctx);
      const sheet = await openConnectSheet(page);
      const first = sheet.getByRole("button", { name: "Collega Outlook" });
      const second = sheet.getByRole("button", { name: "Collega Google" });
      await expect(first).toBeFocused();
      await expect(second).toBeVisible();
      await axe(page);
      if (testInfo.project.name === "mobile") {
        await expectTouchAreas(page, [first, second]);
      }
      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();
      await expect(
        page.getByRole("button", { name: "Collega un altro account" }),
      ).toBeFocused();
    });
  });

  test("«Dove vanno i nuovi impegni»: gruppo di scelte, frecce, axe", async ({
    page,
  }) => {
    await withUser(page, async (ctx) => {
      await linkBoth(page, ctx);
      const sheet = await openTargetSheet(page);
      const group = sheet.getByRole("radiogroup", {
        name: "Dove vanno i nuovi impegni",
      });
      await expect(group).toBeVisible();
      await axe(page);
      // Arrows move the focus and the choice; a single tab stop in the group.
      const radios = group.getByRole("radio");
      const count = await radios.count();
      expect(count).toBeGreaterThanOrEqual(2);
      const checked = group.locator('[role="radio"][aria-checked="true"]');
      await expect(checked).toHaveCount(1);
      await checked.focus();
      await page.keyboard.press("ArrowDown");
      await expect(group.locator('[role="radio"]:focus')).toHaveCount(1);
      await expect(
        group.locator('[role="radio"][aria-checked="true"]:focus'),
      ).toHaveCount(1);
      expect(await group.locator('[role="radio"][tabindex="0"]').count()).toBe(
        1,
      );
      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();
      await expect(
        page.getByRole("button", { name: /^Dove vanno i nuovi impegni/ }),
      ).toBeFocused();
    });
  });

  test("aree di tocco dei fogli a 390 px", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "solo mobile");
    await withUser(page, async (ctx) => {
      await linkBoth(page, ctx);
      const sheet = await openCalendarSheet(page, "Lavoro");
      await expectTouchAreas(page, [
        sheet.getByRole("button", { name: "Chiudi", exact: true }),
        sheet.getByRole("button", { name: "Salva", exact: true }),
        sheet.getByRole("button", { name: "Scollega l'account Outlook" }),
        sheet.getByRole("switch", { name: "Conta per Liberi insieme" }),
        sheet.getByRole("switch", { name: "Solo giorni feriali" }),
      ]);
    });
  });

  test("collegamento riuscito: il fuoco va sul titolo della nuova sezione", async ({
    page,
  }) => {
    await withUser(page, async () => {
      await openCalendars(page, "empty");
      await connectFromEmptyState(page, "Outlook");
      await answerConsent(page);
      await expect(
        page.getByRole("heading", { level: 2, name: "Outlook" }),
      ).toBeFocused();
      await axe(page);
    });
  });
});
