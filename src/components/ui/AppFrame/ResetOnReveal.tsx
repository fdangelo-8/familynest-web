"use client";

import { usePathname } from "next/navigation";
import {
  Fragment,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { OVERLAY_PATHS } from "./useFramePathname";

/**
 * A number that goes up every time the page that holds the caller is shown
 * again after being hidden by the router.
 *
 * With `cacheComponents` Next does not unmount the page it leaves: it keeps
 * it hidden (React Activity) with its local state. Coming back to it, a dialog
 * or a sheet that was open is open again, with the text that was written.
 * Hiding cleans up the layout effects and showing runs them again, so the
 * cleanup marks the page as hidden and the next run tells it came back. Used
 * as a `key`, the number gives the component below a fresh start.
 * It also goes up when the router hides and shows the component again for
 * other reasons (a Suspense that goes back to its fallback, StrictMode in
 * development): the restart is harmless.
 */
function useRevealCount(): number {
  const [count, setCount] = useState(0);
  const wasHidden = useRef(false);
  useLayoutEffect(() => {
    if (wasHidden.current) {
      wasHidden.current = false;
      setCount((value) => value + 1);
    }
    return () => {
      wasHidden.current = true;
    };
  }, []);
  return count;
}

/**
 * A number that goes up every time the path is one this component has
 * already shown. The router keeps a hidden copy of the lower levels too
 * (`figli/a` then `figli/b` then `figli/a`, `calendario/giorno` then
 * `calendario/mese`): they hide inside the page, not around the caller, so the
 * reveal above does not see them. A path never shown before costs nothing.
 * The query is left out on purpose: the pages that step through a query
 * (`?giorno=`, `?settimana=`) rely on the hidden copy to keep what they have
 * already read when the connection is lost (#26, CA-35).
 */
function useRevisitCount(): number {
  const pathname = usePathname();
  const [track, setTrack] = useState(() => ({
    pathname,
    seen: new Set<string>([pathname]),
    revisits: 0,
  }));
  // A sheet over the page (Add, search) is not a change: the page below stays
  // as it is, and its address is not counted as seen.
  if (!OVERLAY_PATHS.includes(pathname) && track.pathname !== pathname) {
    setTrack({
      pathname,
      seen: new Set(track.seen).add(pathname),
      revisits: track.revisits + (track.seen.has(pathname) ? 1 : 0),
    });
  }
  return track.revisits;
}

/**
 * Wraps the content of the pages: every time a page comes back through the
 * navigation of the app, its children start over from the saved state.
 * Server content passed as `children` is kept. It lives in
 * `src/app/(app)/template.tsx`, once for all the pages.
 */
export function ResetOnReveal({ children }: { children: ReactNode }) {
  const reveals = useRevealCount();
  const revisits = useRevisitCount();
  return <Fragment key={`${reveals}-${revisits}`}>{children}</Fragment>;
}
