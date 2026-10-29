"use client";

import { cx } from "../cx";
import { Icon } from "../Icon/Icon";

export type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Required: the box has no visible text */
  "aria-label": string;
  disabled?: boolean;
  /** `"square"` is the checkbox (`.casella`), `"round"` the round tick (`.tondo-spunta`) */
  variant?: "square" | "round";
  className?: string;
  "data-testid"?: string;
};

/** `role="checkbox"` button (`.casella`, or `.tondo-spunta` if round). Click, Space and Enter toggle it. */
export function Checkbox({
  checked,
  onChange,
  disabled,
  variant = "square",
  className,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cx(
        variant === "round" ? "tondo-spunta" : "casella",
        className,
      )}
      onClick={() => onChange(!checked)}
      data-testid={testId}
    >
      <Icon name="check" size="s" />
    </button>
  );
}
