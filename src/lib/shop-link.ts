import "server-only";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { getShopLinkTestOrigin } from "@/lib/env";
import { isPublicAddress } from "@/lib/shop-link-address";
import { readShopPage } from "@/lib/shop-link-parse";
import { reduceShopPhoto } from "@/lib/shop-photo";

/**
 * The link reader (#32 §5): given the address of a shop page, it returns the
 * name, the shop, the price and a reduced copy of the photo. SERVER ONLY, and
 * only for a signed-in adult of a Nest (the caller checks the session first).
 *
 * What a stranger can make this code do is the whole risk, so:
 * - only `http`/`https`, ports 80 and 443, no user name or password in the
 *   address;
 * - every address the name resolves to must be public (see
 *   `shop-link-address.ts`); the check runs inside the lookup of the very
 *   connection, so the address checked is the address used (no second lookup
 *   to trick), and again at every redirect (at most 3);
 * - 8 seconds for everything together (page and photo);
 * - at most 1 MB of HTML (the rest is not read) and 5 MB of photo (more =
 *   no photo); `text/html` for the page, JPEG, PNG or WebP for the photo;
 * - no cookies, nothing of the user forwarded, a fixed `User-Agent`, no
 *   compression (nothing to inflate);
 * - nothing is logged and no error carries the address or the content: every
 *   failure is the same «could not read».
 *
 * One exception for the tests: the origin in `SHOP_LINK_TEST_ORIGIN` (one
 * only, ignored on Vercel) may be local.
 */

export const SHOP_LINK_MAX_LENGTH = 2000;
const TOTAL_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const MAX_HTML_BYTES = 1024 * 1024;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const USER_AGENT = "FamilyNestBot/1.0 (lista desideri)";
const HTML_TYPES = ["text/html"] as const;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type ShopLinkResult =
  | { ok: false }
  | {
      ok: true;
      /** Name of the idea (at most 80 characters), or null */
      title: string | null;
      /** Name of the shop (1–40 characters), or null */
      shopName: string | null;
      /** Price in euro cents, or null */
      priceCents: number | null;
      /** Reduced copy of the photo, or null */
      photo: { contentType: "image/webp"; base64: string } | null;
    };

/** Looks the name up and refuses it if any address is not public. */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) {
      callback(error, "", 4);
      return;
    }
    if (
      addresses.length === 0 ||
      addresses.some((entry) => !isPublicAddress(entry.address))
    ) {
      callback(new Error("blocked"), "", 4);
      return;
    }
    if (options.all) {
      (
        callback as unknown as (
          error: null,
          addresses: dns.LookupAddress[],
        ) => void
      )(null, addresses);
      return;
    }
    const first = addresses[0];
    if (!first) {
      callback(new Error("blocked"), "", 4);
      return;
    }
    callback(null, first.address, first.family);
  });
};

function isTestOrigin(url: URL): boolean {
  const allowed = getShopLinkTestOrigin();
  return allowed !== null && url.origin === allowed;
}

/** Is it allowed to open this address at all (before any connection)? */
function isAllowedUrl(url: URL): boolean {
  if (isTestOrigin(url)) return true;
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username !== "" || url.password !== "") return false;
  if (url.port !== "" && url.port !== "80" && url.port !== "443") return false;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "") return false;
  // A literal address skips the lookup, so it is judged here.
  if (isIP(host) !== 0) return isPublicAddress(host);
  return true;
}

type Answer = { response: http.IncomingMessage };

function requestOnce(
  url: URL,
  accept: string,
  signal: AbortSignal,
): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.request(
      url,
      {
        method: "GET",
        agent: false,
        signal,
        lookup: isTestOrigin(url) ? undefined : guardedLookup,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: accept,
          "Accept-Language": "it, en;q=0.5",
          "Accept-Encoding": "identity",
          Connection: "close",
        },
      },
      (response) => resolve({ response }),
    );
    request.on("error", reject);
    request.end();
  });
}

function mimeOf(response: http.IncomingMessage): string {
  const raw = response.headers["content-type"] ?? "";
  return raw.split(";")[0]?.trim().toLowerCase() ?? "";
}

/** Reads the body up to `max` bytes. Over the limit: `truncate` or null. */
function readBody(
  response: http.IncomingMessage,
  max: number,
  truncate: boolean,
): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const declared = Number(response.headers["content-length"]);
    if (!truncate && Number.isFinite(declared) && declared > max) {
      response.destroy();
      resolve(null);
      return;
    }
    const chunks: Buffer[] = [];
    let total = 0;
    let done = false;
    const finish = (value: Buffer | null) => {
      if (done) return;
      done = true;
      resolve(value);
    };
    response.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > max) {
        response.destroy();
        if (!truncate) {
          finish(null);
          return;
        }
        chunks.push(chunk.subarray(0, chunk.length - (total - max)));
        finish(Buffer.concat(chunks));
        return;
      }
      chunks.push(chunk);
    });
    response.on("end", () => finish(Buffer.concat(chunks)));
    // Cut by the timeout or by the other side: nothing usable.
    response.on("error", () => finish(null));
    response.on("close", () => finish(null));
  });
}

type Fetched = {
  finalUrl: URL;
  contentType: string;
  body: Buffer;
};

/** GET with manual redirects, each one checked again. Null on any failure. */
async function fetchChecked(
  start: URL,
  accept: string,
  types: readonly string[],
  max: number,
  truncate: boolean,
  signal: AbortSignal,
): Promise<Fetched | null> {
  let url = start;
  for (let hops = 0; hops <= MAX_REDIRECTS; hops += 1) {
    if (!isAllowedUrl(url)) return null;
    let response: http.IncomingMessage;
    try {
      ({ response } = await requestOnce(url, accept, signal));
    } catch {
      return null;
    }
    const status = response.statusCode ?? 0;
    if ([301, 302, 303, 307, 308].includes(status)) {
      const location = response.headers.location;
      response.destroy();
      if (!location) return null;
      try {
        url = new URL(location, url);
      } catch {
        return null;
      }
      continue;
    }
    const mime = mimeOf(response);
    if (status !== 200 || !types.includes(mime)) {
      response.destroy();
      return null;
    }
    const body = await readBody(response, max, truncate);
    return body
      ? {
          finalUrl: url,
          contentType: response.headers["content-type"] ?? "",
          body,
        }
      : null;
  }
  return null;
}

function decodeHtml(body: Buffer, contentType: string | undefined): string {
  const label = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType ?? "")?.[1];
  try {
    return new TextDecoder(label ?? "utf-8").decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

/**
 * Reads the shop page at `address`. Never throws and never says why it
 * failed: `{ ok: false }` for every cause (not an address, forbidden or
 * internal address, no answer, error, not HTML, too slow). When the page is
 * read but says little, `ok` is true with the missing parts at null.
 */
export async function readShopLink(address: string): Promise<ShopLinkResult> {
  const text = address.trim();
  if (text === "" || text.length > SHOP_LINK_MAX_LENGTH) return { ok: false };
  let start: URL;
  try {
    start = new URL(text);
  } catch {
    return { ok: false };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOTAL_TIMEOUT_MS);
  try {
    const page = await fetchChecked(
      start,
      "text/html",
      HTML_TYPES,
      MAX_HTML_BYTES,
      true,
      controller.signal,
    );
    if (!page) return { ok: false };
    const info = readShopPage(
      decodeHtml(page.body, page.contentType),
      page.finalUrl.hostname.replace(/^\[|\]$/g, ""),
    );

    let photo: { contentType: "image/webp"; base64: string } | null = null;
    if (info.imageRef) {
      try {
        const image = await fetchChecked(
          new URL(info.imageRef, page.finalUrl),
          "image/jpeg,image/png,image/webp",
          IMAGE_TYPES,
          MAX_PHOTO_BYTES,
          false,
          controller.signal,
        );
        const reduced = image ? await reduceShopPhoto(image.body) : null;
        if (reduced) {
          photo = {
            contentType: reduced.contentType,
            base64: reduced.data.toString("base64"),
          };
        }
      } catch {
        photo = null;
      }
    }
    return {
      ok: true,
      title: info.title,
      shopName: info.shopName,
      priceCents: info.priceCents,
      photo,
    };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}
