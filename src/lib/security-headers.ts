export type HeaderEntry = { key: string; value: string };

// Standard protection headers for every page. `form-action` and rules on
// `script-src` / `connect-src` are left out on purpose: the calendar link
// answers with a 303 towards the provider.
const BASE_HEADERS: HeaderEntry[] = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

/** Headers for `/:path*`. Previews are also kept out of search engines. */
export function buildSecurityHeaders(vercelEnv?: string): HeaderEntry[] {
  const headers = BASE_HEADERS.map((header) => ({ ...header }));
  if (vercelEnv === "preview") {
    headers.push({ key: "X-Robots-Tag", value: "noindex, nofollow" });
  }
  return headers;
}
