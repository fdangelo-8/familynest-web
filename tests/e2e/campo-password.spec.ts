import { expect, test } from "@playwright/test";

// PasswordField in the gallery (#327): /design-system?campo-password=1.

const URL = "/design-system?campo-password=1";

test.beforeEach(async ({ page }) => {
  await page.goto(URL);
  await expect(page.locator("#campo-password")).toBeVisible();
});

test("il campo parte nascosto e il bottone è 44 × 44 con nome fisso", async ({
  page,
}) => {
  const input = page.getByTestId("campo-password-regole");
  await expect(input).toHaveAttribute("type", "password");
  await expect(input).toHaveAttribute("autocomplete", "new-password");
  const toggle = page
    .locator("#campo-password")
    .getByRole("button", { name: "Mostra la password" })
    .first();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toHaveAttribute("aria-controls", /.+/);
  const box = await toggle.boundingBox();
  expect(Math.round(box!.width)).toBe(44);
  expect(Math.round(box!.height)).toBe(44);
  const fieldBox = await input.boundingBox();
  expect(Math.round(fieldBox!.height)).toBe(52);
});

test("mostra e nasconde la password, il focus resta sul bottone", async ({
  page,
}) => {
  const input = page.getByTestId("campo-password-regole");
  const toggle = page
    .locator("#campo-password .campo")
    .first()
    .getByRole("button", { name: "Mostra la password" });
  await input.fill("segretissima");
  await toggle.click();
  await expect(input).toHaveAttribute("type", "text");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toBeFocused();
  await expect(input).toHaveValue("segretissima");
  await toggle.click();
  await expect(input).toHaveAttribute("type", "password");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
});

test("il campo non usa correttore né maiuscole, anche con la password mostrata", async ({
  page,
}) => {
  const input = page.getByTestId("campo-password-regole");
  const toggle = page
    .locator("#campo-password .campo")
    .first()
    .getByRole("button", { name: "Mostra la password" });
  for (const shown of [false, true]) {
    if (shown) await toggle.click();
    await expect(input).toHaveAttribute("type", shown ? "text" : "password");
    await expect(input).toHaveAttribute("spellcheck", "false");
    await expect(input).toHaveAttribute("autocapitalize", "none");
    await expect(input).toHaveAttribute(
      "passwordrules",
      "minlength: 8; maxlength: 72;",
    );
  }
});

test("la regola passa a «fatto» con 8 caratteri, senza regione live", async ({
  page,
}) => {
  const input = page.getByTestId("campo-password-regole");
  const rule = page
    .locator(".regole-password__regola")
    .filter({ hasText: "Da 8 a 72 caratteri" })
    .first();
  await expect(rule).not.toHaveClass(/rispettata/);
  await expect(rule).not.toContainText(", fatto");
  await input.fill("1234567");
  await expect(rule).not.toHaveClass(/rispettata/);
  await input.fill("12345678");
  await expect(rule).toHaveClass(/regole-password__regola--rispettata/);
  await expect(rule).toContainText(", fatto");
  await input.fill("a".repeat(73));
  await expect(rule).not.toHaveClass(/rispettata/);
  await expect(page.locator(".regole-password [aria-live]")).toHaveCount(0);
  await expect(page.locator(".regole-password[aria-live]")).toHaveCount(0);
});

test("l'errore sta sopra le regole ed è collegato al campo", async ({
  page,
}) => {
  const input = page.getByTestId("campo-password-errore");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  const described = (await input.getAttribute("aria-describedby")) ?? "";
  const ids = described.split(" ");
  expect(ids).toHaveLength(2);
  await expect(page.locator(`[id="${ids[0]}"]`)).toHaveText(
    "La password è troppo corta: servono almeno 8 caratteri.",
  );
  await expect(page.locator(`[id="${ids[1]}"]`)).toHaveClass(/regole-password/);
  const error = await page.locator(`[id="${ids[0]}"]`).boundingBox();
  const rules = await page.locator(`[id="${ids[1]}"]`).boundingBox();
  expect(error!.y).toBeLessThan(rules!.y);
});

test("il testo scritto non passa sotto l'occhio e il campo senza regole non ha lista", async ({
  page,
}) => {
  const padding = await page
    .getByTestId("campo-password-accesso")
    .evaluate((el) => getComputedStyle(el).paddingRight);
  expect(parseFloat(padding)).toBe(52);
  await expect(
    page
      .locator("figure")
      .filter({ has: page.getByTestId("campo-password-accesso") })
      .locator("ul.regole-password"),
  ).toHaveCount(0);
});

test("disabilitato: campo e bottone non rispondono", async ({ page }) => {
  const input = page.getByTestId("campo-password-disabilitato");
  await expect(input).toBeDisabled();
  await expect(input.locator("xpath=following-sibling::button")).toBeDisabled();
});

test("senza il parametro la galleria non mostra il campo password", async ({
  page,
}) => {
  await page.goto("/design-system");
  await expect(page.locator("#campo")).toBeVisible();
  await expect(page.locator("#campo-password")).toHaveCount(0);
});
