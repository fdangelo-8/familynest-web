/** A piece of a title: with `mark` it is one of the words looked for. */
export type TitlePart = { text: string; mark: boolean };

/**
 * Splits a title in the pieces that match the words looked for (issue #40):
 * case and accents are ignored when comparing, but the pieces keep the
 * letters of the title («Caffè» for «caffe»). `words` are already lowercase
 * and without accents.
 */
export function highlightParts(
  title: string,
  words: readonly string[],
): TitlePart[] {
  const wanted = words.filter((word) => word !== "");
  if (wanted.length === 0 || title === "") {
    return [{ text: title, mark: false }];
  }

  // The title without accents and in lowercase, and for every letter of it
  // where that letter starts and ends in the original title.
  let plain = "";
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 0;
  for (const char of title) {
    const folded = char.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    for (let index = 0; index < folded.length; index += 1) {
      starts.push(offset);
      ends.push(offset + char.length);
    }
    plain += folded;
    offset += char.length;
  }

  const ranges: Array<[number, number]> = [];
  for (const word of wanted) {
    let from = 0;
    for (;;) {
      const at = plain.indexOf(word, from);
      if (at < 0) break;
      const first = starts[at];
      const last = ends[at + word.length - 1];
      if (first !== undefined && last !== undefined) ranges.push([first, last]);
      from = at + word.length;
    }
  }
  if (ranges.length === 0) return [{ text: title, mark: false }];

  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }

  const parts: TitlePart[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) {
      parts.push({ text: title.slice(cursor, start), mark: false });
    }
    parts.push({ text: title.slice(start, end), mark: true });
    cursor = end;
  }
  if (cursor < title.length) {
    parts.push({ text: title.slice(cursor), mark: false });
  }
  return parts;
}
