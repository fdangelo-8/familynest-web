"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cx } from "../cx";

type ShellContextValue = {
  /** The element of the grid where the panel is drawn (a portal target) */
  panelSlot: HTMLElement | null;
  /** A panel is open: the sidebar is narrow whatever the window */
  panelOpen: boolean;
  /** The panel tells the shell it is open: the sidebar goes to icons */
  setPanelOpen: (open: boolean) => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

/** Null outside the frame (the gallery draws its own). */
export function useShell(): ShellContextValue | null {
  return useContext(ShellContext);
}

/**
 * The grid of the frame (`.guscio`): sidebar, area with bars and content, and
 * the slot of the panel. On the phone it is only a column. With a panel open
 * the sidebar goes to icons, whatever the window.
 */
export function Shell({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  const [panelSlot, setPanelSlot] = useState<HTMLElement | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const setOpen = useCallback((open: boolean) => setPanelOpen(open), []);
  const value = useMemo(
    () => ({ panelSlot, panelOpen, setPanelOpen: setOpen }),
    [panelSlot, panelOpen, setOpen],
  );

  return (
    <ShellContext.Provider value={value}>
      <div className={cx("guscio", panelOpen && "guscio--pannello")}>
        {sidebar}
        <div className="guscio__area">{children}</div>
        <div className="guscio__pannello" ref={setPanelSlot} />
      </div>
    </ShellContext.Provider>
  );
}
