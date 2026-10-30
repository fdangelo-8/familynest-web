import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";
import {
  backControl,
  control,
  copyButton,
  doneControl,
  heading,
  isMobileProject,
  messages,
  openInvite,
  sendButton,
  signInThrowaway,
  skipControl,
  visibleText,
  withInviteNest,
} from "../fixtures/invito";

// Accessibility of onboarding step 4 "Invito" (#14), written before the page
// exists, at 390 and 1280 px (the two projects): axe on every state, no
// duplicate ids (CA-25), focus order, visible focus, touch targets.
// Specification of 30/10 (no QR): focus order on mobile Indietro -> Manda ->
// Copia -> Lo faccio dopo; on desktop Manda -> Copia -> Indietro -> Ho finito.
// A is read-only; states that need other data use a throwaway administrator.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
  permissions: ["clipboard-read", "clipboard-write"],
});

async function expectNoBlocking(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations
      .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
}

async function expectNoDuplicateIds(page: Page) {
  const duplicates = await page.evaluate(() => {
    const seen = new Map<string, number>();
    for (const el of document.querySelectorAll("[id]")) {
      seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
    }
    return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  });
  expect(duplicates).toEqual([]);
}

async function openA(page: Page, baseURL: string | undefined) {
  test.skip(!usersConfigured("A"), skipReason("A"));
  await signInAs(page.context(), baseURL as string, "A");
  await openInvite(page);
}

test("CA-25: id unici e nessuna violazione axe serious o critical", async ({
  page,
  baseURL,
}) => {
  await openA(page, baseURL);
  await expectNoDuplicateIds(page);
  await expectNoBlocking(page);
});

test("axe dopo «Copia il link» (toast di conferma)", async ({
  page,
  baseURL,
}) => {
  await openA(page, baseURL);
  await copyButton(page).click();
  await expect(
    messages(page).filter({ hasText: "Link copiato" }),
  ).toBeVisible();
  await expectNoDuplicateIds(page);
  await expectNoBlocking(page);
});

test("axe con la copia non riuscita (avviso di errore)", async ({
  page,
  baseURL,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: () =>
        Promise.reject(new DOMException("denied", "NotAllowedError")),
    });
  });
  await openA(page, baseURL);
  await copyButton(page).click();
  await expect(
    messages(page).filter({ hasText: "Non siamo riusciti a copiare" }),
  ).toBeVisible();
  await expectNoDuplicateIds(page);
  await expectNoBlocking(page);
});

test("axe con due adulti (invito 1 di 2 e 2 di 2)", async ({
  page,
  baseURL,
}) => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
  await withInviteNest(async ({ user, addAdult }) => {
    await addAdult("Anna", "salvia");
    await addAdult("Carla", "glicine");
    await signInThrowaway(page, baseURL, user);
    await openInvite(page);
    await expect(
      visibleText(page, "Ultimo passo · invito 1 di 2"),
    ).toBeVisible();
    await expectNoDuplicateIds(page);
    await expectNoBlocking(page);
    await control(page, "Ora invita Carla").click();
    await expect(heading(page)).toHaveText("Invita Carla");
    await expectNoDuplicateIds(page);
    await expectNoBlocking(page);
  });
});

test("la barra dei passi è un progressbar «Passo 4 di 4» e c'è un solo h1", async ({
  page,
  baseURL,
}) => {
  await openA(page, baseURL);
  const bar = page.getByRole("progressbar", { name: "Passo 4 di 4" });
  await expect(bar).toHaveAttribute("aria-valuemin", "1");
  await expect(bar).toHaveAttribute("aria-valuenow", "4");
  await expect(bar).toHaveAttribute("aria-valuemax", "4");
  await expect(heading(page)).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
});

test("ordine del fuoco da tastiera e anello visibile", async ({
  page,
  baseURL,
}) => {
  await openA(page, baseURL);
  const order = isMobileProject()
    ? [
        backControl(page),
        sendButton(page, "Laura"),
        copyButton(page),
        skipControl(page),
      ]
    : [
        sendButton(page, "Laura"),
        copyButton(page),
        backControl(page),
        doneControl(page),
      ];
  for (const target of order) {
    await page.keyboard.press("Tab");
    await expect(target).toBeFocused();
    const ring = await target.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        width: parseFloat(style.outlineWidth),
        style: style.outlineStyle,
        shadow: style.boxShadow,
      };
    });
    expect(
      (ring.style !== "none" && ring.width > 0) || ring.shadow !== "none",
    ).toBe(true);
  }
});

test("«Copia il link» si usa da tastiera e il fuoco resta sul bottone", async ({
  page,
  baseURL,
}) => {
  await openA(page, baseURL);
  await copyButton(page).focus();
  await page.keyboard.press("Enter");
  await expect(
    messages(page).filter({ hasText: "Link copiato" }),
  ).toBeVisible();
  await expect(copyButton(page)).toBeFocused();
});

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
      if (!hit || !(el === hit || el.contains(hit))) misses.push(`${dx},${dy}`);
    }
    return { width: r.width, height: r.height, misses };
  });
  const bigEnough = result.width >= 44 && result.height >= 44;
  expect(
    bigEnough || result.misses.length === 0,
    `${what}: ${Math.round(result.width)}x${Math.round(result.height)} px, area di 44 px non raggiunta`,
  ).toBe(true);
}

test("mobile: aree di tocco di almeno 44 px", async ({ page, baseURL }) => {
  test.skip(!isMobileProject(), "Solo mobile (390 px)");
  await openA(page, baseURL);
  await expectTouchArea(backControl(page), "freccia Indietro");
  await expectTouchArea(sendButton(page, "Laura"), "Manda il link");
  await expectTouchArea(copyButton(page), "Copia il link");
  await expectTouchArea(skipControl(page), "Lo faccio dopo");
});

test("desktop: i controlli di invito e uscita sono alti almeno 44 px", async ({
  page,
  baseURL,
}) => {
  test.skip(isMobileProject(), "Solo desktop (1280 px)");
  await openA(page, baseURL);
  for (const target of [
    sendButton(page, "Laura"),
    copyButton(page),
    backControl(page),
    doneControl(page),
  ]) {
    const box = await target.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});
