"use client";

import type { KeyboardEvent } from "react";
import { cx } from "@/components/ui/cx";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import { MANY_PEOPLE, WEEKDAY_NAMES, cellLabel, type MonthCell } from "./model";

const WEEKDAY_LETTERS = ["L", "M", "M", "G", "V", "S", "D"] as const;

/** Moves the focus inside the grid (WAI-ARIA grid): arrows, Home and End stop at the edges. */
function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const cells = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('[role="gridcell"]'),
  );
  const index = cells.indexOf(document.activeElement as HTMLElement);
  if (index === -1) return;
  const rowStart = Math.floor(index / 7) * 7;
  let next = index;
  switch (event.key) {
    case "ArrowLeft":
      next = Math.max(index - 1, 0);
      break;
    case "ArrowRight":
      next = Math.min(index + 1, cells.length - 1);
      break;
    case "ArrowUp":
      if (index - 7 >= 0) next = index - 7;
      break;
    case "ArrowDown":
      if (index + 7 < cells.length) next = index + 7;
      break;
    case "Home":
      next = rowStart;
      break;
    case "End":
      next = Math.min(rowStart + 6, cells.length - 1);
      break;
    default:
      return;
  }
  event.preventDefault();
  cells[next]?.focus();
}

/**
 * The dots of a day. Every person has a dot and, from 5 people, the grey one
 * («e altri») follows: the CSS shows 3 dots and the grey one under 768 px, and
 * every dot from 768 px. They are decorative: the people are in the name of
 * the cell.
 */
function Dots({ cell }: { cell: MonthCell }) {
  const many = cell.people.length >= MANY_PEOPLE;
  return (
    <span
      className={cx(
        "griglia-mese__punti",
        many && "griglia-mese__punti--molti",
      )}
      aria-hidden="true"
    >
      {cell.people.map((member) => (
        <span
          key={member.id}
          className={cx("avatar", "avatar--punto", `membro-${member.color}`)}
          data-membro={member.id}
        />
      ))}
      {many ? (
        <span className="griglia-mese__altri" data-testid="punti-altri" />
      ) : null}
    </span>
  );
}

/**
 * Grid of the month (`role="grid"`): a row of column headers and one row per
 * week. The chosen day is the only stop of the Tab.
 */
export function MonthGrid({
  title,
  cells,
  meId,
  chosenKey,
  onChoose,
}: {
  /** Accessible name: the month and year */
  title: string;
  cells: readonly MonthCell[];
  meId: string | null;
  chosenKey: string;
  onChoose: (dayKey: string) => void;
}) {
  const rows: MonthCell[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    rows.push(cells.slice(index, index + 7));
  }
  return (
    <div
      className="griglia-mese"
      role="grid"
      aria-label={title}
      onKeyDown={handleKeyDown}
    >
      <div className="griglia-mese__riga" role="row">
        {WEEKDAY_LETTERS.map((letter, index) => (
          <span
            key={WEEKDAY_NAMES[index]}
            className="griglia-mese__intestazione"
            role="columnheader"
          >
            <span aria-hidden="true">{letter}</span>
            <VisuallyHidden>{WEEKDAY_NAMES[index]}</VisuallyHidden>
          </span>
        ))}
      </div>
      {rows.map((row) => (
        <div key={row[0]?.day.key} className="griglia-mese__riga" role="row">
          {row.map((cell) => {
            const chosen = cell.day.key === chosenKey;
            return (
              <button
                key={cell.day.key}
                type="button"
                role="gridcell"
                className={cx(
                  "griglia-mese__cella",
                  !cell.inMonth && "griglia-mese__cella--fuori",
                  cell.weekend && "griglia-mese__cella--weekend",
                  cell.holiday && "griglia-mese__cella--festa",
                  cell.isToday && "griglia-mese__cella--oggi",
                  chosen && "griglia-mese__cella--selezionata",
                )}
                aria-selected={chosen}
                aria-current={cell.isToday ? "date" : undefined}
                aria-label={cellLabel(cell, meId)}
                tabIndex={chosen ? 0 : -1}
                onClick={() => onChoose(cell.day.key)}
              >
                <span className="griglia-mese__numero">{cell.number}</span>
                <Dots cell={cell} />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
