import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { hasTestUser, signInAs } from "../fixtures/visual-login";

// Accessibility of the corrections 6-13 of #43 (#67, PR #78), at 390 and
// 1280 px (the two projects): axe on every changed state, touch areas of 44 px
// without overlaps, "Vai al contenuto", aria-current, role="status" of the
// neutral notice, narrow screens of the bar.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

async function expectNoBlocking(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
}

type Hit = { label: string; ok: boolean; w: number; h: number };

// Every visible link, button or role control of the page (except the inline
// legal links and the skip link): if it is lower than 44 px the points
// (cx, cy +- 21) belong to it; if it is narrower, the points (cx +- 21, cy).
async function touchAreaReport(page: Page): Promise<Hit[]> {
  return page.evaluate(() => {
    const sel =
      'a[href], button, [role="checkbox"], [role="switch"], [role="radio"]';
    const out: { label: string; ok: boolean; w: number; h: number }[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      if (el.closest(".legale") || el.classList.contains("vai-al-contenuto"))
        continue;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (
        r.width < 2 ||
        r.height < 2 ||
        s.visibility === "hidden" ||
        s.display === "none"
      )
        continue;
      if (r.bottom < 0 || r.top > window.innerHeight) continue;
      // Links inside a sentence are exempt (WCAG 2.5.5 "in line").
      if (
        el.tagName === "A" &&
        el.parentElement &&
        el.parentElement.tagName === "P" &&
        el.closest("p")?.textContent !== el.textContent
      )
        continue;
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      const hit = (x: number, y: number) => {
        const t = document.elementFromPoint(x, y);
        return !!t && el.contains(t);
      };
      let ok = true;
      // The week arrows of /calendario sit side by side: their 44 px areas (the
      // ::before) overlap in the middle, so only the outer edge is checked.
      const arrow = /^Settimana (precedente|successiva)$/.exec(
        el.getAttribute("aria-label") ?? "",
      );
      if (arrow) {
        const outer = arrow[1] === "precedente" ? cx - 21.5 : cx + 21.5;
        ok = hit(cx, cy - 21.5) && hit(cx, cy + 21.5) && hit(outer, cy);
      } else {
        if (r.height < 44) ok = ok && hit(cx, cy - 21) && hit(cx, cy + 21);
        if (r.width < 44) ok = ok && hit(cx - 21, cy) && hit(cx + 21, cy);
      }
      out.push({
        label: `${el.tagName.toLowerCase()}.${el.className} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}"`,
        ok,
        w: Math.round(r.width),
        h: Math.round(r.height),
      });
    }
    return out;
  });
}

test.describe("senza accesso", () => {
  test.beforeEach(async ({ page }) => {
    // The stickers fade in: axe must not read half-transparent colors.
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("accesso annullato: avviso neutro con role=status, senza allarme, axe e contrasto", async ({
    page,
  }) => {
    await page.goto("/accesso?errore=google&annullato=1");
    const notice = page.locator(".avviso--info:visible");
    await expect(notice).toHaveAttribute("role", "status");
    await expect(notice).toContainText(
      "Accesso con Google annullato. Riprova o scegli un altro modo per entrare.",
    );
    await expect(notice).toBeFocused();
    await expect(
      page.getByRole("alert").filter({ hasText: "Accesso" }),
    ).toHaveCount(0);
    await expect(page.locator(".avviso--errore")).toHaveCount(0);
    await expectNoBlocking(page);

    // Text contrast of the notice against its own background: at least 4.5:1.
    const ratio = await notice.evaluate((el) => {
      const lum = (rgb: string) => {
        const [r, g, b] = (rgb.match(/[\d.]+/g) ?? []).map(Number) as [
          number,
          number,
          number,
        ];
        const f = (v: number) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const text = el.querySelector<HTMLElement>(".avviso__testo") ?? el;
      const fg = lum(getComputedStyle(text).color);
      let node: Element | null = el;
      let bg = "rgba(0, 0, 0, 0)";
      while (node) {
        bg = getComputedStyle(node).backgroundColor;
        if (!bg.endsWith(", 0)") && bg !== "transparent") break;
        node = node.parentElement;
      }
      const bl = lum(bg);
      const [hi, lo] = fg > bl ? [fg, bl] : [bl, fg];
      return (hi + 0.05) / (lo + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  test("accesso annullato con Apple: avviso neutro con role=status", async ({
    page,
  }) => {
    await page.goto("/accesso?errore=apple&annullato=1");
    const notice = page.locator(".avviso--info:visible");
    await expect(notice).toHaveAttribute("role", "status");
    await expect(notice).toContainText("Accesso con Apple annullato.");
    await expect(
      page.getByRole("alert").filter({ hasText: "Accesso" }),
    ).toHaveCount(0);
  });

  test("gli errori veri restano allarmi (role=alert, rosso)", async ({
    page,
  }) => {
    await page.goto("/accesso?errore=google");
    const alert = page.locator(".avviso--errore:visible");
    await expect(alert).toHaveAttribute("role", "alert");
    await expect(page.locator(".avviso--info")).toHaveCount(0);
  });

  test("accesso: quattro adesivi decorativi, nascosti al lettore di schermo", async ({
    page,
  }) => {
    await page.goto("/accesso");
    const stickers = page.locator(".adesivi:visible");
    await expect(stickers).toHaveAttribute("aria-hidden", "true");
    await expect(stickers.locator(".adesivo")).toHaveCount(4);
    await expect(stickers.locator(".adesivo").nth(3)).toContainText("Calcetto");
    await expect(stickers.locator(".adesivo").nth(3)).toContainText(
      "sab 10:00",
    );
    await expectNoBlocking(page);
  });

  for (const route of [
    "/accesso",
    "/accesso/mail",
    "/accesso/link-scaduto",
    "/termini",
  ]) {
    test(`${route}: nessun «Vai al contenuto» e aree di tocco di 44 px`, async ({
      page,
    }) => {
      await page.goto(route);
      await expect(page.locator("h1:visible")).toHaveCount(1);
      await expect(
        page.getByRole("link", { name: "Vai al contenuto" }),
      ).toHaveCount(0);
      const report = await touchAreaReport(page);
      expect(report.filter((h) => !h.ok)).toEqual([]);
    });
  }

  test("/design-system: errore con uscita, axe e aree di tocco", async ({
    page,
  }) => {
    await page.goto("/design-system");
    const box = page.getByTestId("errore-pagina-con-uscita");
    await box.scrollIntoViewIfNeeded();
    await expect(box).toHaveAttribute("role", "alert");
    const children = box.getByRole("button").or(box.getByRole("link"));
    await expect(children).toHaveCount(2);
    await expect(box.getByRole("button", { name: "Riprova" })).toBeVisible();
    const exit = box.getByRole("link", { name: "Torna a Oggi" });
    await expect(exit).toHaveAttribute("href", "/oggi");
    // Order: "Riprova" first, then the link, which sits below the button.
    const b1 = await box.getByRole("button", { name: "Riprova" }).boundingBox();
    const b2 = await exit.boundingBox();
    expect(b2!.y).toBeGreaterThan(b1!.y + b1!.height);
    // Touch area of the small button and of the standalone link.
    for (const loc of [box.getByRole("button", { name: "Riprova" }), exit]) {
      const ok = await loc.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        const hit = (x: number, y: number) =>
          el.contains(document.elementFromPoint(x, y));
        return hit(cx, cy - 21) && hit(cx, cy + 21);
      });
      expect(ok).toBe(true);
    }
    await expectNoBlocking(page);
  });
});

test.describe("con l'utente A", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
    const signedIn = await signInAs(context, baseURL!, "A");
    test.skip(!signedIn, "utente di test A non ancora creato (#55)");
  });

  test("«Vai al contenuto»: nascosto, primo con Tab, visibile con il fuoco, porta al main", async ({
    page,
  }, testInfo) => {
    // /calendario: its <main> has a link inside, so "the next Tab" has a target on both widths.
    await page.goto("/calendario");
    await expect(page.getByRole("main")).toBeVisible();
    const link = page.getByRole("link", { name: "Vai al contenuto" });
    await expect(link).toHaveCount(1);
    // Hidden before the focus: at most 1 x 1 px.
    const hidden = await link.boundingBox();
    expect(hidden!.width).toBeLessThanOrEqual(1);
    expect(hidden!.height).toBeLessThanOrEqual(1);

    await page.keyboard.press("Tab");
    await expect(link).toBeFocused();
    const box = await link.boundingBox();
    const vp = page.viewportSize()!;
    expect(box!.height).toBeGreaterThanOrEqual(40);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width);
    // Visible focus ring, and axe is happy with the link focused.
    const ring = await link.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        style: s.outlineStyle,
        width: parseFloat(s.outlineWidth),
        shadow: s.boxShadow,
      };
    });
    expect(
      (ring.style !== "none" && ring.width > 0) || ring.shadow !== "none",
    ).toBe(true);
    await expectNoBlocking(page);

    // The focus goes on <main>, the URL gets no query, the next Tab goes into the main.
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
    const url = new URL(page.url());
    expect(url.pathname).toBe("/calendario");
    expect(url.search).toBe("");
    await page.keyboard.press("Tab");
    const insideMain = await page.evaluate(
      () => !!document.activeElement?.closest("main"),
    );
    expect(insideMain).toBe(true);
    // Once the focus is gone the link disappears again.
    await expect(link).not.toBeFocused();
    const after = await link.boundingBox();
    expect(after!.width).toBeLessThanOrEqual(1);
    testInfo.annotations.push({
      type: "project",
      description: testInfo.project.name,
    });
  });

  test("«Vai al contenuto» è il primo elemento con Tab e c'è un solo main in ogni pagina", async ({
    page,
  }) => {
    for (const route of [
      "/oggi",
      "/calendario",
      "/casa/spesa",
      "/notifiche",
      "/nest",
      "/profilo",
      "/oggi/pagina-che-non-esiste",
    ]) {
      await page.goto(route);
      await expect(page.locator("main")).toHaveCount(1);
      await expect(
        page.getByRole("link", { name: "Vai al contenuto" }),
      ).toHaveCount(1);
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("link", { name: "Vai al contenuto" }),
      ).toBeFocused();
      await page.evaluate(() => (document.activeElement as HTMLElement).blur());
    }
  });

  for (const route of ["/oggi", "/calendario", "/casa/spesa", "/nest"]) {
    test(`${route}: axe senza e con il fuoco su «Vai al contenuto»`, async ({
      page,
    }) => {
      await page.goto(route);
      await expect(page.getByRole("main")).toBeVisible();
      await expectNoBlocking(page);
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("link", { name: "Vai al contenuto" }),
      ).toBeFocused();
      await expectNoBlocking(page);
    });
  }

  for (const route of [
    "/oggi",
    "/calendario",
    "/casa/spesa",
    "/notifiche",
    "/nest",
    "/profilo",
    "/oggi/pagina-che-non-esiste",
  ]) {
    test(`${route}: ogni controllo ha 44 px di area di tocco`, async ({
      page,
    }, testInfo) => {
      // Touch areas are a phone rule (CA-6, 390 px); the desktop bar is for the mouse.
      test.skip(testInfo.project.name !== "mobile", "solo mobile");
      await page.goto(route);
      await expect(page.getByRole("main")).toBeVisible();
      const report = await touchAreaReport(page);
      expect(report.length).toBeGreaterThan(0);
      expect(report.filter((h) => !h.ok)).toEqual([]);
    });
  }

  test("l'aspetto dei controlli non cambia: icone e quadrato restano 40 px", async ({
    page,
  }) => {
    await page.goto("/oggi");
    await expect(page.getByRole("main")).toBeVisible();
    const sizes = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          ".barra .btn-icona:not(.btn-icona--carta), .barra .quadrato-nest, .nav-alto .btn-icona, .nav-alto .quadrato-nest",
        ),
      )
        .filter((el) => el.getBoundingClientRect().width > 0)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return [Math.round(r.width), Math.round(r.height)];
        }),
    );
    expect(sizes.length).toBeGreaterThan(0);
    for (const [w, h] of sizes) {
      expect(w).toBe(40);
      expect(h).toBe(40);
    }
  });

  test("desktop: le aree di Cerca e Notifiche non si sovrappongono", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "solo desktop");
    await page.goto("/oggi");
    const search = page.getByRole("link", { name: /Cerca nel Nest/ });
    const bell = page.getByRole("link", { name: "Notifiche" });
    const add = page.getByRole("link", { name: "Aggiungi", exact: true });
    const a = await search.boundingBox();
    const b = await bell.boundingBox();
    const c = await add.boundingBox();
    expect(a && b && c).toBeTruthy();
    // Midway between two neighbours belongs to neither.
    for (const [left, right, label] of [
      [a!, b!, "Cerca/Notifiche"],
      [c!, a!, "Aggiungi/Cerca"],
    ] as const) {
      const mx = (left.x + left.width + right.x) / 2;
      const my = left.y + left.height / 2;
      const owner = await page.evaluate(
        ([x, y]) => {
          const t = document.elementFromPoint(x as number, y as number);
          return t?.closest("a, button")?.getAttribute("aria-label") ?? "";
        },
        [mx, my],
      );
      expect(owner, label).toBe("");
    }
  });

  test("desktop: ordine del focus con «Aggiungi» e «Vai al contenuto»", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "solo desktop");
    await page.goto("/casa/spesa");
    await expect(page.getByRole("main")).toBeVisible();
    const order = [
      "Vai al contenuto",
      "FamilyNest",
      "Oggi",
      "Calendario",
      "Casa",
      "Aggiungi",
      "Cerca nel Nest",
      "Notifiche",
      "Apri Casa D'Angelo",
    ];
    for (const name of order) {
      await page.keyboard.press("Tab");
      const label = await page.evaluate(
        () =>
          document.activeElement?.getAttribute("aria-label") ??
          document.activeElement?.textContent?.trim() ??
          "",
      );
      expect(
        label.startsWith(name),
        `atteso «${name}», trovato «${label}»`,
      ).toBe(true);
    }
    // «Aggiungi» never carries aria-current, not even on /aggiungi.
    await page.goto("/aggiungi");
    await expect(
      page.getByRole("link", { name: "Aggiungi", exact: true }),
    ).not.toHaveAttribute("aria-current", /.*/);
  });

  test("aria-current: «page» solo sull'indirizzo esatto, «true» altrove, al massimo una voce", async ({
    page,
  }, testInfo) => {
    const mobile = testInfo.project.name === "mobile";
    const nav = () =>
      page.getByRole("navigation", { name: "Navigazione principale" }).first();
    const current = async () =>
      nav().evaluate((n) =>
        Array.from(n.querySelectorAll("[aria-current]")).map((e) => [
          e.textContent?.trim() ?? "",
          e.getAttribute("aria-current"),
        ]),
      );
    for (const [route, label] of [
      ["/oggi", "Oggi"],
      ["/calendario", "Calendario"],
      ["/casa/spesa", "Casa"],
    ] as const) {
      await page.goto(route);
      await expect(page.getByRole("main")).toBeVisible();
      const cur = await current();
      expect(cur).toHaveLength(1);
      expect(cur[0]![0]).toContain(label);
      expect(cur[0]![1]).toBe("page");
    }
    const notPage = mobile
      ? ["/aggiungi", "/notifiche"]
      : ["/aggiungi", "/ricerca"];
    for (const route of notPage) {
      await page.goto(route);
      await expect(page.getByRole("main")).toBeVisible();
      const cur = await current();
      expect(cur).toHaveLength(1);
      expect(cur[0]![0]).toContain("Oggi");
      expect(cur[0]![1]).toBe("true");
      // Same look as the page version: the item carries the active class.
      await expect(nav().locator(".is-attiva")).toHaveCount(1);
    }
    if (!mobile) {
      for (const route of ["/nest", "/notifiche", "/profilo", "/membri"]) {
        await page.goto(route);
        await expect(page.getByRole("main")).toBeVisible();
        expect(await current()).toHaveLength(0);
      }
    }
  });

  test("barra mobile di Calendario e Casa: azioni in ordine, senza sovrapposizioni né scorrimento", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "solo mobile");
    for (const route of ["/calendario", "/casa/spesa", "/oggi"]) {
      await page.goto(route);
      await expect(page.getByRole("main")).toBeVisible();
      const names = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll<HTMLElement>(
            ".barra a, .barra button, .barra h1",
          ),
        )
          .filter((e) => e.getBoundingClientRect().width > 0)
          .map(
            (e) => e.getAttribute("aria-label") ?? e.textContent?.trim() ?? "",
          ),
      );
      const bell = names.indexOf("Notifiche");
      expect(bell, route).toBeGreaterThan(0);
      if (route !== "/oggi") {
        expect(names.indexOf("Cerca nel Nest")).toBe(bell - 1);
      }
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
        `scorrimento orizzontale su ${route}`,
      ).toBe(true);
    }
  });

  for (const width of [320, 340, 360, 375, 390]) {
    test(`barra di Calendario e Casa a ${width} px: dentro lo schermo, senza sovrapposizioni`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "mobile", "solo mobile");
      await page.setViewportSize({ width, height: 844 });
      for (const route of ["/calendario", "/casa/spesa"]) {
        await page.goto(route);
        await expect(page.getByRole("main")).toBeVisible();
        const rects = await page.evaluate(() => {
          const sel = [
            ".barra .quadrato-nest",
            ".barra h1",
            ".barra .lente",
            ".barra a[href='/ricerca']",
            ".barra a[href='/notifiche']",
          ];
          return sel.flatMap((s) =>
            Array.from(document.querySelectorAll<HTMLElement>(s))
              .filter((e) => e.getBoundingClientRect().width > 0)
              .map((e) => {
                const r = e.getBoundingClientRect();
                return { s, x: r.x, y: r.y, r: r.right, b: r.bottom };
              }),
          );
        });
        expect(rects.length).toBeGreaterThanOrEqual(4);
        for (const q of rects) {
          expect(q.x, `${route} ${q.s}`).toBeGreaterThanOrEqual(0);
          expect(q.r, `${route} ${q.s}`).toBeLessThanOrEqual(width);
        }
        for (let i = 0; i < rects.length; i += 1) {
          for (let j = i + 1; j < rects.length; j += 1) {
            const p = rects[i]!;
            const q = rects[j]!;
            const overlap =
              p.x < q.r - 0.5 &&
              q.x < p.r - 0.5 &&
              p.y < q.b - 0.5 &&
              q.y < p.b - 0.5;
            expect(overlap, `${route} ${p.s} / ${q.s} a ${width}`).toBe(false);
          }
        }
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
          `scorrimento orizzontale su ${route} a ${width}`,
        ).toBe(true);
        // The lens is a group labelled for the screen reader, even when "Nest" is cut.
        if (route === "/calendario") {
          await expect(
            page.getByRole("group", {
              name: "Punto di vista: solo tu o tutto il Nest",
            }),
          ).toBeVisible();
        }
        await expectNoBlocking(page);
      }
    });
  }
});
