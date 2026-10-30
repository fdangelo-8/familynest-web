import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { NORMAL_LIST, installSpesaFake } from "../fixtures/spesa-fake";
import {
  FULL_TODOS,
  NORMAL_TODOS,
  installTodosFake,
  type TodosFakeOptions,
} from "../fixtures/todos-fake";
import { hasTestUser } from "../fixtures/visual-login";
import { signInAsCached } from "../fixtures/visual-login-cached";

// Casa · Da fare (#23), visual tester's accessibility checks: axe in every
// state (normal, empty, filter without results, loading, page error, column
// error, offline, toast with «Annulla», refused change), touch areas of 44 px,
// focus order and visible focus ring, keyboard use, no trap. The things to do
// and the shopping list are served by fakes (fixtures/todos-fake.ts,
// fixtures/spesa-fake.ts): nothing is written to the database.
// Test user A (Casa D'Angelo: Marco, Laura, Sofia, Tommaso, Biscotto) is needed.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const NOW = new Date("2026-10-20T15:52:00+02:00");

test.beforeEach(async ({ context, baseURL }) => {
  test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
  const signedIn = await signInAsCached(context, baseURL!, "A");
  test.skip(!signedIn, "utente di test A non ancora creato (#55)");
});

type OpenOptions = TodosFakeOptions & { shopping?: "ok" | "error" };

async function open(page: Page, options: OpenOptions, ready = true) {
  await page.clock.install({ time: NOW });
  await installSpesaFake(page, {
    items: NORMAL_LIST,
    reads: options.shopping ?? "ok",
  });
  const fake = await installTodosFake(page, options);
  await page.goto("/casa/da-fare");
  if (ready) {
    await expect(page.getByRole("region", { name: "Da fare" })).toBeVisible({
      timeout: 20_000,
    });
  }
  return fake;
}

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target.join(" ")),
    }));
}

const isMobile = (name: string) => name === "mobile";

// --- axe, every state -----------------------------------------------------

test.describe("axe", () => {
  test("normale", async ({ page }) => {
    await open(page, { todos: NORMAL_TODOS });
    await expect(page.getByTestId("da-fare-riga")).toHaveCount(6);
    expect(await seriousViolations(page)).toEqual([]);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });

  test("pieno", async ({ page }) => {
    await open(page, { todos: FULL_TODOS });
    await expect(page.getByTestId("da-fare-riga")).toHaveCount(9);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("vuoto", async ({ page }) => {
    await open(page, { todos: [] });
    await expect(page.getByText("Niente da fare, per ora")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("filtro senza risultati", async ({ page }) => {
    await open(page, { todos: NORMAL_TODOS });
    await page.getByRole("button", { name: "Tommaso" }).click();
    await expect(
      page
        .getByRole("region", { name: "Da fare" })
        .getByText("Niente da fare per Tommaso"),
    ).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("caricamento", async ({ page }) => {
    await open(page, { todos: NORMAL_TODOS, reads: "slow" }, false);
    await expect(page.locator('[aria-busy="true"]').first()).toContainText(
      "Caricamento in corso",
    );
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("errore di pagina", async ({ page }) => {
    await open(page, { reads: "error", shopping: "error" }, false);
    await expect(
      page.getByRole("heading", { name: "Questa pagina non si è caricata" }),
    ).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("errore nella colonna (desktop)", async ({ page }, testInfo) => {
    test.skip(isMobile(testInfo.project.name), "solo desktop");
    await open(page, { reads: "error" }, false);
    await expect(
      page.getByText("Non riusciamo a caricare le cose da fare"),
    ).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("offline", async ({ page, context }) => {
    await open(page, { todos: NORMAL_TODOS });
    await context.setOffline(true);
    await page
      .getByRole("checkbox", {
        name: "Segna come fatto: Regalo per la festa di Giulia",
      })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Sei offline" }),
    ).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("toast con Annulla", async ({ page }) => {
    await open(page, { todos: NORMAL_TODOS });
    await page
      .getByRole("checkbox", {
        name: "Segna come fatto: Firmare autorizzazione gita",
      })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Fatto:" }),
    ).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("toast di modifica rifiutata", async ({ page }) => {
    const fake = await open(page, { todos: NORMAL_TODOS });
    fake.refuseWrites();
    await page
      .getByRole("checkbox", {
        name: "Segna come fatto: Regalo per la festa di Giulia",
      })
      .click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Non siamo riusciti a salvare la modifica" }),
    ).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
});

// --- touch areas ------------------------------------------------------------

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

test("aree di tocco di almeno 44 px (mobile)", async ({ page }, testInfo) => {
  test.skip(!isMobile(testInfo.project.name), "area di tocco: solo mobile");
  await open(page, { todos: NORMAL_TODOS });
  await page.evaluate(() => window.scrollTo(0, 0));

  for (const name of [
    "Segna come fatto: Chiamare il commercialista",
    "Segna come fatto: Comprare la cuffia da nuoto",
    "Rimetti da fare: Pagare la mensa",
  ]) {
    const box = page.getByRole("checkbox", { name });
    await box.scrollIntoViewIfNeeded();
    expect(await hasTouchArea(box), name).toBe(true);
  }

  for (const name of ["Tutti", "Miei", "Laura", "Sofia", "Tommaso"]) {
    const chip = page.getByRole("button", { name });
    await chip.scrollIntoViewIfNeeded();
    expect(await hasTouchArea(chip), `chip ${name}`).toBe(true);
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  for (const name of ["Spesa", "Da fare", "Scadenze"]) {
    const control = page
      .getByRole("group", { name: "Sezione della casa" })
      .getByText(name, { exact: false })
      .first()
      .locator("xpath=ancestor-or-self::*[self::a or self::button][1]");
    expect(await hasTouchArea(control), `voce ${name}`).toBe(true);
  }

  // The touch areas of two rows do not overlap: the rows are at least 44 px apart.
  const first = (await page
    .getByRole("checkbox", {
      name: "Segna come fatto: Chiamare il commercialista",
    })
    .boundingBox())!;
  const second = (await page
    .getByRole("checkbox", {
      name: "Segna come fatto: Comprare la cuffia da nuoto",
    })
    .boundingBox())!;
  expect(second.y - first.y).toBeGreaterThanOrEqual(44);
});

test("aree di tocco: Riprova, Annulla e filtro vuoto (mobile)", async ({
  page,
  context,
}, testInfo) => {
  test.skip(!isMobile(testInfo.project.name), "area di tocco: solo mobile");
  await open(page, { todos: NORMAL_TODOS });
  await page.getByRole("button", { name: "Tommaso" }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Tommaso" }).click();
  const showAll = page.getByRole("button", {
    name: "Mostra tutte le cose da fare",
  });
  await expect(showAll).toBeVisible();
  expect(await hasTouchArea(showAll, 44), "Mostra tutte").toBe(true);
  await showAll.click();

  await context.setOffline(true);
  await page
    .getByRole("checkbox", {
      name: "Segna come fatto: Regalo per la festa di Giulia",
    })
    .click();
  const retry = page.getByRole("button", { name: "Riprova" });
  await expect(retry).toBeVisible();
  expect(await hasTouchArea(retry, 44), "Riprova").toBe(true);
  await context.setOffline(false);
  await expect(page.locator(".avviso--errore")).toBeHidden({ timeout: 15_000 });

  await page
    .getByRole("checkbox", {
      name: "Segna come fatto: Comprare la cuffia da nuoto",
    })
    .click();
  const undo = page.getByRole("button", { name: "Annulla" });
  await expect(undo).toBeVisible();
  expect((await undo.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

// --- focus: order, visible ring, no trap -------------------------------------

async function focusedLabel(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return "(body)";
    const label = el.getAttribute("aria-label");
    if (label) return label;
    if (el instanceof HTMLInputElement && el.labels?.[0]) {
      return (el.labels[0].textContent ?? "").trim();
    }
    const clone = el.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll(".avatar, .selettore__conteggio")
      .forEach((n) => n.remove());
    return (clone.textContent ?? "").trim().replace(/\s+/g, " ");
  });
}

test("ordine del focus: selettore o chip, poi le caselle dall'alto, senza trappole", async ({
  page,
}, testInfo) => {
  await open(page, { todos: FULL_TODOS });
  const mobile = isMobile(testInfo.project.name);
  const seen: string[] = [];
  // Start on the first control of the page content and tab to the last box.
  const start = mobile
    ? page.getByRole("link", { name: /^Spesa/ }).first()
    : page.getByRole("button", { name: "Tutti" });
  await start.focus();
  seen.push(await focusedLabel(page));
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab");
    seen.push(await focusedLabel(page));
    if (seen[seen.length - 1] === "Rimetti da fare: Pagare la mensa") break;
  }
  expect(seen).toContain("Rimetti da fare: Pagare la mensa");

  const expected = [
    ...(mobile ? ["Spesa", "Da fare", "Scadenze"] : []),
    "Tutti",
    "Miei",
    "Laura",
    "Sofia",
    "Tommaso",
    ...(mobile ? [] : ["Aggiungi una cosa da fare…"]),
    // «Questa settimana»: overdue first, then by date
    "Segna come fatto: Restituire alla biblioteca i libri di Sofia e Tommaso prima della chiusura del prestito",
    "Segna come fatto: Chiamare il commercialista",
    "Segna come fatto: Comprare la cuffia da nuoto",
    "Segna come fatto: Firmare autorizzazione gita",
    "Segna come fatto: Regalo per la festa di Giulia",
    // «Più avanti»
    "Segna come fatto: Comprare le lampadine della cantina",
    "Segna come fatto: Rinnovare l'abbonamento del bus",
    "Segna come fatto: Sistemare la cantina",
    // «Fatti»
    "Rimetti da fare: Pagare la mensa",
  ];
  // The expected controls come in this order (others, like the Spesa column
  // on desktop, may sit between them).
  const positions = expected.map((label) => seen.indexOf(label));
  expect(
    positions.every((p) => p >= 0),
    JSON.stringify({ seen, positions }),
  ).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));

  // Nothing traps the focus: Shift+Tab walks back out.
  await page.keyboard.press("Shift+Tab");
  expect(await focusedLabel(page)).not.toBe("Rimetti da fare: Pagare la mensa");
});

test("anello di focus visibile su casella, chip, voce del selettore e campo", async ({
  page,
}, testInfo) => {
  await open(page, { todos: NORMAL_TODOS });
  const ring = (el: Element) => {
    const cs = getComputedStyle(el);
    return {
      outline: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0,
      shadow: cs.boxShadow !== "none",
    };
  };
  const targets = [
    page.getByRole("checkbox", {
      name: "Segna come fatto: Comprare la cuffia da nuoto",
    }),
    page.getByRole("button", { name: "Laura" }),
  ];
  if (isMobile(testInfo.project.name)) {
    targets.push(page.getByRole("button", { name: /^Da fare/ }));
  }
  await page.keyboard.press("Tab"); // make :focus-visible apply
  for (const target of targets) {
    // A key press first, so the focus counts as coming from the keyboard.
    await page.keyboard.press("Tab");
    await target.focus();
    await expect(target).toBeFocused();
    const r = await target.evaluate(ring);
    expect(r.outline || r.shadow).toBe(true);
  }
  if (!isMobile(testInfo.project.name)) {
    // The quick field has no outline of its own: the ring is on its container.
    await page
      .getByRole("textbox", { name: "Aggiungi una cosa da fare…" })
      .focus();
    const shadow = await page
      .locator('form.campo-rapido[aria-label="Aggiungi una cosa da fare…"]')
      .evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow).toContain("23, 24, 28");
  }
});

test("il primo chip non perde l'anello di focus (non tagliato)", async ({
  page,
}, testInfo) => {
  test.skip(!isMobile(testInfo.project.name), "la fila scorre solo su mobile");
  await open(page, { todos: NORMAL_TODOS });
  const chip = page.getByRole("button", { name: "Tutti" });
  await page.keyboard.press("Tab");
  await chip.focus();
  await expect(chip).toBeFocused();
  const [chipBox, rowBox] = await Promise.all([
    chip.boundingBox(),
    page
      .getByRole("group", { name: "Filtra per persona" })
      .filter({ visible: true })
      .boundingBox(),
  ]);
  // The ring (about 3.5 px) must have room inside the scrolling row.
  expect(chipBox!.x - rowBox!.x).toBeGreaterThanOrEqual(3.5);
  expect(chipBox!.y - rowBox!.y).toBeGreaterThanOrEqual(3.5);
});

// --- keyboard use ------------------------------------------------------------

test("tastiera: Spazio spunta e Annulla da tastiera rimette la riga", async ({
  page,
}) => {
  await open(page, { todos: NORMAL_TODOS });
  const box = page.getByRole("checkbox", {
    name: "Segna come fatto: Comprare la cuffia da nuoto",
  });
  await box.focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("checkbox", {
      name: "Rimetti da fare: Comprare la cuffia da nuoto",
    }),
  ).toHaveAttribute("aria-checked", "true");
  const undo = page.getByRole("button", { name: "Annulla" });
  await expect(undo).toBeVisible();
  await undo.focus();
  await page.keyboard.press("Enter");
  const back = page.getByRole("checkbox", {
    name: "Segna come fatto: Comprare la cuffia da nuoto",
  });
  await expect(back).toHaveAttribute("aria-checked", "false");
  // The focus goes back to the box of the same row (spec 3.5).
  await expect(back).toBeFocused();
});

test("tastiera: i chip si scelgono con Invio e annunciano il risultato", async ({
  page,
}) => {
  await open(page, { todos: NORMAL_TODOS });
  const chip = page.getByRole("button", { name: "Laura" });
  await chip.focus();
  await page.keyboard.press("Enter");
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(chip).toBeFocused();
  await expect(page.getByText("3 da fare per Laura")).toBeAttached();
});

test("tastiera: il campo rapido aggiunge con Invio e tiene il fuoco (desktop)", async ({
  page,
}, testInfo) => {
  test.skip(isMobile(testInfo.project.name), "il campo c'è solo da 1024 px");
  await open(page, { todos: NORMAL_TODOS });
  const field = page.getByRole("textbox", {
    name: "Aggiungi una cosa da fare…",
  });
  await field.fill("Cambiare le lampadine");
  await field.press("Enter");
  await expect(
    page.getByRole("checkbox", {
      name: "Segna come fatto: Cambiare le lampadine",
    }),
  ).toBeVisible();
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("");
});

// --- semantics ---------------------------------------------------------------

test("semantica: un h1, h2 della colonna, gruppi h3, caselle con nome", async ({
  page,
}, testInfo) => {
  await open(page, { todos: NORMAL_TODOS });
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  if (!isMobile(testInfo.project.name)) {
    await expect(
      page.getByRole("heading", { level: 2, name: "Da fare" }),
    ).toBeVisible();
  }
  for (const name of ["Questa settimana", "Più avanti", "Fatti"]) {
    await expect(page.getByRole("heading", { level: 3, name })).toBeVisible();
  }
  // Who takes care of it is readable (the avatar is hidden).
  await expect(page.getByTestId("da-fare-riga").first()).toContainText(
    "se ne occupa",
  );
  // The lock of the «Solo io» thing is there, hidden from screen readers.
  await expect(page.getByTestId("lucchetto")).toHaveCount(1);
  await expect(page.getByTestId("lucchetto")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});

test("movimento ridotto: gli scheletri del caricamento restano fermi", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, { todos: NORMAL_TODOS, reads: "slow" }, false);
  const skeleton = page.locator(".skeleton").first();
  await expect(skeleton).toBeAttached();
  const name = await skeleton.evaluate(
    (el) => getComputedStyle(el).animationName,
  );
  expect(name).toBe("none");
});
