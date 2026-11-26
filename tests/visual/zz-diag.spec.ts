import { test, type Page } from "@playwright/test";
import { NORMAL_LIST, installSpesaFake } from "../fixtures/spesa-fake";
import { NORMAL_TODOS, installTodosFake } from "../fixtures/todos-fake";
import {
  NORMAL_DEADLINES,
  installScadenzeFake,
} from "../fixtures/scadenze-fake";
import { signInAsCached } from "../fixtures/visual-login-cached";

// DEBUG-zz1: temporary diagnosis of #585, removed before merge.
test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

const NOW = new Date("2026-10-20T15:52:00+02:00");

async function probe(page: Page, label: string) {
  const info = await page.evaluate(() => {
    const b = getComputedStyle(document.body);
    return {
      ready: document.readyState,
      vis: document.visibilityState,
      bg: b.backgroundColor,
      text: document.body.innerText.length,
      anims: document
        .getAnimations()
        .map((a) => a.playState + ":" + (a.effect as KeyframeEffect)?.target?.tagName)
        .slice(0, 6),
      fonts: [...document.fonts].map((f) => f.family + ":" + f.status),
      bodyOpacity: b.opacity,
      htmlBg: getComputedStyle(document.documentElement).backgroundColor,
      h: document.documentElement.scrollHeight,
    };
  });
  const png = await page.screenshot();
  console.log(`[DEBUG-zz1] ${label} png=${png.length}`, JSON.stringify(info));
}

for (let i = 0; i < 3; i++) {
  test(`diag ${i}`, async ({ page, context, baseURL }) => {
    await signInAsCached(context, baseURL!, "A");
    await page.clock.install({ time: NOW });
    await installSpesaFake(page, { items: NORMAL_LIST, reads: "ok" });
    await installTodosFake(page, { todos: NORMAL_TODOS, reads: "slow" });
    await installScadenzeFake(page, {
      deadlines: NORMAL_DEADLINES,
      reads: "ok",
    });
    await page.goto("/casa/da-fare");
    await probe(page, `after-goto#${i}`);
    await page.evaluate(() => document.fonts.ready);
    await probe(page, `after-fonts#${i}`);
    await page.waitForTimeout(1500);
    await probe(page, `after-1500ms#${i}`);
  });
}
