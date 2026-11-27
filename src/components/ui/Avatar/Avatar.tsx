import { cx } from "../cx";
import { safeImageSrc } from "@/lib/safe-image-src";
import { firstInitial } from "@/lib/member-initials";
import { memberColorClass, MEMBER_COLOR_CODES } from "@/lib/member-colors";
import { AvatarPhoto } from "./AvatarPhoto";

export const MEMBER_COLORS = [...MEMBER_COLOR_CODES, "insieme"] as const;

export type MemberColor = (typeof MEMBER_COLORS)[number];

/**
 * Colours an `Avatar` can have: the ones of a member plus `"neutro"`, the
 * single colour of helpers and of whoever has none (F4b). `"neutro"` is
 * never a colour a person can choose, so `MemberColor`, the list that pages
 * validate against and `ColorChoice` do not have it.
 */
export type AvatarColor = MemberColor | "neutro";

export type AvatarProps = {
  /** Used for the initial (first letter, uppercase) and the accessible name */
  name: string;
  color: AvatarColor;
  /**
   * Text of the circle when two people share the first letter («Mi»):
   * `memberInitials`. Without it, the first letter of the name. At `xs` only
   * its first letter is shown.
   */
  initials?: string;
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
  /** Thread of the colour around the photo (`.avatar--filo`, an animal with a photo) */
  ring?: boolean;
  className?: string;
  "data-testid"?: string;
};

export function Avatar({
  name,
  color,
  initials,
  size = "s",
  dot,
  empty,
  nameShown = false,
  photoSrc,
  photoAlt,
  ring,
  className,
  "data-testid": testId,
}: AvatarProps) {
  const text = initials?.trim() || firstInitial(name);
  const initial = dot ? "" : size === "xs" ? firstInitial(text) : text;
  const safePhoto = safeImageSrc(photoSrc);
  const showPhoto = Boolean(safePhoto) && size === "xl" && !dot && !empty;
  return (
    <span
      className={cx(
        "avatar",
        size !== "s" && `avatar--${size}`,
        dot && "avatar--punto",
        empty && "avatar--vuoto",
        showPhoto && "avatar--foto",
        showPhoto && ring && "avatar--filo",
        memberColorClass(color),
        className,
      )}
      aria-hidden={nameShown ? true : undefined}
      role={nameShown ? undefined : "img"}
      aria-label={nameShown ? undefined : showPhoto ? (photoAlt ?? name) : name}
      data-testid={testId}
    >
      {showPhoto && safePhoto ? (
        <AvatarPhoto key={safePhoto} src={safePhoto} initial={initial} />
      ) : (
        initial
      )}
    </span>
  );
}
