"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon/Icon";
import { formatHiddenCount } from "@/lib/calendar";
import { formatShortWeekday } from "@/lib/datetime";
import { DayRow } from "./Rows";
import {
  dayHeading,
  dayHeadInfo,
  dayItems,
  tabLabel,
  type DayView,
  type Member,
  type WeekView,
} from "./model";

/** Strip of the seven days (`role="tablist"`). Without a view it is the loading strip. */
export function DayStrip({
  weekKey,
  loaded,
  days,
  selectedKey,
  onSelect,
}: {
  weekKey: string;
  /** False while the week is loading or could not be read: no counts, no dots */
  loaded: boolean;
  days: readonly DayView[];
  selectedKey: string;
  onSelect: (dayKey: string) => void;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'),
    );
    const index = tabs.indexOf(document.activeElement as HTMLElement);
    if (index === -1) return;
    let next = index;
    if (event.key === "ArrowRight") next = Math.min(index + 1, tabs.length - 1);
    else if (event.key === "ArrowLeft") next = Math.max(index - 1, 0);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    tabs[next]?.focus();
  };

  return (
    <div
      className="striscia-giorni"
      role="tablist"
      aria-label="Giorni della settimana"
      onKeyDown={handleKeyDown}
    >
      {days.map((day) => {
        const selected = day.day.key === selectedKey;
        const count = loaded ? day.events.length : null;
        return (
          <button
            key={day.day.key}
            type="button"
            role="tab"
            id={`m-tab-${weekKey}-${day.day.key}`}
            className={cx(
              "striscia-giorni__giorno",
              day.isToday && "is-oggi",
              selected && "is-selezionato",
            )}
            aria-selected={selected}
            aria-current={day.isToday ? "date" : undefined}
            tabIndex={selected ? 0 : -1}
            aria-label={tabLabel(day.day, count, day.evening !== null)}
            onClick={() => onSelect(day.day.key)}
          >
            <span className="striscia-giorni__nome">
              {formatShortWeekday(day.day.start)}
            </span>
            <span className="striscia-giorni__numero">
              {Number(day.day.key.slice(8, 10))}
            </span>
            <span className="striscia-giorni__densita">
              {Array.from({ length: Math.min(count ?? 0, 4) }, (_, index) => (
                <span key={index} className="striscia-giorni__punto" />
              ))}
              {loaded && day.evening ? (
                <span
                  className="striscia-giorni__punto striscia-giorni__punto--insieme"
                  data-insieme="true"
                />
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The seven days, one section each. */
export function DayList({
  view,
  startKey,
  members,
  meId,
  nowMs,
}: {
  view: WeekView;
  /** First day of the list: today in the current week, else the Monday */
  startKey: string;
  members: readonly Member[];
  meId: string | null;
  nowMs: number;
}): ReactNode {
  return (
    <>
      {view.days
        .filter((day) => day.day.key >= startKey)
        .map((day) => {
          const items = dayItems(day);
          return (
            <section key={day.day.key} className="sezione">
              <div className="sezione__testa">
                <h2
                  className="sezione__titolo"
                  id={`m-giorno-${day.day.key}`}
                  tabIndex={-1}
                >
                  {dayHeading(day, view.weekKey)}
                </h2>
                <span className="sezione__info">
                  {dayHeadInfo(day.events.length, day.isToday)}
                </span>
              </div>
              <div className="sezione">
                {items.map((item) => (
                  <DayRow
                    key={item.key}
                    item={item}
                    day={day.day}
                    members={members}
                    meId={meId}
                    nowMs={nowMs}
                  />
                ))}
                {day.hiddenCount > 0 ? (
                  <p className="sezione__info">
                    <Icon name="eye-off" size="s" />{" "}
                    {formatHiddenCount(day.hiddenCount)}
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}
    </>
  );
}
