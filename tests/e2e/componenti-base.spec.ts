import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { it as messages } from "../../src/lib/i18n/messages/it";
import { haptic } from "../../src/lib/haptic";
import { waitForAnimationsToEnd } from "../fixtures/animations";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import { waitHydrated } from "../fixtures/esplora";
import { SEED_HOME_A } from "../fixtures/invito";

// #503 (F4a) «Componenti 2.0 di base»: criteri CA-1…CA-29, CA-31 e CA-i18n.
// «Galleria» = /design-system, sezione «Componenti di base 2.0» (esempi 1-14 di
// docs/specifiche/503-componenti-base.md §7). I valori si leggono dagli stili
// calcolati e si confrontano con i token risolti nel browser (nessun colore
// scritto a mano: lezione «Token confrontati come stringhe»). Il CA-30 (riferimenti
// visivi) è del tester visivo.

const GALLERY = "/design-system";
const ROOT = join(__dirname, "..", "..");

const tid = (page: Page, id: string) => page.getByTestId(id);

/** A token resolved by the browser, as a computed value of the given property. */
async function resolve(
  page: Page,
  property: "color" | "width" | "box-shadow",
  token: string,
): Promise<string> {
  return page.evaluate(
    ([prop, name]) => {
      const probe = document.createElement("span");
      probe.style.setProperty(prop!, `var(${name})`);
      document.body.appendChild(probe);
      const value = getComputedStyle(probe).getPropertyValue(prop!);
      probe.remove();
      return value;
    },
    [property, token],
  );
}

type Rgb = [number, number, number];

function parseColor(value: string): Rgb {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`colore non leggibile: ${value}`);
  const parts = m[1]!
    .split(/[ ,/]+/)
    .filter(Boolean)
    .map(Number);
  return [parts[0]!, parts[1]!, parts[2]!];
}

/** WCAG 2.1 contrast ratio. */
function contrast(a: string, b: string): number {
  const lum = (rgb: Rgb) => {
    const [r, g, bl] = rgb.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }) as Rgb;
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const la = lum(parseColor(a));
  const lb = lum(parseColor(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Computed values of some properties of an element. */
function style(locator: Locator, properties: string[], pseudo?: string) {
  return locator.evaluate(
    (el, [list, pse]) => {
      const s = getComputedStyle(el, (pse as string) || null);
      return Object.fromEntries(
        (list as string[]).map((p) => [p, s.getPropertyValue(p)]),
      );
    },
    [properties, pseudo ?? ""] as [string[], string],
  );
}

/** `rgb(…) 0px 0px 0px 2px inset` → colour and spread of the (first) shadow. */
function shadowOf(value: string) {
  const color = value.match(/rgba?\([^)]+\)/)?.[0] ?? "";
  const numbers = (value.replace(/rgba?\([^)]+\)/, "").match(/-?[\d.]+px/g) ??
    []) as string[];
  return {
    color,
    spread: parseFloat(numbers[3] ?? "0"),
    inset: /\binset\b/.test(value),
  };
}

/**
 * True when the four corners of a 44 × 44 square centred on the element hit it
 * (or, with `round`, the four points of the circle of 44 px of diameter: a
 * round control does not receive the corners of the square by design).
 */
async function hasTouchSquare(
  target: Locator,
  round = false,
): Promise<boolean> {
  await target.scrollIntoViewIfNeeded();
  return target.evaluate((el, circle) => {
    const r = el.getBoundingClientRect();
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const hit = (x: number, y: number) => {
      const found = document.elementFromPoint(x, y);
      return !!found && el.contains(found);
    };
    const points = circle
      ? [
          [cx - 21, cy],
          [cx + 21, cy],
          [cx, cy - 21],
          [cx, cy + 21],
        ]
      : [
          [cx - 21, cy - 21],
          [cx + 21, cy - 21],
          [cx - 21, cy + 21],
          [cx + 21, cy + 21],
        ];
    return points.every(([x, y]) => hit(x!, y!));
  }, round);
}

const rect = (locator: Locator) =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

const base = (page: Page, id: string) => tid(page, id);

// git helpers for the tests that compare the PR with main (only on the branch
// of #503: elsewhere the list of changed files says nothing about it).
function git(args: string[]): string | null {
  try {
    return execFileSync("git", ["-c", "safe.directory=*", ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

function onBranchOf503(): boolean {
  const branch =
    process.env.GITHUB_HEAD_REF ||
    process.env.GITHUB_REF_NAME ||
    git(["rev-parse", "--abbrev-ref", "HEAD"])?.trim() ||
    "";
  return /(^|\/)componenti-base$/.test(branch);
}

/** Merge base with main; fetches more history if the checkout is shallow. */
function mergeBase(): string | null {
  let result = git(["merge-base", "origin/main", "HEAD"]);
  if (result === null) {
    git([
      "fetch",
      "--no-tags",
      "--deepen=300",
      "origin",
      "+main:refs/remotes/origin/main",
    ]);
    result = git(["merge-base", "origin/main", "HEAD"]);
  }
  return result?.trim() || null;
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(path, out);
    else out.push(path);
  }
  return out;
}

test.describe("galleria · Componenti di base 2.0", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GALLERY);
    await expect(page.locator("#base-2")).toBeVisible();
    await waitHydrated(tid(page, "base-pulsanti").getByRole("button").first());
  });

  // ------------------------------------------------------------- Pulsanti

  test("CA-1: «Salva» ha fondo azione, testo bianco, 52 px, raggio 14, 600 e 16 px", async ({
    page,
  }) => {
    const save = base(page, "base-pulsanti").getByRole("button", {
      name: "Salva",
      exact: true,
    });
    const s = await style(save, [
      "background-color",
      "color",
      "min-height",
      "height",
      "border-top-left-radius",
      "font-weight",
      "font-size",
    ]);
    // #634: the full ground is --color-pieno, the text over it --color-latte.
    expect(s["background-color"]).toBe(
      await resolve(page, "color", "--color-pieno"),
    );
    expect(s.color).toBe(await resolve(page, "color", "--color-latte"));
    expect(parseFloat(s.height!)).toBeGreaterThanOrEqual(52);
    expect(s["border-top-left-radius"]).toBe("14px");
    expect(s["font-weight"]).toBe("600");
    expect(s["font-size"]).toBe("16px");
  });

  test("CA-2: «Usa di nuovo» a filo, «Metti in spesa» quieto, «Annulla» ed «Elimina la lista» sottolineati", async ({
    page,
  }) => {
    const row = base(page, "base-pulsanti");
    const white = await resolve(page, "color", "--color-superficie");
    const ink = await resolve(page, "color", "--color-inchiostro");
    const alert = await resolve(page, "color", "--color-allerta");

    const again = row.getByRole("button", { name: "Usa di nuovo" });
    const a = await style(again, [
      "background-color",
      "border-top-width",
      "border-top-color",
      "box-shadow",
    ]);
    expect(a["background-color"]).toBe(white);
    // Il filo di 1 px di inchiostro è disegnato come bordo oppure come filo
    // interno (`box-shadow`): scostamento dichiarato nella PR, stessa misura.
    const border =
      parseFloat(a["border-top-width"]!) > 0
        ? {
            width: parseFloat(a["border-top-width"]!),
            color: a["border-top-color"]!,
          }
        : (() => {
            const sh = shadowOf(a["box-shadow"]!);
            return { width: sh.spread, color: sh.color };
          })();
    expect(border.width).toBe(1);
    expect(border.color).toBe(ink);

    const quiet = await style(
      row.getByRole("button", { name: "Metti in spesa" }),
      ["background-color", "border-top-width", "box-shadow"],
    );
    expect(quiet["background-color"]).toBe(
      await resolve(page, "color", "--color-carta-2"),
    );
    expect(parseFloat(quiet["border-top-width"]!)).toBe(0);
    expect(quiet["box-shadow"]).toBe("none");

    const thickness = await resolve(page, "width", "--border-link");
    const offset = await resolve(page, "width", "--space-link");
    expect(thickness).toBe("1.5px");
    expect(offset).toBe("3px");
    for (const [name, color] of [
      ["Annulla", ink],
      ["Elimina la lista", alert],
    ] as const) {
      const link = await style(row.getByRole("button", { name, exact: true }), [
        "background-color",
        "color",
        "text-decoration-line",
        "text-decoration-thickness",
        "text-underline-offset",
      ]);
      expect(link["background-color"], name).toBe("rgba(0, 0, 0, 0)");
      expect(link["text-decoration-line"], name).toContain("underline");
      expect(link["text-decoration-thickness"], name).toBe(thickness);
      expect(link["text-underline-offset"], name).toBe(offset);
      expect(link.color, name).toBe(color);
    }
  });

  test("CA-3: i quattro angoli di un quadrato di 44 × 44 su «Annulla» colpiscono il pulsante", async ({
    page,
  }) => {
    const cancel = base(page, "base-pulsanti").getByRole("button", {
      name: "Annulla",
      exact: true,
    });
    expect(await hasTouchSquare(cancel)).toBe(true);
  });

  test("CA-4: nessuna variante nuova nelle pagine e nessun file di pagina cambiato", async () => {
    // Solo sul branch di #503: altrove l'elenco dei file cambiati non dice nulla.
    if (!onBranchOf503()) return;
    const from = mergeBase();
    expect(
      from,
      "storia comune con origin/main non disponibile: CA-4 non verificabile",
    ).not.toBeNull();
    const changed = (git(["diff", "--name-only", `${from}`, "HEAD"]) ?? "")
      .split("\n")
      .filter(Boolean);
    const pageFiles = changed.filter(
      (file) =>
        file.startsWith("src/app/(app)/") ||
        (file.startsWith("src/components/") &&
          !file.startsWith("src/components/ui/")),
    );
    expect(pageFiles).toEqual([]);

    // Valori di `variant` usati fuori da Button, dalla galleria e dai
    // componenti `ui/` (la galleria deve mostrare le varianti nuove: CA-31).
    const variants = (ref: string) => {
      const files = (git(["ls-tree", "-r", "--name-only", ref, "src"]) ?? "")
        .split("\n")
        .filter(
          (file) =>
            file.endsWith(".tsx") &&
            !file.startsWith("src/components/ui/") &&
            !file.startsWith("src/app/design-system/"),
        );
      const found = new Set<string>();
      for (const file of files) {
        const text = git(["show", `${ref}:${file}`]) ?? "";
        for (const m of text.matchAll(/variant[=:]\s*\{?\s*"([a-z-]+)"/g)) {
          found.add(m[1]!);
        }
      }
      return [...found].sort();
    };
    expect(variants("HEAD")).toEqual(variants(from!));
  });

  // ---------------------------------------------------------------- Campi

  test("CA-5: «Nome» vuoto ha l'etichetta a 16 px dentro la scatola; col clic sale a 12 px a 400", async ({
    page,
  }) => {
    const field = base(page, "base-campi");
    const box = field.locator(".campo__scatola").nth(0);
    const input = field.locator("#base-nome-vuoto");
    const label = box.locator("label.campo__etichetta");
    await waitHydrated(input);
    const inside = async () => {
      const b = await rect(box);
      const l = await rect(label);
      return (
        l.x >= b.x &&
        l.y >= b.y &&
        l.x + l.width <= b.x + b.width &&
        l.y + l.height <= b.y + b.height
      );
    };

    const resting = await style(label, ["font-size", "font-weight"]);
    expect(resting["font-size"]).toBe(
      (await style(input, ["font-size"]))["font-size"],
    );
    expect(resting["font-size"]).toBe("16px");
    expect(await inside()).toBe(true);
    expect((await rect(box)).height).toBeGreaterThanOrEqual(56);

    await input.click();
    await expect(input).toBeFocused();
    await waitForAnimationsToEnd(page);
    const up = await style(label, ["font-size", "font-weight"]);
    expect(up["font-size"]).toBe("12px");
    expect(up["font-weight"]).toBe("400");
    expect(await inside()).toBe(true);
    // Sopra il valore: il centro dell'etichetta sta nella metà alta della scatola.
    const b = await rect(box);
    const l = await rect(label);
    expect(l.y + l.height / 2).toBeLessThan(b.y + b.height / 2);
    expect(b.height).toBeGreaterThanOrEqual(56);
  });

  test("CA-6: col fuoco la scatola e il valore non si spostano; bordo 2 px inchiostro, a riposo 1 px filo-campo", async ({
    page,
  }) => {
    const field = base(page, "base-campi");
    const box = field.locator(".campo__scatola").nth(2);
    const input = field.locator("#base-nome-fuoco");
    const label = box.locator("label.campo__etichetta");
    await waitHydrated(input);
    const ink = await resolve(page, "color", "--color-inchiostro");
    const line = await resolve(page, "color", "--color-filo-campo");

    const visible = async () => {
      const own = shadowOf((await style(box, ["box-shadow"]))["box-shadow"]!);
      const inner = shadowOf(
        (await style(input, ["box-shadow"]))["box-shadow"]!,
      );
      return { own, inner };
    };
    // Posizioni relative alla scatola: il fuoco può far scorrere la pagina.
    const layout = async () => {
      const b = await rect(box);
      const rel = async (target: Locator) => {
        const r = await rect(target);
        return { x: r.x - b.x, y: r.y - b.y, width: r.width, height: r.height };
      };
      return {
        box: { width: b.width, height: b.height },
        input: await rel(input),
        label: await rel(label),
        shadow: await visible(),
      };
    };
    const before = await layout();
    // A riposo: 1 px --color-filo-campo (sulla scatola e sull'input).
    expect(before.shadow.own.spread).toBe(1);
    expect(before.shadow.own.color).toBe(line);

    await input.focus();
    await expect(input).toBeFocused();
    await waitForAnimationsToEnd(page);
    const after = await layout();
    expect(after.box).toEqual(before.box);
    expect(after.input).toEqual(before.input);
    expect(after.label).toEqual(before.label);
    expect(after.shadow.own.spread).toBe(2);
    expect(after.shadow.own.color).toBe(ink);
    expect(after.shadow.inner.spread).toBe(2);
    expect(after.shadow.inner.color).toBe(ink);
  });

  test("CA-7 (errore): «Telefono» ha bordo e fondo rossi, segno e testo a 13 px, aria collegata, etichetta non rossa", async ({
    page,
  }) => {
    const field = base(page, "base-campi-errore");
    const wrapper = field.locator(".campo").nth(0);
    const box = wrapper.locator(".campo__scatola");
    const input = wrapper.locator("input");
    const error = wrapper.locator(".campo__errore");
    const alert = await resolve(page, "color", "--color-allerta");

    const b = await style(box, [
      "background-color",
      "box-shadow",
      "border-top-width",
    ]);
    expect(b["background-color"]).toBe(
      await resolve(page, "color", "--color-allerta-fondo"),
    );
    // Bordo rosso: come filo interno della scatola (stessa misura del bordo).
    const edge =
      parseFloat(b["border-top-width"]!) > 0
        ? (await style(box, ["border-top-color"]))["border-top-color"]!
        : shadowOf(b["box-shadow"]!).color;
    expect(edge).toBe(alert);

    await expect(error).toHaveText(
      "Il numero è troppo corto: controlla le cifre.",
    );
    await expect(error.locator("svg")).toHaveCount(1);
    const e = await style(error, ["color", "font-size"]);
    expect(e.color).toBe(alert);
    expect(e["font-size"]).toBe("13px");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    const errorId = await error.getAttribute("id");
    expect(errorId).toBeTruthy();
    expect(
      (await input.getAttribute("aria-describedby"))?.split(" "),
    ).toContain(errorId);
    const labelColor = (
      await style(box.locator("label.campo__etichetta"), ["color"])
    ).color;
    expect(labelColor).not.toBe(alert);
  });

  test("CA-8: l'etichetta resta collegata al campo (getByLabel «Nome» scrive «Sofia»)", async ({
    page,
  }) => {
    const names = base(page, "base-campi").getByLabel("Nome", { exact: true });
    await expect(names).toHaveCount(3);
    const empty = names.nth(0);
    await waitHydrated(empty);
    await empty.fill("Sofia");
    await expect(empty).toHaveValue("Sofia");
  });

  test("CA-9: campi uniti, una scatola con raggio 12, filo di 1 px, «Scadenza» e «Codice» sulla stessa riga, fuoco solo su «Password»", async ({
    page,
  }) => {
    const joined = base(page, "base-campi-uniti");
    const group = joined.locator(".campo-unito").nth(0);
    const line = await resolve(page, "color", "--color-filo-campo");
    const g = await style(group, [
      "border-top-left-radius",
      "border-top-width",
      "border-top-color",
    ]);
    expect(g["border-top-left-radius"]).toBe("12px");
    expect(g["border-top-width"]).toBe("1px");
    expect(g["border-top-color"]).toBe(line);
    await expect(group.locator(".campo__scatola")).toHaveCount(2);

    const second = group.locator(".campo").nth(1);
    const filo = await style(second, ["border-top-width", "border-top-color"]);
    expect(filo["border-top-width"]).toBe("1px");
    expect(filo["border-top-color"]).toBe(line);
    // Nessun bordo proprio sui campi.
    for (const box of await group.locator(".campo__scatola").all()) {
      const s = await style(box, ["border-top-width", "box-shadow"]);
      expect(parseFloat(s["border-top-width"]!)).toBe(0);
      expect(s["box-shadow"]).toBe("none");
    }

    const expiry = joined.getByLabel("Scadenza", { exact: true });
    const code = joined.getByLabel("Codice", { exact: true });
    expect(
      Math.abs((await rect(expiry)).y - (await rect(code)).y),
    ).toBeLessThan(1);

    const password = joined.getByLabel("Password", { exact: true });
    await waitHydrated(password);
    await password.focus();
    await expect(password).toBeFocused();
    await waitForAnimationsToEnd(page);
    const boxes = group.locator(".campo__scatola");
    const mail = await style(boxes.nth(0), ["box-shadow"]);
    expect(mail["box-shadow"]).toBe("none");
    const ring = shadowOf(
      (await style(boxes.nth(1), ["box-shadow"]))["box-shadow"]!,
    );
    expect(ring.spread).toBe(2);
    expect(ring.color).toBe(await resolve(page, "color", "--color-inchiostro"));
  });

  test("CA-10: «Mostra la password» rende l'input di testo, sta dentro la scatola, area almeno 44 × 44", async ({
    page,
  }) => {
    const joined = base(page, "base-campi-uniti");
    const group = joined.locator(".campo-unito").nth(0);
    const password = joined.getByLabel("Password", { exact: true });
    const show = group.getByRole("button", { name: "Mostra la password" });
    await waitHydrated(show);
    await expect(password).toHaveAttribute("type", "password");
    await show.click();
    await expect(password).toHaveAttribute("type", "text");

    const hide = group.locator(".campo-password button");
    const outer = await rect(group.locator(".campo__scatola").nth(1));
    const inner = await rect(hide);
    expect(inner.x).toBeGreaterThanOrEqual(outer.x);
    expect(inner.y).toBeGreaterThanOrEqual(outer.y - 1);
    expect(inner.x + inner.width).toBeLessThanOrEqual(
      outer.x + outer.width + 1,
    );
    expect(inner.y + inner.height).toBeLessThanOrEqual(
      outer.y + outer.height + 1,
    );
    // Il pulsante è tondo da 44 px: l'area è il cerchio, non gli angoli.
    expect(await hasTouchSquare(hide, true)).toBe(true);
    expect(inner.width).toBeGreaterThanOrEqual(44);
    expect(inner.height).toBeGreaterThanOrEqual(44);
  });

  // ------------------------------------------- Avvisi, errore, vuoto, messaggio

  test("CA-12: avviso d'informazione quieto, avviso offline rosato con «Sei offline.»", async ({
    page,
  }) => {
    const info = base(page, "base-avviso-info");
    const i = await style(info, ["background-color", "border-top-width"]);
    expect(i["background-color"]).toBe(
      await resolve(page, "color", "--color-carta-2"),
    );
    expect(parseFloat(i["border-top-width"]!)).toBe(0);
    const infoIcon = await style(info.locator("svg"), [
      "background-color",
      "border-top-width",
    ]);
    expect(infoIcon["background-color"]).toBe("rgba(0, 0, 0, 0)");
    expect(parseFloat(infoIcon["border-top-width"]!)).toBe(0);

    const offline = base(page, "base-avviso-offline");
    await expect(offline).toHaveAttribute("role", "status");
    const o = await style(offline, ["background-color"]);
    expect(o["background-color"]).toBe(
      await resolve(page, "color", "--color-allerta-fondo"),
    );
    expect((await style(offline.locator("svg"), ["color"])).color).toBe(
      await resolve(page, "color", "--color-allerta"),
    );
    await expect(offline.locator("b, strong")).toHaveText("Sei offline.");
    await expect(offline.getByRole("button")).toHaveCount(0);
    await expect(offline.getByRole("link")).toHaveCount(0);
  });

  test("CA-14 (errore): «Riprova» chiama onRetry; icona nuda, titolo 700 a 21 px, «Riprova» a filo senza icona e stretto", async ({
    page,
  }) => {
    const error = base(page, "base-errore-pagina");
    const retry = error.getByRole("button", { name: "Riprova" });
    await waitHydrated(retry);
    await retry.click();
    await expect(tid(page, "base-errore-conteggio")).toHaveText("Riprova: 1");

    const icon = await style(error.locator(".errore-pagina__icona"), [
      "background-color",
      "border-top-left-radius",
      "box-shadow",
    ]);
    expect(icon["background-color"]).toBe("rgba(0, 0, 0, 0)");
    expect(icon["box-shadow"]).toBe("none");
    expect(parseFloat(icon["border-top-left-radius"]!)).toBe(0);
    const title = await style(error.getByRole("heading"), [
      "font-weight",
      "font-size",
    ]);
    expect(title["font-weight"]).toBe("700");
    expect(title["font-size"]).toBe("21px");

    const r = await style(retry, [
      "box-shadow",
      "border-top-width",
      "border-top-color",
    ]);
    const edge =
      parseFloat(r["border-top-width"]!) > 0
        ? r["border-top-color"]!
        : shadowOf(r["box-shadow"]!).color;
    expect(edge).toBe(await resolve(page, "color", "--color-inchiostro"));
    await expect(retry.locator("svg")).toHaveCount(0);
    const container = await rect(error.locator(".errore-pagina"));
    expect((await rect(retry)).width).toBeLessThan(container.width / 2);
  });

  test("CA-15 (vuoto): un solo interattivo, nome che comincia con «Nuova scadenza», bordo filo-2, raggio 16; il clic in un angolo vale", async ({
    page,
  }) => {
    const box = base(page, "base-vuoto-box");
    const interactive = box.locator("a, button, [tabindex]");
    await expect(interactive).toHaveCount(1);
    const target = interactive.nth(0);
    await waitHydrated(target);
    const name = await target.evaluate(
      (el) => el.getAttribute("aria-label") ?? el.textContent ?? "",
    );
    expect(name.trim().startsWith("Nuova scadenza")).toBe(true);
    await expect(
      box.getByRole("button", { name: /^Nuova scadenza/ }),
    ).toHaveCount(1);

    const s = await style(target, [
      "border-top-width",
      "border-top-color",
      "border-top-left-radius",
    ]);
    expect(s["border-top-width"]).toBe("1px");
    expect(s["border-top-color"]).toBe(
      await resolve(page, "color", "--color-filo-2"),
    );
    expect(s["border-top-left-radius"]).toBe("16px");

    await target.click({ position: { x: 4, y: 4 } });
    await expect(tid(page, "base-vuoto-conteggio")).toHaveText("Aperto: 1");
  });

  test("CA-16: il messaggio è scuro, ha «Annulla» sottolineato senza icona, sparisce dopo 5 s e «Annulla» chiama onUndo una volta", async ({
    page,
  }) => {
    await page.clock.install({ time: new Date("2026-10-20T10:00:00Z") });
    await page.goto(GALLERY);
    // Ferma il tempo: solo runFor() lo muove (una CI lenta non deve contare).
    await page.clock.pauseAt(new Date("2026-10-20T10:01:00Z"));
    const open = tid(page, "base-messaggio-mostra");
    await waitHydrated(open);
    await open.click();
    const toast = page.getByTestId("toast");
    await expect(toast).toBeVisible();
    await expect(toast).toHaveText(/^Fatto: Passeggiata della sera\s*Annulla$/);
    expect((await style(toast, ["background-color"]))["background-color"]).toBe(
      await resolve(page, "color", "--color-inchiostro"),
    );
    await expect(toast.locator("svg")).toHaveCount(0);
    const undo = toast.getByRole("button");
    await expect(undo).toHaveCount(1);
    await expect(undo).toHaveText("Annulla");
    expect(
      (await style(undo, ["text-decoration-line"]))["text-decoration-line"],
    ).toContain("underline");

    // Il puntatore sopra il messaggio ferma il conto: lo tolgo prima.
    await page.mouse.move(0, 0);
    await page.clock.runFor(4900);
    await expect(toast).toBeVisible();
    await page.clock.runFor(100);
    await expect(toast).toHaveCount(0);

    await open.click();
    await toast.getByRole("button", { name: "Annulla" }).click();
    await expect(toast).toHaveCount(0);
    await expect(tid(page, "base-messaggio-conteggio")).toHaveText(
      "Annullato: 1",
    );
  });

  // -------------------------------------------------------- Freccia e righe

  test("CA-17: la freccia nuda è un link «Indietro» senza testo, fondo, bordo e ombra, 44 × 44; con onMedia disco di 40 px con ombra", async ({
    page,
  }) => {
    const area = base(page, "base-freccia");
    const links = area.getByRole("link", { name: "Indietro", exact: true });
    await expect(links).toHaveCount(2);
    const bare = links.nth(0);
    expect(((await bare.textContent()) ?? "").trim()).toBe("");
    const s = await style(bare, [
      "background-color",
      "border-top-width",
      "box-shadow",
    ]);
    expect(s["background-color"]).toBe("rgba(0, 0, 0, 0)");
    expect(parseFloat(s["border-top-width"]!)).toBe(0);
    expect(s["box-shadow"]).toBe("none");
    const r = await rect(bare);
    expect(r.width).toBeGreaterThanOrEqual(44);
    expect(r.height).toBeGreaterThanOrEqual(44);
    expect(await hasTouchSquare(bare)).toBe(true);

    const disc = links.nth(1);
    const d = await rect(disc);
    expect(d.width).toBe(40);
    expect(d.height).toBe(40);
    const ds = await style(disc, ["background-color", "box-shadow"]);
    expect(ds["background-color"]).toBe(
      await resolve(page, "color", "--color-superficie"),
    );
    expect(ds["box-shadow"]).toBe(
      await resolve(page, "box-shadow", "--shadow-disco"),
    );
    // L'area di tocco resta di 44 (::before) intorno al disco.
    expect(await hasTouchSquare(disc)).toBe(true);
  });

  test("CA-18: «Indietro» torna alla pagina di prima; aperta direttamente porta al fallback", async ({
    page,
  }) => {
    // Aperta da un'altra pagina: torna lì.
    await page.goto(`${GALLERY}?prima=1`);
    await page.goto(GALLERY);
    const back = base(page, "base-freccia")
      .getByRole("link", { name: "Indietro", exact: true })
      .nth(0);
    await waitHydrated(back);
    await back.click();
    await expect(page).toHaveURL(/\/design-system\?prima=1$/);
  });

  test("CA-18: «Indietro» di una pagina aperta direttamente porta al fallback", async ({
    page,
  }) => {
    // Prima apertura della scheda: nessuna pagina prima (il fallback è
    // /design-system, quindi la query sparisce).
    await page.goto(`${GALLERY}?diretta=1`);
    const link = base(page, "base-freccia")
      .getByRole("link", { name: "Indietro", exact: true })
      .nth(0);
    await waitHydrated(link);
    await link.click();
    await expect(page).toHaveURL(/\/design-system$/);
  });

  test("CA-19: righe a filo, titolo 600, freccia aria-hidden inchiostro-3, 64 px, filo di 1 px, ogni riga un solo link", async ({
    page,
  }) => {
    const list = base(page, "base-righe");
    const items = list.locator("li");
    await expect(items).toHaveCount(3);
    await expect(list.getByRole("link")).toHaveCount(3);
    const thread = await resolve(page, "color", "--color-filo");
    for (let n = 0; n < 3; n++) {
      const item = items.nth(n);
      await expect(item.getByRole("link")).toHaveCount(1);
      const row = item.getByRole("link");
      const s = await style(row, ["background-color", "box-shadow"]);
      expect(s["background-color"], `riga ${n}`).toBe("rgba(0, 0, 0, 0)");
      expect(s["box-shadow"], `riga ${n}`).toBe("none");
      const rowBox = await style(item, ["box-shadow"]);
      expect(rowBox["box-shadow"], `riga ${n}`).toBe("none");
      expect(
        (await style(row.locator(".riga-lista__titolo"), ["font-weight"]))[
          "font-weight"
        ],
      ).toBe("600");
      const arrow = row.locator(".riga-lista__freccia");
      await expect(arrow).toHaveAttribute("aria-hidden", "true");
      expect((await style(arrow, ["color"])).color).toBe(
        await resolve(page, "color", "--color-inchiostro-3"),
      );
      expect((await rect(row)).height).toBeGreaterThanOrEqual(64);
      if (n > 0) {
        const line = await style(item, [
          "border-top-width",
          "border-top-color",
        ]);
        expect(line["border-top-width"], `filo ${n}`).toBe("1px");
        expect(line["border-top-color"], `filo ${n}`).toBe(thread);
      }
    }
  });

  test("CA-20: la riga tenuta premuta ha fondo premuto su tutta la larghezza", async ({
    page,
  }) => {
    const item = base(page, "base-righe").locator("li").nth(0);
    const row = item.getByRole("link");
    await row.scrollIntoViewIfNeeded();
    const box = (await row.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    try {
      await waitForAnimationsToEnd(page);
      await expect
        .poll(
          async () =>
            (await style(row, ["background-color"]))["background-color"],
        )
        .toBe(await resolve(page, "color", "--color-premuto"));
      expect((await rect(row)).width).toBeCloseTo((await rect(item)).width, 0);
    } finally {
      // Si rilascia fuori dalla riga: nessun clic, nessuna navigazione.
      await page.mouse.move(0, 0);
      await page.mouse.up();
    }
  });

  test("CA-21: «Modifica Nome» è un pulsante con testo visibile «Modifica» sottolineato; l'etichetta «Nome» a 12 px sta sopra «Marco»", async ({
    page,
  }) => {
    const edit = page.getByRole("button", {
      name: "Modifica Nome",
      exact: true,
    });
    await expect(edit).toHaveCount(1);
    await waitHydrated(edit);
    // Testo visibile: senza la parte per i lettori di schermo («Nome»).
    expect(
      (
        await edit.evaluate((el) => {
          const copy = el.cloneNode(true) as HTMLElement;
          copy
            .querySelectorAll(".visivamente-nascosto")
            .forEach((node) => node.remove());
          return copy.textContent ?? "";
        })
      ).trim(),
    ).toBe("Modifica");
    expect(
      (await style(edit, ["text-decoration-line"]))["text-decoration-line"],
    ).toContain("underline");
    const row = page.locator(".riga-dato").nth(0);
    const label = row.locator(".riga-dato__etichetta");
    const value = row.locator(".riga-dato__valore");
    await expect(label).toHaveText("Nome");
    await expect(value).toHaveText("Marco");
    expect((await style(label, ["font-size"]))["font-size"]).toBe("12px");
    const l = await rect(label);
    const v = await rect(value);
    expect(l.y + l.height).toBeLessThanOrEqual(v.y + 1);
    // Il clic chiama onEdit (il contatore «Modifica: n» è quello dell'esempio 10).
    await expect(page.getByText("Modifica: 0", { exact: true })).toHaveCount(1);
    await edit.click();
    await expect(page.getByText("Modifica: 1", { exact: true })).toHaveCount(1);
  });

  test("CA-22: l'interruttore di «Cose aggiunte alla spesa» passa a acceso con il clic e con Spazio; binario inchiostro; la riga non è un link né un pulsante", async ({
    page,
  }) => {
    const area = base(page, "base-interruttori");
    const toggle = area.getByRole("switch", {
      name: "Cose aggiunte alla spesa",
    });
    await waitHydrated(toggle);
    const ink = await resolve(page, "color", "--color-inchiostro");
    const row = area.locator("li").filter({
      has: page.getByRole("switch", { name: "Cose aggiunte alla spesa" }),
    });
    await expect(row).toHaveCount(1);
    // La riga è ferma: un solo elemento interattivo, ed è l'interruttore.
    await expect(row.locator("a, button")).toHaveCount(1);
    await expect(row.getByRole("link")).toHaveCount(0);
    await expect(row.getByRole("button")).toHaveCount(0);

    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(
      (await style(toggle, ["background-color"]))["background-color"],
    ).toBe(ink);
    expect(
      (await style(toggle, ["background-color"], "::after"))[
        "background-color"
      ],
    ).toBe(await resolve(page, "color", "--color-superficie"));

    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  test("CA-23: «Aggiungi un figlio o un animale» ha il cerchio con il + senza fondo pieno; «Togli Laura dal Nest» ha il titolo rosso", async ({
    page,
  }) => {
    const area = base(page, "base-azioni");
    const add = area.getByRole("button", {
      name: "Aggiungi un figlio o un animale",
    });
    const plus = add.locator(".riga-lista__piu");
    await expect(plus.locator("svg")).toHaveCount(1);
    const p = await style(plus, [
      "background-color",
      "border-top-left-radius",
      "border-top-width",
      "box-shadow",
    ]);
    expect(p["background-color"]).toBe("rgba(0, 0, 0, 0)");
    expect(parseFloat(p["border-top-left-radius"]!)).toBeGreaterThan(0);
    // Il filo del cerchio: bordo o filo interno.
    expect(
      parseFloat(p["border-top-width"]!) > 0 || p["box-shadow"] !== "none",
    ).toBe(true);
    // Il cerchio sta a sinistra del titolo.
    const title = add.locator(".riga-lista__titolo");
    expect((await rect(plus)).x).toBeLessThan((await rect(title)).x);

    const remove = area.getByRole("button", { name: "Togli Laura dal Nest" });
    expect(
      (await style(remove.locator(".riga-lista__titolo"), ["color"])).color,
    ).toBe(await resolve(page, "color", "--color-allerta"));
  });

  // ----------------------------------------------------- Vibrazione e fuoco

  test("CA-24: nessun componente della galleria chiama navigator.vibrate", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const calls: unknown[] = [];
      (window as unknown as { __vibrate: unknown[] }).__vibrate = calls;
      Object.defineProperty(navigator, "vibrate", {
        configurable: true,
        value: (...args: unknown[]) => {
          calls.push(args);
          return true;
        },
      });
    });
    await page.goto(GALLERY);
    const save = base(page, "base-pulsanti").getByRole("button", {
      name: "Salva",
      exact: true,
    });
    await waitHydrated(save);
    await save.click();
    const toggle = base(page, "base-interruttori").getByRole("switch", {
      name: "Cose aggiunte alla spesa",
    });
    await toggle.click();
    await tid(page, "base-messaggio-mostra").click();
    await page
      .getByTestId("toast")
      .getByRole("button", { name: "Annulla" })
      .click();
    expect(
      await page.evaluate(
        () => (window as unknown as { __vibrate: unknown[] }).__vibrate.length,
      ),
    ).toBe(0);
  });

  test("CA-25: «Salva» col fuoco da tastiera ha l'anello --border-medio solido azione a --space-half", async ({
    page,
  }) => {
    const save = base(page, "base-pulsanti").getByRole("button", {
      name: "Salva",
      exact: true,
    });
    await waitHydrated(save);
    // Tastiera: la modalità del fuoco diventa «da tastiera» (:focus-visible).
    await page.keyboard.press("Tab");
    await save.focus();
    await expect(save).toBeFocused();
    const ring = await style(save, [
      "outline-style",
      "outline-width",
      "outline-color",
      "outline-offset",
    ]);
    expect(ring["outline-style"]).toBe("solid");
    // 1,5 px (--border-medio) si disegna come 1 px su uno schermo 1x.
    expect(parseFloat(ring["outline-width"]!)).toBeGreaterThanOrEqual(1);
    expect(parseFloat(ring["outline-width"]!)).toBeLessThanOrEqual(1.5);
    expect(ring["outline-color"]).toBe(
      await resolve(page, "color", "--color-fuoco"),
    );
    expect(ring["outline-offset"]).toBe(
      await resolve(page, "width", "--space-half"),
    );
  });

  test("CA-26: i rapporti di contrasto di §9 sono almeno il minimo", async ({
    page,
  }) => {
    const surface = await resolve(page, "color", "--color-superficie");
    const paper2 = await resolve(page, "color", "--color-carta-2");
    const colorOf = async (locator: Locator) =>
      (await style(locator, ["color"])).color!;
    const bgOf = async (locator: Locator) =>
      (await style(locator, ["background-color"]))["background-color"]!;
    const ratios: [string, number, number][] = [];

    const buttons = base(page, "base-pulsanti");
    const primary = buttons.getByRole("button", { name: "Salva", exact: true });
    ratios.push([
      "primario",
      contrast(await colorOf(primary), await bgOf(primary)),
      4.5,
    ]);
    // Rosso pieno: il bottone del dialogo di conferma della galleria.
    for (const danger of await page.locator(".btn-pericolo-pieno").all()) {
      ratios.push([
        "pericolo pieno",
        contrast(await colorOf(danger), await bgOf(danger)),
        4.5,
      ]);
    }
    const secondary = buttons.getByRole("button", { name: "Usa di nuovo" });
    ratios.push([
      "secondario",
      contrast(await colorOf(secondary), surface),
      4.5,
    ]);
    const secondaryEdge = shadowOf(
      (await style(secondary, ["box-shadow"]))["box-shadow"]!,
    ).color;
    if (secondaryEdge) {
      ratios.push([
        "bordo del secondario",
        contrast(secondaryEdge, surface),
        3,
      ]);
    }
    const quiet = buttons.getByRole("button", { name: "Metti in spesa" });
    ratios.push([
      "quieto",
      contrast(await colorOf(quiet), await bgOf(quiet)),
      4.5,
    ]);
    ratios.push([
      "link",
      contrast(
        await colorOf(
          buttons.getByRole("button", { name: "Annulla", exact: true }),
        ),
        surface,
      ),
      4.5,
    ]);
    ratios.push([
      "pericolo",
      contrast(
        await colorOf(
          buttons.getByRole("button", { name: "Elimina la lista" }),
        ),
        surface,
      ),
      4.5,
    ]);

    // Avvisi: ogni variante della galleria, testo contro il fondo dell'avviso.
    for (const alert of await page.locator(".avviso").all()) {
      ratios.push([
        "avviso",
        contrast(
          await colorOf(alert.locator(".avviso__testo")),
          await bgOf(alert),
        ),
        4.5,
      ]);
    }

    // Campi: testo d'errore, etichetta (anche in errore) e bordo.
    const errorField = base(page, "base-campi-errore").locator(".campo").nth(0);
    ratios.push([
      "testo d'errore",
      contrast(await colorOf(errorField.locator(".campo__errore")), surface),
      4.5,
    ]);
    for (const field of await page.locator("#base-2 .campo__scatola").all()) {
      const bg = await bgOf(field);
      const label = field.locator("label.campo__etichetta");
      // Fondo trasparente (campi uniti): il fondo è quello del blocco.
      const behind = bg === "rgba(0, 0, 0, 0)" ? surface : bg;
      ratios.push([
        "etichetta del campo",
        contrast(await colorOf(label), behind),
        4.5,
      ]);
      const edge = shadowOf(
        (await style(field, ["box-shadow"]))["box-shadow"]!,
      );
      if (edge.color) {
        ratios.push(["bordo del campo", contrast(edge.color, surface), 3]);
        if (bg !== "rgba(0, 0, 0, 0)") {
          ratios.push([
            "bordo sul fondo del campo",
            contrast(edge.color, bg),
            3,
          ]);
        }
      }
    }

    // Interruttore: binario o bordo, spento e acceso, contro la superficie.
    const toggle = base(page, "base-interruttori").getByRole("switch", {
      name: "Cose aggiunte alla spesa",
    });
    const offTrack = await bgOf(toggle);
    const offEdge = shadowOf(
      (await style(toggle, ["box-shadow"]))["box-shadow"]!,
    );
    ratios.push([
      "interruttore spento",
      Math.max(
        contrast(offTrack, surface),
        offEdge.color ? contrast(offEdge.color, surface) : 0,
      ),
      3,
    ]);
    const onToggle = base(page, "base-interruttori").getByRole("switch", {
      name: "Non disturbare",
    });
    ratios.push([
      "interruttore acceso",
      contrast(await bgOf(onToggle), surface),
      3,
    ]);

    // Anello di fuoco.
    const ring = await resolve(page, "color", "--color-fuoco");
    ratios.push(["anello su superficie", contrast(ring, surface), 3]);
    ratios.push(["anello su carta-2", contrast(ring, paper2), 3]);

    const failures = ratios
      .filter(([, value, minimum]) => value < minimum)
      .map(
        ([name, value, minimum]) => `${name}: ${value.toFixed(2)} < ${minimum}`,
      );
    expect(failures).toEqual([]);

    // Messaggio: testo e «Annulla» contro il fondo del messaggio.
    await waitHydrated(tid(page, "base-messaggio-mostra"));
    await tid(page, "base-messaggio-mostra").click();
    const toast = page.getByTestId("toast");
    await expect(toast).toBeVisible();
    await page.mouse.move(0, 0);
    const toastBg = await bgOf(toast);
    expect(
      contrast(await colorOf(toast.locator(".toast__testo")), toastBg),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(
        await colorOf(toast.getByRole("button", { name: "Annulla" })),
        toastBg,
      ),
    ).toBeGreaterThanOrEqual(4.5);
  });

  // ------------------------------------------------------------ Galleria

  test("CA-31 (galleria): ogni esempio di §7 ha i testi delle tavole", async ({
    page,
  }) => {
    const section = page.locator("#base-2");
    for (const text of [
      "Salva",
      "Usa di nuovo",
      "Metti in spesa",
      "Elimina la lista",
      "Il numero è troppo corto: controlla le cifre.",
      "Niente dati di salute delle persone.",
      "La tua mail",
      "Numero della carta",
      "Sofia non ha un account: il suo profilo lo tenete voi adulti.",
      "Vedi le cose aggiornate alle 19:05; le modifiche partiranno appena torna la connessione.",
      "Nuova scadenza",
      "Antiparassitario, vaccino, visita: ve li ricordiamo noi.",
      "Questa pagina non si è caricata",
      "Controlla la connessione e riprova.",
      "Impostazioni",
      "Tema, notifiche, privacy",
      "Calendari collegati",
      "Google e Outlook",
      "Il tuo profilo",
      "I tuoi dati e il tuo account",
      "marco.bianchi@esempio.it",
      "18 settembre",
      "Promemoria prima di un impegno",
      "Un'ora prima",
      "Dalle 22:00 alle 7:00",
      "Invita una persona",
      "Riceve un link ed entra",
      "Togli Laura dal Nest",
    ]) {
      // «Salva» e «Annulla» stanno in due esempi (1 e 2): basta che ci siano.
      expect(await section.getByText(text).count(), text).toBeGreaterThan(0);
    }
  });
});

// ------------------------------------------------------------ Gallery apart

test.describe("galleria · reduced motion e avviso offline", () => {
  test("CA-11: con movimento ridotto l'etichetta cambia posto in un solo fotogramma", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(GALLERY);
    const input = page.locator("#base-nome-vuoto");
    await waitHydrated(input);
    const label = page.locator("#base-nome-vuoto ~ label.campo__etichetta");
    const result = await input.evaluate((el) => {
      const field = el as HTMLInputElement;
      const labelEl = field.parentElement!.querySelector<HTMLElement>(
        "label.campo__etichetta",
      )!;
      const before = labelEl.getBoundingClientRect().y;
      field.focus();
      // Lo stile si ricalcola qui: nessuna transizione deve essere partita.
      const running = labelEl.getAnimations().length;
      const duration = getComputedStyle(labelEl).transitionDuration;
      const property = getComputedStyle(labelEl).transitionProperty;
      const after = labelEl.getBoundingClientRect().y;
      return { before, after, running, duration, property };
    });
    expect(result.running).toBe(0);
    expect(
      result.duration.split(",").every((d) => parseFloat(d) === 0) ||
        result.property === "none",
    ).toBe(true);
    expect(result.after).toBeLessThan(result.before);
    await expect(label).toBeVisible();
  });

  test("CA-13: l'avviso offline in cima resta fermo mentre la pagina scorre di 400 px", async ({
    page,
  }) => {
    await page.goto(`${GALLERY}?avviso-offline=1`);
    const notice = page.getByTestId("base-avviso-offline-alto");
    await expect(notice).toBeVisible();
    await expect(notice).toHaveAttribute("role", "status");
    const content = page.getByTestId("base-avviso-offline-contenuto");
    expect((await rect(content)).height).toBeGreaterThanOrEqual(800);

    const before = (await rect(notice)).y;
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect
      .poll(() => page.evaluate(() => Math.round(window.scrollY)))
      .toBe(400);
    const after = (await rect(notice)).y;
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
  });

  test("CA-13 (sticky): una volta arrivato in cima, l'avviso offline non si muove più mentre la pagina scorre", async ({
    page,
  }) => {
    await page.goto(`${GALLERY}?avviso-offline=1`);
    const notice = page.getByTestId("base-avviso-offline-alto");
    await expect(notice).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 100));
    await expect
      .poll(() => page.evaluate(() => Math.round(window.scrollY)))
      .toBe(100);
    const stuck = (await rect(notice)).y;
    expect(stuck).toBe(0);
    await page.evaluate(() => window.scrollTo(0, 300));
    await expect
      .poll(() => page.evaluate(() => Math.round(window.scrollY)))
      .toBe(300);
    expect(Math.abs((await rect(notice)).y - stuck)).toBeLessThanOrEqual(1);
  });
});

// --------------------------------------------------------- Non sulla galleria

test.describe("regole statiche", () => {
  test("CA-24 (statico): haptic non fa nulla e in src/ non c'è nessun «vibrate»", () => {
    const calls: unknown[] = [];
    const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        vibrate: (...args: unknown[]) => {
          calls.push(args);
          return true;
        },
      },
    });
    try {
      for (const kind of ["leggera", "conferma", "avviso"] as const) {
        expect(() => haptic(kind)).not.toThrow();
        expect(haptic(kind)).toBeUndefined();
      }
    } finally {
      if (original) Object.defineProperty(globalThis, "navigator", original);
      else delete (globalThis as { navigator?: unknown }).navigator;
    }
    expect(calls).toHaveLength(0);

    const offenders = sourceFiles(join(ROOT, "src"))
      .filter((file) => /\.(tsx?|css|mjs|js)$/.test(file))
      .filter((file) => /vibrate/i.test(readFileSync(file, "utf8")))
      .map((file) => file.slice(ROOT.length + 1));
    expect(offenders).toEqual([]);
  });

  test("CA-29 (parte): il numero di test.skip e test.fixme incondizionati non è aumentato", () => {
    if (!onBranchOf503()) return;
    const from = mergeBase();
    expect(
      from,
      "storia comune con origin/main non disponibile: CA-29 non verificabile",
    ).not.toBeNull();
    // Conta gli skip e i fixme senza condizione: `test.skip(true`, `test.skip("…"`,
    // `test.fixme`. I salti condizionali per utenti di prova mancanti non contano.
    const pattern = /\btest\.(fixme\b|skip\(\s*(true\b|["'`]))/g;
    const count = (ref: string | null) => {
      const files = (
        ref === null
          ? sourceFiles(join(ROOT, "tests")).map((f) =>
              f.slice(ROOT.length + 1),
            )
          : (git(["ls-tree", "-r", "--name-only", ref, "tests"]) ?? "")
              .split("\n")
              .filter(Boolean)
      ).filter(
        (file) =>
          file.endsWith(".ts") && !file.endsWith("componenti-base.spec.ts"),
      );
      let total = 0;
      for (const file of files) {
        const text =
          ref === null
            ? readFileSync(join(ROOT, file), "utf8")
            : (git(["show", `${ref}:${file}`]) ?? "");
        total += text.match(pattern)?.length ?? 0;
      }
      return total;
    };
    expect(count(null)).toBeLessThanOrEqual(count(from));
  });

  test("CA-31 (documenti): componenti.md e registro.md hanno una voce per ogni prop e componente nuovo", () => {
    const components = readFileSync(
      join(ROOT, ".claude/skills/design-system/riferimento/componenti.md"),
      "utf8",
    );
    const registry = readFileSync(
      join(ROOT, ".claude/skills/design-system/riferimento/registro.md"),
      "utf8",
    );
    const section = components.slice(
      components.indexOf("Componenti 2.0 di base"),
    );
    for (const term of [
      "quieto",
      "FieldGroup",
      "columns",
      "lead",
      "offline",
      'variant="box"',
      "onMedia",
      "flush",
      "title",
      "icon",
      "arrow",
      "value",
      "add",
      'tone="danger"',
      "trailing",
      "ValueRow",
      "haptic",
      "Toggle",
    ]) {
      expect(section, `componenti.md: ${term}`).toContain(term);
    }
    expect(registry).toMatch(/#503|F4a/);
    const gallery = readFileSync(
      join(ROOT, "src/app/design-system/Gallery.tsx"),
      "utf8",
    );
    for (const usage of [
      'variant="quieto"',
      "<FieldGroup",
      "columns",
      'variant="offline"',
      'variant="box"',
      "onMedia",
      "<List flush>",
      "<ValueRow",
      "trailing=",
      "add",
      'tone="danger"',
      "arrow",
      "value=",
      "lead",
    ]) {
      expect(gallery, `Gallery.tsx: ${usage}`).toContain(usage);
    }
  });

  test("CA-i18n: i testi toccati sono in it.ts", () => {
    expect(messages.edit).toBe("Modifica");
    expect(messages.showPassword).toBe("Mostra la password");
    expect(messages.offlineLead).toBe("Sei offline.");
    expect(messages.back).toBe("Indietro");
    expect(messages.close).toBe("Chiudi");
    expect(messages.cancel).toBe("Annulla");
    expect(messages.retry).toBe("Riprova");
  });
});

// -------------------------------------------------------------- Isolamento

test.describe("isolamento tra Nest", () => {
  test("CA-28 (isolamento): Paolo su /nest vede i soli membri del Nest B e nessun nome del Nest A", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("B2"), skipReason("B2"));
    await signInAs(page.context(), baseURL as string, "B2");
    const bodies: string[] = [];
    page.on("response", async (response) => {
      const type = response.request().resourceType();
      if (!["document", "fetch", "xhr"].includes(type)) return;
      try {
        bodies.push(await response.text());
      } catch {
        // risposta senza corpo (redirect)
      }
    });
    await page.goto("/nest");
    const list = page.getByRole("list", { name: "Chi c’è" });
    await expect(list.getByRole("listitem")).toHaveCount(4);
    for (const name of ["Giulia", "Paolo, tu", "Leo", "Anna"]) {
      await expect(list.getByText(name, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Casa Bianchi",
    );
    const main = page.locator("main");
    for (const name of ["Marco", "Laura", "Sofia", "Tommaso", "Biscotto"]) {
      await expect(main).not.toContainText(name);
    }
    // Anche nelle risposte di rete: nessun id e nessun nome del Nest A.
    const traffic = bodies.join("\n");
    expect(traffic).not.toContain(SEED_HOME_A);
    for (const name of ["Tommaso", "Biscotto"]) {
      expect(traffic).not.toContain(name);
    }
  });
});
