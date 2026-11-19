import type { ReactNode, Ref } from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../Icon/Icon";

export type ChipProps = {
  children: ReactNode;
  /** Pressed state. Several chips can be pressed together. Ignored with `action`. */
  pressed?: boolean;
  /**
   * Plain action button: looks like an unpressed chip and has no
   * `aria-pressed`. For a button whose name already says its state.
   */
  action?: boolean;
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
  /**
   * Full accessible name, when the visible text is short («Lun» → «Lun,
   * lunedì»). It must start with the whole visible text.
   */
  "aria-label"?: string;
  /** Ref of the `<button>` (not used with `static`), to move the focus to it */
  buttonRef?: Ref<HTMLButtonElement>;
  className?: string;
  "data-testid"?: string;
};

export function Chip({
  children,
  pressed = false,
  action,
  onClick,
  person,
  leading,
  icon,
  count,
  disabled,
  static: isStatic,
  "aria-label": ariaLabel,
  buttonRef,
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
      ref={buttonRef}
      type="button"
      className={classes}
      aria-label={ariaLabel}
      aria-pressed={action ? undefined : pressed}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
    >
      {content}
    </button>
  );
}

export type ChipGroupProps = {
  /** Accessible name of the group: this or `aria-labelledby` */
  "aria-label"?: string;
  /** `id` of the visible label of the group (`WeekdayPicker`) */
  "aria-labelledby"?: string;
  /** `id` of the hint or the error of the group */
  "aria-describedby"?: string;
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
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
  "data-testid": testId,
}: ChipGroupProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={cx("gruppo-chip", scroll && "gruppo-chip--scorre", className)}
      data-testid={testId}
    >
      {children}
    </div>
  );
}
