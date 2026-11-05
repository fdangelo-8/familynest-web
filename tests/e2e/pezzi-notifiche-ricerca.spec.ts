import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBarConfig } from "../../src/lib/app-routes";
import {
  dropAddText,
  setAddText,
  takeAddText,
} from "../../src/lib/add-text-handoff";
import {
  countUnreadNotifications,
  listNotifications,
  markNotificationsRead,
} from "../../src/lib/notifications";
import {
  RECENT_SEARCHES_MAX,
  addRecentSearch,
  clearAllRecentSearches,
  clearRecentSearches,
  readRecentSearches,
  restoreRecentSearches,
  sameSearchText,
  type RecentStorage,
} from "../../src/lib/recent-searches";
import {
  isSearchable,
  searchHousehold,
  type SearchHit,
} from "../../src/lib/search-household";
import type { Database } from "../../src/types/database";

// Pure functions of the shared pieces for Notifiche (#39) and Ricerca (#40),
// issue #243: no browser, no database.

type Client = SupabaseClient<Database>;

function fakeStorage(initial: Record<string, string> = {}): RecentStorage & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get length() {
      return data.size;
    },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

/** A client that answers every `rpc` with one reply and records the calls. */
function rpcClient(
  reply: (
    name: string,
    args: unknown,
  ) => { data?: unknown; error?: { code?: string; message?: string } | null },
) {
  const calls: { name: string; args: unknown }[] = [];
  const client = {
    rpc: (name: string, args?: unknown) => {
      calls.push({ name, args });
      const answer = reply(name, args);
      return Promise.resolve({
        data: answer.data ?? null,
        error: answer.error ?? null,
      });
    },
  } as unknown as Client;
  return { client, calls };
}

const ID = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test.describe("ricerche recenti (#40)", () => {
  test("tiene al massimo 3 ricerche, dalla più recente, senza doppioni", () => {
    const storage = fakeStorage();
    addRecentSearch("u1", "nuoto", storage);
    addRecentSearch("u1", "  bollo   auto ", storage);
    expect(readRecentSearches("u1", storage)).toEqual(["bollo auto", "nuoto"]);
    addRecentSearch("u1", "latte", storage);
    addRecentSearch("u1", "pediatra", storage);
    expect(readRecentSearches("u1", storage)).toEqual([
      "pediatra",
      "latte",
      "bollo auto",
    ]);
    expect(RECENT_SEARCHES_MAX).toBe(3);
    // same letters, case and accents ignored: it moves up
    addRecentSearch("u1", "BOLLO AUTO", storage);
    expect(readRecentSearches("u1", storage)).toEqual([
      "BOLLO AUTO",
      "pediatra",
      "latte",
    ]);
    expect(sameSearchText("Caffè", "caffe  ")).toBe(true);
    expect(sameSearchText("caffè", "tè")).toBe(false);
  });

  test("un testo vuoto non cambia nulla; la chiave non contiene il testo", () => {
    const storage = fakeStorage();
    addRecentSearch("u1", "   ", storage);
    expect(storage.data.size).toBe(0);
    addRecentSearch("u1", "segreto", storage);
    for (const key of storage.data.keys()) {
      expect(key).not.toContain("segreto");
    }
  });

  test("ogni account ha le sue; «Cancella» e «Annulla» rimettono lo stesso ordine", () => {
    const storage = fakeStorage();
    addRecentSearch("marco", "nuoto", storage);
    addRecentSearch("marco", "bollo", storage);
    addRecentSearch("laura", "yoga", storage);
    expect(readRecentSearches("laura", storage)).toEqual(["yoga"]);
    const before = clearRecentSearches("marco", storage);
    expect(before).toEqual(["bollo", "nuoto"]);
    expect(readRecentSearches("marco", storage)).toEqual([]);
    expect(readRecentSearches("laura", storage)).toEqual(["yoga"]);
    restoreRecentSearches("marco", before, storage);
    expect(readRecentSearches("marco", storage)).toEqual(["bollo", "nuoto"]);
  });

  test("«Esci» le toglie a tutti gli account e lascia il resto", () => {
    const storage = fakeStorage({ altro: "1" });
    addRecentSearch("marco", "nuoto", storage);
    addRecentSearch("laura", "yoga", storage);
    clearAllRecentSearches(storage);
    expect(readRecentSearches("marco", storage)).toEqual([]);
    expect(readRecentSearches("laura", storage)).toEqual([]);
    expect([...storage.data.keys()]).toEqual(["altro"]);
  });

  test("dati rovinati o archivio che rifiuta: nessun errore", () => {
    const broken = fakeStorage({
      "familynest:recent-searches:u1": "{non json",
      "familynest:recent-searches:u2": JSON.stringify([1, "ok", "", "OK"]),
    });
    expect(readRecentSearches("u1", broken)).toEqual([]);
    expect(readRecentSearches("u2", broken)).toEqual(["ok"]);
    const refusing: RecentStorage = {
      length: 0,
      key: () => null,
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readRecentSearches("u1", refusing)).toEqual([]);
    expect(() => addRecentSearch("u1", "x y", refusing)).not.toThrow();
    expect(() => clearAllRecentSearches(refusing)).not.toThrow();
    expect(readRecentSearches("u1", null)).toEqual([]);
  });
});

test.describe("testo verso Aggiungi (#40)", () => {
  test("si legge una volta sola e poi è vuoto", () => {
    dropAddText();
    expect(takeAddText()).toBeNull();
    setAddText({ text: "  nuoto giovedì  ", type: "impegno" });
    expect(takeAddText()).toEqual({ text: "nuoto giovedì", type: "impegno" });
    expect(takeAddText()).toBeNull();
  });

  test("un testo vuoto non lascia nulla; dropAddText lo butta", () => {
    setAddText({ text: "   " });
    expect(takeAddText()).toBeNull();
    setAddText({ text: "latte" });
    dropAddText();
    expect(takeAddText()).toBeNull();
  });
});

test.describe("ricerca del Nest (#40)", () => {
  test("isSearchable: testo, persona o periodo, con i limiti della funzione", () => {
    expect(isSearchable({})).toBe(false);
    expect(isSearchable({ text: "n" })).toBe(false);
    expect(isSearchable({ text: "nu" })).toBe(true);
    expect(isSearchable({ text: "x".repeat(101) })).toBe(false);
    expect(isSearchable({ memberId: ID(1) })).toBe(true);
    expect(isSearchable({ from: "2026-11-01" })).toBe(false);
    expect(isSearchable({ from: "2026-11-01", to: "2026-11-30" })).toBe(true);
    expect(isSearchable({ from: "2026-11-30", to: "2026-11-01" })).toBe(false);
    expect(isSearchable({ from: "2026-02-30", to: "2026-03-01" })).toBe(false);
    // 400 days included is the longest period
    expect(isSearchable({ from: "2026-01-01", to: "2027-02-04" })).toBe(true);
    expect(isSearchable({ from: "2026-01-01", to: "2027-02-05" })).toBe(false);
    expect(isSearchable({ text: "nuoto", kinds: [] })).toBe(false);
  });

  test("manda solo i parametri dati, ripulisce il testo e chiama la funzione in POST", async () => {
    const { client, calls } = rpcClient(() => ({ data: [] }));
    const result = await searchHousehold(
      { text: "  nuoto  ", kinds: ["event", "todo"] },
      client,
    );
    expect(result).toEqual({ ok: true, hits: [] });
    expect(calls).toEqual([
      {
        name: "search_household",
        args: { p_text: "nuoto", p_kinds: ["event", "todo"] },
      },
    ]);
  });

  test("distingue la riga piena dalla riga «Occupato» mascherata", async () => {
    const base = {
      sort_index: 1,
      title: null,
      location: null,
      author_member_id: null,
      member_ids: null,
      escort_member_id: null,
      recurrence: null,
      recurrence_weekdays: null,
      series_starts_on: null,
      due_date: null,
      is_private: null,
      assignee_member_id: null,
      for_member_id: null,
      quantity: null,
      id: null,
      starts_at: null,
      ends_at: null,
      occurrence_day: null,
      visibility: null,
      is_masked: false,
    };
    const rows = [
      {
        ...base,
        kind: "event",
        id: ID(1),
        title: "Nuoto Sofia",
        location: "Piscina comunale",
        starts_at: "2026-11-05T16:00:00Z",
        ends_at: "2026-11-05T17:30:00Z",
        occurrence_day: "2026-11-05",
        visibility: "household",
        author_member_id: ID(10),
        member_ids: [ID(11)],
        recurrence: "weekly",
        recurrence_weekdays: [4],
        series_starts_on: "2026-10-01",
      },
      {
        ...base,
        kind: "event",
        is_masked: true,
        // a masked row that carries a title by mistake: nothing but the
        // allowed fields may come out
        title: "Visita riservata",
        location: "Studio",
        starts_at: "2026-11-06T09:00:00Z",
        ends_at: "2026-11-06T10:00:00Z",
        occurrence_day: "2026-11-06",
        visibility: "busy",
        author_member_id: ID(12),
      },
      {
        ...base,
        kind: "deadline",
        id: ID(2),
        title: "Bollo auto",
        due_date: "2026-11-30",
        is_private: false,
        assignee_member_id: ID(10),
      },
      {
        ...base,
        kind: "todo",
        id: ID(3),
        title: "Chiamare il commercialista",
        is_private: true,
      },
      {
        ...base,
        kind: "shopping_item",
        id: ID(4),
        title: "Latte",
        quantity: "2",
      },
      // not provably a row of its kind: dropped
      { ...base, kind: "todo", id: null },
      { ...base, kind: "event", visibility: "household", id: null },
      "not a row",
    ];
    const { client } = rpcClient(() => ({ data: rows }));
    const result = await searchHousehold({ text: "no" }, client);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const hits: SearchHit[] = result.hits;
    expect(hits).toHaveLength(5);
    const [full, masked, deadline, todo, shopping] = hits;
    expect(full).toMatchObject({
      kind: "event",
      masked: false,
      title: "Nuoto Sofia",
      location: "Piscina comunale",
      occurrenceDay: "2026-11-05",
      memberIds: [ID(11)],
      recurrenceWeekdays: [4],
      seriesStartsOn: "2026-10-01",
    });
    expect(masked).toEqual({
      kind: "event",
      masked: true,
      startsAt: "2026-11-06T09:00:00Z",
      endsAt: "2026-11-06T10:00:00Z",
      occurrenceDay: "2026-11-06",
      visibility: "busy",
      authorMemberId: ID(12),
    });
    expect(deadline).toMatchObject({
      kind: "deadline",
      masked: false,
      dueDate: "2026-11-30",
      assigneeMemberId: ID(10),
      isPrivate: false,
    });
    expect(todo).toMatchObject({
      kind: "todo",
      dueDate: null,
      isPrivate: true,
    });
    expect(shopping).toEqual({
      kind: "shopping_item",
      masked: false,
      id: ID(4),
      title: "Latte",
      quantity: "2",
    });
  });

  test("errore, risposta strana o eccezione: {ok: false} senza dettagli, e query non valida senza richiesta", async () => {
    const failing = rpcClient(() => ({
      error: { code: "22023", message: "il testo: nuoto" },
    }));
    const failed = await searchHousehold({ text: "nuoto" }, failing.client);
    expect(failed).toEqual({ ok: false });
    expect(JSON.stringify(failed)).not.toContain("nuoto");

    const odd = rpcClient(() => ({ data: { not: "a list" } }));
    expect(await searchHousehold({ text: "nuoto" }, odd.client)).toEqual({
      ok: false,
    });

    const throwing = {
      rpc: () => {
        throw new Error("offline");
      },
    } as unknown as Client;
    expect(await searchHousehold({ text: "nuoto" }, throwing)).toEqual({
      ok: false,
    });

    const unused = rpcClient(() => ({ data: [] }));
    expect(await searchHousehold({ text: "n" }, unused.client)).toEqual({
      ok: false,
    });
    expect(unused.calls).toHaveLength(0);
  });
});

test.describe("notifiche (#39)", () => {
  test("campanella: il numero, e nessun errore se la lettura fallisce", async () => {
    const ok = rpcClient(() => ({ data: 3 }));
    expect(await countUnreadNotifications(ok.client)).toEqual({
      ok: true,
      count: 3,
    });
    expect(ok.calls[0]?.name).toBe("count_unread_notifications");

    const server = rpcClient(() => ({ error: { code: "XX000" } }));
    expect(await countUnreadNotifications(server.client)).toEqual({
      ok: false,
      reason: "server",
    });
    const network = rpcClient(() => ({
      error: { code: "", message: "TypeError: Failed to fetch" },
    }));
    expect(await countUnreadNotifications(network.client)).toEqual({
      ok: false,
      reason: "network",
    });
    const odd = rpcClient(() => ({ data: "3" }));
    expect(await countUnreadNotifications(odd.client)).toMatchObject({
      ok: false,
    });
  });

  test("«letta»: solo id, uno alla volta senza doppioni, a blocchi di 200", async () => {
    const empty = rpcClient(() => ({}));
    expect(await markNotificationsRead([], empty.client)).toEqual({ ok: true });
    expect(empty.calls).toHaveLength(0);

    const ids = Array.from({ length: 450 }, (_, n) => ID(n + 1));
    const many = rpcClient(() => ({}));
    expect(
      await markNotificationsRead([...ids, ids[0] as string], many.client),
    ).toEqual({ ok: true });
    expect(many.calls.map((c) => c.name)).toEqual([
      "mark_notifications_read",
      "mark_notifications_read",
      "mark_notifications_read",
    ]);
    const sizes = many.calls.map(
      (c) => (c.args as { p_ids: string[] }).p_ids.length,
    );
    expect(sizes).toEqual([200, 200, 50]);

    const failing = rpcClient(() => ({ error: { code: "42501" } }));
    expect(await markNotificationsRead([ID(1)], failing.client)).toEqual({
      ok: false,
      reason: "server",
    });
    const offline = rpcClient(() => ({ error: { code: "" } }));
    expect(await markNotificationsRead([ID(1)], offline.client)).toEqual({
      ok: false,
      reason: "network",
    });
  });

  /** A client for `listNotifications`: the table read and the occurrence function. */
  function listClient(
    rows: unknown[] | null,
    error: { code?: string } | null = null,
    occurrences: Record<string, unknown[]> = {},
  ) {
    const calls: string[] = [];
    const filters: unknown[] = [];
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "gte", "order", "limit"]) {
      chain[method] = (...args: unknown[]) => {
        calls.push(method);
        filters.push(args);
        return method === "limit"
          ? Promise.resolve({ data: rows, error })
          : chain;
      };
    }
    const client = {
      from: (table: string) => {
        calls.push(`from:${table}`);
        return chain;
      },
      rpc: (name: string, args: { p_event_id: string; p_day?: string }) => {
        calls.push(`${name}:${args.p_event_id}:${args.p_day ?? "-"}`);
        return Promise.resolve({
          data: occurrences[`${args.p_event_id}|${args.p_day ?? ""}`] ?? [],
          error: null,
        });
      },
    } as unknown as Client;
    return { client, calls, filters };
  }

  const actor = { id: ID(10), name: "Laura", color: "lampone" };
  const empty = {
    event_id: null,
    occurrence_date: null,
    days_before: null,
    evening_date: null,
    free_from: null,
    item_count: null,
    actor: null,
    todo: null,
    deadline: null,
    read_at: null,
  };

  test("un tipo a varianti per ogni tipo di notifica, dalla più recente", async () => {
    const rows = [
      {
        ...empty,
        id: ID(1),
        kind: "todo_assigned",
        created_at: "2026-11-05T08:00:00Z",
        actor,
        todo: {
          id: ID(20),
          title: "Firmare autorizzazione gita",
          due_date: "2026-11-06",
          done_at: null,
        },
      },
      {
        ...empty,
        id: ID(2),
        kind: "deadline_reminder",
        created_at: "2026-11-05T07:00:00Z",
        days_before: 7,
        deadline: {
          id: ID(21),
          title: "Rinnovo carta d'identità di Sofia",
          due_date: "2026-11-12",
          note: null,
        },
      },
      {
        ...empty,
        id: ID(3),
        kind: "free_together",
        created_at: "2026-11-04T08:00:00Z",
        read_at: "2026-11-04T09:00:00Z",
        evening_date: "2026-11-06",
        free_from: "2026-11-06T17:00:00Z",
      },
      {
        ...empty,
        id: ID(4),
        kind: "shopping_added",
        created_at: "2026-11-03T18:00:00Z",
        actor,
        item_count: 3,
      },
      {
        ...empty,
        id: ID(5),
        kind: "event_time_changed",
        created_at: "2026-11-03T10:00:00Z",
        actor,
        event_id: ID(30),
        occurrence_date: "2026-11-12",
      },
    ];
    const occurrence = {
      id: ID(30),
      occurrence_date: "2026-11-12",
      starts_at: "2026-11-12T16:30:00Z",
      ends_at: "2026-11-12T17:30:00Z",
      title: "Nuoto",
      location: null,
      notes: "una nota che non deve uscire",
      visibility: "household",
      author_member_id: ID(10),
      escort_member_id: null,
      member_ids: [ID(11)],
      recurrence: "weekly",
      recurrence_weekdays: [4],
      recurrence_until: null,
      series_starts_at: "2026-10-01T16:30:00Z",
      series_ends_at: "2026-10-01T17:30:00Z",
      is_modified: true,
    };
    const { client, calls, filters } = listClient(rows, null, {
      [`${ID(30)}|2026-11-12`]: [occurrence],
    });
    const result = await listNotifications(
      client,
      new Date("2026-11-05T10:00:00Z"),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [todo, deadline, free, shopping, change] = result.notifications;
    expect(result.notifications.map((n) => n.kind)).toEqual([
      "todo_assigned",
      "deadline_reminder",
      "free_together",
      "shopping_added",
      "event_time_changed",
    ]);
    expect(todo).toMatchObject({
      readAt: null,
      actor: { name: "Laura", memberId: ID(10) },
      todo: { title: "Firmare autorizzazione gita", isDone: false },
    });
    expect(deadline).toMatchObject({ daysBefore: 7 });
    expect(free).toMatchObject({
      eveningDate: "2026-11-06",
      readAt: "2026-11-04T09:00:00Z",
    });
    expect(shopping).toMatchObject({ itemCount: 3 });
    expect(change).toMatchObject({
      event: {
        id: ID(30),
        title: "Nuoto",
        startsAt: "2026-11-12T16:30:00Z",
        occurrenceDate: "2026-11-12",
      },
    });
    expect(JSON.stringify(result)).not.toContain(
      "una nota che non deve uscire",
    );
    // the 30 days window, newest first, at most 100
    expect(calls.slice(0, 5)).toEqual([
      "from:notifications",
      "select",
      "gte",
      "order",
      "order",
    ]);
    expect(filters[1]).toEqual(["created_at", "2026-10-06T10:00:00.000Z"]);
    expect(filters.at(-1)).toEqual([100]);
  });

  test("non mostra ciò che non si può mostrare: chi ha agito, la cosa o l'impegno spariti", async () => {
    const rows = [
      {
        ...empty,
        id: ID(1),
        kind: "todo_assigned",
        created_at: "2026-11-05T08:00:00Z",
        actor: null,
        todo: { id: ID(20), title: "X", due_date: null, done_at: null },
      },
      {
        ...empty,
        id: ID(2),
        kind: "todo_assigned",
        created_at: "2026-11-05T07:00:00Z",
        actor,
        todo: null,
      },
      {
        ...empty,
        id: ID(3),
        kind: "deadline_reminder",
        created_at: "2026-11-05T06:00:00Z",
        days_before: 5,
        deadline: {
          id: ID(21),
          title: "Y",
          due_date: "2026-11-12",
          note: null,
        },
      },
      {
        ...empty,
        id: ID(4),
        kind: "event_time_changed",
        created_at: "2026-11-05T05:00:00Z",
        actor,
        event_id: ID(30),
      },
      {
        ...empty,
        id: ID(5),
        kind: "shopping_added",
        created_at: "2026-11-05T04:00:00Z",
        actor,
        item_count: 0,
      },
    ];
    const { client } = listClient(rows);
    const result = await listNotifications(client);
    expect(result).toEqual({ ok: true, notifications: [] });
  });

  test("errore della lettura: {ok: false} con il motivo, senza dettagli", async () => {
    const server = listClient(null, { code: "PGRST301" });
    expect(await listNotifications(server.client)).toEqual({
      ok: false,
      reason: "server",
    });
    const network = listClient(null, { code: "" });
    expect(await listNotifications(network.client)).toEqual({
      ok: false,
      reason: "network",
    });
    const throwing = {
      from: () => {
        throw new Error("offline");
      },
    } as unknown as Client;
    expect(await listNotifications(throwing)).toEqual({
      ok: false,
      reason: "network",
    });
  });
});

test.describe("barra mobile (#39, #40)", () => {
  test("/notifiche: titolo h1, ingranaggio verso le impostazioni delle notifiche", () => {
    expect(getBarConfig("/notifiche")).toEqual({
      kind: "detail",
      fallback: "/oggi",
      title: "Notifiche",
      titleIsHeading: true,
      link: {
        href: "/impostazioni#notifiche",
        icon: "settings-2",
        label: "Impostazioni delle notifiche",
      },
    });
  });

  test("/ricerca: nessuna barra in alto; le altre pagine di dettaglio non cambiano", () => {
    expect(getBarConfig("/ricerca")).toEqual({ kind: "none" });
    expect(getBarConfig("/impostazioni")).toEqual({
      kind: "detail",
      fallback: "/nest",
      title: "Impostazioni",
    });
    expect(getBarConfig("/esplora")).toMatchObject({ search: true });
  });
});
