import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";

// Onboarding step 1, corrections of #69 (#43 points 15-17). C never presses
// "Continua" or "Indietro": C must keep no Nest.

async function openAsC(page: Page, baseURL: string | undefined, width: number) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
  await signInAs(page.context(), baseURL as string, "C");
  await page.goto("/onboarding");
}

/** Number of Nests C can read (RLS applies): must stay 0, C never continues. */
async function nestsOfC(): Promise<number> {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: signInError } = await client.auth.signInWithPassword({
    email: process.env.TEST_USER_C_EMAIL ?? "",
    password: process.env.TEST_USER_C_PASSWORD ?? "",
  });
  if (signInError) throw new Error("Accesso di prova fallito per C");
  const { data, error } = await client.from("households").select("id");
  if (error) throw new Error("Lettura dei Nest fallita");
  return data.length;
}

async function expectSteps(page: Page, total: 3 | 4) {
  const bar = page.getByRole("progressbar", { name: `Passo 1 di ${total}` });
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute("aria-valuemin", "1");
  await expect(bar).toHaveAttribute("aria-valuenow", "1");
  await expect(bar).toHaveAttribute("aria-valuemax", String(total));
  await expect(bar.locator(".tacche-passi__tacca")).toHaveCount(total);
  await expect(bar.locator(".tacche-passi__tacca.is-fatta")).toHaveCount(1);
  await expect(bar.locator(".tacche-passi__tacca").first()).toHaveClass(
    /is-fatta/,
  );
}

for (const width of [390, 1280]) {
  test.describe(`con C a ${width} px`, () => {
    test.beforeEach(() => {
      test.skip(!usersConfigured("C"), skipReason("C"));
    });

    test("CA-1, CA-3: «Solo io» e 4 passi senza scelta", async ({
      page,
      baseURL,
    }) => {
      await openAsC(page, baseURL, width);
      const radios = page
        .getByRole("radiogroup", { name: "Chi vive con te?" })
        .getByRole("radio");
      await expect(radios).toHaveCount(4);
      await expect(radios.first()).toHaveAccessibleName("Solo io");
      await expect(radios.first()).toHaveAccessibleDescription(
        "Per organizzare le tue cose",
      );
      for (const radio of await radios.all()) {
        await expect(radio).not.toHaveAttribute("aria-checked", "true");
      }
      await expect(radios).toHaveText([
        /Solo io/,
        /In coppia/,
        /In famiglia, con figli/,
        /Con coinquilini/,
      ]);
      expect(await page.locator("main").innerText()).not.toMatch(
        /Vivo da solo/i,
      );
      expect(await page.locator("main").textContent()).not.toMatch(
        /Vivo da solo/i,
      );
      await expectSteps(page, 4);
    });

    test("CA-4, CA-5: il conteggio segue l'ultima scelta", async ({
      page,
      baseURL,
    }) => {
      await openAsC(page, baseURL, width);
      const pick = (name: string) =>
        page
          .getByRole("radiogroup", { name: "Chi vive con te?" })
          .getByRole("radio", { name })
          .click();
      await pick("Solo io");
      await expectSteps(page, 3);
      await expect(page).toHaveURL(/\/onboarding$/);
      await expect(
        page.getByRole("progressbar", { name: "Passo 1 di 4" }),
      ).toHaveCount(0);
      const sequence: [string, 3 | 4][] = [
        ["In coppia", 4],
        ["Solo io", 3],
        ["In famiglia, con figli", 4],
        ["Solo io", 3],
        ["Con coinquilini", 4],
      ];
      for (const [name, total] of sequence) {
        await pick(name);
        await expectSteps(page, total);
      }
    });

    test("CA-7: dopo il ricaricamento torna «Passo 1 di 4»", async ({
      page,
      baseURL,
    }) => {
      await openAsC(page, baseURL, width);
      await page.getByRole("radio", { name: "Solo io" }).click();
      await expectSteps(page, 3);
      await page.reload();
      await expectSteps(page, 4);
      for (const radio of await page.getByRole("radio").all()) {
        await expect(radio).not.toHaveAttribute("aria-checked", "true");
      }
      // C never presses "Continua": still no Nest, session still valid.
      await expect(page).toHaveURL(/\/onboarding$/);
      await expect(
        page.getByRole("button", { name: "Continua" }),
      ).toBeVisible();
      expect(await nestsOfC()).toBe(0);
    });
  });
}

test.describe("con C a 390 px", () => {
  test.beforeEach(() => {
    test.skip(!usersConfigured("C"), skipReason("C"));
  });

  test("CA-6: tastiera", async ({ page, baseURL }) => {
    await openAsC(page, baseURL, 390);
    await page
      .getByRole("radiogroup", { name: "Chi vive con te?" })
      .getByRole("radio")
      .first()
      .focus();
    for (const [key, total] of [
      ["Space", 3],
      ["ArrowDown", 4],
      ["ArrowUp", 3],
      ["ArrowUp", 4],
    ] as const) {
      await page.keyboard.press(key);
      await expectSteps(page, total);
    }
  });

  test("CA-8: cambio di larghezza senza ricaricare", async ({
    page,
    baseURL,
  }) => {
    await openAsC(page, baseURL, 390);
    await page.getByRole("radio", { name: "Solo io" }).click();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByRole("radio", { name: "Solo io" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expectSteps(page, 3);
  });
});

test.describe("controlli statici (punto 17)", () => {
  const read = (path: string) => readFileSync(path, "utf8");
  const filesIn = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? filesIn(join(dir, entry.name))
        : [join(dir, entry.name)],
    );

  test("CA-10: la pagina usa l'errore dell'onboarding", () => {
    const page = read("src/app/onboarding/page.tsx");
    expect(page).not.toMatch(/FrameError|ErrorMain/);
    expect(page).toMatch(/from "@\/components\/onboarding\/OnboardingError"/);
  });

  test("CA-11: PageError con testo, h1 e router.refresh()", () => {
    const code = read("src/components/onboarding/OnboardingError.tsx");
    expect(code).toContain("<PageError");
    expect(code).toContain('text="Controlla la connessione e riprova."');
    expect(code).toContain("headingLevel={1}");
    expect(code).toContain("router.refresh()");
    const files = [
      ...filesIn("src/app/onboarding"),
      ...filesIn("src/components/onboarding"),
    ];
    // Guard against an empty walk: the known files must all be there.
    for (const known of ["page.tsx", "OnboardingStep.tsx", "choices.ts"]) {
      expect(
        files.some((f) => f.endsWith(known)),
        known,
      ).toBe(true);
    }
    for (const file of files) {
      const text = read(file);
      expect(text, file).not.toMatch(/torna a oggi/i);
      // «Vai a Oggi» of the Pronto step (#15) is required: only that file may link.
      if (file.endsWith("ReadyScreen.tsx")) continue;
      expect(text, file).not.toContain('href="/oggi"');
    }
  });

  test("CA-12: nessun file condiviso modificato", () => {
    // Only meaningful on the branch of #69: elsewhere the list of changed
    // files says nothing about this issue. Same approach as CA-22 of #52.
    const run = (args: string[]): string | null => {
      try {
        // safe.directory: the CI container runs as another user than the owner.
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
      run(["rev-parse", "--abbrev-ref", "HEAD"]) ||
      "";
    if (/onboarding-chi-vive-correzioni$/.test(branch)) {
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
        "storia comune con origin/main non disponibile: CA-12 non verificabile",
      ).not.toBeNull();
      for (const file of (diff ?? "").split("\n").filter(Boolean)) {
        expect(file).not.toMatch(
          /^(src\/components\/ui\/|src\/lib\/|src\/app\/\(app\)\/|supabase\/|src\/app\/components\.css$|src\/app\/globals\.css$)/,
        );
      }
    }
    expect(read("src/components/ui/PageError/PageError.tsx")).toContain(
      "Controlla la connessione e riprova. Se il problema resta, torna a Oggi.",
    );
  });
});
