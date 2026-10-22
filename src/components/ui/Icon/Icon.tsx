import { cx } from "../cx";
import type { IconName } from "./icon-paths";

export type { IconName };

export type IconProps = {
  name: IconName;
  /** s = 16 px, m = 20 px (default), l = 24 px */
  size?: "s" | "m" | "l";
  className?: string;
};

export function Icon({ name, size = "m", className }: IconProps) {
  return (
    <svg
      className={cx(
        "icona",
        size === "s" && "icona--s",
        size === "l" && "icona--l",
        className,
      )}
      aria-hidden="true"
      focusable="false"
    >
      <use href={`#i-${name}`} />
    </svg>
  );
}
