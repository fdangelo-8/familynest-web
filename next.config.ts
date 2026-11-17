import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The link to confirm an address (#419) keeps its address `/auth/confirm`,
  // but a GET with `type=email|signup` is answered by a page that does not
  // use the token: the button of that page does (POST). The route handler
  // keeps the POST and the recovery link. A POST has a body, so it never
  // matches (no `Content-Type` on a GET).
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/auth/confirm",
          has: [
            { type: "query", key: "token_hash", value: ".+" },
            { type: "query", key: "type", value: "(email|signup)" },
          ],
          missing: [{ type: "header", key: "content-type" }],
          destination: "/accesso/conferma-mail",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    return [
      // The public page of a wish list (#33): the address carries the code, so it
      // must never be indexed, never be sent to other sites as a referrer and
      // never be kept in a cache.
      {
        source: "/desideri/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      // The confirmation link (#419): the address carries the token. `same-origin`
      // (not `no-referrer`) so the browser still sends a correct `Origin` with
      // the POST of the form.
      // `/accesso/conferma-mail` is the page that answers the link.
      ...["/auth/confirm", "/accesso/conferma-mail"].map((source) => ({
        source,
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Cache-Control", value: "no-store" },
        ],
      })),
    ];
  },
};

export default nextConfig;
