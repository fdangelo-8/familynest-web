"use client";

import { useId } from "react";
import { it } from "@/lib/i18n/messages/it";
import { firstInitial } from "@/lib/member-initials";
import { memberColorClass } from "@/lib/member-colors";
import type { AvatarColor } from "../Avatar/Avatar";
import { cx } from "../cx";
import { Icon } from "../Icon/Icon";
import { Skeleton } from "../Skeleton/Skeleton";
import { VisuallyHidden } from "../VisuallyHidden/VisuallyHidden";

export type PickerPerson = {
  id: string;
  name: string;
  color: AvatarColor;
  /** Two letters when someone shares the first one (`memberInitials`) */
  initials?: string;
};

export type PersonPickerProps = {
  /** Accessible name of the group («Per chi») */
  label: string;
  people: readonly PickerPerson[];
  /** Ids of the chosen people. More than one can be chosen together. */
  value: readonly string[];
  /** New chosen ids, in the order of `people` */
  onChange: (ids: string[]) => void;
  /** Six skeleton circles instead of the people */
  loading?: boolean;
  /** Error text under the circles, with a sign and words */
  error?: string;
  className?: string;
  "data-testid"?: string;
};

const SKELETON_COUNT = 6;

/**
 * «Per chi»: a line of circles (36 px, touch area 44) with the initial of each
 * person, animals included (`.scelta-persone`). Not chosen: soft colour with
 * the initial in ink; chosen: the person's colour with an ink ring. The line
 * wraps, it never scrolls. Each circle is a toggle named after the person.
 */
export function PersonPicker({
  label,
  people,
  value,
  onChange,
  loading,
  error,
  className,
  "data-testid": testId,
}: PersonPickerProps) {
  const id = useId();
  const errorId = error ? `${id}-errore` : undefined;

  function toggle(personId: string) {
    const next = new Set(value);
    if (next.has(personId)) next.delete(personId);
    else next.add(personId);
    onChange(people.filter((person) => next.has(person.id)).map((p) => p.id));
  }

  return (
    <div className="scelta-campo">
      <div
        role="group"
        aria-label={label}
        aria-busy={loading ? true : undefined}
        aria-describedby={errorId}
        className={cx("scelta-persone", className)}
        data-testid={testId}
      >
        {loading ? (
          <>
            {Array.from({ length: SKELETON_COUNT }, (_, index) => (
              <Skeleton key={index} shape="cerchio" />
            ))}
            <VisuallyHidden>{it.loading}</VisuallyHidden>
          </>
        ) : (
          people.map((person) => (
            <button
              key={person.id}
              type="button"
              className={cx(
                "scelta-persone__pallino",
                memberColorClass(person.color),
              )}
              aria-pressed={value.includes(person.id)}
              aria-label={person.name}
              // The letters are drawn by CSS (`::after`, from this attribute),
              // not written in the button: the name is the person's name and
              // two letters («Mi») are not a piece of it (axe
              // label-content-name-mismatch).
              data-initials={
                person.initials?.trim() || firstInitial(person.name)
              }
              onClick={() => toggle(person.id)}
            />
          ))
        )}
      </div>
      {error ? (
        <p className="campo__errore" id={errorId}>
          <Icon name="circle-alert" size="s" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
