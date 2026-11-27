import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar, type AvatarColor } from "../Avatar/Avatar";
import { cx } from "../cx";
import { Icon, type IconName } from "../Icon/Icon";

export type TileAvatar = {
  name: string;
  color: AvatarColor;
  /** Two letters when someone shares the first one (`memberInitials`) */
  initials?: string;
  /** Photo of an animal: shown with the thread of its colour */
  photoSrc?: string;
};

export type TileProps = {
  /** Where the tile goes. Without it the tile is not a link (`variant="pending"`). */
  href?: string;
  /** Bare icon at the top (Spazi) */
  icon?: IconName;
  /** Circle of a person at the top, in place of the icon (the tile of the Nest) */
  avatar?: TileAvatar;
  title: string;
  /** The line under the title («Biscotto e Miele», «9 anni») */
  line?: string;
  /**
   * `pending`: a person not yet in the Nest. Dashed border, quiet background,
   * not a link: no `href`, no focus, no hover. The actions («Manda di
   * nuovo») are put next to it by the page.
   */
  variant?: "pending";
  className?: string;
  "data-testid"?: string;
};

/**
 * Tile (`.tessera`): a link with a thin border, a bare icon (or the circle of
 * a person) at the top, a title and a line. The name of the link comes from
 * its content, title first, then the line («Animali Biscotto e Miele»): an
 * `aria-label` with a comma would not hold the visible text (axe
 * label-content-name-mismatch).
 */
export function Tile({
  href,
  icon,
  avatar,
  title,
  line,
  variant,
  className,
  "data-testid": testId,
}: TileProps) {
  const pending = variant === "pending";
  const classes = cx(
    "tessera",
    avatar && "tessera--persona",
    pending && "tessera--attesa",
    className,
  );
  const content: ReactNode = (
    <>
      {avatar ? (
        <Avatar
          name={avatar.name}
          color={avatar.color}
          initials={avatar.initials}
          size="xl"
          photoSrc={avatar.photoSrc}
          ring
          nameShown
        />
      ) : icon ? (
        <Icon name={icon} size="l" />
      ) : null}
      <span className="tessera__titolo">{title}</span>
      {line ? <span className="tessera__riga">{line}</span> : null}
    </>
  );

  if (pending || href === undefined) {
    return (
      <div className={classes} data-testid={testId}>
        {content}
      </div>
    );
  }
  return (
    <Link href={href} className={classes} data-testid={testId}>
      {content}
    </Link>
  );
}

export type TileGridProps = {
  children: ReactNode;
  /** Four tiles per row, also at 1024 and 1040 px (the Nest, computer form only) */
  columns?: 4;
  className?: string;
  "data-testid"?: string;
};

/**
 * Grid of tiles (`.tessere`): two columns under 900 px or on a short window,
 * from 900 px columns at least 220 px wide.
 */
export function TileGrid({
  children,
  columns,
  className,
  "data-testid": testId,
}: TileGridProps) {
  return (
    <div
      className={cx("tessere", columns === 4 && "tessere--quattro", className)}
      data-testid={testId}
    >
      {children}
    </div>
  );
}
