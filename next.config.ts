import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/lib/security-headers";
import { SPACES } from "./src/lib/spaces";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The link to confirm an address (#419) keeps its address `/auth/confirm`,
  // but a GET with `type=email|signup` is answered by a page that does not
  // use the token: the button of that page does (POST /auth/confirm). The same
  // goes for `type=recovery` (#461), answered by its own page whose button
  // posts to /auth/recupero: /auth/confirm refuses `recovery`. A POST has a
  // body, so it never matches (no `Content-Type` on a GET).
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
        // The link of «Password dimenticata» (#461): same idea, its own page
        // and its own POST (/auth/recupero), because /auth/confirm refuses
        // `recovery`.
        {
          source: "/auth/confirm",
          has: [
            { type: "query", key: "token_hash", value: ".+" },
            { type: "query", key: "type", value: "recovery" },
          ],
          missing: [{ type: "header", key: "content-type" }],
          destination: "/accesso/conferma-recupero",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  // «Esplora» became «Spazi» (F5 #506): permanent redirects (308) for the
  // page and for the ten spaces of the catalogue. Any other `/esplora/...`
  // stays a 404 inside the frame.
  async redirects() {
    return [
      { source: "/esplora", destination: "/spazi", permanent: true },
      ...SPACES.map((space) => ({
        source: space.href.replace("/spazi/", "/esplora/"),
        destination: space.href,
        permanent: true,
      })),
    ];
  },
  async headers() {
    return [
      // Standard protection headers. First on purpose: when several rules
      // give the same key the last one wins, so the specific rules below
      // keep their own values.
      {
        source: "/:path*",
        headers: buildSecurityHeaders(process.env.VERCEL_ENV),
      },
      // Routes that already answer with `no-referrer` (the invitation link, its
      // closing route and the calendar link): a header of the config wins over
      // one set by a route handler, so the value is repeated here.
      ...[
        "/invito/:token((?!colore$)[^/]+)",
        "/calendari-collegati/collega/:provider",
        "/calendari-collegati/ritorno/:provider",
      ].map((source) => ({
        source,
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      })),
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
      // `/accesso/conferma-mail` and `/accesso/conferma-recupero` (#461) are
      // the pages that answer the links.
      ...[
        "/auth/confirm",
        "/accesso/conferma-mail",
        "/accesso/conferma-recupero",
      ].map((source) => ({
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
