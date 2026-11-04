import {
  addDays,
  at1552,
  lastTuesday,
  setClock,
  test,
  expect,
} from "../fixtures/casa";
import { createEvent } from "../fixtures/impegni";
import { writeFileSync } from "node:fs";

// TEMPORARY diagnostic of the developer of #30: screenshots and DOM dumps as
// artifacts. Removed before the pull request.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const T = lastTuesday();
const d = (n: number) => addDays(T, n);

for (const lens of ["io", "nest"] as const) {
  test(`diagnostica ${lens}`, async ({ page, baseURL, casa }, testInfo) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console: ${m.text()}`);
    });

    await createEvent(casa, "Marco", {
      title: "Palestra",
      day: T,
      from: "07:00",
      to: "08:00",
      members: ["Marco"],
    });
    await createEvent(casa, "Marco", {
      title: "Call con Acme",
      day: T,
      from: "16:00",
      to: "17:00",
      members: ["Marco"],
      place: "Teams",
      visibility: "busy",
    });
    await createEvent(casa, "Marco", {
      title: "Nuoto Sofia",
      day: T,
      from: "17:00",
      to: "18:30",
      members: ["Sofia"],
      escort: "Laura",
    });
    await createEvent(casa, "Marco", {
      title: "Cena dai nonni",
      day: T,
      from: "19:30",
      to: "21:30",
      members: ["Marco", "Laura", "Sofia", "Tommaso"],
      place: "Monza",
    });
    await createEvent(casa, "Marco", {
      title: "Scuola",
      day: d(1),
      from: "08:15",
      to: "13:00",
      members: ["Sofia", "Tommaso"],
      escort: "Marco",
    });
    await createEvent(casa, "Marco", {
      title: "Tennis",
      day: d(1),
      from: "20:00",
      to: "21:00",
      members: ["Marco"],
      place: "Centro sportivo",
    });
    await createEvent(casa, "Marco", {
      title: "Yoga",
      day: d(2),
      from: "20:30",
      to: "21:30",
      members: ["Laura"],
      place: "Studio Respiro",
    });
    await casa.todo("Marco", {
      title: "Chiamare il commercialista",
      assignee: "Marco",
      due: d(1),
      priv: true,
    });
    await casa.todo("Marco", {
      title: "Rinnovare l'assicurazione dell'auto",
      assignee: "Marco",
      due: d(11),
      priv: true,
    });
    await casa.todo("Marco", {
      title: "Firmare autorizzazione gita",
      assignee: "Marco",
      forMember: "Sofia",
      due: d(3),
    });
    await casa.todo("Marco", {
      title: "Comprare la cuffia da nuoto",
      assignee: "Laura",
      forMember: "Sofia",
      due: d(2),
    });
    await casa.shopping("Marco", ["Latte", "pane", "mele", "uova"]);
    await casa.deadline("Marco", {
      title: "Rinnovo carta d'identità di Sofia",
      due: d(14),
    });
    await casa.deadline("Marco", { title: "Bollo dell'auto", due: d(48) });
    await casa.users["Marco"]!.client.rpc("pin_space", { p_space: "meals" });

    await page.addInitScript((value) => {
      window.sessionStorage.setItem("familynest.lens", value);
    }, lens);
    await setClock(page, at1552(T));
    await casa.signIn(page, baseURL, "Marco");
    await page.goto("/oggi");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator("main [aria-busy='true']:visible")).toHaveCount(
      0,
      { timeout: 30_000 },
    );
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: testInfo.outputPath(`oggi-${lens}.png`),
      fullPage: true,
    });
    const html = await page.locator("main").evaluate((el) => {
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("svg").forEach((s) => s.remove());
      return clone.outerHTML;
    });
    const visibleText = await page.locator("main").innerText();
    writeFileSync(testInfo.outputPath(`oggi-${lens}.html`), html);
    writeFileSync(
      testInfo.outputPath(`oggi-${lens}.txt`),
      `${visibleText}\n\nERRORS:\n${errors.join("\n")}`,
    );
    expect(1, "forza il caricamento degli artefatti").toBe(2);
  });
}
