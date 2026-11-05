"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { IconName } from "../Icon/Icon";
import { IconButton } from "../IconButton/IconButton";
import { BarIconLink } from "./IconLinks";

/**
 * The icon button on the right of the mobile top bar of a detail page
 * («Modifica» in Dettaglio impegno, #19). The bar lives in the layout, the
 * page owns the action: the page renders `<BarAction />`, the bar shows it.
 */
type BarActionSpec = {
  icon: IconName;
  label: string;
  /** Visible and announced as inactive, does nothing (e.g. while loading) */
  inactive: boolean;
  /** Two-state button (e.g. a pin): `aria-pressed`. Undefined = plain button */
  pressed?: boolean;
  /** The button opens a dialog (`aria-haspopup`) */
  haspopup?: "dialog";
  /** With an address the action is a link, not a button (no `onClick`) */
  href?: string;
};

type BarActionContextValue = {
  action: BarActionSpec | null;
  setAction: (action: BarActionSpec | null) => void;
  /** Always calls the latest `onClick` of the page */
  press: () => void;
  setOnPress: (handler: (() => void) | null) => void;
};

const BarActionContext = createContext<BarActionContextValue | null>(null);

export function BarActionProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<BarActionSpec | null>(null);
  const handler = useRef<(() => void) | null>(null);
  const setOnPress = useCallback((next: (() => void) | null) => {
    handler.current = next;
  }, []);
  const press = useCallback(() => handler.current?.(), []);
  const value = useMemo(
    () => ({ action, setAction, press, setOnPress }),
    [action, press, setOnPress],
  );
  return (
    <BarActionContext.Provider value={value}>
      {children}
    </BarActionContext.Provider>
  );
}

/**
 * Puts an icon button, or an icon link, on the right of the mobile top bar
 * while the component is mounted. Renders nothing itself. Only detail bars
 * show it.
 */
type BarActionProps = {
  icon: IconName;
  /** Accessible name, written as the action */
  label: string;
  /** The action opens a dialog: `aria-haspopup` */
  "aria-haspopup"?: "dialog";
} & (
  | {
      href?: undefined;
      inactive?: boolean;
      /** Two-state button: `aria-pressed`. The label changes with the state. */
      pressed?: boolean;
      onClick: () => void;
    }
  | {
      /** A link to another page: no `onClick`, never inactive or pressed */
      href: string;
      inactive?: undefined;
      pressed?: undefined;
      onClick?: undefined;
    }
);

export function BarAction({
  icon,
  label,
  inactive = false,
  pressed,
  href,
  onClick,
  "aria-haspopup": haspopup,
}: BarActionProps) {
  const context = useContext(BarActionContext);
  const setAction = context?.setAction;
  const setOnPress = context?.setOnPress;

  useEffect(() => {
    setOnPress?.(onClick ?? null);
  });

  useEffect(() => {
    setAction?.({ icon, label, inactive, pressed, haspopup, href });
    return () => setAction?.(null);
  }, [setAction, icon, label, inactive, pressed, haspopup, href]);

  useEffect(() => () => setOnPress?.(null), [setOnPress]);

  return null;
}

/** The button of the registered action, or the empty slot that keeps the bar centered. */
export function BarActionSlot() {
  const context = useContext(BarActionContext);
  const action = context?.action ?? null;
  if (!context || !action) {
    return <span className="barra__vuoto" aria-hidden="true" />;
  }
  if (action.href !== undefined) {
    return (
      <BarIconLink href={action.href} icon={action.icon} label={action.label} />
    );
  }
  return (
    <IconButton
      icon={action.icon}
      aria-label={action.label}
      aria-disabled={action.inactive}
      pressed={action.pressed}
      aria-haspopup={action.haspopup}
      onClick={action.inactive ? undefined : context.press}
    />
  );
}
