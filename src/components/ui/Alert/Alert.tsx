import type { ReactNode } from "react";
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
  className?: string;
  "data-testid"?: string;
};

/** Icon, sentence and optional action (`.avviso`). `role="alert"` only for errors. */
export function Alert({
  variant,
  children,
  icon,
  action,
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
      role={variant === "errore" ? "alert" : "status"}
      data-testid={testId}
    >
      <Icon name={icon ?? VARIANT_ICON[variant]} />
      <span className="avviso__testo">{children}</span>
      {action}
    </div>
  );
}
