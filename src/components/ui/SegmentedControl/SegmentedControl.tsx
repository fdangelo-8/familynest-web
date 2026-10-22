"use client";

import { cx } from "../cx";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Optional count shown after the label */
  count?: number;
};

export type SegmentedControlProps<T extends string> = {
  /** Required accessible name of the group */
  "aria-label": string;
  /** 2 to 5 options */
  options: ReadonlyArray<SegmentedOption<T>>;
  /** Exactly one option is always selected */
  value: T;
  onChange: (value: T) => void;
  /** White-on-paper variant (`.selettore--carta`) */
  paper?: boolean;
  className?: string;
  "data-testid"?: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  paper,
  className,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cx("selettore", paper && "selettore--carta", className)}
      data-testid={testId}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="selettore__voce"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined ? (
            <span className="selettore__conteggio">{option.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
