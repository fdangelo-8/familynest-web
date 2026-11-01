import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";

// Helpers of the accessibility specs of the Add sheet (#20, #22).

export async function blocking(page: Page, selector: string) {
  const results = await new AxeBuilder({ page }).include(selector).analyze();
  return results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
}

/** Name of the element that has the focus, as a person would read it. */
export function focused(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return "";
    /** The text without what is hidden from readers (avatars, icons) */
    const visibleText = (node: HTMLElement) => {
      const copy = node.cloneNode(true) as HTMLElement;
      copy.querySelectorAll("[aria-hidden='true']").forEach((n) => n.remove());
      return (copy.textContent ?? "").trim();
    };
    const labels = (el as HTMLTextAreaElement).labels;
    return (
      el.getAttribute("aria-label") ??
      labels?.[0]?.textContent?.trim() ??
      visibleText(el)
    );
  });
}

/**
 * The area of touch of a control: the points at the middle of the four sides of
 * a square of at least 44 px centered on it (and its center) must land on the
 * control or on something inside it. Returns the points that land elsewhere.
 */
export async function missedPoints(control: Locator, min = 44) {
  const box = await control.boundingBox();
  if (!box) throw new Error("the control is not visible");
  const w = Math.max(box.width, min);
  const h = Math.max(box.height, min);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const points = [
    [cx, cy],
    [cx, cy - h / 2 + 2],
    [cx, cy + h / 2 - 2],
    [cx - w / 2 + 2, cy],
    [cx + w / 2 - 2, cy],
  ];
  return control.evaluate((el, pts) => {
    const missed: string[] = [];
    for (const [x, y] of pts as number[][]) {
      const hit = document.elementFromPoint(x!, y!);
      if (!hit || !(el === hit || el.contains(hit))) {
        missed.push(
          `(${Math.round(x!)}, ${Math.round(y!)}) -> ${hit ? `${hit.tagName.toLowerCase()}.${String(hit.className)}` : "nothing"}`,
        );
      }
    }
    return missed;
  }, points);
}

export async function contrastFailures(page: Page) {
  return page.evaluate(() => {
    type Rgba = { r: number; g: number; b: number; a: number };
    const parse = (value: string): Rgba | null => {
      const m = value.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1]!
        .split(/[ ,/]+/)
        .filter(Boolean)
        .map(Number);
      return { r: p[0]!, g: p[1]!, b: p[2]!, a: p[3] ?? 1 };
    };
    const over = (fg: Rgba, bg: Rgba): Rgba => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    });
    const lum = (c: Rgba) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const ratio = (a: Rgba, b: Rgba) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi! + 0.05) / (lo! + 0.05);
    };
    /** Possible backgrounds under an element: one, or the colors of a striped gradient */
    const backgrounds = (el: Element): Rgba[] => {
      const layers: Rgba[] = [];
      let stripes: Rgba[] = [];
      for (let n: Element | null = el; n; n = n.parentElement) {
        const style = getComputedStyle(n);
        if (style.backgroundImage !== "none" && !stripes.length) {
          stripes = (style.backgroundImage.match(/rgba?\([^)]+\)/g) ?? [])
            .map(parse)
            .filter((c): c is Rgba => c !== null);
        }
        const c = parse(style.backgroundColor);
        if (c && c.a > 0) {
          layers.push(c);
          if (c.a === 1) break;
        }
      }
      const base = (): Rgba => {
        let acc: Rgba = { r: 255, g: 255, b: 255, a: 1 };
        for (let i = layers.length - 1; i >= 0; i -= 1)
          acc = over(layers[i]!, acc);
        return acc;
      };
      if (stripes.length) return stripes.map((s) => over(s, base()));
      return [base()];
    };
    const opacityOf = (el: Element) => {
      let o = 1;
      for (let n: Element | null = el; n; n = n.parentElement) {
        o *= parseFloat(getComputedStyle(n).opacity);
      }
      return o;
    };

    const roots = document.querySelectorAll(
      '[role="dialog"], [role="alertdialog"], .toast',
    );
    const bad: string[] = [];
    let checked = 0;
    const checkText = (el: Element, color: string, label: string) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) return; // visually hidden
      if (style.visibility === "hidden") return;
      if (el.closest("[disabled]")) return; // disabled controls are exempt (1.4.3)
      const fg = parse(color);
      if (!fg) return;
      checked += 1;
      const size = parseFloat(style.fontSize);
      const bold = parseInt(style.fontWeight, 10) >= 700;
      const needed = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
      const opacity = opacityOf(el);
      for (const bg of backgrounds(el)) {
        const solid = over({ ...fg, a: fg.a * opacity }, bg);
        const r = ratio(solid, bg);
        if (r < needed) {
          bad.push(
            `${label} «${(el.textContent ?? "").trim().slice(0, 40)}» ${r.toFixed(2)}:1 < ${needed}`,
          );
        }
      }
    };
    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const seen = new Set<Element>();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!parent || seen.has(parent) || !node.textContent?.trim()) continue;
        seen.add(parent);
        checkText(
          parent,
          getComputedStyle(parent).color,
          parent.tagName.toLowerCase(),
        );
      }
      for (const area of root.querySelectorAll("textarea")) {
        const field = area as HTMLTextAreaElement;
        if (field.value)
          checkText(field, getComputedStyle(field).color, "textarea (text)");
        const placeholder = getComputedStyle(field, "::placeholder").color;
        const fieldBg = parse(getComputedStyle(field).backgroundColor);
        const fg = parse(placeholder);
        if (!field.value && fg && fieldBg) {
          const r = ratio(over(fg, fieldBg), fieldBg);
          if (r < 4.5) bad.push(`placeholder ${r.toFixed(2)}:1 < 4.5`);
        }
      }
    }
    if (checked < 3) bad.push(`only ${checked} texts measured`);
    return bad;
  });
}
