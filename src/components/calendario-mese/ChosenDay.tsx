"use client";

import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { Icon } from "@/components/ui/Icon/Icon";
import { Skeleton } from "@/components/ui/Skeleton/Skeleton";
import { formatHiddenCount } from "@/lib/calendar";
import { formatDayNumber, type CalendarDay } from "@/lib/datetime";
import {
  dayItems,
  type DayView,
} from "@/components/calendario-settimana/model";
import { DayRow } from "@/components/calendario/Rows";
import type { Member } from "@/components/calendario/model";
import { chosenInfo } from "./model";

/**
 * The chosen day under the grid (mobile) or in the right column (desktop): the
 * head, and the rows, the empty state or the loading rows. Without `view` only
 * the head and what does not depend on the data are shown.
 */
export function ChosenDay({
  day,
  holiday,
  isToday,
  isPast,
  inMonth,
  view,
  loading,
  members,
  meId,
  nowMs,
}: {
  day: CalendarDay;
  holiday: string | null;
  isToday: boolean;
  /** The day is before today: the empty title is «Nessun impegno» */
  isPast: boolean;
  inMonth: boolean;
  /** The rows of the day, once the month is read */
  view: DayView | null;
  /** The month is being read: loading rows instead of the rows */
  loading: boolean;
  members: readonly Member[];
  meId: string | null;
  nowMs: number;
}) {
  const info = chosenInfo({
    isToday,
    holiday,
    count: view ? view.events.length : null,
  });
  const items = view ? dayItems(view) : [];
  const empty = view !== null && view.events.length === 0;
  return (
    <section className="sezione" data-testid="giorno-scelto">
      <div className="sezione__testa">
        <h2 className="sezione__titolo">
          {formatDayNumber(day.start, { withMonth: !inMonth })}
        </h2>
        {info ? <span className="sezione__info">{info}</span> : null}
      </div>
      {loading ? (
        <div className="gruppo-skeleton" aria-busy="true">
          <Skeleton shape="riga" />
          <Skeleton shape="riga" />
        </div>
      ) : null}
      {view ? (
        <div className="sezione">
          {empty ? (
            <EmptyState
              icon="calendar"
              title={isPast ? "Nessun impegno" : "Niente in programma"}
              text=""
              actions={<Link href="/aggiungi">Aggiungi un impegno</Link>}
              after="."
            />
          ) : null}
          {items.map((item) => (
            <DayRow
              key={item.key}
              item={item}
              day={view.day}
              members={members}
              meId={meId}
              nowMs={nowMs}
              eveningLinksToWeek
            />
          ))}
          {view.hiddenCount > 0 ? (
            <p className="sezione__info">
              <Icon name="eye-off" size="s" />{" "}
              {formatHiddenCount(view.hiddenCount)}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
