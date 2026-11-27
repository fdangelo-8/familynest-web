"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { ASSISTANT_AVAILABLE } from "@/lib/assistant";
import { useShellLayout } from "@/lib/breakpoints";
import { brandText } from "@/lib/brand";
import { it } from "@/lib/i18n/messages/it";
import {
  getServerShortcutsEnabled,
  getShortcutsEnabled,
  setShortcutsEnabled,
  subscribeShortcutsEnabled,
} from "@/lib/shortcuts-enabled";
import { Sheet } from "../Sheet/Sheet";
import { Toggle } from "../Toggle/Toggle";

/** A shortcut that a page declares: it appears in the list of «?». */
export type PageShortcut = { key: string; label: string };

type ShortcutsContextValue = {
  register: (shortcuts: readonly PageShortcut[]) => () => void;
};

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

/**
 * A page declares its own shortcuts (1, 2, 3, T, arrows…) while it is shown,
 * so that «?» lists them. The page handles the keys itself; this only lists.
 */
export function usePageShortcuts(shortcuts: readonly PageShortcut[]) {
  const context = useContext(ShortcutsContext);
  const register = context?.register;
  const signature = JSON.stringify(shortcuts);
  useEffect(() => {
    if (!register) return;
    return register(JSON.parse(signature) as PageShortcut[]);
  }, [register, signature]);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** The button on the right of the computer bar (`data-azione-barra`), if any. */
function findBarButton(): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(
    "[data-azione-barra]",
  );
  for (const element of candidates) {
    if (element.offsetParent !== null) return element;
  }
  return null;
}

/**
 * Single handler of the keyboard shortcuts (§8) and the window «Scorciatoie
 * da tastiera». Also writes on `html` how the last input was made
 * (`data-gesto`: «tocco» or «puntatore») and whether a key was pressed
 * (`data-tastiera`), which the CSS uses for the 44 px controls and the `kbd`
 * letters. Only with the computer shape; the phone has none.
 */
export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const layout = useShellLayout();
  const computer = layout !== "telefono";
  const enabled = useSyncExternalStore(
    subscribeShortcutsEnabled,
    getShortcutsEnabled,
    getServerShortcutsEnabled,
  );
  const [helpOpen, setHelpOpen] = useState(false);
  const [pageShortcuts, setPageShortcuts] = useState<
    readonly (readonly PageShortcut[])[]
  >([]);
  const [hasNewEvent, setHasNewEvent] = useState(false);

  const register = useCallback((shortcuts: readonly PageShortcut[]) => {
    setPageShortcuts((current) => [...current, shortcuts]);
    return () =>
      setPageShortcuts((current) =>
        current.filter((entry) => entry !== shortcuts),
      );
  }, []);
  const value = useMemo(() => ({ register }), [register]);

  // Last gesture: the 44 px controls for a finger, the computer sizes for a
  // mouse. Before the first one, the pointer of the device decides.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.gesto = window.matchMedia("(pointer: coarse)").matches
      ? "tocco"
      : "puntatore";
    const onPointerDown = (event: PointerEvent) => {
      root.dataset.gesto =
        event.pointerType === "touch" || event.pointerType === "pen"
          ? "tocco"
          : "puntatore";
    };
    const onKey = () => {
      root.dataset.tastiera = "si";
    };
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("keydown", onKey, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  });

  useEffect(() => {
    if (!computer) return;
    const go = (href: string) => router.push(href);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (document.querySelector('[role="dialog"],[role="alertdialog"]')) {
        return;
      }
      const key = event.key;
      if (key === it.shell.keyHelp) {
        event.preventDefault();
        setHasNewEvent(findBarButton() !== null);
        setHelpOpen(true);
        return;
      }
      if (!enabledRef.current) return;
      const lower = key.toLowerCase();
      const is = (letter: string) => lower === letter.toLowerCase();
      if (is(it.shell.keyToday)) go("/oggi");
      else if (is(it.shell.keyCalendar)) go("/calendario");
      else if (is(it.shell.keyHome)) go("/casa/spesa");
      else if (is(it.shell.keySpaces)) go("/spazi");
      else if (is(it.shell.keySearch)) go("/ricerca");
      else if (is(it.shell.keyNew)) {
        const button = findBarButton();
        if (!button) return;
        button.click();
      } else if (is(it.shell.keyAsk)) {
        // Off until B15 (#386): `ASSISTANT_AVAILABLE`.
        if (!ASSISTANT_AVAILABLE) return;
      } else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [computer, router]);

  const rows: { key: string; label: string }[] = [
    { key: it.shell.keyToday, label: it.shell.goToday },
    { key: it.shell.keyCalendar, label: it.shell.goCalendar },
    { key: it.shell.keyHome, label: it.shell.goHome },
    { key: it.shell.keySpaces, label: it.shell.goSpaces },
    ...(hasNewEvent
      ? [{ key: it.shell.keyNew, label: it.shell.pressNew }]
      : []),
    { key: it.shell.keySearch, label: it.shell.openSearch },
    ...(ASSISTANT_AVAILABLE
      ? [{ key: it.shell.keyAsk, label: brandText(it.shell.openAsk) }]
      : []),
    ...pageShortcuts.flat(),
    { key: it.shell.keyHelp, label: it.shell.showShortcuts },
    { key: it.shell.keyEscape, label: it.shell.closeLayer },
  ];

  return (
    <ShortcutsContext.Provider value={value}>
      {children}
      <Sheet
        open={helpOpen && computer}
        onClose={() => setHelpOpen(false)}
        title={it.shell.shortcutsTitle}
        className="finestra-scorciatoie"
      >
        <ul className="scorciatoie">
          {rows.map((row) => (
            <li key={row.key + row.label} className="scorciatoie__riga">
              <kbd className="tasto">{row.key}</kbd>
              <span>{row.label}</span>
            </li>
          ))}
        </ul>
        <div className="scorciatoie__interruttore">
          <span>{it.shell.shortcutsToggle}</span>
          <Toggle
            checked={enabled}
            onChange={setShortcutsEnabled}
            aria-label={it.shell.shortcutsToggle}
          />
        </div>
      </Sheet>
    </ShortcutsContext.Provider>
  );
}
