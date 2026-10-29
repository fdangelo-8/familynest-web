import { expect, test, type Page } from "@playwright/test";
import {
  CHOOSABLE_COLORS,
  firstFreeColor,
  memberColorLabel,
} from "../../src/components/ui/ColorChoice/ColorChoice";
import {
  signInAs,
  skipReason,
  usersConfigured,
  type TestUserKey,
} from "../fixtures/auth";
import { formatAge } from "../../src/lib/datetime";

// Added by the functional tester for #85 (PR #94): edge cases of the shared
// parts, the rules of #13 and #17 that touch them, the "In arrivo" page of
// /esplora and the close X of the Nest. The sheet never writes anywhere: the
// demo page /design-system/membri records what the sheet hands to the page.

const DEMO = "/design-system/membri";
const ADD = "Aggiungi una persona o un animale";
const INVITE = "Invita qualcuno";

async function openSheet(page: Page, name: string) {
  await page.goto(DEMO);
  await page.getByRole("button", { name }).click();
  return page.getByRole("dialog");
}

function withUser(...users: TestUserKey[]) {
  test.skip(!usersConfigured(...users), skipReason(...users));
}

test.describe("formatAge: casi limite", () => {
  const now = "2026-10-29T12:00:00Z";

  test("anni interi, compleanno non ancora arrivato e 29 febbraio", () => {
    expect(formatAge("2024-10-29", now)).toBe("2 anni");
    expect(formatAge("2024-10-30", now)).toBe("1 anno");
    expect(formatAge("2025-10-29", now)).toBe("1 anno");
    expect(formatAge("2024-02-29", "2027-02-28T12:00:00Z")).toBe("2 anni");
    expect(formatAge("2024-02-29", "2027-03-01T12:00:00Z")).toBe("3 anni");
  });

  test("il «oggi» è il giorno di Roma, non quello di Greenwich", () => {
    // 22:30 UTC of the 28th is 23:30 in Rome (CET): still the 28th
    expect(formatAge("2025-10-29", "2026-10-28T22:30:00Z")).toBe("11 mesi");
    // 23:30 UTC of the 28th is 00:30 of the 29th in Rome
    expect(formatAge("2025-10-29", "2026-10-28T23:30:00Z")).toBe("1 anno");
  });

  test("un neonato di oggi e uno di ieri sono «meno di un mese»", () => {
    expect(formatAge("2026-10-28", now)).toBe("meno di un mese");
    expect(formatAge("2026-10-29", now)).toBe("meno di un mese");
  });
});

test.describe("ColorChoice: funzioni di supporto", () => {
  test("10 colori nell'ordine base, nomi con la maiuscola", () => {
    expect(CHOOSABLE_COLORS).toHaveLength(10);
    expect(CHOOSABLE_COLORS.slice(0, 5)).toEqual([
      "pomodoro",
      "glicine",
      "salvia",
      "cobalto",
      "zafferano",
    ]);
    expect(memberColorLabel("salvia")).toBe("Salvia");
  });

  test("il primo colore libero salta i presi; con 10 presi non ce n'è", () => {
    expect(firstFreeColor([])).toBe("pomodoro");
    expect(firstFreeColor([{ color: "pomodoro" }, { color: "glicine" }])).toBe(
      "salvia",
    );
    // the five colours of Casa D'Angelo: the sixth is the first free one
    expect(
      firstFreeColor(CHOOSABLE_COLORS.slice(0, 5).map((color) => ({ color }))),
    ).toBe("lampone");
    expect(
      firstFreeColor(CHOOSABLE_COLORS.map((color) => ({ color }))),
    ).toBeNull();
  });
});

test.describe("ColorChoice: pagina dimostrativa", () => {
  test("clic su un colore libero lo sceglie, su uno spento non fa nulla", async ({
    page,
  }) => {
    await page.goto(DEMO);
    const group = page.getByRole("radiogroup", { name: "Il tuo colore" });
    await group.getByRole("radio", { name: "Cobalto" }).click();
    await expect(group.getByRole("radio", { name: "Cobalto" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(group.getByRole("radio", { name: "Salvia" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await group
      .getByRole("radio", { name: "Pomodoro (già di Marco)" })
      .click({ force: true });
    await expect(group.getByRole("radio", { name: "Cobalto" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("Maiusc+Tab torna sul colore scelto: un solo punto di Tab", async ({
    page,
  }) => {
    await page.goto(DEMO);
    const group = page.getByRole("radiogroup", { name: "Il tuo colore" });
    await group.getByRole("radio", { name: "Cobalto" }).click();
    await page.keyboard.press("Tab");
    await expect(
      group.getByRole("radio").and(page.locator(":focus")),
    ).toHaveCount(0);
    await page.keyboard.press("Shift+Tab");
    await expect(group.getByRole("radio", { name: "Cobalto" })).toBeFocused();
  });

  test("i cerchi distano almeno 44 px (area di tocco)", async ({ page }) => {
    await page.goto(DEMO);
    const centers = await page
      .getByRole("radiogroup", { name: "Il tuo colore" })
      .getByRole("radio")
      .evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }),
      );
    for (let i = 1; i < 5; i += 1) {
      expect(centers[i]!.x - centers[i - 1]!.x).toBeGreaterThanOrEqual(44);
    }
    expect(centers[5]!.y - centers[0]!.y).toBeGreaterThanOrEqual(44);
  });
});

test.describe("MemberSheet: aggiunta, regole dei campi", () => {
  test("testi di aiuto, e «Annulla» solo su desktop", async ({
    page,
  }, testInfo) => {
    const dialog = await openSheet(page, ADD);
    await expect(
      dialog.getByText("Serve a calcolare l'età e a ricordare il compleanno."),
    ).toBeVisible();
    await expect(
      dialog.getByText("I colori spenti sono già di qualcun altro."),
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Annulla" })).toHaveCount(
      testInfo.project.name === "desktop" ? 1 : 0,
    );
  });

  test("il campo non accetta più di 40 caratteri e il valore salvato ne ha 40", async ({
    page,
  }) => {
    const dialog = await openSheet(page, ADD);
    const name = dialog.getByLabel("Nome");
    await name.click();
    await page.keyboard.type("x".repeat(45));
    await expect(name).toHaveValue("x".repeat(40));
    await dialog.getByRole("button", { name: "Aggiungi", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const saved = JSON.parse(
      (await page.getByTestId("membri-salvato").textContent()) ?? "{}",
    ) as { name: string };
    expect(saved.name).toHaveLength(40);
  });

  test("nome vuoto: aria-describedby punta al testo dell'errore, che resta mentre si scrive", async ({
    page,
  }) => {
    const dialog = await openSheet(page, ADD);
    const name = dialog.getByLabel("Nome");
    await dialog.getByRole("button", { name: "Aggiungi", exact: true }).click();
    const error = dialog.getByText("Scrivi il nome per continuare.");
    await expect(error).toBeVisible();
    await expect(name).toHaveAccessibleDescription(
      "Scrivi il nome per continuare.",
    );
    await name.pressSequentially("Ri");
    await expect(error).toBeVisible();
    await expect(name).toHaveAttribute("aria-invalid", "true");
  });

  test("l'errore del nome sparisce al salvataggio successivo", async ({
    page,
  }) => {
    await page.goto(DEMO);
    await page.getByRole("button", { name: "Server" }).click();
    await page.getByRole("button", { name: ADD }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Aggiungi", exact: true }).click();
    await expect(
      dialog.getByText("Scrivi il nome per continuare."),
    ).toBeVisible();
    await dialog.getByLabel("Nome").fill("Rita");
    await dialog.getByRole("button", { name: "Aggiungi Rita" }).click();
    await expect(dialog.getByRole("alert")).toContainText("problema nostro");
    await expect(
      dialog.getByText("Scrivi il nome per continuare."),
    ).toHaveCount(0);
    await expect(dialog.getByLabel("Nome")).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  test("data nel futuro: il campo data è segnato, descritto e ha il fuoco", async ({
    page,
  }) => {
    const dialog = await openSheet(page, ADD);
    await dialog.getByLabel("Nome").fill("Sofia");
    const date = dialog.getByLabel("Data di nascita");
    await expect(date).toHaveAttribute("max", /^\d{4}-\d{2}-\d{2}$/);
    await date.evaluate((input) => {
      const element = input as HTMLInputElement;
      element.removeAttribute("max");
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(element, "2099-01-01");
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await dialog.getByRole("button", { name: "Aggiungi Sofia" }).click();
    await expect(date).toHaveAttribute("aria-invalid", "true");
    await expect(date).toBeFocused();
    await expect(date).toHaveAccessibleDescription(
      /Questa data è nel futuro: scegli un giorno fino a oggi\./,
    );
  });

  test("la data di oggi a Roma è accettata", async ({ page }) => {
    const today = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Rome",
    }).format(new Date());
    const dialog = await openSheet(page, ADD);
    await dialog.getByLabel("Nome").fill("Neo");
    await dialog.getByLabel("Data di nascita").fill(today);
    await dialog.getByRole("button", { name: "Aggiungi Neo" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("membri-salvato")).toContainText(
      `"birthDate":"${today}"`,
    );
  });

  test("Animale senza data: salva con data nulla", async ({ page }) => {
    const dialog = await openSheet(page, ADD);
    await dialog.getByLabel("Nome").fill("Biscotto");
    await dialog.getByRole("button", { name: "Animale" }).click();
    await expect(
      dialog.getByRole("button", { name: "Animale" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByLabel("Data di nascita")).toBeVisible();
    await dialog.getByRole("button", { name: "Aggiungi Biscotto" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("membri-salvato")).toHaveText(
      JSON.stringify({
        name: "Biscotto",
        kind: "pet",
        birthDate: null,
        color: "salvia",
      }),
    );
  });

  test("il modulo non mette dati nell'indirizzo: method post e nessun name", async ({
    page,
  }) => {
    const dialog = await openSheet(page, ADD);
    await expect(dialog.locator("form")).toHaveAttribute("method", "post");
    await expect(dialog.locator("[name]")).toHaveCount(0);
    await dialog.getByLabel("Nome").fill("Rita");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(new URL(page.url()).search).toBe("");
    expect(page.url()).not.toContain("Rita");
  });

  test("durante il salvataggio Chiudi e il velo non chiudono, Annulla è spento", async ({
    page,
  }, testInfo) => {
    await page.goto(DEMO);
    await page.getByRole("button", { name: "Lento" }).click();
    await page.getByRole("button", { name: ADD }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome").fill("Rita");
    const save = dialog.getByRole("button", { name: "Aggiungi Rita" });
    await save.click();
    await expect(save).toHaveAttribute("aria-busy", "true");
    await dialog.getByRole("button", { name: "Chiudi" }).click({ force: true });
    if (testInfo.project.name === "desktop") {
      await expect(
        dialog.getByRole("button", { name: "Annulla" }),
      ).toBeDisabled();
    }
    await page.mouse.click(2, 2);
    await expect(dialog).toBeVisible();
    await expect(save).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("membri-chiamate")).toHaveText("Chiamate: 1");
  });

  test("ordine del fuoco: Nome, ruolo, data, colori, azioni; il fuoco non esce dal dialogo", async ({
    page,
  }, testInfo) => {
    const dialog = await openSheet(page, ADD);
    await expect(dialog.getByLabel("Nome")).toBeFocused();
    const desktop = testInfo.project.name === "desktop";
    const sequence = [
      dialog.getByRole("button", { name: "Adulto" }),
      dialog.getByRole("button", { name: "Figlio o figlia" }),
      dialog.getByRole("button", { name: "Animale" }),
      dialog.getByLabel("Data di nascita"),
      dialog.getByRole("radio", { name: "Salvia" }),
      ...(desktop ? [dialog.getByRole("button", { name: "Annulla" })] : []),
      dialog.getByRole("button", { name: "Aggiungi", exact: true }),
    ];
    for (const target of sequence) {
      await page.keyboard.press("Tab");
      if (target === sequence[4]) {
        // the native date field has several stops (day, month, year)
        for (let i = 0; i < 4; i += 1) {
          if (await target.evaluate((el) => el === document.activeElement)) {
            break;
          }
          await page.keyboard.press("Tab");
        }
      }
      await expect(target).toBeFocused();
    }
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() =>
      document
        .querySelector('[role="dialog"]')
        ?.contains(document.activeElement),
    );
    expect(inside).toBe(true);
  });

  test("chiuso con Esc e riaperto, il foglio riparte pulito", async ({
    page,
  }) => {
    const dialog = await openSheet(page, ADD);
    await dialog.getByLabel("Nome").fill("Rita");
    await dialog.getByRole("radio", { name: "Cobalto" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: ADD }).click();
    const reopened = page.getByRole("dialog");
    await expect(reopened.getByLabel("Nome")).toHaveValue("");
    await expect(
      reopened.getByRole("radio", { name: "Salvia" }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("membri-salvato")).toHaveText(
      "Niente salvato",
    );
  });
});

test.describe("MemberSheet: modifica", () => {
  test("i colori degli altri sono spenti, il ruolo non si cambia", async ({
    page,
  }) => {
    const dialog = await openSheet(page, "Modifica Sofia");
    for (const taken of [
      "Pomodoro (già di Marco)",
      "Glicine (già di Laura)",
      "Zafferano (già usato)",
    ]) {
      await expect(dialog.getByRole("radio", { name: taken })).toBeDisabled();
    }
    await expect(dialog.getByRole("radio", { name: "Cobalto" })).toBeEnabled();
    await dialog.getByRole("button", { name: "Adulto" }).click({ force: true });
    await expect(
      dialog.getByRole("button", { name: "Figlio o figlia" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      dialog.getByRole("button", { name: "Adulto" }),
    ).toHaveAttribute("aria-pressed", "false");
    // the help for adults with an account is only for them
    await expect(
      dialog.getByText("Chi usa FamilyNest con il suo account"),
    ).toHaveCount(0);
  });

  test("il titolo resta il nome salvato mentre si scrive", async ({ page }) => {
    const dialog = await openSheet(page, "Modifica Sofia");
    await dialog.getByLabel("Nome").fill("Sofi");
    await expect(dialog).toHaveAccessibleName("Modifica Sofia");
    await expect(
      dialog.getByRole("button", { name: "Salva le modifiche" }),
    ).toBeVisible();
  });

  test("salvare cambia nome e colore, tiene ruolo e data", async ({ page }) => {
    const dialog = await openSheet(page, "Modifica Sofia");
    await dialog.getByLabel("Nome").fill("Sofi");
    await dialog.getByRole("radio", { name: "Cobalto" }).click();
    await dialog.getByRole("button", { name: "Salva le modifiche" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("membri-salvato")).toHaveText(
      JSON.stringify({
        name: "Sofi",
        kind: "child",
        birthDate: "2016-12-14",
        color: "cobalto",
      }),
    );
    await expect(
      page.getByRole("button", { name: "Modifica Sofia" }),
    ).toBeFocused();
  });

  test("nome svuotato: errore e nessun salvataggio", async ({ page }) => {
    const dialog = await openSheet(page, "Modifica Sofia");
    await dialog.getByLabel("Nome").fill("");
    await dialog.getByRole("button", { name: "Salva le modifiche" }).click();
    await expect(
      dialog.getByText("Scrivi il nome per continuare."),
    ).toBeVisible();
    await expect(page.getByTestId("membri-chiamate")).toHaveText("Chiamate: 0");
  });

  test("la data si può svuotare e viene salvata come nulla", async ({
    page,
  }) => {
    const dialog = await openSheet(page, "Modifica Sofia");
    await dialog.getByLabel("Data di nascita").fill("");
    await dialog.getByRole("button", { name: "Salva le modifiche" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("membri-salvato")).toContainText(
      '"birthDate":null',
    );
  });
});

test.describe("MemberSheet: invito", () => {
  test("frase provvisoria sotto il titolo, foglio pulito, bottone «Continua»", async ({
    page,
  }) => {
    const dialog = await openSheet(page, INVITE);
    await expect(
      dialog.getByText(/^Per ora aggiungi questa persona/),
    ).toBeVisible();
    await expect(dialog.getByLabel("Nome")).toHaveValue("");
    await expect(dialog.getByLabel("Nome")).toHaveAttribute("maxlength", "40");
    await expect(dialog.getByRole("radio", { name: "Salvia" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(
      dialog.getByRole("button", { name: "Continua" }),
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Aggiungi" })).toHaveCount(
      0,
    );
  });

  test("nome vuoto: stesso errore dell'aggiunta, nessun salvataggio", async ({
    page,
  }) => {
    const dialog = await openSheet(page, INVITE);
    await dialog.getByLabel("Nome").fill("   ");
    await dialog.getByRole("button", { name: "Continua" }).click();
    await expect(
      dialog.getByText("Scrivi il nome per continuare."),
    ).toBeVisible();
    await expect(dialog.getByLabel("Nome")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(dialog.getByLabel("Nome")).toBeFocused();
    await expect(page.getByTestId("membri-chiamate")).toHaveText("Chiamate: 0");
  });

  test("salva nome e colore scelto, sempre adulto e senza data", async ({
    page,
  }) => {
    const dialog = await openSheet(page, INVITE);
    await dialog.getByLabel("Nome").fill("  Laura  ");
    await dialog.getByRole("radio", { name: "Cobalto" }).click();
    await dialog.getByRole("button", { name: "Continua" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("membri-salvato")).toHaveText(
      JSON.stringify({
        name: "Laura",
        kind: "adult",
        birthDate: null,
        color: "cobalto",
      }),
    );
    await expect(page.getByRole("button", { name: INVITE })).toBeFocused();
  });

  test("Chiudi, Esc e (desktop) Annulla non salvano e riportano il fuoco", async ({
    page,
  }, testInfo) => {
    let dialog = await openSheet(page, INVITE);
    await dialog.getByLabel("Nome").fill("Rita");
    await dialog.getByRole("button", { name: "Chiudi" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: INVITE })).toBeFocused();
    await page.getByRole("button", { name: INVITE }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Nome")).toHaveValue("");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    if (testInfo.project.name === "desktop") {
      await page.getByRole("button", { name: INVITE }).click();
      await page.getByRole("button", { name: "Annulla" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    await expect(page.getByTestId("membri-chiamate")).toHaveText("Chiamate: 0");
  });

  test("errore di rete e Riprova: il salvataggio riparte con gli stessi dati", async ({
    page,
  }) => {
    await page.goto(DEMO);
    await page.getByRole("button", { name: "Rete" }).click();
    await page.getByRole("button", { name: INVITE }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome").fill("Rita");
    await dialog.getByRole("button", { name: "Continua" }).click();
    await expect(dialog.getByRole("alert")).toContainText(
      "Controlla la connessione",
    );
    await expect(page.getByTestId("membri-chiamate")).toHaveText("Chiamate: 1");
    await dialog.getByRole("button", { name: "Riprova" }).click();
    await expect(page.getByTestId("membri-chiamate")).toHaveText("Chiamate: 2");
    await expect(dialog.getByLabel("Nome")).toHaveValue("Rita");
  });
});

test.describe("Esplora «In arrivo»", () => {
  test("senza sessione /esplora porta a /accesso", async ({ page }) => {
    await page.goto("/esplora");
    await expect(page).toHaveURL(/\/accesso$/);
  });

  test("A: titolo, bussola, testo e ritorno a Oggi", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await signInAs(page.context(), baseURL as string, "A");
    const response = await page.goto("/esplora");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle("FamilyNest · Esplora");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(
      page.getByRole("heading", { level: 1, name: "Esplora", exact: true }),
    ).toBeVisible();
    const placeholder = page.getByTestId("pagina-segnaposto");
    await expect(placeholder).toContainText("In arrivo");
    await expect(placeholder).toContainText(
      "Qui scoprirai cosa può fare la vostra casa. Stiamo preparando questa pagina.",
    );
    await expect(placeholder.locator("svg").first()).toBeVisible();
    await placeholder.getByRole("link", { name: "Torna a Oggi" }).click();
    await expect(page).toHaveURL(/\/oggi$/);
  });

  test("la navigazione principale c'è; su mobile «Oggi» è la voce collegata", async ({
    page,
    baseURL,
  }, testInfo) => {
    withUser("A");
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto("/esplora");
    const nav = page
      .getByRole("navigation", { name: "Navigazione principale" })
      .filter({ visible: true });
    await expect(nav).toBeVisible();
    if (testInfo.project.name === "mobile") {
      await expect(nav.getByRole("link", { name: /Oggi/ })).toHaveAttribute(
        "aria-current",
        "true",
      );
    } else {
      await expect(nav.locator("[aria-current]")).toHaveCount(0);
    }
  });

  test("isolamento: B vede la stessa pagina ma il proprio Nest, mai quello di A", async ({
    page,
    baseURL,
  }, testInfo) => {
    withUser("B");
    await signInAs(page.context(), baseURL as string, "B");
    await page.goto("/esplora");
    await expect(
      page.getByRole("heading", { level: 1, name: "Esplora", exact: true }),
    ).toBeVisible();
    // the Nest square is in the top navigation of the desktop layout only
    if (testInfo.project.name === "desktop") {
      await expect(
        page.getByRole("link", {
          name: "Apri Casa Bianchi: membri, Esplora e impostazioni",
        }),
      ).toBeVisible();
    }
    const html = await page.content();
    expect(html).not.toContain("D'Angelo");
    expect(html).not.toContain("D&#x27;Angelo");
  });
});

test.describe("X «Chiudi» del Nest (solo mobile)", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "La X c'è solo su mobile");
  });

  const NEST_A = "Apri Casa D'Angelo: membri, Esplora e impostazioni";

  for (const [from, back] of [
    ["/casa/spesa", /\/casa\/spesa$/],
    ["/calendario", /\/calendario$/],
  ] as const) {
    test(`aperto da ${from}, «Chiudi» torna a ${from}`, async ({
      page,
      baseURL,
    }) => {
      withUser("A");
      await signInAs(page.context(), baseURL as string, "A");
      await page.goto(from);
      await page
        .getByRole("link", { name: NEST_A })
        .filter({ visible: true })
        .click();
      await expect(page).toHaveURL(/\/nest$/);
      await page.getByLabel("Chiudi", { exact: true }).click();
      await expect(page).toHaveURL(back);
    });
  }

  test("aperto direttamente (nessuna pagina precedente), «Chiudi» porta a /oggi", async ({
    page,
    baseURL,
  }) => {
    withUser("A");
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto("/nest");
    await page.getByLabel("Chiudi", { exact: true }).click();
    await expect(page).toHaveURL(/\/oggi$/);
  });
});
