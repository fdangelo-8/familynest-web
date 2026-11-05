import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The public page of a wish list (#33): the address carries the code, so it
  // must never be indexed, never be sent to other sites as a referrer and
  // never be kept in a cache.
  async headers() {
    return [
      {
        source: "/desideri/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
