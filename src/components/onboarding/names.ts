/** Rules for the person's name and the Nest name (issue #12, section 4). */

const MAX_MEMBER_NAME = 40;
const MAX_NEST_NAME = 60;

/** Cuts to `max` characters (code points, like Postgres) and trims the end. */
function cut(text: string, max: number): string {
  return Array.from(text).slice(0, max).join("").trimEnd();
}

/** First word = first name, everything after it = surname. */
export function splitName(displayName: string | null | undefined): {
  firstName: string;
  surname: string;
} {
  const words = (displayName ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: words[0] ?? "",
    surname: words.slice(1).join(" "),
  };
}

export function greeting(displayName: string | null | undefined): string {
  const { firstName } = splitName(displayName);
  return firstName ? `Ciao ${firstName}` : "Ciao";
}

export function memberNameFor(displayName: string | null | undefined): string {
  const { firstName } = splitName(displayName);
  return cut(firstName, MAX_MEMBER_NAME) || "Io";
}

export function nestNameFor(displayName: string | null | undefined): string {
  const { firstName, surname } = splitName(displayName);
  if (surname) return cut(`Casa ${surname}`, MAX_NEST_NAME);
  if (firstName) return cut(`Casa di ${firstName}`, MAX_NEST_NAME);
  return "Casa mia";
}
