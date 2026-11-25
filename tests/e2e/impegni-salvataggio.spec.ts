import { expect, test } from "@playwright/test";
import {
  repetitionOf,
  saveEvent,
  visibilityToSave,
} from "@/components/impegni/save";
import { initialValues } from "@/components/impegni/model";
import type { EventOccurrence } from "@/lib/household-events";

function occurrence(over: Record<string, unknown>): EventOccurrence {
  return {
    id: "e1",
    title: "Nuoto",
    startsAt: "2030-03-05T16:00:00Z",
    endsAt: "2030-03-05T17:00:00Z",
    occurrenceDate: "2030-03-05",
    recurrence: "weekly",
    recurrenceWeekdays: [2],
    recurrenceUntil: null,
    visibility: "household",
    memberIds: [],
    escortMemberId: null,
    location: null,
    notes: null,
    ...over,
  } as unknown as EventOccurrence;
}

for (const rule of ["daily", "biweekly", "yearly"] as const) {
  test(`un salvataggio senza modifiche lascia la regola ${rule}`, () => {
    const occ = occurrence({
      recurrence: rule,
      recurrenceWeekdays: rule === "biweekly" ? [2] : [],
    });
    const out = repetitionOf(occ, initialValues(occ));
    expect(out.recurrence).toBe(rule);
    expect(out.weekdays).toEqual(rule === "biweekly" ? [2] : null);
  });
}

test("selected non toccato viene rimandato com'è", () => {
  const occ = occurrence({ visibility: "selected" });
  expect(visibilityToSave(occ, initialValues(occ))).toBe("selected");
  expect(
    visibilityToSave(occ, { ...initialValues(occ), visibility: "household" }),
  ).toBe("household");
});

test("saveEvent manda selected e la regola originali", async () => {
  const occ = occurrence({ visibility: "selected", recurrence: "biweekly" });
  let args: Record<string, unknown> = {};
  const supabase = {
    rpc: async (_name: string, a: Record<string, unknown>) => {
      args = a;
      return { data: [{ id: "e1", day: "2030-03-05" }], error: null };
    },
  };
  const out = await saveEvent(
    supabase as never,
    occ,
    initialValues(occ),
    { start: new Date(occ.startsAt), end: new Date(occ.endsAt) },
    "following",
  );
  expect(out.ok).toBe(true);
  expect(args.p_visibility).toBe("selected");
  expect(args.p_recurrence).toBe("biweekly");
});
