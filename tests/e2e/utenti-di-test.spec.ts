import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// CA-35 of issue #47: after `npm run seed:test-users`, every test user can sign
// in and sees only its own Nest. Pure API test (no browser), so it runs once.
//
// Target: any database seeded by the script. Locally use `npx supabase start`,
// then export the local URL, the local publishable key and the four test users
// (see .env.example). Skipped when the variables of B2 and C are missing, i.e.
// while the remote project is not seeded yet.

const HOME_A = "11111111-1111-4111-8111-111111111111";
const HOME_B = "22222222-2222-4222-8222-222222222222";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

type UserKey = "A" | "B" | "B2" | "C";

function credentials(key: UserKey) {
  return {
    email: process.env[`TEST_USER_${key}_EMAIL`] ?? "",
    password: process.env[`TEST_USER_${key}_PASSWORD`] ?? "",
  };
}

const configured =
  !!url &&
  !!publishableKey &&
  (["A", "B", "B2", "C"] as UserKey[]).every((k) => {
    const c = credentials(k);
    return c.email && c.password;
  });

async function signedInClient(key: UserKey) {
  const client = createClient(url as string, publishableKey as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword(credentials(key));
  expect(error).toBeNull();
  return client;
}

test.describe("utenti di test (seed)", () => {
  test.skip(
    !configured,
    "Supabase seeded with the four test users not configured",
  );
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-only test, one run");
  });

  test("CA-35: A accede e vede solo Casa D'Angelo", async () => {
    const client = await signedInClient("A");
    const { data: nests, error } = await client
      .from("households")
      .select("id, name");
    expect(error).toBeNull();
    expect(nests).toEqual([{ id: HOME_A, name: "Casa D'Angelo" }]);

    const { data: members } = await client
      .from("household_members")
      .select("household_id, name");
    expect(members).toHaveLength(5);
    expect(new Set(members?.map((m) => m.household_id))).toEqual(
      new Set([HOME_A]),
    );
  });

  test("CA-35: B accede e vede solo Casa Bianchi", async () => {
    const client = await signedInClient("B");
    const { data: nests, error } = await client
      .from("households")
      .select("id, name");
    expect(error).toBeNull();
    expect(nests).toEqual([{ id: HOME_B, name: "Casa Bianchi" }]);

    const { data: members } = await client
      .from("household_members")
      .select("household_id, name");
    expect(members).toHaveLength(4);
    expect(new Set(members?.map((m) => m.household_id))).toEqual(
      new Set([HOME_B]),
    );
  });

  test("CA-35: B2 accede e vede solo Casa Bianchi", async () => {
    const client = await signedInClient("B2");
    const { data: nests, error } = await client
      .from("households")
      .select("id, name");
    expect(error).toBeNull();
    expect(nests).toEqual([{ id: HOME_B, name: "Casa Bianchi" }]);
  });

  test("CA-35: stato vuoto, C accede e non vede nessun Nest", async () => {
    const client = await signedInClient("C");
    const { data: nests, error } = await client.from("households").select("id");
    expect(error).toBeNull();
    expect(nests).toEqual([]);
    const { data: members } = await client
      .from("household_members")
      .select("id");
    expect(members).toEqual([]);
  });

  test("CA-35: isolamento, A non legge membri e inviti di Casa Bianchi", async () => {
    const client = await signedInClient("A");
    const { data: members } = await client
      .from("household_members")
      .select("id")
      .eq("household_id", HOME_B);
    expect(members).toEqual([]);
    const { data: invitations } = await client
      .from("invitations")
      .select("id")
      .eq("household_id", HOME_B);
    expect(invitations).toEqual([]);
  });

  test("CA-35: errore, una password sbagliata viene rifiutata", async () => {
    const client = createClient(url as string, publishableKey as string, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await client.auth.signInWithPassword({
      email: credentials("A").email,
      password: `${credentials("A").password}-sbagliata`,
    });
    expect(error).not.toBeNull();
    expect(data.session).toBeNull();
  });
});
