import type { Page } from "@playwright/test";
import { romeInstant, type CasaNest, type Day } from "./casa";

// Helpers for the tests of Calendario · Settimana (#25) and of the pages that
// read the events of the Nest. The tests create their own events in their own
// throwaway Nest (fixtures/casa.ts) and the Nest is deleted with its users at
// the end of the test: nothing is written in the seed Nests.

export type Visibility = "household" | "busy" | "private";

export type EventSpec = {
  title: string;
  /** Day of the start (Europe/Rome) */
  day: Day;
  /** Start and end, "H:MM" in Europe/Rome */
  from: string;
  to: string;
  /** Day of the end when it is not the same day */
  endDay?: Day;
  /** «Tutto il Nest» by default */
  visibility?: Visibility;
  /** Names of the participants. Default: only the author. */
  participants?: string[];
  /** Name of the adult who accompanies */
  escort?: string;
  location?: string;
};

function instant(day: Day, time: string): Date {
  const [hour, minute] = time.split(":").map(Number);
  return romeInstant(day, hour!, minute!);
}

/**
 * Creates an event authored by `who` (the author is set by the database, from
 * the session) and adds its participants. Returns the id of the event.
 * The event row is written with the session of the author (RLS applies); the
 * participants with the administrative key, so that the same helper can build
 * the events of any author.
 */
export async function createEvent(
  nest: CasaNest,
  who: string,
  spec: EventSpec,
): Promise<string> {
  const user = nest.users[who];
  if (!user) throw new Error(`${who} non ha un account di prova`);
  const memberId = (name: string) => {
    const id = nest.members[name];
    if (!id) throw new Error(`Membro di prova sconosciuto: ${name}`);
    return id;
  };
  const startsAt = instant(spec.day, spec.from).toISOString();
  const endsAt = instant(spec.endDay ?? spec.day, spec.to).toISOString();
  const { error } = await user.client.from("events").insert({
    title: spec.title,
    location: spec.location ?? null,
    starts_at: startsAt,
    ends_at: endsAt,
    visibility: spec.visibility ?? "household",
    escort_member_id: spec.escort ? memberId(spec.escort) : null,
  });
  if (error) throw new Error("Impegno di prova non creato");
  // No chained select after a write (LEZIONI): the id is read separately.
  const { data, error: readError } = await user.admin
    .from("events")
    .select("id")
    .eq("household_id", nest.householdId)
    .eq("title", spec.title)
    .eq("starts_at", startsAt);
  if (readError || !data || data.length === 0)
    throw new Error("Impegno di prova non trovato");
  const id = data[data.length - 1]!.id as string;
  const people = spec.participants ?? [who];
  if (people.length > 0) {
    const { error: peopleError } = await user.admin
      .from("event_members")
      .insert(
        people.map((name) => ({
          event_id: id,
          member_id: memberId(name),
          household_id: nest.householdId,
        })),
      );
    if (peopleError) throw new Error("Partecipanti di prova non aggiunti");
  }
  return id;
}

/**
 * Collects the body of every text answer the page receives (documents, JSON of
 * the API, server component payloads), to prove that a text never reached the
 * browser. Attach it before the first navigation.
 */
export function watchNetwork(page: Page): { bodies: () => Promise<string> } {
  const pending: Promise<string>[] = [];
  page.on("response", (response) => {
    const type = response.headers()["content-type"] ?? "";
    if (!/json|text|html|x-component/.test(type)) return;
    pending.push(response.text().catch(() => ""));
  });
  return {
    bodies: async () => (await Promise.all(pending)).join("\n"),
  };
}
