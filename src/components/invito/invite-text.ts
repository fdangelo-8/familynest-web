import type { ChoosableColor } from "@/components/ui/ColorChoice/ColorChoice";
import { calendarDaysUntil, formatTime } from "@/lib/datetime";

/** Pure texts and choices of the invitation pages (#16). Nothing here touches the network. */

/** Another member as the public welcome page knows it: initial and colour, no name. */
export type PublicMember = { initial: string; color: ChoosableColor };

export type AvatarItem =
  | { kind: "member"; initial: string; color: ChoosableColor }
  | { kind: "more"; count: number };

/** At most 4 members are drawn; from 5 on, the first 3 and a «+N» circle (always 5 circles with the «?»). */
export function avatarItems(
  members: ReadonlyArray<PublicMember>,
): AvatarItem[] {
  const toItem = (m: PublicMember): AvatarItem => ({
    kind: "member",
    initial: m.initial,
    color: m.color,
  });
  if (members.length <= 4) return members.map(toItem);
  return [
    ...members.slice(0, 3).map(toItem),
    { kind: "more", count: members.length - 3 },
  ];
}

/**
 * Accessible name of the avatar group. It never lists names of anyone but the
 * person who invites (decision D-1). `null` when there is nobody but the «?».
 */
export function avatarGroupLabel(
  inviterName: string | null,
  total: number,
): string | null {
  if (total <= 0) return null;
  if (!inviterName) return `Già nel Nest: ${total}`;
  const others = total - 1;
  if (others === 0) return inviterName;
  if (others === 1) return `${inviterName} e un altro nel Nest`;
  return `${inviterName} e altri ${others} nel Nest`;
}

/** First line of the claim: «Marco ti aspetta» / «Ti aspettano». */
export function claimLead(inviterName: string | null): string {
  return inviterName ? `${inviterName} ti aspetta` : "Ti aspettano";
}

/** Validity sentence, days counted in Rome. From the last day on it gives the time. */
export function expiryLead(expiresAt: string, now: Date = new Date()): string {
  const days = calendarDaysUntil(expiresAt, now);
  if (days >= 2) return `Invito valido ancora ${days} giorni.`;
  const time = formatTime(expiresAt);
  return days === 1
    ? `Invito valido fino a domani alle ${time}.`
    : `Invito valido fino a oggi alle ${time}.`;
}

/** Message as saved, with line breaks turned into spaces. */
export function oneLine(message: string): string {
  return message.replace(/\s*[\r\n]+\s*/g, " ").trim();
}

const ARTICLES: Record<ChoosableColor, string> = {
  pomodoro: "il pomodoro",
  glicine: "il glicine",
  salvia: "la salvia",
  cobalto: "il cobalto",
  zafferano: "lo zafferano",
  lampone: "il lampone",
  ceruleo: "il ceruleo",
  peonia: "la peonia",
  basilico: "il basilico",
  cannella: "la cannella",
};

/** «il glicine», «la salvia», «lo zafferano»… */
export function colorWithArticle(color: ChoosableColor): string {
  return ARTICLES[color];
}

/** Help under the colours; it does not change when another colour is chosen. */
export function colorHelp(
  inviterName: string | null,
  color: ChoosableColor,
): string {
  const given = inviterName
    ? `${inviterName} ti aveva dato ${colorWithArticle(color)}.`
    : `Ti era stato dato ${colorWithArticle(color)}.`;
  return `${given} I colori spenti sono già di qualcun altro.`;
}
