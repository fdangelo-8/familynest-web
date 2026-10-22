"use client";

import { cx } from "../cx";

export type ToggleProps = {
  checked: boolean;
  /** Called right away: a switch has no Save button */
  onChange: (checked: boolean) => void;
  /** Required: the switch has no visible text */
  "aria-label": string;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
};

/** `role="switch"` button (`.toggle`). Click, Space and Enter toggle it. */
export function Toggle({
  checked,
  onChange,
  disabled,
  className,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cx("toggle", className)}
      onClick={() => onChange(!checked)}
      data-testid={testId}
    />
  );
}
