"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { Chip, ChipGroup } from "@/components/ui/Chip/Chip";
import { Sheet } from "@/components/ui/Sheet/Sheet";
import { DIGEST_TIMES, digestTimeLabel, type DigestTime } from "./model";

/*
 * The three sheets of «Come usi l'app» (#38). Touching an option chooses it,
 * closes the sheet and saves: there is no «Salva». The sheet does not write
 * anything itself; it tells the page which option was touched.
 */

/** The sheet puts its focus on the first button; the current option takes it right after. */
function useFocusCurrent(
  groupRef: React.RefObject<HTMLElement | null>,
  selector: string,
) {
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      groupRef.current?.querySelector<HTMLElement>(selector)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [groupRef, selector]);
}

type Option<T extends string> = { value: T; label: string; info: string };

function RadioOptions<T extends string>({
  title,
  options,
  value,
  onChoose,
}: {
  title: string;
  options: ReadonlyArray<Option<T>>;
  value: T;
  onChoose: (value: T) => void;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  useFocusCurrent(groupRef, '[role="radio"][aria-checked="true"]');

  // Arrows only move the focus (the last goes back to the first): choosing
  // closes the sheet and saves, and an arrow must not do that.
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = options.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      next = index === last ? 0 : index + 1;
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      next = index === 0 ? last : index - 1;
    }
    if (next === null) return;
    event.preventDefault();
    groupRef.current
      ?.querySelectorAll<HTMLElement>('[role="radio"]')
      [next]?.focus();
  }

  return (
    <div
      ref={groupRef}
      className="gruppo-scelte"
      role="radiogroup"
      aria-label={title}
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          className="scelta"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          onClick={() => onChoose(option.value)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          <span className="scelta__radio" aria-hidden="true" />
          <span>
            <span className="scelta__titolo">{option.label}</span>
            <span className="scelta__info">{option.info}</span>
          </span>
          <span />
        </button>
      ))}
    </div>
  );
}

export function ChoiceSheet<T extends string>({
  open,
  closeRequested,
  onClose,
  title,
  intro,
  options,
  value,
  onChoose,
}: {
  open: boolean;
  closeRequested: boolean;
  onClose: () => void;
  title: string;
  /** Line above the options */
  intro?: string;
  options: ReadonlyArray<Option<T>>;
  value: T;
  onChoose: (value: T) => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      closeRequested={closeRequested}
      title={title}
    >
      {intro ? <p className="t-corpo t-secondario">{intro}</p> : null}
      <RadioOptions
        title={title}
        options={options}
        value={value}
        onChoose={onChoose}
      />
    </Sheet>
  );
}

function TimeChips({
  value,
  onChoose,
}: {
  value: DigestTime;
  onChoose: (value: DigestTime) => void;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  useFocusCurrent(groupRef, '[aria-pressed="true"]');
  return (
    <div ref={groupRef}>
      <ChipGroup aria-label="Ora della sintesi">
        {DIGEST_TIMES.map((time) => (
          <Chip
            key={time}
            pressed={time === value}
            onClick={() => onChoose(time)}
          >
            {digestTimeLabel(time)}
          </Chip>
        ))}
      </ChipGroup>
    </div>
  );
}

export function TimeSheet({
  open,
  closeRequested,
  onClose,
  value,
  onChoose,
}: {
  open: boolean;
  closeRequested: boolean;
  onClose: () => void;
  value: DigestTime;
  onChoose: (value: DigestTime) => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      closeRequested={closeRequested}
      title="Sintesi del mattino"
    >
      <p className="t-corpo t-secondario">
        Ogni mattina, a quest&apos;ora, la tua giornata in una frase.
      </p>
      <TimeChips value={value} onChoose={onChoose} />
    </Sheet>
  );
}
