import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../Icon/Icon";
import { Spinner } from "../Spinner/Spinner";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "chiaro"
  | "tenue"
  | "tratteggiato"
  | "link"
  | "link-secondario"
  | "pericolo"
  | "pericolo-pieno";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  chiaro: "btn-chiaro",
  tenue: "btn-tenue",
  tratteggiato: "btn-tratteggiato",
  link: "btn-link",
  "link-secondario": "btn-link btn-link--secondario",
  pericolo: "btn-pericolo",
  "pericolo-pieno": "btn-pericolo-pieno",
};

export type ButtonProps = {
  variant?: ButtonVariant;
  /** Full width (`.btn--pieno`) */
  full?: boolean;
  /** Smaller button (`.btn--piccolo`) */
  small?: boolean;
  /** Primary button with the arrow box on the right (`.btn-primary--freccia`) */
  arrow?: boolean;
  /** Icon of the arrow box with `arrow` (default `arrow-right`) */
  arrowIcon?: IconName;
  /** Optional icon on the left */
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** Inactive but still focusable and announced (`aria-disabled`), e.g. while another action runs */
  inactive?: boolean;
  /** With `href` the button is a link */
  href?: string;
  type?: "button" | "submit";
  /** `id` of a form the button submits, when it sits outside that form */
  form?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  className?: string;
  children: ReactNode;
  "data-testid"?: string;
};

export function Button({
  variant = "primary",
  full,
  small,
  arrow,
  arrowIcon = "arrow-right",
  icon,
  loading = false,
  disabled = false,
  inactive: inactiveProp = false,
  href,
  type = "button",
  form,
  onClick,
  className,
  children,
  "data-testid": testId,
}: ButtonProps) {
  const inactive = disabled || loading || inactiveProp;
  const classes = cx(
    VARIANT_CLASS[variant],
    full && "btn--pieno",
    small && "btn--piccolo",
    arrow && "btn-primary--freccia",
    loading && "is-caricamento",
    className,
  );

  const content = (
    <>
      {loading && !arrow ? <Spinner /> : icon ? <Icon name={icon} /> : null}
      <span className="btn__testo">{children}</span>
      {arrow ? (
        <span className="btn__icona-box">
          {loading ? <Spinner /> : <Icon name={arrowIcon} />}
        </span>
      ) : null}
    </>
  );

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (inactive) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  if (href !== undefined) {
    return (
      <Link
        href={href}
        className={classes}
        aria-busy={loading || undefined}
        aria-disabled={inactive || undefined}
        tabIndex={disabled ? -1 : undefined}
        onClick={handleClick}
        data-testid={testId}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      form={form}
      className={classes}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || inactiveProp || undefined}
      onClick={handleClick}
      data-testid={testId}
    >
      {content}
    </button>
  );
}
