"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

const ADD_PATH = "/aggiungi";

/**
 * Pathname the frame (bars, navigation) should follow. While Add is open as
 * a sheet over a page, `usePathname()` says `/aggiungi`, but the page below
 * must not change: the frame keeps the last other address. Opened directly,
 * there is nothing below and `/aggiungi` stays as is (it counts as Today).
 */
export function useFramePathname(): string {
  const pathname = usePathname();
  const [below, setBelow] = useState(pathname);
  if (pathname !== ADD_PATH && pathname !== below) setBelow(pathname);
  return pathname === ADD_PATH ? below : pathname;
}
