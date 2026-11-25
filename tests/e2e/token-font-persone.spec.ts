import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import { SEED_HOME_A } from "../fixtures/invito";

// #196 (F2 token e font): the colour of the people on /nest, with the seed.
// A = Marco (Nest A, Casa D'Angelo), B2 = Paolo (Nest B, Casa Bianchi).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

const rows = (page: Page) =>
  page.getByRole("list", { name: "Chi c’è" }).getByRole("listitem");

test.describe("colori delle persone su /nest", () => {
  test("CA-19: Marco ha l'avatar corallo e nel database è ancora pomodoro", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("A"), skipReason("A"));
    test.skip(
      !secretKey || !supabaseUrl,
      "Chiave amministrativa non impostata",
    );
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto("/nest");
    await expect(rows(page)).toHaveCount(5);
    const marco = rows(page).nth(0);
    await expect(marco.getByText("Marco, tu", { exact: true })).toBeVisible();
    await expect(marco.locator(".avatar")).toHaveCSS(
      "background-color",
      "rgb(242, 118, 92)",
    );

    // Administrative role only to read the stored code, never to write.
    const admin = createClient(supabaseUrl!, secretKey!, {
      auth: { persistSession: false },
    });
    const { data, error } = await admin
      .from("household_members")
      .select("color")
      .eq("household_id", SEED_HOME_A)
      .eq("name", "Marco");
    expect(error).toBeNull();
    expect(data).toEqual([{ color: "pomodoro" }]);
  });

  test("CA-19 (parte): la PR non contiene file in supabase/", () => {
    // Meaningful only on the branch of #196; elsewhere the list of changed
    // files says nothing about this issue (same approach as CA-22 of #52).
    const run = (args: string[]): string | null => {
      try {
        return execFileSync("git", ["-c", "safe.directory=*", ...args], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
      } catch {
        return null;
      }
    };
    const branch =
      process.env.GITHUB_HEAD_REF ||
      process.env.GITHUB_REF_NAME ||
      run(["rev-parse", "--abbrev-ref", "HEAD"]) ||
      "";
    if (!/(^|\/)token-font$/.test(branch)) return;
    let diff = run(["diff", "--name-only", "origin/main...HEAD"]);
    if (diff === null) {
      run([
        "fetch",
        "--no-tags",
        "--deepen=200",
        "origin",
        "+main:refs/remotes/origin/main",
      ]);
      diff = run(["diff", "--name-only", "origin/main...HEAD"]);
    }
    expect(
      diff,
      "storia comune con origin/main non disponibile: CA-19 non verificabile",
    ).not.toBeNull();
    const inSupabase = (diff ?? "")
      .split("\n")
      .filter((file) => file.startsWith("supabase/"));
    expect(inSupabase).toEqual([]);
  });

  test("CA-20 (isolamento): Paolo vede solo i membri di Casa Bianchi", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("B2"), skipReason("B2"));
    await signInAs(page.context(), baseURL as string, "B2");
    await page.goto("/nest");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Casa Bianchi",
    );
    await expect(rows(page)).toHaveCount(4);
    const avatars = await rows(page).locator(".avatar").count();
    expect(avatars).toBe(4);
    for (const name of ["Marco", "Laura", "Sofia", "Tommaso", "Biscotto"]) {
      await expect(page.getByText(name, { exact: false })).toHaveCount(0);
    }
    // The page of Nest B never carries the id of Nest A.
    const html = await (await page.request.get("/nest")).text();
    expect(html).not.toContain(SEED_HOME_A);
  });
});
