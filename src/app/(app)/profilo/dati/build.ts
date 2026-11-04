import "server-only";
import {
  accessText,
  digestTimeLabel,
  lensLabel,
  toDigestTime,
  visibilityLabel,
} from "@/components/profilo/model";
import { toDateFieldValue, toTimeFieldValue } from "@/lib/datetime";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/*
 * The file «I tuoi dati» (#38): only what the person put in or what concerns
 * their account, read with their own session (the rules of the database apply).
 * Keys are in Italian because a person reads the file. No internal id, token,
 * invitation code, other people's mail or birth date, nothing inserted by
 * others, nothing from other Nests. Empty sections are `[]`.
 */

const WEEKDAY_NAMES = [
  "lunedì",
  "martedì",
  "mercoledì",
  "giovedì",
  "venerdì",
  "sabato",
  "domenica",
] as const;

const RECURRENCE_NAMES = {
  none: "nessuna",
  weekly: "ogni settimana",
  monthly: "ogni mese",
} as const;

/** Rome date and time with the offset: `2026-11-04T15:52:00+01:00`. */
export function romeDateTime(value: string): string {
  const instant = new Date(value);
  const date = toDateFieldValue(instant);
  const time = toTimeFieldValue(instant);
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const real = Math.floor(instant.getTime() / 60000) * 60000;
  const offset = Math.round((wall - real) / 60000);
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${date}T${time}:00${sign}${hh}:${mm}`;
}

const dateTimeOrNull = (value: string | null): string | null =>
  value ? romeDateTime(value) : null;

/** A day written by the database (`2026-11-04`), or a timestamp read as a Rome day. */
const dayOf = (value: string): string =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : toDateFieldValue(value);

const dayOrNull = (value: string | null): string | null =>
  value ? dayOf(value) : null;

/** Ids in groups: a long list in one request would not fit in the address. */
function chunks<T>(items: readonly T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

type Who = { id: string; email: string | null; providers: string[] };

/** The content of the file, or `null` if anything could not be read. */
export async function buildExport(
  supabase: Supabase,
  who: Who,
  now: Date,
): Promise<Record<string, unknown> | null> {
  const profile = await supabase
    .from("profiles")
    .select(
      "display_name, start_lens, morning_digest_time, default_event_visibility",
    )
    .eq("id", who.id)
    .maybeSingle();
  if (profile.error || !profile.data) return null;

  const { data: householdId, error: householdError } = await supabase.rpc(
    "current_household_id",
  );
  if (householdError || !householdId) return null;

  const [household, members] = await Promise.all([
    supabase
      .from("households")
      .select("name")
      .eq("id", householdId)
      .maybeSingle(),
    supabase
      .from("household_members")
      .select("id, name, color, is_admin, joined_at, user_id")
      .eq("household_id", householdId),
  ]);
  if (household.error || !household.data || members.error) return null;
  const me = members.data.find((m) => m.user_id === who.id);
  if (!me) return null;
  const nameOf = (id: string | null): string | null =>
    id ? (members.data.find((m) => m.id === id)?.name ?? null) : null;
  const namesOf = (ids: ReadonlyArray<string>): string[] =>
    ids.flatMap((id) => nameOf(id) ?? []);

  const [events, todos, deadlines, shopping, pinned, notifications, interests] =
    await Promise.all([
      supabase
        .from("events")
        .select(
          "id, title, location, starts_at, ends_at, visibility, recurrence, recurrence_until, recurrence_weekdays, notes, escort_member_id",
        )
        .eq("author_member_id", me.id)
        .order("starts_at", { ascending: true }),
      supabase
        .from("todos")
        .select(
          "title, due_date, is_private, assignee_member_id, for_member_id, done_at",
        )
        .eq("created_by_member_id", me.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("deadlines")
        .select(
          "title, due_date, note, is_private, assignee_member_id, for_member_id, reminder_days",
        )
        .eq("created_by_member_id", me.id)
        .order("due_date", { ascending: true }),
      supabase
        .from("shopping_items")
        .select("name, quantity, created_at, checked_at")
        .eq("added_by_member_id", me.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("pinned_spaces")
        .select("space, pinned_at")
        .eq("member_id", me.id)
        .order("pinned_at", { ascending: true }),
      supabase
        .from("notification_preferences")
        .select(
          "events, assigned_todos, shopping, free_together, morning_digest",
        )
        .eq("member_id", me.id)
        .maybeSingle(),
      supabase
        .from("space_interests")
        .select("space, created_at")
        .eq("member_id", me.id)
        .order("created_at", { ascending: true }),
    ]);
  if (
    events.error ||
    todos.error ||
    deadlines.error ||
    shopping.error ||
    pinned.error ||
    notifications.error ||
    interests.error
  ) {
    return null;
  }

  // People and exceptions of my events.
  const eventIds = events.data.map((e) => e.id);
  const peopleByEvent = new Map<string, string[]>();
  const exceptionsByEvent = new Map<string, Array<Record<string, unknown>>>();
  for (const ids of chunks(eventIds)) {
    const [people, exceptions] = await Promise.all([
      supabase
        .from("event_members")
        .select("event_id, member_id")
        .in("event_id", ids),
      supabase
        .from("event_exceptions")
        .select(
          "event_id, occurrence_date, is_cancelled, title, location, starts_at, ends_at, notes, escort_member_id",
        )
        .in("event_id", ids)
        .order("occurrence_date", { ascending: true }),
    ]);
    if (people.error || exceptions.error) return null;
    for (const p of people.data) {
      const list = peopleByEvent.get(p.event_id) ?? [];
      list.push(p.member_id);
      peopleByEvent.set(p.event_id, list);
    }
    for (const x of exceptions.data) {
      const list = exceptionsByEvent.get(x.event_id) ?? [];
      list.push({
        giorno: dayOf(x.occurrence_date),
        annullato: x.is_cancelled,
        titolo: x.title,
        luogo: x.location,
        inizio: dateTimeOrNull(x.starts_at),
        fine: dateTimeOrNull(x.ends_at),
        note: x.notes,
        la_porta: nameOf(x.escort_member_id),
      });
      exceptionsByEvent.set(x.event_id, list);
    }
  }

  const digest = toDigestTime(profile.data.morning_digest_time);
  const displayName = (profile.data.display_name ?? "").trim();

  return {
    esportato_il: romeDateTime(now.toISOString()),
    account: {
      mail: who.email,
      nome: displayName || me.name,
      accesso: accessText(who.providers),
    },
    preferenze: {
      all_apertura: lensLabel(profile.data.start_lens),
      sintesi_del_mattino: digestTimeLabel(digest),
      visibilita_predefinita: visibilityLabel(
        profile.data.default_event_visibility,
      ),
    },
    preferenze_di_notifica: notifications.data
      ? {
          impegni: notifications.data.events,
          cose_da_fare_assegnate: notifications.data.assigned_todos,
          spesa: notifications.data.shopping,
          liberi_insieme: notifications.data.free_together,
          sintesi_del_mattino: notifications.data.morning_digest,
        }
      : null,
    nest: {
      nome: household.data.name,
      il_tuo_nome: me.name,
      il_tuo_colore: me.color,
      amministratore: me.is_admin,
      entrato_il: dateTimeOrNull(me.joined_at),
    },
    impegni: events.data.map((e) => ({
      titolo: e.title,
      luogo: e.location,
      inizio: romeDateTime(e.starts_at),
      fine: romeDateTime(e.ends_at),
      visibilita: visibilityLabel(e.visibility),
      ripetizione: {
        tipo: RECURRENCE_NAMES[e.recurrence],
        giorni: (e.recurrence_weekdays ?? []).flatMap(
          (day) => WEEKDAY_NAMES[day - 1] ?? [],
        ),
        fino_al: dayOrNull(e.recurrence_until),
      },
      note: e.notes,
      persone: namesOf(peopleByEvent.get(e.id) ?? []),
      la_porta: nameOf(e.escort_member_id),
      eccezioni: exceptionsByEvent.get(e.id) ?? [],
    })),
    da_fare: todos.data.map((t) => ({
      titolo: t.title,
      entro: dayOrNull(t.due_date),
      solo_io: t.is_private,
      chi_se_ne_occupa: nameOf(t.assignee_member_id),
      per_chi: namesOf(t.for_member_id ? [t.for_member_id] : []),
      fatto_il: dateTimeOrNull(t.done_at),
    })),
    scadenze: deadlines.data.map((d) => ({
      titolo: d.title,
      data: dayOf(d.due_date),
      nota: d.note,
      solo_io: d.is_private,
      chi_se_ne_occupa: nameOf(d.assignee_member_id),
      riguarda: namesOf(d.for_member_id ? [d.for_member_id] : []),
      avvisi: d.reminder_days,
    })),
    spesa: shopping.data.map((s) => ({
      nome: s.name,
      quantita: s.quantity,
      aggiunta_il: romeDateTime(s.created_at),
      presa_il: dateTimeOrNull(s.checked_at),
    })),
    avvisi_degli_spazi: interests.data.map((i) => ({
      spazio: i.space,
      dal: romeDateTime(i.created_at),
    })),
    spazi_fissati: pinned.data.map((p) => ({
      spazio: p.space,
      fissato_il: romeDateTime(p.pinned_at),
    })),
  };
}
