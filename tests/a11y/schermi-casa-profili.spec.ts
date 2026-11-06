import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { waitForAnimationsToEnd } from "../fixtures/animations";
import { hasTestUser } from "../fixtures/visual-login";
import { signInAsCached } from "../fixtures/visual-login-cached";

// Validation of the screens of group 2 (#309): Casa (Spesa, Da fare, Scadenze),
// Esplora and «In arrivo», profile of a child, wish list, the Nest, a member,
// own profile, notifications, search, home settings, linked calendars, error
// and not-found pages. For every page and every width:
//   1. no horizontal scroll and no visible element outside the viewport;
//   2. touch areas >= 44 x 44 px under 768 px (measured with elementFromPoint,
//      so an area made with a transparent ::before counts);
//   3. browser font size at 32 px = 200% (360 and 390), set with CDP
//      Page.setFontSizes BEFORE the navigation: `main h1` really doubles, no cut
//      or overlapping text, no horizontal scroll, touch areas >= 44 px;
//   4. keyboard (360 and 390): text fields stay visible with the viewport 300 px
//      shorter;
//   5. bottom sheets: open whole, scroll, main button reachable, close.
// Documented exceptions for 2 (design-system skill): links inside a sentence
// (.legale__link and any inline link in a text), .quadrato-nest--notte,
// .nav-alto__voce (only from 1024 px). Seed user A (Casa D'Angelo) is signed in.

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
const SMALL: Array<[number, number]> = [
  [360, 780],
  [390, 844],
];

const SOFIA = "a1000000-0000-4000-8000-000000000003";
const LAURA = "a1000000-0000-4000-8000-000000000002";
const NOW = new Date("2026-10-20T15:52:00+02:00");
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

type PageSpec = {
  name: string;
  path: string;
  /** Runs before the navigation (e.g. to force an error). */
  before?: (page: Page) => Promise<void>;
};

const PAGES: PageSpec[] = [
  { name: "Casa · Spesa", path: "/casa/spesa" },
  { name: "Casa · Da fare", path: "/casa/da-fare" },
  { name: "Casa · Scadenze", path: "/casa/scadenze" },
  { name: "Esplora", path: "/esplora" },
  { name: "Esplora · In arrivo", path: "/esplora/a-tavola" },
  { name: "Profilo di un figlio", path: `/figli/${SOFIA}` },
  { name: "Lista desideri", path: `/figli/${SOFIA}/lista-desideri` },
  { name: "Il tuo Nest", path: "/nest" },
  { name: "Un membro", path: `/membri/${LAURA}` },
  { name: "Il tuo profilo", path: "/profilo" },
  { name: "Notifiche", path: "/notifiche" },
  { name: "Ricerca", path: "/ricerca" },
  { name: "Impostazioni della casa", path: "/impostazioni" },
  { name: "Calendari collegati", path: "/calendari-collegati" },
  {
    name: "Pagina di errore",
    path: `/figli/${SOFIA}`,
    before: async (page) => {
      await page.route("**/rest/v1/child_profiles*", (route) =>
        route.request().method() === "GET"
          ? route.fulfill({
              status: 500,
              headers: { ...CORS, "content-type": "application/json" },
              body: JSON.stringify({ message: "boom" }),
            })
          : route.fallback(),
      );
    },
  },
  { name: "Pagina non trovata", path: "/questa-pagina-non-esiste" },
];

test.beforeEach(async ({ page, context, baseURL }, testInfo) => {
  // Widths are set by the test itself: one project is enough.
  test.skip(
    testInfo.project.name !== "desktop",
    "larghezze impostate dal test",
  );
  test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
  await page.clock.setFixedTime(NOW);
  const signedIn = await signInAsCached(context, baseURL!, "A");
  test.skip(!signedIn, "utente di test A non disponibile");
});

// ------------------------------------------------------------------ helpers

/** Browser font size (16 px = 100%, 32 px = 200%): applies to the next goto. */
async function setBrowserFontSize(page: Page, px: 16 | 32) {
  // The session must stay attached: detaching resets the font size.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Page.setFontSizes", { fontSizes: { standard: px } });
}

async function openPage(page: Page, spec: PageSpec, w: number, h: number) {
  await page.setViewportSize({ width: w, height: h });
  await spec.before?.(page);
  await page.goto(spec.path);
  await expect(page.locator("main").first()).toBeVisible({ timeout: 30_000 });
  // Wait for the loading skeletons to go away (best effort, no fixed wait).
  await expect
    .poll(() => page.locator('main [aria-busy="true"]').count(), {
      timeout: 15_000,
    })
    .toBe(0)
    .catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
  await waitForAnimationsToEnd(page);
}

async function attach(
  page: Page,
  testInfo: TestInfo,
  name: string,
  fullPage = true,
) {
  await page.mouse.move(0, 0);
  const file = testInfo.outputPath(
    `${name.replace(/[^A-Za-z0-9._-]+/g, "_")}.png`,
  );
  await page.screenshot({ path: file, fullPage });
  await testInfo.attach(name, { path: file, contentType: "image/png" });
}

type Found = Record<string, unknown>;

/** Visible elements outside the viewport width, and the document scroll. */
async function overflowProblems(page: Page): Promise<Found[]> {
  return page.evaluate(() => {
    const out: Found[] = [];
    const vw = document.documentElement.clientWidth;
    const pathOf = (el: Element) => {
      const parts: string[] = [];
      for (
        let e: Element | null = el;
        e && parts.length < 4;
        e = e.parentElement
      ) {
        const cls = [...e.classList].slice(0, 2).join(".");
        parts.unshift(e.tagName.toLowerCase() + (cls ? "." + cls : ""));
      }
      return parts.join(" > ");
    };
    const sw = document.documentElement.scrollWidth;
    if (sw > vw) {
      out.push({
        kind: "scroll-orizzontale",
        scrollWidth: sw,
        clientWidth: vw,
      });
    }
    for (const el of document.body.querySelectorAll("*")) {
      if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
      if (el.closest(".sprite-icone")) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) continue;
      if (r.right <= vw + 1 && r.left >= -1) continue;
      let clipped = false;
      for (
        let a = el.parentElement;
        a && a !== document.documentElement;
        a = a.parentElement
      ) {
        const o = getComputedStyle(a);
        if (o.overflowX !== "visible") {
          const ar = a.getBoundingClientRect();
          if (ar.left >= -1 && ar.right <= vw + 1) {
            clipped = true;
            break;
          }
        }
      }
      if (clipped) continue;
      out.push({
        kind: "fuori-viewport",
        el: pathOf(el),
        left: Math.round(r.left),
        right: Math.round(r.right),
        vw,
      });
    }
    return out.slice(0, 12);
  });
}

/** Interactive elements whose touch area is under 44 px (under 768 px). */
async function touchProblems(page: Page): Promise<{ bad: Found[]; n: number }> {
  return page.evaluate(() => {
    const sel =
      'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=switch],[role=checkbox],[role=radio],[role=tab],[role=menuitem],[role=link],[tabindex]:not([tabindex="-1"])';
    const bad: Found[] = [];
    let n = 0;
    const pathOf = (el: Element) => {
      const parts: string[] = [];
      for (
        let e: Element | null = el;
        e && parts.length < 3;
        e = e.parentElement
      ) {
        const cls = [...e.classList].slice(0, 2).join(".");
        parts.unshift(e.tagName.toLowerCase() + (cls ? "." + cls : ""));
      }
      return parts.join(" > ");
    };
    const label = (el: Element) =>
      (el.getAttribute("aria-label") || el.textContent || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 40);
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      if (el.closest('[inert],[aria-hidden="true"],.sprite-icone')) continue;
      let r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) {
        const lab = el.closest("label");
        if (!lab) continue;
        r = lab.getBoundingClientRect();
        if (r.width <= 1) continue;
      }
      // Documented exceptions.
      if (el.matches(".legale__link, .quadrato-nest--notte, .nav-alto__voce"))
        continue;
      if (el.tagName === "A" && cs.display === "inline") {
        const parent = el.parentElement;
        const own = [...(parent?.childNodes ?? [])].some(
          (c) => c.nodeType === 3 && (c.textContent ?? "").trim().length > 3,
        );
        if (own) continue;
      }
      n++;
      el.scrollIntoView({ block: "center", inline: "center" });
      r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const lab = el.closest("label");
      const hits = (x: number, y: number) => {
        const h = document.elementFromPoint(x, y);
        if (!h) return false;
        return (
          el.contains(h) ||
          (!!lab && (lab === h || lab.contains(h))) ||
          (h.closest("label") as HTMLLabelElement | null)?.control === el
        );
      };
      if (!hits(cx, cy)) {
        const top = document.elementFromPoint(cx, cy);
        bad.push({
          kind: "coperto",
          el: pathOf(el),
          nome: label(el),
          da: top ? pathOf(top) : "nulla",
        });
        continue;
      }
      const extent = (dx: number, dy: number) => {
        let k = 0;
        while (k < 60 && hits(cx + dx * (k + 1), cy + dy * (k + 1))) k++;
        return k;
      };
      const width = extent(-1, 0) + extent(1, 0) + 1;
      const height = extent(0, -1) + extent(0, 1) + 1;
      if (width < 43.5 || height < 43.5) {
        bad.push({
          kind: "area-piccola",
          el: pathOf(el),
          nome: label(el),
          area: `${width}x${height}`,
        });
      }
    }
    return { bad, n };
  });
}

/** Cut or overlapping text (run with the root font at 200%). */
async function textProblems(page: Page): Promise<Found[]> {
  return page.evaluate(() => {
    const out: Found[] = [];
    const pathOf = (el: Element) => {
      const parts: string[] = [];
      for (
        let e: Element | null = el;
        e && parts.length < 3;
        e = e.parentElement
      ) {
        const cls = [...e.classList].slice(0, 2).join(".");
        parts.unshift(e.tagName.toLowerCase() + (cls ? "." + cls : ""));
      }
      return parts.join(" > ");
    };
    type Line = { el: Element; r: DOMRect; layer: boolean; text: string };
    // Visually hidden by design (1 px box, or inside a collapsed clipping box).
    const hiddenByClip = (el: Element) => {
      for (
        let a: Element | null = el;
        a && a !== document.body;
        a = a.parentElement
      ) {
        const o = getComputedStyle(a);
        const clips = (v: string) => v === "hidden" || v === "clip";
        if (
          (clips(o.overflowX) || clips(o.overflowY) || o.clip !== "auto") &&
          (a.clientWidth <= 1 || a.clientHeight <= 1)
        )
          return true;
        if (a.getBoundingClientRect().width <= 1) return true;
      }
      return false;
    };
    const lines: Line[] = [];
    for (const el of document.body.querySelectorAll("*")) {
      if (el.closest("svg,.sprite-icone,script,style")) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      if (hiddenByClip(el)) continue;
      const texts = [...el.childNodes].filter(
        (c) => c.nodeType === 3 && (c.textContent ?? "").trim().length > 0,
      );
      if (texts.length === 0) continue;
      const range = document.createRange();
      const rects: DOMRect[] = [];
      let text = "";
      for (const t of texts) {
        range.selectNodeContents(t);
        rects.push(...range.getClientRects());
        text += (t.textContent ?? "").trim() + " ";
      }
      // getClientRects gives the font area (Parkinsans is about 1.42 em):
      // shrink every rectangle to the line height, centred.
      const fsz = parseFloat(cs.fontSize);
      const lh = cs.lineHeight.endsWith("px")
        ? parseFloat(cs.lineHeight)
        : fsz * 1.2;
      const real = rects
        .filter((q) => q.width > 1 && q.height > 1)
        .map((q) => {
          const hh = Math.min(q.height, lh);
          const top = q.top + (q.height - hh) / 2;
          return new DOMRect(q.left, top, q.width, hh);
        });
      if (real.length === 0) continue;
      // Cut by its own box.
      const ownClip =
        (cs.overflowX !== "visible" || cs.overflowY !== "visible") &&
        cs.overflowX !== "auto" &&
        cs.overflowX !== "scroll" &&
        cs.overflowY !== "auto" &&
        cs.overflowY !== "scroll";
      if (
        ownClip &&
        (el.scrollWidth > el.clientWidth + 1 ||
          el.scrollHeight > el.clientHeight + 1)
      ) {
        out.push({
          kind: "tagliato",
          el: pathOf(el),
          testo: text.trim().slice(0, 40),
          scroll: `${el.scrollWidth}x${el.scrollHeight}`,
          box: `${el.clientWidth}x${el.clientHeight}`,
        });
      }
      // Cut by an ancestor with overflow hidden.
      for (
        let a = el.parentElement;
        a && a !== document.body;
        a = a.parentElement
      ) {
        const o = getComputedStyle(a);
        const clips = (v: string) => v === "hidden" || v === "clip";
        if (!clips(o.overflowX) && !clips(o.overflowY)) continue;
        const ar = a.getBoundingClientRect();
        const bad = real.some(
          (q) =>
            (clips(o.overflowX) &&
              (q.right > ar.right + 1 || q.left < ar.left - 1)) ||
            (clips(o.overflowY) &&
              (q.bottom > ar.bottom + 1 || q.top < ar.top - 1)),
        );
        if (bad) {
          out.push({
            kind: "tagliato-da-contenitore",
            el: pathOf(el),
            contenitore: pathOf(a),
            testo: text.trim().slice(0, 40),
          });
          break;
        }
      }
      let layer = false;
      for (let a: Element | null = el; a; a = a.parentElement) {
        const p = getComputedStyle(a).position;
        if (p === "fixed" || p === "sticky") {
          layer = true;
          break;
        }
      }
      for (const q of real) lines.push({ el, r: q, layer, text: text.trim() });
    }
    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        const a = lines[i]!;
        const b = lines[j]!;
        if (a.el === b.el || a.layer !== b.layer) continue;
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (w > 2 && h > 2) {
          out.push({
            kind: "sovrapposto",
            a: `${pathOf(a.el)} «${a.text.slice(0, 25)}»`,
            b: `${pathOf(b.el)} «${b.text.slice(0, 25)}»`,
          });
        }
      }
    }
    return out.slice(0, 15);
  });
}

const FIELD =
  "input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]):not([type=range]), textarea";

/** With the viewport 300 px shorter, focuses every text field in `scope`. */
async function keyboardProblems(
  page: Page,
  scope: string,
  w: number,
  h: number,
): Promise<{ bad: Found[]; n: number }> {
  await page.setViewportSize({ width: w, height: h - 300 });
  const handles = await page.locator(`${scope} >> ${FIELD}`).elementHandles();
  const bad: Found[] = [];
  let n = 0;
  for (const handle of handles.slice(0, 12)) {
    const visible = await handle.isVisible();
    if (!visible) continue;
    n++;
    await handle.focus();
    const res = await handle.evaluate((node) => {
      const el = node as HTMLElement;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const top = document.elementFromPoint(
        cx,
        Math.min(Math.max(cy, 0), vh - 1),
      );
      return {
        focused: document.activeElement === el,
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        vh,
        covered: !(
          top &&
          (el.contains(top) ||
            top.contains(el) ||
            top.closest("label")?.contains(el))
        ),
        name:
          el.getAttribute("aria-label") ||
          el.getAttribute("name") ||
          el.getAttribute("id") ||
          el.tagName,
      };
    });
    if (!res.focused || res.top < 0 || res.bottom > res.vh + 1 || res.covered) {
      bad.push(res);
    }
  }
  await page.setViewportSize({ width: w, height: h });
  return { bad, n };
}

// --------------------------------------------------------------- 1 and 2

for (const spec of PAGES) {
  for (const [w, h] of WIDTHS) {
    test(`${spec.name} ${w}x${h}: nessun scorrimento orizzontale e aree di tocco`, async ({
      page,
    }, testInfo) => {
      await openPage(page, spec, w, h);
      await attach(page, testInfo, `${spec.name}-${w}x${h}`);
      const overflow = await overflowProblems(page);
      let touch: Found[] = [];
      if (w < 768) {
        const res = await touchProblems(page);
        touch = res.bad;
        testInfo.annotations.push({
          type: "interattivi-misurati",
          description: String(res.n),
        });
      }
      expect.soft(overflow, "overflow").toEqual([]);
      expect.soft(touch, "aree di tocco sotto 44 px").toEqual([]);
    });
  }
}

// ------------------------------------------------------------------- 3

for (const spec of PAGES) {
  for (const [w, h] of SMALL) {
    test(`${spec.name} ${w}x${h}: testo ingrandito al 200%`, async ({
      page,
    }, testInfo) => {
      const h1Size = () =>
        page.evaluate(() => {
          const h1 = document.querySelector("main h1");
          return h1 ? parseFloat(getComputedStyle(h1).fontSize) : null;
        });
      // 100% first, to measure the heading.
      await openPage(page, spec, w, h);
      const at100 = await h1Size();
      // 200%: the browser font size is set before the page is loaded again.
      await setBrowserFontSize(page, 32);
      await openPage(page, spec, w, h);
      const at200 = await h1Size();
      expect
        .soft(
          at100 && at200 ? at200 / at100 : 2,
          `l'h1 raddoppia (${at100} px -> ${at200} px)`,
        )
        .toBeCloseTo(2, 1);
      await attach(page, testInfo, `${spec.name}-${w}x${h}-200`);
      const overflow = await overflowProblems(page);
      const touch = await touchProblems(page);
      const text = await textProblems(page);
      expect.soft(overflow, "overflow al 200%").toEqual([]);
      expect.soft(touch.bad, "aree di tocco sotto 44 px al 200%").toEqual([]);
      expect.soft(text, "testo tagliato o sovrapposto al 200%").toEqual([]);
    });
  }
}

// ------------------------------------------------------------------- 4

for (const spec of PAGES) {
  for (const [w, h] of SMALL) {
    test(`${spec.name} ${w}x${h}: tastiera, campo attivo visibile`, async ({
      page,
    }, testInfo) => {
      await openPage(page, spec, w, h);
      const { bad, n } = await keyboardProblems(page, "body", w, h);
      testInfo.annotations.push({
        type: "campi-misurati",
        description: String(n),
      });
      await attach(page, testInfo, `${spec.name}-${w}x${h}-tastiera`, false);
      expect(bad, "campo non visibile con la tastiera").toEqual([]);
    });
  }
}

// ------------------------------------------------------------------- 5

type SheetSpec = {
  name: string;
  open: (page: Page) => Promise<void>;
};

const SHEETS: SheetSpec[] = [
  {
    name: "Modifica profilo figlio",
    open: async (page) => {
      await page.goto(`/figli/${SOFIA}`);
      // Pencil of the bar (mobile); on desktop the profile has no pencil while
      // incomplete: «Aggiungi la scuola» opens the same sheet.
      const opener = page
        .getByRole("button", {
          name: /^(Modifica il profilo di Sofia|Aggiungi la scuola)$/,
        })
        .first();
      await expect(opener).toBeVisible({ timeout: 30_000 });
      await opener.click();
      await expect(page.getByRole("dialog")).toBeVisible();
    },
  },
  {
    name: "Aggiungi",
    open: async (page) => {
      await page.goto("/aggiungi");
      await expect(page.getByRole("dialog", { name: "Aggiungi" })).toBeVisible({
        timeout: 30_000,
      });
    },
  },
  {
    name: "Aggiungi un'idea",
    open: async (page) => {
      await page.goto(`/figli/${SOFIA}/lista-desideri`);
      const button = page
        .getByRole("button", { name: /Aggiungi un.idea/ })
        .first();
      await expect(button).toBeVisible({ timeout: 30_000 });
      await button.click();
      await expect(page.getByRole("dialog")).toBeVisible();
    },
  },
];

for (const sheet of SHEETS) {
  for (const [w, h] of WIDTHS) {
    test(`Pannello «${sheet.name}» ${w}x${h}: si apre intero, scorre, si chiude`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: w, height: h });
      await sheet.open(page);
      await page.evaluate(() => document.fonts.ready);
      await waitForAnimationsToEnd(page);
      const dialog = page.getByRole("dialog");
      await attach(page, testInfo, `${sheet.name}-${w}x${h}`, false);

      const state = await dialog.evaluate((d) => {
        const r = d.getBoundingClientRect();
        const vw = document.documentElement.clientWidth;
        const vh = window.innerHeight;
        const scrollers = [d, ...d.querySelectorAll<HTMLElement>("*")].filter(
          (e) => {
            const o = getComputedStyle(e).overflowY;
            return (
              (o === "auto" || o === "scroll") &&
              e.scrollHeight > e.clientHeight + 1
            );
          },
        );
        const cut = [d, ...d.querySelectorAll<HTMLElement>("*")].filter((e) => {
          const o = getComputedStyle(e).overflowY;
          return (
            (o === "hidden" || o === "clip") &&
            e.scrollHeight > e.clientHeight + 1 &&
            e.clientHeight > 0 &&
            e.classList.length > 0 &&
            /foglio|modale/.test(e.className.toString())
          );
        });
        return {
          left: Math.round(r.left),
          right: Math.round(r.right),
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          vw,
          vh,
          scrollers: scrollers.length,
          cut: cut.map((e) => e.className.toString()),
        };
      });
      const problems: Found[] = [];
      if (state.left < -1 || state.right > state.vw + 1) {
        problems.push({ kind: "esce-in-larghezza", ...state });
      }
      if (state.top < -1 || state.bottom > state.vh + 1) {
        problems.push({ kind: "esce-in-altezza", ...state });
      }
      if (state.cut.length > 0) {
        problems.push({
          kind: "contenuto-tagliato-non-scorre",
          cut: state.cut,
        });
      }

      // Scroll to the bottom: the main button must be reachable.
      await dialog.evaluate((d) => {
        for (const e of [d, ...d.querySelectorAll<HTMLElement>("*")]) {
          const o = getComputedStyle(e).overflowY;
          if (
            (o === "auto" || o === "scroll") &&
            e.scrollHeight > e.clientHeight
          )
            e.scrollTop = e.scrollHeight;
        }
      });
      const primary = dialog.locator(".btn-primary").last();
      await expect(primary).toBeVisible();
      const reach = await primary.evaluate((b) => {
        const r = b.getBoundingClientRect();
        const vh = window.innerHeight;
        const vw = document.documentElement.clientWidth;
        const cx = r.left + r.width / 2;
        const cy = Math.min(Math.max(r.top + r.height / 2, 0), vh - 1);
        const top = document.elementFromPoint(cx, cy);
        return {
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          vh,
          inside:
            r.top >= 0 &&
            r.bottom <= vh + 1 &&
            r.left >= 0 &&
            r.right <= vw + 1,
          free: !!top && (b.contains(top) || top.contains(b)),
        };
      });
      if (!reach.inside || !reach.free) {
        problems.push({
          kind: "pulsante-principale-non-raggiungibile",
          ...reach,
        });
      }
      await attach(page, testInfo, `${sheet.name}-${w}x${h}-fondo`, false);

      // Close with the X.
      await dialog.getByRole("button", { name: "Chiudi" }).first().click();
      const closed = await dialog
        .waitFor({ state: "hidden", timeout: 5_000 })
        .then(() => true)
        .catch(() => false);
      if (!closed) problems.push({ kind: "non-si-chiude" });
      expect(problems).toEqual([]);
    });
  }
}

// Fields inside the sheets, with the shorter viewport (check 4 for the sheets).
for (const sheet of SHEETS) {
  for (const [w, h] of SMALL) {
    test(`Pannello «${sheet.name}» ${w}x${h}: tastiera, campi visibili`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: w, height: h });
      await sheet.open(page);
      await waitForAnimationsToEnd(page);
      const { bad, n } = await keyboardProblems(page, '[role="dialog"]', w, h);
      testInfo.annotations.push({
        type: "campi-misurati",
        description: String(n),
      });
      await attach(page, testInfo, `${sheet.name}-${w}x${h}-tastiera`, false);
      expect(n, "il pannello non ha campi di testo").toBeGreaterThan(0);
      expect(bad, "campo non visibile con la tastiera").toEqual([]);
    });
  }
}
