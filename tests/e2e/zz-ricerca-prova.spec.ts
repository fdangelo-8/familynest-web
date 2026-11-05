import { expect, test, type Page } from "@playwright/test";
import { hasTestUser, signInAs } from "../fixtures/visual-login";

// Throwaway developer smoke test for #40 (removed before the PR is ready).

const facts: string[] = [];
const note = (text: string) => facts.push(text);

async function step(name: string, run: () => Promise<void>) {
  try {
    await run();
    note(`ok   ${name}`);
  } catch (error) {
    note(`FAIL ${name}: ${String(error).split("\n").slice(0, 6).join(" | ")}`);
  }
}

function rpcCalls(page: Page) {
  const calls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/rpc/search_household")) {
      calls.push(`${request.method()} ${request.postData()}`);
    }
  });
  return calls;
}

test.describe("prova #40 (2)", () => {
  test.skip(!hasTestUser("A"), "no user");

  test("percorso reale", async ({ page, baseURL }, testInfo) => {
    test.setTimeout(150_000);
    const desktop = testInfo.project.name === "desktop";
    const tag = desktop ? "d" : "m";
    await signInAs(page.context(), baseURL as string, "A");
    const calls = rpcCalls(page);
    const urls: string[] = [];
    page.on("request", (r) => urls.push(r.url()));

    await page.goto(desktop ? "/casa/spesa" : "/casa/da-fare");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await page.waitForTimeout(1500);
    const open = async () => {
      const lens = desktop
        ? page.getByRole("link", { name: "Cerca nel Nest (⌘K)" })
        : page.getByRole("link", { name: "Cerca nel Nest", exact: true });
      await lens.click();
      await expect(page).toHaveURL(/\/ricerca$/);
    };
    await open();
    const field = page.getByRole(desktop ? "combobox" : "searchbox", {
      name: "Cerca nel Nest",
    });
    await expect(field).toBeFocused();
    await page.waitForTimeout(1500);

    await step("ricerca reale vuota", async () => {
      await field.pressSequentially("zzzz qqqq");
      await expect(page.getByTestId("ricerca-vuoto")).toBeVisible();
      await expect(page.getByTestId("ricerca-vuoto")).toContainText(
        "Nessun risultato per «zzzz qqqq»",
      );
      note(`${tag}: calls=${JSON.stringify(calls)}`);
    });

    await step("persona reale: cose di Sofia", async () => {
      await field.fill("");
      await field.pressSequentially("cose di Sofia");
      await page.waitForTimeout(2000);
      note(
        `${tag}: sofia errore=${await page.getByTestId("ricerca-errore").count()} vuoto=${await page.getByTestId("ricerca-vuoto").count()} annuncio=${await page.getByTestId("ricerca-annuncio").textContent()}`,
      );
      note(`${tag}: calls=${JSON.stringify(calls.slice(-1))}`);
    });

    await step("periodo reale: questo weekend / scade a novembre", async () => {
      await field.fill("scade a novembre");
      await page.waitForTimeout(2000);
      note(
        `${tag}: novembre errore=${await page.getByTestId("ricerca-errore").count()} annuncio=${await page.getByTestId("ricerca-annuncio").textContent()}`,
      );
      note(`${tag}: calls=${JSON.stringify(calls.slice(-1))}`);
    });

    await step("indirizzo senza testo", async () => {
      expect(
        urls.filter((u) => /zzzz|qqqq|nuoto|Sofia|weekend/i.test(u)),
      ).toEqual([]);
    });

    await step("aggiungilo apre Aggiungi", async () => {
      await field.fill("piscina olimpica");
      await page.getByRole("link", { name: "aggiungilo" }).click();
      await expect(page).toHaveURL(/\/aggiungi$/);
      const phrase = page.getByRole("textbox", {
        name: "Cosa vuoi aggiungere?",
      });
      await expect(phrase).toHaveValue("piscina olimpica");
      note(`${tag}: aggiungi url=${page.url()}`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(600);
      note(`${tag}: dopo chiusura url=${page.url()}`);
    });

    await step(
      "recenti: salva con aggiungilo, ricarica, cancella e annulla",
      async () => {
        if (!/\/ricerca$/.test(page.url())) await open();
        const recents = page.getByTestId("ricerca-recenti");
        note(`${tag}: recenti visibili=${await recents.count()}`);
        if ((await recents.count()) > 0) {
          note(
            `${tag}: recenti=${JSON.stringify(await recents.getByRole("button").allTextContents())}`,
          );
          await page
            .getByRole("button", { name: "Cancella le ricerche recenti" })
            .click();
          await expect(
            page.getByText("Ricerche recenti cancellate."),
          ).toBeVisible();
          await expect(recents).toHaveCount(0);
          await expect(field).toBeFocused();
          await page
            .getByRole("button", { name: "Annulla", exact: true })
            .click();
          await expect(page.getByTestId("ricerca-recenti")).toHaveCount(1);
          note(
            `${tag}: ripristinate=${JSON.stringify(await page.getByTestId("ricerca-recenti").getByRole("button").allTextContents())}`,
          );
        }
      },
    );

    await step("offline", async () => {
      await field.fill("");
      await page.context().setOffline(true);
      await field.pressSequentially("nuoto");
      await expect(page.getByTestId("ricerca-offline")).toBeVisible();
      note(
        `${tag}: offline testo=${await page.getByTestId("ricerca-offline").textContent()}`,
      );
      await page.context().setOffline(false);
      await expect(page.getByTestId("ricerca-offline")).toHaveCount(0);
      await page.waitForTimeout(1500);
      note(
        `${tag}: online di nuovo, vuoto=${await page.getByTestId("ricerca-vuoto").count()} errore=${await page.getByTestId("ricerca-errore").count()}`,
      );
    });

    if (desktop) {
      await step("desktop: Ctrl+K con la palette aperta", async () => {
        await field.fill("nuoto");
        await page.keyboard.press("Control+k");
        await expect(field).toBeFocused();
        await expect(field).toHaveValue("nuoto");
        await expect(page).toHaveURL(/\/ricerca$/);
        await page
          .getByRole("button", { name: "Cancella le ricerche recenti" })
          .count();
      });
      await step("desktop: Tab resta nel dialogo", async () => {
        await field.fill("");
        const seen: string[] = [];
        for (let i = 0; i < 4; i += 1) {
          await page.keyboard.press("Tab");
          seen.push(
            await page.evaluate(
              () =>
                document.activeElement?.getAttribute("aria-label") ??
                document.activeElement?.textContent?.slice(0, 20) ??
                "",
            ),
          );
        }
        note(`${tag}: tab=${JSON.stringify(seen)}`);
      });
      await step("desktop: Esc con testo chiude", async () => {
        await field.focus();
        await field.fill("nuoto");
        await page.keyboard.press("Escape");
        await expect(page).toHaveURL(/\/casa\/spesa$/);
        await expect(
          page.getByRole("dialog", { name: "Cerca nel Nest" }),
        ).toHaveCount(0);
      });
      await step("desktop: Ctrl+K da corpo apre", async () => {
        await page.evaluate(() =>
          (document.activeElement as HTMLElement)?.blur(),
        );
        await page.keyboard.press("Control+k");
        await expect(page).toHaveURL(/\/ricerca$/);
        await expect(
          page.getByRole("combobox", { name: "Cerca nel Nest" }),
        ).toBeFocused();
        await expect(
          page.getByRole("combobox", { name: "Cerca nel Nest" }),
        ).toHaveValue("");
      });
    } else {
      await step("mobile: Annulla porta alla pagina di prima", async () => {
        await page.getByRole("link", { name: "Annulla" }).click();
        await expect(page).toHaveURL(/\/casa\/da-fare$/);
      });
      await step("mobile: direttamente, Annulla va a Oggi", async () => {
        await page.goto("/ricerca");
        await expect(
          page.getByRole("searchbox", { name: "Cerca nel Nest" }),
        ).toBeFocused();
        await page.getByRole("link", { name: "Annulla" }).click();
        await expect(page).toHaveURL(/\/oggi$/);
      });
    }

    expect(facts.join("\n")).toBe("zz-ricerca-prova");
  });
});
