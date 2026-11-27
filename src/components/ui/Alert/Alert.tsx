import type { ReactNode, Ref } from "react";
import { it } from "@/lib/i18n/messages/it";
import { cx } from "../cx";
import { Icon, type IconName } from "../Icon/Icon";

export type AlertVariant = "errore" | "avviso" | "info" | "ok" | "offline";

const VARIANT_ICON: Record<AlertVariant, IconName> = {
  errore: "circle-alert",
  avviso: "triangle-alert",
  info: "info",
  ok: "check",
  offline: "wifi-off",
};

type AlertBase = {
  children: ReactNode;
  /**
   * Words in bold before the text («Sei offline.»). With `offline` it
   * defaults to the message of `it.ts`.
   */
  lead?: string;
  /** Optional sprite icon name; when missing the icon of the variant is used */
  icon?: IconName;
  /** Live region role: `alert` (default for errors) or `status` (default for the others) */
  role?: "alert" | "status";
  /** Ref of the box, to move the focus to it (with `tabIndex={-1}`) */
  alertRef?: Ref<HTMLDivElement>;
  /** `-1` lets the code focus the box without adding a tab stop */
  tabIndex?: -1;
  className?: string;
  "data-testid"?: string;
};

export type AlertProps = AlertBase &
  (
    | {
        variant: Exclude<AlertVariant, "offline">;
        /** Optional action on the right, for example a "Riprova" button */
        action?: ReactNode;
      }
    | {
        /**
         * No connection: stays on top while the page scrolls, has no
         * «Riprova» (the app retries by itself).
         */
        variant: "offline";
        action?: undefined;
      }
  );

/** Icon, sentence and optional action (`.avviso`). `role="alert"` only for errors. */
export function Alert({
  variant,
  children,
  lead,
  icon,
  action,
  role,
  alertRef,
  tabIndex,
  className,
  "data-testid": testId,
}: AlertProps) {
  const shownLead =
    lead ?? (variant === "offline" ? it.offlineLead : undefined);
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
      <span className="avviso__testo">
        {shownLead ? <b>{shownLead}</b> : null}
        {shownLead ? " " : null}
        {children}
      </span>
      {action}
    </div>
  );
}
