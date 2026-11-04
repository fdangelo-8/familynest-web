import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { formatBusyAccessibleName } from "@/lib/calendar";
import {
  LENS_STORAGE_KEY,
  getLensSnapshot,
  getServerLensSnapshot,
  setLens,
} from "@/lib/lens";
import { readMemberWelcome } from "@/lib/welcome";

// Pure functions: no browser, no database (issue #231).

function stubStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };
  (globalThis as unknown as { window: unknown }).window = {
    sessionStorage: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
    },
  };
  return store;
}

test.afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

test.describe("lente iniziale (lens.ts)", () => {
  test("senza scelta nella sessione vale la lente del profilo", () => {
    stubStorage();
    expect(getLensSnapshot("nest")).toBe("nest");
    expect(getLensSnapshot("io")).toBe("io");
  });

  test("la lente toccata nella sessione vince sul profilo", () => {
    stubStorage({ [LENS_STORAGE_KEY]: "io" });
    expect(getLensSnapshot("nest")).toBe("io");
    setLens("nest");
    expect(getLensSnapshot("io")).toBe("nest");
  });

  test("un valore non valido nella sessione si ignora", () => {
    stubStorage({ [LENS_STORAGE_KEY]: "altro" });
    expect(getLensSnapshot("nest")).toBe("nest");
  });

  test("il server parte dalla lente del profilo", () => {
    expect(getServerLensSnapshot("nest")).toBe("nest");
    expect(getServerLensSnapshot("io")).toBe("io");
  });
});

function fakeClient(result: { data?: unknown; error?: unknown }) {
  return {
    rpc: () => Promise.resolve({ data: null, error: null, ...result }),
  } as unknown as SupabaseClient<Database>;
}

test.describe("benvenuto (welcome.ts)", () => {
  test("nessuna riga: nessun benvenuto", async () => {
    expect(await readMemberWelcome(fakeClient({ data: [] }))).toEqual({
      status: "none",
    });
  });

  test("riga con nome: benvenuto con nome", async () => {
    expect(
      await readMemberWelcome(
        fakeClient({ data: [{ inviter_name: "Marco" }] }),
      ),
    ).toEqual({ status: "named", inviterName: "Marco" });
  });

  test("riga con nome nullo: benvenuto senza nome", async () => {
    expect(
      await readMemberWelcome(fakeClient({ data: [{ inviter_name: null }] })),
    ).toEqual({ status: "unnamed" });
  });

  test("errore del database o risposta strana: errore", async () => {
    expect(
      await readMemberWelcome(fakeClient({ error: { message: "x" } })),
    ).toEqual({ status: "error" });
    expect(await readMemberWelcome(fakeClient({ data: "boh" }))).toEqual({
      status: "error",
    });
    const throwing = {
      rpc: () => {
        throw new Error("rete");
      },
    } as unknown as SupabaseClient<Database>;
    expect(await readMemberWelcome(throwing)).toEqual({ status: "error" });
  });
});

test("nome accessibile di «Occupato»", () => {
  const start = new Date("2026-10-20T07:00:00Z");
  const end = new Date("2026-10-20T13:00:00Z");
  expect(formatBusyAccessibleName("Paolo", start, end)).toBe(
    "Paolo ha un impegno, dalle 9:00 alle 15:00",
  );
});
