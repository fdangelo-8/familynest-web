import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { hasTestUser, signInAs } from "../fixtures/visual-login";

// Throwaway developer smoke test for #40 (removed before the PR is ready).

const facts: string[] = [];
const note = (text: string) => facts.push(text);

type Person = { id: string; name: string };

function romeDay(offset: number): string {
  const d = new Date(Date.now() + offset * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(
    d,
  );
}

function row(partial: Record<string, unknown>) {
  return {
    sort_index: 1,
    kind: "event",
    id: null,
    title: null,
    location: null,
    starts_at: null,
    ends_at: null,
    occurrence_day: null,
    visibility: null,
    author_member_id: null,
    member_ids: null,
    escort_member_id: null,
    recurrence: null,
    recurrence_weekdays: null,
    series_starts_on: null,
    due_date: null,
    is_private: null,
    assignee_member_id: null,
    for_member_id: null,
    quantity: null,
    is_masked: false,
    ...partial,
  };
}

async function axe(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
  note(
    `${label}: axe ${bad.length === 0 ? "ok" : JSON.stringify(bad.map((v) => ({ id: v.id, n: v.nodes.map((n) => n.target.join(" ")).slice(0, 3) })))}`,
  );
}

test.describe("prova #40", () => {
  test.skip(!hasTestUser("A"), "no user");

  test("percorso", async ({ page, baseURL }, testInfo) => {
    test.setTimeout(120_000);
    const desktop = testInfo.project.name === "desktop";
    const tag = desktop ? "d" : "m";
    await signInAs(page.context(), baseURL as string, "A");
    let people: Person[] = [];
    page.on("response", async (response) => {
      const url = response.url();
      if (
        url.includes("/rest/v1/household_members") &&
        url.includes("color") &&
        url.includes("kind")
      ) {
        try {
          people = (await response.json()) as Person[];
        } catch {
          // ignore
        }
      }
    });
    let mode: "ok" | "empty" | "error" = "ok";
    const requests: string[] = [];
    await page
      .context()
      .route("**/rest/v1/rpc/search_household", async (route) => {
        requests.push(
          `${route.request().method()} ${route.request().url().includes("nuoto")}`,
        );
        if (mode === "error") {
          await route.fulfill({ status: 500, body: "{}" });
          return;
        }
        if (mode === "empty") {
          await route.fulfill({ json: [] });
          return;
        }
        const id = (name: string) =>
          people.find((p) => p.name === name)?.id ?? null;
        const today = romeDay(0);
        const next = romeDay(2);
        const far = romeDay(40);
        await route.fulfill({
          json: [
            row({
              id: "11111111-1111-4111-8111-111111111111",
              title: "Nuoto Sofia",
              location: "Piscina comunale",
              starts_at: `${today}T15:00:00Z`,
              ends_at: `${today}T16:30:00Z`,
              occurrence_day: today,
              visibility: "household",
              author_member_id: id("Marco"),
              member_ids: [id("Sofia")],
              recurrence: "weekly",
              recurrence_weekdays: [2, 4],
              series_starts_on: today,
            }),
            row({
              id: "11111111-1111-4111-8111-111111111111",
              title: "Nuoto Sofia",
              starts_at: `${next}T15:00:00Z`,
              ends_at: `${next}T16:30:00Z`,
              occurrence_day: next,
              visibility: "household",
              author_member_id: id("Marco"),
              member_ids: [id("Sofia")],
              recurrence: "weekly",
              recurrence_weekdays: [2, 4],
              series_starts_on: today,
            }),
            row({
              id: "11111111-1111-4111-8111-111111111111",
              title: "Nuoto Sofia",
              starts_at: `${far}T15:00:00Z`,
              ends_at: `${far}T16:30:00Z`,
              occurrence_day: far,
              visibility: "private",
              author_member_id: id("Marco"),
              member_ids: [id("Sofia")],
              recurrence: "weekly",
              recurrence_weekdays: [2, 4],
              series_starts_on: today,
            }),
            row({
              kind: "deadline",
              id: "22222222-2222-4222-8222-222222222222",
              title: "Iscrizione al corso di nuoto",
              due_date: romeDay(14),
              for_member_id: id("Sofia"),
            }),
            row({
              kind: "todo",
              id: "33333333-3333-4333-8333-333333333333",
              title: "Comprare la cuffia da nuoto",
              due_date: romeDay(2),
              assignee_member_id: id("Laura"),
            }),
            row({
              kind: "shopping_item",
              id: "44444444-4444-4444-8444-444444444444",
              title: "Crema per nuotatori",
              quantity: "2 pezzi",
            }),
          ],
        });
      });

    await page.goto(desktop ? "/casa/spesa" : "/calendario");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await page.waitForTimeout(1500);
    const lens = desktop
      ? page.getByRole("link", { name: "Cerca nel Nest (⌘K)" })
      : page.getByRole("link", { name: "Cerca nel Nest", exact: true });
    await lens.click();
    await expect(page).toHaveURL(/\/ricerca$/);
    const field = page.getByRole(desktop ? "combobox" : "searchbox", {
      name: "Cerca nel Nest",
    });
    await expect(field).toBeVisible();
    await expect(field).toBeFocused();
    note(`${tag}: title=${await page.title()} url=${page.url()}`);
    note(
      `${tag}: mains=${await page.getByRole("main").count()} h1=${await page.getByRole("heading", { level: 1 }).count()}`,
    );
    await page.waitForTimeout(1500);
    await page.screenshot({ path: testInfo.outputPath(`${tag}-1-idle.png`) });
    await axe(page, `${tag} idle`);

    await field.pressSequentially("nuoto");
    await expect(page.getByTestId("ricerca-gruppo-event")).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: testInfo.outputPath(`${tag}-2-risultati.png`),
    });
    await axe(page, `${tag} risultati`);
    note(
      `${tag}: annuncio=${await page.getByTestId("ricerca-annuncio").textContent()}`,
    );
    if (desktop) {
      note(
        `${tag}: active0=${await field.getAttribute("aria-activedescendant")}`,
      );
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      await page.screenshot({
        path: testInfo.outputPath(`${tag}-3-frecce.png`),
      });
      const activeId = await field.getAttribute("aria-activedescendant");
      note(
        `${tag}: active2=${await page.locator(`[id="${activeId}"]`).textContent()}`,
      );
    } else {
      const chips = await page
        .getByTestId("ricerca-filtri")
        .getByRole("button")
        .allTextContents();
      note(`${tag}: chips=${JSON.stringify(chips)}`);
      await page.getByRole("button", { name: /^Spesa/ }).click();
      await page.screenshot({
        path: testInfo.outputPath(`${tag}-3-spesa.png`),
      });
      await page.getByRole("button", { name: /^Tutto/ }).click();
      const box = page.getByRole("checkbox", {
        name: "Segna come fatto: Comprare la cuffia da nuoto",
      });
      await box.click();
      await page.waitForTimeout(800);
      await page.screenshot({
        path: testInfo.outputPath(`${tag}-4-casella.png`),
      });
      note(`${tag}: casella checked=${await box.getAttribute("aria-checked")}`);
    }

    mode = "empty";
    await field.fill("piscina olimpica");
    await expect(page.getByTestId("ricerca-vuoto")).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: testInfo.outputPath(`${tag}-5-vuoto.png`) });
    await axe(page, `${tag} vuoto`);

    mode = "error";
    await field.fill("nuoto in vasca");
    await expect(page.getByTestId("ricerca-errore")).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: testInfo.outputPath(`${tag}-6-errore.png`) });
    await axe(page, `${tag} errore`);

    note(`${tag}: requests=${JSON.stringify(requests)}`);
    if (desktop) {
      await page.keyboard.press("Escape");
      await expect(page).toHaveURL(/\/casa\/spesa$/);
      note(
        `${tag}: focus dopo Esc=${await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))}`,
      );
    } else {
      await page.getByRole("link", { name: "Annulla" }).click();
      await expect(page).toHaveURL(/\/calendario$/);
    }
    expect(facts.join("\n")).toBe("zz-ricerca-prova");
  });
});
