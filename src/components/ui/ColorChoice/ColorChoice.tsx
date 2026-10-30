"use client";

import { useRef, type KeyboardEvent } from "react";
import { MEMBER_COLORS, type MemberColor } from "../Avatar/Avatar";
import { cx } from "../cx";

/** The ten colours a member can have, in the base order (#74). */
export type ChoosableColor = Exclude<MemberColor, "insieme">;

export const CHOOSABLE_COLORS: ReadonlyArray<ChoosableColor> =
  MEMBER_COLORS.filter((color): color is ChoosableColor => color !== "insieme");

/** Colour already used in the Nest. `by` is the name of whoever has it, when known. */
export type TakenColor = { color: ChoosableColor; by?: string };

/** Name of a colour as read aloud: `Salvia`. */
export function memberColorLabel(color: MemberColor): string {
  return color.charAt(0).toLocaleUpperCase("it-IT") + color.slice(1);
}

/** First colour, in the base order, that is not taken. `null` if all ten are. */
export function firstFreeColor(
  taken: ReadonlyArray<TakenColor>,
): ChoosableColor | null {
  return (
    CHOOSABLE_COLORS.find((color) => !taken.some((t) => t.color === color)) ??
    null
  );
}

/**
 * Order of the colour page for invitations and members (design system, 08 and
 * 27): the chosen colour first, then the free ones, then the taken ones, each
 * group in the base order. Computed once when the page opens, so the circles
 * do not move under the finger.
 */
export function chosenFirstOrder(
  chosen: ChoosableColor | null,
  taken: ReadonlyArray<TakenColor>,
): ChoosableColor[] {
  const isTaken = (color: ChoosableColor) =>
    taken.some((t) => t.color === color);
  const first = chosen ? [chosen] : [];
  const free = CHOOSABLE_COLORS.filter(
    (color) => color !== chosen && !isTaken(color),
  );
  const used = CHOOSABLE_COLORS.filter(
    (color) => color !== chosen && isTaken(color),
  );
  return [...first, ...free, ...used];
}

export type ColorChoiceProps = {
  /** Required accessible name of the group, for example "Colore" */
  "aria-label": string;
  /** Chosen colour, or `null` when none is chosen */
  value: ChoosableColor | null;
  onChange: (color: ChoosableColor) => void;
  /** Colours of other members: switched off and named "<Colore> (già di <nome>)" or "<Colore> (già usato)" */
  taken?: ReadonlyArray<TakenColor>;
  /** Order in which the ten colours are shown and walked with the arrows; the base order without it */
  order?: ReadonlyArray<ChoosableColor>;
  /** Whole group disabled (saving in progress) */
  disabled?: boolean;
  /** Group left aligned (`.scelta-colore--sinistra`), as in sheets and forms; centered when false */
  alignStart?: boolean;
  /** Marks the group as wrong (`aria-invalid`) */
  invalid?: boolean;
  /** `id` of the hint or error text that describes the group */
  describedBy?: string;
  /** Prefix of the ids of the colours, to keep them unique when two groups exist */
  idPrefix?: string;
  className?: string;
  "data-testid"?: string;
};

/**
 * Colour choice as a radio group (`.scelta-colore`): ten circles on two rows
 * of five, one tab stop, arrows move and choose (right and down go to the
 * next, left and up to the previous, from 10 back to 1), taken colours are
 * disabled and skipped.
 */
export function ColorChoice({
  value,
  onChange,
  taken = [],
  order,
  disabled = false,
  alignStart = false,
  invalid,
  describedBy,
  idPrefix,
  className,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: ColorChoiceProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  // A partial or repeated order would hide colours: fall back to the base one.
  const colors =
    order &&
    order.length === CHOOSABLE_COLORS.length &&
    CHOOSABLE_COLORS.every((color) => order.includes(color))
      ? order
      : CHOOSABLE_COLORS;

  const isOff = (color: ChoosableColor) =>
    disabled || taken.some((t) => t.color === color);

  // Single tab stop: the chosen colour, or the first one available.
  const tabStop =
    value && !isOff(value)
      ? value
      : (colors.find((color) => !isOff(color)) ?? null);

  const move = (from: number, step: 1 | -1) => {
    const count = colors.length;
    for (let i = 1; i <= count; i += 1) {
      const index = (from + step * i + count * count) % count;
      const color = colors[index]!;
      if (!isOff(color)) {
        onChange(color);
        refs.current[index]?.focus();
        return;
      }
    }
  };

  const onKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      move(index, 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      move(index, -1);
    }
  };

  return (
    <div
      className={cx(
        "scelta-colore",
        alignStart && "scelta-colore--sinistra",
        className,
      )}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-invalid={invalid ? true : undefined}
      aria-describedby={describedBy}
      data-testid={testId}
    >
      {colors.map((color, index) => {
        const owner = taken.find((t) => t.color === color);
        const name = memberColorLabel(color);
        const label = owner
          ? owner.by
            ? `${name} (già di ${owner.by})`
            : `${name} (già usato)`
          : name;
        return (
          <button
            key={color}
            ref={(node) => {
              refs.current[index] = node;
            }}
            id={idPrefix ? `${idPrefix}-${color}` : undefined}
            type="button"
            role="radio"
            className={cx("scelta-colore__colore", `membro-${color}`)}
            aria-checked={value === color}
            aria-label={label}
            disabled={isOff(color)}
            tabIndex={color === tabStop ? 0 : -1}
            onClick={() => onChange(color)}
            onKeyDown={(event) => onKeyDown(event, index)}
          />
        );
      })}
    </div>
  );
}
