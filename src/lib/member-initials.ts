import { DEFAULT_LOCALE, LOCALE_TAGS, toLower, toUpper } from "@/lib/i18n";

/** What `memberInitials` needs of a member of a Nest. */
export type InitialsMember = {
  id: string;
  householdId: string;
  name: string;
  /** `household_members.created_at`: who joined later takes the second letter */
  createdAt: string;
};

const segmenter = new Intl.Segmenter(LOCALE_TAGS[DEFAULT_LOCALE], {
  granularity: "grapheme",
});

const LETTER = /^\p{L}/u;

function graphemes(text: string): string[] {
  return Array.from(segmenter.segment(text), (part) => part.segment);
}

/**
 * First real letter (grapheme) of a name, uppercase: «Élodie» → «É»,
 * «  anna» → «A». Empty when the name is empty.
 */
export function firstInitial(name: string): string {
  const first = graphemes(name.trim())[0];
  return first ? toUpper(first) : "";
}

/**
 * Initials of the members of **one** Nest, as a map from member id to text.
 * Everybody gets the first letter; when it is already taken by someone who
 * joined earlier, whoever comes later gets that letter plus the first next
 * letter of the name that makes the pair unique («Marco», «Miele» → «M»,
 * «Mi»; then «Mia» → «Ma»). If no letter does, first and second letter.
 * The order of the array does not matter: `createdAt`, then `id`.
 * Members of different Nests are an error (the message names nobody).
 */
export function memberInitials(
  members: readonly InitialsMember[],
): Map<string, string> {
  const first = members[0];
  if (first && members.some((m) => m.householdId !== first.householdId)) {
    throw new Error("memberInitials: members of different households");
  }
  const ordered = [...members].sort((a, b) => {
    const byDate = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    if (byDate !== 0 && !Number.isNaN(byDate)) return byDate;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const taken = new Set<string>();
  const result = new Map<string, string>();
  for (const member of ordered) {
    const letters = graphemes(member.name.trim());
    const base = letters[0] ? toUpper(letters[0]) : "";
    let initials = base;
    if (base && taken.has(base)) {
      const rest = letters.slice(1).filter((letter) => LETTER.test(letter));
      const unique = rest
        .map((letter) => base + toLower(letter))
        .find((candidate) => !taken.has(candidate));
      const second = rest[0];
      initials = unique ?? (second ? base + toLower(second) : base);
    }
    taken.add(initials);
    result.set(member.id, initials);
  }
  return result;
}
