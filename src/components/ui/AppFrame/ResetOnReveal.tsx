"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  Fragment,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

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
 * A number that goes up every time the address (path and query) is one this
 * component has already shown. The router keeps a hidden copy of the lower
 * levels too (`figli/a` then `figli/b` then `figli/a`, `?giorno=` changes):
 * they hide inside the page, not around the caller, so the reveal above does
 * not see them. An address never shown before costs nothing.
 */
function useRevisitCount(): number {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const address = query ? `${pathname}?${query}` : pathname;
  const [track, setTrack] = useState(() => ({
    address,
    seen: new Set<string>([address]),
    revisits: 0,
  }));
  if (track.address !== address) {
    setTrack({
      address,
      seen: new Set(track.seen).add(address),
      revisits: track.revisits + (track.seen.has(address) ? 1 : 0),
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
