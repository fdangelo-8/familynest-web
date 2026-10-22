import type { MouseEvent } from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../Icon/Icon";

export type IconButtonProps = {
  icon: IconName;
  /** Required: the button has no visible text */
  "aria-label": string;
  /** Square 52 px on paper background (`.btn-icona--carta`) */
  paper?: boolean;
  /** Small 32 px, touch area stays 44 px (`.btn-icona--piccolo`) */
  small?: boolean;
  /** Shows the red dot (`.btn-icona__punto`) */
  dot?: boolean;
  disabled?: boolean;
  /** Toggle state, for example a pinned item */
  pressed?: boolean;
  type?: "button" | "submit";
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  "data-testid"?: string;
};

export function IconButton({
  icon,
  paper,
  small,
  dot,
  disabled,
  pressed,
  type = "button",
  onClick,
  className,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "btn-icona",
        paper && "btn-icona--carta",
        small && "btn-icona--piccolo",
        className,
      )}
      aria-label={ariaLabel}
      disabled={disabled}
      aria-pressed={pressed}
      onClick={onClick}
      data-testid={testId}
    >
      <Icon name={icon} />
      {dot ? <span className="btn-icona__punto" aria-hidden="true" /> : null}
    </button>
  );
}
