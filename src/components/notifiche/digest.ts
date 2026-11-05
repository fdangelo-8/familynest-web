import {
  FREE_EVENING_FROM,
  compareEvents,
  computeFreeEvenings,
  isInvolved,
  type LensChoice,
} from "@/lib/calendar";
import {
  formatLongDay,
  formatTime,
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
import type { Member } from "./model";
import { DIGEST_NOTHING } from "./texts";

/**
 * The sentence of the morning summary (#39 §3): up to four parts, only what
 * is left of today. It is composed every time the page opens, from what the
 * reader sees in full: «Occupato» and «Solo io» of others are never here.
 *
 * Parts 1-3 are the same as the summary of Oggi (#30) will need: when that
 * page arrives they move to `src/lib/` and both pages use them.
 */

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

const text = (value: string): DigestToken => ({ kind: "text", text: value });
const word = (value: string, href: string, together = false): DigestToken => ({
  kind: "word",
  text: value,
  href,
  together,
});

/** `07:30:00` -> `7:30`. */
export function formatDigestTime(value: string): string {
  const [hour, minute] = value.split(":");
  return `${Number(hour)}:${minute ?? "00"}`;
}

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

export function buildDigest(args: {
  now: Date;
  /** `07:30` */
  morningTime: string;
  lens: LensChoice;
  meId: string;
  members: readonly Member[];
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
  const tonight = adults.some((m) => m.id === meId)
    ? computeFreeEvenings(
        getWeekDays(todayKey),
        adults.map((m) => m.id),
        events,
      ).get(todayKey)
    : undefined;
  const freeNow = tonight && tonight.end.getTime() > nowMs ? tonight : null;
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

  const weekday =
    formatLongDay(now, { capitalized: false }).split(" ")[0] ?? "";
  const name =
    weekday === "domenica" ? `La tua ${weekday}` : `Il tuo ${weekday}`;
  return {
    name,
    top: `${name} · ${formatDigestTime(args.morningTime)}`,
    tokens,
  };
}
