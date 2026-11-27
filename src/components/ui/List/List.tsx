import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { it } from "@/lib/i18n/messages/it";
import { Button } from "../Button/Button";
import { cx } from "../cx";
import { Icon, type IconName } from "../Icon/Icon";
import { VisuallyHidden } from "../VisuallyHidden/VisuallyHidden";

export type ListProps = {
  children: ReactNode;
  /** On a dark background (`.lista--notte`) */
  night?: boolean;
  /**
   * Flush list (`.lista--flush`, Components 2.0): no card, no shadow, a thin
   * line between the rows.
   */
  flush?: boolean;
  className?: string;
  "data-testid"?: string;
};

/** `<ul class="lista">`. Put `ListRow` children inside. */
export function List({
  children,
  night,
  flush,
  className,
  "data-testid": testId,
}: ListProps) {
  return (
    <ul
      className={cx(
        "lista",
        night && "lista--notte",
        flush && "lista--flush",
        className,
      )}
      data-testid={testId}
    >
      {children}
    </ul>
  );
}

type ListRowBase = {
  /** Free content. Not used when `title` is given. */
  children?: ReactNode;
  /** Adds modifiers such as `riga-lista--fatto` */
  modifier?: string;
  night?: boolean;
  className?: string;
  "data-testid"?: string;
  /**
   * Row 2.0: title (600 when the row leads somewhere, 400 when it stays
   * still) and, under it, `text` in the secondary colour.
   */
  title?: string;
  text?: string;
  /** Bare icon on the left, 24 px */
  icon?: IconName;
  /** `danger`: title and icon in the alert colour («Togli Laura dal Nest») */
  tone?: "danger";
  /** Current value on the right, before the arrow (quick choice) */
  value?: string;
};

export type ListRowProps = ListRowBase &
  (
    | {
        /** Whole row is one link */
        href: string;
        onClick?: undefined;
        /** Thin arrow B at the end (the row leads somewhere) */
        arrow?: boolean;
        /** Circle with a plus in place of the icon */
        add?: boolean;
        trailing?: undefined;
      }
    | {
        href?: undefined;
        /** Whole row is one button */
        onClick: (event: MouseEvent<HTMLElement>) => void;
        arrow?: boolean;
        add?: boolean;
        trailing?: undefined;
      }
    | {
        href?: undefined;
        onClick?: undefined;
        arrow?: undefined;
        add?: undefined;
        /**
         * A control on the right, for example a `Toggle`. Only on a row that
         * stays still: never an interactive element inside another.
         */
        trailing?: ReactNode;
      }
  );

/**
 * `<li class="riga-lista">`. With `href` or `onClick` the whole row is a single
 * `<a>` or `<button>`. A row that holds a control (checkbox, switch) must not
 * be clickable: never put an interactive element inside another.
 */
export function ListRow({
  children,
  href,
  onClick,
  modifier,
  night,
  className,
  title,
  text,
  icon,
  tone,
  value,
  arrow,
  add,
  trailing,
  "data-testid": testId,
}: ListRowProps) {
  const interactive = href !== undefined || onClick !== undefined;
  const rowClasses = cx(
    "riga-lista",
    night && "riga-lista--notte",
    title !== undefined && "riga-lista--2",
    tone === "danger" && "riga-lista--pericolo",
    modifier,
    className,
  );

  const content =
    title !== undefined ? (
      <>
        {add ? (
          <span className="riga-lista__piu" aria-hidden="true">
            <Icon name="plus" size="s" />
          </span>
        ) : icon ? (
          <Icon name={icon} size="l" className="riga-lista__icona" />
        ) : null}
        <span className="riga-lista__testo">
          <span className="riga-lista__titolo">{title}</span>
          {text ? <span className="riga-lista__info">{text}</span> : null}
        </span>
        {value ? <span className="riga-lista__valore">{value}</span> : null}
        {interactive && arrow ? (
          <Icon name="chevron-right" className="riga-lista__freccia" />
        ) : null}
        {!interactive ? trailing : null}
      </>
    ) : (
      children
    );

  if (href !== undefined) {
    return (
      <li>
        <Link
          href={href}
          className={cx(rowClasses, "riga-lista--cliccabile")}
          data-testid={testId}
        >
          {content}
        </Link>
      </li>
    );
  }

  if (onClick) {
    return (
      <li>
        <button
          type="button"
          className={cx(rowClasses, "riga-lista--cliccabile")}
          onClick={onClick}
          data-testid={testId}
        >
          {content}
        </button>
      </li>
    );
  }

  return (
    <li className={rowClasses} data-testid={testId}>
      {content}
    </li>
  );
}

/**
 * «Dato che si cambia» (`.riga-dato`): label on top, value below and a
 * «Modifica» link on the right. The accessible name of the link is «Modifica »
 * followed by the label («Modifica Nome»): it starts with the visible text.
 */
export function ValueRow({
  label,
  value,
  onEdit,
  editHref,
  className,
  "data-testid": testId,
}: {
  label: string;
  value: string;
  className?: string;
  "data-testid"?: string;
} & (
  | { onEdit: () => void; editHref?: undefined }
  | { editHref: string; onEdit?: undefined }
)) {
  const name = (
    <>
      {it.edit} <VisuallyHidden>{label}</VisuallyHidden>
    </>
  );
  return (
    <li className={cx("riga-dato", className)} data-testid={testId}>
      <span className="riga-dato__testo">
        <span className="riga-dato__etichetta">{label}</span>
        <span className="riga-dato__valore">{value}</span>
      </span>
      {editHref !== undefined ? (
        <Button variant="link" href={editHref}>
          {name}
        </Button>
      ) : (
        <Button variant="link" onClick={onEdit}>
          {name}
        </Button>
      )}
    </li>
  );
}
