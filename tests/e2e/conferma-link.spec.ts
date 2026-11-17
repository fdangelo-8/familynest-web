import { expect, test } from "@playwright/test";
import { newRecoveryCookieValue } from "../../src/lib/auth/recovery-cookie";
import {
  createPasswordUser,
  keysConfigured,
  keysSkipReason,
  signInContext,
  type PasswordUser,
} from "../fixtures/accesso-password";
import { skipReason, usersConfigured } from "../fixtures/auth";
import {
  CONFIRMED,
  CONFIRM_EXPIRED,
  FORBIDDEN_POSTS,
  RECOVERY_COOKIE,
  TEXT,
  accountLine,
  accountRow,
  confirmButton,
  confirmForm,
  confirmPath,
  confirmWithButton,
  consumeLink,
  continueControl,
  exitButton,
  expectNoSession,
  expectSessionOf,
  h1,
  hasSession,
  linkFor,
  openConfirm,
  originOf,
  postConfirm,
  sessionCookieNames,
  stayLink,
  tokenFor,
  waitConfirmHydrated,
} from "../fixtures/conferma-link";
import { SEED_HOME_A } from "../fixtures/invito";
import {
  inviteCookie,
  lauraInvite,
  linkOf,
  setInviteCookie,
} from "../fixtures/invito-ingresso";

// Page «Conferma la mail» (GET /auth/confirm), POST that uses the link, page
// «Mail confermata» and row of the active account on /invito/colore (#419).
// Decisions D1 (POST only from our own origin) and D3 (the default links of
// Supabase also end on «Mail confermata») are in the comments of the issue.
//
// X = a throwaway user with a Nest, Y = a throwaway user without one: each
// test creates its own (a link is stored on the user row, so a second link of
// the same user replaces the first and shared users would collide between the
// two projects running in parallel) and deletes them in a `finally`. Links are
// made with the administrative key: no mail is sent, except in CA-23.

function needKeys() {
  test.skip(!keysConfigured(), keysSkipReason);
}

function needInvite() {
  needKeys();
  test.skip(!usersConfigured("A"), skipReason("A"));
}

async function withUsers(
  body: (users: { x: PasswordUser; y: PasswordUser }) => Promise<void>,
) {
  const x = await createPasswordUser({ nest: true, name: "Marta" });
  const y = await createPasswordUser({ name: "Carla" }).catch(async (e) => {
    await x.remove();
    throw e;
  });
  try {
    await body({ x, y });
  } finally {
    await x.remove();
    await y.remove();
  }
}

async function withUser(
  options: { nest?: boolean },
  body: (user: PasswordUser) => Promise<void>,
) {
  const user = await createPasswordUser({ ...options, name: "Carla" });
  try {
    await body(user);
  } finally {
    await user.remove();
  }
}

// ------------------------------------------------------ page «Conferma»

test.describe("pagina «Conferma la mail»", () => {
  for (const type of ["email", "signup"] as const) {
    test(`CA-1: con type=${type} e senza sessione la risposta è 200 e il GET non crea sessioni`, async ({
      page,
    }) => {
      needKeys();
      await withUser({}, async (user) => {
        const token = await tokenFor(user.email);
        const response = await openConfirm(page, confirmPath(token, { type }));
        expect(response.status()).toBe(200);
        await expect(h1(page)).toBeVisible();
        await expect(confirmButton(page)).toBeVisible();
        await expect(
          page.getByText(TEXT.aboveConfirm, { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText(TEXT.confirmLead, { exact: true }),
        ).toBeVisible();
        expect(await sessionCookieNames(page.context())).toEqual([]);
      });
    });
  }

  test("CA-2: tre GET e una HEAD non consumano il link: la conferma riesce", async ({
    page,
  }) => {
    needKeys();
    await withUser({}, async (user) => {
      const { path } = await linkFor(user.email);
      for (let i = 0; i < 3; i += 1) {
        const response = await page.request.get(path, { maxRedirects: 0 });
        expect(response.status()).toBe(200);
      }
      const head = await page.request.head(path, { maxRedirects: 0 });
      expect(head.status()).toBe(200);
      expect(await hasSession(page.context())).toBe(false);

      await confirmWithButton(page, path);
      expect(await hasSession(page.context())).toBe(true);
      await expectSessionOf(page.context(), user.email);
    });
  });

  test("CA-3: intestazioni no-store, same-origin, noindex e nessun Referer con il token verso altri siti", async ({
    page,
    baseURL,
  }) => {
    needKeys();
    await withUser({}, async (user) => {
      const { token, path } = await linkFor(user.email);
      const raw = await page.request.get(path);
      expect(raw.status()).toBe(200);
      const headers = raw.headers();
      expect(headers["cache-control"]).toContain("no-store");
      expect(headers["referrer-policy"]).toBe("same-origin");
      expect(headers["x-robots-tag"]).toContain("noindex");

      const outside: Array<Promise<Record<string, string>>> = [];
      const origin = originOf(baseURL);
      page.on("request", (request) => {
        if (new URL(request.url()).origin !== origin) {
          outside.push(request.allHeaders());
        }
      });
      await page.route("https://altro.example/**", (route) =>
        route.fulfill({ status: 200, body: "ok" }),
      );
      await openConfirm(page, path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        /noindex/,
      );
      // A request to another site from the page itself: the policy must hold.
      await page.evaluate(() =>
        fetch("https://altro.example/ping", { mode: "no-cors" }),
      );
      expect(outside.length).toBeGreaterThan(0);
      for (const sent of await Promise.all(outside)) {
        expect(sent["referer"] ?? "").not.toContain(token);
        expect(sent["referer"] ?? "").not.toContain("token_hash");
      }
    });
  });

  test("CA-4: il modulo è un POST a /auth/confirm senza token nell'azione; il corpo ha token_hash, type e next", async ({
    page,
  }) => {
    needKeys();
    await withUser({}, async (user) => {
      const { token, path } = await linkFor(user.email, "/calendario");
      await openConfirm(page, path);
      const form = confirmForm(page);
      await expect(form).toHaveAttribute("method", /^post$/i);
      await expect(form).toHaveAttribute("action", "/auth/confirm");
      expect(await form.getAttribute("action")).not.toContain("token_hash");

      const posted = page.waitForRequest(
        (request) =>
          request.method() === "POST" &&
          request.url().includes("/auth/confirm"),
      );
      await confirmButton(page).click();
      const body = new URLSearchParams((await posted).postData() ?? "");
      expect(body.get("token_hash")).toBe(token);
      expect(body.get("type")).toBe("email");
      expect(body.get("next")).toBe("/calendario");
      await expect(page).toHaveURL(CONFIRMED);
    });
  });

  for (const query of [
    "",
    "?type=email",
    "?token_hash=qualunque",
    "?token_hash=qualunque&type=magiclink",
    "?token_hash=qualunque&type=otro",
  ]) {
    test(`CA-5: /auth/confirm${query || " (senza parametri)"} porta con un 303 a «link scaduto», senza pagina né sessione`, async ({
      page,
    }) => {
      const response = await page.request.get(`/auth/confirm${query}`, {
        maxRedirects: 0,
      });
      expect(response.status()).toBe(303);
      expect(response.headers()["location"]).toContain(
        "/accesso/link-scaduto?tipo=conferma",
      );
      await page.goto(`/auth/confirm${query}`);
      await expect(page).toHaveURL(CONFIRM_EXPIRED);
      await expect(confirmButton(page)).toHaveCount(0);
      await expectNoSession(page.context());
    });
  }
});

// ------------------------------------------------------------- the POST

test.describe("conferma (POST /auth/confirm)", () => {
  test("CA-6: il bottone manda un POST, risposta 303 a «Mail confermata», sessione dell'account del link, nessun token dopo", async ({
    page,
  }) => {
    needKeys();
    await withUser({}, async (user) => {
      const { path } = await linkFor(user.email);
      await openConfirm(page, path);
      const posted = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().includes("/auth/confirm"),
      );
      await confirmButton(page).click();
      const response = await posted;
      expect(response.status()).toBe(303);
      expect(response.headers()["location"]).toMatch(
        /\/accesso\/mail-confermata/,
      );
      expect(response.headers()["location"]).not.toContain("token_hash");
      await expect(page).toHaveURL(CONFIRMED);
      expect(page.url()).not.toContain("token_hash");
      await expectSessionOf(page.context(), user.email);
    });
  });

  test("CA-7: senza JavaScript il risultato è lo stesso", async ({
    browser,
    baseURL,
  }) => {
    needKeys();
    await withUser({}, async (user) => {
      const context = await browser.newContext({
        baseURL,
        javaScriptEnabled: false,
      });
      try {
        const page = await context.newPage();
        await confirmWithButton(page, (await linkFor(user.email)).path);
        expect(page.url()).not.toContain("token_hash");
        expect(await hasSession(context)).toBe(true);
        await expect(accountRow(page)).toContainText(accountLine(user.email));
      } finally {
        await context.close();
      }
    });
  });

  for (const forbidden of FORBIDDEN_POSTS) {
    const ca = forbidden.name === "Origin diversa" ? "CA-8" : "D1";
    test(`${ca}: POST con ${forbidden.name} → 403, nessuna sessione, il link resta usabile`, async ({
      page,
      browser,
      baseURL,
    }) => {
      needKeys();
      await withUser({}, async (user) => {
        const { token, path } = await linkFor(user.email);
        const { response, context } = await postConfirm(
          browser,
          baseURL as string,
          { token_hash: token, type: "email" },
          forbidden.headers(originOf(baseURL)),
        );
        try {
          expect(response.status()).toBe(403);
          expect(response.headers()["location"]).toBeUndefined();
          await expectNoSession(context);
        } finally {
          await context.close();
        }

        // The same token still confirms the mail, with the button (CA-6).
        await confirmWithButton(page, path);
        await expectSessionOf(page.context(), user.email);
      });
    });
  }

  test("D1: POST dalla nostra origine (Origin giusta, nessun Sec-Fetch-Site) è accettato", async ({
    browser,
    baseURL,
  }) => {
    needKeys();
    await withUser({}, async (user) => {
      const token = await tokenFor(user.email);
      const { response, context } = await postConfirm(
        browser,
        baseURL as string,
        { token_hash: token, type: "email" },
        { Origin: originOf(baseURL) },
      );
      try {
        expect(response.status()).toBe(303);
        expect(response.headers()["location"]).toMatch(
          /\/accesso\/mail-confermata/,
        );
        expect(await hasSession(context)).toBe(true);
      } finally {
        await context.close();
      }
    });
  });

  // CA-9 with an invented token: auth-confirm.spec.ts (type=email|signup).
  test("CA-9: un token già usato porta a «link scaduto», senza sessione", async ({
    page,
    browser,
    baseURL,
  }) => {
    needKeys();
    await withUser({}, async (user) => {
      const { path } = await linkFor(user.email);
      await consumeLink(browser, baseURL as string, path);
      await openConfirm(page, path);
      await confirmButton(page).click();
      await expect(page).toHaveURL(CONFIRM_EXPIRED);
      await expectNoSession(page.context());
    });
  });

  test("CA-10: type=recovery con un token di recupero valido, e senza token_hash, portano a «link scaduto» senza sessione né cookie di recupero", async ({
    browser,
    baseURL,
  }) => {
    needKeys();
    await withUser({}, async (user) => {
      const recovery = await tokenFor(user.email, "recovery");
      const forms: Array<Record<string, string>> = [
        { token_hash: recovery, type: "recovery" },
        { type: "email" },
      ];
      for (const form of forms) {
        const { response, context } = await postConfirm(
          browser,
          baseURL as string,
          form,
          { Origin: originOf(baseURL) },
        );
        try {
          expect(response.status()).toBe(303);
          expect(response.headers()["location"]).toMatch(
            /\/accesso\/link-scaduto\?tipo=conferma$/,
          );
          await expectNoSession(context);
        } finally {
          await context.close();
        }
      }
    });
  });

  test("CA-11: il cookie di recupero presente nel contesto sparisce con la conferma", async ({
    page,
    baseURL,
  }) => {
    needKeys();
    await withUser({}, async (user) => {
      await page.context().addCookies([
        {
          name: RECOVERY_COOKIE,
          value: newRecoveryCookieValue(),
          url: baseURL as string,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      await confirmWithButton(page, (await linkFor(user.email)).path);
      const names = (await page.context().cookies()).map((c) => c.name);
      expect(names).not.toContain(RECOVERY_COOKIE);
      expect(await hasSession(page.context())).toBe(true);
    });
  });

  test("CA-12: due clic di fila mostrano «Conferma in corso» con aria-busy e parte un solo POST", async ({
    page,
  }) => {
    needKeys();
    await withUser({}, async (user) => {
      const { path } = await linkFor(user.email);
      let posts = 0;
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => (release = resolve));
      await page.route("**/auth/confirm", async (route) => {
        if (route.request().method() !== "POST") {
          await route.continue();
          return;
        }
        posts += 1;
        await gate;
        await route.continue();
      });
      try {
        await openConfirm(page, path);
        await waitConfirmHydrated(page);
        const button = confirmForm(page).locator('button[type="submit"]');
        // While the POST is held the page is in a pending navigation, and
        // Playwright waits for it before it reads or acts on the page. So the
        // button is observed from inside the page: after the submit it reports
        // its state, presses itself a second time and reports again.
        const reports: string[] = [];
        page.on("console", (message) => {
          if (message.text().startsWith("conferma:")) {
            reports.push(message.text());
          }
        });
        await page.evaluate(() => {
          const state = () => {
            const node = document.querySelector<HTMLButtonElement>(
              'form[action="/auth/confirm"] button[type="submit"]',
            );
            return `${node?.getAttribute("aria-busy")}|${node?.textContent}`;
          };
          window.addEventListener(
            "submit",
            () => {
              setTimeout(() => {
                console.log(`conferma:uno:${state()}`);
                document
                  .querySelector<HTMLButtonElement>(
                    'form[action="/auth/confirm"] button[type="submit"]',
                  )
                  ?.click();
                setTimeout(() => console.log(`conferma:due:${state()}`), 300);
              }, 300);
            },
            { once: true },
          );
        });
        // The POST is held: the click must not wait for the navigation.
        await button.click({ noWaitAfter: true });
        await expect.poll(() => reports.length, { timeout: 10_000 }).toBe(2);
        expect(reports[0]).toBe(`conferma:uno:true|${TEXT.confirmBusy}`);
        expect(reports[1]).toBe(`conferma:due:true|${TEXT.confirmBusy}`);
        release();
        await expect(page).toHaveURL(CONFIRMED);
        expect(posts).toBe(1);
      } finally {
        release();
        await page.unrouteAll({ behavior: "ignoreErrors" });
      }
    });
  });
});

// ----------------------------------------------- with a session already open

test.describe("con una sessione già aperta", () => {
  test("CA-13: l'avviso dice di X in grassetto, ci sono i due bottoni, la mail di Y non compare, la sessione resta di X", async ({
    page,
    baseURL,
  }) => {
    needKeys();
    await withUsers(async ({ x, y }) => {
      await signInContext(page.context(), baseURL as string, x);
      const { path } = await linkFor(y.email);
      await openConfirm(page, path);
      const notice = page.getByText("In questo browser sei dentro con");
      await expect(notice).toContainText(
        `In questo browser sei dentro con ${x.email}. Se confermi, esci da questo account ed entri con quello della mail.`,
      );
      await expect(notice.locator("b, strong")).toHaveText(x.email);
      await expect(confirmButton(page)).toBeVisible();
      await expect(stayLink(page)).toBeVisible();
      expect(await page.content()).not.toContain(y.email);
      await expectSessionOf(page.context(), x.email);
    });
  });

  test("CA-14: «Resta con questo account» porta a /oggi con la sessione di X e il link di Y vale ancora", async ({
    page,
    browser,
    baseURL,
  }) => {
    needKeys();
    await withUsers(async ({ x, y }) => {
      await signInContext(page.context(), baseURL as string, x);
      const { path } = await linkFor(y.email);
      await openConfirm(page, path);
      await stayLink(page).click();
      await expect(page).toHaveURL(/\/oggi$/);
      await expectSessionOf(page.context(), x.email);

      const fresh = await browser.newContext({ baseURL });
      try {
        const tab = await fresh.newPage();
        await confirmWithButton(tab, path);
        await expectSessionOf(fresh, y.email);
      } finally {
        await fresh.close();
      }
    });
  });

  test("CA-15: «Conferma la mail» porta a «Mail confermata» di Y e la sessione è di Y", async ({
    page,
    baseURL,
  }) => {
    needKeys();
    await withUsers(async ({ x, y }) => {
      await signInContext(page.context(), baseURL as string, x);
      await confirmWithButton(page, (await linkFor(y.email)).path);
      await expect(accountRow(page)).toContainText(accountLine(y.email));
      await expect(accountRow(page).locator("b, strong")).toHaveText(y.email);
      await expectSessionOf(page.context(), y.email);
    });
  });

  test("CA-16: con un token di Y già usato la sessione resta di X e si arriva a /oggi", async ({
    page,
    browser,
    baseURL,
  }) => {
    needKeys();
    await withUsers(async ({ x, y }) => {
      const { path } = await linkFor(y.email);
      await consumeLink(browser, baseURL as string, path);
      await signInContext(page.context(), baseURL as string, x);
      await openConfirm(page, path);
      await confirmButton(page).click();
      await expect(page).toHaveURL(/\/oggi$/);
      await expectSessionOf(page.context(), x.email);
    });
  });
});

// ------------------------------------------------------- «Mail confermata»

test.describe("pagina «Mail confermata»", () => {
  test("CA-17: account senza Nest e senza invito: testi, mail in grassetto, «Continua» porta a /onboarding", async ({
    page,
  }) => {
    needKeys();
    await withUser({}, async (user) => {
      await confirmWithButton(page, (await linkFor(user.email)).path);
      await expect(
        page.getByText(TEXT.confirmedAbove, { exact: true }),
      ).toBeVisible();
      await expect(h1(page)).toHaveText(TEXT.confirmedTitle);
      await expect(accountRow(page)).toContainText(accountLine(user.email));
      await expect(accountRow(page).locator("b, strong")).toHaveText(
        user.email,
      );
      await expect(exitButton(page)).toBeVisible();
      await continueControl(page).click();
      await expect(page).toHaveURL(/\/onboarding$/);
    });
  });

  for (const next of [undefined, "/calendario"]) {
    test(`CA-18: account con Nest${next ? ` e next=${next}` : ""}: «Continua» porta a ${next ?? "/oggi"}`, async ({
      page,
    }) => {
      needKeys();
      await withUser({ nest: true }, async (user) => {
        await confirmWithButton(page, (await linkFor(user.email, next)).path);
        expect(page.url()).not.toContain("token_hash");
        await continueControl(page).click();
        await expect(page).toHaveURL(
          new RegExp(`${(next ?? "/oggi").replace("/", "\\/")}$`),
        );
      });
    });
  }

  test("CA-19: con il cookie d'invito e senza Nest «Continua» porta a /invito/colore e il cookie resta", async ({
    page,
    baseURL,
  }) => {
    needInvite();
    const laura = await lauraInvite();
    await withUser({}, async (user) => {
      await page.goto(linkOf(originOf(baseURL), laura.token));
      const before = await inviteCookie(page);
      expect(before?.value).toBe(laura.token);
      await confirmWithButton(page, (await linkFor(user.email)).path);
      await continueControl(page).click();
      await expect(page).toHaveURL(/\/invito\/colore$/);
      expect((await inviteCookie(page))?.value).toBe(before?.value);
    });
  });

  test("CA-20: «Esci» manda un POST a /auth/signout, porta a /accesso senza sessione e lascia il cookie d'invito", async ({
    page,
    baseURL,
  }) => {
    needInvite();
    const laura = await lauraInvite();
    await withUser({}, async (user) => {
      await setInviteCookie(page, baseURL as string, laura.token);
      await confirmWithButton(page, (await linkFor(user.email)).path);
      const posted = page.waitForRequest(
        (request) =>
          request.method() === "POST" &&
          request.url().endsWith("/auth/signout"),
      );
      await exitButton(page).click();
      await posted;
      await expect(page).toHaveURL(/\/accesso$/);
      expect(await sessionCookieNames(page.context())).toEqual([]);
      expect((await inviteCookie(page))?.value).toBe(laura.token);
    });
  });

  test("CA-21: senza sessione /accesso/mail-confermata porta a /accesso", async ({
    page,
  }) => {
    await page.goto("/accesso/mail-confermata");
    await expect(page).toHaveURL(/\/accesso$/);
  });

  test("CA-22: aprendo «Mail confermata» spariscono le ricerche recenti e la lente salvate", async ({
    page,
  }) => {
    needKeys();
    await withUser({}, async (user) => {
      await openConfirm(page, (await linkFor(user.email)).path);
      await page.evaluate(() => {
        window.localStorage.setItem(
          "familynest:recent-searches:prova",
          JSON.stringify(["gita"]),
        );
        window.sessionStorage.setItem("familynest.lens", "nest");
      });
      await confirmButton(page).click();
      await expect(page).toHaveURL(CONFIRMED);
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              Object.keys(window.localStorage).filter((key) =>
                key.startsWith("familynest:recent-searches:"),
              ).length +
              Number(window.sessionStorage.getItem("familynest.lens") !== null),
          ),
        )
        .toBe(0);
    });
  });
});

// ----------------------------------- default links of Supabase (decision D3)

// CA-23 (the default link of Supabase ends on «Mail confermata», then
// «Continua» goes to /onboarding or, with the invitation cookie, to
// /invito/colore) is checked by the tests already updated by the PR:
// accesso-password-callback.spec.ts (CA-3, CA-4) and
// accesso-password-mail.spec.ts (CA-3 and CA-31, CA-34).

// ------------------------------------------ invitation, choice of the color

test.describe("riga dell'account su /invito/colore", () => {
  test("CA-24: sotto «Scegli il tuo colore» ci sono «Per l'account <mail>.» e «Non sei tu? Esci»", async ({
    page,
    baseURL,
  }) => {
    needInvite();
    const laura = await lauraInvite();
    await withUser({}, async (user) => {
      await signInContext(page.context(), baseURL as string, user);
      await setInviteCookie(page, baseURL as string, laura.token);
      await page.goto("/invito/colore");
      await expect(h1(page)).toHaveText("Scegli il tuo colore");
      await expect(accountRow(page)).toContainText(accountLine(user.email));
      await expect(accountRow(page).locator("b, strong")).toHaveText(
        user.email,
      );
      await expect(exitButton(page)).toBeVisible();
      // The choice of the color and «Continua» are still there.
      await expect(page.getByRole("radio").first()).toBeVisible();
      await expect(continueControl(page)).toBeVisible();
    });
  });

  test("CA-25: «Esci» manda un POST a /auth/signout, porta a /accesso, il cookie resta e un altro account vede la sua mail", async ({
    page,
    baseURL,
  }) => {
    needInvite();
    const laura = await lauraInvite();
    await withUser({}, async (user) => {
      await withUser({}, async (other) => {
        await signInContext(page.context(), baseURL as string, user);
        await setInviteCookie(page, baseURL as string, laura.token);
        await page.goto("/invito/colore");
        const posted = page.waitForRequest(
          (request) =>
            request.method() === "POST" &&
            request.url().endsWith("/auth/signout"),
        );
        await exitButton(page).click();
        await posted;
        await expect(page).toHaveURL(/\/accesso$/);
        expect(await sessionCookieNames(page.context())).toEqual([]);
        expect((await inviteCookie(page))?.value).toBe(laura.token);

        await signInContext(page.context(), baseURL as string, other);
        await page.goto("/invito/colore");
        await expect(page).toHaveURL(/\/invito\/colore$/);
        await expect(accountRow(page)).toContainText(accountLine(other.email));
        expect(await page.content()).not.toContain(user.email);
      });
    });
  });
});

// --------------------------------------------------------------- recovery

test.describe("recupero della password invariato", () => {
  test("CA-26: type=recovery verifica subito, senza pagina intermedia: /accesso/nuova-password e cookie HttpOnly di 900 secondi", async ({
    page,
  }) => {
    needKeys();
    await withUser({}, async (user) => {
      const token = await tokenFor(user.email, "recovery");
      await page.goto(confirmPath(token, { type: "recovery", next: "/oggi" }));
      await expect(page).toHaveURL(/\/accesso\/nuova-password$/);
      await expect(confirmButton(page)).toHaveCount(0);
      expect(await hasSession(page.context())).toBe(true);
      const cookie = (await page.context().cookies()).find(
        (c) => c.name === RECOVERY_COOKIE,
      );
      expect(cookie?.httpOnly).toBe(true);
      const remaining = (cookie?.expires ?? 0) - Date.now() / 1000;
      expect(remaining).toBeGreaterThan(800);
      expect(remaining).toBeLessThanOrEqual(900);
    });
  });
});

// ---------------------------------------------------- privacy and isolation

test.describe("privacy e isolamento", () => {
  test("CA-27: la mail non è in nessun indirizzo, storage o console; token_hash non è nell'indirizzo finale né in console", async ({
    page,
  }) => {
    needKeys();
    await withUser({}, async (user) => {
      const { token, path } = await linkFor(user.email, "/calendario");
      const addresses: string[] = [];
      const consoleLines: string[] = [];
      page.on("framenavigated", (frame) => addresses.push(frame.url()));
      page.on("console", (message) => consoleLines.push(message.text()));
      page.on("pageerror", (error) => consoleLines.push(error.message));

      await confirmWithButton(page, path);
      await continueControl(page).click();
      await expect(page).toHaveURL(/\/calendario$/);
      await page.goto("/accesso/mail-confermata");
      await exitButton(page).click();
      await expect(page).toHaveURL(/\/accesso$/);

      const afterPost = addresses.slice(
        addresses.findIndex((a) => a.includes("mail-confermata")),
      );
      for (const address of afterPost)
        expect(address).not.toContain("token_hash");
      expect(page.url()).not.toContain("token_hash");
      for (const address of addresses) {
        expect(address).not.toContain(user.email);
        expect(address).not.toContain(encodeURIComponent(user.email));
      }
      const storage = await page.evaluate(() =>
        JSON.stringify([
          { ...window.localStorage },
          { ...window.sessionStorage },
        ]),
      );
      expect(storage).not.toContain(user.email);
      for (const line of consoleLines) {
        expect(line).not.toContain(user.email);
        expect(line).not.toContain(token);
      }
    });
  });

  test("CA-28: l'utente di un Nest vede solo la sua mail in «Mail confermata»: nessuna risposta contiene dati del Nest A", async ({
    page,
  }) => {
    needKeys();
    // A throwaway user with its own Nest stands for the user of SEED_HOME_B:
    // the seed users share links between the two projects running in parallel.
    await withUser({ nest: true }, async (user) => {
      const bodies: string[] = [];
      page.on("response", async (response) => {
        const type = response.request().resourceType();
        if (!["document", "fetch", "xhr"].includes(type)) return;
        bodies.push(await response.text().catch(() => ""));
      });
      await confirmWithButton(page, (await linkFor(user.email)).path);
      await expect(accountRow(page)).toContainText(accountLine(user.email));
      const emailA = process.env.TEST_USER_A_EMAIL;
      expect(bodies.length).toBeGreaterThan(0);
      for (const body of bodies) {
        expect(body).not.toContain(SEED_HOME_A);
        if (emailA) expect(body).not.toContain(emailA);
      }
    });
  });

  test("CA-28: l'invitato senza Nest su /invito/colore vede solo la sua mail, non quelle dei membri del Nest che lo invita", async ({
    page,
    baseURL,
  }) => {
    needInvite();
    const laura = await lauraInvite();
    await withUser({}, async (user) => {
      await signInContext(page.context(), baseURL as string, user);
      await setInviteCookie(page, baseURL as string, laura.token);
      const bodies: string[] = [];
      page.on("response", async (response) => {
        const type = response.request().resourceType();
        if (!["document", "fetch", "xhr"].includes(type)) return;
        bodies.push(await response.text().catch(() => ""));
      });
      await page.goto("/invito/colore");
      await expect(accountRow(page)).toContainText(accountLine(user.email));
      // The members of the Nest that invites (Marco, user A of the seed).
      const memberEmail = process.env.TEST_USER_A_EMAIL as string;
      expect(memberEmail).toBeTruthy();
      expect(bodies.length).toBeGreaterThan(0);
      for (const body of bodies) {
        expect(body).not.toContain(memberEmail);
        expect(body).not.toContain(SEED_HOME_A);
      }
    });
  });
});
