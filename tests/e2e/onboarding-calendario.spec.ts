import { expect, test, type Page } from "@playwright/test";
import {
  signInAs,
  skipReason,
  usersConfigured,
  type TestUserKey,
} from "../fixtures/auth";
import {
  STANDARD_FAKE_ACCOUNT,
  fakeCalendar,
  fakeCalendarConfigured,
  fakeCalendarSkipReason,
} from "../fixtures/calendar-fake";
import {
  colorPageReady,
  continueButton,
  linkOf,
  withNestAndVisitor,
  type DeSantisNest,
} from "../fixtures/invito-ingresso";
import {
  createThrowawayUser,
  throwawayConfigured,
  throwawaySkipReason,
  type ThrowawayUser,
} from "../fixtures/throwaway-user";

// Onboarding step 3, "Porta qui il tuo calendario" (#37). Tests that write use
// throwaway users (UG), deleted at the end; the fake provider (FF) prepares the
// accounts of one user and is reset in the `finally`. Selectors use roles and
// the texts of the issue. Skipped with a reason: iCloud (CA-3 row, CA-9: the
// provider of #36 is not on main), CA-5 (Calendari collegati is still a
// placeholder).

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const PATH = "/onboarding/calendario";

function needsUsers(...keys: TestUserKey[]) {
  test.skip(!usersConfigured(...keys), skipReason(...keys));
}
function needsThrowaway() {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
}
function needsFake() {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
  test.skip(!fakeCalendarConfigured(), fakeCalendarSkipReason);
}

// "adults-only": not "Solo io", but no adult without an account to invite.
type Type = "single" | "couple" | "adults-only";

/** A throwaway user with a Nest; "couple" adds Bea, an adult with no account. */
async function withNest(
  type: Type,
  body: (user: ThrowawayUser) => Promise<void>,
) {
  const user = await createThrowawayUser("Ilaria De Santis");
  try {
    const created = await user.client.rpc("create_household", {
      name: "Casa De Santis",
      household_type: type === "adults-only" ? "couple" : type,
      member_name: "Ilaria",
      color: "pomodoro",
    });
    if (created.error) throw new Error("Creazione del Nest di prova fallita");
    if (type === "couple") {
      const household = await user.client.rpc("current_household_id");
      if (household.error || !household.data) throw new Error("Nest assente");
      const added = await user.client.from("household_members").insert({
        household_id: household.data as string,
        kind: "adult",
        name: "Bea",
        color: "glicine",
      });
      if (added.error) throw new Error("Aggiunta di Bea fallita");
    }
    await body(user);
  } finally {
    await user.remove();
  }
}

async function open(page: Page, user: ThrowawayUser, baseURL?: string) {
  await user.signInContext(page.context(), baseURL as string);
  await page.goto(PATH);
  await expect(page.locator("h1:visible")).toHaveText(
    "Porta qui il tuo calendario",
  );
}

const visible = { visible: true } as const;
const collega = (page: Page, name: string) =>
  page
    .getByRole("button", { name: `Collega ${name}`, exact: true })
    .filter(visible);
const principal = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true }).filter(visible);
const later = (page: Page) =>
  page.getByRole("link", { name: "Più tardi", exact: true }).filter(visible);

const FAKE_EVENT_DAY = 24 * 60 * 60 * 1000;

function events(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const start = new Date(Date.now() + (i + 1) * FAKE_EVENT_DAY);
    return {
      id: `evento-${i}`,
      title: `Impegno ${i}`,
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 3_600_000).toISOString(),
    };
  });
}

test.describe("accesso alla pagina", () => {
  test("CA-1: senza sessione si arriva a /accesso", async ({ page }) => {
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/accesso/);
  });

  test("CA-1: C, senza Nest, arriva a /onboarding", async ({
    page,
    baseURL,
  }) => {
    needsUsers("C");
    await signInAs(page.context(), baseURL as string, "C");
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/onboarding$/);
  });
});

test.describe("contenuto e percorso", () => {
  test("CA-2, CA-3, CA-23: titolo, tacche, righe, rassicurazioni e azioni", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNest("couple", async (user) => {
      await user.signInContext(page.context(), baseURL as string);
      await page.goto("/onboarding/persone");
      await expect(page.locator("h1:visible")).toHaveText("Chi c'è nel Nest?");
      await principal(page, "Continua").click();
      await expect(page).toHaveURL(/\/onboarding\/calendario$/);
      await expect(page).toHaveTitle(
        "FamilyNest · Porta qui il tuo calendario",
      );
      await expect(
        page.getByText("Le tue giornate").filter(visible),
      ).toBeVisible();
      await expect(
        page.getByRole("progressbar", { name: "Passo 3 di 4" }).filter(visible),
      ).toBeVisible();
      // The «Indietro» arrow is drawn in the mobile header only.
      const back = page
        .getByRole("link", { name: "Indietro", exact: true })
        .filter(visible);
      if (test.info().project.name === "mobile") {
        await expect(back).toHaveAttribute("href", "/onboarding/persone");
      } else {
        await expect(back).toHaveCount(0);
      }
      for (const [name, info] of [
        ["Outlook", "Lavoro e calendari condivisi"],
        ["Google", "Per il calendario personale"],
      ]) {
        await expect(collega(page, name!)).toBeVisible();
        await expect(page.getByText(info!).filter(visible)).toBeVisible();
      }
      for (const text of [
        "Gli altri vedono solo che sei occupato",
        "Mai il titolo né il luogo dei tuoi impegni di lavoro.",
        "In due direzioni",
        "Quello che aggiungi qui può andare anche lì, e viceversa.",
        "Scegli dopo cosa tenere",
        "Da Impostazioni › Calendari collegati.",
      ]) {
        await expect(
          page.getByText(text, { exact: true }).filter(visible),
        ).toBeVisible();
      }
      await expect(principal(page, "Continua senza calendario")).toBeVisible();
      await expect(later(page)).toBeVisible();
    });
  });

  test("CA-11: da Nest con un adulto da invitare, i due bottoni portano a /onboarding/invito", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNest("couple", async (user) => {
      await open(page, user, baseURL);
      await expect(
        page.getByRole("progressbar", { name: "Passo 3 di 4" }).filter(visible),
      ).toBeVisible();
      await principal(page, "Continua senza calendario").click();
      await expect(page).toHaveURL(/\/onboarding\/invito$/);
      await page.goto(PATH);
      await later(page).click();
      await expect(page).toHaveURL(/\/onboarding\/invito$/);
    });
  });

  test("CA-13: «Solo io» ha «Passo 3 di 3» e «Più tardi» porta a /onboarding/pronto", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNest("single", async (user) => {
      await open(page, user, baseURL);
      await expect(
        page.getByRole("progressbar", { name: "Passo 3 di 3" }).filter(visible),
      ).toBeVisible();
      await later(page).click();
      await expect(page).toHaveURL(/\/onboarding\/pronto$/);
    });
  });

  test("CA-16: il ruolo lo decide il server, non l'indirizzo", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNest("couple", async (user) => {
      await user.signInContext(page.context(), baseURL as string);
      await page.goto(`${PATH}?invitato=1`);
      await expect(page.locator("h1:visible")).toHaveText(
        "Porta qui il tuo calendario",
      );
      await expect(later(page)).toHaveAttribute("href", "/onboarding/invito");
    });
  });
});

test.describe("collegamento con il fornitore finto", () => {
  test("CA-4, CA-21: «Collega Google» + «Consenti» → «Collegato», senza parametri e senza segreti", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    const fake = fakeCalendar(baseURL as string);
    await withNest("couple", async (user) => {
      try {
        await fake.setup({
          userId: user.id,
          ...STANDARD_FAKE_ACCOUNT,
          nextConsent: true,
        });
        const bodies: string[] = [];
        page.on("response", (response) => {
          if (response.url().startsWith(baseURL as string)) {
            void response
              .text()
              .then((text) => bodies.push(text))
              .catch(() => undefined);
          }
        });
        await open(page, user, baseURL);
        await collega(page, "Google").click();
        await page.getByRole("link", { name: "Consenti", exact: true }).click();
        await expect(page).toHaveURL(/\/onboarding\/calendario$/);
        await expect(page.locator("h1:visible")).toBeVisible();
        await expect(
          page.getByText("u.finto@example.test · 3 calendari").filter(visible),
        ).toBeVisible();
        await expect(page.getByText("Collegato").filter(visible)).toBeVisible();
        await expect(collega(page, "Google")).toHaveCount(0);
        await expect(principal(page, "Continua")).toBeVisible();
        await expect(principal(page, "Continua")).toBeFocused();

        const html = await page.content();
        const log = await fake.log(user.id);
        const secrets = log
          .map((entry) => entry.token)
          .filter((t): t is string => !!t);
        for (const secret of secrets) {
          expect(html).not.toContain(secret);
          for (const body of bodies) expect(body).not.toContain(secret);
        }
        expect(html).not.toMatch(/refresh_token|access_token/);
      } finally {
        await fake.reset(user.id);
      }
    });
  });

  test("CA-6: durante il collegamento lo spinner «Collegamento», il principale è spento", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    const fake = fakeCalendar(baseURL as string);
    await withNest("couple", async (user) => {
      try {
        await fake.setup({ userId: user.id, ...STANDARD_FAKE_ACCOUNT });
        await open(page, user, baseURL);
        // The page is hydrated once React owns the form.
        await page.waitForFunction(() =>
          Object.keys(document.querySelector("form") ?? {}).some((key) =>
            key.startsWith("__reactProps"),
          ),
        );
        // The trip to the provider is held by the test: the submit is
        // cancelled in the capture phase, after which React still runs its
        // own handler, so the page shows what it shows while it waits.
        await page.evaluate(() =>
          document.addEventListener("submit", (e) => e.preventDefault(), true),
        );
        await collega(page, "Google").click();
        await expect(
          page.getByText("Collegamento", { exact: true }).filter(visible),
        ).toBeVisible();
        await expect(
          principal(page, "Continua senza calendario"),
        ).toBeDisabled();
        await expect(later(page)).toBeEnabled();
        await expect(collega(page, "Outlook")).toBeEnabled();
      } finally {
        await fake.reset(user.id);
      }
    });
  });

  test("CA-7, CA-8: «Nega» → avviso con «Riprova»; «Riprova» + «Consenti» → «Collegato»", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    const fake = fakeCalendar(baseURL as string);
    await withNest("couple", async (user) => {
      try {
        await fake.setup({
          userId: user.id,
          ...STANDARD_FAKE_ACCOUNT,
          nextConsent: true,
        });
        await open(page, user, baseURL);
        await collega(page, "Google").click();
        await page.getByRole("link", { name: "Nega", exact: true }).click();
        await expect(page).toHaveURL(/\/onboarding\/calendario$/);
        const alert = page
          .locator(".avviso--errore[role=alert]")
          .filter(visible);
        await expect(alert).toContainText(
          "Non siamo riusciti a collegare Google. Riprova o salta questo passo.",
        );
        await expect(collega(page, "Google")).toBeVisible();
        await expect(
          principal(page, "Continua senza calendario"),
        ).toBeVisible();

        await alert.getByRole("button", { name: "Riprova" }).click();
        await page.getByRole("link", { name: "Consenti", exact: true }).click();
        await expect(page.getByText("Collegato").filter(visible)).toBeVisible();
        await expect(
          page.locator(".avviso--errore").filter(visible),
        ).toHaveCount(0);
      } finally {
        await fake.reset(user.id);
      }
    });
  });

  test("CA-22: un altro membro del Nest non vede l'account di U", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    const fake = fakeCalendar(baseURL as string);
    await withNest("couple", async (user) => {
      try {
        await fake.setup({ userId: user.id, ...STANDARD_FAKE_ACCOUNT });
        await fake.sync(user.id);
        // Another adult of the same Nest, signed in as a throwaway user.
        const rita = await createThrowawayUser("Rita");
        try {
          const household = await user.client.rpc("current_household_id");
          const member = await user.admin
            .from("household_members")
            .update({ user_id: rita.id, joined_at: new Date().toISOString() })
            .eq("household_id", household.data as string)
            .eq("name", "Bea");
          expect(member.error).toBeNull();
          await rita.signInContext(page.context(), baseURL as string);
          await page.goto(PATH);
          await expect(page.locator("h1:visible")).toBeVisible();
          await expect(collega(page, "Outlook")).toBeVisible();
          await expect(collega(page, "Google")).toBeVisible();
          expect(await page.content()).not.toContain("u.finto@example.test");
        } finally {
          await rita.remove();
        }
      } finally {
        await fake.reset(user.id);
      }
    });
  });
});

test.describe("Pronto: la riga degli impegni", () => {
  test("CA-17, CA-18, CA-20: «N impegni arrivati da Google», uno solo, nessuna riga senza account", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    const fake = fakeCalendar(baseURL as string);
    await withNest("single", async (user) => {
      try {
        await user.signInContext(page.context(), baseURL as string);
        await page.goto("/onboarding/pronto");
        await expect(page.locator("h1:visible")).toBeVisible();
        await expect(page.getByText(/arrivat[io] da/)).toHaveCount(0);

        await fake.setup({
          userId: user.id,
          ...STANDARD_FAKE_ACCOUNT,
          nextConsent: true,
        });
        await page.goto(PATH);
        await collega(page, "Google").click();
        await page.getByRole("link", { name: "Consenti", exact: true }).click();
        await expect(page.getByText("Collegato").filter(visible)).toBeVisible();
        await fake.setEvents({
          userId: user.id,
          email: STANDARD_FAKE_ACCOUNT.email,
          calendarId: "personale",
          events: events(12),
        });
        await fake.sync(user.id);
        await page.goto("/onboarding/pronto");
        await expect(
          page.getByText("12 impegni arrivati da Google").filter(visible),
        ).toBeVisible();

        await fake.setEvents({
          userId: user.id,
          email: STANDARD_FAKE_ACCOUNT.email,
          calendarId: "personale",
          events: events(1),
        });
        await fake.sync(user.id);
        await page.goto("/onboarding/pronto");
        await expect(
          page.getByText("1 impegno arrivato da Google").filter(visible),
        ).toBeVisible();
      } finally {
        await fake.reset(user.id);
      }
    });
  });
});

const providerRows = (page: Page) =>
  page
    .getByRole("list", { name: "Calendari da collegare" })
    .filter(visible)
    .getByRole("listitem");

test.describe("righe, percorso e disposizione", () => {
  test("CA-3: le righe sono in ordine Outlook, Google (iCloud non è su main)", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNest("couple", async (user) => {
      await open(page, user, baseURL);
      await expect(providerRows(page)).toHaveCount(2);
      await expect(providerRows(page).nth(0)).toContainText("Outlook");
      await expect(providerRows(page).nth(1)).toContainText("Google");
      await expect(collega(page, "iCloud")).toHaveCount(0);
    });
  });

  test("CA-3: la riga iCloud con «Calendario di iPhone e Mac»", () => {
    test.skip(true, "Fornitore iCloud (#36) non su main: la riga non c'è");
  });

  test("CA-9: foglio «Collega iCloud»", () => {
    test.skip(true, "Fornitore iCloud (#36) non su main: nessun foglio");
  });

  test("CA-5: dopo il collegamento, «Personale» acceso e «Occupato»", () => {
    test.skip(
      true,
      "/calendari-collegati è ancora un segnaposto: le impostazioni non si vedono",
    );
  });

  test("CA-12: Nest senza adulti da invitare, «Più tardi» porta a /onboarding/pronto", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNest("adults-only", async (user) => {
      await open(page, user, baseURL);
      await expect(
        page.getByRole("progressbar", { name: "Passo 3 di 4" }).filter(visible),
      ).toBeVisible();
      await later(page).click();
      await expect(page).toHaveURL(/\/onboarding\/pronto$/);
    });
  });

  test("CA-13: «Solo io», da «Chi c'è nel Nest?» «Continua» porta a «Passo 3 di 3»", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNest("single", async (user) => {
      await user.signInContext(page.context(), baseURL as string);
      await page.goto("/onboarding/persone");
      await expect(page.locator("h1:visible")).toHaveText("Chi c'è nel Nest?");
      await principal(page, "Continua").click();
      await expect(page).toHaveURL(/\/onboarding\/calendario$/);
      await expect(
        page.getByRole("progressbar", { name: "Passo 3 di 3" }).filter(visible),
      ).toBeVisible();
    });
  });

  test("CA-23: su desktop disposizione divisa, «Più tardi» prima di «Continua senza calendario»", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Solo desktop");
    needsThrowaway();
    await withNest("couple", async (user) => {
      await open(page, user, baseURL);
      const right = page.locator(".split-onboarding__passo").filter(visible);
      await expect(right).toBeVisible();
      await expect(right.getByRole("progressbar")).toBeVisible();
      await expect(right.getByRole("heading", { level: 1 })).toHaveText(
        "Porta qui il tuo calendario",
      );
      await expect(
        right.getByRole("button", { name: /^Collega / }),
      ).toHaveCount(2);
      await expect(
        right.getByText("Scegli dopo cosa tenere", { exact: true }),
      ).toBeVisible();
      const laterLink = right.getByRole("link", {
        name: "Più tardi",
        exact: true,
      });
      const main = right.getByRole("button", {
        name: "Continua senza calendario",
        exact: true,
      });
      const a = await laterLink.boundingBox();
      const b = await main.boundingBox();
      expect(a!.x).toBeLessThan(b!.x);
      // Focus order: «Più tardi», then the main button.
      await laterLink.focus();
      await page.keyboard.press("Tab");
      await expect(main).toBeFocused();
    });
  });

  test("CA-10: due account Outlook → «2 account · N calendari»", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    const fake = fakeCalendar(baseURL as string);
    await withNest("couple", async (user) => {
      try {
        await fake.setup({
          userId: user.id,
          provider: "outlook",
          email: "o.uno@example.test",
          calendars: STANDARD_FAKE_ACCOUNT.calendars,
          nextConsent: true,
        });
        await open(page, user, baseURL);
        await collega(page, "Outlook").click();
        await page.getByRole("link", { name: "Consenti", exact: true }).click();
        await expect(
          page.getByText("o.uno@example.test · 3 calendari").filter(visible),
        ).toBeVisible();

        await fake.setup({
          userId: user.id,
          provider: "outlook",
          email: "o.due@example.test",
          calendars: STANDARD_FAKE_ACCOUNT.calendars,
          nextConsent: true,
        });
        // The row has no «Collega» any more: the second link starts with the
        // same POST the button makes (destination «onboarding»).
        await page.evaluate(() => {
          const form = document.createElement("form");
          form.method = "post";
          form.action = "/calendari-collegati/collega/outlook";
          const field = document.createElement("input");
          field.name = "destination";
          field.value = "onboarding";
          form.appendChild(field);
          document.body.appendChild(form);
          form.submit();
        });
        await page.getByRole("link", { name: "Consenti", exact: true }).click();
        await expect(page).toHaveURL(/\/onboarding\/calendario$/);
        await expect(
          page.getByText(/^2 account · \d+ calendari$/).filter(visible),
        ).toBeVisible();
      } finally {
        await fake.reset(user.id);
      }
    });
  });
});

test.describe("chi entra con un invito", () => {
  async function joined(
    nest: DeSantisNest,
    visitor: ThrowawayUser,
    page: Page,
    baseURL?: string,
  ) {
    const accepted = await visitor.client.rpc("accept_invitation_with_color", {
      p_token: nest.invite.token,
      p_color: "peonia",
    });
    expect(accepted.error).toBeNull();
    await visitor.signInContext(page.context(), baseURL as string);
    await page.goto(PATH);
    await expect(page.locator("h1:visible")).toHaveText(
      "Porta qui il tuo calendario",
    );
  }

  test("CA-14: da «Il tuo colore» «Continua» porta al calendario", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNestAndVisitor(async (nest, visitor) => {
      await visitor.signInContext(page.context(), baseURL as string);
      await page.goto(
        linkOf(new URL(baseURL as string).origin, nest.invite.token),
      );
      await page.goto("/invito/colore");
      await colorPageReady(page);
      await continueButton(page).click();
      await expect(page).toHaveURL(/\/onboarding\/calendario$/);
      await expect(page.locator("h1:visible")).toHaveText(
        "Porta qui il tuo calendario",
      );
    });
  });

  test("CA-14, CA-16: l'invitato ha «Passo 2 di 3», nessuna freccia; «Continua senza calendario» porta a /oggi col benvenuto", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNestAndVisitor(async (nest, visitor) => {
      await joined(nest, visitor, page, baseURL);
      await expect(
        page.getByRole("progressbar", { name: "Passo 2 di 3" }).filter(visible),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Indietro", exact: true }),
      ).toHaveCount(0);
      // The address cannot change the role decided by the server.
      await page.goto(`${PATH}?invitato=0`);
      await expect(
        page.getByRole("progressbar", { name: "Passo 2 di 3" }).filter(visible),
      ).toBeVisible();
      await principal(page, "Continua senza calendario").click();
      await expect(page).toHaveURL(/\/oggi$/);
      await expect(
        page.getByRole("heading", { level: 1, name: /^Eccoti/ }),
      ).toBeVisible();
    });
  });

  test("CA-15: l'invitato collega Google, resta sul passo e «Continua» porta a /oggi", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    const fake = fakeCalendar(baseURL as string);
    await withNestAndVisitor(async (nest, visitor) => {
      try {
        await fake.setup({
          userId: visitor.id,
          ...STANDARD_FAKE_ACCOUNT,
          nextConsent: true,
        });
        await joined(nest, visitor, page, baseURL);
        await collega(page, "Google").click();
        await page.getByRole("link", { name: "Consenti", exact: true }).click();
        await expect(page).toHaveURL(/\/onboarding\/calendario$/);
        await expect(page.getByText("Collegato").filter(visible)).toBeVisible();
        await principal(page, "Continua").click();
        await expect(page).toHaveURL(/\/oggi$/);
      } finally {
        await fake.reset(visitor.id);
      }
    });
  });
});

test.describe("Pronto: altri casi della riga degli impegni", () => {
  test("CA-18: con Outlook e Google, in ordine di collegamento, «N impegni arrivati da Outlook e Google»", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    const fake = fakeCalendar(baseURL as string);
    await withNest("single", async (user) => {
      try {
        const outlook = "o.finto@example.test";
        await fake.setup({
          userId: user.id,
          provider: "outlook",
          email: outlook,
          calendars: STANDARD_FAKE_ACCOUNT.calendars,
          nextConsent: true,
        });
        await open(page, user, baseURL);
        await collega(page, "Outlook").click();
        await page.getByRole("link", { name: "Consenti", exact: true }).click();
        await expect(
          page.getByText(`${outlook} · 3 calendari`).filter(visible),
        ).toBeVisible();
        await fake.setup({
          userId: user.id,
          ...STANDARD_FAKE_ACCOUNT,
          nextConsent: true,
        });
        await collega(page, "Google").click();
        await page.getByRole("link", { name: "Consenti", exact: true }).click();
        await expect(
          page.getByText("u.finto@example.test · 3 calendari").filter(visible),
        ).toBeVisible();
        await fake.setEvents({
          userId: user.id,
          provider: "outlook",
          email: outlook,
          calendarId: "personale",
          events: events(2),
        });
        await fake.setEvents({
          userId: user.id,
          email: STANDARD_FAKE_ACCOUNT.email,
          calendarId: "personale",
          events: events(3),
        });
        await fake.sync(user.id);
        await page.goto("/onboarding/pronto");
        await expect(
          page
            .getByText("5 impegni arrivati da Outlook e Google")
            .filter(visible),
        ).toBeVisible();
      } finally {
        await fake.reset(user.id);
      }
    });
  });

  test("CA-19: con il finto lento Pronto mostra il caricamento e, entro 11 secondi, il riepilogo", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(60_000);
    needsFake();
    const fake = fakeCalendar(baseURL as string);
    await withNest("single", async (user) => {
      try {
        await fake.setup({
          userId: user.id,
          ...STANDARD_FAKE_ACCOUNT,
          nextConsent: true,
        });
        await fake.setEvents({
          userId: user.id,
          email: STANDARD_FAKE_ACCOUNT.email,
          calendarId: "personale",
          events: events(3),
        });
        await fake.fail({
          userId: user.id,
          email: STANDARD_FAKE_ACCOUNT.email,
          slowMs: 4000,
        });
        await open(page, user, baseURL);
        await collega(page, "Google").click();
        await page.getByRole("link", { name: "Consenti", exact: true }).click();
        await expect(page.getByText("Collegato").filter(visible)).toBeVisible();
        await page.goto("/onboarding/pronto", { waitUntil: "commit" });
        await expect(
          page.getByText("Preparazione in corso").filter(visible),
        ).toBeVisible();
        await expect(
          page.getByText(/impegni arrivati da Google$/).filter(visible),
        ).toBeVisible({ timeout: 11_000 });
      } finally {
        await fake.reset(user.id);
      }
    });
  });
});
