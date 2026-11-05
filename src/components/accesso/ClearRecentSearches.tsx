"use client";

import { useEffect } from "react";
import { clearLens } from "@/lib/lens";
import { clearAllRecentSearches } from "@/lib/recent-searches";

/**
 * On the sign-in page nobody is signed in: the recent searches kept in this
 * browser (#40) are removed, so an expired session, an account deleted
 * elsewhere or a sign-out that did not run the page's code leave nothing
 * behind (the lens kept in the session goes too). Renders nothing.
 */
export function ClearRecentSearches() {
  useEffect(() => {
    clearAllRecentSearches();
    clearLens();
  }, []);
  return null;
}
