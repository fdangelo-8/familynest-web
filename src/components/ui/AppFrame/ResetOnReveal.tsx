"use client";

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
 * With `cacheComponents` Next does not unmount the page it leaves: it keeps it
 * hidden (React Activity) with its local state. Coming back to it, a dialog
 * or a sheet that was open is open again, with the text that was written.
 * Hiding cleans up the layout effects and showing runs them again, so the
 * cleanup marks the page as hidden and the next run tells it came back. Used
 * as a `key`, the number gives the component below a fresh start.
 */
export function useResetOnReveal(): number {
  const [instance, setInstance] = useState(0);
  const wasHidden = useRef(false);
  useLayoutEffect(() => {
    if (wasHidden.current) {
      wasHidden.current = false;
      setInstance((count) => count + 1);
    }
    return () => {
      wasHidden.current = true;
    };
  }, []);
  return instance;
}

/**
 * Wraps the part of a page that owns dialogs, sheets or forms: every time the
 * page comes back through the navigation of the app, its children start over
 * from the saved state. Server content passed as `children` is kept.
 */
export function ResetOnReveal({ children }: { children: ReactNode }) {
  const instance = useResetOnReveal();
  return <Fragment key={instance}>{children}</Fragment>;
}
