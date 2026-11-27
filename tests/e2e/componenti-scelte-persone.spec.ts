import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { waitForAnimationsToEnd } from "../fixtures/animations";
import { waitHydrated } from "../fixtures/esplora";

// #504 (F4b): choices and people components, on the design-system gallery
// (no data, no login). Examples and data: docs/specifiche/504 §6. Colours are
// compared as the browser computes them from the token itself, so the tests
// hold in the light and in the dark theme.

const tid = (page: Page, id: string) => page.getByTestId(id);

test.beforeEach(async ({ page }) => {
  await page.goto("/design-system");
  await waitHydrated(tid(page, "ds-scelte-schede"));
});

function css(locator: Locator, property: string, pseudo?: string) {
  return locator.evaluate(
    (el, [prop, pse]) =>
      getComputedStyle(el, pse || null).getPropertyValue(prop as string),
    [property, pseudo ?? ""],
  );
}

/** Computed colour of an expression (`var(--color-pieno)`), seen from an element. */
function resolve(locator: Locator, expression: string, property = "color") {
  return locator.evaluate(
    (el, [expr, prop]) => {
      const probe = document.createElement("span");
      probe.style.setProperty(prop as string, expr as string);
      el.appendChild(probe);
      const value = getComputedStyle(probe).getPropertyValue(prop as string);
      probe.remove();
      return value;
    },
    [expression, property],
  );
}

const radios = (group: Locator) => group.getByRole("radio");

// ------------------------------------------------------------ A and B

test.describe("Scelte a schede e a tessere", () => {
  test("CA-1: il gruppo ha nome, due schede e solo la seconda è scelta", async ({
    page,
  }) => {
    const group = tid(page, "ds-scelte-schede");
    await expect(group).toHaveAttribute("role", "radiogroup");
    await expect(group).toHaveAccessibleName("Chi vive con te?");
    await expect(radios(group)).toHaveCount(2);
    await expect(radios(group).nth(0)).toHaveAccessibleName(/^In coppia/);
    await expect(radios(group).nth(1)).toHaveAccessibleName(
      /^In famiglia, con figli/,
    );
    await expect(radios(group).nth(0)).toHaveAttribute("aria-checked", "false");
    await expect(radios(group).nth(1)).toHaveAttribute("aria-checked", "true");
  });

  test("CA-2: il clic sceglie «In coppia»", async ({ page }) => {
    const group = tid(page, "ds-scelte-schede");
    await radios(group).nth(0).click();
    await expect(radios(group).nth(0)).toHaveAttribute("aria-checked", "true");
    await expect(radios(group).nth(1)).toHaveAttribute("aria-checked", "false");
  });

  test("CA-3: le frecce spostano fuoco e scelta, in giro; Tab porta fuori", async ({
    page,
  }) => {
    const group = tid(page, "ds-scelte-schede");
    await radios(group).nth(1).focus();
    await page.keyboard.press("ArrowDown");
    await expect(radios(group).nth(0)).toBeFocused();
    await expect(radios(group).nth(0)).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("ArrowDown");
    await expect(radios(group).nth(1)).toBeFocused();
    await expect(radios(group).nth(1)).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("ArrowUp");
    await expect(radios(group).nth(0)).toBeFocused();
    // One tab stop only: the other card is out of the sequence.
    await expect(radios(group).nth(1)).toHaveAttribute("tabindex", "-1");
    await page.keyboard.press("Tab");
    await expect(radios(group).nth(0)).not.toBeFocused();
    await expect(radios(group).nth(1)).not.toBeFocused();
  });

  test("CA-4: scheda scelta e non scelta, bordo, fondo e spunta", async ({
    page,
  }) => {
    const group = tid(page, "ds-scelte-schede");
    const chosen = radios(group).nth(1);
    const other = radios(group).nth(0);
    await page.mouse.move(0, 0);
    // The browser snaps a border to whole device pixels: the expected width is
    // read from a solid border drawn with the same token.
    const medium = await chosen.evaluate((el) => {
      const probe = document.createElement("span");
      probe.style.border = "var(--border-medio) solid";
      el.appendChild(probe);
      const width = getComputedStyle(probe).borderTopWidth;
      probe.remove();
      return width;
    });
    expect(await css(chosen, "border-top-width")).toBe(medium);
    expect(await css(chosen, "border-top-color")).toBe(
      await resolve(chosen, "var(--color-inchiostro)"),
    );
    expect(await css(chosen, "background-color")).toBe(
      await resolve(chosen, "var(--color-scelta-tenue)", "background-color"),
    );
    const tick = chosen.locator(".scelta__radio");
    await expect(tick).toBeVisible();
    expect(await css(tick, "background-color")).toBe(
      await resolve(tick, "var(--color-pieno)", "background-color"),
    );
    expect(await css(tick, "border-top-left-radius")).not.toBe("0px");

    expect(await css(other, "border-top-width")).toBe("1px");
    expect(await css(other, "border-top-color")).toBe(
      await resolve(other, "var(--color-filo-2)"),
    );
    expect(await css(other, "background-color")).toBe(
      await resolve(other, "var(--color-superficie)", "background-color"),
    );
    await expect(other.locator(".scelta__radio")).toBeHidden();
  });

  test("CA-5: errore, aria-invalid, testo con segno, nessuna scelta", async ({
    page,
  }) => {
    const group = tid(page, "ds-scelte-schede-errore");
    await expect(group).toHaveAttribute("aria-invalid", "true");
    const describedBy = await group.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const text = page.locator(`[id="${describedBy}"]`);
    await expect(text).toHaveText("Scegli una risposta.");
    await expect(text.locator("svg")).toHaveCount(1);
    await expect(group.locator('[aria-checked="true"]')).toHaveCount(0);
  });

  test("CA-6: quattro tessere in due colonne, stessi comportamenti, spunta in alto a destra", async ({
    page,
  }) => {
    const group = tid(page, "ds-scelte-tessere");
    await expect(group).toHaveAccessibleName("Con chi vivi?");
    await expect(radios(group)).toHaveCount(4);
    const tops = await radios(group).evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.getBoundingClientRect().top)),
    );
    expect(tops[0]).toBe(tops[1]);
    expect(tops[2]).toBe(tops[3]);
    expect(tops[2]).toBeGreaterThan(tops[0]!);
    const chosen = radios(group).nth(1);
    await expect(chosen).toHaveAttribute("aria-checked", "true");
    const box = (await chosen.boundingBox())!;
    const tick = (await chosen.locator(".scelta__radio").boundingBox())!;
    expect(tick.x + tick.width).toBeGreaterThan(box.x + box.width / 2);
    expect(tick.y).toBeLessThan(box.y + box.height / 2);
    await radios(group).nth(2).click();
    await expect(radios(group).nth(2)).toHaveAttribute("aria-checked", "true");
    await expect(chosen).toHaveAttribute("aria-checked", "false");
    await page.keyboard.press("ArrowRight");
    await expect(radios(group).nth(3)).toBeFocused();
  });
});

// ------------------------------------------------- pills, people, days, filters

test.describe("Pastiglie, persone, giorni e filtri", () => {
  test("CA-7: pastiglie alte 40, a capsula, con area di tocco 44", async ({
    page,
  }) => {
    const chips = tid(page, "ds-pastiglie").getByRole("button");
    await expect(chips).toHaveCount(4);
    for (let i = 0; i < 4; i += 1) {
      const chip = chips.nth(i);
      const box = (await chip.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(40 - 0.5);
      expect(await css(chip, "border-top-left-radius")).toBe(
        await resolve(chip, "var(--radius-capsula)", "border-radius"),
      );
      // The 44 px area, with elementFromPoint above and below the chip
      // (the chip must be inside the window for the point to be hit).
      await chip.scrollIntoViewIfNeeded();
      const hit = await chip.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const points = [
          [cx, r.top + r.height / 2 - 21],
          [cx, r.top + r.height / 2 + 21],
        ];
        return points.map(([x, y]) => {
          const found = document.elementFromPoint(x!, y!);
          return found === el || el.contains(found);
        });
      });
      expect(hit).toEqual([true, true]);
    }
    await page.mouse.move(0, 0);
    const chosen = chips.nth(0);
    await expect(chosen).toHaveAttribute("aria-pressed", "true");
    expect(await css(chosen, "background-color")).toBe(
      await resolve(chosen, "var(--color-pieno)", "background-color"),
    );
    expect(await css(chosen, "color")).toBe(
      await resolve(chosen, "var(--color-latte)"),
    );
    const other = chips.nth(1);
    expect(await css(other, "background-color")).toBe(
      await resolve(other, "var(--color-superficie)", "background-color"),
    );
    expect(await css(other, "border-top-color")).toBe(
      await resolve(other, "var(--color-filo-2)"),
    );
    expect(await css(other, "color")).toBe(
      await resolve(other, "var(--color-inchiostro)"),
    );
  });

  test("CA-8: pastiglia della persona scelta, pallino, iniziale e anello", async ({
    page,
  }) => {
    const sofia = tid(page, "ds-pastiglie-persone").getByRole("button", {
      name: "Sofia",
      exact: true,
    });
    await expect(sofia).toHaveAttribute("aria-pressed", "true");
    const dot = sofia.locator(".avatar");
    expect(await css(dot, "background-color")).toBe(
      await resolve(dot, "var(--color-membro-menta)", "background-color"),
    );
    expect(await css(dot, "color")).toBe(
      await resolve(dot, "var(--color-inchiostro)"),
    );
    expect(await css(dot, "box-shadow")).toContain(
      await resolve(dot, "var(--color-latte)"),
    );
  });

  test("CA-9: «Per chi», pallini da 36 con area 44, scelto e non scelto", async ({
    page,
  }) => {
    const group = tid(page, "ds-per-chi");
    const buttons = group.getByRole("button");
    await expect(buttons).toHaveCount(6);
    await expect(group.getByRole("button", { name: "Laura" })).toBeVisible();
    const tommaso = group.getByRole("button", {
      name: "Tommaso",
      exact: true,
    });
    const laura = group.getByRole("button", { name: "Laura", exact: true });
    for (const dot of [tommaso, laura]) {
      const box = (await dot.boundingBox())!;
      expect(Math.round(box.width)).toBe(36);
      expect(Math.round(box.height)).toBe(36);
      expect(await css(dot, "width", "::before")).toBe("44px");
    }
    await page.mouse.move(0, 0);
    await expect(tommaso).toHaveAttribute("aria-pressed", "true");
    expect(await css(tommaso, "background-color")).toBe(
      await resolve(tommaso, "var(--color-membro-blu)", "background-color"),
    );
    expect(await css(tommaso, "color")).toBe("rgb(255, 255, 255)");
    expect(await css(tommaso, "outline-color")).toBe(
      await resolve(tommaso, "var(--color-inchiostro)"),
    );
    expect(await css(tommaso, "outline-offset")).toBe("2px");
    await expect(laura).toHaveAttribute("aria-pressed", "false");
    expect(await css(laura, "background-color")).toBe(
      await resolve(laura, "var(--c-spento)", "background-color"),
    );
    expect(await css(laura, "color")).toBe(
      await resolve(laura, "var(--color-inchiostro)"),
    );
  });

  test("CA-10: Laura e Tommaso si scelgono insieme", async ({ page }) => {
    const group = tid(page, "ds-per-chi");
    await group.getByRole("button", { name: "Laura", exact: true }).click();
    await expect(
      group.getByRole("button", { name: "Laura", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      group.getByRole("button", { name: "Tommaso", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("CA-11: dieci persone vanno a capo su due righe e la fila non scorre", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "mobile", "solo a 390 px");
    const group = tid(page, "ds-per-chi-dieci");
    const metrics = await group.evaluate((el) => ({
      scroll: el.scrollWidth,
      client: el.clientWidth,
      rows: new Set(
        [...el.querySelectorAll("button")].map((b) =>
          Math.round(b.getBoundingClientRect().top),
        ),
      ).size,
    }));
    expect(metrics.scroll).toBe(metrics.client);
    expect(metrics.rows).toBe(2);
  });

  test("CA-12: il caricamento ha sei cerchi scheletro e il testo nascosto", async ({
    page,
  }) => {
    const group = tid(page, "ds-per-chi-caricamento");
    await expect(group).toHaveAttribute("aria-busy", "true");
    const circles = group.locator(".skeleton");
    await expect(circles).toHaveCount(6);
    const box = (await circles.first().boundingBox())!;
    expect(Math.round(box.width)).toBe(36);
    expect(Math.round(box.height)).toBe(36);
    await expect(group).toContainText("Caricamento in corso");
  });

  test("CA-13: sette giorni da 44, tondi, su una riga; Lun, Mer, Ven scelti", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "mobile", "solo a 390 px");
    const days = tid(page, "ds-giorni").getByRole("button");
    await expect(days).toHaveCount(7);
    const names = [
      "Lun, lunedì",
      "Mar, martedì",
      "Mer, mercoledì",
      "Gio, giovedì",
      "Ven, venerdì",
      "Sab, sabato",
      "Dom, domenica",
    ];
    const tops = new Set<number>();
    for (let i = 0; i < 7; i += 1) {
      const day = days.nth(i);
      await expect(day).toHaveAccessibleName(names[i]!);
      const box = (await day.boundingBox())!;
      expect(Math.round(box.width)).toBe(44);
      expect(Math.round(box.height)).toBe(44);
      tops.add(Math.round(box.y));
      expect(await css(day, "border-top-left-radius")).toBe(
        await resolve(day, "var(--radius-tondo)", "border-radius"),
      );
    }
    expect(tops.size).toBe(1);
    await page.mouse.move(0, 0);
    for (const index of [0, 2, 4]) {
      const day = days.nth(index);
      await expect(day).toHaveAttribute("aria-pressed", "true");
      expect(await css(day, "background-color")).toBe(
        await resolve(day, "var(--color-pieno)", "background-color"),
      );
      expect(await css(day, "color")).toBe(
        await resolve(day, "var(--color-latte)"),
      );
    }
  });

  test("CA-14 e CA-15: la fila dei filtri sfuma finché c'è altro, il fuoco entra in vista", async ({
    page,
  }, info) => {
    const row = tid(page, "ds-filtri");
    await row.scrollIntoViewIfNeeded();
    if (info.project.name === "desktop") {
      // Everything fits: no fade from the start.
      expect(await css(row, "mask-image")).toBe("none");
      return;
    }
    await expect.poll(() => css(row, "mask-image")).not.toBe("none");
    // Tab arrives on the last chip: it ends up whole inside the visible row.
    const last = row.getByRole("button", { name: /^Animali/ });
    await row.getByRole("button", { name: /^Tutto/ }).focus();
    for (let i = 0; i < 5; i += 1) await page.keyboard.press("Tab");
    await expect(last).toBeFocused();
    const inside = await page.evaluate(() => {
      const chip = document.activeElement as HTMLElement;
      const scroller = chip.parentElement as HTMLElement;
      const a = chip.getBoundingClientRect();
      const b = scroller.getBoundingClientRect();
      return a.left >= b.left - 1 && a.right <= b.right + 1;
    });
    expect(inside).toBe(true);
    // At the end of the row the fade is gone.
    await row.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await expect.poll(() => css(row, "mask-image")).toBe("none");
  });
});

// --------------------------------------------------------- tick, faces, stack

test.describe("Spunta, volti e pile", () => {
  test("CA-16: spunta neutra non fatta e fatta, titolo attenuato e non barrato", async ({
    page,
  }) => {
    const list = tid(page, "ds-spunta");
    const open = list.getByRole("checkbox", {
      name: "Segna come fatto: Cibo di Biscotto",
    });
    const done = list.getByRole("checkbox", {
      name: "Segna come fatto: Passeggiata del mattino",
    });
    await page.mouse.move(0, 0);
    const box = (await open.boundingBox())!;
    expect(Math.round(box.width)).toBe(24);
    expect(Math.round(box.height)).toBe(24);
    // 1.5 px, snapped by the browser to whole device pixels (1 px at 1x).
    expect(["1px", "1.5px"]).toContain(await css(open, "border-top-width"));
    expect(await css(open, "border-top-color")).toBe(
      await resolve(open, "var(--color-filo-campo)"),
    );
    expect(await css(open, "width", "::before")).toBe("44px");
    await expect(done).toHaveAttribute("aria-checked", "true");
    expect(await css(done, "background-color")).toBe(
      await resolve(done, "var(--color-pieno)", "background-color"),
    );
    expect(await css(done, "color")).toBe(
      await resolve(done, "var(--color-latte)"),
    );
    const title = list.getByText("Passeggiata del mattino", { exact: true });
    expect(await css(title, "color")).toBe(
      await resolve(title, "var(--color-inchiostro-2)"),
    );
    expect(await css(title, "text-decoration-line")).toBe("none");
    const row = list.locator("li").nth(1);
    expect(await css(row.locator(".avatar"), "opacity")).toBe("1");
  });

  test("CA-17: il clic sulla spunta la fa e il titolo non è barrato", async ({
    page,
  }) => {
    const list = tid(page, "ds-spunta");
    const food = list.getByRole("checkbox", {
      name: "Segna come fatto: Cibo di Biscotto",
    });
    await food.click();
    await expect(food).toHaveAttribute("aria-checked", "true");
    await page.mouse.move(0, 0);
    const title = list.getByText("Cibo di Biscotto", { exact: true });
    expect(await css(title, "text-decoration-line")).toBe("none");
  });

  test("CA-18, CA-19: volti in tre colonne, nomi, «Aggiungi» tratteggiato, tocco", async ({
    page,
  }, info) => {
    const faces = tid(page, "ds-volti");
    const buttons = faces.getByRole("button");
    await expect(buttons).toHaveCount(6);
    await expect(
      faces.getByRole("button", { name: /^Laura\s+Invito da mandare$/ }),
    ).toBeVisible();
    if (info.project.name === "mobile") {
      const lefts = await faces
        .locator("li")
        .evaluateAll((items) =>
          items.map((li) => Math.round(li.getBoundingClientRect().left)),
        );
      expect(new Set(lefts).size).toBe(3);
    }
    for (const avatar of await faces.locator(".avatar").all()) {
      const box = (await avatar.boundingBox())!;
      expect(Math.round(box.width)).toBe(72);
    }
    const add = faces.getByRole("button", { name: "Aggiungi", exact: true });
    const circle = add.locator(".volti__aggiungi");
    const box = (await circle.boundingBox())!;
    expect(Math.round(box.width)).toBe(72);
    expect(Math.round(box.height)).toBe(72);
    expect(await css(circle, "border-top-style")).toBe("dashed");
    expect(await css(circle, "border-top-color")).toBe(
      await resolve(circle, "var(--color-filo-2)"),
    );
    await faces.getByRole("button", { name: /^Sofia/ }).click();
    await expect(tid(page, "ds-volti-stato")).toHaveText("Hai toccato: Sofia");
  });

  test("CA-20: senza persone resta solo «Aggiungi»", async ({ page }) => {
    const faces = tid(page, "ds-volti-vuoto");
    await expect(faces.getByRole("button")).toHaveCount(1);
    await expect(faces.getByRole("button", { name: "Aggiungi" })).toBeVisible();
  });

  test("CA-21 e CA-25: pile, foto con filo, iniziale di riserva, due lettere dentro il pallino", async ({
    page,
  }) => {
    const four = tid(page, "ds-pila-quattro");
    await expect(four.locator(".pila-avatar")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    const dots = four.locator(".avatar");
    await expect(dots).toHaveCount(4);
    const boxes = await dots.evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return { left: r.left, width: r.width };
      }),
    );
    for (const box of boxes) expect(Math.round(box.width)).toBe(28);
    expect(Math.round(boxes[0]!.left + boxes[0]!.width - boxes[1]!.left)).toBe(
      8,
    );
    const six = tid(page, "ds-pila-sei").locator(".avatar");
    await expect(six).toHaveCount(5);
    await expect(six.last()).toHaveText("+2");

    const photo = tid(page, "ds-biscotto-foto").locator(".avatar");
    expect(await css(photo, "outline-color")).toBe(
      await resolve(photo, "var(--color-membro-ambra)"),
    );
    await expect(photo.locator("img")).toHaveCount(1);
    await expect(
      tid(page, "ds-biscotto-senza-foto").locator(".avatar"),
    ).toHaveText("B");

    for (const id of [
      "ds-miele-s",
      "ds-miele-m",
      "ds-miele-l",
      "ds-miele-xl",
    ]) {
      const dot = tid(page, id).locator(".avatar");
      await expect(dot).toHaveText("Mi");
      const fits = await dot.evaluate((el) => el.scrollWidth <= el.clientWidth);
      expect(fits, id).toBe(true);
    }
  });

  test("CA-26: l'aiutante è neutro con l'iniziale «A», e la scelta del colore non lo offre", async ({
    page,
  }) => {
    const dots = tid(page, "ds-aiutante").locator(".avatar");
    await expect(dots).toHaveCount(4);
    for (const dot of await dots.all()) {
      await expect(dot).toHaveText("A");
      expect(await css(dot, "background-color")).toBe(
        await resolve(dot, "var(--color-membro-neutro)", "background-color"),
      );
      expect(await css(dot, "color")).toBe(
        await resolve(dot, "var(--color-inchiostro)"),
      );
    }
    const choice = tid(page, "scelta-colore-dieci");
    await expect(choice.getByRole("radio")).toHaveCount(10);
  });
});

// ------------------------------------------------------------- tiles and tag

test.describe("Tessere ed etichetta", () => {
  test("CA-28: quattro tessere in due colonne, bordo e raggio, nome; da 900 px almeno 220", async ({
    page,
  }, info) => {
    const grid = tid(page, "ds-tessere-spazi");
    const links = grid.getByRole("link");
    await expect(links).toHaveCount(4);
    await expect(
      grid.getByRole("link", { name: /^Animali\s+Biscotto e Miele$/ }),
    ).toBeVisible();
    const first = links.first();
    expect(await css(first, "border-top-width")).toBe("1px");
    expect(await css(first, "border-top-color")).toBe(
      await resolve(first, "var(--color-filo-2)"),
    );
    expect(await css(first, "border-top-left-radius")).toBe(
      await resolve(first, "var(--radius-l)", "border-radius"),
    );
    const boxes = await links.evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return { top: Math.round(r.top), width: r.width };
      }),
    );
    if (info.project.name === "mobile") {
      expect(boxes[0]!.top).toBe(boxes[1]!.top);
      expect(boxes[2]!.top).toBe(boxes[3]!.top);
      expect(boxes[2]!.top).toBeGreaterThan(boxes[0]!.top);
    } else {
      for (const box of boxes) expect(box.width).toBeGreaterThanOrEqual(220);
    }
  });

  test("tessere del Nest: persone, tessera in attesa che non è un link", async ({
    page,
  }, info) => {
    const grid = tid(page, "ds-tessere-nest");
    await expect(grid.getByRole("link")).toHaveCount(4);
    await expect(
      grid.getByRole("link", { name: /^Laura\s+Adulta$/ }),
    ).toBeVisible();
    const pending = tid(page, "ds-tessera-attesa");
    await expect(pending).toContainText("Invito mandato ieri");
    await expect(pending.getByRole("link")).toHaveCount(0);
    expect(await css(pending, "border-top-style")).toBe("dashed");
    if (info.project.name === "desktop") {
      const tops = await grid
        .locator(".tessera")
        .evaluateAll((nodes) =>
          nodes.map((n) => Math.round(n.getBoundingClientRect().top)),
        );
      // Four per row at 1280: the first four share the row.
      expect(new Set(tops.slice(0, 4)).size).toBe(1);
    }
  });

  test("CA-29: «Da verificare» in rosso su rosso tenue, 600, alta 24", async ({
    page,
  }) => {
    const tag = tid(page, "ds-tag-allerta");
    await expect(tag).toHaveText("Da verificare");
    expect(await css(tag, "color")).toBe(
      await resolve(tag, "var(--color-allerta)"),
    );
    expect(await css(tag, "background-color")).toBe(
      await resolve(tag, "var(--color-allerta-fondo)", "background-color"),
    );
    expect(await css(tag, "font-weight")).toBe("600");
    expect((await tag.boundingBox())!.height).toBeGreaterThanOrEqual(24 - 0.5);
  });
});

// ---------------------------------------------------- dark theme, colours, text

test.describe("Tema scuro, colori e testo", () => {
  test("CA-30: nelle regole nuove nessun colore scritto a mano", () => {
    const css = readFileSync("src/app/components.css", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n");
    const start = css.findIndex(
      (line) =>
        line.includes("COMPONENTI 2.0 · SCELTE E PERSONE") ||
        line.includes(".scelta-campo {"),
    );
    expect(start).toBeGreaterThan(0);
    const forbidden =
      /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\b(white|black)\b/;
    const offenders = css.slice(start).filter((line) => forbidden.test(line));
    expect(offenders).toEqual([]);
    // The rules changed in place: no colour written by hand in the tick of the
    // choices, the pills, the round tick and the allerta tag either.
    const whole = css.join("\n");
    for (const selector of [
      ".scelta__radio::after",
      '.tondo-spunta[aria-checked="true"]',
      ".gruppo-chip--sfuma",
      ".etichetta--allerta",
    ]) {
      const at = whole.indexOf(selector);
      expect(at, selector).toBeGreaterThan(-1);
      const block = whole.slice(at, whole.indexOf("}", at));
      expect(forbidden.test(block), selector).toBe(false);
    }
  });

  test("CA-31: i componenti seguono i ruoli: con valori di prova mostrano quelli", async ({
    page,
  }) => {
    await page.addStyleTag({
      content: `:root:root {
        --color-inchiostro: rgb(16, 17, 18);
        --color-superficie: rgb(7, 8, 9);
        --color-pieno: rgb(1, 2, 3);
        --color-latte: rgb(4, 5, 6);
        --color-filo-2: rgb(10, 11, 12);
        --color-scelta-tenue: rgb(13, 14, 15);
        --color-membro-menta: rgb(19, 20, 21);
      }`,
    });
    await page.mouse.move(0, 0);
    // The fills change with a short transition: wait until it is over.
    await waitForAnimationsToEnd(page);
    const chip = tid(page, "ds-pastiglie").getByRole("button").first();
    expect(await css(chip, "background-color")).toBe("rgb(1, 2, 3)");
    expect(await css(chip, "color")).toBe("rgb(4, 5, 6)");
    const card = radios(tid(page, "ds-scelte-schede")).nth(1);
    expect(await css(card, "background-color")).toBe("rgb(13, 14, 15)");
    expect(await css(card, "border-top-color")).toBe("rgb(16, 17, 18)");
    expect(await css(card.locator(".scelta__radio"), "background-color")).toBe(
      "rgb(1, 2, 3)",
    );
    const done = tid(page, "ds-spunta").getByRole("checkbox", {
      name: "Segna come fatto: Passeggiata del mattino",
    });
    expect(await css(done, "background-color")).toBe("rgb(1, 2, 3)");
    const tile = tid(page, "ds-tessere-spazi").getByRole("link").first();
    expect(await css(tile, "background-color")).toBe("rgb(7, 8, 9)");
    expect(await css(tile, "border-top-color")).toBe("rgb(10, 11, 12)");
    const monday = tid(page, "ds-giorni").getByRole("button").first();
    expect(await css(monday, "background-color")).toBe("rgb(1, 2, 3)");
    const sofia = tid(page, "ds-pastiglie-persone")
      .getByRole("button", { name: "Sofia", exact: true })
      .locator(".avatar");
    expect(await css(sofia, "background-color")).toBe("rgb(19, 20, 21)");
    const laura = tid(page, "ds-per-chi").getByRole("button", {
      name: "Laura",
      exact: true,
    });
    expect(await css(laura, "background-color")).toBe(
      await resolve(laura, "var(--c-spento)", "background-color"),
    );
  });

  test("CA-i18n: l'etichetta «Giorni» di WeekdayPicker viene da choicesPeople.days", async ({
    page,
  }) => {
    const source = readFileSync(
      "src/components/ui/WeekdayPicker/WeekdayPicker.tsx",
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(source).toContain("it.choicesPeople.days");
    expect(source).not.toContain('"Giorni"');
    const messages = readFileSync("src/lib/i18n/messages/it.ts", "utf8");
    expect(messages).toMatch(/days:\s*"Giorni"/);
    // And the rendered group carries that label.
    await expect(
      tid(page, "ds-giorni").locator(".campo__etichetta"),
    ).toHaveText("Giorni");
    await expect(
      tid(page, "ds-giorni").locator(".scelta-giorni"),
    ).toHaveAccessibleName("Giorni");
  });

  test("CA-i18n: i testi dei componenti nuovi vengono da it.ts", () => {
    for (const file of [
      "src/components/ui/ChoiceGroup/ChoiceGroup.tsx",
      "src/components/ui/PersonPicker/PersonPicker.tsx",
      "src/components/ui/FaceGrid/FaceGrid.tsx",
      "src/components/ui/AvatarStack/AvatarStack.tsx",
      "src/components/ui/Tile/Tile.tsx",
      "src/components/ui/Chip/ChipScroll.tsx",
      "src/components/ui/WeekdayPicker/WeekdayPicker.tsx",
      "src/lib/member-initials.ts",
    ]) {
      const text = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      for (const literal of [
        "Aggiungi",
        "Caricamento in corso",
        "Scegli una risposta.",
        "Hai toccato:",
        "lunedì",
        "domenica",
      ]) {
        expect(text, `${file}: ${literal}`).not.toContain(`"${literal}`);
      }
    }
    const messages = readFileSync("src/lib/i18n/messages/it.ts", "utf8");
    for (const literal of [
      "Scegli una risposta.",
      "Hai toccato: {name}",
      "+{count}",
      "lunedì",
    ]) {
      expect(messages).toContain(literal);
    }
  });
});

test.describe("Testo al 200%", () => {
  test("CA-33: la pagina non scorre di lato, le pastiglie vanno a capo e i giorni sono a 4 colonne", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "mobile", "solo a 390 px");
    // Browser font size at 32 px (200%), set with CDP before the navigation.
    const session = await page.context().newCDPSession(page);
    await session.send("Page.setFontSizes", { fontSizes: { standard: 32 } });
    await page.goto("/design-system");
    await tid(page, "ds-giorni").scrollIntoViewIfNeeded();
    // The section of this PR must not push the page sideways. (Other sections
    // of the gallery are judged by their own tests: a line of filters that
    // scrolls is a scroll container on purpose and is not counted.)
    const wide = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>(
        "#scelte-persone *",
      )) {
        if (el.closest(".gruppo-chip--scorre")) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 1 && r.right > width + 1) {
          out.push(`${el.tagName}.${el.className} ${Math.round(r.right)}`);
        }
      }
      return out;
    });
    expect(wide).toEqual([]);
    const columns = await tid(page, "ds-giorni")
      .locator(".scelta-giorni")
      .evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
      );
    expect(columns).toBe(4);
    const rows = await tid(page, "ds-pastiglie")
      .getByRole("button")
      .evaluateAll(
        (nodes) =>
          new Set(nodes.map((n) => Math.round(n.getBoundingClientRect().top)))
            .size,
      );
    expect(rows).toBeGreaterThan(1);
  });
});

// The existing choice cards (profile, linked calendars) have the tick as the
// first child and an empty span last: the tick must go to the right, on the
// row of the title.
for (const width of [390, 1280]) {
  test(`schede di scelta esistenti: spunta a destra, sulla riga del titolo, a ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/design-system?pezzi-pagine=1");
    const disabled = tid(page, "scelta-direzione-disabilitata");
    await disabled.scrollIntoViewIfNeeded();
    await expect(disabled).toBeVisible();
    // Same markup as ChoiceSheets, CalendarSheet and TargetSheet.
    await page.evaluate(() => {
      const host = document.querySelector(
        "[data-testid='scelta-direzione-disabilitata']",
      )!.parentElement!;
      const card = document.createElement("button");
      card.className = "scelta";
      card.setAttribute("role", "radio");
      card.setAttribute("aria-checked", "true");
      card.dataset.testid = "scelta-copia";
      card.innerHTML =
        '<span class="scelta__radio" aria-hidden="true"></span><span><span class="scelta__titolo">Titolo</span><span class="scelta__info">Spiegazione</span></span><span></span>';
      host.appendChild(card);
    });
    for (const card of [disabled, tid(page, "scelta-copia")]) {
      const radio = await card.locator(".scelta__radio").boundingBox();
      const title = await card.locator(".scelta__titolo").boundingBox();
      expect(radio).not.toBeNull();
      expect(title).not.toBeNull();
      // Spec 504 §2: the tick is on the right, after the title...
      expect(radio!.x).toBeGreaterThanOrEqual(title!.x + title!.width);
      // ...and on the same row: the tick and the title overlap vertically.
      expect(title!.y).toBeLessThan(radio!.y + radio!.height);
      expect(radio!.y).toBeLessThan(title!.y + title!.height);
      // The tick is at the right edge of the card.
      const box = (await card.boundingBox())!;
      expect(radio!.x + radio!.width).toBeGreaterThan(box.x + box.width / 2);
    }
  });
}
