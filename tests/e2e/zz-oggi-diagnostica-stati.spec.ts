import { writeFileSync } from "node:fs";
import type { Page, TestInfo } from "@playwright/test";
import {
  addDays,
  at1552,
  CORS,
  expect,
  lastTuesday,
  romeInstant,
  setClock,
  test,
  type CasaNest,
} from "../fixtures/casa";
import { createEvent } from "../fixtures/impegni";
import { createThrowawayUser } from "../fixtures/throwaway-user";

// TEMPORARY diagnostic of the developer of #30 (states). Removed before the PR.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const T = lastTuesday();
const d = (n: number) => addDays(T, n);

async function dump(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
  });
  const text = await page.locator("main").innerText();
  writeFileSync(testInfo.outputPath(`${name}.txt`), text);
}

async function open(
  page: Page,
  casa: CasaNest,
  baseURL: string | undefined,
  who = "Marco",
) {
  await casa.signIn(page, baseURL, who);
  await page.goto("/oggi");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
    timeout: 30_000,
  });
}

async function settled(page: Page) {
  await expect(page.locator("main [aria-busy='true']:visible")).toHaveCount(0, {
    timeout: 30_000,
  });
  await page.waitForTimeout(1000);
}

test("starter list and empty day", async ({
  page,
  baseURL,
  casa,
}, testInfo) => {
  test.setTimeout(120_000);
  const { error } = await casa.users["Marco"]!.admin.from("invitations").insert(
    {
      household_id: casa.householdId,
      member_id: casa.members["Laura"]!,
      invited_by_member_id: casa.members["Marco"]!,
    },
  );
  if (error) throw new Error("invito");
  await setClock(page, at1552(T));
  await open(page, casa, baseURL);
  await settled(page);
  await dump(page, testInfo, "starter-vuoto");
  expect(1).toBe(2);
});

test("invited summary", async ({ page, baseURL, casa }, testInfo) => {
  test.setTimeout(120_000);
  const admin = casa.users["Marco"]!.admin;
  const { data: member } = await admin
    .from("household_members")
    .insert({
      household_id: casa.householdId,
      kind: "adult",
      name: "Bea",
      color: "lampone",
    })
    .select("id")
    .single();
  const { data: invitation } = await admin
    .from("invitations")
    .insert({
      household_id: casa.householdId,
      member_id: member!.id,
      invited_by_member_id: casa.members["Marco"]!,
    })
    .select("token")
    .single();
  const bea = await createThrowawayUser("Bea");
  try {
    const { error } = await bea.client.rpc("accept_invitation", {
      token: invitation!.token,
    });
    if (error) throw new Error("accept " + error.message);
    await createEvent(casa, "Marco", {
      title: "Inglese",
      day: d(1),
      from: "16:30",
      to: "17:30",
      members: ["Sofia"],
      place: "via Dante 4",
    });
    await casa.shopping("Marco", ["Latte", "pane", "mele", "uova"]);
    await setClock(page, at1552(T));
    await bea.signInContext(page.context(), baseURL as string);
    await page.goto("/oggi");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
      timeout: 30_000,
    });
    await settled(page);
    await dump(page, testInfo, "invitato");
  } finally {
    await bea.remove();
  }
  expect(1).toBe(2);
});

test("toggle todo, offline", async ({ page, baseURL, casa }, testInfo) => {
  test.setTimeout(120_000);
  await casa.todo("Marco", {
    title: "Chiamare il commercialista",
    assignee: "Marco",
    due: d(1),
    priv: true,
  });
  await casa.todo("Marco", {
    title: "Rinnovare l'assicurazione",
    assignee: "Marco",
    due: d(11),
  });
  await createEvent(casa, "Marco", {
    title: "Call",
    day: T,
    from: "16:00",
    to: "17:00",
    members: ["Marco"],
  });
  await setClock(page, at1552(T));
  await open(page, casa, baseURL);
  await settled(page);
  const box = page
    .getByRole("checkbox", {
      name: "Segna come fatto: Chiamare il commercialista",
    })
    .locator("visible=true");
  await box.click();
  await page.waitForTimeout(500);
  await dump(page, testInfo, "toggle-1-spuntato");
  await page.waitForTimeout(6000);
  await dump(page, testInfo, "toggle-2-dopo-toast");
  // offline
  await page.context().setOffline(true);
  await page.waitForTimeout(1500);
  const box2 = page
    .getByRole("checkbox", {
      name: "Segna come fatto: Rinnovare l'assicurazione",
    })
    .locator("visible=true");
  await box2.click();
  await page.waitForTimeout(500);
  await dump(page, testInfo, "offline-1");
  await page.context().setOffline(false);
  await page.waitForTimeout(6000);
  await dump(page, testInfo, "offline-2-online");
  const rows = await casa.todoRows();
  writeFileSync(
    testInfo.outputPath("todo-rows.json"),
    JSON.stringify(rows, null, 1),
  );
  expect(1).toBe(2);
});

test("page error and part error", async ({ page, baseURL, casa }, testInfo) => {
  test.setTimeout(120_000);
  await createEvent(casa, "Marco", {
    title: "Call",
    day: T,
    from: "16:00",
    to: "17:00",
    members: ["Marco"],
  });
  await casa.todo("Marco", { title: "Una cosa", assignee: "Marco", due: d(1) });
  await setClock(page, at1552(T));
  await casa.signIn(page, baseURL, "Marco");
  let failing = true;
  const fail = async (route: import("@playwright/test").Route) => {
    if (route.request().method() === "OPTIONS") return route.continue();
    if (!failing) return route.continue();
    return route.fulfill({
      status: 500,
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify({ code: "XX000", message: "boom" }),
    });
  };
  for (const pattern of [
    "**/rest/v1/rpc/list_household_events*",
    "**/rest/v1/todos*",
    "**/rest/v1/deadlines*",
    "**/rest/v1/shopping_items*",
  ]) {
    await page.route(pattern, fail);
  }
  await page.goto("/oggi");
  await expect(page.getByText("Questa pagina non si è caricata")).toBeVisible({
    timeout: 30_000,
  });
  await dump(page, testInfo, "errore-pagina");
  failing = false;
  await page.getByRole("button", { name: "Riprova" }).click();
  await expect(
    page
      .getByRole("heading", { level: 2, name: "Prossimo" })
      .locator("visible=true"),
  ).toBeVisible({ timeout: 30_000 });
  await dump(page, testInfo, "dopo-riprova");
  // only the things to do fail
  const failTodos = async (route: import("@playwright/test").Route) => {
    if (route.request().method() === "OPTIONS") return route.continue();
    return route.fulfill({
      status: 500,
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify({ code: "XX000", message: "boom" }),
    });
  };
  await page.unroute("**/rest/v1/todos*");
  await page.route("**/rest/v1/todos*", failTodos);
  await page.reload();
  await expect(
    page
      .getByText("Non riusciamo a caricare le cose da fare.")
      .locator("visible=true"),
  ).toBeVisible({ timeout: 30_000 });
  await dump(page, testInfo, "errore-parte");
  await page.unroute("**/rest/v1/todos*");
  await page
    .getByRole("button", { name: "Riprova" })
    .locator("visible=true")
    .click();
  await expect(page.getByText("Una cosa").locator("visible=true")).toBeVisible({
    timeout: 30_000,
  });
  await dump(page, testInfo, "errore-parte-risolto");
  expect(1).toBe(2);
});

test("loading", async ({ page, baseURL, casa }, testInfo) => {
  test.setTimeout(120_000);
  await createEvent(casa, "Marco", {
    title: "Call",
    day: T,
    from: "16:00",
    to: "17:00",
    members: ["Marco"],
  });
  await setClock(page, at1552(T));
  await casa.signIn(page, baseURL, "Marco");
  await page.route("**/rest/v1/**", async (route) => {
    if (route.request().method() === "OPTIONS") return route.continue();
    await new Promise((r) => setTimeout(r, 5000));
    return route.continue().catch(() => {});
  });
  await page.goto("/oggi");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForTimeout(2500);
  await dump(page, testInfo, "caricamento");
  expect(1).toBe(2);
});

test("all done at night", async ({ page, baseURL, casa }, testInfo) => {
  test.setTimeout(120_000);
  await createEvent(casa, "Marco", {
    title: "Scuola",
    day: T,
    from: "08:00",
    to: "13:00",
    members: ["Sofia"],
  });
  await createEvent(casa, "Marco", {
    title: "Palestra",
    day: T,
    from: "18:00",
    to: "19:00",
    members: ["Marco"],
    visibility: "busy",
  });
  await setClock(page, romeInstant(T, 23, 10));
  await open(page, casa, baseURL);
  await settled(page);
  await dump(page, testInfo, "tutto-finito");
  expect(1).toBe(2);
});

test("realtime shopping", async ({ page, baseURL, casa }, testInfo) => {
  test.setTimeout(120_000);
  await casa.shopping("Marco", ["Latte", "pane"]);
  await createEvent(casa, "Marco", {
    title: "Call",
    day: T,
    from: "16:00",
    to: "17:00",
    members: ["Marco"],
  });
  await setClock(page, at1552(T));
  await open(page, casa, baseURL);
  await settled(page);
  const row = page
    .locator("li")
    .filter({ hasText: "Cose da comprare" })
    .locator("visible=true");
  await expect(row).toContainText("2");
  await casa.shopping("Marco", ["Uova"]);
  const started = Date.now();
  await expect(row).toContainText("3", { timeout: 15_000 });
  writeFileSync(
    testInfo.outputPath("realtime.txt"),
    `ms: ${Date.now() - started}`,
  );
  expect(1).toBe(2);
});
