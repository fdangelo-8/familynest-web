import type { ReactNode } from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../Icon/Icon";

export type EmptyStateProps = {
  title: string;
  text: string;
  /**
   * At least one action is required. In the default variant it is an inline
   * link or button after the text; in the large variant it is a list of buttons.
   */
  actions: ReactNode;
  /** Default variant only: text right after the action (for example ".") */
  after?: string;
  /** Optional icon (default variant only) */
  icon?: IconName;
  /** Large variant (`.stato-vuoto--grande`), no icon */
  large?: boolean;
  className?: string;
  "data-testid"?: string;
};

export function EmptyState({
  title,
  text,
  actions,
  after,
  icon,
  large,
  className,
  "data-testid": testId,
}: EmptyStateProps) {
  if (large) {
    return (
      <div
        className={cx("stato-vuoto", "stato-vuoto--grande", className)}
        data-testid={testId}
      >
        <strong className="stato-vuoto__titolo">{title}</strong>
        <p className="stato-vuoto__testo">{text}</p>
        <div className="stato-vuoto__azioni">{actions}</div>
      </div>
    );
  }

  return (
    <div className={cx("stato-vuoto", className)} data-testid={testId}>
      {icon ? (
        <span className="stato-vuoto__icona">
          <Icon name={icon} />
        </span>
      ) : null}
      <span>
        <strong className="stato-vuoto__titolo">{title}</strong>
        <span className="stato-vuoto__testo">
          {text} {actions}
          {after}
        </span>
      </span>
    </div>
  );
}
