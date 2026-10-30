import { spawnSync } from "node:child_process";
import { expect, test } from "@playwright/test";

// Issue #95: the seed script must refuse any non-local Supabase URL before
// touching anything. Runs the real script with dummy values: no network call is
// made because the check happens before the client is created.

function runSeed(url: string) {
  const env: Record<string, string | undefined> = {
    PATH: process.env.PATH,
    NEXT_PUBLIC_SUPABASE_URL: url,
    SUPABASE_SECRET_KEY: "dummy-not-a-real-key",
    GITHUB_ACTIONS: "true",
  };
  for (const k of ["A", "B", "B2", "C"]) {
    env[`TEST_USER_${k}_EMAIL`] = `${k.toLowerCase()}@example.test`;
    env[`TEST_USER_${k}_PASSWORD`] = "dummy-password";
  }
  return spawnSync("node", ["scripts/seed-test-users.ts"], {
    env: env as NodeJS.ProcessEnv,
    encoding: "utf8",
    timeout: 30_000,
  });
}

for (const url of [
  "https://yksosqvugiempsldejyt.supabase.co",
  "https://example.supabase.co",
  "http://127.0.0.1.example.com",
]) {
  test(`seed refuses non-local URL ${url}`, () => {
    const result = runSeed(url);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("is not local");
    expect(result.stderr).toContain("Nothing was written");
  });
}
