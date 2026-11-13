import {
  FREE_EVENING_FROM,
  compareEvents,
  isInvolved,
  openTonightWindow,
  type LensChoice,
} from "@/lib/calendar";
import {
  formatTime,
  formatWeekday,
  getWeekDays,
  startOfDay,
  toDayKey,
  toTimeFieldValue,
} from "@/lib/datetime";
import { joinNames } from "@/lib/event-texts";
import {
  eventHref,
  type FullEvent,
  type HouseholdEvent,
} from "@/lib/household-events";

/*
 * The morning summary (#39 §3) and the times the profile offers for it (#38).
 * Plain module: used by the profile, by Notifiche and by the server pages.
 */

/* ---------- Time of the summary ---------- */

/** The nine times of the morning summary: every half hour from 6:00 to 10:00. */
export const DIGEST_TIMES = [
  "06:00",
  "06:30",
  "07:00",
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
] as const;
export type DigestTime = (typeof DIGEST_TIMES)[number];

export const DEFAULT_DIGEST_TIME: DigestTime = "07:30";

/** `07:30:00` (the database) or `07:30` to the DIGEST_TIMES value; the default if unknown. */
export function toDigestTime(value: string | null | undefined): DigestTime {
  const short = (value ?? "").slice(0, 5);
  return DIGEST_TIMES.find((time) => time === short) ?? DEFAULT_DIGEST_TIME;
}

/** `07:30` to «7:30» (hour without leading zero, as `formatTime`). */
export function digestTimeLabel(value: DigestTime): string {
  const [hour = "", minutes = ""] = value.split(":");
  return `${Number(hour)}:${minutes}`;
}

/* ---------- Sentence ---------- */

export const DIGEST_NOTHING =
  "Per il resto della giornata non hai niente in programma.";

/** A piece of the sentence: plain text, or a word that opens the thing. */
export type DigestToken =
  | { kind: "text"; text: string }
  | { kind: "word"; text: string; href: string; together: boolean };

export type DigestView = {
  /** `Il tuo martedì` / `La tua domenica`: the name of the region */
  name: string;
  /** `Il tuo martedì · 7:30` */
  top: string;
  tokens: DigestToken[];
};

export type DigestTodo = { title: string };

/** A member of the Nest as the summary needs it. */
export type DigestMember = {
  id: string;
  name: string;
  kind: "adult" | "child" | "pet";
};

const text = (value: string): DigestToken => ({ kind: "text", text: value });
const word = (value: string, href: string, together = false): DigestToken => ({
  kind: "word",
  text: value,
  href,
  together,
});

/** The week of `todayKey`: from Monday to Sunday, where «Liberi insieme» is looked for. */
export function digestPeriod(todayKey: string): { from: Date; to: Date } {
  const days = getWeekDays(todayKey);
  const first = days[0];
  const last = days[days.length - 1];
  return {
    from: first ? first.start : startOfDay(todayKey),
    to: last ? last.end : startOfDay(todayKey),
  };
}

/**
 * The sentence of the morning summary: up to four parts, only what is left of
 * today. It is composed every time the page opens, from what the reader sees
 * in full: «Occupato» and «Solo io» of others are never here.
 */
export function buildDigest(args: {
  now: Date;
  morningTime: DigestTime;
  lens: LensChoice;
  meId: string;
  members: readonly DigestMember[];
  /** Events of the week of today, as the calendar reads them */
  events: readonly HouseholdEvent[];
  /** Things to do assigned to the reader and not done, in order */
  todos: readonly DigestTodo[];
}): DigestView {
  const { now, lens, meId, members, events, todos } = args;
  const todayKey = toDayKey(now);
  const nowMs = now.getTime();

  // Only what is left of today, seen in full.
  const left = events
    .filter(
      (event): event is FullEvent =>
        !event.masked &&
        toDayKey(event.startsAt) === todayKey &&
        new Date(event.endsAt).getTime() > nowMs,
    )
    .sort(compareEvents);

  // Part 2: an evening of the whole house (every member but the pets).
  const nonPets = members.filter((m) => m.kind !== "pet").map((m) => m.id);
  const evening =
    nonPets.length === 0
      ? undefined
      : left.find(
          (event) =>
            toTimeFieldValue(event.startsAt) >= FREE_EVENING_FROM &&
            nonPets.every((id) => event.memberIds.includes(id)),
        );

  // Part 1: the next one, not the evening of part 2.
  const next = left.find(
    (event) =>
      event !== evening && (lens === "nest" || isInvolved(event, meId)),
  );

  // Part 3: the window «Liberi insieme» of tonight, as the calendar shows it.
  const adults = members.filter((m) => m.kind === "adult");
  const freeNow = adults.some((m) => m.id === meId)
    ? openTonightWindow(
        adults.map((m) => m.id),
        events,
        now,
      )
    : null;
  const together = freeNow
    ? joinNames([
        "tu",
        ...adults.filter((m) => m.id !== meId).map((m) => m.name),
      ])
    : "";

  const tokens: DigestToken[] = [];
  const sentence = (parts: DigestToken[]) => {
    if (tokens.length > 0) tokens.push(text(" "));
    tokens.push(...parts);
  };

  if (next) {
    const href = eventHref(next.id, next.startsAt);
    const time = formatTime(next.startsAt);
    sentence(
      isInvolved(next, meId)
        ? [
            text("Alle "),
            word(time, href),
            text(" hai "),
            word(next.title, href),
            text("."),
          ]
        : [
            text("Alle "),
            word(time, href),
            text(" c'è "),
            word(next.title, href),
            text("."),
          ],
    );
  }

  const freeWord = freeNow
    ? word(`liberi dalle ${formatTime(freeNow.start)}`, "/calendario", true)
    : null;
  if (evening) {
    sentence([
      text("Stasera tutti insieme: "),
      word(evening.title, eventHref(evening.id, evening.startsAt)),
      ...(freeWord
        ? [text(`, poi ${together} siete `), freeWord, text(".")]
        : [text(".")]),
    ]);
  } else if (freeWord) {
    sentence([text(`Stasera ${together} siete `), freeWord, text(".")]);
  }

  const [first, ...others] = todos;
  if (first) {
    const more =
      others.length === 0
        ? "."
        : others.length === 1
          ? " e un'altra cosa."
          : ` e altre ${others.length} cose.`;
    sentence([
      text("Da fare per te: "),
      word(first.title, "/casa/da-fare"),
      text(more),
    ]);
  }

  if (tokens.length === 0) tokens.push(text(DIGEST_NOTHING));

  const weekday = formatWeekday(now, { capitalized: false });
  const name =
    weekday === "domenica" ? `La tua ${weekday}` : `Il tuo ${weekday}`;
  return {
    name,
    top: `${name} · ${digestTimeLabel(args.morningTime)}`,
    tokens,
  };
}
