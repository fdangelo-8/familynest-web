// Creates (or updates) the end-to-end test users in the Supabase project, then
// rebuilds their Nests, members and invitations exactly as in supabase/seed.sql.
//
// Run with: npm run seed:test-users   (Node 22 strips the types, so only
// erasable TypeScript syntax is used here: no enums, `import type` only.)
//
// Idempotent: users are created or updated, the Nests of the test users are
// deleted and rebuilt. Nothing else is touched. Secrets are never printed.
//
// Safety: test accounts carry app_metadata.familynest_test_user = true. All
// checks run before the first write; an account without the marker, or a Nest
// shared with non-test accounts, stops the script with nothing written.
//
// Not transactional: if it stops after the cleanup, the test data stays
// incomplete until the script is run again.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

const ALLOWED_PROJECT_REF = "yksosqvugiempsldejyt";
const TEST_MARKER = "familynest_test_user";
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

type TestUserKey = "A" | "B" | "B2" | "C";
const USER_KEYS: TestUserKey[] = ["A", "B", "B2", "C"];
const FULL_NAMES: Record<TestUserKey, string> = {
  A: "Marco D'Angelo",
  B: "Giulia Bianchi",
  B2: "Paolo Bianchi",
  C: "Chiara Neri",
};

function fail(message: string): never {
  console.error(`seed-test-users: ${message}`);
  process.exit(1);
}

// Reads and validates every variable before any write. Messages carry names only.
function readConfig() {
  const names = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
    ...USER_KEYS.flatMap((k) => [
      `TEST_USER_${k}_EMAIL`,
      `TEST_USER_${k}_PASSWORD`,
    ]),
  ];
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length > 0) {
    fail(
      `missing environment variables: ${missing.join(", ")}. Nothing was written.`,
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return fail(
      "NEXT_PUBLIC_SUPABASE_URL is not a valid URL. Nothing was written.",
    );
  }
  const isLocal = host === "127.0.0.1" || host === "localhost";
  if (!isLocal && host !== `${ALLOWED_PROJECT_REF}.supabase.co`) {
    fail(
      "NEXT_PUBLIC_SUPABASE_URL does not point to the FamilyNest project or to the local database. Nothing was written.",
    );
  }
  // The remote project is seeded only by the GitHub workflow: a local shell that
  // still points to the remote project (a common mistake) must not write there.
  if (!isLocal && process.env.GITHUB_ACTIONS !== "true") {
    fail(
      "NEXT_PUBLIC_SUPABASE_URL points to the remote project: use the 'Seed utenti di test' workflow, or point to the local database. Nothing was written.",
    );
  }

  const users = USER_KEYS.map((key) => ({
    key,
    email: (process.env[`TEST_USER_${key}_EMAIL`] as string)
      .trim()
      .toLowerCase(),
    password: process.env[`TEST_USER_${key}_PASSWORD`] as string,
  }));
  if (new Set(users.map((u) => u.email)).size !== users.length) {
    fail(
      "the four test users must have different emails. Nothing was written.",
    );
  }
  return {
    url,
    secretKey: process.env.SUPABASE_SECRET_KEY as string,
    users,
  };
}

async function main() {
  const config = readConfig();
  const supabase = createClient<Database>(config.url, config.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const HOME_A = "11111111-1111-4111-8111-111111111111";
  const HOME_B = "22222222-2222-4222-8222-222222222222";
  const fixedHouseholds = [HOME_A, HOME_B];

  // 1. Read-only checks. Nothing is written until every check has passed.
  const existing = new Map<string, { id: string; marked: boolean }>();
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) fail(`cannot list accounts (${error.message}).`);
    for (const u of data.users) {
      if (u.email) {
        existing.set(u.email.toLowerCase(), {
          id: u.id,
          marked: u.app_metadata?.[TEST_MARKER] === true,
        });
      }
    }
    if (data.users.length < 200) break;
  }

  const found = config.users.flatMap((u) => {
    const account = existing.get(u.email);
    return account ? [{ key: u.key, ...account }] : [];
  });
  const testIds = new Set(found.map((f) => f.id));

  const memberships: { household_id: string; user_id: string | null }[] = [];
  if (found.length > 0) {
    const { data, error } = await supabase
      .from("household_members")
      .select("household_id, user_id")
      .in("user_id", [...testIds]);
    if (error) fail(`cannot read memberships (${error.message}).`);
    memberships.push(...(data ?? []));
  }

  // An existing account without the marker is accepted only if it is in no Nest
  // or only in the two fixed test Nests.
  for (const f of found) {
    if (f.marked) continue;
    const outside = memberships.some(
      (m) => m.user_id === f.id && !fixedHouseholds.includes(m.household_id),
    );
    if (outside) {
      fail(
        `test user ${f.key} is not marked as a test account. Nothing was written.`,
      );
    }
  }

  // A Nest other than the fixed ones is deleted only if every account in it
  // is a test user.
  const otherHouseholds = [
    ...new Set(
      memberships
        .map((m) => m.household_id)
        .filter((id) => !fixedHouseholds.includes(id)),
    ),
  ];
  if (otherHouseholds.length > 0) {
    const { data, error } = await supabase
      .from("household_members")
      .select("user_id")
      .in("household_id", otherHouseholds)
      .not("user_id", "is", null);
    if (error) fail(`cannot read memberships (${error.message}).`);
    if ((data ?? []).some((m) => !m.user_id || !testIds.has(m.user_id))) {
      fail(
        "a test user belongs to a Nest with other accounts. Nothing was written.",
      );
    }
  }

  // 2. Accounts: create or update, confirmed, marked, with the given password.
  const ids = {} as Record<TestUserKey, string>;
  for (const u of config.users) {
    const attributes = {
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: FULL_NAMES[u.key] },
      app_metadata: { [TEST_MARKER]: true },
    };
    const known = existing.get(u.email);
    if (known) {
      const { error } = await supabase.auth.admin.updateUserById(
        known.id,
        attributes,
      );
      if (error) fail(`cannot update test user ${u.key} (${error.message}).`);
      // The profile name is written by a trigger only at creation.
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ display_name: FULL_NAMES[u.key] })
        .eq("id", known.id);
      if (profileError) {
        fail(
          `cannot update profile of test user ${u.key} (${profileError.message}).`,
        );
      }
      ids[u.key] = known.id;
    } else {
      const { data, error } = await supabase.auth.admin.createUser(attributes);
      if (error || !data.user) {
        return fail(
          `cannot create test user ${u.key} (${error?.message ?? "no user"}).`,
        );
      }
      ids[u.key] = data.user.id;
    }
  }

  // 3. Start clean: delete the two fixed Nests and the checked Nests of the
  // test users (members and invitations go with them by cascade). Deleting the
  // Nest directly avoids the household_members_after_delete trigger.
  {
    const { error } = await supabase
      .from("households")
      .delete()
      .in("id", [...fixedHouseholds, ...otherHouseholds]);
    if (error) fail(`cannot remove old test Nests (${error.message}).`);
  }

  // 4. Nests, with the same ids and order as supabase/seed.sql.
  const now = Date.now();
  const ago = (ms: number) => new Date(now - ms).toISOString();
  const thirtyDays = 30 * DAY_MS;
  {
    const { error } = await supabase.from("households").insert([
      {
        id: HOME_A,
        name: "Casa D'Angelo",
        household_type: "family_with_children",
        created_at: ago(thirtyDays),
      },
      {
        id: HOME_B,
        name: "Casa Bianchi",
        household_type: "family_with_children",
        created_at: ago(thirtyDays),
      },
    ]);
    if (error) fail(`cannot create Nests (${error.message}).`);
  }

  // 5. Members, created_at one minute apart.
  type Member = Database["public"]["Tables"]["household_members"]["Insert"];
  const at = (minutes: number) => ago(thirtyDays - minutes * MINUTE_MS);
  const base = {
    birth_date: null,
    user_id: null,
    is_admin: false,
    joined_at: null,
  };
  const members: Member[] = [
    {
      ...base,
      id: "a1000000-0000-4000-8000-000000000001",
      household_id: HOME_A,
      kind: "adult",
      name: "Marco",
      color: "pomodoro",
      user_id: ids.A,
      is_admin: true,
      joined_at: ago(thirtyDays),
      created_at: at(0),
    },
    {
      ...base,
      id: "a1000000-0000-4000-8000-000000000002",
      household_id: HOME_A,
      kind: "adult",
      name: "Laura",
      color: "glicine",
      created_at: at(1),
    },
    {
      ...base,
      id: "a1000000-0000-4000-8000-000000000003",
      household_id: HOME_A,
      kind: "child",
      name: "Sofia",
      color: "salvia",
      birth_date: "2016-12-14",
      created_at: at(2),
    },
    {
      ...base,
      id: "a1000000-0000-4000-8000-000000000004",
      household_id: HOME_A,
      kind: "child",
      name: "Tommaso",
      color: "cobalto",
      birth_date: "2020-04-02",
      created_at: at(3),
    },
    {
      ...base,
      id: "a1000000-0000-4000-8000-000000000005",
      household_id: HOME_A,
      kind: "pet",
      name: "Biscotto",
      color: "zafferano",
      created_at: at(4),
    },
    {
      ...base,
      id: "b1000000-0000-4000-8000-000000000001",
      household_id: HOME_B,
      kind: "adult",
      name: "Giulia",
      color: "cobalto",
      user_id: ids.B,
      is_admin: true,
      joined_at: ago(thirtyDays),
      created_at: at(0),
    },
    {
      ...base,
      id: "b1000000-0000-4000-8000-000000000002",
      household_id: HOME_B,
      kind: "adult",
      name: "Paolo",
      color: "salvia",
      user_id: ids.B2,
      joined_at: ago(20 * DAY_MS),
      created_at: at(1),
    },
    {
      ...base,
      id: "b1000000-0000-4000-8000-000000000003",
      household_id: HOME_B,
      kind: "child",
      name: "Leo",
      color: "zafferano",
      birth_date: "2019-09-05",
      created_at: at(2),
    },
    {
      ...base,
      id: "b1000000-0000-4000-8000-000000000004",
      household_id: HOME_B,
      kind: "adult",
      name: "Anna",
      color: "pomodoro",
      created_at: at(3),
    },
  ];
  {
    const { error } = await supabase.from("household_members").insert(members);
    if (error) fail(`cannot create members (${error.message}).`);
  }

  // 6. Invitations through the admin client (the trigger skips the
  // administrator check for it). Laura's is valid, Anna's is pending but expired.
  {
    const { error } = await supabase.from("invitations").insert([
      {
        id: "a2000000-0000-4000-8000-000000000001",
        household_id: HOME_A,
        member_id: "a1000000-0000-4000-8000-000000000002",
        invited_by_member_id: "a1000000-0000-4000-8000-000000000001",
        short_code: "4821",
        status: "pending",
        created_at: ago(DAY_MS),
        expires_at: new Date(now + 6 * DAY_MS).toISOString(),
      },
      {
        id: "b2000000-0000-4000-8000-000000000001",
        household_id: HOME_B,
        member_id: "b1000000-0000-4000-8000-000000000004",
        invited_by_member_id: "b1000000-0000-4000-8000-000000000001",
        short_code: "7305",
        status: "pending",
        created_at: ago(10 * DAY_MS),
        expires_at: new Date(now - 3 * DAY_MS).toISOString(),
      },
    ]);
    if (error) fail(`cannot create invitations (${error.message}).`);
  }

  console.log(
    "seed-test-users: done. 4 accounts, 2 Nests, 9 members, 2 invitations.",
  );
}

main().catch((e: unknown) => {
  fail(`unexpected error (${e instanceof Error ? e.name : "unknown"}).`);
});
