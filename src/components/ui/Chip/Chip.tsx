import type { ReactNode } from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../Icon/Icon";

export type ChipProps = {
  children: ReactNode;
  /** Pressed state. Several chips can be pressed together. */
  pressed?: boolean;
  onClick?: () => void;
  /** Person chip (`.chip--persona`): put an `Avatar` as `leading` */
  person?: boolean;
  leading?: ReactNode;
  icon?: IconName;
  /** Optional count (`.chip__conteggio`) */
  count?: number;
  disabled?: boolean;
  /** Not a button, just a label with chip shape (`.chip--statico`) */
  static?: boolean;
  className?: string;
  "data-testid"?: string;
};

export function Chip({
  children,
  pressed = false,
  onClick,
  person,
  leading,
  icon,
  count,
  disabled,
  static: isStatic,
  className,
  "data-testid": testId,
}: ChipProps) {
  const classes = cx(
    "chip",
    person && "chip--persona",
    isStatic && "chip--statico",
    className,
  );
  const content = (
    <>
      {leading}
      {icon ? <Icon name={icon} size="s" /> : null}
      {children}
      {count !== undefined ? (
        <span className="chip__conteggio">{count}</span>
      ) : null}
    </>
  );

  if (isStatic) {
    return (
      <span className={classes} data-testid={testId}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
    >
      {content}
    </button>
  );
}

export type ChipGroupProps = {
  /** Required accessible name of the group */
  "aria-label": string;
  children: ReactNode;
  /** Single scrolling line (`.gruppo-chip--scorre`) */
  scroll?: boolean;
  className?: string;
  "data-testid"?: string;
};

export function ChipGroup({
  children,
  scroll,
  className,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: ChipGroupProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cx("gruppo-chip", scroll && "gruppo-chip--scorre", className)}
      data-testid={testId}
    >
      {children}
    </div>
  );
}
