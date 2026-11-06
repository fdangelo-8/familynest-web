import {
  expect,
  test,
  type CDPSession,
  type Locator,
  type Page,
} from "@playwright/test";
import { waitForAnimationsToEnd } from "../fixtures/animations";
import { buildNest, type CasaNest } from "../fixtures/casa";
import {
  THURSDAY,
  installFakes as installAddFakes,
} from "../fixtures/aggiungi-fake";
import {
  NOW as DETAIL_NOW,
  detailUrl,
  installEventFake,
} from "../fixtures/dettaglio-impegno-fake";
import {
  FIXED_NOW as WISH_NOW,
  openPublic,
  wishNest,
} from "../fixtures/lista-desideri-visuale";
import { installOggiFake, oggiNow } from "../fixtures/oggi-visuale";
import {
  createThrowawayUser,
  throwawayConfigured,
  throwawaySkipReason,
  type ThrowawayUser,
} from "../fixtures/throwaway-user";
import { hasTestUser } from "../fixtures/visual-login";
import { signInAsCached } from "../fixtures/visual-login-cached";
import {
  LONG_INVITEE,
  LONG_INVITER,
  LONG_MESSAGE,
  LONG_NEST,
  inviteFixture,
  openLink,
  signIn as signInInvite,
  visitor,
  waitWelcome,
} from "../visual/invito-ingresso-helpers";
import {
  FULL_WEEK,
  MOCKUP_NEST,
  NOW as CALENDAR_NOW,
  chooseLens,
  waitForData as waitForWeek,
} from "../visual/calendario-settimana-helpers";
import { TUESDAY, waitForDayData } from "../visual/calendario-giorno-helpers";
import { MONTH_EVENTS, waitForMonth } from "../visual/calendario-mese-helpers";
import { createEvents } from "../visual/calendario-settimana-helpers";
import { FAMILY, openAddSheet, userWithNest } from "../visual/persone-helpers";
import { readyUser } from "../visual/pronto-helpers";
import { PATH as CALENDAR_STEP_PATH } from "../visual/calendario-helpers";

// Validation of the screens of sign-in, invitation, onboarding, Today, Calendar
// (week, day, month), event detail and Add (#308). For every page and every
// width of the list below, the same automatic checks:
//
//  1. no horizontal scroll (scrollWidth <= clientWidth) and no visible element
//     that leaves the viewport (elements inside a clipping or scrolling
//     ancestor are the ancestor's business);
//  2. touch areas of at least 44 x 44 px on every visible interactive element
//     under 768 px (the transparent ::before of the small controls counts, as
//     in the other specs). Exceptions only the ones written in the design-system
//     skill ("Aree di tocco"): links inside a sentence, `.legale__link`, the
//     decorative `.quadrato-nest--notte`, `.nav-alto__voce` (from 1024 px);
//  3. enlarged text (browser font size at 32 px, i.e. 200%) at 360 and 390 px:
//     no clipped or overlapping text, no horizontal scroll, touch areas of 44 px
//     and `main h1` really twice as big as at 100%. The font size is set with
//     CDP `Page.setFontSizes` BEFORE the navigation (never change the root
//     once the page is drawn: container queries in rem do not recompute);
//  4. keyboard on the text fields at 360 and 390 px: with the viewport 300 px
//     shorter (the keyboard) the focused field stays visible and not covered;
//  5. bottom sheets: they open whole inside the viewport, scroll with the wheel
//     when taller than the viewport, the main button stays reachable (also with
//     the viewport 300 px shorter below 768 px) and they close.
//
// Every width attaches a screenshot of the page to the test. A failed check is
// a soft failure named "[WxH] what", so a run lists every defect at once. The
// spec runs once, in the `desktop` project: it sets its own viewports.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

const WIDTHS: Array<[number, number]> = [
  [360, 780],
  [375, 812],
  [390, 844],
  [393, 852],
  [412, 915],
  [430, 932],
  [640, 800],
  [768, 1024],
  [1280, 800],
  [1440, 900],
];
const ENLARGED_AT = new Set([360, 390]);
const KEYBOARD_AT = new Set([360, 390]);
const KEYBOARD_HEIGHT = 300;
const MAX_LISTED = 12;

// ---------------------------------------------------------------- in-page

/** Short readable selector, built inside the page. Shared as source text. */
const DESCRIBE = `
  const describe = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += "#" + el.id;
    const cls = typeof el.className === "string" ? el.className.trim() : "";
    if (cls) s += "." + cls.split(/\\s+/).slice(0, 3).join(".");
    const text = (el.getAttribute("aria-label") || el.textContent || "")
      .replace(/\\s+/g, " ").trim().slice(0, 28);
    return text ? s + ' "' + text + '"' : s;
  };
`;

type Problems = string[];

async function overflowProblems(page: Page): Promise<Problems> {
  return page.evaluate(`(() => {
    ${DESCRIBE}
    const out = [];
    const de = document.documentElement;
    const vw = de.clientWidth;
    if (de.scrollWidth > vw) {
      out.push("documento largo " + de.scrollWidth + " px su " + vw + " px");
    }
    const seen = new Set();
    for (const el of document.body.querySelectorAll("*")) {
      if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) continue;
      if (r.right <= vw + 1 && r.left >= -1) continue;
      let clipped = false;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.overflowX !== "visible") { clipped = true; break; }
      }
      if (clipped) continue;
      const d = describe(el) + " [" + Math.round(r.left) + ".." + Math.round(r.right) + "]";
      if (!seen.has(d)) { seen.add(d); out.push(d); }
    }
    return out;
  })()`) as Promise<Problems>;
}

async function touchProblems(page: Page): Promise<Problems> {
  return page.evaluate(`(() => {
    ${DESCRIBE}
    const interactive = [
      "a[href]", "button", "input:not([type=hidden])", "select", "textarea",
      "summary", "[role=button]", "[role=link]", "[role=tab]", "[role=radio]",
      "[role=checkbox]", "[role=switch]", "[role=menuitem]", "[role=option]",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");
    const exceptions = ".legale__link, .quadrato-nest--notte, .nav-alto__voce";
    const out = [];
    const seen = new Set();
    const grown = (el) => {
      // Size of the area: the box, or the transparent ::before / ::after.
      const r = el.getBoundingClientRect();
      let w = r.width, h = r.height;
      for (const p of ["::before", "::after"]) {
        const s = getComputedStyle(el, p);
        if (s.content !== "none" && s.position === "absolute") {
          w = Math.max(w, parseFloat(s.width) || 0);
          h = Math.max(h, parseFloat(s.height) || 0);
        }
      }
      return [w, h];
    };
    for (const el of document.body.querySelectorAll(interactive)) {
      if (el.disabled || el.closest("[inert], [aria-hidden=true]")) continue;
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      if (el.matches(exceptions)) continue;
      let target = el;
      if (el.tagName === "INPUT" && el.labels && el.labels.length) {
        const own = el.getBoundingClientRect();
        if (own.width <= 24 || own.height <= 24) target = el.labels[0];
      }
      const r0 = target.getBoundingClientRect();
      if (r0.width <= 1 || r0.height <= 1) continue;
      // A link inside a sentence is the "in linea" exception.
      if (el.tagName === "A" && getComputedStyle(el).display === "inline") {
        const parent = el.parentElement;
        if (parent && (parent.textContent || "").trim().length >
            (el.textContent || "").trim().length + 2) continue;
      }
      const [w, h] = grown(target);
      if (w >= 43.5 && h >= 43.5) continue;
      // The padding of the row or a bigger parent may carry the area: ask the
      // browser which element answers at the corners of a 44 px box.
      target.scrollIntoView({ block: "center", inline: "center" });
      const r = target.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const center = document.elementFromPoint(cx, cy);
      if (!center || !(el === center || el.contains(center) || target.contains(center))) continue;
      let miss = 0;
      for (const [dx, dy] of [[-20, -20], [20, -20], [-20, 20], [20, 20]]) {
        const hit = document.elementFromPoint(cx + dx, cy + dy);
        if (!hit || !(el === hit || el.contains(hit) || target.contains(hit))) miss += 1;
      }
      if (miss === 0) continue;
      const d = describe(el) + " " + Math.round(w) + "x" + Math.round(h);
      if (!seen.has(d)) { seen.add(d); out.push(d); }
    }
    window.scrollTo(0, 0);
    return out;
  })()`) as Promise<Problems>;
}

/**
 * Sets the browser font size (16 px = 100%, 32 px = 200%). It applies to the
 * next navigation, so call it BEFORE the `open()` that goes to the page.
 */
const fontSessions = new WeakMap<Page, CDPSession>();
async function setBrowserFontSize(page: Page, px: 16 | 32) {
  // One session per page, never detached: detaching resets the font size.
  let cdp = fontSessions.get(page);
  if (!cdp) {
    cdp = await page.context().newCDPSession(page);
    fontSessions.set(page, cdp);
  }
  await cdp.send("Page.setFontSizes", { fontSizes: { standard: px } });
}

/** Font size in px of the first visible `main h1` (or h1), or null. */
async function headingFontSize(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const list = [...document.querySelectorAll("main h1, h1")];
    const h1 = list.find((el) =>
      el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
    );
    return h1 ? parseFloat(getComputedStyle(h1).fontSize) : null;
  });
}

async function textProblems(page: Page): Promise<Problems> {
  return page.evaluate(`(() => {
    ${DESCRIBE}
    const out = [];
    const hiddenOverflow = (v) => v === "hidden" || v === "clip";
    const items = [];
    for (const el of document.body.querySelectorAll("*")) {
      if (el.closest("svg")) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own.length) continue;
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      const er = el.getBoundingClientRect();
      if (er.width <= 1 || er.height <= 1) continue;
      const lines = [];
      const own_s = getComputedStyle(el);
      const fs = parseFloat(own_s.fontSize);
      const lh = own_s.lineHeight.endsWith("px") ? parseFloat(own_s.lineHeight) : fs * 1.2;
      for (const node of own) {
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.width <= 2 || rect.height <= 2) continue;
          // getClientRects gives the font area (Parkinsans is about 1.42 em):
          // shrink it to the line height, centred.
          const h = Math.min(rect.height, lh);
          const top = rect.top + (rect.height - h) / 2;
          lines.push({
            left: rect.left, right: rect.right, width: rect.width,
            top, bottom: top + h, height: h,
          });
        }
      }
      if (!lines.length) continue;
      // Overlaps count only on the visible part: intersect each line with every
      // ancestor whose overflow is not visible (also auto and scroll, #313).
      const shown = [];
      for (const l0 of lines) {
        let l = { ...l0 };
        for (let a = el.parentElement; a && a !== document.body && l; a = a.parentElement) {
          const s = getComputedStyle(a);
          if (s.overflowX === "visible" && s.overflowY === "visible") continue;
          const ar = a.getBoundingClientRect();
          if (s.overflowX !== "visible") {
            l.left = Math.max(l.left, ar.left);
            l.right = Math.min(l.right, ar.right);
          }
          if (s.overflowY !== "visible") {
            l.top = Math.max(l.top, ar.top);
            l.bottom = Math.min(l.bottom, ar.bottom);
          }
          if (l.right <= l.left || l.bottom <= l.top) l = null;
        }
        if (l) shown.push(l);
      }
      if (shown.length) items.push({ el, lines: shown });
      // The day-calendar blocks clip their text on purpose (height = duration).
      if (el.closest(".blocco-orario")) continue;
      // Clipped: a line leaves an ancestor that hides its overflow.
      let flagged = false;
      for (let a = el; a && a !== document.body && !flagged; a = a.parentElement) {
        const s = getComputedStyle(a);
        const clipX = hiddenOverflow(s.overflowX);
        const clipY = hiddenOverflow(s.overflowY);
        if (!clipX && !clipY) continue;
        const ar = a.getBoundingClientRect();
        for (const l of lines) {
          const outX = clipX && (l.right > ar.right + 1.5 || l.left < ar.left - 1.5);
          const outY = clipY && (l.bottom > ar.bottom + 1.5 || l.top < ar.top - 1.5);
          if (outX || outY) {
            out.push("tagliato in " + describe(a) + ": " + describe(el));
            flagged = true;
            break;
          }
        }
      }
      const s = getComputedStyle(el);
      if (s.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1) {
        out.push("puntini di sospensione: " + describe(el));
      }
      if (s.webkitLineClamp && s.webkitLineClamp !== "none" && el.scrollHeight > el.clientHeight + 1) {
        out.push("righe tagliate: " + describe(el));
      }
    }
    const context = (el) => {
      for (let a = el; a; a = a.parentElement) {
        const p = getComputedStyle(a).position;
        if (p === "fixed" || p === "sticky") return a;
      }
      return null;
    };
    const seen = new Set();
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        if (context(a.el) !== context(b.el)) continue;
        let hit = false;
        for (const x of a.lines) {
          for (const y of b.lines) {
            const w = Math.min(x.right, y.right) - Math.max(x.left, y.left);
            const h = Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top);
            if (w > 2 && h > 3) { hit = true; break; }
          }
          if (hit) break;
        }
        if (hit) {
          const d = "sovrapposti: " + describe(a.el) + " / " + describe(b.el);
          if (!seen.has(d)) { seen.add(d); out.push(d); }
        }
      }
    }
    return out;
  })()`) as Promise<Problems>;
}

// ----------------------------------------------------------------- keyboard

const TEXT_FIELD =
  "input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=range]):not([type=file]), textarea";

/** Tags the fields that can be reached (visible, not behind a sheet). */
async function reachableFields(page: Page): Promise<number> {
  return page.evaluate((selector) => {
    let n = 0;
    for (const el of document.querySelectorAll<HTMLInputElement>(selector)) {
      el.removeAttribute("data-qa-field");
      if (el.disabled || el.readOnly) continue;
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
        continue;
      el.scrollIntoView({ block: "center" });
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) continue;
      const hit = document.elementFromPoint(
        r.left + r.width / 2,
        r.top + r.height / 2,
      );
      if (!hit || !(hit === el || el.contains(hit))) continue;
      el.setAttribute("data-qa-field", String(n));
      n += 1;
    }
    window.scrollTo(0, 0);
    return n;
  }, TEXT_FIELD);
}

async function keyboardProblems(page: Page): Promise<Problems> {
  const out: Problems = [];
  const count = await reachableFields(page);
  const size = page.viewportSize()!;
  for (let i = 0; i < count; i++) {
    await page.setViewportSize({
      width: size.width,
      height: size.height - KEYBOARD_HEIGHT,
    });
    const field = page.locator(`[data-qa-field="${i}"]`);
    // A field the sheet already focused would not scroll again: blur first.
    await field.evaluate((el) => (el as HTMLElement).blur());
    await field.focus();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    const state = (await field.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const hit = document.elementFromPoint(
        Math.min(Math.max(r.left + r.width / 2, 0), window.innerWidth - 1),
        Math.min(Math.max(r.top + r.height / 2, 0), vh - 1),
      );
      const name =
        el.getAttribute("aria-label") ||
        el.getAttribute("name") ||
        el.getAttribute("type") ||
        el.tagName.toLowerCase();
      return {
        name,
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        vh,
        focused: document.activeElement === el,
        scroll: (() => {
          for (let a = el.parentElement; a; a = a.parentElement) {
            const o = getComputedStyle(a).overflowY;
            if (o === "auto" || o === "scroll" || o === "hidden") {
              return `${o} ${a.className.toString().split(" ")[0]} top=${a.scrollTop} h=${a.clientHeight}/${a.scrollHeight} rect=${Math.round(a.getBoundingClientRect().top)}`;
            }
          }
          return "nessun contenitore";
        })(),
        inside: r.top >= 0 && r.bottom <= vh,
        free: !!hit && (hit === el || el.contains(hit)),
      };
    })) as {
      name: string;
      top: number;
      bottom: number;
      vh: number;
      inside: boolean;
      free: boolean;
      scroll: string;
      focused: boolean;
    };
    if (!state.inside) {
      out.push(
        `campo "${state.name}" fuori vista: ${state.top}..${state.bottom} su altezza ${state.vh}; contenitore: ${state.scroll}; con il fuoco: ${state.focused}`,
      );
    } else if (!state.free) {
      out.push(`campo "${state.name}" coperto da un altro elemento`);
    }
    await page.setViewportSize(size);
  }
  return out;
}

// ------------------------------------------------------------------- sheets

type SheetSpec = {
  /** Opens the sheet (from the page just opened) and returns the dialog. */
  open: (page: Page) => Promise<Locator>;
};

async function sheetProblems(
  page: Page,
  dialog: Locator,
  shortViewport: boolean,
): Promise<Problems> {
  const out: Problems = [];
  const size = page.viewportSize()!;
  if (shortViewport) {
    await page.setViewportSize({
      width: size.width,
      height: size.height - KEYBOARD_HEIGHT,
    });
  }
  await waitForAnimationsToEnd(page);
  const state = (await dialog.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    let scroller: Element | null = null;
    for (const c of [el, ...el.querySelectorAll("*")]) {
      const s = getComputedStyle(c);
      if (
        (s.overflowY === "auto" || s.overflowY === "scroll") &&
        c.scrollHeight > c.clientHeight + 1
      ) {
        scroller = c;
        break;
      }
    }
    // Content taller than the sheet and nothing that scrolls.
    const hiddenOverflow = [el, ...el.querySelectorAll("*")].filter((c) => {
      const s = getComputedStyle(c);
      return (
        (s.overflowY === "hidden" || s.overflowY === "clip") &&
        c.scrollHeight > c.clientHeight + 2 &&
        c.clientHeight > 4
      );
    });
    const sr = scroller?.getBoundingClientRect();
    return {
      left: Math.round(r.left),
      right: Math.round(r.right),
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      vw,
      vh,
      scrolls: !!scroller,
      scrollerBox: sr
        ? { x: sr.left + sr.width / 2, y: sr.top + sr.height / 2 }
        : null,
      hiddenTall: hiddenOverflow.length
        ? `${hiddenOverflow[0]!.tagName.toLowerCase()}.${String(hiddenOverflow[0]!.className).split(" ")[0]}`
        : "",
    };
  })) as {
    left: number;
    right: number;
    top: number;
    bottom: number;
    vw: number;
    vh: number;
    scrolls: boolean;
    scrollerBox: { x: number; y: number } | null;
    hiddenTall: string;
  };
  if (state.left < -1 || state.right > state.vw + 1) {
    out.push(
      `pannello fuori dai lati: ${state.left}..${state.right} su ${state.vw}`,
    );
  }
  if (state.top < -1 || state.bottom > state.vh + 1) {
    out.push(
      `pannello non intero: ${state.top}..${state.bottom} su altezza ${state.vh}`,
    );
  }
  if (!state.scrolls && state.hiddenTall) {
    out.push(
      `contenuto più alto del pannello senza scorrimento (${state.hiddenTall})`,
    );
  }
  if (state.scrollerBox) {
    await page.mouse.move(state.scrollerBox.x, state.scrollerBox.y);
    await page.mouse.wheel(0, 3000);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    const moved = await dialog.evaluate((el) => {
      for (const c of [el, ...el.querySelectorAll("*")]) {
        const s = getComputedStyle(c);
        if (
          (s.overflowY === "auto" || s.overflowY === "scroll") &&
          c.scrollHeight > c.clientHeight + 1
        ) {
          return c.scrollTop > 0;
        }
      }
      return false;
    });
    if (!moved) out.push("la rotella non fa scorrere il pannello");
  }
  const primary = dialog.locator(".btn-primary").locator("visible=true").last();
  if ((await primary.count()) === 0) {
    out.push("nessun pulsante principale (.btn-primary) nel pannello");
  } else {
    const reach = await primary.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const vw = document.documentElement.clientWidth;
      const hit = document.elementFromPoint(
        Math.min(Math.max(r.left + r.width / 2, 0), vw - 1),
        Math.min(Math.max(r.top + r.height / 2, 0), vh - 1),
      );
      return {
        inside: r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw,
        free: !!hit && (hit === el || el.contains(hit)),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        vh,
        label: (el.textContent ?? "").trim().slice(0, 24),
      };
    });
    if (!reach.inside) {
      out.push(
        `pulsante "${reach.label}" non raggiungibile: ${reach.top}..${reach.bottom} su altezza ${reach.vh}`,
      );
    } else if (!reach.free) {
      out.push(`pulsante "${reach.label}" coperto da un altro elemento`);
    }
  }
  if (shortViewport) await page.setViewportSize(size);
  return out;
}

async function closeSheet(page: Page, dialog: Locator): Promise<Problems> {
  const close = dialog.getByRole("button", { name: "Chiudi" }).first();
  if (await close.isVisible()) {
    await close.click();
  } else {
    await page.keyboard.press("Escape");
  }
  try {
    await expect(dialog).toBeHidden({ timeout: 5000 });
    return [];
  } catch {
    return ["il pannello non si chiude (Chiudi / Esc)"];
  }
}

// ------------------------------------------------------------------ scenes

type Scene = {
  title: string;
  /** Skips the scene when what it needs is missing. */
  skipReason?: () => string | null;
  /**
   * Prepares data and session once, then runs `check` with a function that
   * opens the page in the current viewport. Cleans up at the end.
   */
  run: (
    ctx: { page: Page; baseURL: string | undefined },
    check: (open: () => Promise<void>, sheet?: SheetSpec) => Promise<void>,
  ) => Promise<void>;
};

const needsThrowaway = () =>
  throwawayConfigured() ? null : throwawaySkipReason;
const needsUserA = () =>
  hasTestUser("A") && throwawayConfigured()
    ? null
    : "TEST_USER_A_* o chiavi Supabase non impostati";

const ready = (page: Page) =>
  page.evaluate(() => document.fonts.ready).then(() => undefined);

async function withCalendarNest(
  { page, baseURL }: { page: Page; baseURL: string | undefined },
  events: Parameters<typeof createEvents>[1],
  members: typeof MOCKUP_NEST,
  body: (nest: CasaNest) => Promise<void>,
) {
  const { nest, cleanup } = await buildNest("Casa D'Angelo", members);
  try {
    await createEvents(nest, events);
    await chooseLens(page, "nest");
    await page.clock.setFixedTime(CALENDAR_NOW);
    await nest.signIn(page, baseURL, "Marco");
    await body(nest);
  } finally {
    await cleanup();
  }
}

const scenes: Scene[] = [
  {
    title: "accesso",
    run: async ({ page }, check) => {
      await check(async () => {
        await page.goto("/accesso");
        await expect(page.locator("h1:visible")).toHaveCount(1);
        await ready(page);
      });
    },
  },
  {
    title: "accesso con la mail",
    run: async ({ page }, check) => {
      await check(async () => {
        await page.goto("/accesso/mail");
        await expect(page.locator("h1:visible")).toHaveCount(1);
        await ready(page);
      });
    },
  },
  {
    title: "invito (senza accesso)",
    skipReason: needsThrowaway,
    run: async ({ page }, check) => {
      const invite = await inviteFixture();
      try {
        await check(async () => {
          await openLink(page, invite.token);
          await waitWelcome(page);
          await ready(page);
        });
      } finally {
        await invite.remove();
      }
    },
  },
  {
    title: "invito (nomi e messaggio lunghi)",
    skipReason: needsThrowaway,
    run: async ({ page }, check) => {
      const invite = await inviteFixture({
        nest: LONG_NEST,
        inviter: LONG_INVITER,
        invitee: LONG_INVITEE,
        message: LONG_MESSAGE,
      });
      try {
        await check(async () => {
          await openLink(page, invite.token);
          await waitWelcome(page);
          await ready(page);
        });
      } finally {
        await invite.remove();
      }
    },
  },
  {
    title: "invito (con accesso)",
    skipReason: needsThrowaway,
    run: async ({ page, baseURL }, check) => {
      const invite = await inviteFixture();
      const guest = await visitor();
      try {
        await signInInvite(page, baseURL, guest);
        await check(async () => {
          await openLink(page, invite.token);
          await waitWelcome(page);
          await ready(page);
        });
      } finally {
        await guest.remove();
        await invite.remove();
      }
    },
  },
  {
    title: "invito, il tuo colore",
    skipReason: needsThrowaway,
    run: async ({ page, baseURL }, check) => {
      const invite = await inviteFixture();
      const guest = await visitor();
      try {
        await signInInvite(page, baseURL, guest);
        await check(async () => {
          await openLink(page, invite.token);
          await page.goto("/invito/colore");
          await expect(
            page.getByRole("radiogroup", { name: "Il tuo colore" }).filter({
              visible: true,
            }),
          ).toBeVisible();
          await ready(page);
        });
      } finally {
        await guest.remove();
        await invite.remove();
      }
    },
  },
  {
    title: "onboarding 1, chi vive con te",
    skipReason: needsThrowaway,
    run: async ({ page, baseURL }, check) => {
      const user = await createThrowawayUser("Marco");
      try {
        await user.signInContext(page.context(), baseURL as string);
        await check(async () => {
          await page.goto("/onboarding");
          await expect(page.locator("h1:visible")).toHaveText(
            "Chi vive con te?",
          );
          await expect(
            page.locator('[role="radiogroup"]:visible'),
          ).toBeVisible();
          await ready(page);
        });
      } finally {
        await user.remove();
      }
    },
  },
  {
    title: "onboarding 2, chi c'è nel Nest",
    skipReason: needsThrowaway,
    run: async ({ page, baseURL }, check) => {
      const user = await userWithNest("family_with_children", FAMILY);
      try {
        await user.signInContext(page.context(), baseURL as string);
        await check(
          async () => {
            await page.goto("/onboarding/persone");
            await page.locator("h1:visible").waitFor();
            await page
              .getByRole("list", { name: "Persone del Nest" })
              .filter({ visible: true })
              .waitFor();
            await ready(page);
          },
          { open: (p) => openAddSheet(p) },
        );
      } finally {
        await user.remove();
      }
    },
  },
  {
    title: "onboarding 3, invita",
    skipReason: needsThrowaway,
    run: async ({ page, baseURL }, check) => {
      const user = await userWithNest("couple", [
        { name: "Carla", kind: "adult", color: "lampone" },
      ]);
      try {
        await user.signInContext(page.context(), baseURL as string);
        await check(async () => {
          await page.goto("/onboarding/invito");
          await page.locator("h1:visible").first().waitFor();
          await expect(
            page
              .getByRole("button", { name: "Copia il link" })
              .filter({ visible: true }),
          ).toBeVisible();
          await ready(page);
        });
      } finally {
        await user.remove();
      }
    },
  },
  {
    title: "onboarding 4, porta qui il tuo calendario",
    skipReason: needsThrowaway,
    run: async ({ page, baseURL }, check) => {
      const user = await userWithNest("couple", [
        { name: "Bea", kind: "adult", color: "glicine" },
      ]);
      try {
        await user.signInContext(page.context(), baseURL as string);
        await check(async () => {
          await page.goto(CALENDAR_STEP_PATH);
          await expect(page.locator("h1:visible")).toHaveText(
            "Porta qui il tuo calendario",
          );
          await ready(page);
        });
      } finally {
        await user.remove();
      }
    },
  },
  {
    title: "onboarding, pronto",
    skipReason: needsThrowaway,
    run: async ({ page, baseURL }, check) => {
      const user: ThrowawayUser = await readyUser(
        "couple",
        [{ name: "Bea", kind: "adult", color: "glicine" }],
        ["Bea"],
      );
      try {
        await user.signInContext(page.context(), baseURL as string);
        await check(async () => {
          await page.goto("/onboarding/pronto");
          await page
            .getByRole("link", { name: "Vai a Oggi" })
            .first()
            .waitFor({ state: "attached" });
          await ready(page);
        });
      } finally {
        await user.remove();
      }
    },
  },
  {
    title: "lista desideri pubblica",
    skipReason: needsThrowaway,
    run: async ({ page }, check) => {
      await page.clock.setFixedTime(WISH_NOW);
      const nest = await wishNest(page, {
        share: "attivo",
        ideas: "mockup-con-foto",
      });
      try {
        await check(
          async () => {
            await openPublic(page, nest.code!);
          },
          {
            open: async (p) => {
              const dialog = p.getByRole("dialog");
              await expect(async () => {
                await p
                  .getByRole("button", { name: /^Lo regalo io/ })
                  .first()
                  .click();
                await expect(dialog).toBeVisible({ timeout: 2000 });
              }).toPass({ timeout: 20_000 });
              return dialog;
            },
          },
        );
      } finally {
        await nest.user.remove();
      }
    },
  },
  ...(["normale", "vuoto"] as const).map((scenario): Scene => ({
    title: `Oggi (${scenario})`,
    skipReason: needsUserA,
    run: async ({ page, baseURL }, check) => {
      await signInAsCached(page.context(), baseURL!, "A");
      await page.clock.setFixedTime(oggiNow(scenario));
      await installOggiFake(page, { scenario });
      await check(async () => {
        await page.goto("/oggi");
        await expect(page.getByRole("main")).toBeVisible();
        await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
          timeout: 20_000,
        });
        await ready(page);
      });
    },
  })),
  {
    title: "Calendario, settimana",
    skipReason: needsThrowaway,
    run: async (ctx, check) => {
      await withCalendarNest(ctx, FULL_WEEK, MOCKUP_NEST, async () => {
        await check(async () => {
          await ctx.page.goto("/calendario");
          await waitForWeek(ctx.page);
          await ready(ctx.page);
        });
      });
    },
  },
  {
    title: "Calendario, giorno",
    skipReason: needsThrowaway,
    run: async (ctx, check) => {
      await withCalendarNest(ctx, TUESDAY, MOCKUP_NEST, async () => {
        await check(async () => {
          await ctx.page.goto("/calendario/giorno");
          await waitForDayData(ctx.page);
          await ready(ctx.page);
        });
      });
    },
  },
  {
    title: "Calendario, mese",
    skipReason: needsThrowaway,
    run: async (ctx, check) => {
      await withCalendarNest(ctx, MONTH_EVENTS, MOCKUP_NEST, async () => {
        await check(async () => {
          await ctx.page.goto("/calendario/mese");
          await waitForMonth(ctx.page);
          await ready(ctx.page);
        });
      });
    },
  },
  {
    title: "Dettaglio impegno",
    skipReason: needsUserA,
    run: async ({ page, baseURL }, check) => {
      await signInAsCached(page.context(), baseURL!, "A");
      await page.clock.setFixedTime(DETAIL_NOW);
      await installEventFake(page);
      await check(
        async () => {
          await page.goto(detailUrl());
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
            timeout: 20_000,
          });
          await ready(page);
        },
        {
          open: async (p) => {
            const dialog = p.getByRole("dialog", { name: "Modifica impegno" });
            await expect(async () => {
              await p
                .getByRole("main")
                .getByRole("button", { name: "Modifica" })
                .click();
              await expect(dialog).toBeVisible({ timeout: 2000 });
            }).toPass({ timeout: 20_000 });
            return dialog;
          },
        },
      );
    },
  },
  {
    title: "Aggiungi (pannello aperto da /aggiungi)",
    skipReason: needsUserA,
    run: async ({ page, baseURL }, check) => {
      await signInAsCached(page.context(), baseURL!, "A");
      await page.clock.setFixedTime(DETAIL_NOW);
      await installAddFakes(page, { events: THURSDAY });
      const open = async () => {
        await page.goto("/aggiungi");
        await expect(
          page.getByRole("dialog", { name: "Aggiungi" }),
        ).toBeVisible({ timeout: 20_000 });
        await ready(page);
      };
      await check(open, {
        open: async (p) => p.getByRole("dialog", { name: "Aggiungi" }),
      });
    },
  },
  {
    title: "Aggiungi (pannello aperto da Oggi)",
    skipReason: needsUserA,
    run: async ({ page, baseURL }, check) => {
      await signInAsCached(page.context(), baseURL!, "A");
      await page.clock.setFixedTime(oggiNow("normale"));
      await installOggiFake(page, { scenario: "normale" });
      await installAddFakes(page, { events: THURSDAY });
      await check(
        async () => {
          await page.goto("/oggi");
          await expect(page.getByRole("main")).toBeVisible();
          await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
            timeout: 20_000,
          });
          await ready(page);
        },
        {
          open: async (p) => {
            const dialog = p.getByRole("dialog", { name: "Aggiungi" });
            await expect(async () => {
              await p
                .getByRole("link", { name: "Aggiungi", exact: true })
                .locator("visible=true")
                .first()
                .click();
              await expect(dialog).toBeVisible({ timeout: 2000 });
            }).toPass({ timeout: 20_000 });
            return dialog;
          },
        },
      );
    },
  },
];

// ------------------------------------------------------------------- tests

function listed(problems: Problems): Problems {
  return problems.length > MAX_LISTED
    ? [
        ...problems.slice(0, MAX_LISTED),
        `... e altri ${problems.length - MAX_LISTED}`,
      ]
    : problems;
}

async function shot(page: Page, name: string) {
  await test.info().attach(name, {
    body: await page.screenshot({ fullPage: true, type: "jpeg", quality: 60 }),
    contentType: "image/jpeg",
  });
}

test.describe("schermi di ingresso, onboarding, Oggi, calendario e Aggiungi", () => {
  for (const scene of scenes) {
    test(scene.title, async ({ page, baseURL }, testInfo) => {
      test.skip(
        testInfo.project.name !== "desktop",
        "la spec imposta da sé le larghezze: gira una volta sola",
      );
      const reason = scene.skipReason?.();
      test.skip(!!reason, reason ?? "");
      test.setTimeout(480_000);

      await scene.run({ page, baseURL }, async (open, sheet) => {
        for (const [width, height] of WIDTHS) {
          const tag = `[${width}x${height}]`;
          await test.step(tag, async () => {
            await page.setViewportSize({ width, height });
            await open();
            await shot(page, `${scene.title} ${width}x${height}`);
            const headingAt100 = await headingFontSize(page);

            expect
              .soft(
                listed(await overflowProblems(page)),
                `${tag} scorrimento orizzontale o elementi fuori dal viewport`,
              )
              .toEqual([]);

            if (width < 768) {
              expect
                .soft(
                  listed(await touchProblems(page)),
                  `${tag} aree di tocco sotto 44 x 44 px`,
                )
                .toEqual([]);
            }

            if (KEYBOARD_AT.has(width)) {
              expect
                .soft(
                  listed(await keyboardProblems(page)),
                  `${tag} tastiera: campo non visibile`,
                )
                .toEqual([]);
            }

            if (sheet) {
              await open();
              const dialog = await sheet.open(page);
              await waitForAnimationsToEnd(page);
              await shot(page, `${scene.title} ${width}x${height} pannello`);
              expect
                .soft(
                  listed(await sheetProblems(page, dialog, false)),
                  `${tag} pannello dal basso`,
                )
                .toEqual([]);
              if (width < 768) {
                expect
                  .soft(
                    listed(await sheetProblems(page, dialog, true)),
                    `${tag} pannello con la tastiera (altezza -${KEYBOARD_HEIGHT} px)`,
                  )
                  .toEqual([]);
              }
              if (KEYBOARD_AT.has(width)) {
                expect
                  .soft(
                    listed(await keyboardProblems(page)),
                    `${tag} tastiera nel pannello: campo non visibile`,
                  )
                  .toEqual([]);
              }
              expect
                .soft(
                  await closeSheet(page, dialog),
                  `${tag} chiusura del pannello`,
                )
                .toEqual([]);
            }

            if (ENLARGED_AT.has(width)) {
              await setBrowserFontSize(page, 32);
              try {
                await open();
                // The screenshot goes last: taking a full-page screenshot
                // drops the font size, so measure everything before it.
                const headingAt200 = await headingFontSize(page);
                expect
                  .soft(
                    headingAt100 && headingAt200
                      ? headingAt200 / headingAt100
                      : 2,
                    `${tag} testo 200%: l'h1 raddoppia (${headingAt100} px -> ${headingAt200} px)`,
                  )
                  .toBeCloseTo(2, 1);
                expect
                  .soft(
                    listed(await touchProblems(page)),
                    `${tag} testo 200%: aree di tocco sotto 44 x 44 px`,
                  )
                  .toEqual([]);
                expect
                  .soft(
                    listed(await overflowProblems(page)),
                    `${tag} testo 200%: scorrimento orizzontale`,
                  )
                  .toEqual([]);
                expect
                  .soft(
                    listed(await textProblems(page)),
                    `${tag} testo 200%: testo tagliato o sovrapposto`,
                  )
                  .toEqual([]);
                await shot(
                  page,
                  `${scene.title} ${width}x${height} testo 200%`,
                );
              } finally {
                await setBrowserFontSize(page, 16);
              }
            }
          });
        }
      });
    });
  }
});
