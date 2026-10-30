"use client";

import { Avatar, type MemberColor } from "@/components/ui/Avatar/Avatar";
import { Chip, ChipGroup } from "@/components/ui/Chip/Chip";
import { cx } from "@/components/ui/cx";

export type PersonFilterMember = {
  id: string;
  name: string;
  color: MemberColor;
};

/** `"all"`, `"me"` or the id of a member */
export type PersonFilterValue = string;

export type PersonFilterProps = {
  /** The signed-in member ("Miei") */
  me: PersonFilterMember | undefined;
  /** The other members who can be filtered (adults and children), in order */
  others: ReadonlyArray<PersonFilterMember>;
  value: PersonFilterValue;
  onChange: (value: PersonFilterValue) => void;
};

/**
 * "Filtra per persona" chips. One group per layout, same state: the frame
 * renders the mobile one below the switcher and the desktop one in the
 * header, and each is hidden in the other layout.
 */
export function PersonFilter({
  layout,
  me,
  others,
  value,
  onChange,
}: PersonFilterProps & { layout: "mobile" | "desktop" }) {
  return (
    <ChipGroup
      aria-label="Filtra per persona"
      scroll
      className={cx(layout === "mobile" && "casa-solo-mobile")}
      data-testid={`filtro-persona-${layout}`}
    >
      <Chip pressed={value === "all"} onClick={() => onChange("all")}>
        Tutti
      </Chip>
      {me ? (
        <Chip
          person
          pressed={value === "me"}
          onClick={() => onChange("me")}
          leading={<Avatar name={me.name} color={me.color} nameShown />}
        >
          Miei
        </Chip>
      ) : null}
      {others.map((member) => (
        <Chip
          key={member.id}
          person
          pressed={value === member.id}
          onClick={() => onChange(member.id)}
          leading={<Avatar name={member.name} color={member.color} nameShown />}
        >
          {member.name}
        </Chip>
      ))}
    </ChipGroup>
  );
}
