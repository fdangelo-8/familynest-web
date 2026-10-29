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
import { cx } from "../cx";
import { Icon, type IconName } from "../Icon/Icon";

/** The toast disappears by itself after 5 seconds. */
const TOAST_DURATION_MS = 5000;

export type ToastOptions = {
  text: string;
  /** Optional bold part shown before the text, for example "3 cose" */
  lead?: string;
  /** Icon before the text: absent = check, `null` = no icon */
  icon?: IconName | null;
  /** Optional bold part shown after the text, for example the name of the item */
  emphasis?: string;
  /** With a function the toast shows an "Annulla" button that calls it */
  onUndo?: () => void;
  /** For screens without the bottom navigation: sits lower */
  withoutNav?: boolean;
};

type ToastState = ToastOptions & { id: number };

type ToastApi = {
  /** Shows a toast. A new toast replaces the visible one (decision D-6). */
  showToast: (options: ToastOptions) => void;
  hideToast: () => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const counter = useRef(0);

  const showToast = useCallback((options: ToastOptions) => {
    counter.current += 1;
    setToast({ ...options, id: counter.current });
  }, []);
  const hideToast = useCallback(() => setToast(null), []);

  const api = useMemo(() => ({ showToast, hideToast }), [showToast, hideToast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? (
        <ToastView key={toast.id} toast={toast} onHide={hideToast} />
      ) : null}
    </ToastContext.Provider>
  );
}

function ToastView({
  toast,
  onHide,
}: {
  toast: ToastState;
  onHide: () => void;
}) {
  const remaining = useRef(TOAST_DURATION_MS);
  const startedAt = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const start = useCallback(() => {
    window.clearTimeout(timer.current);
    startedAt.current = Date.now();
    timer.current = window.setTimeout(onHide, remaining.current);
  }, [onHide]);

  // The countdown stops while the toast has the mouse or the focus on it.
  const pause = useCallback(() => {
    if (timer.current === undefined) return;
    window.clearTimeout(timer.current);
    timer.current = undefined;
    remaining.current = Math.max(
      0,
      remaining.current - (Date.now() - startedAt.current),
    );
  }, []);

  useEffect(() => {
    start();
    return () => window.clearTimeout(timer.current);
  }, [start]);

  const resume = () => {
    if (timer.current === undefined) start();
  };

  return (
    <div
      className={cx("toast", toast.withoutNav && "toast--senza-nav")}
      role="status"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      data-testid="toast"
    >
      {toast.icon === null ? null : <Icon name={toast.icon ?? "check"} />}
      <span className="toast__testo">
        {toast.lead ? (
          <>
            <b>{toast.lead}</b>{" "}
          </>
        ) : null}
        {toast.text}
        {toast.emphasis ? (
          <>
            {" "}
            <b>{toast.emphasis}</b>
          </>
        ) : null}
      </span>
      {toast.onUndo ? (
        <button
          type="button"
          className="toast__azione"
          onClick={() => {
            toast.onUndo?.();
            onHide();
          }}
        >
          Annulla
        </button>
      ) : null}
    </div>
  );
}
