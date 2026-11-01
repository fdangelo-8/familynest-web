"use client";

import Link from "next/link";
import { Fragment, type KeyboardEvent, type MouseEvent } from "react";
import { NowLine } from "@/components/calendario/NowLine";
import { Avatar } from "@/components/ui/Avatar/Avatar";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon/Icon";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import { BUSY_TITLE, formatBusyLabel } from "@/lib/calendar";
import { formatTime, formatTimeRange, type CalendarDay } from "@/lib/datetime";
import { eventHref } from "@/lib/household-events";
import { hoursSinceGridStart } from "@/components/calendario-settimana/model";
import {
  eveningOthers,
  type KeyedFullEvent,
  type Member,
} from "@/components/calendario/model";
import {
  blockDetails,
  eveningDetails,
  type DayColumn,
  type GridPiece,
} from "./model";

const HOURS = Array.from({ length: 15 }, (_, index) => `${8 + index}:00`);
/** Events up to this long show only the title on desktop (the mockup «Scuola»). */
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

function PieceView({
  piece,
  day,
  members,
  columns,
  meId,
  desktop,
  active,
  weekKey,
  onChoose,
  onOpenGroup,
}: {
  piece: GridPiece;
  day: CalendarDay;
  members: readonly Member[];
  columns: readonly DayColumn[];
  meId: string | null;
  desktop: boolean;
  /** This piece belongs to the event chosen in the panel */
  active: boolean;
  weekKey: string;
  onChoose: (eventKey: string) => void;
  onOpenGroup: (piece: GridPiece) => void;
}) {
  const classes = cx("blocco-orario", piece.classes);

  if (piece.kind === "altri") {
    const count = piece.hidden?.length ?? 0;
    const owner = columns[piece.column]?.member;
    const whose = owner
      ? owner.id === meId
        ? "tuoi"
        : `di ${owner.name}`
      : "";
    const first = piece.hidden?.[0];
    const from = first ? formatTime(first.startsAt) : "";
    const label = `Altri ${count} impegni ${whose}${from ? `, dalle ${from}` : ""}`;
    const content = (
      <>
        <span className="blocco-orario__titolo" aria-hidden="true">
          +{count}
        </span>
        <VisuallyHidden>{label.replace(/\s+/g, " ").trim()}</VisuallyHidden>
      </>
    );
    return desktop ? (
      <button
        type="button"
        className={classes}
        onClick={() => onOpenGroup(piece)}
      >
        {content}
      </button>
    ) : (
      <Link href={`/calendario?settimana=${weekKey}`} className={classes}>
        {content}
      </Link>
    );
  }

  if (piece.kind === "insieme" && piece.evening) {
    const adults = members.filter((member) => member.kind === "adult");
    return (
      <div className={cx(classes, "blocco-orario--insieme")}>
        <span className="blocco-orario__titolo" aria-hidden="true">
          Liberi insieme
        </span>
        <span className="blocco-orario__ora" aria-hidden="true">
          {formatTimeRange(piece.evening.start, piece.evening.end)}
        </span>
        <VisuallyHidden>
          {eveningDetails(piece.evening, eveningOthers(adults, meId))}
        </VisuallyHidden>
      </div>
    );
  }

  const event = piece.event;
  if (!event) return null;
  const range = formatTimeRange(event.startsAt, event.endsAt);

  if (event.masked) {
    const author = members.find((member) => member.id === event.authorMemberId);
    return (
      <div className={cx(classes, "blocco-orario--occupato")}>
        <span className="blocco-orario__titolo" aria-hidden="true">
          {BUSY_TITLE}
        </span>
        <span className="blocco-orario__ora" aria-hidden="true">
          {range}
        </span>
        {piece.primary ? (
          <VisuallyHidden>
            {`${formatBusyLabel(author?.name ?? "")}, dalle ${formatTime(event.startsAt)} alle ${formatTime(event.endsAt)}`}
          </VisuallyHidden>
        ) : null}
      </div>
    );
  }

  const full = event as KeyedFullEvent;
  const minutes =
    (new Date(full.endsAt).getTime() - new Date(full.startsAt).getTime()) /
    60_000;
  // Below 1024 px the time is always written: the block is at least an hour.
  const timeShown = !desktop || minutes > SHORT_BLOCK_MINUTES;
  const choose = () => onChoose(full.key);
  const hiddenFromReaders = !piece.primary;
  return (
    <Link
      href={eventHref(full.id, full.startsAt)}
      className={cx(classes, desktop && active && "blocco-orario--attivo")}
      aria-current={desktop && active && piece.primary ? "true" : undefined}
      aria-hidden={hiddenFromReaders ? true : undefined}
      tabIndex={hiddenFromReaders ? -1 : undefined}
      onClick={
        desktop
          ? (clickEvent) => {
              if (!isPlainClick(clickEvent)) return;
              clickEvent.preventDefault();
              choose();
            }
          : undefined
      }
      onKeyDown={
        desktop
          ? (keyEvent: KeyboardEvent) => {
              if (keyEvent.key === " ") {
                keyEvent.preventDefault();
                choose();
              }
            }
          : undefined
      }
    >
      <span className="blocco-orario__titolo">
        {full.visibility === "private" ? (
          <span className="blocco-orario__lucchetto">
            <Icon name="lock" size="s" />
          </span>
        ) : null}
        {full.title}
      </span>
      {piece.primary ? <VisuallyHidden>, </VisuallyHidden> : null}
      <span
        className={cx(
          "blocco-orario__ora",
          !timeShown && "visivamente-nascosto",
        )}
      >
        {range}
      </span>
      {piece.primary ? (
        <VisuallyHidden>
          {blockDetails(full, day, members, meId)}
        </VisuallyHidden>
      ) : null}
    </Link>
  );
}

/**
 * The grid 8:00-23:00, one column for each person. The red line of the
 * current time sits among the blocks, at the point of its time.
 */
export function DayGrid({
  day,
  columns,
  pieces,
  members,
  meId,
  desktop,
  chosenKey,
  nowMs,
  isToday,
  weekKey,
  onChoose,
  onOpenGroup,
}: {
  day: CalendarDay;
  columns: readonly DayColumn[];
  pieces: readonly GridPiece[];
  members: readonly Member[];
  meId: string | null;
  desktop: boolean;
  chosenKey: string | null;
  nowMs: number;
  isToday: boolean;
  weekKey: string;
  onChoose: (eventKey: string) => void;
  onOpenGroup: (piece: GridPiece) => void;
}) {
  const count = columns.length;
  const nowHours = isToday ? hoursSinceGridStart(nowMs, day.key) : null;
  // The line goes before the first block that starts after it.
  const nowQuarter = nowHours === null ? null : nowHours * 4;
  const lineIndex =
    nowQuarter === null
      ? -1
      : pieces.findIndex((piece) => piece.from > nowQuarter);
  const line =
    nowHours !== null ? (
      <NowLine hours={nowHours} label={`Adesso, ${formatTime(nowMs)}`} />
    ) : null;

  return (
    <div
      className={cx(
        "giorno-persone",
        `persone-${count}`,
        count >= 5 && "giorno-persone--larga",
      )}
    >
      <div className="giorno-persone__testa" aria-hidden="true">
        <span />
        {columns.map((column) => (
          <div
            key={column.member.id}
            className="giorno-persone__persona"
            data-testid="testa-colonna"
          >
            <Avatar
              name={column.member.name}
              color={column.member.color}
              size="m"
              nameShown
            />
            <span className="giorno-persone__nome">{column.label}</span>
          </div>
        ))}
      </div>
      <div className="giorno-persone__corpo">
        <div className="colonna-ore" aria-hidden="true">
          {HOURS.map((hour) => (
            <span key={hour} className="colonna-ore__ora">
              {hour}
            </span>
          ))}
        </div>
        <div className="area-orari ore-15">
          {columns.slice(1).map((column, index) => (
            <span
              key={column.member.id}
              className={`area-orari__corsia sep-${index + 2}`}
              aria-hidden="true"
            />
          ))}
          {pieces.map((piece, index) => (
            <Fragment key={piece.key}>
              {lineIndex === index ? line : null}
              <PieceView
                piece={piece}
                day={day}
                members={members}
                columns={columns}
                meId={meId}
                desktop={desktop}
                active={
                  piece.event !== undefined &&
                  chosenKey !== null &&
                  piece.event.key === chosenKey
                }
                weekKey={weekKey}
                onChoose={onChoose}
                onOpenGroup={onOpenGroup}
              />
            </Fragment>
          ))}
          {lineIndex === -1 ? line : null}
        </div>
      </div>
    </div>
  );
}
