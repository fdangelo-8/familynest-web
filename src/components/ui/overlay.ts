import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/** Exit animation length. Keep in sync with `--durata-rapida` (200 ms). */
const EXIT_MS = 200;

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Subscribes to a CSS media query. False on the server. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** True from 1024 px: the sheet becomes a centered modal. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}

/**
 * True when the window is wide and tall enough for a centered modal instead of
 * a bottom sheet: from 900 px wide and at least 600 px tall (decision D8).
 * `useIsDesktop` stays at 1024 px for the layout of the pages until F5 (#506)
 * moves them to the same threshold.
 */
export function useIsWindow(): boolean {
  return useMediaQuery("(min-width: 900px) and (min-height: 600px)");
}

/** Open dialogs, last one on top. Only the top one handles Escape and Tab. */
const overlayStack: symbol[] = [];

/** True while a sheet or a dialog is open: a new one opens above it. */
export function hasOpenOverlay(): boolean {
  return overlayStack.length > 0;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Close with a short exit animation. `requestClose` starts the animation
 * (class `is-uscita`), then `onClose` runs.
 */
export function useAnimatedClose(onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!closing) return;
    const id = window.setTimeout(
      () => onCloseRef.current(),
      prefersReducedMotion() ? 0 : EXIT_MS,
    );
    return () => window.clearTimeout(id);
  }, [closing]);

  const requestClose = useCallback(() => setClosing(true), []);
  return { closing, requestClose };
}

/**
 * A light layer, such as the calendar under a date field: while `active` it is
 * the top of the stack, so Escape closes it and not the sheet it sits in.
 */
export function useEscapeLayer(active: boolean, onEscape: () => void) {
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  });
  useEffect(() => {
    if (!active) return;
    const token = Symbol("layer");
    overlayStack.push(token);
    const onKeyDown = (event: KeyboardEvent) => {
      if (overlayStack[overlayStack.length - 1] !== token) return;
      if (event.key !== "Escape") return;
      event.preventDefault();
      onEscapeRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const index = overlayStack.indexOf(token);
      if (index >= 0) overlayStack.splice(index, 1);
    };
  }, [active]);
}

/**
 * Dialog focus handling: moves focus inside on mount, keeps Tab inside,
 * handles Escape and gives focus back to the opener on unmount.
 */
export function useDialogFocus(
  containerRef: React.RefObject<HTMLElement | null>,
  options: { onEscape: () => void; initialFocus: "field" | "marked" },
) {
  const onEscapeRef = useRef(options.onEscape);
  useEffect(() => {
    onEscapeRef.current = options.onEscape;
  });
  const { initialFocus } = options;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const token = Symbol("overlay");
    overlayStack.push(token);
    const opener = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));

    // An element marked `data-autofocus` always wins (the confirm button, the
    // day of a calendar); otherwise the first field.
    let target: HTMLElement | null | undefined =
      container.querySelector<HTMLElement>("[data-autofocus]");
    if (!target && initialFocus === "field") {
      target = container.querySelector<HTMLElement>(
        "input:not([disabled]),select:not([disabled]),textarea:not([disabled])",
      );
    }
    (target ?? focusables()[0] ?? container).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (overlayStack[overlayStack.length - 1] !== token) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onEscapeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (!container.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const index = overlayStack.indexOf(token);
      if (index >= 0) overlayStack.splice(index, 1);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [containerRef, initialFocus]);
}
