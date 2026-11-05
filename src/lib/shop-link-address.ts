import { isIP } from "node:net";

/**
 * Which network addresses the link reader (`shop-link.ts`, #32) may connect
 * to: only public ones. Pure functions on text, no network access.
 *
 * The rule is «allow what is global unicast, refuse the rest»: for IPv4 the
 * whole address space minus the special ranges below; for IPv6 only
 * `2000::/3` minus documentation, Teredo and benchmarking blocks, and 6to4
 * only when the IPv4 inside is public. IPv4 inside IPv6 (`::ffff:a.b.c.d`)
 * is judged as IPv4.
 */

function parseIPv4(text: string): number[] | null {
  const parts = text.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) =>
    /^\d{1,3}$/.test(part) ? Number(part) : Number.NaN,
  );
  return octets.every((value) => value >= 0 && value <= 255) ? octets : null;
}

function isPublicIPv4Octets(octets: readonly number[]): boolean {
  const [a, b, c] = octets as [number, number, number, number];
  if (a === 0) return false; // «this network», 0.0.0.0
  if (a === 10) return false; // private
  if (a === 100 && b >= 64 && b <= 127) return false; // shared (CGNAT)
  if (a === 127) return false; // loopback
  if (a === 169 && b === 254) return false; // link-local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false; // private
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false; // IETF, doc
  if (a === 192 && b === 88 && c === 99) return false; // 6to4 relay
  if (a === 192 && b === 168) return false; // private
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 198 && b === 51 && c === 100) return false; // documentation
  if (a === 203 && b === 0 && c === 113) return false; // documentation
  if (a >= 224) return false; // multicast, reserved, broadcast
  return true;
}

/** Eight 16-bit groups of an IPv6 address, or null if it is not valid. */
function expandIPv6(text: string): number[] | null {
  if (text.includes("%")) return null; // zone id: never public
  let address = text;
  // Dotted IPv4 at the end: two groups.
  const lastColon = address.lastIndexOf(":");
  const tail = address.slice(lastColon + 1);
  if (tail.includes(".")) {
    const octets = parseIPv4(tail);
    if (!octets) return null;
    const [a, b, c, d] = octets as [number, number, number, number];
    address =
      address.slice(0, lastColon + 1) +
      ((a << 8) | b).toString(16) +
      ":" +
      ((c << 8) | d).toString(16);
  }
  const halves = address.split("::");
  if (halves.length > 2) return null;
  const toGroups = (part: string): number[] | null => {
    if (part === "") return [];
    const groups: number[] = [];
    for (const piece of part.split(":")) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(piece)) return null;
      groups.push(parseInt(piece, 16));
    }
    return groups;
  };
  const head = toGroups(halves[0] ?? "");
  if (!head) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;
  const rest = toGroups(halves[1] ?? "");
  if (!rest) return null;
  const missing = 8 - head.length - rest.length;
  if (missing < 1) return null;
  return [...head, ...new Array<number>(missing).fill(0), ...rest];
}

function isPublicIPv6Groups(groups: readonly number[]): boolean {
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  // IPv4 mapped (::ffff:a.b.c.d): judged as IPv4.
  if (
    g0 === 0 &&
    g1 === 0 &&
    g2 === 0 &&
    g3 === 0 &&
    g4 === 0 &&
    g5 === 0xffff
  ) {
    return isPublicIPv4Octets([g6 >> 8, g6 & 255, g7 >> 8, g7 & 255]);
  }
  // Only global unicast, 2000::/3.
  if (g0 < 0x2000 || g0 > 0x3fff) return false;
  if (g0 === 0x2001 && g1 < 0x0200) return false; // 2001::/23: Teredo, IETF
  if (g0 === 0x2001 && g1 === 0x0db8) return false; // documentation
  if (g0 === 0x3fff && g1 < 0x1000) return false; // documentation 3fff::/20
  // 6to4 (2002::/16): the IPv4 inside decides.
  if (g0 === 0x2002) {
    return isPublicIPv4Octets([g1 >> 8, g1 & 255, g2 >> 8, g2 & 255]);
  }
  return true;
}

/**
 * True only for an IPv4 or IPv6 address that is public. Anything that is not
 * an IP address in text form, or is special-purpose, gives false.
 */
export function isPublicAddress(address: string): boolean {
  const text = address.trim();
  const version = isIP(text);
  if (version === 4) {
    const octets = parseIPv4(text);
    return octets !== null && isPublicIPv4Octets(octets);
  }
  if (version === 6) {
    const groups = expandIPv6(text);
    return groups !== null && isPublicIPv6Groups(groups);
  }
  return false;
}
