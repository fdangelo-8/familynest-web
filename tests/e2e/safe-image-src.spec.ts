import { expect, test } from "@playwright/test";
import { safeImageSrc } from "../../src/lib/safe-image-src";

test.describe("safeImageSrc (#482)", () => {
  for (const ok of [
    "blob:https://example.test/6f1c2a9e-0000-4000-8000-123456789abc",
    "data:image/webp;base64,UklGRkIAAABXRUJQ",
    "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
    "/foto/biscotto.webp",
    "/",
  ]) {
    test(`accepts ${ok}`, () => {
      expect(safeImageSrc(ok)).toBe(ok);
    });
  }

  for (const bad of [
    "",
    "javascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "data:image/svg+xml,%3Csvg%3E%3C/svg%3E",
    "data:image/png;base64,AAAA",
    'data:image/webp;base64,AA"onerror="x',
    "https://example.test/foto.webp",
    "//example.test/foto.webp",
    "/\\example.test/foto.webp",
    "foto.webp",
    '/foto.webp" onerror="x',
    "/foto <b>.webp",
    'blob:https://example.test/x" onerror="y',
  ]) {
    test(`refuses ${JSON.stringify(bad)}`, () => {
      expect(safeImageSrc(bad)).toBeUndefined();
    });
  }

  test("refuses a missing value", () => {
    expect(safeImageSrc(undefined)).toBeUndefined();
  });

  test("avatar: javascript: and //host show the initial, no image", async ({
    page,
  }) => {
    await page.goto("/design-system?pezzi-pagine=1");
    const row = page.getByTestId("avatar-foto-rifiutata");
    await expect(row.locator("img")).toHaveCount(0);
    await expect(row.getByRole("img", { name: "Biscotto" })).toHaveText("B");
    await expect(row.getByRole("img", { name: "Miele" })).toHaveText("M");
  });
});
