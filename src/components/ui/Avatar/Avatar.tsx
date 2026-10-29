import { cx } from "../cx";

export const MEMBER_COLORS = [
  "pomodoro",
  "glicine",
  "salvia",
  "cobalto",
  "zafferano",
  "lampone",
  "ceruleo",
  "peonia",
  "basilico",
  "cannella",
  "insieme",
] as const;

export type MemberColor = (typeof MEMBER_COLORS)[number];

export type AvatarProps = {
  /** Used for the initial (first letter, uppercase) and the accessible name */
  name: string;
  color: MemberColor;
  /** xs 18 px, s 24 px (default), m 32 px, l 44 px, xl 72 px */
  size?: "xs" | "s" | "m" | "l" | "xl";
  /** 9 px dot without letter */
  dot?: boolean;
  /** Dashed empty avatar (`.avatar--vuoto`) */
  empty?: boolean;
  /** True when the name is written next to the avatar: the avatar is then decorative */
  nameShown?: boolean;
  className?: string;
  "data-testid"?: string;
};

export function Avatar({
  name,
  color,
  size = "s",
  dot,
  empty,
  nameShown = false,
  className,
  "data-testid": testId,
}: AvatarProps) {
  const initial = dot ? "" : name.trim().charAt(0).toLocaleUpperCase("it-IT");
  return (
    <span
      className={cx(
        "avatar",
        size !== "s" && `avatar--${size}`,
        dot && "avatar--punto",
        empty && "avatar--vuoto",
        `membro-${color}`,
        className,
      )}
      aria-hidden={nameShown ? true : undefined}
      role={nameShown ? undefined : "img"}
      aria-label={nameShown ? undefined : name}
      data-testid={testId}
    >
      {initial}
    </span>
  );
}
