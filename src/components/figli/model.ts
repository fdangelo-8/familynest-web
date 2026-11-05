import type { MemberColor } from "@/components/ui/Avatar/Avatar";
import type { TakenColor } from "@/components/ui/ColorChoice/ColorChoice";
import {
  addDaysToDayKey,
  daysUntilBirthday,
  daysUntilDay,
  formatAge,
  formatLongDay,
  formatMonthYear,
  formatSchoolDays,
  formatTime,
  fromFieldValues,
  getWeekStartKey,
  isUrgent,
  startOfDay,
  toDayKey,
} from "@/lib/datetime";
import type { FullEvent } from "@/lib/household-events";

/*
 * What the page of a child reads and how it turns into text (#31). Pure
 * functions: «now» is always an argument (the page takes it in the browser).
 */

/** Most teachers of a child, as in the database. */
export const MAX_TEACHERS = 5;

export type Teacher = {
  id: string;
  name: string;
  subject: string | null;
  phone: string | null;
};

export type ChildProfileRow = {
  schoolName: string | null;
  schoolClass: string | null;
  /** `HH:MM` */
  startsAt: string | null;
  /** `HH:MM` */
  endsAt: string | null;
  days: number[];
  note: string | null;
  shoeSize: string | null;
  clothingSize: string | null;
  pajamaSize: string | null;
  sizesUpdatedAt: string | null;
};

export const EMPTY_PROFILE: ChildProfileRow = {
  schoolName: null,
  schoolClass: null,
  startsAt: null,
  endsAt: null,
  days: [],
  note: null,
  shoeSize: null,
  clothingSize: null,
  pajamaSize: null,
  sizesUpdatedAt: null,
};

export type NextDeadline = {
  title: string;
  /** `YYYY-MM-DD` */
  dueDate: string;
};

export type ChildData = {
  child: {
    id: string;
    name: string;
    color: MemberColor;
    /** `YYYY-MM-DD` */
    birthDate: string | null;
  };
  /** Colours of the other members of the Nest */
  taken: TakenColor[];
  profile: ChildProfileRow;
  teachers: Teacher[];
  /** Events of this week with the child, seen in full by the reader */
  weekEvents: FullEvent[];
  deadline: NextDeadline | null;
  /** The instant of the reading: «now» for every calculation */
  readAt: Date;
};

const nonEmpty = (value: string | null | undefined): value is string =>
  typeof value === "string" && value.trim() !== "";

/** `08:15:00` (database) or `08:15` to `08:15`. */
export function toTimeValue(time: string | null): string | null {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return null;
  return `${(match[1] ?? "").padStart(2, "0")}:${match[2]}`;
}

/** `08:15` to `8:15`, with the same function as the events. */
function formatSchoolTime(time: string): string {
  // A day without clock changes: the hour is the one written.
  return formatTime(fromFieldValues("2026-01-15", time));
}

/** Rome week [Monday 00:00, next Monday 00:00) that contains `now`. */
export function weekBounds(now: Date): { from: Date; to: Date } {
  const startKey = getWeekStartKey(toDayKey(now));
  return {
    from: startOfDay(startKey),
    to: startOfDay(addDaysToDayKey(startKey, 7)),
  };
}

/** Events that start this week and have the child among the people. */
export function pickWeekEvents(
  events: ReadonlyArray<FullEvent>,
  childId: string,
  now: Date,
): FullEvent[] {
  const { from, to } = weekBounds(now);
  return events
    .filter((event) => {
      const start = Date.parse(event.startsAt);
      return (
        event.memberIds.includes(childId) &&
        start >= from.getTime() &&
        start < to.getTime()
      );
    })
    .sort(
      (a, b) =>
        Date.parse(a.startsAt) - Date.parse(b.startsAt) ||
        a.title.localeCompare(b.title, "it"),
    );
}

/** The events of the week that are not over yet. */
export function upcomingEvents(
  events: ReadonlyArray<FullEvent>,
  now: Date,
): FullEvent[] {
  return events.filter((event) => Date.parse(event.endsAt) > now.getTime());
}

/** «Giovedì alle 17:00, piscina comunale». */
export function eventInfo(event: FullEvent): string {
  const weekday = formatLongDay(event.startsAt).split(" ")[0] ?? "";
  const base = `${weekday} alle ${formatTime(event.startsAt)}`;
  return event.location ? `${base}, ${event.location}` : base;
}

/** «9 anni · 4ª B, scuola Manzoni», without the parts that are missing; `null` if none. */
export function headSubtitle(data: ChildData): string | null {
  const age = data.child.birthDate
    ? formatAge(data.child.birthDate, data.readAt)
    : null;
  const classAndSchool = [data.profile.schoolClass, data.profile.schoolName]
    .filter(nonEmpty)
    .join(", ");
  const parts = [age, classAndSchool].filter(nonEmpty);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export type CounterView = {
  /** The big number or word; `null` when there is nothing (a dash) */
  number: string | null;
  info: string;
  urgent: boolean;
};

export function eventsCounter(count: number): CounterView {
  return {
    number: String(count),
    info: count === 1 ? "impegno questa settimana" : "impegni questa settimana",
    urgent: false,
  };
}

export function deadlineCounter(
  deadline: NextDeadline | null,
  now: Date,
): CounterView {
  if (!deadline) {
    return { number: null, info: "nessuna scadenza", urgent: false };
  }
  const days = daysUntilDay(deadline.dueDate, now);
  const urgent = isUrgent(days);
  if (days === 0) return { number: "Oggi", info: "la scadenza", urgent };
  if (days < 0) {
    const late = -days;
    return {
      number: String(late),
      info: late === 1 ? "giorno di ritardo" : "giorni di ritardo",
      urgent,
    };
  }
  return {
    number: String(days),
    info: days === 1 ? "giorno alla scadenza" : "giorni alla scadenza",
    urgent,
  };
}

export function birthdayCounter(
  birthDate: string | null,
  now: Date,
): CounterView {
  const days = birthDate ? daysUntilBirthday(birthDate, now) : null;
  if (days === null) {
    return { number: null, info: "manca la data di nascita", urgent: false };
  }
  if (days === 0)
    return { number: "Oggi", info: "il compleanno", urgent: false };
  return {
    number: String(days),
    info: days === 1 ? "giorno al compleanno" : "giorni al compleanno",
    urgent: false,
  };
}

export type SchoolView = {
  /** Shown beside the title */
  classText: string | null;
  /** The timetable row, when there is a timetable */
  timetable: { title: string; info: string | null } | null;
  teachers: ReadonlyArray<{
    id: string;
    name: string;
    info: string | null;
    href: string | null;
  }>;
};

/** The link of a teacher's phone: separators out, `00` to `+`, `+39` if no prefix. */
export function telHref(phone: string): string {
  let number = phone.replace(/[\s.\-/()]/g, "");
  if (number.startsWith("00")) number = `+${number.slice(2)}`;
  if (!number.startsWith("+")) number = `+39${number}`;
  return `tel:${number}`;
}

/** The school section; `null` when there is nothing to show (no section). */
export function schoolView(
  profile: ChildProfileRow,
  teachers: ReadonlyArray<Teacher>,
): SchoolView | null {
  const hasTimetable = profile.startsAt !== null && profile.endsAt !== null;
  if (
    !nonEmpty(profile.schoolName) &&
    !nonEmpty(profile.schoolClass) &&
    !hasTimetable &&
    teachers.length === 0
  ) {
    return null;
  }
  const timetable =
    hasTimetable && profile.startsAt && profile.endsAt
      ? {
          title: `${formatSchoolTime(profile.startsAt)} – ${formatSchoolTime(profile.endsAt)}`,
          info:
            [formatSchoolDays(profile.days), profile.note]
              .filter(nonEmpty)
              .join(", ") || null,
        }
      : null;
  return {
    classText: nonEmpty(profile.schoolClass) ? profile.schoolClass : null,
    timetable,
    teachers: teachers.map((teacher) => ({
      id: teacher.id,
      name: teacher.name,
      info:
        [teacher.subject, teacher.phone].filter(nonEmpty).join(" · ") || null,
      href: nonEmpty(teacher.phone) ? telHref(teacher.phone) : null,
    })),
  };
}

export type SizesView = {
  /** «aggiornate a settembre» */
  updated: string | null;
  chips: ReadonlyArray<{ label: string; value: string }>;
};

/** The sizes section; `null` when there is no size. */
export function sizesView(
  profile: ChildProfileRow,
  now: Date,
): SizesView | null {
  const chips = [
    { label: "Scarpe", value: profile.shoeSize },
    { label: "Vestiti", value: profile.clothingSize },
    { label: "Pigiama", value: profile.pajamaSize },
  ].filter((chip): chip is { label: string; value: string } =>
    nonEmpty(chip.value),
  );
  if (chips.length === 0) return null;
  let updated: string | null = null;
  if (profile.sizesUpdatedAt) {
    const [month, year] = formatMonthYear(profile.sizesUpdatedAt).split(" ");
    if (month) {
      const sameYear = year === toDayKey(now).slice(0, 4);
      updated = `aggiornate a ${month.toLocaleLowerCase("it-IT")}${
        sameYear || !year ? "" : ` ${year}`
      }`;
    }
  }
  return { updated, chips };
}

/** True when the child has no school, teacher or size to show. */
export function isProfileEmpty(
  profile: ChildProfileRow,
  teachers: ReadonlyArray<Teacher>,
): boolean {
  return (
    schoolView(profile, teachers) === null &&
    ![profile.shoeSize, profile.clothingSize, profile.pajamaSize].some(nonEmpty)
  );
}
