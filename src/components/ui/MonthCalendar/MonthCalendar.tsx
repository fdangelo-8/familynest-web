"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  addDaysToDayKey,
  addMonthsToDayKey,
  formatFullDay,
  formatMonthName,
  formatWeekdayLower,
  formatWeekdayShortLower,
  getMonthGridDays,
  getMonthStartKey,
  getNextMonthKey,
  getWeekStartKey,
  isValidDayKey,
  todayKeyInRome,
} from "@/lib/datetime";
import { it } from "@/lib/i18n/messages/it";
import { cx } from "../cx";
import { Icon } from "../Icon/Icon";

export type MonthCalendarProps = {
  /** Chosen day, `YYYY-MM-DD`; empty when nothing is chosen */
  value: string;
  /** A tap or Enter on a day chooses it: no «Conferma» */
  onSelect: (dayKey: string) => void;
  /** Days before it (`YYYY-MM-DD`) cannot be chosen */
  min?: string;
  /** Days after it (`YYYY-MM-DD`) cannot be chosen */
  max?: string;
  /** Accessible name of the whole calendar (the label of the field) */
  label: string;
  /**
   * The first day to reach with the keyboard is marked `data-autofocus`, so the
   * dialog that holds the calendar puts the focus on it when it opens.
   */
  markInitialFocus?: boolean;
  className?: string;
  "data-testid"?: string;
};

const WEEK = [0, 1, 2, 3, 4, 5, 6];

/** Keeps `key` inside `min`..`max` (day keys sort as text). */
function clamp(key: string, min?: string, max?: string): string {
  if (min && key < min) return min;
  if (max && key > max) return max;
  return key;
}

/**
 * Month calendar to choose a day (`.calendario-scelta`): month and year on top
 * with the arrows, a Monday-first grid of 44 px circles. One tap chooses the
 * day. The keyboard moves with the arrows, Page up/down, Home and End. The
 * days are Rome days: «today» never depends on the time zone of the device.
 */
export function MonthCalendar({
  value,
  onSelect,
  min,
  max,
  label,
  markInitialFocus = false,
  className,
  "data-testid": testId,
}: MonthCalendarProps) {
  const [today] = useState(() => todayKeyInRome());
  const [initialFocus] = useState(() =>
    clamp(isValidDayKey(value) ? value : today, min, max),
  );
  // The day that takes the Tab stop and the arrows (roving tabindex)
  const [focusKey, setFocusKey] = useState(initialFocus);
  const [monthKey, setMonthKey] = useState(() =>
    getMonthStartKey(initialFocus),
  );
  const gridRef = useRef<HTMLDivElement>(null);
  const moveFocus = useRef(false);

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    gridRef.current
      ?.querySelector<HTMLElement>(`[data-day="${focusKey}"]`)
      ?.focus();
  }, [focusKey, monthKey]);

  const days = getMonthGridDays(monthKey);
  const rows: (typeof days)[] = [];
  for (let start = 0; start < days.length; start += 7) {
    rows.push(days.slice(start, start + 7));
  }
  const monthName = formatMonthName(monthKey);
  const year = monthKey.slice(0, 4);

  const previousBlocked =
    min !== undefined && addDaysToDayKey(monthKey, -1) < min;
  const nextBlocked = max !== undefined && getNextMonthKey(monthKey) > max;

  // The arrows: the same day of the other month (clamped), no focus move
  const goToMonth = (months: number) => {
    const target = addMonthsToDayKey(monthKey, months);
    setMonthKey(target);
    setFocusKey(clamp(addMonthsToDayKey(focusKey, months), min, max));
  };

  const choose = (key: string) => {
    if ((min && key < min) || (max && key > max)) return;
    onSelect(key);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    let target: string | null = null;
    switch (event.key) {
      case "ArrowLeft":
        target = addDaysToDayKey(focusKey, -1);
        break;
      case "ArrowRight":
        target = addDaysToDayKey(focusKey, 1);
        break;
      case "ArrowUp":
        target = addDaysToDayKey(focusKey, -7);
        break;
      case "ArrowDown":
        target = addDaysToDayKey(focusKey, 7);
        break;
      case "Home":
        target = getWeekStartKey(focusKey);
        break;
      case "End":
        target = addDaysToDayKey(getWeekStartKey(focusKey), 6);
        break;
      case "PageUp":
        target = addMonthsToDayKey(focusKey, event.shiftKey ? -12 : -1);
        break;
      case "PageDown":
        target = addMonthsToDayKey(focusKey, event.shiftKey ? 12 : 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        choose(focusKey);
        return;
      default:
        return;
    }
    event.preventDefault();
    const next = clamp(target, min, max);
    moveFocus.current = true;
    setFocusKey(next);
    setMonthKey(getMonthStartKey(next));
  };

  return (
    <div
      className={cx("calendario-scelta", className)}
      role="group"
      aria-label={label}
      data-testid={testId}
    >
      <div className="calendario-scelta__testa">
        <p className="calendario-scelta__titolo" aria-live="polite">
          <span className="calendario-scelta__mese">{monthName}</span>{" "}
          <span className="calendario-scelta__anno">{year}</span>
        </p>
        <button
          type="button"
          className="calendario-scelta__freccia"
          aria-label={it.sheetsDates.previousMonth}
          aria-disabled={previousBlocked || undefined}
          onClick={previousBlocked ? undefined : () => goToMonth(-1)}
        >
          <Icon name="chevron-left" />
        </button>
        <button
          type="button"
          className="calendario-scelta__freccia"
          aria-label={it.sheetsDates.nextMonth}
          aria-disabled={nextBlocked || undefined}
          onClick={nextBlocked ? undefined : () => goToMonth(1)}
        >
          <Icon name="chevron-right" />
        </button>
      </div>
      <div
        ref={gridRef}
        className="calendario-scelta__griglia"
        role="grid"
        aria-label={`${monthName} ${year}`}
        onKeyDown={onKeyDown}
      >
        <div className="calendario-scelta__riga" role="row">
          {WEEK.map((index) => {
            const key = addDaysToDayKey(getWeekStartKey(monthKey), index);
            return (
              <span
                key={index}
                className="calendario-scelta__intestazione"
                role="columnheader"
                aria-label={formatWeekdayLower(key)}
              >
                {formatWeekdayShortLower(key)}
              </span>
            );
          })}
        </div>
        {rows.map((row) => (
          <div key={row[0]?.key} className="calendario-scelta__riga" role="row">
            {row.map((day) => {
              const key = day.key;
              const outside = Boolean((min && key < min) || (max && key > max));
              const isToday = key === today;
              const isChosen = key === value;
              const name = isToday
                ? `${formatFullDay(key)}, ${it.sheetsDates.today}`
                : formatFullDay(key);
              return (
                <div
                  key={key}
                  className={cx(
                    "calendario-scelta__giorno",
                    isChosen && "is-scelto",
                    isToday && "is-oggi",
                    key.slice(0, 7) !== monthKey.slice(0, 7) && "is-altro-mese",
                    outside && "is-fuori",
                  )}
                  role="gridcell"
                  aria-label={name}
                  aria-selected={isChosen || undefined}
                  aria-current={isToday ? "date" : undefined}
                  aria-disabled={outside || undefined}
                  tabIndex={key === focusKey ? 0 : -1}
                  data-day={key}
                  data-autofocus={
                    markInitialFocus && key === initialFocus ? "" : undefined
                  }
                  onClick={() => choose(key)}
                  onFocus={() => {
                    if (key !== focusKey && !outside) setFocusKey(key);
                  }}
                >
                  {Number(key.slice(8, 10))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
