import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  DAY_WEEK,
  SEVEN,
  TUE,
  TUESDAY,
  contrastOf,
  dayHeading,
  dayView,
  hasTouchArea,
  isMobile,
  openDay,
  throwawayConfigured,
  throwawaySkipReason,
  waitForDayData,
  withDayNest,
  withMockupNest,
  type EventSpec,
} from "../visual/calendario-giorno-helpers";

// Calendario · Giorno «chi è dove» (#26), visual tester's accessibility checks:
// axe in every state (normal with the lens «Nest» and «Io», empty, loading, page
// error, offline, seven people), no duplicated id between the mobile and the
// desktop layout, the accessible name of the blocks starts with the visible text
// (the mistake of #168), «Occupato» and «Liberi insieme» out of the Tab, focus
// order and visible ring, touch areas of 44 px (elementFromPoint) and contrast.
// Every test builds its own throwaway Nest and its own events in the week
// 19-25 October 2026, with the clock at Tuesday 20 October, 15:52 (Rome).

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

test.beforeEach(() => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
  test.setTimeout(180_000);
});

async function violations(page: Page, rules?: string[]) {
  const builder = new AxeBuilder({ page });
  const results = await (rules ? builder.withRules(rules) : builder).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target.join(" ")),
    }));
}

/** No two elements of the page share an id (the mobile and desktop layouts). */
async function duplicatedIds(page: Page) {
  return page.evaluate(() => {
    const seen = new Map<string, number>();
    for (const el of document.querySelectorAll("[id]")) {
      seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
    }
    return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  });
}

async function expectClean(page: Page) {
  expect(await violations(page)).toEqual([]);
  expect(await duplicatedIds(page)).toEqual([]);
}

const lensGroup = (page: Page) =>
  page.getByRole("group", { name: /Punto di vista/ });
const lensIo = (page: Page) =>
  lensGroup(page)
    .getByRole("button", { name: /Io$/ })
    .filter({ visible: true });
const views = (page: Page) =>
  page.getByRole("group", { name: "Vista del calendario" });

// --- axe, every state --------------------------------------------------------

test.describe("axe", () => {
  test("normale: lente Nest e lente Io", async ({ page, baseURL }) => {
    await withMockupNest(DAY_WEEK, async (nest) => {
      await openDay(page, baseURL, nest, { lens: "nest" });
      await waitForDayData(page);
      await expect(page.getByText("Cena dai nonni").first()).toBeVisible();
      await expectClean(page);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

      await lensIo(page).click();
      await expect(
        page.getByRole("button", { name: /Io$/, pressed: true }).first(),
      ).toBeVisible();
      await expect(page.getByTestId("testa-colonna")).toHaveCount(1);
      await expectClean(page);
    });
  });

  test("un altro giorno: il link «Oggi»", async ({ page, baseURL }) => {
    await withMockupNest(DAY_WEEK, async (nest) => {
      await openDay(page, baseURL, nest, { day: "2026-10-22" });
      await waitForDayData(page, "2026-10-22");
      await expect(
        page.getByRole("link", { name: "Oggi", exact: true }).first(),
      ).toBeVisible();
      await expectClean(page);
    });
  });

  test("vuoto", async ({ page, baseURL }) => {
    await withMockupNest([], async (nest) => {
      await openDay(page, baseURL, nest);
      await waitForDayData(page);
      await expect(page.getByText("Giornata libera")).toBeVisible();
      await expectClean(page);
    });
  });

  test("lente Io senza impegni miei (riga dei nascosti)", async ({
    page,
    baseURL,
  }) => {
    const others: EventSpec[] = [
      {
        who: "Laura",
        title: "Yoga",
        day: TUE,
        from: "20:30",
        to: "22:30",
      },
    ];
    await withMockupNest(others, async (nest) => {
      await openDay(page, baseURL, nest, { lens: "io" });
      await waitForDayData(page);
      await expect(
        page.getByText("impegno degli altri nascosto"),
      ).toBeVisible();
      await expectClean(page);
    });
  });

  test("caricamento", async ({ page, baseURL }) => {
    await withMockupNest(TUESDAY, async (nest) => {
      await page.route("**/rpc/list_household_events*", () => {});
      await openDay(page, baseURL, nest);
      await expect(dayHeading(page, TUE)).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[aria-busy="true"]').first()).toBeAttached();
      await expectClean(page);
    });
  });

  test("errore: la pagina non si carica", async ({ page, baseURL }) => {
    await withMockupNest(TUESDAY, async (nest) => {
      await page.route("**/rpc/list_household_events*", (route) =>
        route.abort("failed"),
      );
      await openDay(page, baseURL, nest);
      await expect(
        page.getByRole("heading", { name: "Questa pagina non si è caricata" }),
      ).toBeVisible({ timeout: 30_000 });
      await expectClean(page);
    });
  });

  test("errore offline: giorno nuovo e impegni salvati", async ({
    page,
    context,
    baseURL,
  }) => {
    await withMockupNest(DAY_WEEK, async (nest) => {
      await openDay(page, baseURL, nest, { day: "2026-10-25" });
      await waitForDayData(page, "2026-10-25");
      await context.setOffline(true);
      await page.getByRole("button", { name: "Giorno successivo" }).click();
      await expect(
        page.getByText("Non riusciamo a caricare questo giorno."),
      ).toBeVisible();
      await expectClean(page);

      await page.getByRole("button", { name: "Giorno precedente" }).click();
      await expect(
        page.getByRole("alert").filter({
          hasText: "Non riusciamo ad aggiornare il calendario.",
        }),
      ).toBeVisible();
      await expectClean(page);
    });
  });

  test("sette persone", async ({ page, baseURL }) => {
    const day: EventSpec[] = [
      { who: "Marco", title: "Riunione", day: TUE, from: "10:00", to: "11:00" },
    ];
    await withDayNest(SEVEN, day, async (nest) => {
      await openDay(page, baseURL, nest);
      await waitForDayData(page);
      await expect(page.getByTestId("testa-colonna")).toHaveCount(7);
      await expectClean(page);
    });
  });
});

// --- the blocks: names, «Occupato» and «Liberi insieme» ---------------------------

test("nome accessibile dei blocchi: comincia con il testo visibile", async ({
  page,
  baseURL,
}) => {
  await withMockupNest(DAY_WEEK, async (nest) => {
    await openDay(page, baseURL, nest);
    await waitForDayData(page);
    await expect(page.getByText("Cena dai nonni").first()).toBeVisible();

    const links = page.locator("a.blocco-orario:not([aria-hidden='true'])");
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(5);
    const titles: string[] = [];
    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const title = (
        await link.locator(".blocco-orario__titolo").innerText()
      ).trim();
      titles.push(title);
      // No aria-label: the name comes from the content, so it begins with the
      // visible title (WCAG 2.5.3), then the time, then the details.
      expect(await link.getAttribute("aria-label"), title).toBeNull();
      const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      await expect(link, title).toHaveAccessibleName(
        new RegExp(`^${escaped}\\b`),
      );
      await expect(link, title).toHaveAccessibleName(
        /\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}/,
      );
    }
    expect(titles).toEqual(
      expect.arrayContaining(["Palestra", "Call con Acme", "Cena dai nonni"]),
    );

    // The same, as axe measures it.
    expect(await violations(page, ["label-content-name-mismatch"])).toEqual([]);
  });
});

test("«Occupato» e «Liberi insieme»: non sono controlli e restano fuori dal Tab", async ({
  page,
  baseURL,
}) => {
  await withMockupNest(DAY_WEEK, async (nest) => {
    await openDay(page, baseURL, nest);
    await waitForDayData(page);
    await expect(page.getByText("Cena dai nonni").first()).toBeVisible();

    for (const kind of ["occupato", "insieme"]) {
      const block = page.locator(`.blocco-orario--${kind}`);
      await expect(block, kind).toHaveCount(1);
      const info = await block.evaluate((el) => ({
        tag: el.tagName,
        role: el.getAttribute("role"),
        tabindex: el.getAttribute("tabindex"),
        href: el.getAttribute("href"),
        focusable: el.querySelector("a, button, [tabindex]") !== null,
        cursor: getComputedStyle(el).cursor,
      }));
      expect(info.tag, kind).toBe("DIV");
      expect(info.role, kind).toBeNull();
      expect(info.tabindex, kind).toBeNull();
      expect(info.href, kind).toBeNull();
      expect(info.focusable, kind).toBe(false);
      expect(info.cursor, kind).toBe("default");
      await expect(
        page.getByRole("link", { name: /Liberi insieme|Occupato/ }),
      ).toHaveCount(0);
    }

    // «Occupato»: the visible text is aria-hidden, the reader hears who is busy.
    const busy = page.locator(".blocco-orario--occupato");
    await expect(busy).toContainText("Occupato");
    await expect(busy).toContainText("9:00 – 15:00");
    expect(
      await busy
        .locator("[aria-hidden='true']")
        .evaluateAll((nodes) => nodes.length),
    ).toBe(2);
    expect(await busy.textContent()).toContain(
      "Laura ha un impegno, dalle 9:00 alle 15:00",
    );
    // The title of the busy event of the other never reaches the page.
    await expect(page.getByText("Lavoro", { exact: true })).toHaveCount(0);

    // With the keyboard no stop is ever inside them.
    const stops: { inside: boolean; label: string }[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const stop = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        return {
          inside:
            el.closest(".blocco-orario--occupato, .blocco-orario--insieme") !==
            null,
          label: `${el.tagName}|${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}`,
        };
      });
      if (!stop) break;
      stops.push(stop);
    }
    expect(stops.length).toBeGreaterThan(5);
    expect(stops.filter((s) => s.inside)).toEqual([]);
  });
});

// --- keyboard: order, visible ring, no trap ------------------------------------------

async function ringOf(target: Locator) {
  return target.evaluate((el) => {
    const style = getComputedStyle(el);
    const width = parseFloat(style.outlineWidth);
    return {
      focused: document.activeElement === el,
      outline: style.outlineStyle !== "none" && width > 0,
      shadow: style.boxShadow !== "none",
    };
  });
}

test("ordine del focus, anello visibile e nessuna trappola", async ({
  page,
  baseURL,
}) => {
  await withMockupNest(DAY_WEEK, async (nest) => {
    await openDay(page, baseURL, nest, { day: "2026-10-22" });
    await waitForDayData(page, "2026-10-22");
    await expect(page.getByText("Workshop cliente").first()).toBeVisible();

    const order: string[] = [];
    let trapped = 0;
    let previous = "";
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press("Tab");
      const stop = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const style = getComputedStyle(el);
        return {
          id: `${el.tagName}|${el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 40)}|${el.getAttribute("href")}`,
          inMain: el.closest("main") !== null,
          title:
            el.querySelector(".blocco-orario__titolo")?.textContent?.trim() ??
            null,
          region: el.getAttribute("role") === "region",
          ring:
            (style.outlineStyle !== "none" &&
              parseFloat(style.outlineWidth) > 0) ||
            style.boxShadow !== "none",
        };
      });
      if (!stop) break;
      trapped = stop.id === previous ? trapped + 1 : 0;
      expect(trapped, `trappola su ${stop.id}`).toBeLessThan(2);
      previous = stop.id;
      // Every stop shows a ring.
      expect(stop.ring, `anello su ${stop.id}`).toBe(true);
      order.push(
        stop.region
          ? "[regione]"
          : stop.title
            ? `blocco:${stop.title}`
            : stop.id.split("|")[0] + ":" + stop.id.split("|")[1],
      );
    }

    // «Vai al contenuto» first; then, in the page, «Oggi», the arrows, the views,
    // the grid (region) and its blocks in time order.
    expect(order[0]).toContain("Vai al contenuto");
    const at = (needle: string) => order.findIndex((s) => s.includes(needle));
    const oggi = at("Oggi");
    const prev = at("Giorno precedente");
    const next = at("Giorno successivo");
    expect(oggi).toBeGreaterThan(-1);
    expect(prev).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(-1);
    // «Oggi» is the first of the group, before the arrows (the mobile bar holds
    // another «Oggi» in the navigation: take the one just before the arrows).
    const oggiBeforeArrows = order.lastIndexOf("A:Oggi", prev);
    expect(oggiBeforeArrows, order.join(" > ")).toBe(prev - 1);
    expect(prev).toBeLessThan(next);
    const region = at("[regione]");
    expect(region, order.join(" > ")).toBeGreaterThan(next);
    const blocks = order
      .filter((s) => s.startsWith("blocco:"))
      .map((s) => s.slice(7));
    expect(blocks.length).toBeGreaterThan(0);
    expect(order.findIndex((s) => s.startsWith("blocco:"))).toBeGreaterThan(
      region,
    );
    // Thursday 22: «Scuola» 8:15, «Workshop cliente» 9:00, «Colloquio con la
    // maestra» 16:30, «Nuoto Sofia» 17:00, «Yoga» 20:30.
    const wanted = [
      "Scuola",
      "Workshop cliente",
      "Colloquio con la maestra",
      "Nuoto Sofia",
      "Yoga",
    ];
    expect(blocks.filter((b) => wanted.includes(b))).toEqual(wanted);
  });
});

test("anello di focus sulla regione e sul blocco", async ({
  page,
  baseURL,
}) => {
  await withMockupNest(DAY_WEEK, async (nest) => {
    await openDay(page, baseURL, nest);
    await waitForDayData(page);
    await expect(page.getByText("Cena dai nonni").first()).toBeVisible();

    const region = dayView(page);
    await region.focus();
    // `focus()` from a script shows the ring only after a key press.
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    const regionRing = await ringOf(region);
    expect(regionRing.focused).toBe(true);
    expect(regionRing.outline || regionRing.shadow).toBe(true);

    await page.keyboard.press("Tab");
    const block = page.locator("a.blocco-orario:focus");
    await expect(block).toHaveCount(1);
    const blockRing = await ringOf(block);
    expect(blockRing.outline || blockRing.shadow).toBe(true);
    // The block focused is brought into the view, under the heads of the columns.
    const heads = await page.locator(".giorno-persone__testa").boundingBox();
    const box = await block.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(heads!.y + heads!.height - 1);
  });
});

// --- touch areas (phone) --------------------------------------------------------------

test("aree di tocco di almeno 44 px (mobile)", async ({ page, baseURL }) => {
  test.skip(!isMobile(page), "area di tocco: solo mobile");
  await withMockupNest(DAY_WEEK, async (nest) => {
    await openDay(page, baseURL, nest, { day: "2026-10-22" });
    await waitForDayData(page, "2026-10-22");
    await expect(page.getByText("Workshop cliente").first()).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));

    const controls: [string, Locator][] = [
      ["Oggi", page.getByRole("link", { name: "Oggi", exact: true }).first()],
      [
        "Giorno precedente",
        page.getByRole("button", { name: "Giorno precedente" }),
      ],
      [
        "Giorno successivo",
        page.getByRole("button", { name: "Giorno successivo" }),
      ],
      ["Giorno", views(page).getByRole("button", { name: "Giorno" })],
      ["Settimana", views(page).getByRole("link", { name: "Settimana" })],
      ["Mese", views(page).getByRole("link", { name: "Mese" })],
      ["lente Io", lensIo(page)],
      [
        "lente Nest",
        lensGroup(page)
          .getByRole("button", { name: /Nest$/ })
          .filter({ visible: true }),
      ],
    ];
    for (const [name, control] of controls) {
      await expect(control, name).toBeVisible();
      expect(await hasTouchArea(control), name).toBe(true);
    }

    // The areas of «Oggi» and the first arrow do not overlap (centre to centre).
    const centres = await page
      .locator(".periodo__frecce")
      .locator("a, button")
      .evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return r.left + r.width / 2;
        }),
      );
    expect(centres.length).toBe(3);
    for (let i = 1; i < centres.length; i++) {
      expect(centres[i]! - centres[i - 1]!).toBeGreaterThanOrEqual(44);
    }
  });
});

test("i blocchi da toccare sono alti almeno 44 px (mobile)", async ({
  page,
  baseURL,
}) => {
  test.skip(!isMobile(page), "area di tocco: solo mobile");
  const short: EventSpec[] = [
    ...TUESDAY,
    // Two short events one after the other (proposal 14: both are an hour long).
    { who: "Marco", title: "Uno", day: TUE, from: "10:00", to: "10:30" },
    { who: "Marco", title: "Due", day: TUE, from: "10:30", to: "11:00" },
    { who: "Marco", title: "Tardi", day: TUE, from: "22:30", to: "23:00" },
  ];
  await withMockupNest(short, async (nest) => {
    await openDay(page, baseURL, nest);
    await waitForDayData(page);
    await expect(page.getByText("Cena dai nonni").first()).toBeVisible();

    const links = page.locator("a.blocco-orario:not([aria-hidden='true'])");
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(8);
    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const title = (
        await link.locator(".blocco-orario__titolo").innerText()
      ).trim();
      await link.scrollIntoViewIfNeeded();
      const box = (await link.boundingBox())!;
      expect(box.height, `altezza di «${title}»`).toBeGreaterThanOrEqual(44);
      // Two short events side by side share the column: the width of those
      // narrow parts is the only exception to the 44 px (decision 5 of #26).
      if (title === "Uno" || title === "Due") {
        expect(box.width, `larghezza di «${title}»`).toBeGreaterThanOrEqual(30);
        continue;
      }
      expect(box.width, `larghezza di «${title}»`).toBeGreaterThanOrEqual(44);
      // The block gets the touch: the point at its centre is the block itself.
      expect(await hasTouchArea(link, 40), `area di «${title}»`).toBe(true);
    }

    // «Uno» and «Due»: the time is written, both in the column «Tu», no overlap.
    const uno = links.filter({ hasText: "Uno" });
    const due = links.filter({ hasText: "Due" });
    await expect(uno).toContainText("10:00 – 10:30");
    await expect(due).toContainText("10:30 – 11:00");
    const [a, b] = await Promise.all([uno.boundingBox(), due.boundingBox()]);
    const overlap =
      a!.x < b!.x + b!.width &&
      b!.x < a!.x + a!.width &&
      a!.y < b!.y + b!.height &&
      b!.y < a!.y + a!.height;
    expect(overlap).toBe(false);
  });
});

test("«Riprova» e «Aggiungi qualcosa» hanno l'area di tocco di 44 px (mobile)", async ({
  page,
  context,
  baseURL,
}) => {
  test.skip(!isMobile(page), "area di tocco: solo mobile");
  await withMockupNest(DAY_WEEK, async (nest) => {
    await openDay(page, baseURL, nest, { day: "2026-10-25" });
    await waitForDayData(page, "2026-10-25");
    await context.setOffline(true);
    await page.getByRole("button", { name: "Giorno successivo" }).click();
    const retry = page.getByRole("button", { name: "Riprova" });
    await expect(retry).toBeVisible();
    expect(await hasTouchArea(retry), "Riprova").toBe(true);
  });
  await withMockupNest([], async (nest) => {
    await openDay(page, baseURL, nest);
    await waitForDayData(page);
    const add = page.getByRole("link", { name: "Aggiungi qualcosa" });
    await expect(add).toBeVisible();
    expect(await hasTouchArea(add), "Aggiungi qualcosa").toBe(true);
  });
});

// --- contrast ------------------------------------------------------------------------

test("contrasto: testi principali e axe color-contrast", async ({
  page,
  baseURL,
}) => {
  await withMockupNest(DAY_WEEK, async (nest) => {
    await openDay(page, baseURL, nest);
    await waitForDayData(page);
    await expect(page.getByText("Cena dai nonni").first()).toBeVisible();

    const minimum = 4.5;
    const checks: [string, Locator, string?][] = [
      ["titolo della pagina", page.getByRole("heading", { level: 1 })],
      ["nome nella testa", page.locator(".giorno-persone__nome").nth(1)],
      ["ora della colonna delle ore", page.locator(".colonna-ore__ora").nth(3)],
      [
        "titolo di un blocco",
        page
          .locator("a.blocco-orario .blocco-orario__titolo")
          .filter({ hasText: "Palestra" }),
      ],
      [
        "orario di un blocco",
        page
          .locator("a.blocco-orario .blocco-orario__ora")
          .filter({ hasText: "13:00 – 14:00" }),
      ],
      [
        "titolo Occupato",
        page.locator(".blocco-orario--occupato .blocco-orario__titolo"),
        "--color-occupato-2",
      ],
      [
        "orario Occupato",
        page.locator(".blocco-orario--occupato .blocco-orario__ora"),
        "--color-occupato-2",
      ],
      [
        "titolo Liberi insieme",
        page.locator(".blocco-orario--insieme .blocco-orario__titolo"),
        "--color-insieme",
      ],
      [
        "orario Liberi insieme",
        page.locator(".blocco-orario--insieme .blocco-orario__ora"),
        "--color-insieme",
      ],
    ];
    if (!isMobile(page)) {
      checks.push(
        ["ora del pannello", page.locator(".prossimo__ora")],
        ["titolo del pannello", page.locator(".prossimo__titolo")],
        ["info del pannello", page.locator(".prossimo__info")],
        ["nota del pannello", page.locator(".prossimo__nota").first()],
        [
          "info di una serata libera",
          page.locator(".riga-lista__info").first(),
        ],
      );
    }
    for (const [name, target, token] of checks) {
      await expect(target.first(), name).toBeVisible();
      const ratio = await contrastOf(target.first(), token);
      expect(ratio, `${name}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        minimum,
      );
    }

    // The same, as axe measures it, on both lenses.
    expect(await violations(page, ["color-contrast"])).toEqual([]);
    await lensIo(page).click();
    await expect(
      page.getByRole("button", { name: /Io$/, pressed: true }).first(),
    ).toBeVisible();
    expect(await violations(page, ["color-contrast"])).toEqual([]);
  });
});
