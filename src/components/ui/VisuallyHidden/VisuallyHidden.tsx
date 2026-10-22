import type { ReactNode } from "react";
import { cx } from "../cx";

export function VisuallyHidden({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cx("visivamente-nascosto", className)}>{children}</span>
  );
}
