import { cx } from "../cx";

export function Spinner({ className }: { className?: string }) {
  return <span className={cx("spinner", className)} aria-hidden="true" />;
}
