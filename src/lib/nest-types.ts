import type { EventVisibility } from "@/lib/calendar";
import type { Lens } from "@/lib/lens";
import type { MemberColor } from "@/components/ui/Avatar/Avatar";

/** A member as the frame shows it: only what is displayed reaches the browser. */
export type NestMember = {
  /** null for members whose name is not shown (4th onwards) */
  name: string | null;
  color: MemberColor;
};

/** The member linked to the signed-in user (lens "Io") */
export type NestSelf = { name: string; color: MemberColor };

/** Lens chosen in the profile, and the visibility a new event starts with */
export type NestPreferences = {
  startLens: Lens;
  defaultVisibility: EventVisibility;
};
