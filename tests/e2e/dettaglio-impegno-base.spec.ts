import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBarConfig } from "../../src/lib/app-routes";
import { eventHref, getEventOccurrence } from "../../src/lib/household-events";
import type { Database } from "../../src/types/database";

// Shared base of Dettaglio impegno (#165): pure rules, no server needed.

const ID = "3f1d2c4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

type RpcCall = { name: string; args: Record<string, unknown> };

function fakeClient(
  response: { data: unknown; error: unknown } | "throw",
  calls: RpcCall[],
): SupabaseClient<Database> {
  return {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (response === "throw") throw new Error("network");
      return response;
    },
  } as unknown as SupabaseClient<Database>;
}

const ROW = {
  id: ID,
  occurrence_date: "2026-10-20",
  starts_at: "2026-10-20T15:00:00+00:00",
  ends_at: "2026-10-20T16:30:00+00:00",
  title: "Nuoto Sofia",
  location: null,
  notes: null,
  visibility: "household",
  author_member_id: null,
  escort_member_id: null,
  member_ids: ["m1"],
  recurrence: "weekly",
  recurrence_weekdays: [2, 4],
  recurrence_until: null,
  series_starts_at: "2026-10-06T15:00:00+00:00",
  series_ends_at: "2026-10-06T16:30:00+00:00",
  is_modified: false,
};

test.describe("eventHref", () => {
  test("usa il giorno di Roma dell'inizio", () => {
    expect(eventHref(ID, "2026-10-20T15:00:00Z")).toBe(
      `/impegni/${ID}?giorno=2026-10-20`,
    );
    // 23:30 UTC is already the next day in Rome (CEST)
    expect(eventHref(ID, "2026-10-20T22:30:00Z")).toBe(
      `/impegni/${ID}?giorno=2026-10-21`,
    );
    // And in winter (CET, UTC+1)
    expect(eventHref(ID, "2026-12-31T23:30:00Z")).toBe(
      `/impegni/${ID}?giorno=2027-01-01`,
    );
  });
});

test.describe("barra mobile", () => {
  test("«Indietro» di /impegni ripiega su /calendario", () => {
    expect(getBarConfig(`/impegni/${ID}`)).toEqual({
      kind: "detail",
      fallback: "/calendario",
    });
  });
  test("le altre pagine di dettaglio non cambiano", () => {
    expect(getBarConfig("/notifiche")).toEqual({
      kind: "detail",
      fallback: "/oggi",
    });
  });
});

test.describe("getEventOccurrence", () => {
  test("legge una ripetizione e passa il giorno", async () => {
    const calls: RpcCall[] = [];
    const result = await getEventOccurrence(
      ID,
      "2026-10-20",
      fakeClient({ data: [ROW], error: null }, calls),
    );
    expect(calls).toEqual([
      {
        name: "get_event_occurrence",
        args: { p_event_id: ID, p_day: "2026-10-20" },
      },
    ]);
    expect(result.ok && result.occurrence?.title).toBe("Nuoto Sofia");
    expect(result.ok && result.occurrence?.memberIds).toEqual(["m1"]);
    expect(result.ok && result.occurrence?.recurrenceWeekdays).toEqual([2, 4]);
  });

  test("giorno assente o non valido: non manda p_day", async () => {
    for (const day of [undefined, null, "xyz", "2026-02-30"]) {
      const calls: RpcCall[] = [];
      await getEventOccurrence(
        ID,
        day,
        fakeClient({ data: [ROW], error: null }, calls),
      );
      expect(calls[0]?.args).toEqual({ p_event_id: ID });
    }
  });

  test("id che non è un uuid: non chiama il database", async () => {
    const calls: RpcCall[] = [];
    const result = await getEventOccurrence(
      "non-un-uuid",
      "2026-10-20",
      fakeClient({ data: [ROW], error: null }, calls),
    );
    expect(calls).toHaveLength(0);
    expect(result).toEqual({ ok: true, occurrence: null });
  });

  test("zero righe è «non trovato», distinto dall'errore", async () => {
    const calls: RpcCall[] = [];
    expect(
      await getEventOccurrence(
        ID,
        "2026-10-21",
        fakeClient({ data: [], error: null }, calls),
      ),
    ).toEqual({ ok: true, occurrence: null });
  });

  test("errore del database o di rete: { ok: false } senza dettagli", async () => {
    const calls: RpcCall[] = [];
    expect(
      await getEventOccurrence(
        ID,
        "2026-10-20",
        fakeClient({ data: null, error: { message: "secret" } }, calls),
      ),
    ).toEqual({ ok: false });
    expect(
      await getEventOccurrence(ID, "2026-10-20", fakeClient("throw", calls)),
    ).toEqual({ ok: false });
  });

  test("una riga illeggibile è un errore, non «non trovato»", async () => {
    const calls: RpcCall[] = [];
    expect(
      await getEventOccurrence(
        ID,
        "2026-10-20",
        fakeClient({ data: [{ id: ID, title: null }], error: null }, calls),
      ),
    ).toEqual({ ok: false });
  });
});
