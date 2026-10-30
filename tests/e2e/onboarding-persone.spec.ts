import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  signInAs,
  skipReason,
  usersConfigured,
  type TestUserKey,
} from "../fixtures/auth";
import {
  createThrowawayUser,
  throwawayConfigured,
  throwawaySkipReason,
  type ThrowawayUser,
} from "../fixtures/throwaway-user";

// Onboarding step 2, "Chi c'è nel Nest?" (#13), written from the acceptance
// criteria before the page exists. Tests that write use a throwaway user (U);
// A, B, B2 and C only read. Selectors use roles and the texts of the issue.
// TODO(#13): adjust any selector that the final markup makes ambiguous; do not
// weaken an assertion.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const PATH = "/onboarding/persone";
const ADD_BUTTON = "Aggiungi una persona o un animale";
const FULL_MESSAGE =
  "Il Nest è al completo: ci stanno al massimo 10 tra persone e animali.";
const SAVE_FAILED =
  "Non siamo riusciti a salvare. Controlla la connessione e riprova.";
const COLORS = [
  "pomodoro",
  "glicine",
  "salvia",
  "cobalto",
  "zafferano",
  "lampone",
  "ceruleo",
  "peonia",
  "basilico",
  "cannella",
] as const;
const label = (color: string) => color[0]!.toUpperCase() + color.slice(1);

type Type = "single" | "couple" | "family_with_children" | "roommates";
type Kind = "adult" | "child" | "pet";
type Member = {
  id: string;
  name: string;
  kind: Kind;
  color: string;
  birth_date: string | null;
  user_id: string | null;
};

// ---------------------------------------------------------------- dates

function parts(day: string): [number, number, number] {
  return day.split("-").map(Number) as [number, number, number];
}

/** Calendar day in Europe/Rome, shifted by whole days. */
function romeDay(shiftDays = 0): string {
  const now = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Rome",
  });
  const [y, m, d] = parts(now);
  return new Date(Date.UTC(y, m - 1, d + shiftDays)).toISOString().slice(0, 10);
}

/** Today in Rome minus whole years/months (day of month kept), plus days. */
function romeMinus(years: number, months = 0, extraDays = 0): string {
  const [y, m, d] = parts(romeDay());
  return new Date(Date.UTC(y - years, m - 1 - months, d + extraDays))
    .toISOString()
    .slice(0, 10);
}

function completedYears(birth: string): number {
  const [by, bm, bd] = parts(birth);
  const [y, m, d] = parts(romeDay());
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

const dayOfMonthRome = () => parts(romeDay())[2];

// ---------------------------------------------------------------- data

async function withUser(body: (user: ThrowawayUser) => Promise<void>) {
  const user = await createThrowawayUser("Ilaria De Santis");
  try {
    await body(user);
  } finally {
    await user.remove();
  }
}

async function withNest(
  type: Type,
  body: (user: ThrowawayUser) => Promise<void>,
) {
  await withUser(async (user) => {
    const { error } = await user.client.rpc("create_household", {
      name: "Casa De Santis",
      household_type: type,
      member_name: "Ilaria",
      color: "pomodoro",
    });
    if (error) throw new Error("Creazione del Nest di prova fallita");
    await body(user);
  });
}

async function householdId(user: ThrowawayUser): Promise<string> {
  const { data, error } = await user.client.rpc("current_household_id");
  if (error || !data) throw new Error("Nest di prova non trovato");
  return data as string;
}

/** Inserts a member as the throwaway user (RLS active), like the page does. */
async function addMember(
  user: ThrowawayUser,
  m: { name: string; kind: Kind; color: string; birth_date?: string | null },
) {
  const { error } = await user.client.from("household_members").insert({
    household_id: await householdId(user),
    kind: m.kind,
    name: m.name,
    color: m.color,
    birth_date: m.birth_date ?? null,
  });
  if (error) throw new Error(`Inserimento di prova fallito: ${error.code}`);
}

async function members(user: ThrowawayUser): Promise<Member[]> {
  const { data, error } = await user.admin
    .from("household_members")
    .select("id, name, kind, color, birth_date, user_id, created_at")
    .eq("household_id", await householdId(user))
    .order("created_at")
    .order("id");
  if (error) throw new Error("Lettura dei membri fallita");
  return data as Member[];
}

async function openPage(page: Page, user: ThrowawayUser, baseURL?: string) {
  await user.signInContext(page.context(), baseURL as string);
  await page.goto(PATH);
  await expect(page.locator("h1:visible")).toHaveText("Chi c'è nel Nest?");
}

// ---------------------------------------------------------------- page helpers

const list = (page: Page) =>
  page.getByRole("list", { name: "Persone del Nest" });
const rows = (page: Page) => list(page).getByRole("listitem");
const addButton = (page: Page) =>
  page.getByRole("button", { name: ADD_BUTTON });
const dialog = (page: Page, name: string | RegExp) =>
  page.getByRole("dialog", { name });
const nameField = (d: Locator) => d.getByLabel("Nome", { exact: true });
const dateField = (d: Locator) =>
  d.getByLabel("Data di nascita", { exact: true });
const kindButton = (d: Locator, kind: string) =>
  d
    .getByRole("group", { name: "Chi è" })
    .getByRole("button", { name: kind, exact: true });
const colorGroup = (d: Locator) =>
  d.getByRole("radiogroup", { name: "Colore" });
const colorRadio = (d: Locator, name: string) =>
  colorGroup(d).getByRole("radio", { name, exact: true });
const submit = (d: Locator, name: string | RegExp) =>
  d.getByRole(
    "button",
    typeof name === "string" ? { name, exact: true } : { name },
  );
const progress = (page: Page, name: string) =>
  page.getByRole("progressbar", { name }).filter({ visible: true });
const continua = (page: Page) =>
  page.getByRole("button", { name: "Continua" }).filter({ visible: true });

async function expectRow(
  page: Page,
  index: number,
  title: string,
  info: string,
) {
  const row = rows(page).nth(index);
  await expect(row.getByText(title, { exact: true })).toBeVisible();
  await expect(row.getByText(info, { exact: true })).toBeVisible();
  return row;
}

/** Clicks until the page is hydrated and the dialog is open. */
async function openAdd(page: Page): Promise<Locator> {
  const d = dialog(page, "Aggiungi una persona");
  await expect(async () => {
    await addButton(page).click();
    await expect(d).toBeVisible({ timeout: 1000 });
  }).toPass();
  return d;
}

async function openEdit(page: Page, name: string): Promise<Locator> {
  const d = dialog(page, `Modifica ${name}`);
  await expect(async () => {
    await page.getByRole("button", { name: `Modifica ${name}` }).click();
    await expect(d).toBeVisible({ timeout: 1000 });
  }).toPass();
  return d;
}

/** The server action POST (the Next.js route announcer is not it). */
function isSave(route: {
  request(): { method(): string; headers(): Record<string, string> };
}) {
  const r = route.request();
  return r.method() === "POST" && "next-action" in r.headers();
}

function needsUsers(...keys: TestUserKey[]) {
  test.skip(!usersConfigured(...keys), skipReason(...keys));
}
function needsThrowaway() {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
}

const pathOf = (page: Page) => {
  const url = new URL(page.url());
  return url.pathname + url.search;
};

// ================================================================ access

test.describe("accesso alla pagina", () => {
  test("CA-1: senza sessione si arriva a /accesso", async ({ page }) => {
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/accesso/);
  });

  test("CA-2: C, senza Nest, arriva a /onboarding", async ({
    page,
    baseURL,
  }) => {
    needsUsers("C");
    await signInAs(page.context(), baseURL as string, "C");
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test("CA-3: B2, adulto non amministratore, arriva a /oggi", async ({
    page,
    baseURL,
  }) => {
    needsUsers("B2");
    await signInAs(page.context(), baseURL as string, "B2");
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/oggi$/);
  });

  test("CA-4: la pagina usa OnboardingError e non FrameError/ErrorMain", () => {
    const code = readFileSync("src/app/onboarding/persone/page.tsx", "utf8");
    expect(code).toMatch(
      /import\s*\{[^}]*OnboardingError[^}]*\}\s*from\s*"@\/components\/onboarding\/OnboardingError"/,
    );
    expect(code).toMatch(/<OnboardingError/);
    expect(code).not.toMatch(/FrameError|ErrorMain/);
    expect(code).toContain("requireUser");
    // TODO(#13): also check that the error is returned when the Nest or member
    // read fails, once the shape of the code is known.
  });

  test("CA-5: dopo «In coppia» e «Continua» si arriva a /onboarding/persone", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withUser(async (user) => {
      await user.signInContext(page.context(), baseURL as string);
      await page.goto("/onboarding");
      const radio = page.getByRole("radio", { name: "In coppia" });
      await expect(async () => {
        await radio.click();
        await expect(radio).toHaveAttribute("aria-checked", "true", {
          timeout: 1000,
        });
      }).toPass();
      await page.getByRole("button", { name: "Continua" }).click();
      await expect(page).toHaveURL(/\/onboarding\/persone$/);
      expect(await user.nestCount()).toBe(1);
      expect((await members(user)).map((m) => m.name)).toEqual(["Ilaria"]);
      const { data } = await user.client
        .from("households")
        .select("household_type");
      expect(data).toEqual([{ household_type: "couple" }]);
    });
  });
});

// ================================================================ content

test.describe("contenuto", () => {
  test.beforeEach(() => needsUsers("A"));

  test("CA-6: titolo, h1, barra «Passo 2 di 4», nessuna navigazione", async ({
    page,
    baseURL,
  }) => {
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto(PATH);
    await expect(page).toHaveTitle("FamilyNest · Chi c'è nel Nest?");
    await expect(page.locator("h1:visible")).toHaveCount(1);
    await expect(page.locator("h1:visible")).toHaveText("Chi c'è nel Nest?");
    await expect(
      page.getByText("La tua famiglia").filter({ visible: true }).first(),
    ).toBeVisible();
    const bar = progress(page, "Passo 2 di 4");
    await expect(bar).toHaveCount(1);
    await expect(bar).toHaveAttribute("aria-valuenow", "2");
    await expect(bar).toHaveAttribute("aria-valuemax", "4");
    await expect(
      page.getByRole("navigation", { name: "Navigazione principale" }),
    ).toHaveCount(0);
  });

  test("CA-7: cinque righe nell'ordine del seed, con info, avatar e matita", async ({
    page,
    baseURL,
  }) => {
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto(PATH);
    await expect(rows(page)).toHaveCount(5);
    const n = completedYears("2016-12-14");
    const m = completedYears("2020-04-02");
    const expected: [string, string, string, string, string][] = [
      ["Marco, tu", "Adulto", "M", "pomodoro", "Marco"],
      ["Laura", "Adulto · riceverà un invito", "L", "glicine", "Laura"],
      ["Sofia", `Figlio o figlia · ${n} anni`, "S", "salvia", "Sofia"],
      ["Tommaso", `Figlio o figlia · ${m} anni`, "T", "cobalto", "Tommaso"],
      ["Biscotto", "Animale", "B", "zafferano", "Biscotto"],
    ];
    for (const [i, [title, info, initial, color, who]] of expected.entries()) {
      const row = await expectRow(page, i, title, info);
      await expect(
        row.getByRole("button", { name: `Modifica ${who}` }),
      ).toBeVisible();
      await expect(
        row.locator(`[class*="membro-${color}"]`).first(),
      ).toHaveText(initial);
    }
  });

  test("CA-8: pannello notte a 1280 px con marchio, claim, tre adesivi, senza «Pediatra»", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "Il pannello notte c'è solo a 1280 px",
    );
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto(PATH);
    await expect(
      page
        .getByText("FamilyNest", { exact: true })
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    await expect(page.locator(".claim").filter({ visible: true })).toHaveText(
      /La casa,\s*in un posto solo\./,
    );
    for (const sticker of ["Nuoto", "Latte e pane", "Liberi insieme"]) {
      await expect(
        page.locator(".adesivi").filter({ visible: true }),
      ).toContainText(sticker);
    }
    const texts = await page.evaluate(() => [
      document.body.innerText,
      document.body.textContent ?? "",
    ]);
    for (const text of texts) expect(text).not.toContain("Pediatra");
  });

  test("CA-10: l'HTML del server contiene solo il proprio Nest", async ({
    page,
    baseURL,
  }) => {
    await signInAs(page.context(), baseURL as string, "A");
    const response = await page.context().request.get(`${baseURL}${PATH}`);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("Laura");
    for (const other of ["Giulia", "Paolo", "Leo", "Anna"]) {
      expect(html, other).not.toMatch(new RegExp(`\\b${other}\\b`));
    }
    const email = process.env.TEST_USER_A_EMAIL;
    if (email) expect(html).not.toContain(email);
    expect(html).not.toContain("aaaaaaaa-0000-4000-8000-000000000001");
  });

  test("CA-37: nessun testo o campo «Pediatra», «allergie», «salute»", async ({
    page,
    baseURL,
  }) => {
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto(PATH);
    await expect(rows(page)).toHaveCount(5);
    const forbidden = /pediatra|allergi|salute/i;
    expect(await page.evaluate(() => document.body.innerText)).not.toMatch(
      forbidden,
    );
    const edit = await openEdit(page, "Sofia");
    expect(await edit.innerText()).not.toMatch(forbidden);
    await expect(edit.getByLabel(forbidden)).toHaveCount(0);
    await edit.getByRole("button", { name: "Chiudi" }).click();
    await expect(edit).toBeHidden();
    const add = await openAdd(page);
    expect(await add.innerText()).not.toMatch(forbidden);
    await expect(add.getByLabel(forbidden)).toHaveCount(0);
  });
});

// ================================================================ add

test.describe("aggiungere", () => {
  test.beforeEach(() => needsThrowaway());

  test("CA-9: «Solo io» mostra «Passo 2 di 3», una riga e i bottoni abilitati (stato vuoto)", async ({
    page,
    baseURL,
  }) => {
    await withNest("single", async (user) => {
      await openPage(page, user, baseURL);
      const bar = progress(page, "Passo 2 di 3");
      await expect(bar).toHaveAttribute("aria-valuemax", "3");
      await expect(bar.locator(".tacche-passi__tacca")).toHaveCount(3);
      await expect(bar.locator(".tacche-passi__tacca.is-fatta")).toHaveCount(2);
      await expect(rows(page)).toHaveCount(1);
      await expectRow(page, 0, "Ilaria, tu", "Adulto");
      await expect(addButton(page)).toBeEnabled();
      await expect(continua(page)).toBeEnabled();
    });
  });

  test("CA-11: il foglio di aggiunta si apre con i valori iniziali (famiglia con figli)", async ({
    page,
    baseURL,
  }) => {
    await withNest("family_with_children", async (user) => {
      await openPage(page, user, baseURL);
      await expect(list(page)).toBeVisible();
      const d = await openAdd(page);
      await expect(nameField(d)).toBeFocused();
      await expect(nameField(d)).toHaveValue("");
      await expect(nameField(d)).toHaveAttribute(
        "placeholder",
        "Come si chiama?",
      );
      await expect(
        d
          .getByRole("group", { name: "Chi è" })
          .getByRole("button", { pressed: true }),
      ).toHaveText("Figlio o figlia");
      await expect(dateField(d)).toHaveValue("");
      await expect(colorGroup(d).getByRole("radio")).toHaveCount(10);
      await expect(colorRadio(d, "Pomodoro (già di Ilaria)")).toBeDisabled();
      await expect(colorRadio(d, "Glicine")).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await expect(submit(d, "Aggiungi")).toBeVisible();
    });
  });

  test("CA-12: in coppia è scelto «Adulto» e non c'è la data di nascita", async ({
    page,
    baseURL,
  }) => {
    await withNest("couple", async (user) => {
      await openPage(page, user, baseURL);
      const d = await openAdd(page);
      await expect(kindButton(d, "Adulto")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(dateField(d)).toHaveCount(0);
    });
  });

  test("CA-13: aggiungere Sofia con data e colore la mostra in fondo alla lista", async ({
    page,
    baseURL,
  }) => {
    await withNest("family_with_children", async (user) => {
      await openPage(page, user, baseURL);
      const d = await openAdd(page);
      const birth = romeMinus(9);
      await nameField(d).fill("  Sofia  ");
      await kindButton(d, "Figlio o figlia").click();
      await dateField(d).fill(birth);
      await colorRadio(d, "Salvia").click();
      await submit(d, "Aggiungi Sofia").click();
      await expect(d).toBeHidden();
      await expect(rows(page)).toHaveCount(2);
      const row = await expectRow(page, 1, "Sofia", "Figlio o figlia · 9 anni");
      await expect(
        row.locator('[class*="membro-salvia"]').first(),
      ).toBeVisible();
      await expect(addButton(page)).toBeFocused();
      await expect(
        page.getByRole("status").filter({ hasText: "Sofia è nel Nest." }),
      ).toHaveCount(1);
      const sofia = (await members(user)).find((m) => m.name === "Sofia");
      expect(sofia).toMatchObject({
        kind: "child",
        color: "salvia",
        birth_date: birth,
        user_id: null,
      });
    });
  });

  test("CA-14: un adulto aggiunto non crea inviti e non ha data", async ({
    page,
    baseURL,
  }) => {
    await withNest("couple", async (user) => {
      await openPage(page, user, baseURL);
      const d = await openAdd(page);
      await nameField(d).fill("Laura");
      await kindButton(d, "Adulto").click();
      await submit(d, "Aggiungi Laura").click();
      await expect(d).toBeHidden();
      await expectRow(page, 1, "Laura", "Adulto · riceverà un invito");
      const laura = (await members(user)).find((m) => m.name === "Laura");
      expect(laura).toMatchObject({ kind: "adult", birth_date: null });
      const { data, error } = await user.client
        .from("invitations")
        .select("id");
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  test("CA-15: un animale senza data compare come «Animale»", async ({
    page,
    baseURL,
  }) => {
    await withNest("couple", async (user) => {
      await openPage(page, user, baseURL);
      const d = await openAdd(page);
      await nameField(d).fill("Biscotto");
      await kindButton(d, "Animale").click();
      await submit(d, "Aggiungi Biscotto").click();
      await expect(d).toBeHidden();
      await expectRow(page, 1, "Biscotto", "Animale");
      const pet = (await members(user)).find((m) => m.name === "Biscotto");
      expect(pet).toMatchObject({ kind: "pet", birth_date: null });
    });
  });

  test("CA-16: passando ad «Adulto» la data sparisce, torna, e non viene salvata", async ({
    page,
    baseURL,
  }) => {
    await withNest("couple", async (user) => {
      await openPage(page, user, baseURL);
      const d = await openAdd(page);
      const birth = romeMinus(5);
      await nameField(d).fill("Pia");
      await kindButton(d, "Figlio o figlia").click();
      await dateField(d).fill(birth);
      await kindButton(d, "Adulto").click();
      await expect(dateField(d)).toHaveCount(0);
      await kindButton(d, "Figlio o figlia").click();
      await expect(dateField(d)).toHaveValue(birth);
      await kindButton(d, "Adulto").click();
      await submit(d, "Aggiungi Pia").click();
      await expect(d).toBeHidden();
      const pia = (await members(user)).find((m) => m.name === "Pia");
      expect(pia).toMatchObject({ kind: "adult", birth_date: null });
    });
  });

  test("CA-17: dopo il ricaricamento le righe restano in ordine di inserimento", async ({
    page,
    baseURL,
  }) => {
    await withNest("family_with_children", async (user) => {
      await addMember(user, { name: "Laura", kind: "adult", color: "glicine" });
      await addMember(user, { name: "Sofia", kind: "child", color: "salvia" });
      await addMember(user, {
        name: "Biscotto",
        kind: "pet",
        color: "cobalto",
      });
      await openPage(page, user, baseURL);
      await page.reload();
      await expect(rows(page)).toHaveCount(4);
      const titles = ["Ilaria, tu", "Laura", "Sofia", "Biscotto"];
      for (const [i, title] of titles.entries()) {
        await expect(
          rows(page).nth(i).getByText(title, { exact: true }),
        ).toBeVisible();
      }
    });
  });

  test("CA-18: l'età usa anni, mesi e «meno di un mese»", async ({
    page,
    baseURL,
  }) => {
    // "Minus one month" is ambiguous on days 29-31 (the issue says to avoid them).
    test.skip(
      dayOfMonthRome() >= 29,
      "Giorni 29, 30 e 31: «meno 1 mese» è ambiguo",
    );
    await withNest("family_with_children", async (user) => {
      const child = (name: string, color: string, birth_date: string) =>
        addMember(user, { name, kind: "child", color, birth_date });
      await child("Leo", "glicine", romeMinus(1));
      await child("Mia", "salvia", romeMinus(1, 0, 1));
      await child("Ada", "cobalto", romeMinus(0, 1));
      await child("Eva", "zafferano", romeDay(-10));
      await openPage(page, user, baseURL);
      await expectRow(page, 1, "Leo", "Figlio o figlia · 1 anno");
      await expectRow(page, 2, "Mia", "Figlio o figlia · 11 mesi");
      await expectRow(page, 3, "Ada", "Figlio o figlia · 1 mese");
      await expectRow(page, 4, "Eva", "Figlio o figlia · meno di un mese");
    });
  });
});

// ================================================================ sheet errors

test.describe("errori del foglio", () => {
  test.beforeEach(() => needsThrowaway());

  test("CA-19: nome vuoto o di soli spazi mostra l'errore e non scrive", async ({
    page,
    baseURL,
  }) => {
    await withNest("couple", async (user) => {
      await openPage(page, user, baseURL);
      for (const typed of ["", "   "]) {
        const d = await openAdd(page);
        await nameField(d).fill(typed);
        await submit(d, "Aggiungi").click();
        await expect(d).toBeVisible();
        const error = d.getByText("Scrivi il nome per continuare.", {
          exact: true,
        });
        await expect(error).toBeVisible();
        await expect(nameField(d)).toHaveAttribute("aria-invalid", "true");
        const describedBy = await nameField(d).getAttribute("aria-describedby");
        expect(describedBy).toBeTruthy();
        const errorId = await error.getAttribute("id");
        expect(errorId).toBeTruthy();
        expect(describedBy!.split(" ")).toContain(errorId);
        await expect(nameField(d)).toBeFocused();
        expect(await members(user)).toHaveLength(1);
        await d.getByRole("button", { name: "Chiudi" }).click();
        await expect(d).toBeHidden();
      }
    });
  });

  test("CA-20: il nome non supera 40 caratteri", async ({ page, baseURL }) => {
    await withNest("couple", async (user) => {
      await openPage(page, user, baseURL);
      const d = await openAdd(page);
      await nameField(d).click();
      await page.keyboard.insertText("x".repeat(45));
      await expect(nameField(d)).toHaveValue("x".repeat(40));
      await kindButton(d, "Adulto").click();
      await submit(d, /^Aggiungi/).click();
      await expect(d).toBeHidden();
      const all = await members(user);
      expect(all).toHaveLength(2);
      expect(all[1]!.name).toHaveLength(40);
    });
  });

  test("CA-21: una data nel futuro è rifiutata", async ({ page, baseURL }) => {
    await withNest("family_with_children", async (user) => {
      await openPage(page, user, baseURL);
      const d = await openAdd(page);
      await nameField(d).fill("Sofia");
      await kindButton(d, "Figlio o figlia").click();
      await dateField(d).fill(romeDay(1));
      await submit(d, "Aggiungi Sofia").click();
      await expect(
        d.getByText("Questa data è nel futuro: scegli un giorno fino a oggi.", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(dateField(d)).toHaveAttribute("aria-invalid", "true");
      await expect(d).toBeVisible();
      expect(await members(user)).toHaveLength(1);
    });
  });

  test("CA-22: colore preso nel frattempo", async ({ page, baseURL }) => {
    await withNest("couple", async (user) => {
      await openPage(page, user, baseURL);
      const d = await openAdd(page);
      await nameField(d).fill("Rita");
      await kindButton(d, "Adulto").click();
      await colorRadio(d, "Glicine").click();
      await addMember(user, {
        name: "Gianni",
        kind: "adult",
        color: "glicine",
      });
      await submit(d, "Aggiungi Rita").click();
      await expect(d).toBeVisible();
      await expect(nameField(d)).toHaveValue("Rita");
      await expect(
        colorGroup(d).getByRole("radio", { name: /^Glicine/ }),
      ).toBeDisabled();
      await expect(
        colorGroup(d).getByRole("radio", { checked: true }),
      ).toHaveCount(0);
      await expect(
        d.getByText(
          "Questo colore l'ha appena preso qualcun altro: scegline un altro.",
          { exact: true },
        ),
      ).toBeVisible();
      expect((await members(user)).some((m) => m.name === "Rita")).toBe(false);
      await colorRadio(d, "Cobalto").click();
      await submit(d, "Aggiungi Rita").click();
      await expect(d).toBeHidden();
      const rita = (await members(user)).find((m) => m.name === "Rita");
      expect(rita?.color).toBe("cobalto");
    });
  });

  test("CA-23: rete interrotta, avviso con «Riprova» e poi salvataggio riuscito", async ({
    page,
    baseURL,
  }) => {
    await withNest("couple", async (user) => {
      await openPage(page, user, baseURL);
      const d = await openAdd(page);
      await nameField(d).fill("Rita");
      await kindButton(d, "Adulto").click();
      await page.route("**/*", async (route) => {
        if (isSave(route)) await route.abort("connectionfailed");
        else await route.continue();
      });
      await submit(d, "Aggiungi Rita").click();
      await expect(d).toBeVisible();
      await expect(nameField(d)).toHaveValue("Rita");
      await expect(
        d.getByRole("alert").filter({ hasText: SAVE_FAILED }),
      ).toBeVisible();
      await expect(d.getByRole("button", { name: "Riprova" })).toBeVisible();
      expect(await members(user)).toHaveLength(1);
      await page.unroute("**/*");
      await d.getByRole("button", { name: "Riprova" }).click();
      await expect(d).toBeHidden();
      await expectRow(page, 1, "Rita", "Adulto · riceverà un invito");
    });
  });

  test("CA-24: salvataggio lento, bottone occupato, niente doppio invio né chiusura con Esc", async ({
    page,
    baseURL,
  }) => {
    await withNest("couple", async (user) => {
      await openPage(page, user, baseURL);
      const d = await openAdd(page);
      await nameField(d).fill("Rita");
      await kindButton(d, "Adulto").click();
      let saves = 0;
      await page.route("**/*", async (route) => {
        if (isSave(route)) {
          saves += 1;
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        await route.continue();
      });
      const button = submit(d, "Aggiungi Rita");
      await button.click();
      await expect(button).toHaveAttribute("aria-busy", "true");
      await button.click({ force: true });
      await page.keyboard.press("Escape");
      await expect(d).toBeVisible();
      await expect(d).toBeHidden();
      expect(saves).toBe(1);
      await expect
        .poll(
          async () =>
            (await members(user)).filter((m) => m.name === "Rita").length,
        )
        .toBe(1);
    });
  });

  test("CA-25: Chiudi, Esc e Annulla chiudono senza salvare e restituiscono il fuoco", async ({
    page,
    baseURL,
  }, testInfo) => {
    await withNest("couple", async (user) => {
      await openPage(page, user, baseURL);
      const closers: ((d: Locator) => Promise<void>)[] = [
        (d) => d.getByRole("button", { name: "Chiudi" }).click(),
        () => page.keyboard.press("Escape"),
      ];
      if (testInfo.project.name === "desktop") {
        closers.push((d) =>
          d.getByRole("button", { name: "Annulla", exact: true }).click(),
        );
      }
      for (const close of closers) {
        const d = await openAdd(page);
        await expect(nameField(d)).toHaveValue("");
        await nameField(d).fill("Rita");
        await close(d);
        await expect(d).toBeHidden();
        await expect(addButton(page)).toBeFocused();
      }
      expect(await members(user)).toHaveLength(1);
    });
  });
});

// ================================================================ Continua / Indietro

test.describe("Continua e Indietro", () => {
  test("CA-26: «Continua» con un adulto senza account porta a /onboarding/invito e non cambia i membri", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNest("couple", async (user) => {
      await addMember(user, { name: "Laura", kind: "adult", color: "glicine" });
      const before = await members(user);
      await openPage(page, user, baseURL);
      await continua(page).click();
      await expect(page).toHaveURL(/\/onboarding\/invito$/);
      expect(await members(user)).toEqual(before);
    });
  });

  test("CA-26: «Continua» senza adulti da invitare porta a /onboarding/pronto", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNest("family_with_children", async (user) => {
      await addMember(user, { name: "Sofia", kind: "child", color: "salvia" });
      const before = await members(user);
      await openPage(page, user, baseURL);
      await continua(page).click();
      await expect(page).toHaveURL(/\/onboarding\/pronto$/);
      expect(await members(user)).toEqual(before);
    });
  });

  test("CA-26: «Continua» con «Solo io» porta a /onboarding/pronto", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNest("single", async (user) => {
      await openPage(page, user, baseURL);
      await continua(page).click();
      await expect(page).toHaveURL(/\/onboarding\/pronto$/);
    });
  });

  test("CA-27: «Indietro» riapre il passo 1 con la risposta salvata e «Continua» la aggiorna", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNest("couple", async (user) => {
      await openPage(page, user, baseURL);
      const before = await members(user);
      // Mobile: arrow button; desktop: text link.
      await page
        .getByRole("button", { name: "Indietro" })
        .or(page.getByRole("link", { name: "Indietro" }))
        .filter({ visible: true })
        .first()
        .click();
      await expect(page).toHaveURL(/\/onboarding\?cambia=1$/);
      await expect(
        page.getByText("Chi vive con te?").filter({ visible: true }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("radio", { name: "In coppia" }),
      ).toHaveAttribute("aria-checked", "true");
      await expect(progress(page, "Passo 1 di 4")).toBeVisible();
      const solo = page.getByRole("radio", { name: "Solo io" });
      await expect(async () => {
        await solo.click();
        await expect(solo).toHaveAttribute("aria-checked", "true", {
          timeout: 1000,
        });
      }).toPass();
      await page.getByRole("button", { name: "Continua" }).click();
      await expect(page).toHaveURL(/\/onboarding\/persone$/);
      await expect(progress(page, "Passo 2 di 3")).toBeVisible();
      expect(await user.nestCount()).toBe(1);
      const { data } = await user.client
        .from("households")
        .select("household_type");
      expect(data).toEqual([{ household_type: "single" }]);
      expect(await members(user)).toEqual(before);
    });
  });

  test("CA-28: A con ?cambia=1 vede la risposta salvata, B2 va a /oggi", async ({
    page,
    baseURL,
    browser,
  }) => {
    needsUsers("A", "B2");
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/oggi$/);
    await page.goto("/onboarding?cambia=1");
    await expect(
      page.getByText("Chi vive con te?").filter({ visible: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "In famiglia, con figli" }),
    ).toHaveAttribute("aria-checked", "true");
    // A never presses «Continua»: Casa D'Angelo keeps its type.

    const other = await browser.newContext({ locale: "it-IT" });
    try {
      await signInAs(other, baseURL as string, "B2");
      const p = await other.newPage();
      await p.goto(`${baseURL}/onboarding?cambia=1`);
      await expect(p).toHaveURL(/\/oggi$/);
    } finally {
      await other.close();
    }
  });
});

// ================================================================ edit

test.describe("modifica", () => {
  test("CA-29: il foglio di modifica di Sofia (A) ha i dati e i colori giusti", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto(PATH);
    const d = await openEdit(page, "Sofia");
    await expect(nameField(d)).toHaveValue("Sofia");
    await expect(kindButton(d, "Figlio o figlia")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(kindButton(d, "Adulto")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(kindButton(d, "Animale")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(dateField(d)).toHaveValue("2016-12-14");
    const salvia = colorRadio(d, "Salvia");
    await expect(salvia).toBeEnabled();
    await expect(salvia).toHaveAttribute("aria-checked", "true");
    for (const taken of ["Pomodoro", "Glicine", "Cobalto", "Zafferano"]) {
      await expect(
        colorGroup(d).getByRole("radio", { name: new RegExp(`^${taken}`) }),
      ).toBeDisabled();
    }
    await expect(submit(d, "Salva le modifiche")).toBeVisible();
    await d.getByRole("button", { name: "Chiudi" }).click();
    await expect(d).toBeHidden();
  });

  test("CA-30: modificare nome e colore aggiorna la riga al suo posto", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNest("family_with_children", async (user) => {
      const birth = romeMinus(7);
      await addMember(user, {
        name: "Sofia",
        kind: "child",
        color: "salvia",
        birth_date: birth,
      });
      await openPage(page, user, baseURL);
      const d = await openEdit(page, "Sofia");
      await nameField(d).fill("Sofi");
      await colorRadio(d, "Cobalto").click();
      await submit(d, "Salva le modifiche").click();
      await expect(d).toBeHidden();
      const row = await expectRow(page, 1, "Sofi", "Figlio o figlia · 7 anni");
      await expect(
        row.locator('[class*="membro-cobalto"]').first(),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Modifica Sofi" }),
      ).toBeFocused();
      await expect(
        page.getByRole("status").filter({ hasText: "Modifiche salvate." }),
      ).toHaveCount(1);
      const sofi = (await members(user)).find((m) => m.name === "Sofi");
      expect(sofi).toMatchObject({
        kind: "child",
        color: "cobalto",
        birth_date: birth,
      });
    });
  });

  test("CA-31: «tu» resta adulto, senza data, e il nome dell'account non cambia", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNest("couple", async (user) => {
      await openPage(page, user, baseURL);
      const d = await openEdit(page, "Ilaria");
      await expect(dateField(d)).toHaveCount(0);
      await expect(kindButton(d, "Adulto")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(kindButton(d, "Figlio o figlia")).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      await expect(kindButton(d, "Animale")).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      await expect(
        d.getByText(
          "Chi usa FamilyNest con il suo account è sempre un adulto.",
        ),
      ).toBeVisible();
      await nameField(d).fill("Ila");
      await submit(d, "Salva le modifiche").click();
      await expect(d).toBeHidden();
      await expectRow(page, 0, "Ila, tu", "Adulto");
      const { data } = await user.admin
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();
      expect(data?.display_name).toBe("Ilaria De Santis");
    });
  });

  test("CA-32: in modifica un nome vuoto è rifiutato", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNest("family_with_children", async (user) => {
      await addMember(user, { name: "Sofia", kind: "child", color: "salvia" });
      await openPage(page, user, baseURL);
      const d = await openEdit(page, "Sofia");
      await nameField(d).fill("");
      await submit(d, "Salva le modifiche").click();
      await expect(
        d.getByText("Scrivi il nome per continuare.", { exact: true }),
      ).toBeVisible();
      expect((await members(user)).map((m) => m.name)).toContain("Sofia");
    });
  });
});

// ================================================================ full nest

test.describe("Nest al completo", () => {
  test.beforeEach(() => needsThrowaway());

  test("CA-33: con 10 membri «Aggiungi» è disabilitato e le matite no", async ({
    page,
    baseURL,
  }) => {
    await withNest("family_with_children", async (user) => {
      for (const color of COLORS.slice(1)) {
        await addMember(user, {
          name: `M ${label(color)}`,
          kind: "adult",
          color,
        });
      }
      await openPage(page, user, baseURL);
      await expect(rows(page)).toHaveCount(10);
      await expect(addButton(page)).toBeDisabled();
      await expect(
        page.getByText(FULL_MESSAGE, { exact: true }).filter({ visible: true }),
      ).toBeVisible();
      const pencils = page.getByRole("button", { name: /^Modifica / });
      await expect(pencils).toHaveCount(10);
      for (const pencil of await pencils.all()) {
        await expect(pencil).toBeEnabled();
      }
    });
  });

  test("CA-33 (decisione coordinatore): aggiunto il decimo membro, il fuoco va su «Continua»", async ({
    page,
    baseURL,
  }) => {
    await withNest("family_with_children", async (user) => {
      for (const color of COLORS.slice(1, 9)) {
        await addMember(user, {
          name: `M ${label(color)}`,
          kind: "adult",
          color,
        });
      }
      await openPage(page, user, baseURL);
      await expect(rows(page)).toHaveCount(9);
      const d = await openAdd(page);
      await nameField(d).fill("Rita");
      await kindButton(d, "Adulto").click();
      await submit(d, "Aggiungi Rita").click();
      await expect(d).toBeHidden();
      await expect(rows(page)).toHaveCount(10);
      await expect(addButton(page)).toBeDisabled();
      await expect(continua(page)).toBeFocused();
    });
  });

  test("CA-34: il decimo membro arriva nel frattempo, avviso senza «Riprova»", async ({
    page,
    baseURL,
  }) => {
    await withNest("family_with_children", async (user) => {
      for (const color of COLORS.slice(1, 9)) {
        await addMember(user, {
          name: `M ${label(color)}`,
          kind: "adult",
          color,
        });
      }
      await openPage(page, user, baseURL);
      await expect(rows(page)).toHaveCount(9);
      const d = await openAdd(page);
      await nameField(d).fill("Rita");
      await kindButton(d, "Adulto").click();
      await addMember(user, {
        name: "Decimo",
        kind: "adult",
        color: COLORS[9],
      });
      await submit(d, "Aggiungi Rita").click();
      await expect(d).toBeVisible();
      await expect(
        d.getByRole("alert").filter({ hasText: FULL_MESSAGE }),
      ).toBeVisible();
      await expect(d.getByRole("button", { name: "Riprova" })).toHaveCount(0);
      expect((await members(user)).some((m) => m.name === "Rita")).toBe(false);
      await d.getByRole("button", { name: "Chiudi" }).click();
      await expect(d).toBeHidden();
      await expect(addButton(page)).toBeDisabled();
    });
  });
});

// ================================================================ isolation, privacy

test.describe("isolamento e privacy", () => {
  test("CA-35: U non può modificare un membro di Casa Bianchi", async ({
    baseURL,
    browser,
  }) => {
    needsThrowaway();
    needsUsers("B");
    const leoId = "b1000000-0000-4000-8000-000000000003";
    await withNest("couple", async (user) => {
      const { data, error } = await user.client
        .from("household_members")
        .update({ name: "Intruso" })
        .eq("id", leoId)
        .select("id");
      expect(error).toBeNull();
      expect(data ?? []).toEqual([]);
      const { data: seen } = await user.admin
        .from("household_members")
        .select("name")
        .eq("id", leoId)
        .single();
      expect(seen?.name).toBe("Leo");
    });
    // B reads Casa Bianchi again through the page.
    const ctx = await browser.newContext({ locale: "it-IT" });
    try {
      await signInAs(ctx, baseURL as string, "B");
      const p = await ctx.newPage();
      await p.goto(`${baseURL}${PATH}`);
      await expect(list(p).getByText("Leo", { exact: true })).toBeVisible();
      await expect(list(p).getByText("Intruso")).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });

  test("CA-35: le server action usano il client dell'utente, mai quello amministrativo", () => {
    const filesIn = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? filesIn(join(dir, e.name)) : [join(dir, e.name)],
      );
    // TODO(#13): widen the search if the developer places the actions elsewhere.
    const files = [
      ...filesIn("src/app/onboarding/persone"),
      ...filesIn("src/components/onboarding"),
    ].filter((f) => /\.tsx?$/.test(f));
    const actions = files.filter((f) =>
      /^\s*["']use server["']/m.test(readFileSync(f, "utf8")),
    );
    expect(actions.length, "nessuna server action trovata").toBeGreaterThan(0);
    for (const file of actions) {
      const code = readFileSync(file, "utf8");
      expect(code, file).toMatch(/from\s*"@\/lib\/supabase\/server"/);
      expect(code, file).not.toMatch(
        /SUPABASE_SECRET_KEY|supabase\/admin|createAdminClient/,
      );
    }
  });

  test("CA-36: nome e data non finiscono mai nell'indirizzo", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNest("family_with_children", async (user) => {
      await openPage(page, user, baseURL);
      const birth = romeMinus(9);
      const urls: string[] = [];
      page.on("request", (r) => urls.push(r.url()));
      const d = await openAdd(page);
      await nameField(d).fill("Sofia");
      await kindButton(d, "Figlio o figlia").click();
      await dateField(d).fill(birth);
      await submit(d, "Aggiungi Sofia").click();
      expect(pathOf(page)).toBe(PATH);
      await expect(d).toBeHidden();
      await expectRow(page, 1, "Sofia", "Figlio o figlia · 9 anni");
      expect(pathOf(page)).toBe(PATH);
      for (const url of urls) {
        expect(decodeURIComponent(url)).not.toContain("Sofia");
        expect(url).not.toContain(birth);
      }
    });
  });
});
