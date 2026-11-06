import { test, expect } from "@playwright/test";
import {
  createPasswordUser,
  mailField,
  mockAuth,
  modeVoice,
  passwordField,
  recoveryLink,
  submitButton,
  submitMailForm,
  untilHydrated,
} from "../fixtures/accesso-password";

// TEMPORARY (issue 327): screenshots for the visual comparison. Fails on
// purpose so that the workflow uploads test-results. To be removed.
test.use({ reducedMotion: "reduce", locale: "it-IT" });

test("shots", async ({ page }, info) => {
  const shot = async (name: string) => {
    await page.mouse.move(0, 0);
    await page.screenshot({
      path: info.outputPath(`${name}.png`),
      fullPage: true,
    });
  };
  await page.goto("/accesso/mail");
  await untilHydrated(
    () => modeVoice(page, "Registrati").click({ timeout: 2000 }),
    () => expect(page.locator("h1:visible")).toHaveText("Crea il tuo account"),
  );
  await modeVoice(page, "Entra").click();
  await shot("1-entra");
  await submitButton(page).click();
  await shot("2-entra-errori");
  await modeVoice(page, "Registrati").click();
  await passwordField(page, "Scegli una password").fill("abcdefgh");
  await mailField(page).fill("marco@esempio.test");
  await shot("3-registrati-regola");
  await mockAuth(page, "/signup", { kind: "ok" });
  await submitButton(page).click();
  await expect(page.locator("h1:visible")).toHaveText("Controlla la posta");
  await shot("4-controlla-la-posta");

  await page.goto("/accesso/password-dimenticata");
  await shot("5-password-dimenticata");
  await mockAuth(page, "/recover", { kind: "ok" });
  await untilHydrated(
    async () => {
      await mailField(page).fill("marco@esempio.test", { timeout: 2000 });
      await submitButton(page).click({ timeout: 2000, noWaitAfter: true });
    },
    () => expect(page.locator("h1:visible")).toHaveText("Ti abbiamo scritto"),
  );
  await shot("6-ti-abbiamo-scritto");

  await page.goto("/accesso/link-scaduto?tipo=conferma");
  await shot("7-scaduto-conferma");
  await page.goto("/accesso/link-scaduto?tipo=password");
  await shot("8-scaduto-password");

  const user = await createPasswordUser({ nest: true });
  try {
    await page.goto(await recoveryLink(user.email));
    await expect(page.locator("h1:visible")).toHaveText(
      "Scegli una nuova password",
    );
    await shot("9-nuova-password");
  } finally {
    await user.remove();
  }
  expect("fail on purpose to keep the screenshots").toBe("");
});
