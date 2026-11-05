import type { ReactNode, Ref } from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../Icon/Icon";

export type AlertVariant = "errore" | "avviso" | "info" | "ok";

const VARIANT_ICON: Record<AlertVariant, IconName> = {
  errore: "circle-alert",
  avviso: "triangle-alert",
  info: "info",
  ok: "check",
};

export type AlertProps = {
  variant: AlertVariant;
  children: ReactNode;
  /** Optional sprite icon name; when missing the icon of the variant is used */
  icon?: IconName;
  /** Optional action on the right, for example a "Riprova" button */
  action?: ReactNode;
  /** Live region role: `alert` (default for errors) or `status` (default for the others) */
  role?: "alert" | "status";
  /** Ref of the box, to move the focus to it (with `tabIndex={-1}`) */
  alertRef?: Ref<HTMLDivElement>;
  /** `-1` lets the code focus the box without adding a tab stop */
  tabIndex?: -1;
  className?: string;
  "data-testid"?: string;
};

/** Icon, sentence and optional action (`.avviso`). `role="alert"` only for errors. */
export function Alert({
  variant,
  children,
  icon,
  action,
  role,
  alertRef,
  tabIndex,
  className,
  "data-testid": testId,
}: AlertProps) {
  return (
    <div
      className={cx(
        "avviso",
        `avviso--${variant}`,
        !action && "avviso--senza-azione",
        className,
      )}
      ref={alertRef}
      role={role ?? (variant === "errore" ? "alert" : "status")}
      tabIndex={tabIndex}
      data-testid={testId}
    >
      <Icon name={icon ?? VARIANT_ICON[variant]} />
      <span className="avviso__testo">{children}</span>
      {action}
    </div>
  );
}
