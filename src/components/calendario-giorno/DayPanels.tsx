"use client";

import { formatTime, type CalendarDay } from "@/lib/datetime";
import { DayRow } from "@/components/calendario/Rows";
import type { KeyedEvent, Member } from "@/components/calendario/model";
import type { GridPiece } from "./model";

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
