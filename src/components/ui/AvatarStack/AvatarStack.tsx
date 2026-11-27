import { it } from "@/lib/i18n/messages/it";
import { t } from "@/lib/i18n";
import { Avatar, type AvatarColor } from "../Avatar/Avatar";
import { cx } from "../cx";

export type AvatarStackPerson = {
  name: string;
  color: AvatarColor;
  /** Two letters when someone shares the first one (`memberInitials`) */
  initials?: string;
};

export type AvatarStackProps = {
  people: readonly AvatarStackPerson[];
  /** Most circles shown before the neutral «+N»; 4 without it */
  max?: number;
  className?: string;
  "data-testid"?: string;
};

/**
 * Pile of avatars (`.pila-avatar`): circles of 28 px overlapped by 8 px with
 * a light ring. Beyond `max` a neutral circle says «+N». It is decoration
 * (`aria-hidden`): the text next to it («Tutti e quattro») is written by the
 * page.
 */
export function AvatarStack({
  people,
  max = 4,
  className,
  "data-testid": testId,
}: AvatarStackProps) {
  const shown = people.slice(0, max);
  const hidden = people.length - shown.length;
  return (
    <span
      className={cx("pila-avatar", className)}
      aria-hidden="true"
      data-testid={testId}
    >
      {shown.map((person, index) => (
        <Avatar
          key={index}
          name={person.name}
          color={person.color}
          initials={person.initials}
          nameShown
        />
      ))}
      {hidden > 0 ? (
        <Avatar
          name=""
          color="neutro"
          initials={t(it.choicesPeople.more, { count: hidden })}
          nameShown
        />
      ) : null}
    </span>
  );
}
