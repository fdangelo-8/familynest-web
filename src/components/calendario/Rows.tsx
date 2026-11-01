import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar/Avatar";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon/Icon";
import { Tag } from "@/components/ui/Tag/Tag";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import {
  BUSY_TITLE,
  formatBusyLabel,
  formatFreeEveningRow,
} from "@/lib/calendar";
import { formatTime, formatWeekParam, type CalendarDay } from "@/lib/datetime";
import { eventHref } from "@/lib/household-events";
import {
  MAX_AVATARS,
  endInDay,
  eventInfo,
  eveningOthers,
  isPast,
  participantsInNestOrder,
  peopleTag,
  startInDay,
  type DayItem,
  type KeyedFullEvent,
  type Member,
} from "./model";

/** Avatars of the people of a row, or a short label when they are too many. */
export function People({
  people,
  members,
  size,
}: {
  people: readonly Member[];
  members: readonly Member[];
  size?: "xs" | "s" | "m";
}) {
  if (people.length === 0) return null;
  const names = people.map((member) => member.name);
  if (people.length > MAX_AVATARS) {
    return (
      <>
        <Tag>{peopleTag(people, members)}</Tag>
        <VisuallyHidden>{names.join(", ")}</VisuallyHidden>
      </>
    );
  }
  return (
    <span className="avatar-gruppo" role="img" aria-label={names.join(", ")}>
      {people.map((member) => (
        <Avatar
          key={member.id}
          name={member.name}
          color={member.color}
          size={size}
          nameShown
        />
      ))}
    </span>
  );
}

/** One row of the mobile list: an event, an «Occupato» of someone else, or «Liberi insieme». */
export function DayRow({
  item,
  day,
  members,
  meId,
  nowMs,
  eveningLinksToWeek = false,
}: {
  item: DayItem;
  day: CalendarDay;
  members: readonly Member[];
  meId: string | null;
  nowMs: number;
  /** «Liberi insieme» is a link to the week of the day (the month view) */
  eveningLinksToWeek?: boolean;
}) {
  if (item.kind === "insieme") {
    const adults = members.filter((member) => member.kind === "adult");
    const past = isPast(item.evening.end.getTime(), nowMs);
    const content = (
      <>
        <span className="riga-evento__ora">
          {formatTime(item.evening.start)}
        </span>
        <span className="riga-evento__testo">
          <span className="riga-evento__titolo">Liberi insieme</span>
          <span className="riga-evento__info">
            {formatFreeEveningRow(item.evening, eveningOthers(adults, meId))}
          </span>
        </span>
        <People people={adults} members={members} />
      </>
    );
    const classes = cx(
      "riga-evento",
      "riga-evento--insieme",
      "riga-evento--compatta",
    );
    if (eveningLinksToWeek) {
      return (
        <Link
          href={`/calendario?settimana=${formatWeekParam(day.start)}`}
          className={classes}
          data-passato={past ? "true" : undefined}
        >
          {content}
        </Link>
      );
    }
    return (
      <div className={classes} data-passato={past ? "true" : undefined}>
        {content}
      </div>
    );
  }

  const event = item.event;
  const past = isPast(new Date(event.endsAt).getTime(), nowMs);
  const start = formatTime(startInDay(event, day));

  if (event.masked) {
    const author = members.find((member) => member.id === event.authorMemberId);
    const name = author?.name ?? "";
    return (
      <div
        className={cx(
          "riga-evento",
          "riga-evento--occupato",
          "riga-evento--compatta",
        )}
        role="group"
        aria-label={`${formatBusyLabel(name)}, dalle ${start} alle ${formatTime(endInDay(event, day))}`}
        data-passato={past ? "true" : undefined}
      >
        <span className="riga-evento__ora">{start}</span>
        <span className="riga-evento__testo">
          <span className="riga-evento__titolo">{BUSY_TITLE}</span>
          <span className="riga-evento__info">{name}</span>
        </span>
        {author ? (
          <span className="avatar-gruppo" aria-hidden="true">
            <Avatar name={author.name} color={author.color} nameShown />
          </span>
        ) : null}
      </div>
    );
  }

  const full = event as KeyedFullEvent;
  const info = eventInfo(full, members, meId);
  return (
    <Link
      href={eventHref(full.id, full.startsAt)}
      className={cx("riga-evento", "riga-evento--compatta")}
      data-passato={past ? "true" : undefined}
    >
      <span className={cx("riga-evento__ora", past && "t-secondario")}>
        {start}
      </span>
      <span className="riga-evento__testo">
        <span className={cx("riga-evento__titolo", past && "t-secondario")}>
          {full.title}
          {full.visibility === "private" ? (
            <>
              {" "}
              <Icon name="lock" size="s" />
              <VisuallyHidden>Visibile solo a te</VisuallyHidden>
            </>
          ) : null}
        </span>
        {info ? <span className="riga-evento__info">{info}</span> : null}
      </span>
      <People
        people={participantsInNestOrder(full, members)}
        members={members}
      />
    </Link>
  );
}
