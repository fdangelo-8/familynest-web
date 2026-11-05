/**
 * The words of the wish list shared by the page of the parents (#32) and the
 * public page (#33): one place, so the two never differ (lessons of #193).
 * Pure functions, no React, usable on server and client.
 */

const euroNumber = new Intl.NumberFormat("it-IT");
const euroNumberWithCents = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Price of an idea: euros without decimals when whole («18 €»), else with two
 * («24,90 €»). `null`, zero, negative or not a whole number of cents give an
 * empty string: no price, nothing shown.
 */
export function formatWishlistPrice(cents: number | null | undefined): string {
  if (cents == null || !Number.isInteger(cents) || cents <= 0) return "";
  const euros = cents / 100;
  const text =
    cents % 100 === 0
      ? euroNumber.format(euros)
      : euroNumberWithCents.format(euros);
  return `${text} €`;
}

/** First letter in lower case: «Lo vuole tanto» -> «lo vuole tanto». */
function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * Line under the title of an idea: «<shop> · <note>» with the first letter
 * of the note in lower case when there are both («Feltrinelli · lo vuole
 * tanto»); only the shop, or only the note as written; empty string when
 * there is neither.
 */
export function wishlistInfoLine(
  shopName: string | null | undefined,
  note: string | null | undefined,
): string {
  const shop = shopName?.trim() ?? "";
  const text = note?.trim() ?? "";
  if (shop && text) return `${shop} · ${lowerFirst(text)}`;
  return shop || text;
}
