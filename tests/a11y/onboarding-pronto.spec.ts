import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";

// Accessibility of onboarding step 5 "Pronto" (#15), at 390 and 1280 px (the
// two projects): axe without serious or critical violations, no duplicate ids
// (CA-24), keyboard, visible focus, touch target on mobile. Written before the
// page exists. Skipped when the test users are not configured.
// TODO(#15): adjust selectors to the final markup; do not weaken assertions.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

const PATH = "/onboarding/pronto";
const isMobile = () => test.info().project.name === "mobile";

async function openAsA(page: Page, baseURL: string | undefined) {
  test.skip(!usersConfigured("A"), skipReason("A"));
  await signInAs(page.context(), baseURL as string, "A");
  await page.goto(PATH);
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test("CA-24: axe non trova violazioni serious o critical", async ({
  page,
  baseURL,
}) => {
  await openAsA(page, baseURL);
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations
      .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
});

test("CA-24: nessun id duplicato e un solo h1 e un solo main", async ({
  page,
  baseURL,
}) => {
  await openAsA(page, baseURL);
  const duplicates = await page.evaluate(() => {
    const seen = new Map<string, number>();
    for (const el of document.querySelectorAll("[id]")) {
      seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
    }
    return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  });
  expect(duplicates).toEqual([]);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
});

test("CA-3: il fuoco con Tab è visibile su «Vai a Oggi» e non resta intrappolato", async ({
  page,
  baseURL,
}) => {
  await openAsA(page, baseURL);
  await page.keyboard.press("Tab");
  const link = page.getByRole("link", { name: "Vai a Oggi" });
  await expect(link).toBeFocused();
  const ring = await link.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: parseFloat(style.outlineWidth),
      boxShadow: style.boxShadow,
    };
  });
  expect(
    (ring.outlineStyle !== "none" && ring.outlineWidth > 0) ||
      ring.boxShadow !== "none",
  ).toBe(true);
  // A second Tab leaves the page: nothing else is focusable.
  await page.keyboard.press("Tab");
  await expect(link).not.toBeFocused();
});

test("CA-3: i nomi dei membri sono letti una volta sola, gli avatar sono nascosti", async ({
  page,
  baseURL,
}) => {
  await openAsA(page, baseURL);
  const group = page.getByRole("img", {
    name: "Marco, Laura, Sofia, Tommaso, Biscotto",
    exact: true,
  });
  await expect(group).toBeVisible();
  // TODO(#15): the single avatars carry the shared "avatar" class.
  const avatars = group.locator(".avatar");
  await expect(avatars).toHaveCount(5);
  for (let i = 0; i < 5; i++) {
    await expect(avatars.nth(i)).toHaveAttribute("aria-hidden", "true");
  }
});

test("area di tocco: «Vai a Oggi» è alto almeno 44 px (su mobile a tutta larghezza)", async ({
  page,
  baseURL,
}) => {
  await openAsA(page, baseURL);
  const box = await page
    .getByRole("link", { name: "Vai a Oggi" })
    .boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.width).toBeGreaterThanOrEqual(44);
  if (isMobile()) {
    // 350 px of content at 390 px (specification, section 5).
    expect(box!.width).toBeGreaterThanOrEqual(340);
  }
});
