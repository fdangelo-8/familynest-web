import { cx } from "../cx";
import { AvatarPhoto } from "./AvatarPhoto";

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
  /**
   * Photo (`.avatar--foto`). Only at `xl` (72 px): at any other size, or with
   * `dot` or `empty`, the initial on the colour stays. If the photo does not
   * load, the initial comes back.
   */
  photoSrc?: string;
  /**
   * Accessible name when the photo is shown («Foto di Biscotto»); without it
   * the name is used. Ignored with `nameShown`.
   */
  photoAlt?: string;
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
  photoSrc,
  photoAlt,
  className,
  "data-testid": testId,
}: AvatarProps) {
  const initial = dot ? "" : name.trim().charAt(0).toLocaleUpperCase("it-IT");
  const showPhoto = Boolean(photoSrc) && size === "xl" && !dot && !empty;
  return (
    <span
      className={cx(
        "avatar",
        size !== "s" && `avatar--${size}`,
        dot && "avatar--punto",
        empty && "avatar--vuoto",
        showPhoto && "avatar--foto",
        `membro-${color}`,
        className,
      )}
      aria-hidden={nameShown ? true : undefined}
      role={nameShown ? undefined : "img"}
      aria-label={nameShown ? undefined : showPhoto ? (photoAlt ?? name) : name}
      data-testid={testId}
    >
      {showPhoto && photoSrc ? (
        <AvatarPhoto key={photoSrc} src={photoSrc} initial={initial} />
      ) : (
        initial
      )}
    </span>
  );
}
