import type { MemberColor } from "@/components/ui/Avatar/Avatar";
import type { IconName } from "@/components/ui/Icon/Icon";
import {
  addDaysToDayKey,
  daysUntilDay,
  formatDaysUntil,
  formatDeadline,
  formatLongDay,
  formatTime,
  formatWeekday,
  isUrgent,
  startOfDay,
  toDayKey,
} from "@/lib/datetime";
import { formatEveningDay } from "@/lib/calendar";
import { formatDayInSentence, joinNames } from "@/lib/event-texts";
import { it } from "@/lib/i18n/messages/it";
import { t, type Params } from "@/lib/i18n/translate";
import { giftTakenParts } from "@/lib/notifications";
import type {
  NotificationActor,
  NotificationItem,
  NotificationOccurrence,
  RideLeg,
} from "@/lib/notifications";

/** A member of the Nest as the page needs it (names of the people in a text). */
export type Member = {
  id: string;
  name: string;
  color: MemberColor;
  kind: "adult" | "child" | "pet";
};

/** A piece of a row text: plain, bold (`<b>`) or red (`.t-allerta`). */
export type Part = {
  kind: "text" | "bold" | "urgent";
  text: string;
};

export type RowLead =
  | { type: "avatar"; name: string; color: MemberColor }
  | { type: "icon"; icon: IconName; together: boolean };

export type RowView = {
  /** Position in the page (`0`, `1`, ...): used in ids and focus, never an id of data */
  index: number;
  /** Id of the notification: only for the calls that mark it read */
  notificationId: string;
  /** Not read when the page was opened */
  isNew: boolean;
  lead: RowLead;
  parts: Part[];
  /** `14:20` */
  time: string;
  /** «Fatto» and «Apri» to the list of things to do (kind «Da fare assegnato») */
  todo: { id: string; title: string; isDone: boolean } | null;
  /** «Apri» to an event (kind «Cambio d'orario») */
  openHref: string | null;
  /** Text of the open button: «Apri», or «Vedi l'impegno» for a ride request */
  openLabel: string;
};

export type SectionView = {
  key: string;
  title: string;
  newCount: number;
  rows: RowView[];
};

const text = (value: string): Part => ({ kind: "text", text: value });
const bold = (value: string): Part => ({ kind: "bold", text: value });

const BOLD = /<b>(.*?)<\/b>/g;

/** A message of `i18n` with `<b>` tags to the parts of a row; the values are plain text. */
function richParts(template: string, params: Params): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const match of template.matchAll(BOLD)) {
    if (match.index > last) {
      parts.push(text(t(template.slice(last, match.index), params)));
    }
    parts.push(bold(t(match[1] ?? "", params)));
    last = match.index + match[0].length;
  }
  if (last < template.length) parts.push(text(t(template.slice(last), params)));
  return parts;
}

function leadOf(actor: NotificationActor): RowLead {
  return { type: "avatar", name: actor.name, color: actor.color };
}

/** The detail of the occurrence a row is about. */
function occurrenceHref(event: NotificationOccurrence): string {
  return `/impegni/${encodeURIComponent(event.id)}?giorno=${event.occurrenceDate}`;
}

/** Bringing is at the start of the event, picking up at its end. */
function rideParams(
  event: NotificationOccurrence,
  leg: RideLeg,
  now: Date,
): Params {
  const at = leg === "escort" ? event.startsAt : event.endsAt;
  return {
    title: event.title,
    day: dayInPhrase(toDayKey(at), now),
    time: formatTime(at),
  };
}

/** `venerdì` from a day key. */
function weekdayOf(dayKey: string): string {
  return formatWeekday(startOfDay(dayKey), { capitalized: false });
}

/** `oggi`, `domani`, the weekday in the next 6 days, else `giovedì 29 ottobre`. */
function dayInPhrase(dayKey: string, now: Date): string {
  const days = daysUntilDay(dayKey, now);
  if (days === 0) return "oggi";
  if (days === 1) return "domani";
  if (days >= 2 && days <= 6) return weekdayOf(dayKey);
  return formatDayInSentence(dayKey, now);
}

/** `entro venerdì`, `entro giovedì 29 ottobre`, `scaduto ieri`, `scaduto il 15 ottobre`. */
function deadlinePhrase(dueDate: string, now: Date): string {
  if (daysUntilDay(dueDate, now) < 0) {
    return formatDeadline(startOfDay(dueDate), now, { capitalized: false });
  }
  return `entro ${dayInPhrase(dueDate, now)}`;
}

/** `Oggi`, `Ieri`, `Sabato 17 ottobre`, `Martedì 29 dicembre 2025`. */
export function sectionTitle(dayKey: string, now: Date): string {
  const today = toDayKey(now);
  if (dayKey === today) return "Oggi";
  if (dayKey === addDaysToDayKey(today, -1)) return "Ieri";
  const base = formatLongDay(startOfDay(dayKey));
  return dayKey.slice(0, 4) === today.slice(0, 4)
    ? base
    : `${base} ${dayKey.slice(0, 4)}`;
}

type RowContext = {
  members: readonly Member[];
  meId: string | null;
  now: Date;
};

/**
 * The row of one notification, or null when it cannot be shown: an evening
 * «liberi insieme» needs the other adults to be named. (The notifications of a
 * person who left the Nest, or of a thing the reader cannot read any more,
 * never get here: the list drops them.)
 */
function toRow(
  item: NotificationItem,
  index: number,
  context: RowContext,
  isNew: boolean,
): RowView | null {
  const { now } = context;
  const base = {
    index,
    notificationId: item.id,
    isNew,
    time: formatTime(item.createdAt),
    todo: null,
    openHref: null,
    openLabel: it.notifiche.open,
  };
  switch (item.kind) {
    case "todo_assigned": {
      const due = item.todo.dueDate;
      return {
        ...base,
        lead: {
          type: "avatar",
          name: item.actor.name,
          color: item.actor.color,
        },
        parts: [
          bold(item.actor.name),
          text(" ti ha assegnato "),
          bold(item.todo.title),
          text(`${due ? `, ${deadlinePhrase(due, now)}` : ""}.`),
        ],
        todo: {
          id: item.todo.id,
          title: item.todo.title,
          isDone: item.todo.isDone,
        },
      };
    }
    case "deadline_reminder": {
      const days = daysUntilDay(item.deadline.dueDate, now);
      const when = formatDaysUntil(startOfDay(item.deadline.dueDate), now);
      const note = item.deadline.note?.trim();
      return {
        ...base,
        lead: { type: "icon", icon: "file-clock", together: false },
        parts: [
          bold(item.deadline.title),
          text(days >= 0 ? " scade " : " è scaduta "),
          { kind: isUrgent(days) ? "urgent" : "text", text: when },
          text(note ? `. ${note}` : "."),
        ],
      };
    }
    case "free_together": {
      const others = context.members
        .filter((m) => m.kind === "adult" && m.id !== context.meId)
        .map((m) => m.name);
      if (others.length === 0) return null;
      const day = formatEveningDay(item.eveningDate, now);
      return {
        ...base,
        lead: { type: "icon", icon: "heart", together: true },
        parts: [
          text(`${day} ${joinNames(["tu", ...others])} siete `),
          bold("liberi insieme"),
          text(` dalle ${formatTime(item.freeFrom)}.`),
        ],
      };
    }
    case "event_time_changed":
      return {
        ...base,
        lead: {
          type: "avatar",
          name: item.actor.name,
          color: item.actor.color,
        },
        parts: [
          bold(item.actor.name),
          text(" ha spostato "),
          bold(item.event.title),
          text(
            `: ora è ${dayInPhrase(item.event.occurrenceDate, now)} alle ${formatTime(item.event.startsAt)}.`,
          ),
        ],
        openHref: `/impegni/${encodeURIComponent(item.event.id)}?giorno=${item.event.occurrenceDate}`,
      };
    case "shopping_added":
      return {
        ...base,
        lead: {
          type: "avatar",
          name: item.actor.name,
          color: item.actor.color,
        },
        parts: [
          bold(item.actor.name),
          text(
            ` ha aggiunto ${item.itemCount} ${item.itemCount === 1 ? "cosa" : "cose"} alla spesa.`,
          ),
        ],
      };
    case "gift_taken": {
      // No action: the «Apri» proposed in #39 is not approved (#32 §10).
      const words = giftTakenParts(item);
      return {
        ...base,
        lead: { type: "icon", icon: "gift", together: false },
        parts: [
          bold(words.giverName),
          text(words.verb),
          bold(words.itemTitle),
          text(`${words.connector}${words.childName}.`),
        ],
      };
    }
    case "member_joined":
      return {
        ...base,
        lead: leadOf(item.actor),
        parts: richParts(it.notifiche.memberJoined, { name: item.actor.name }),
      };
    case "event_reminder":
      return {
        ...base,
        lead: { type: "icon", icon: "bell-ring", together: false },
        parts: richParts(it.notifiche.eventReminder, {
          title: item.event.title,
          day: dayInPhrase(toDayKey(item.event.startsAt), now),
          time: formatTime(item.event.startsAt),
        }),
        openHref: occurrenceHref(item.event),
      };
    case "ride_reminder":
      return {
        ...base,
        lead: { type: "icon", icon: "car", together: false },
        parts: richParts(
          item.leg === "escort"
            ? it.notifiche.rideEscort
            : it.notifiche.ridePickup,
          rideParams(item.event, item.leg, now),
        ),
        openHref: occurrenceHref(item.event),
      };
    case "overlap_tomorrow": {
      const [first, second] =
        item.event.startsAt <= item.otherEvent.startsAt
          ? [item.event, item.otherEvent]
          : [item.otherEvent, item.event];
      const subject = context.members.find(
        (m) => m.id === item.subjectMemberId,
      );
      // The day is worked out when the row is read, so it stays true later.
      const dayText = dayInPhrase(toDayKey(first.startsAt), now);
      const titles = {
        first: first.title,
        second: second.title,
        day: dayText.charAt(0).toUpperCase() + dayText.slice(1),
      };
      // Somebody who is no longer in the Nest cannot be named: no row.
      if (item.subjectMemberId !== context.meId && !subject) return null;
      return {
        ...base,
        lead: { type: "icon", icon: "triangle-alert", together: false },
        parts: richParts(
          item.subjectMemberId === context.meId
            ? it.notifiche.overlapMine
            : it.notifiche.overlapOther,
          { ...titles, name: subject?.name ?? "" },
        ),
        openHref: occurrenceHref(first),
      };
    }
    case "ride_request":
      return {
        ...base,
        lead: leadOf(item.actor),
        openHref: occurrenceHref(item.event),
        openLabel: it.notifiche.openEvent,
        parts: richParts(
          item.leg === "escort"
            ? it.notifiche.rideRequestEscort
            : it.notifiche.rideRequestPickup,
          { ...rideParams(item.event, item.leg, now), name: item.actor.name },
        ),
      };
  }
}

/**
 * One section for each day (Rome) a notification was born, newest first, as
 * the list gives them. `newIds` are the ones that were not read when the page
 * opened (they keep the dot for the whole visit).
 */
export function buildSections(args: {
  notifications: readonly NotificationItem[];
  members: readonly Member[];
  meId: string | null;
  newIds: ReadonlySet<string>;
  now: Date;
}): SectionView[] {
  const sections: SectionView[] = [];
  let index = 0;
  for (const item of args.notifications) {
    const isNew = args.newIds.has(item.id);
    const row = toRow(item, index, args, isNew);
    if (!row) continue;
    index += 1;
    const dayKey = toDayKey(item.createdAt);
    let section = sections[sections.length - 1];
    if (!section || section.key !== dayKey) {
      section = {
        key: dayKey,
        title: sectionTitle(dayKey, args.now),
        newCount: 0,
        rows: [],
      };
      sections.push(section);
    }
    section.rows.push(row);
    if (isNew) section.newCount += 1;
  }
  return sections;
}
