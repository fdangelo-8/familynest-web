"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../Icon/Icon";

export type ChoiceOption = {
  value: string;
  title: string;
  /** One line of explanation (cards only) */
  line?: string;
  icon?: IconName;
};

export type ChoiceGroupProps = {
  /** Accessible name of the group: the question */
  label: string;
  /** Chosen answer, or `null` when none is chosen */
  value: string | null;
  onChange: (value: string) => void;
  options: readonly ChoiceOption[];
  /**
   * `cards`: cards in a column with icon, title and a line (A, when a line of
   * explanation is needed). `tiles`: two-column tiles with icon and one word
   * (B, when one word is enough or with more than five answers).
   */
  variant?: "cards" | "tiles";
  /** Error text under the group, with a sign and words */
  error?: string;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
};

/**
 * Choose **one** answer, in place of boxes and radio circles (`.scelta`,
 * `.tessere-scelta`). It behaves like a group of radio buttons: one tab stop
 * (the chosen answer, or the first), arrows move the focus and the choice,
 * in a loop, Space chooses. The chosen one has a thicker ink border, a
 * slightly darker background and a tick in a filled circle, so it is clear
 * without colour. With more than five answers use `tiles`; the segmented
 * control is only for switching views.
 */
export function ChoiceGroup({
  label,
  value,
  onChange,
  options,
  variant = "cards",
  error,
  disabled,
  className,
  "data-testid": testId,
}: ChoiceGroupProps) {
  const id = useId();
  const errorId = error ? `${id}-errore` : undefined;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const checkedIndex = options.findIndex((option) => option.value === value);
  const tabStop = checkedIndex >= 0 ? checkedIndex : 0;

  const move = (from: number, step: 1 | -1) => {
    const count = options.length;
    const next = (from + step + count) % count;
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current[next]?.focus();
  };

  const onKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      move(index, 1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      move(index, -1);
    }
  };

  const tiles = variant === "tiles";

  return (
    <div className="scelta-campo">
      <div
        className={cx(tiles ? "tessere-scelta" : "gruppo-scelte", className)}
        role="radiogroup"
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        data-testid={testId}
      >
        {options.map((option, index) => (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            className={tiles ? "tessera-scelta" : "scelta"}
            aria-checked={option.value === value}
            tabIndex={index === tabStop ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.icon ? <Icon name={option.icon} size="l" /> : null}
            {tiles ? (
              option.title
            ) : (
              <span>
                <span className="scelta__titolo">{option.title}</span>
                {option.line ? (
                  <span className="scelta__info">{option.line}</span>
                ) : null}
              </span>
            )}
            <span className="scelta__radio" aria-hidden="true" />
          </button>
        ))}
      </div>
      {error ? (
        <p className="campo__errore" id={errorId}>
          <Icon name="circle-alert" size="s" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
