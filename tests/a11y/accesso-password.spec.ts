import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  RATE_LIMIT,
  alertWith,
  createPasswordUser,
  h1,
  keysConfigured,
  keysSkipReason,
  mailField,
  mailpitReachable,
  mailpitSkipReason,
  mockAuth,
  modeVoice,
  passwordField,
  recoveryLink,
  statusWith,
  submitButton,
  submitMailForm,
  untilHydrated,
} from "../fixtures/accesso-password";
import { setInviteCookie } from "../fixtures/invito-ingresso";

// Accessibility of the pages of the sign-in with mail and password (#327), at
// 390 and 1280 px (the two projects): axe on every state, one visible h1,
// focus order and ring, announcements, touch areas of 44 px. Supabase is
// simulated; only «Nuova password» needs the real stack.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  // The stickers fade in: axe must not read half-transparent colors.
  reducedMotion: "reduce",
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const MAIL = "marco@esempio.test";
const PASSWORD_OK = "pw-di-prova-7931";

function needSupabase() {
  test.skip(!supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL non impostato");
}

async function expectNoBlocking(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations
      .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
}

const expectOneH1 = (page: Page) =>
  expect(page.locator("h1:visible")).toHaveCount(1);

/** Name of the focused element (aria-label, label of a field or its text). */
function focusedName(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return "";
    const label =
      el.getAttribute("aria-label") ??
      (el instanceof HTMLInputElement
        ? (document.querySelector(`label[for="${el.id}"]`)?.textContent ?? "")
        : el.textContent);
    return (label ?? "").trim();
  });
}

function focusRingVisible(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    const s = getComputedStyle(el);
    return (
      (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) ||
      s.boxShadow !== "none"
    );
  });
}

/** Presses Tab `count` times: the names of the stops, each with a visible ring. */
async function tabStops(page: Page, count: number) {
  const stops: string[] = [];
  for (let i = 0; i < count; i += 1) {
    await page.keyboard.press("Tab");
    const name = await focusedName(page);
    stops.push(name);
    expect(await focusRingVisible(page), `anello di focus su «${name}»`).toBe(
      true,
    );
  }
  return stops;
}

const isDesktop = (info: { project: { name: string } }) =>
  info.project.name === "desktop";

// Every link or button: if it is lower than 44 px the points (cx, cy +- 21)
// belong to it; if it is narrower, the points (cx +- 21, cy). Links inside a
// sentence are exempt (WCAG 2.5.5 «in line»).
async function smallTouchAreas(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    const sel = "main a[href], main button, main input:not([hidden])";
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (r.width < 2 || r.height < 2 || s.visibility === "hidden") continue;
      if (s.display === "none") continue;
      if (el.closest("p.t-nota")) continue;
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      const hit = (x: number, y: number) => {
        const t = document.elementFromPoint(x, y);
        return !!t && el.contains(t);
      };
      let ok = true;
      if (r.height < 44) ok = ok && hit(cx, cy - 21) && hit(cx, cy + 21);
      if (r.width < 44) ok = ok && hit(cx - 21, cy) && hit(cx + 21, cy);
      if (!ok) {
        out.push(
          `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`,
        );
      }
    }
    return out;
  });
}

async function reachCheckMail(page: Page) {
  await page.goto("/accesso/mail");
  await submitMailForm(
    page,
    { mode: "Registrati", email: MAIL, password: PASSWORD_OK },
    () =>
      expect(
        page.getByRole("heading", { level: 1, name: "Controlla la posta" }),
      ).toBeVisible({ timeout: 3000 }),
  );
}

async function reachSent(page: Page) {
  await page.goto("/accesso/password-dimenticata");
  await untilHydrated(
    async () => {
      await mailField(page).fill(MAIL, { timeout: 2000 });
      await submitButton(page).click({ timeout: 2000, noWaitAfter: true });
    },
    () =>
      expect(
        page.getByRole("heading", { level: 1, name: "Ti abbiamo scritto" }),
      ).toBeVisible({ timeout: 3000 }),
  );
}

// ======================================================================= Entra

test.describe("/accesso/mail · Entra", () => {
  test("stato normale: axe, un solo h1, ordine del focus, aree di tocco", async ({
    page,
  }, info) => {
    await page.goto("/accesso/mail");
    await expectOneH1(page);
    await expectNoBlocking(page);
    const group = page.getByRole("group", { name: "Hai già un account?" });
    await expect(group.getByRole("button", { name: "Entra" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    if (isDesktop(info)) {
      // From 1024 px the field takes the focus on arrival.
      await expect(mailField(page)).toBeFocused();
      expect(await tabStops(page, 6)).toEqual([
        "Password",
        "Mostra la password",
        "Password dimenticata?",
        "Entra",
        "Torna all'accesso",
        "Termini d'uso",
      ]);
    } else {
      await expect(mailField(page)).not.toBeFocused();
      expect(await tabStops(page, 9)).toEqual([
        "Indietro",
        "Entra",
        "Registrati",
        "La tua mail",
        "Password",
        "Mostra la password",
        "Password dimenticata?",
        "Entra",
        "Termini d'uso",
      ]);
      expect(await smallTouchAreas(page)).toEqual([]);
    }
  });

  test("«Mostra la password»: nome fisso e aria-pressed, il focus resta sul bottone", async ({
    page,
  }) => {
    await page.goto("/accesso/mail");
    const toggle = page.getByRole("button", { name: "Mostra la password" });
    await untilHydrated(
      () => toggle.click({ timeout: 2000 }),
      () => expect(toggle).toHaveAttribute("aria-pressed", "true"),
    );
    await expect(toggle).toBeFocused();
    await expect(passwordField(page)).toHaveAttribute("type", "text");
    await expect(toggle).toHaveAttribute("aria-controls", /.+/);
    await expectNoBlocking(page);
  });

  test("campi vuoti: axe, aria-invalid e aria-describedby, il focus va sulla mail", async ({
    page,
  }) => {
    await page.goto("/accesso/mail");
    await untilHydrated(
      () => submitButton(page).click({ timeout: 2000, noWaitAfter: true }),
      () =>
        expect(mailField(page)).toHaveAttribute("aria-invalid", "true", {
          timeout: 1000,
        }),
    );
    for (const [field, text] of [
      [mailField(page), "Scrivi la tua mail per entrare."],
      [passwordField(page), "Scrivi la password per entrare."],
    ] as const) {
      await expect(field).toHaveAttribute("aria-invalid", "true");
      const describedBy = await field.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      await expect(
        page.locator(`[id="${describedBy!.split(" ")[0]}"]`),
      ).toContainText(text);
    }
    await expectOneH1(page);
    await expectNoBlocking(page);
    await expect(mailField(page)).toBeFocused();
    expect(await focusRingVisible(page)).toBe(true);
  });

  const bad = {
    kind: "status" as const,
    status: 400,
  };
  const submit = async (page: Page, done: () => Promise<void>) => {
    await page.goto("/accesso/mail");
    await submitMailForm(
      page,
      { mode: "Entra", email: MAIL, password: "una-password" },
      done,
    );
  };

  test("credenziali sbagliate: axe, avviso con role=alert, il focus sulla password", async ({
    page,
  }) => {
    needSupabase();
    await mockAuth(page, "/token", {
      ...bad,
      body: { code: 400, error_code: "invalid_credentials", msg: "no" },
    });
    await submit(page, () =>
      expect(
        alertWith(page, "La mail e la password non corrispondono."),
      ).toBeVisible({
        timeout: 3000,
      }),
    );
    await expect(passwordField(page)).toBeFocused();
    await expectOneH1(page);
    await expectNoBlocking(page);
    // Order: the action of the notice comes after the selector, before the fields.
    await modeVoice(page, "Registrati").focus();
    expect(await tabStops(page, 2)).toEqual([
      "Scegli una password",
      "La tua mail",
    ]);
  });

  test("mail non confermata: axe, avviso con role=status e «Rimanda la mail»", async ({
    page,
  }) => {
    needSupabase();
    await mockAuth(page, "/token", {
      ...bad,
      body: { code: 400, error_code: "email_not_confirmed", msg: "no" },
    });
    await submit(page, () =>
      expect(
        statusWith(page, "Questa mail non è ancora confermata."),
      ).toBeVisible({
        timeout: 3000,
      }),
    );
    await expect(
      page.getByRole("button", { name: "Rimanda la mail" }),
    ).toBeVisible();
    await expectOneH1(page);
    await expectNoBlocking(page);
  });

  test("troppi tentativi: axe, avviso con role=status", async ({ page }) => {
    needSupabase();
    await mockAuth(page, "/token", RATE_LIMIT);
    await submit(page, () =>
      expect(statusWith(page, "Troppi tentativi di fila.")).toBeVisible({
        timeout: 3000,
      }),
    );
    await expectNoBlocking(page);
  });

  test("errore di rete: axe, avviso con role=alert e «Riprova»", async ({
    page,
  }) => {
    needSupabase();
    await mockAuth(page, "/token", { kind: "abort" });
    await submit(page, () =>
      expect(
        alertWith(page, "Non siamo riusciti a farti entrare."),
      ).toBeVisible({
        timeout: 3000,
      }),
    );
    await expect(page.getByRole("button", { name: "Riprova" })).toBeVisible();
    await expectNoBlocking(page);
  });

  test("durante l'invio: bottone occupato con aria-busy e campi in sola lettura", async ({
    page,
  }) => {
    needSupabase();
    // The request never answers: the loading state stays.
    await page.route(`${supabaseUrl}/auth/v1/token*`, () => undefined);
    await submit(page, () =>
      expect(submitButton(page)).toHaveAttribute("aria-busy", "true", {
        timeout: 3000,
      }),
    );
    await expect(submitButton(page)).toHaveText("Accesso in corso");
    await expect(mailField(page)).toHaveAttribute("readonly", "");
    await expect(passwordField(page)).toHaveAttribute("readonly", "");
    await expectNoBlocking(page);
  });
});

// ================================================================== Registrati

test.describe("/accesso/mail · Registrati", () => {
  test("stato normale: axe, ordine del focus, aree di tocco", async ({
    page,
  }, info) => {
    await page.goto("/accesso/mail");
    await untilHydrated(
      () => modeVoice(page, "Registrati").click({ timeout: 2000 }),
      () =>
        expect(h1(page)).toHaveText("Crea il tuo account", { timeout: 1000 }),
    );
    await expectOneH1(page);
    await expectNoBlocking(page);
    // Focus stays on the voice that was pressed; the next stop is the mail.
    await expect(modeVoice(page, "Registrati")).toBeFocused();
    expect(await tabStops(page, 4)).toEqual([
      "La tua mail",
      "Scegli una password",
      "Mostra la password",
      "Crea l'account",
    ]);
    if (!isDesktop(info)) expect(await smallTouchAreas(page)).toEqual([]);
  });

  test("la regola «Da 8 a 72 caratteri»: a riposo e rispettata, senza regioni live", async ({
    page,
  }) => {
    await page.goto("/accesso/mail");
    await untilHydrated(
      () => modeVoice(page, "Registrati").click({ timeout: 2000 }),
      () =>
        expect(h1(page)).toHaveText("Crea il tuo account", { timeout: 1000 }),
    );
    const field = passwordField(page, "Scegli una password");
    const rule = page.locator(".regole-password__regola");
    await expect(rule).toHaveText("Da 8 a 72 caratteri");
    await expect(rule).not.toHaveClass(/rispettata/);
    await expectNoBlocking(page);
    await field.fill(PASSWORD_OK);
    await expect(rule).toHaveClass(/rispettata/);
    await expect(rule).toHaveText(/Da 8 a 72 caratteri\s*, fatto/);
    await expect(page.locator(".regole-password [aria-live]")).toHaveCount(0);
    await expect(field).toHaveAttribute(
      "aria-describedby",
      /accesso-mail-password-regole/,
    );
    await expectNoBlocking(page);
  });

  test("password troppo corta e troppo debole: axe, errore prima della regola", async ({
    page,
  }) => {
    needSupabase();
    await mockAuth(page, "/signup", {
      kind: "status",
      status: 422,
      body: { code: 422, error_code: "weak_password", msg: "weak" },
    });
    await page.goto("/accesso/mail");
    await submitMailForm(
      page,
      { mode: "Registrati", email: MAIL, password: "1234567" },
      () =>
        expect(
          page.getByText(
            "La password è troppo corta: servono almeno 8 caratteri.",
          ),
        ).toBeVisible({ timeout: 1000 }),
    );
    const field = passwordField(page, "Scegli una password");
    const describedBy = (await field.getAttribute("aria-describedby")) ?? "";
    // The error comes first, the rule second.
    expect(describedBy.split(" ")).toHaveLength(2);
    expect(describedBy.split(" ")[0]).toMatch(/errore$/);
    expect(describedBy.split(" ")[1]).toMatch(/regole$/);
    await expectNoBlocking(page);
    await field.fill(PASSWORD_OK);
    await submitButton(page).click();
    await expect(
      page.getByText("Questa password è troppo facile da indovinare"),
    ).toBeVisible();
    await expectNoBlocking(page);
  });
});

// ========================================================== Controlla la posta

test.describe("/accesso/mail · Controlla la posta", () => {
  test("axe, h1 con il focus, ordine del focus, attesa collegata al bottone", async ({
    page,
  }, info) => {
    needSupabase();
    await mockAuth(page, "/signup", { kind: "ok" });
    await reachCheckMail(page);
    await expectOneH1(page);
    await expect(
      page.getByRole("heading", { level: 1, name: "Controlla la posta" }),
    ).toBeFocused();
    await expectNoBlocking(page);
    const resend = page.getByRole("button", { name: "Rimanda la mail" });
    await expect(resend).toBeDisabled();
    const noteId = await resend.getAttribute("aria-describedby");
    expect(noteId).toBeTruthy();
    await expect(page.locator(`[id="${noteId}"]`)).toContainText(
      /Puoi rimandarla tra \d+ second/,
    );
    // No live region for the countdown.
    await expect(page.locator(`[id="${noteId}"][aria-live]`)).toHaveCount(0);
    // The disabled button is skipped.
    expect(await tabStops(page, isDesktop(info) ? 3 : 2)).toEqual(
      isDesktop(info)
        ? ["Usa un'altra mail", "Entra con la password", "Torna all'accesso"]
        : ["Usa un'altra mail", "Entra con la password"],
    );
    if (!isDesktop(info)) expect(await smallTouchAreas(page)).toEqual([]);
  });

  test("con il cookie d'invito: axe con la riga dell'invito", async ({
    page,
    baseURL,
  }) => {
    needSupabase();
    await setInviteCookie(page, baseURL!, "a1".repeat(32));
    await mockAuth(page, "/signup", { kind: "ok" });
    await reachCheckMail(page);
    await expect(
      page.getByText("Apri il link su questo dispositivo"),
    ).toBeVisible();
    await expectNoBlocking(page);
  });

  test("«Rimanda la mail» con troppe richieste: axe con l'avviso informativo (status)", async ({
    page,
  }) => {
    needSupabase();
    await mockAuth(page, "/signup", { kind: "ok" });
    await mockAuth(page, "/resend", RATE_LIMIT);
    await page.clock.install({ time: new Date("2026-11-06T10:00:00Z") });
    await page.goto("/accesso/mail");
    await page.clock.pauseAt(new Date("2026-11-06T10:00:05Z"));
    await submitMailForm(
      page,
      { mode: "Registrati", email: MAIL, password: PASSWORD_OK },
      () =>
        expect(
          page.getByRole("heading", { level: 1, name: "Controlla la posta" }),
        ).toBeVisible({ timeout: 3000 }),
    );
    await page.clock.runFor(60_000);
    await page.getByRole("button", { name: "Rimanda la mail" }).click();
    await expect(
      statusWith(page, "La mail di prima è appena partita."),
    ).toBeVisible();
    // axe uses timers: the frozen clock has to run again.
    await page.clock.resume();
    await expectNoBlocking(page);
  });
});

// ======================================================= Password dimenticata

test.describe("/accesso/password-dimenticata", () => {
  test("stato normale: axe, un solo h1, ordine del focus, aree di tocco", async ({
    page,
  }, info) => {
    await page.goto("/accesso/password-dimenticata");
    await expectOneH1(page);
    await expectNoBlocking(page);
    if (isDesktop(info)) {
      await expect(mailField(page)).toBeFocused();
      expect(await tabStops(page, 2)).toEqual([
        "Mandami il link",
        "Torna all'accesso",
      ]);
    } else {
      expect(await tabStops(page, 3)).toEqual([
        "Indietro",
        "La tua mail",
        "Mandami il link",
      ]);
      expect(await smallTouchAreas(page)).toEqual([]);
    }
  });

  test("mail vuota: axe, aria-invalid, il focus sul campo", async ({
    page,
  }) => {
    await page.goto("/accesso/password-dimenticata");
    await untilHydrated(
      () => submitButton(page).click({ timeout: 2000, noWaitAfter: true }),
      () =>
        expect(mailField(page)).toHaveAttribute("aria-invalid", "true", {
          timeout: 1000,
        }),
    );
    const describedBy = await mailField(page).getAttribute("aria-describedby");
    await expect(page.locator(`[id="${describedBy}"]`)).toContainText(
      "Scrivi la tua mail per ricevere il link.",
    );
    await expect(mailField(page)).toBeFocused();
    await expectNoBlocking(page);
  });

  test("errore di rete: axe, avviso con role=alert e «Riprova»", async ({
    page,
  }) => {
    needSupabase();
    await mockAuth(page, "/recover", { kind: "abort" });
    await page.goto("/accesso/password-dimenticata");
    await untilHydrated(
      async () => {
        await mailField(page).fill(MAIL, { timeout: 2000 });
        await submitButton(page).click({ timeout: 2000, noWaitAfter: true });
      },
      () =>
        expect(
          alertWith(page, "Non siamo riusciti a mandare il link."),
        ).toBeVisible({
          timeout: 3000,
        }),
    );
    await expectNoBlocking(page);
  });

  test("«Ti abbiamo scritto»: axe, h1 con il focus, ordine del focus", async ({
    page,
  }, info) => {
    needSupabase();
    await mockAuth(page, "/recover", { kind: "ok" });
    await reachSent(page);
    await expectOneH1(page);
    await expect(
      page.getByRole("heading", { level: 1, name: "Ti abbiamo scritto" }),
    ).toBeFocused();
    await expectNoBlocking(page);
    await expect(
      page.getByRole("button", { name: "Mandami un altro link" }),
    ).toBeDisabled();
    expect(await tabStops(page, isDesktop(info) ? 2 : 1)).toEqual(
      isDesktop(info)
        ? ["Usa un'altra mail", "Torna all'accesso"]
        : ["Usa un'altra mail"],
    );
    if (!isDesktop(info)) expect(await smallTouchAreas(page)).toEqual([]);
  });
});

// ======================================================================== Link scaduto

test.describe("/accesso/link-scaduto", () => {
  for (const [query, order] of [
    ["?tipo=conferma", ["Entra con la mail", "Torna all'accesso"]],
    ["?tipo=password", ["Mandami un nuovo link", "Torna all'accesso"]],
  ] as const) {
    test(`${query}: axe, un solo h1, ordine del focus, aree di tocco`, async ({
      page,
    }, info) => {
      await page.goto(`/accesso/link-scaduto${query}`);
      await expectOneH1(page);
      await expectNoBlocking(page);
      expect(await tabStops(page, 2)).toEqual(order);
      if (!isDesktop(info)) expect(await smallTouchAreas(page)).toEqual([]);
    });
  }
});

// ================================================================= Nuova password

test.describe("[CI-stack] /accesso/nuova-password", () => {
  async function needStack() {
    test.skip(!keysConfigured(), keysSkipReason);
    test.skip(!(await mailpitReachable()), mailpitSkipReason);
  }

  test("stato normale ed errori: axe, un solo h1, ordine del focus, errore del campo", async ({
    page,
  }, info) => {
    await needStack();
    const user = await createPasswordUser({ nest: true });
    try {
      await page.goto(await recoveryLink(user.email));
      await expect(page).toHaveURL(/\/accesso\/nuova-password$/);
      await expectOneH1(page);
      await expectNoBlocking(page);
      // The copy of the address for the password manager is not focusable.
      await expect(page.locator("main input[type=email]")).toBeHidden();
      if (isDesktop(info)) {
        await expect(passwordField(page, "Nuova password")).toBeFocused();
        expect(await tabStops(page, 2)).toEqual([
          "Mostra la password",
          "Salva la password",
        ]);
      } else {
        expect(await tabStops(page, 3)).toEqual([
          "Nuova password",
          "Mostra la password",
          "Salva la password",
        ]);
        expect(await smallTouchAreas(page)).toEqual([]);
      }
      const field = passwordField(page, "Nuova password");
      await untilHydrated(
        async () => {
          await field.fill("1234567", { timeout: 2000 });
          await submitButton(page).click({ timeout: 2000, noWaitAfter: true });
        },
        () =>
          expect(field).toHaveAttribute("aria-invalid", "true", {
            timeout: 1000,
          }),
      );
      await expect(field).toBeFocused();
      await expectNoBlocking(page);
    } finally {
      await user.remove();
    }
  });
});
