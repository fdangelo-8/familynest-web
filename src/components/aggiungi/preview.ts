import type { MemberColor } from "../ui/Avatar/Avatar";
import type { HouseholdEvent } from "../../lib/household-events";
import { atTime, joinNames } from "./labels";
import type { PhraseSlot } from "./parse-phrase";

/** Pure rule behind the «chi accompagna?» notice (#20). The preview column is gone (#333). */

export type NestPerson = {
  id: string;
  name: string;
  color: MemberColor;
  kind: "adult" | "child" | "pet";
  userId: string | null;
};

/**
 * The notice «Laura ha un impegno fino alle 17:15: chi accompagna Sofia?».
 * It shows when the new event has a child, nobody is set to accompany (never,
 * in this version) and an adult is busy while it lasts. Busy means: taking part
 * in or accompanying an event the reader sees, or being the author of an
 * «Occupato». Never the title of somebody else's event.
 */
export function escortNotice(args: {
  events: readonly HouseholdEvent[];
  members: readonly NestPerson[];
  meId: string | null;
  participantIds: readonly string[];
  slot: PhraseSlot;
}): string | null {
  const { events, members, meId, participantIds, slot } = args;
  const children = members.filter(
    (member) => member.kind === "child" && participantIds.includes(member.id),
  );
  if (children.length === 0) return null;

  const from = slot.startsAt.getTime();
  const to = slot.endsAt.getTime();
  const overlapping = events.filter(
    (event) =>
      new Date(event.startsAt).getTime() < to &&
      new Date(event.endsAt).getTime() > from,
  );

  for (const adult of members) {
    if (adult.kind !== "adult") continue;
    let lastEnd: number | null = null;
    for (const event of overlapping) {
      const busy = event.masked
        ? event.authorMemberId === adult.id
        : event.memberIds.includes(adult.id) ||
          event.escortMemberId === adult.id ||
          (event.visibility === "busy" && event.authorMemberId === adult.id);
      if (!busy) continue;
      const end = new Date(event.endsAt).getTime();
      if (lastEnd === null || end > lastEnd) lastEnd = end;
    }
    if (lastEnd === null) continue;
    const subject =
      adult.id === meId ? "Hai un impegno" : `${adult.name} ha un impegno`;
    return `${subject} fino ${atTime(lastEnd)}: chi accompagna ${joinNames(children.map((c) => c.name))}?`;
  }
  return null;
}
