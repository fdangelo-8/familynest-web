import type { ReactNode } from "react";
import { cx } from "../cx";

export type TagProps = {
  children: ReactNode;
  variant?: "default" | "allerta" | "insieme" | "scura";
  small?: boolean;
  className?: string;
  "data-testid"?: string;
};

/** Text label (`.etichetta`). Never clickable. */
export function Tag({
  children,
  variant = "default",
  small,
  className,
  "data-testid": testId,
}: TagProps) {
  return (
    <span
      className={cx(
        "etichetta",
        variant !== "default" && `etichetta--${variant}`,
        small && "etichetta--piccola",
        className,
      )}
      data-testid={testId}
    >
      {children}
    </span>
  );
}
