/**
 * Reads name, shop, price and photo address from the HTML of a shop page
 * (#32 §5). Pure functions on text: no network, no DOM. The HTML comes from
 * a stranger, so everything here is tolerant and bounded, and nothing is
 * ever run or fetched from here.
 */

export const IDEA_TITLE_MAX = 80;
export const SHOP_NAME_MAX = 40;
/** 0,01 € and 99.999,99 € in cents. */
const PRICE_MIN_CENTS = 1;
const PRICE_MAX_CENTS = 9_999_999;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  euro: "€",
};

function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (whole, body: string) => {
      if (body.startsWith("#")) {
        const code =
          body[1] === "x" || body[1] === "X"
            ? parseInt(body.slice(2), 16)
            : parseInt(body.slice(1), 10);
        if (!Number.isFinite(code) || code < 1 || code > 0x10ffff) return " ";
        if (code >= 0xd800 && code <= 0xdfff) return " ";
        return String.fromCodePoint(code);
      }
      return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
    },
  );
}

/** Spaces at both ends removed and repeated spaces made one. */
export function normalizeText(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f\s]+/g, " ").trim();
}

/** Attributes of one tag, names in lower case, values decoded. */
function readAttributes(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const pattern =
    /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  // Skip the tag name.
  const inner = tag.replace(/^<\s*[a-z0-9]+/i, "").replace(/\/?>$/, "");
  for (const match of inner.matchAll(pattern)) {
    const name = (match[1] ?? "").toLowerCase();
    if (!name || attributes.has(name)) continue;
    attributes.set(
      name,
      decodeEntities(match[2] ?? match[3] ?? match[4] ?? ""),
    );
  }
  return attributes;
}

// The HTML comes from a stranger: every search below moves forward with
// `indexOf` and has a ceiling, so no input (open tags never closed, millions
// of `<meta`) can take more than linear time.
const MAX_TAG_LENGTH = 2000;
const MAX_META_TAGS = 500;
const MAX_JSON_LD_BLOCKS = 20;
const MAX_JSON_LD_LENGTH = 200_000;
/** The head is read up to `</head>`, or this many characters. */
const MAX_HEAD_LENGTH = 300_000;

/** Same length as `text`, ASCII letters in lower case (indexes stay valid). */
function asciiLower(text: string): string {
  return text.replace(/[A-Z]/g, (letter) =>
    String.fromCharCode(letter.charCodeAt(0) + 32),
  );
}

/** True if the character after a tag name ends the name (`<meta ` yes, `<metadata` no). */
function endsTagName(char: string | undefined): boolean {
  return char === undefined || !/[a-z0-9:_-]/.test(char);
}

/**
 * The tags called `name` in `lower` (a lower-cased copy of `html`): their
 * text, at most `limit`. A tag with no `>` within 2000 characters is skipped.
 */
function findTags(
  html: string,
  lower: string,
  name: string,
  limit: number,
): string[] {
  const found: string[] = [];
  const open = `<${name}`;
  let from = 0;
  while (found.length < limit) {
    const start = lower.indexOf(open, from);
    if (start === -1) break;
    from = start + open.length;
    if (!endsTagName(lower[from])) continue;
    const end = lower.indexOf(">", from);
    if (end === -1) break;
    if (end - start > MAX_TAG_LENGTH) continue;
    found.push(html.slice(start, end + 1));
    from = end + 1;
  }
  return found;
}

/** First value of each `<meta>` by property/name/itemprop (lower case). */
function readMetaTags(html: string, lower: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const tag of findTags(html, lower, "meta", MAX_META_TAGS)) {
    const attributes = readAttributes(tag);
    const content = attributes.get("content");
    if (content === undefined) continue;
    for (const key of ["property", "name", "itemprop"]) {
      const name = attributes.get(key)?.toLowerCase();
      if (name && !values.has(name)) values.set(name, content);
    }
  }
  return values;
}

function readTitleTag(html: string, lower: string): string | null {
  let from = 0;
  for (let tries = 0; tries < 5; tries += 1) {
    const start = lower.indexOf("<title", from);
    if (start === -1) return null;
    from = start + 6;
    if (!endsTagName(lower[from])) continue;
    const open = lower.indexOf(">", from);
    if (open === -1 || open - start > MAX_TAG_LENGTH) return null;
    const close = lower.indexOf("</title", open);
    if (close === -1 || close - open > MAX_TAG_LENGTH) return null;
    return normalizeText(decodeEntities(html.slice(open + 1, close)));
  }
  return null;
}

/** Cut to `max` characters at the last whole word, with «…». */
export function cutAtWord(text: string, max: number): string {
  const letters = Array.from(text);
  if (letters.length <= max) return text;
  const room = letters.slice(0, max - 1);
  const lastSpace = room.lastIndexOf(" ");
  const kept = lastSpace > 0 ? room.slice(0, lastSpace) : room;
  return `${kept.join("").trimEnd()}…`;
}

/**
 * «12.50», «12,50», «1.299,00», «1299» to cents. Null if not a plain amount
 * or outside 0,01 – 99.999,99.
 */
export function parsePriceCents(raw: string): number | null {
  const text = raw.replace(/[\s ]/g, "");
  if (!/^\d[\d.,]*$/.test(text)) return null;
  const lastDot = text.lastIndexOf(".");
  const lastComma = text.lastIndexOf(",");
  const decimalAt = Math.max(lastDot, lastComma);
  let integerPart = text;
  let fraction = "";
  if (decimalAt >= 0) {
    const after = text.slice(decimalAt + 1);
    const before = text.slice(0, decimalAt);
    // The last separator is the decimal one; earlier ones are thousands
    // marks. «1.299» (three digits after the only separator) is ambiguous
    // and is refused below, never guessed.
    integerPart = before;
    fraction = after;
  }
  integerPart = integerPart.replace(/[.,]/g, "");
  if (!/^\d+$/.test(integerPart)) return null;
  if (fraction !== "" && !/^\d{1,2}$/.test(fraction)) return null;
  const cents =
    Number(integerPart) * 100 + Number(fraction.padEnd(2, "0") || "0");
  if (!Number.isSafeInteger(cents)) return null;
  return cents >= PRICE_MIN_CENTS && cents <= PRICE_MAX_CENTS ? cents : null;
}

type JsonValue = unknown;

function asArray(value: JsonValue): JsonValue[] {
  return Array.isArray(value) ? value : value === undefined ? [] : [value];
}

function isObject(value: JsonValue): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function typeIncludes(node: Record<string, unknown>, type: string): boolean {
  return asArray(node["@type"]).some(
    (item) => typeof item === "string" && item.toLowerCase() === type,
  );
}

/** Price of the first `Offer` of a `Product` in the JSON-LD blocks. */
function readJsonLdOffer(
  html: string,
  lower: string,
): { amount: string; currency: string } | null {
  /** The text of the `application/ld+json` scripts, found without regex. */
  const blocks: string[] = [];
  let from = 0;
  while (blocks.length < MAX_JSON_LD_BLOCKS) {
    const start = lower.indexOf("<script", from);
    if (start === -1) break;
    from = start + 7;
    if (!endsTagName(lower[from])) continue;
    const open = lower.indexOf(">", from);
    if (open === -1) break;
    if (open - start > MAX_TAG_LENGTH) continue;
    if (!lower.slice(start, open).includes("application/ld+json")) continue;
    const close = lower.indexOf("</script", open);
    if (close === -1) break;
    from = close;
    if (close - open <= MAX_JSON_LD_LENGTH) {
      blocks.push(html.slice(open + 1, close));
    }
  }
  let visited = 0;
  type Offer = { amount: string; currency: string };
  const walk = (
    node: JsonValue,
    insideProduct: boolean,
    depth: number,
  ): Offer | null => {
    if (depth > 8 || visited++ > 2000) return null;
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = walk(child, insideProduct, depth + 1);
        if (found) return found;
      }
      return null;
    }
    if (!isObject(node)) return null;
    const isProduct = typeIncludes(node, "product");
    const isOffer =
      typeIncludes(node, "offer") || typeIncludes(node, "aggregateoffer");
    if ((insideProduct || isOffer) && (isOffer || "price" in node)) {
      const amount = node.price ?? node.lowPrice;
      const currency = node.priceCurrency;
      if (
        (typeof amount === "string" || typeof amount === "number") &&
        typeof currency === "string"
      ) {
        return { amount: String(amount), currency };
      }
    }
    const next = insideProduct || isProduct;
    for (const key of ["offers", "@graph", "mainEntity", "hasVariant"]) {
      const found = walk(node[key], next, depth + 1);
      if (found) return found;
    }
    return null;
  };
  for (const block of blocks) {
    let data: JsonValue;
    try {
      data = JSON.parse(decodeEntities(block.trim()));
    } catch {
      continue;
    }
    const found = walk(data, false, 0);
    if (found) return found;
  }
  return null;
}

export type ShopPageInfo = {
  /** Name of the idea, at most 80 characters, or null */
  title: string | null;
  /** Name of the shop, 1–40 characters, or null */
  shopName: string | null;
  /** Price in euro cents, only if the currency is EUR */
  priceCents: number | null;
  /** Address of the picture as written in the page (not yet resolved) */
  imageRef: string | null;
};

/**
 * What a page tells: `og:title` or `<title>`; `og:site_name` (1–40) or the
 * host without «www.»; the price (EUR only) from the product meta tags or the
 * JSON-LD offer; the `og:image`.
 */
export function readShopPage(html: string, host: string): ShopPageInfo {
  const lowerAll = asciiLower(html);
  const headEnd = lowerAll.indexOf("</head");
  const headLength = Math.min(
    headEnd === -1 ? html.length : headEnd,
    MAX_HEAD_LENGTH,
  );
  const head = html.slice(0, headLength);
  const lowerHead = lowerAll.slice(0, headLength);
  const meta = readMetaTags(head, lowerHead);

  const rawTitle = normalizeText(meta.get("og:title") ?? "");
  const title = normalizeText(rawTitle || readTitleTag(head, lowerHead) || "");

  const siteName = normalizeText(meta.get("og:site_name") ?? "");
  const hostName = host.replace(/^www\./i, "");
  const siteLength = Array.from(siteName).length;
  const shopName =
    siteLength >= 1 && siteLength <= SHOP_NAME_MAX
      ? siteName
      : hostName && Array.from(hostName).length <= SHOP_NAME_MAX
        ? hostName
        : null;

  let amount: string | null = null;
  let currency: string | null = null;
  for (const prefix of ["product:price", "og:price"]) {
    const found = meta.get(`${prefix}:amount`);
    if (found) {
      amount = found;
      currency = meta.get(`${prefix}:currency`) ?? null;
      break;
    }
  }
  if (amount === null) {
    const offer = readJsonLdOffer(html, lowerAll);
    if (offer) {
      amount = offer.amount;
      currency = offer.currency;
    }
  }
  const priceCents =
    amount !== null && currency?.trim().toUpperCase() === "EUR"
      ? parsePriceCents(amount)
      : null;

  const imageRef = normalizeText(meta.get("og:image") ?? "") || null;

  return {
    title: title ? cutAtWord(title, IDEA_TITLE_MAX) : null,
    shopName,
    priceCents,
    imageRef,
  };
}
