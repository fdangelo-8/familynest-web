import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  expect,
  test,
  type Locator,
  type Page,
  type Route,
} from "@playwright/test";
import { formatAge } from "../../src/lib/datetime";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import {
  createThrowawayUser,
  throwawayConfigured,
  throwawaySkipReason,
  type ThrowawayUser,
} from "../fixtures/throwaway-user";

// "Il tuo Nest" (#17), tests written in advance from the acceptance criteria.
// Seeded users A, B, B2, C only read; every test that writes uses its own
// throwaway user U (deleted at the end). The Playwright projects are 390
// (mobile) and 1280 (desktop): a criterion that holds only at 390 is skipped
// on desktop, and the other way round.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

const FULL_MESSAGE =
  "Il Nest è al completo: ci stanno al massimo 10 tra persone e animali.";
const NETWORK_ERROR =
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

const isMobileProject = (name: string) => name === "mobile";

function onlyMobile(projectName: string) {
  test.skip(!isMobileProject(projectName), "Criterio valido solo a 390 px");
}

// ---------------------------------------------------------------- helpers

const list = (page: Page) => page.getByRole("list", { name: "Chi c’è" });
const rows = (page: Page) => list(page).getByRole("listitem");
const invite = (page: Page) =>
  page.getByRole("button", { name: "Invita qualcuno" });
// TODO(#17): the number next to "Chi c’è" is `.sezione__info` in the graphic spec.
const count = (page: Page) =>
  page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Chi c’è", level: 2 }) })
    .locator(".sezione__info");

/** Title, info line and avatar of a row. */
async function expectRow(
  row: Locator,
  title: string,
  info: string,
  avatar?: { initial: string; color: string },
) {
  await expect(row.getByText(title, { exact: true })).toBeVisible();
  await expect(row.getByText(info, { exact: true })).toBeVisible();
  if (avatar) {
    const a = row.locator(".avatar");
    await expect(a).toHaveClass(new RegExp(`membro-${avatar.color}\\b`));
    await expect(a).toHaveText(avatar.initial);
  }
}

async function signInSeeded(
  page: Page,
  baseURL: string | undefined,
  key: "A" | "B" | "B2" | "C",
) {
  await signInAs(page.context(), baseURL as string, key);
}

async function withU(
  body: (user: ThrowawayUser) => Promise<void>,
  options: { nest?: "single" | "family_with_children" } = {},
) {
  const user = await createThrowawayUser("Ilaria De Santis");
  try {
    const { error } = await user.client.rpc("create_household", {
      name: "Casa De Santis",
      household_type: options.nest ?? "family_with_children",
      member_name: "Ilaria",
      color: "pomodoro",
    });
    if (error) throw new Error("Nest di prova non creato");
    await body(user);
  } finally {
    await user.remove();
  }
}

async function householdId(user: ThrowawayUser) {
  const { data, error } = await user.client.rpc("current_household_id");
  if (error || !data) throw new Error("Nest di prova non letto");
  return data as string;
}

/** Adds members to the Nest of U, with the client of U (RLS on). */
async function addMembers(
  user: ThrowawayUser,
  specs: { name: string; kind?: "adult" | "child" | "pet"; color: string }[],
) {
  const id = await householdId(user);
  for (const spec of specs) {
    const { error } = await user.client.from("household_members").insert({
      household_id: id,
      kind: spec.kind ?? "child",
      name: spec.name,
      color: spec.color as (typeof COLORS)[number],
    });
    if (error) throw new Error(`Membro ${spec.name} non inserito`);
  }
}

async function members(user: ThrowawayUser) {
  const { data, error } = await user.client
    .from("household_members")
    .select("name, kind, color, birth_date, user_id")
    .order("created_at");
  if (error) throw new Error("Lettura dei membri fallita");
  return data;
}

async function openNestAs(
  page: Page,
  user: ThrowawayUser,
  baseURL: string | undefined,
) {
  await user.signInContext(page.context(), baseURL as string);
  await page.goto("/nest");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

async function openDialog(page: Page) {
  await invite(page).click();
  const dialog = page.getByRole("dialog", { name: "Invita qualcuno" });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** The server action POST of the page (not the Next.js route announcer). */
const isSave = (route: Route) => {
  const request = route.request();
  return request.method() === "POST" && !!request.headers()["next-action"];
};

/** Files with a server action in the folders of the page. */
function actionFiles(): string[] {
  const dirs = [
    join(process.cwd(), "src/app/(app)/nest"),
    join(process.cwd(), "src/components/nest"),
  ];
  const found: string[] = [];
  const walk = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name)) {
        if (/^\s*["']use server["']/m.test(readFileSync(path, "utf8"))) {
          found.push(path);
        }
      }
    }
  };
  dirs.forEach(walk);
  return found;
}

// -------------------------------------------------------------- accesso

test.describe("accesso", () => {
  test("CA-1: senza sessione /nest porta a /accesso", async ({ page }) => {
    await page.goto("/nest");
    await expect(page).toHaveURL(/\/accesso/);
  });

  test("CA-2: utente senza Nest porta a /onboarding", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("C"), skipReason("C"));
    await signInSeeded(page, baseURL, "C");
    await page.goto("/nest");
    await expect(page).toHaveURL(/\/onboarding/);
  });
});

// ------------------------------------------------------------ contenuto

test.describe("contenuto", () => {
  test("CA-3: titolo, h1, Chi c’è, Chiudi e cornice mobile", async ({
    page,
    baseURL,
  }, info) => {
    onlyMobile(info.project.name);
    test.skip(!usersConfigured("A"), skipReason("A"));
    await signInSeeded(page, baseURL, "A");
    await page.goto("/nest");
    await expect(page).toHaveTitle("FamilyNest · Il tuo Nest");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Casa D'Angelo",
    );
    await expect(
      page.getByRole("heading", { name: "Chi c’è", level: 2 }),
    ).toBeVisible();
    await expect(count(page)).toHaveText("5");
    await expect(page.getByRole("link", { name: "Chiudi" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^Apri Casa D'Angelo/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Navigazione principale" }),
    ).toHaveCount(0);
  });

  test("CA-4: i cinque membri di Casa D'Angelo, in ordine, con avatar", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("A"), skipReason("A"));
    await signInSeeded(page, baseURL, "A");
    await page.goto("/nest");
    const r = rows(page);
    await expect(r).toHaveCount(5);
    await expectRow(r.nth(0), "Marco, tu", "Adulto · il tuo profilo", {
      initial: "M",
      color: "pomodoro",
    });
    await expectRow(r.nth(1), "Laura", "Adulto · invito in attesa", {
      initial: "L",
      color: "glicine",
    });
    await expectRow(
      r.nth(2),
      "Sofia",
      `Figlio o figlia, ${formatAge("2016-12-14")}`,
      { initial: "S", color: "salvia" },
    );
    await expectRow(
      r.nth(3),
      "Tommaso",
      `Figlio o figlia, ${formatAge("2020-04-02")}`,
      { initial: "T", color: "cobalto" },
    );
    await expectRow(r.nth(4), "Biscotto", "Animale", {
      initial: "B",
      color: "zafferano",
    });
  });

  test("CA-5: Casa Bianchi vista da B (amministratrice)", async ({
    page,
    baseURL,
  }, info) => {
    onlyMobile(info.project.name);
    test.skip(!usersConfigured("B"), skipReason("B"));
    await signInSeeded(page, baseURL, "B");
    await page.goto("/nest");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Casa Bianchi",
    );
    await expect(count(page)).toHaveText("4");
    const r = rows(page);
    await expect(r).toHaveCount(4);
    await expectRow(r.nth(0), "Giulia, tu", "Adulto · il tuo profilo");
    await expectRow(r.nth(1), "Paolo", "Adulto");
    await expectRow(
      r.nth(2),
      "Leo",
      `Figlio o figlia, ${formatAge("2019-09-05")}`,
    );
    await expectRow(r.nth(3), "Anna", "Adulto · invito scaduto");
    await expect(invite(page)).toBeVisible();
  });

  test("CA-6: B2 (non amministratore) non vede inviti né «Invita qualcuno»", async ({
    page,
    baseURL,
  }, info) => {
    onlyMobile(info.project.name);
    test.skip(!usersConfigured("B2"), skipReason("B2"));
    await signInSeeded(page, baseURL, "B2");
    await page.goto("/nest");
    const r = rows(page);
    await expect(r).toHaveCount(4);
    await expectRow(r.nth(0), "Giulia", "Adulto");
    await expectRow(r.nth(1), "Paolo, tu", "Adulto · il tuo profilo");
    await expectRow(
      r.nth(2),
      "Leo",
      `Figlio o figlia, ${formatAge("2019-09-05")}`,
    );
    await expectRow(r.nth(3), "Anna", "Adulto");
    await expect(page.locator("main")).not.toContainText(/invito/i);
    await expect(
      page.getByRole("button", { name: "Invita qualcuno" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Invita qualcuno" }),
    ).toHaveCount(0);
  });

  test("CA-7: adulto senza invito è «da invitare»", async ({
    page,
    baseURL,
  }, info) => {
    onlyMobile(info.project.name);
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    await withU(async (user) => {
      await addMembers(user, [
        { name: "Laura", kind: "adult", color: "glicine" },
      ]);
      await openNestAs(page, user, baseURL);
      await expectRow(rows(page).nth(1), "Laura", "Adulto · da invitare");
    });
  });

  test("CA-8: solo la propria riga è un link, verso /profilo", async ({
    page,
    baseURL,
  }, info) => {
    onlyMobile(info.project.name);
    test.skip(!usersConfigured("A"), skipReason("A"));
    await signInSeeded(page, baseURL, "A");
    await page.goto("/nest");
    const r = rows(page);
    await expect(r.nth(0).getByRole("link")).toHaveCount(1);
    for (const i of [1, 2, 3, 4]) {
      await expect(r.nth(i).getByRole("link")).toHaveCount(0);
    }
    await r.nth(0).getByRole("link").click();
    await expect(page).toHaveURL(/\/profilo$/);
  });

  test("CA-9: Esplora e l'elenco delle impostazioni", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("A"), skipReason("A"));
    await signInSeeded(page, baseURL, "A");
    await page.goto("/nest");
    const porta = page.getByRole("link", { name: /Esplora.*Cosa può fare/ });
    await expect(porta).toHaveAttribute("href", "/esplora");
    const expected = [
      ["Calendari collegati", "/calendari-collegati"],
      ["Notifiche", "/notifiche"],
      ["Impostazioni della casa", "/impostazioni"],
    ] as const;
    const ys: number[] = [];
    for (const [name, href] of expected) {
      const link = page
        .locator("main")
        .getByRole("link", { name: new RegExp(`^${name}`) });
      await expect(link).toHaveAttribute("href", href);
      ys.push((await link.boundingBox())!.y);
    }
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    await expect(
      page
        .locator("main")
        .getByRole("link", { name: /^Impostazioni della casa/ }),
    ).toContainText("Piano, membri, aspetto");
    for (const absent of [
      "Profili dei figli",
      "spazi da scoprire",
      "attivi",
      "nuove",
    ]) {
      await expect(page.locator("main")).not.toContainText(absent);
    }
    await porta.click();
    await expect(page).toHaveURL(/\/esplora$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Esplora");
  });

  test("CA-10: desktop con navigazione alta, senza X e due colonne", async ({
    page,
    baseURL,
  }, info) => {
    test.skip(
      isMobileProject(info.project.name),
      "Criterio valido solo a 1280 px",
    );
    test.skip(!usersConfigured("A"), skipReason("A"));
    await signInSeeded(page, baseURL, "A");
    await page.goto("/nest");
    const nav = page.getByRole("navigation", {
      name: "Navigazione principale",
    });
    await expect(nav).toBeVisible();
    // TODO(#17): the names of the three links are taken from the navigation
    // labels ("Oggi", "Calendario", "Casa"); the spec gives no other names.
    for (const name of ["Oggi", "Calendario", "Casa"]) {
      const link = nav.getByRole("link", { name });
      await expect(link).toBeVisible();
      await expect(link).not.toHaveAttribute("aria-current", /.+/);
    }
    await expect(
      page.getByRole("link", {
        name: "Apri Casa D'Angelo: membri, Esplora e impostazioni",
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Chiudi" })).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Impostazioni" }),
    ).toHaveCount(0);
    const listBox = (await list(page).boundingBox())!;
    const listRight = listBox.x + listBox.width;
    const porta = (await page
      .getByRole("link", { name: /Esplora.*Cosa può fare/ })
      .boundingBox())!;
    const button = (await invite(page).boundingBox())!;
    expect(porta.x).toBeGreaterThanOrEqual(listRight);
    expect(button.x).toBeGreaterThanOrEqual(listRight);
  });

  test("CA-11: Nest «Solo io», stato vuoto", async ({ page, baseURL }) => {
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    await withU(
      async (user) => {
        await openNestAs(page, user, baseURL);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          "Casa De Santis",
        );
        await expect(count(page)).toHaveText("1");
        await expect(rows(page)).toHaveCount(1);
        await expectRow(
          rows(page).first(),
          "Ilaria, tu",
          "Adulto · il tuo profilo",
        );
        await expect(invite(page)).toBeEnabled();
      },
      { nest: "single" },
    );
  });
});

// ------------------------------------------------------- chiudi (mobile)

test.describe("chiudi", () => {
  test.beforeEach(({}, info) => {
    onlyMobile(info.project.name);
    test.skip(!usersConfigured("A"), skipReason("A"));
  });

  test("CA-12: dal Nest «Chiudi» torna alla pagina di partenza", async ({
    page,
    baseURL,
  }) => {
    await signInSeeded(page, baseURL, "A");
    await page.goto("/casa/spesa");
    // TODO(#17): the Nest square on /casa/spesa is the link "Apri Casa D'Angelo: ...".
    await page.getByRole("link", { name: /^Apri Casa D'Angelo/ }).click();
    await expect(page).toHaveURL(/\/nest$/);
    await page.getByRole("link", { name: "Chiudi" }).click();
    await expect(page).toHaveURL(/\/casa\/spesa$/);
  });

  test("CA-13: /nest aperto direttamente, «Chiudi» porta a /oggi", async ({
    page,
    baseURL,
  }) => {
    await signInSeeded(page, baseURL, "A");
    await page.goto("/nest");
    await page.getByRole("link", { name: "Chiudi" }).click();
    await expect(page).toHaveURL(/\/oggi$/);
  });

  // The entry from the bottom was removed for now (it comes with #104), so
  // the page has no animation, with or without reduced motion.
  for (const reducedMotion of ["reduce", "no-preference"] as const) {
    test(`CA-14: nessuna animazione sulla pagina (movimento ${reducedMotion})`, async ({
      page,
      baseURL,
    }) => {
      await page.emulateMedia({ reducedMotion });
      await signInSeeded(page, baseURL, "A");
      await page.goto("/nest");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // During streaming a hidden second <main> may exist for a moment: only
      // the main of the accessibility tree counts.
      const main = page.getByRole("main");
      await expect(main).toHaveCount(1);
      const names = await main.evaluate((el) =>
        [el, ...Array.from(el.children)].map(
          (node) => getComputedStyle(node).animationName,
        ),
      );
      expect(names.length).toBeGreaterThan(1);
      expect(names.every((n) => n === "none")).toBe(true);
    });
  }
});

// ------------------------------------------------------ invita qualcuno

test.describe("invita qualcuno", () => {
  test("CA-15: il dialogo, i colori e la chiusura senza salvare", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("A"), skipReason("A"));
    await signInSeeded(page, baseURL, "A");
    await page.goto("/nest");
    const dialog = await openDialog(page);
    const name = dialog.getByLabel("Nome");
    await expect(name).toBeFocused();
    await expect(name).toHaveValue("");
    await expect(name).toHaveAttribute("placeholder", "Come si chiama?");
    await expect(dialog.getByRole("group", { name: "Chi è" })).toHaveCount(0);
    await expect(dialog.getByLabel("Data di nascita")).toHaveCount(0);
    await expect(dialog.getByRole("radio")).toHaveCount(10);
    for (const taken of [
      "Pomodoro (già di Marco)",
      "Glicine (già di Laura)",
      "Salvia (già di Sofia)",
      "Cobalto (già di Tommaso)",
      "Zafferano (già di Biscotto)",
    ]) {
      await expect(dialog.getByRole("radio", { name: taken })).toBeDisabled();
    }
    // The sixth colour of MEMBER_COLORS (lampone) is the first free one.
    await expect(
      dialog.getByRole("radio", { name: /^Lampone/ }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(
      dialog.locator('[role="radio"][aria-checked="true"]'),
    ).toHaveCount(1);
    await expect(
      dialog.getByRole("button", { name: "Continua" }),
    ).toBeVisible();
    // TODO(#17): the sheet "Chiudi" is a button named "Chiudi" inside the dialog.
    await dialog.getByRole("button", { name: "Chiudi" }).click();
    await expect(dialog).toBeHidden();
    await expect(count(page)).toHaveText("5");
    await expect(rows(page)).toHaveCount(5);
  });

  test("CA-16: «  Laura  » con Glicine crea l'adulto «da invitare»", async ({
    page,
    baseURL,
  }, info) => {
    onlyMobile(info.project.name);
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    await withU(async (user) => {
      await openNestAs(page, user, baseURL);
      const dialog = await openDialog(page);
      await dialog.getByLabel("Nome").fill("  Laura  ");
      await dialog.getByRole("radio", { name: "Glicine" }).click();
      await dialog.getByRole("button", { name: "Continua" }).click();
      await expect(dialog).toBeHidden();
      await expectRow(rows(page).nth(1), "Laura", "Adulto · da invitare", {
        initial: "L",
        color: "glicine",
      });
      await expect(count(page)).toHaveText("2");
      await expect(invite(page)).toBeFocused();
      await expect(
        page.getByRole("status").filter({ hasText: "Laura è nel Nest." }),
      ).toHaveCount(1);
      const url = new URL(page.url());
      expect(url.pathname + url.search).toBe("/nest");
      const saved = (await members(user)).filter((m) => m.name === "Laura");
      expect(saved).toEqual([
        {
          name: "Laura",
          kind: "adult",
          color: "glicine",
          birth_date: null,
          user_id: null,
        },
      ]);
      const inv = await user.client.from("invitations").select("id");
      expect(inv.error).toBeNull();
      expect(inv.data).toEqual([]);
    });
  });

  test("CA-17: nome vuoto o solo spazi, errore sotto il campo", async ({
    page,
    baseURL,
  }) => {
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    await withU(async (user) => {
      await openNestAs(page, user, baseURL);
      const dialog = await openDialog(page);
      const name = dialog.getByLabel("Nome");
      for (const typed of ["", "   "]) {
        await name.fill(typed);
        await dialog.getByRole("button", { name: "Continua" }).click();
        await expect(dialog).toBeVisible();
        const message = dialog.getByText("Scrivi il nome per continuare.");
        await expect(message).toBeVisible();
        await expect(name).toHaveAttribute("aria-invalid", "true");
        const messageId = await message.getAttribute("id");
        expect(messageId).toBeTruthy();
        const describedBy = await name.getAttribute("aria-describedby");
        expect((describedBy ?? "").split(" ")).toContain(messageId);
        await expect(name).toBeFocused();
      }
      expect(await members(user)).toHaveLength(1);
    });
  });

  test("CA-18: il nome ha al massimo 40 caratteri", async ({
    page,
    baseURL,
  }, info) => {
    onlyMobile(info.project.name);
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    await withU(async (user) => {
      await openNestAs(page, user, baseURL);
      const dialog = await openDialog(page);
      const name = dialog.getByLabel("Nome");
      await name.pressSequentially("a".repeat(45));
      await expect(name).toHaveValue("a".repeat(40));
      await dialog.getByRole("button", { name: "Continua" }).click();
      await expect(dialog).toBeHidden();
      const adults = (await members(user)).filter((m) => m.kind === "adult");
      expect(adults.map((m) => m.name.length).sort((a, b) => a - b)).toEqual([
        6, 40,
      ]);
    });
  });

  test("CA-19: colore preso nel frattempo", async ({ page, baseURL }, info) => {
    onlyMobile(info.project.name);
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    await withU(async (user) => {
      await openNestAs(page, user, baseURL);
      const dialog = await openDialog(page);
      await dialog.getByLabel("Nome").fill("Rita");
      await dialog.getByRole("radio", { name: "Glicine" }).click();
      await addMembers(user, [{ name: "Intruso", color: "glicine" }]);
      await dialog.getByRole("button", { name: "Continua" }).click();
      await expect(dialog).toBeVisible();
      await expect(dialog.getByLabel("Nome")).toHaveValue("Rita");
      await expect(
        dialog.getByRole("radio", { name: /^Glicine/ }),
      ).toBeDisabled();
      await expect(
        dialog.locator('[role="radio"][aria-checked="true"]'),
      ).toHaveCount(0);
      await expect(
        dialog.getByText(
          "Questo colore l'ha appena preso qualcun altro: scegline un altro.",
        ),
      ).toBeVisible();
      expect((await members(user)).some((m) => m.name === "Rita")).toBe(false);

      await dialog.getByRole("radio", { name: "Cobalto" }).click();
      await dialog.getByRole("button", { name: "Continua" }).click();
      await expect(dialog).toBeHidden();
      const rita = (await members(user)).find((m) => m.name === "Rita");
      expect(rita).toMatchObject({ kind: "adult", color: "cobalto" });
    });
  });

  test("CA-20: rete interrotta, errore con «Riprova»", async ({
    page,
    baseURL,
  }, info) => {
    onlyMobile(info.project.name);
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    await withU(async (user) => {
      await openNestAs(page, user, baseURL);
      const dialog = await openDialog(page);
      await dialog.getByLabel("Nome").fill("Rita");
      await page.route("**/nest", async (route) => {
        if (isSave(route)) await route.abort("connectionfailed");
        else await route.continue();
      });
      await dialog.getByRole("button", { name: "Continua" }).click();
      await expect(dialog).toBeVisible();
      await expect(dialog.getByLabel("Nome")).toHaveValue("Rita");
      const alert = dialog
        .getByRole("alert")
        .filter({ hasText: "Non siamo riusciti" });
      await expect(alert).toContainText(NETWORK_ERROR);
      await expect(
        alert.getByRole("button", { name: "Riprova" }),
      ).toBeVisible();
      expect(await members(user)).toHaveLength(1);

      await page.unroute("**/nest");
      await alert.getByRole("button", { name: "Riprova" }).click();
      await expect(dialog).toBeHidden();
      await expect(rows(page).filter({ hasText: "Rita" })).toHaveCount(1);
    });
  });

  test("CA-21: due clic su «Continua» salvano una sola volta", async ({
    page,
    baseURL,
  }, info) => {
    onlyMobile(info.project.name);
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    await withU(async (user) => {
      await openNestAs(page, user, baseURL);
      const dialog = await openDialog(page);
      await dialog.getByLabel("Nome").fill("Rita");
      let saves = 0;
      await page.route("**/nest", async (route) => {
        if (isSave(route)) {
          saves += 1;
          // Slows the answer down by 2 seconds (not a wait of the test).
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        await route.continue();
      });
      const button = dialog.getByRole("button", { name: "Continua" });
      await button.click();
      await expect(button).toHaveAttribute("aria-busy", "true");
      await button.click({ force: true });
      await page.keyboard.press("Escape");
      await expect(dialog).toBeVisible();
      await expect(dialog).toBeHidden({ timeout: 15_000 });
      await expect(rows(page).filter({ hasText: "Rita" })).toHaveCount(1);
      expect(saves).toBe(1);
      expect(
        (await members(user)).filter((m) => m.name === "Rita"),
      ).toHaveLength(1);
    });
  });

  test("CA-22: Chiudi, Esc o Annulla non salvano e rendono il fuoco", async ({
    page,
    baseURL,
  }, info) => {
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    const desktop = !isMobileProject(info.project.name);
    await withU(async (user) => {
      await openNestAs(page, user, baseURL);
      const closers: ((d: Locator) => Promise<void>)[] = [
        (d) => d.getByRole("button", { name: "Chiudi" }).click(),
        () => page.keyboard.press("Escape"),
      ];
      // "Annulla" exists only on desktop (modal footer).
      if (desktop) {
        closers.push((d) => d.getByRole("button", { name: "Annulla" }).click());
      }
      for (const close of closers) {
        const dialog = await openDialog(page);
        await expect(dialog.getByLabel("Nome")).toHaveValue("");
        await dialog.getByLabel("Nome").fill("Rita");
        await close(dialog);
        await expect(dialog).toBeHidden();
        await expect(invite(page)).toBeFocused();
      }
      expect(await members(user)).toHaveLength(1);
    });
  });

  test("CA-23: Nest con 10 membri, «Invita qualcuno» spento", async ({
    page,
    baseURL,
  }, info) => {
    onlyMobile(info.project.name);
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    await withU(async (user) => {
      await addMembers(
        user,
        COLORS.slice(1).map((color, i) => ({ name: `Membro ${i + 1}`, color })),
      );
      await openNestAs(page, user, baseURL);
      await expect(count(page)).toHaveText("10");
      await expect(rows(page)).toHaveCount(10);
      await expect(invite(page)).toBeDisabled();
      await expect(page.getByText(FULL_MESSAGE)).toBeVisible();
    });
  });

  test("CA-24: il decimo membro arriva mentre il dialogo è aperto", async ({
    page,
    baseURL,
  }, info) => {
    onlyMobile(info.project.name);
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    await withU(async (user) => {
      await addMembers(
        user,
        COLORS.slice(1, 9).map((color, i) => ({
          name: `Membro ${i + 1}`,
          color,
        })),
      );
      await openNestAs(page, user, baseURL);
      await expect(rows(page)).toHaveCount(9);
      const dialog = await openDialog(page);
      await dialog.getByLabel("Nome").fill("Rita");
      await addMembers(user, [{ name: "Ultimo", color: COLORS[9] }]);
      await dialog.getByRole("button", { name: "Continua" }).click();
      await expect(dialog).toBeVisible();
      const alert = dialog
        .getByRole("alert")
        .filter({ hasText: "Il Nest è al completo" });
      await expect(alert).toContainText(FULL_MESSAGE);
      await expect(alert.getByRole("button", { name: "Riprova" })).toHaveCount(
        0,
      );
      expect((await members(user)).some((m) => m.name === "Rita")).toBe(false);
      await dialog.getByRole("button", { name: "Chiudi" }).click();
      await expect(dialog).toBeHidden();
      await expect(invite(page)).toBeDisabled();
    });
  });
});

// ----------------------------------------------- isolamento e privacy

test.describe("isolamento e privacy", () => {
  test("CA-25: l'HTML del server contiene solo il Nest di A, senza dati sensibili", async ({
    page,
    baseURL,
  }, info) => {
    onlyMobile(info.project.name);
    test.skip(!usersConfigured("A"), skipReason("A"));
    test.skip(
      !secretKey || !supabaseUrl,
      "Chiave amministrativa non impostata",
    );
    await signInSeeded(page, baseURL, "A");
    const response = await page.request.get("/nest");
    expect(response.ok()).toBe(true);
    const html = await response.text();
    // Sanity check: the page is the Nest of A.
    expect(html).toContain("Marco");

    const admin = createClient(supabaseUrl!, secretKey!, {
      auth: { persistSession: false },
    });
    const emailA = process.env.TEST_USER_A_EMAIL!;
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
    const accountId = users?.users.find((u) => u.email === emailA)?.id;
    expect(accountId).toBeTruthy();
    const { data: laura } = await admin
      .from("household_members")
      .select("id, households!inner(name)")
      .eq("name", "Laura")
      .eq("households.name", "Casa D'Angelo")
      .limit(1);
    const { data: invitations } = await admin
      .from("invitations")
      .select("token")
      .eq("member_id", laura![0]!.id);
    const token = invitations![0]!.token;

    const forbidden: [string, string][] = [
      ["Giulia", "Giulia"],
      ["Paolo", "Paolo"],
      ["Leo", "Leo"],
      ["Anna", "Anna"],
      ["Casa Bianchi", "Casa Bianchi"],
      ["la mail di A", emailA],
      ["l'id dell'account di A", accountId!],
      ["il codice dell'invito", "4821"],
      ["il token dell'invito", token],
      ["la data di Sofia", "2016-12-14"],
      ["la data di Tommaso", "2020-04-02"],
    ];
    for (const [label, text] of forbidden) {
      expect(html, `L'HTML non deve contenere ${label}`).not.toContain(text);
    }
  });

  test("CA-26: B2 non può inserire adulti; la server action usa il client dell'utente", async ({}, info) => {
    onlyMobile(info.project.name);
    test.skip(!usersConfigured("B2"), skipReason("B2"));
    test.skip(
      !secretKey || !supabaseUrl,
      "Chiave amministrativa non impostata",
    );
    const client = createClient(supabaseUrl!, publishableKey!, {
      auth: { persistSession: false },
    });
    const signed = await client.auth.signInWithPassword({
      email: process.env.TEST_USER_B2_EMAIL!,
      password: process.env.TEST_USER_B2_PASSWORD!,
    });
    expect(signed.error).toBeNull();
    const { data: nests } = await client.from("households").select("id");
    expect(nests).toHaveLength(1);
    const { error } = await client.from("household_members").insert({
      household_id: nests![0]!.id,
      kind: "adult",
      name: "Intruso",
      color: "lampone",
    });
    expect(error).not.toBeNull();
    const admin = createClient(supabaseUrl!, secretKey!, {
      auth: { persistSession: false },
    });
    const { data: found } = await admin
      .from("household_members")
      .select("id")
      .eq("name", "Intruso");
    expect(found).toEqual([]);

    // Static check on the server action of the page.
    // TODO(#17): the file of the server action is not in the spec: every file
    // with "use server" in the folders of the page is checked.
    const files = actionFiles();
    expect(
      files.length,
      "Nessuna server action trovata per /nest",
    ).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).toMatch(/lib\/supabase\/server/);
      expect(source).toMatch(/createClient/);
      expect(source).not.toMatch(/SUPABASE_SECRET_KEY/);
      expect(source).not.toMatch(/supabase\/admin|createAdminClient/);
    }
  });

  test("CA-27: U non legge i membri né gli inviti di Casa D'Angelo", async ({
    page,
    baseURL,
  }, info) => {
    onlyMobile(info.project.name);
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    await withU(async (user) => {
      const { data: target } = await user.admin
        .from("households")
        .select("id")
        .eq("name", "Casa D'Angelo")
        .single();
      expect(target).not.toBeNull();
      const m = await user.client
        .from("household_members")
        .select("id")
        .eq("household_id", target!.id);
      const i = await user.client
        .from("invitations")
        .select("id")
        .eq("household_id", target!.id);
      expect(m.data ?? []).toHaveLength(0);
      expect(i.data ?? []).toHaveLength(0);
      await openNestAs(page, user, baseURL);
      await expect(rows(page)).toHaveCount(1);
      await expectRow(
        rows(page).first(),
        "Ilaria, tu",
        "Adulto · il tuo profilo",
      );
    });
  });

  test("CA-28: il nome non finisce mai nell'indirizzo", async ({
    page,
    baseURL,
  }, info) => {
    onlyMobile(info.project.name);
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    await withU(async (user) => {
      await openNestAs(page, user, baseURL);
      const urls: string[] = [];
      page.on("request", (request) => urls.push(request.url()));
      const dialog = await openDialog(page);
      await dialog.getByLabel("Nome").fill("Laura");
      await dialog.getByRole("button", { name: "Continua" }).click();
      await expect(dialog).toBeHidden();
      await expect(rows(page).filter({ hasText: "Laura" })).toHaveCount(1);
      expect(urls.filter((url) => /laura/i.test(url))).toEqual([]);
      const url = new URL(page.url());
      expect(url.pathname).toBe("/nest");
      expect(url.search).toBe("");
    });
  });
});

// ------------------------------------------------------------- errore

test.describe("errore", () => {
  test("CA-29: la pagina controlla il Nest prima di leggere e mostra l'errore con «Riprova»", async ({}, info) => {
    onlyMobile(info.project.name);
    const source = readFileSync(
      join(process.cwd(), "src/app/(app)/nest/page.tsx"),
      "utf8",
    );
    const guard = source.indexOf("await requireNest()");
    expect(guard).toBeGreaterThan(-1);
    // The first reading in the component is the call to `load`.
    const firstRead = source.indexOf("await load(");
    expect(firstRead).toBeGreaterThan(guard);
    // Any failed reading returns null and the page shows the error, no partial content.
    expect(source).toMatch(/if \(!loaded\) return <NestError/);
    expect(source).not.toMatch(
      /SUPABASE_SECRET_KEY|supabase\/admin|createAdminClient/,
    );
    const error = readFileSync(
      join(process.cwd(), "src/components/nest/NestError.tsx"),
      "utf8",
    );
    expect(error).toMatch(/ErrorMain/);
    expect(error).toMatch(/router\.refresh\(\)/);
    const errorMain = readFileSync(
      join(process.cwd(), "src/components/ui/AppFrame/ErrorMain.tsx"),
      "utf8",
    );
    expect(errorMain).toContain("Torna a Oggi");
    const pageError = readFileSync(
      join(process.cwd(), "src/components/ui/PageError/PageError.tsx"),
      "utf8",
    );
    expect(pageError).toContain("Riprova");
  });
});
