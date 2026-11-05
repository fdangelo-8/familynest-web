import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  openNotifiche,
  type NotificheFakeOptions,
} from "../fixtures/notifiche-visuale";
import { hasTestUser } from "../fixtures/visual-login";
import { signInAsCached } from "../fixtures/visual-login-cached";

// Notifiche (#39): axe in every state, one visible h1, names read by screen
// readers, keyboard order, visible focus, touch areas (mobile). The data are
// served by a fake (fixtures/notifiche-visuale.ts); sign-in and the Nest are
// real, so test user A is needed.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.beforeEach(async ({ context, baseURL }) => {
  test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
  const signedIn = await signInAsCached(context, baseURL!, "A");
  test.skip(!signedIn, "utente di test A non ancora creato (#55)");
});

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target.join(" ")),
    }));
}

async function expectNoViolations(page: Page) {
  expect(await seriousViolations(page)).toEqual([]);
}

/**
 * True when the 44 x 44 px square around the centre of the control hits the
 * control (or something inside it): the touch area is the whole square.
 */
async function hasTouchArea(target: Locator, size = 44) {
  return target.evaluate((el, s) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const half = s / 2 - 1;
    const points = [
      [cx - half, cy - half],
      [cx + half, cy - half],
      [cx - half, cy + half],
      [cx + half, cy + half],
      [cx, cy],
    ];
    return points.every(([x, y]) => {
      const hit = document.elementFromPoint(x!, y!);
      return hit !== null && (hit === el || el.contains(hit));
    });
  }, size);
}

async function hasFocusRing(target: Locator) {
  return target.evaluate((el) => {
    const cs = getComputedStyle(el);
    return (
      (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) ||
      cs.boxShadow !== "none"
    );
  });
}

/** Names of the controls reached with Tab, in order (aria-label or text). */
async function tabOrder(page: Page, steps: number) {
  const names: string[] = [];
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press("Tab");
    names.push(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return "";
        return (
          el.getAttribute("aria-label") ??
          (el.innerText || el.textContent || "").trim()
        );
      }),
    );
  }
  return names;
}

const STATES: Array<{
  name: string;
  options: NotificheFakeOptions;
  ready: boolean;
  wait: (page: Page) => Promise<void>;
}> = [
  {
    name: "normale con sintesi",
    options: {},
    ready: true,
    wait: async (page) => {
      await expect(page.getByTestId("sintesi")).toBeVisible();
    },
  },
  {
    name: "vuoto",
    options: { scenario: "vuoto", digest: "off" },
    ready: true,
    wait: async () => {},
  },
  {
    name: "caricamento",
    options: { list: "slow" },
    ready: false,
    wait: async (page) => {
      await expect(page.locator('[aria-busy="true"]').first()).toContainText(
        "Caricamento in corso",
      );
    },
  },
  {
    name: "errore di pagina",
    options: { list: "error" },
    ready: false,
    wait: async (page) => {
      await expect(
        page.getByRole("heading", { name: "Questa pagina non si è caricata" }),
      ).toBeVisible();
    },
  },
  {
    name: "errore della sola sintesi",
    options: { digest: "error" },
    ready: true,
    wait: async (page) => {
      await expect(page.locator(".avviso[role=alert]")).toContainText(
        "Non riusciamo a caricare la sintesi di oggi",
      );
    },
  },
];

for (const state of STATES) {
  test(`axe: ${state.name}`, async ({ page }) => {
    await openNotifiche(page, state.options, state.ready);
    await state.wait(page);
    await expectNoViolations(page);
  });
}

test("axe: offline", async ({ page, context }) => {
  await openNotifiche(page);
  await context.setOffline(true);
  await expect(page.getByTestId("avviso-offline")).toBeVisible();
  await expectNoViolations(page);
});

test("axe: «Fatto» con toast", async ({ page }) => {
  await openNotifiche(page);
  await page.getByRole("button", { name: "Fatto" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Fatto:" }),
  ).toBeVisible();
  await expectNoViolations(page);
});

test("axe: «Fatto», ma il da fare non c'è più", async ({ page }) => {
  await openNotifiche(page, { todo: "gone" });
  await page.getByRole("button", { name: "Fatto" }).click();
  await expect(page.locator(".avviso[role=alert]")).toContainText(
    "Questa cosa da fare non c'è più",
  );
  await expectNoViolations(page);
});

test("axe: «Segna tutte» (desktop)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "su mobile non c'è");
  await openNotifiche(page);
  await page.getByRole("button", { name: "Segna tutte come lette" }).click();
  await expect(page.locator(".sezione__info")).toHaveCount(0);
  await expectNoViolations(page);
});

test("axe: «Segna tutte» non riuscito (desktop)", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "su mobile non c'è");
  const fake = await openNotifiche(page);
  fake.failMarking();
  await page.getByRole("button", { name: "Segna tutte come lette" }).click();
  await expect(page.locator(".avviso[role=alert]")).toContainText(
    "Non siamo riusciti a segnare le notifiche come lette",
  );
  await expectNoViolations(page);
});

// --- structure and names ----------------------------------------------------

test("un solo h1 visibile, un h2 per giorno, sintesi con il suo nome", async ({
  page,
}) => {
  await openNotifiche(page);
  await expect(
    page.getByRole("heading", { level: 1, name: "Notifiche" }),
  ).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Oggi",
    "Ieri",
  ]);
  await expect(
    page.getByRole("region", { name: "Il tuo martedì" }),
  ).toBeVisible();
});

test("«Fatto» e «Apri» hanno il nome visibile e descrivono la riga", async ({
  page,
}) => {
  await openNotifiche(page);
  const row = page.getByTestId("notifica").first();
  const done = row.getByRole("button", { name: "Fatto" });
  const open = row.getByRole("link", { name: "Apri" });
  await expect(done).toBeVisible();
  await expect(open).toHaveAttribute("href", "/casa/da-fare");
  for (const control of [done, open]) {
    await expect(control).toHaveAccessibleDescription(
      /Laura ti ha assegnato Firmare autorizzazione gita/,
    );
  }
  await expect(row).toContainText("Nuova.");
});

test("la barra mobile ha «Indietro» e l'ingranaggio verso le impostazioni", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "la barra c'è solo su mobile");
  await openNotifiche(page);
  await expect(
    page.getByRole("link", { name: "Impostazioni delle notifiche" }),
  ).toHaveAttribute("href", "/impostazioni#notifiche");
  await expect(page.getByRole("link", { name: "Indietro" })).toBeVisible();
});

// --- keyboard ---------------------------------------------------------------

test("ordine del fuoco da tastiera: intestazione, parole, righe", async ({
  page,
}, testInfo) => {
  await openNotifiche(page);
  const names = await tabOrder(page, 22);
  const at = (name: string | RegExp) =>
    names.findIndex((n) =>
      typeof name === "string" ? n === name : name.test(n),
    );

  const skip = at(/Vai al contenuto/);
  const callTime = at("16:00");
  const callTitle = at("Call con Acme");
  const free = at(/liberi dalle/);
  const todoWord = at("Chiamare il commercialista");
  const done = at("Fatto");
  const open = names.findIndex((n, i) => n === "Apri" && i > done);

  expect(skip).toBe(0);
  for (const index of [callTime, callTitle, free, todoWord, done, open]) {
    expect(index, names.join(" | ")).toBeGreaterThan(-1);
  }
  expect(callTime).toBeLessThan(callTitle);
  expect(callTitle).toBeLessThan(free);
  expect(free).toBeLessThan(todoWord);
  expect(todoWord).toBeLessThan(done);
  expect(done).toBeLessThan(open);

  if (testInfo.project.name === "mobile") {
    expect(at("Indietro")).toBeLessThan(at("Impostazioni delle notifiche"));
    expect(at("Impostazioni delle notifiche")).toBeLessThan(callTime);
  } else {
    const markAll = at("Segna tutte come lette");
    expect(markAll).toBeGreaterThan(-1);
    expect(markAll).toBeLessThan(callTime);
  }
  // No tab stop is a trap: Tab keeps moving (the last steps differ from each other).
  expect(new Set(names).size).toBeGreaterThan(8);
});

test("il fuoco è visibile su «Fatto», «Apri» e sulle parole", async ({
  page,
}) => {
  await openNotifiche(page);
  const row = page.getByTestId("notifica").first();
  for (const target of [
    page.getByRole("link", { name: "16:00" }),
    row.getByRole("button", { name: "Fatto" }),
    row.getByRole("link", { name: "Apri" }),
  ]) {
    await target.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(target).toBeFocused();
    expect(await hasFocusRing(target)).toBe(true);
  }
});

test("dopo «Fatto» il fuoco va su «Apri» e dopo «Annulla» torna su «Fatto»", async ({
  page,
}) => {
  await openNotifiche(page);
  const row = page.getByTestId("notifica").first();
  await row.getByRole("button", { name: "Fatto" }).focus();
  await page.keyboard.press("Enter");
  await expect(row.getByRole("link", { name: "Apri" })).toBeFocused();
  await page
    .getByRole("status")
    .filter({ hasText: "Fatto:" })
    .getByRole("button", { name: "Annulla" })
    .click();
  await expect(row.getByRole("button", { name: "Fatto" })).toBeFocused();
});

test("offline: «Fatto» e «Segna tutte» restano raggiungibili ma non attivi", async ({
  page,
  context,
}, testInfo) => {
  await openNotifiche(page);
  await context.setOffline(true);
  await expect(page.getByTestId("avviso-offline")).toBeVisible();
  const done = page.getByRole("button", { name: "Fatto" });
  await expect(done).toHaveAttribute("aria-disabled", "true");
  await done.focus();
  await expect(done).toBeFocused();
  if (testInfo.project.name === "desktop") {
    await expect(
      page.getByRole("button", { name: "Segna tutte come lette" }),
    ).toHaveAttribute("aria-disabled", "true");
  }
});

// --- touch areas ------------------------------------------------------------

test("aree di tocco di almeno 44 px (mobile)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "area di tocco: mobile");
  await openNotifiche(page);
  const row = page.getByTestId("notifica").first();
  const controls = [
    row.getByRole("button", { name: "Fatto" }),
    row.getByRole("link", { name: "Apri" }),
    page.getByRole("link", { name: "Impostazioni delle notifiche" }),
    page.getByRole("link", { name: "Indietro" }),
  ];
  for (const control of controls) {
    expect(await hasTouchArea(control, 44)).toBe(true);
  }
  // «Fatto» and «Apri» are 8 px apart: the two areas do not overlap.
  const a = await row.getByRole("button", { name: "Fatto" }).boundingBox();
  const b = await row.getByRole("link", { name: "Apri" }).boundingBox();
  expect(b!.x - (a!.x + a!.width)).toBeGreaterThanOrEqual(8);
});
