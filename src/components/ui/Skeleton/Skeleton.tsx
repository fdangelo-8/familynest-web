import type { ReactNode } from "react";
import { cx } from "../cx";
import { VisuallyHidden } from "../VisuallyHidden/VisuallyHidden";

export type SkeletonShape =
  "testo" | "testo-corto" | "titolo" | "riga" | "scheda" | "cerchio" | "grande";

export type SkeletonProps = {
  shape?: SkeletonShape;
  /** On a dark background (`.skeleton--notte`) */
  night?: boolean;
  className?: string;
};

/** Placeholder with the shape of the content to come. Decorative. */
export function Skeleton({ shape = "testo", night, className }: SkeletonProps) {
  return (
    <div
      className={cx(
        "skeleton",
        `skeleton--${shape}`,
        night && "skeleton--notte",
        className,
      )}
      aria-hidden="true"
    />
  );
}

export type SkeletonGroupProps = {
  children: ReactNode;
  /** Hidden text read by screen readers */
  label?: string;
  className?: string;
  "data-testid"?: string;
};

export function SkeletonGroup({
  children,
  label = "Caricamento in corso",
  className,
  "data-testid": testId,
}: SkeletonGroupProps) {
  return (
    <div
      className={cx("gruppo-skeleton", className)}
      aria-busy="true"
      data-testid={testId}
    >
      <VisuallyHidden>{label}</VisuallyHidden>
      {children}
    </div>
  );
}
