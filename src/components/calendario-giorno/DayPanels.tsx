"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { Avatar } from "@/components/ui/Avatar/Avatar";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { Icon } from "@/components/ui/Icon/Icon";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import {
  VISIBILITY_LABELS,
  formatFreeEveningWindow,
  type FreeEvening,
} from "@/lib/calendar";
import { formatDayNumber, formatTime, type CalendarDay } from "@/lib/datetime";
import { eventHref } from "@/lib/household-events";
import { DayRow } from "@/components/calendario-settimana/Rows";
import {
  MAX_AVATARS,
  participantsInNestOrder,
  type KeyedEvent,
  type KeyedFullEvent,
  type Member,
} from "@/components/calendario-settimana/model";
import { panelInfo, type GridPiece } from "./model";

/** «Impegno»: the chosen event, as a card that opens the detail. */
export function EventPanel({
  event,
  dayKey,
  members,
}: {
  event: KeyedFullEvent;
  dayKey: string;
  members: readonly Member[];
}) {
  const people = participantsInNestOrder(event, members);
  return (
    <section className="sezione">
      <div className="sezione__testa">
        <h2 className="sezione__titolo">Impegno</h2>
        <span className="sezione__info">tocca un altro per cambiare</span>
      </div>
      <Link
        href={eventHref(event.id, event.startsAt)}
        className="scheda scheda--evidenza prossimo"
      >
        <span className="prossimo__alto">
          <span className="prossimo__ora">{formatTime(event.startsAt)}</span>
          <span className="prossimo__dati">
            <span className="prossimo__titolo">
              {event.title}
              {event.visibility === "private" ? (
                <>
                  <Icon name="lock" size="s" />
                  <VisuallyHidden>Visibile solo a te</VisuallyHidden>
                </>
              ) : null}
            </span>
            <span className="prossimo__info">{panelInfo(event, dayKey)}</span>
          </span>
        </span>
        <span className="prossimo__nota">
          <span>{VISIBILITY_LABELS[event.visibility]}</span>
          {people.length > 0 && people.length <= MAX_AVATARS ? (
            <span
              className="avatar-gruppo"
              role="img"
              aria-label={people.map((member) => member.name).join(", ")}
            >
              {people.map((member) => (
                <Avatar
                  key={member.id}
                  name={member.name}
                  color={member.color}
                  size="m"
                  nameShown
                />
              ))}
            </span>
          ) : null}
        </span>
      </Link>
    </section>
  );
}

/** «Altri impegni»: the events a crowded stretch of a column could not show. */
export function OthersPanel({
  piece,
  ownerName,
  isMe,
  day,
  members,
  meId,
  nowMs,
}: {
  piece: GridPiece;
  ownerName: string;
  isMe: boolean;
  day: CalendarDay;
  members: readonly Member[];
  meId: string | null;
  nowMs: number;
}) {
  const hidden: readonly KeyedEvent[] = piece.hidden ?? [];
  const first = hidden[0];
  if (!first) return null;
  return (
    <section className="sezione">
      <div className="sezione__testa">
        <h2 className="sezione__titolo">Altri impegni</h2>
        <span className="sezione__info">
          {isMe ? "tuoi" : `di ${ownerName}`}, dalle{" "}
          {formatTime(first.startsAt)}
        </span>
      </div>
      <div className="sezione">
        {hidden.map((event) => (
          <DayRow
            key={event.key}
            item={{
              kind: "event",
              key: event.key,
              event,
              startMs: Math.max(
                new Date(event.startsAt).getTime(),
                day.start.getTime(),
              ),
            }}
            day={day}
            members={members}
            meId={meId}
            nowMs={nowMs}
          />
        ))}
      </div>
    </section>
  );
}

function isPlainClick(event: MouseEvent): boolean {
  return !(
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

/**
 * «Serate libere insieme»: one line per evening of the week. The evening of
 * another day is a link to that day; the one already shown is not.
 */
export function EveningsPanel({
  evenings,
  shownDayKey,
  hasAnyEvent,
  onGo,
}: {
  evenings: readonly FreeEvening[];
  shownDayKey: string;
  hasAnyEvent: boolean;
  /** A plain click on a row: go to that day without reloading */
  onGo: (dayKey: string) => void;
}) {
  if (!hasAnyEvent) {
    return (
      <section className="sezione">
        <div className="sezione__testa">
          <h2 className="sezione__titolo">Serate libere insieme</h2>
        </div>
        <EmptyState
          icon="heart"
          title="Ancora niente da calcolare"
          text="Le serate in cui siete tutti liberi compaiono qui."
          actions={null}
        />
      </section>
    );
  }
  if (evenings.length === 0) {
    return (
      <section className="sezione">
        <div className="sezione__testa">
          <h2 className="sezione__titolo">Serate libere insieme</h2>
        </div>
        <EmptyState
          icon="heart"
          title="Nessuna serata libera insieme"
          text="Questa settimana ogni sera qualcuno ha un impegno."
          actions={null}
        />
      </section>
    );
  }
  return (
    <section className="sezione">
      <div className="sezione__testa">
        <h2 className="sezione__titolo">Serate libere insieme</h2>
        <span className="sezione__info">
          {evenings.length} questa settimana
        </span>
      </div>
      <ul className="scheda lista">
        {evenings.map((evening) => {
          const content = (
            <>
              <span className="icona-riquadro icona-riquadro--insieme">
                <Icon name="heart" />
              </span>
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">
                  {formatDayNumber(evening.start)}
                </span>
                <span className="riga-lista__info">
                  {formatFreeEveningWindow(evening)}
                </span>
              </span>
            </>
          );
          return (
            <li key={evening.dayKey}>
              {evening.dayKey === shownDayKey ? (
                <div className="riga-lista">{content}</div>
              ) : (
                <Link
                  href={`/calendario/giorno?giorno=${evening.dayKey}`}
                  className="riga-lista riga-lista--cliccabile"
                  onClick={(clickEvent) => {
                    if (!isPlainClick(clickEvent)) return;
                    clickEvent.preventDefault();
                    onGo(evening.dayKey);
                  }}
                >
                  {content}
                  <span className="riga-lista__valore">
                    <Icon name="chevron-right" />
                  </span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
