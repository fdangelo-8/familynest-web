import type { ReactNode } from "react";
import { cx } from "../cx";

export type CardProps = {
  children: ReactNode;
  /** Paper background, no border (`.scheda--carta`) */
  paper?: boolean;
  /** Black thread on top (`.scheda--evidenza`) */
  highlight?: boolean;
  /** Inner padding (`.scheda--imbottita`) */
  padded?: boolean;
  /** Dark card (`.scheda--scura`) */
  dark?: boolean;
  /** Dashed, empty card (`.scheda--tratteggiata`) */
  dashed?: boolean;
  className?: string;
  "data-testid"?: string;
};

/** Plain container (`.scheda`): no role, no shadow. */
export function Card({
  children,
  paper,
  highlight,
  padded,
  dark,
  dashed,
  className,
  "data-testid": testId,
}: CardProps) {
  return (
    <div
      className={cx(
        "scheda",
        paper && "scheda--carta",
        highlight && "scheda--evidenza",
        padded && "scheda--imbottita",
        dark && "scheda--scura",
        dashed && "scheda--tratteggiata",
        className,
      )}
      data-testid={testId}
    >
      {children}
    </div>
  );
}
