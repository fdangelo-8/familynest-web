"use client";

import { type KeyboardEvent, type MouseEvent } from "react";
import { NowLine } from "@/components/calendario/NowLine";
import { Avatar } from "@/components/ui/Avatar/Avatar";
import { cx } from "@/components/ui/cx";
import { BUSY_TITLE, formatBusyLabel } from "@/lib/calendar";
import {
  formatDayNumber,
  formatLongDay,
  formatShortWeekday,
  formatTime,
  formatTimeRange,
} from "@/lib/datetime";
import { eventHref } from "@/lib/household-events";
import { DayRow } from "@/components/calendario/Rows";
import {
  blockDescription,
  hoursSinceGridStart,
  layoutDay,
  type Block,
  type DayView,
  type WeekView,
} from "./model";
import {
  MAX_AVATARS,
  endInDay,
  participantsInNestOrder,
  startInDay,
  type KeyedFullEvent,
  type Member,
} from "@/components/calendario/model";

/** An event chosen in the grid: the event and the day of the block. */
export type Selection = { event: KeyedFullEvent; dayKey: string };
/** A group of events that did not fit in the grid («Altri N»). */
export type OtherGroup = { dayKey: string; blockKey: string };

const HOURS = Array.from({ length: 15 }, (_, index) => `${8 + index}:00`);
const SHORT_BLOCK_MINUTES = 30;

function isPlainClick(event: MouseEvent): boolean {
  return !(
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

function BlockView({
  block,
  view,
  members,
  selected,
  onSelect,
  onOpenGroup,
}: {
  block: Block;
  view: DayView;
  members: readonly Member[];
  selected: boolean;
  onSelect: (event: KeyedFullEvent, dayKey: string) => void;
  onOpenGroup: (blockKey: string) => void;
}) {
  const classes = cx("blocco-orario", block.classes);

  if (block.kind === "altri") {
    const count = block.hidden?.length ?? 0;
    return (
      <button
        type="button"
        className={classes}
        onClick={() => onOpenGroup(block.key)}
      >
        <span className="blocco-orario__titolo">Altri {count}</span>
      </button>
    );
  }

  if (block.kind === "insieme" && block.item?.kind === "insieme") {
    return (
      <div className={cx(classes, "blocco-orario--insieme")}>
        <span className="blocco-orario__titolo">Liberi insieme</span>
        <span className="blocco-orario__ora">
          {formatTimeRange(block.item.evening.start, block.item.evening.end)}
        </span>
      </div>
    );
  }

  if (block.item?.kind !== "event") return null;
  const event = block.item.event;
  const range = formatTimeRange(
    startInDay(event, view.day),
    endInDay(event, view.day),
  );

  if (event.masked) {
    const author = members.find((member) => member.id === event.authorMemberId);
    const name = author?.name ?? "";
    return (
      <div
        className={cx(classes, "blocco-orario--occupato")}
        role="group"
        aria-label={`${formatBusyLabel(name)}, dalle ${formatTime(startInDay(event, view.day))} alle ${formatTime(endInDay(event, view.day))}`}
      >
        <span className="blocco-orario__titolo">{BUSY_TITLE}</span>
        <span className="blocco-orario__ora">{range}</span>
        {author ? (
          <span className="avatar-gruppo" aria-hidden="true">
            <Avatar
              name={author.name}
              color={author.color}
              size="xs"
              nameShown
            />
          </span>
        ) : null}
      </div>
    );
  }

  const full = event as KeyedFullEvent;
  const people = participantsInNestOrder(full, members);
  const minutes =
    (endInDay(full, view.day).getTime() -
      startInDay(full, view.day).getTime()) /
    60_000;
  const choose = () => onSelect(full, view.day.key);
  const descriptionId = `blocco-desc-${full.id}-${view.day.key}`;
  return (
    <>
      <a
        href={eventHref(full.id, full.startsAt)}
        className={cx(classes, selected && "blocco-orario--attivo")}
        aria-describedby={descriptionId}
        aria-current={selected ? "true" : undefined}
        onClick={(clickEvent) => {
          if (!isPlainClick(clickEvent)) return;
          clickEvent.preventDefault();
          choose();
        }}
        onKeyDown={(keyEvent: KeyboardEvent) => {
          if (keyEvent.key === " ") {
            keyEvent.preventDefault();
            choose();
          }
        }}
      >
        <span className="blocco-orario__titolo">{full.title}</span>
        {minutes > SHORT_BLOCK_MINUTES ? (
          <span className="blocco-orario__ora">{range}</span>
        ) : null}
        {people.length > 0 && people.length <= MAX_AVATARS ? (
          <span className="avatar-gruppo" aria-hidden="true">
            {people.map((member) => (
              <Avatar
                key={member.id}
                name={member.name}
                color={member.color}
                size="xs"
                nameShown
              />
            ))}
          </span>
        ) : null}
      </a>
      <span id={descriptionId} hidden>
        {blockDescription(full, view.day, members)}
      </span>
    </>
  );
}

/** The week grid: 8:00-23:00, one hour = 40 px. */
export function WeekGrid({
  view,
  members,
  nowMs,
  selection,
  onSelect,
  onOpenGroup,
}: {
  view: WeekView;
  members: readonly Member[];
  nowMs: number;
  selection: Selection | null;
  onSelect: (event: KeyedFullEvent, dayKey: string) => void;
  onOpenGroup: (group: OtherGroup) => void;
}) {
  return (
    <div className="griglia-settimana">
      <div className="griglia-settimana__angolo" />
      {view.days.map((day) => {
        const short = formatShortWeekday(day.day.start);
        return (
          <div
            key={day.day.key}
            className={cx(
              "griglia-settimana__giorno",
              day.isToday && "is-oggi",
            )}
            aria-hidden="true"
          >
            <span className="griglia-settimana__nome">
              {day.isToday ? `${short}, oggi` : short}
            </span>
            <span className="griglia-settimana__numero">
              {Number(day.day.key.slice(8, 10))}
            </span>
          </div>
        );
      })}
      <div className="colonna-ore" aria-hidden="true">
        {HOURS.map((hour) => (
          <span key={hour} className="colonna-ore__ora">
            {hour}
          </span>
        ))}
      </div>
      {view.days.map((day) => {
        const nowHours = day.isToday
          ? hoursSinceGridStart(nowMs, day.day.key)
          : null;
        return (
          <div
            key={day.day.key}
            className={cx(
              "griglia-settimana__colonna",
              "ore-15",
              day.isToday && "is-oggi",
            )}
          >
            <h2 className="visivamente-nascosto">
              {day.isToday
                ? `${formatLongDay(day.day.start)}, oggi`
                : formatLongDay(day.day.start)}
            </h2>
            {layoutDay(day).map((block) => (
              <BlockView
                key={block.key}
                block={block}
                view={day}
                members={members}
                selected={
                  selection !== null &&
                  block.item?.kind === "event" &&
                  block.item.key === selection.event.key &&
                  day.day.key === selection.dayKey
                }
                onSelect={onSelect}
                onOpenGroup={(blockKey) =>
                  onOpenGroup({ dayKey: day.day.key, blockKey })
                }
              />
            ))}
            {nowHours !== null ? (
              <NowLine
                hours={nowHours}
                label={`Adesso, ${formatTime(nowMs)}`}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** «Altri impegni»: the events a crowded stretch of the grid could not show. */
export function OthersPanel({
  group,
  view,
  members,
  meId,
  nowMs,
}: {
  group: OtherGroup;
  view: WeekView;
  members: readonly Member[];
  meId: string | null;
  nowMs: number;
}) {
  const day = view.days.find((candidate) => candidate.day.key === group.dayKey);
  const block = day
    ? layoutDay(day).find((candidate) => candidate.key === group.blockKey)
    : undefined;
  if (!day || !block?.hidden) return null;
  return (
    <section className="sezione">
      <div className="sezione__testa">
        <h2 className="sezione__titolo">Altri impegni</h2>
        <span className="sezione__info">
          {formatDayNumber(day.day.start, { capitalized: false })}, dalle{" "}
          {formatTime(block.startMs)}
        </span>
      </div>
      <div className="sezione">
        {block.hidden.map((item) => (
          <DayRow
            key={item.key}
            item={item}
            day={day.day}
            members={members}
            meId={meId}
            nowMs={nowMs}
          />
        ))}
      </div>
    </section>
  );
}
