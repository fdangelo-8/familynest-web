import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { cx } from "../cx";

export type ListProps = {
  children: ReactNode;
  /** On a dark background (`.lista--notte`) */
  night?: boolean;
  className?: string;
  "data-testid"?: string;
};

/** `<ul class="lista">`. Put `ListRow` children inside. */
export function List({
  children,
  night,
  className,
  "data-testid": testId,
}: ListProps) {
  return (
    <ul
      className={cx("lista", night && "lista--notte", className)}
      data-testid={testId}
    >
      {children}
    </ul>
  );
}

export type ListRowProps = {
  children: ReactNode;
  /** Whole row is one link */
  href?: string;
  /** Whole row is one button */
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  /** Adds modifiers such as `riga-lista--fatto` */
  modifier?: string;
  night?: boolean;
  className?: string;
  "data-testid"?: string;
};

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
  "data-testid": testId,
}: ListRowProps) {
  const rowClasses = cx(
    "riga-lista",
    night && "riga-lista--notte",
    modifier,
    className,
  );

  if (href !== undefined) {
    return (
      <li>
        <Link
          href={href}
          className={cx(rowClasses, "riga-lista--cliccabile")}
          data-testid={testId}
        >
          {children}
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
          {children}
        </button>
      </li>
    );
  }

  return (
    <li className={rowClasses} data-testid={testId}>
      {children}
    </li>
  );
}
