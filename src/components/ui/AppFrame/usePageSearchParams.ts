import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { OVERLAY_PATHS } from "./useFramePathname";

/**
 * Query of the page below. While a sheet is open over the page (Add, search)
 * `useSearchParams()` is the query of the sheet, empty: a page that reads its
 * day, week or month from it would jump to today behind the sheet. Here the
 * last query read from the page's own address is kept until the sheet closes.
 */
export function usePageSearchParams(): ReturnType<typeof useSearchParams> {
  const pathname = usePathname();
  const current = useSearchParams();
  const [below, setBelow] = useState(current);
  const isOverlay = OVERLAY_PATHS.includes(pathname);
  if (!isOverlay && current !== below) setBelow(current);
  return isOverlay ? below : current;
}
