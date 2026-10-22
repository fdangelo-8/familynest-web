import type { MemberColor } from "@/components/ui/Avatar/Avatar";

/** What the app frame knows about a member: name and color only. */
export type NestMember = {
  name: string;
  color: MemberColor;
  /** True for the member linked to the signed-in user */
  isMe: boolean;
};
