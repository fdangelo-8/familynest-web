import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../Icon/Icon";

type EmptyStateBase = {
  title: string;
  text: string;
  className?: string;
  "data-testid"?: string;
};

export type EmptyStateProps =
  | (EmptyStateBase & {
      variant?: undefined;
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
    })
  | (EmptyStateBase & {
      /**
       * Whole box is the action (`.stato-vuoto-box`): a single link with
       * `href` or a single button with `onClick`.
       */
      variant: "box";
      href: string;
      onClick?: undefined;
    })
  | (EmptyStateBase & {
      variant: "box";
      onClick: () => void;
      href?: undefined;
    });

export function EmptyState(props: EmptyStateProps) {
  const { title, text, className, "data-testid": testId } = props;

  if (props.variant === "box") {
    const content = (
      <>
        <span className="stato-vuoto-box__piu" aria-hidden="true">
          <Icon name="plus" />
        </span>
        <span className="stato-vuoto-box__testo">
          <strong className="stato-vuoto__titolo">{title}</strong>{" "}
          <span className="stato-vuoto__testo">{text}</span>
        </span>
      </>
    );
    return props.href !== undefined ? (
      <Link
        href={props.href}
        className={cx("stato-vuoto-box", className)}
        data-testid={testId}
      >
        {content}
      </Link>
    ) : (
      <button
        type="button"
        className={cx("stato-vuoto-box", className)}
        onClick={props.onClick}
        data-testid={testId}
      >
        {content}
      </button>
    );
  }

  const { actions, after, icon, large } = props;
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
