"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { it } from "@/lib/i18n/messages/it";
import { cx } from "../cx";
import { Button } from "../Button/Button";
import { IconButton } from "../IconButton/IconButton";
import { Spinner } from "../Spinner/Spinner";
import {
  hasOpenOverlay,
  useAnimatedClose,
  useDialogFocus,
  useIsDesktop,
} from "../overlay";

/** The written action on the right of the head («Salva»). */
export type SheetAction = {
  label: string;
  onClick: () => void;
  /** Saving: the spinner takes the place of the label and the sheet cannot close */
  busy?: boolean;
  disabled?: boolean;
};

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  /**
   * Goes back instead of closing: X, Esc, the veil and the drag call it and the
   * sheet stays open, with no exit animation (the parent changes the content).
   * Without it they close the sheet, as usual. Ignored while `locked`.
   */
  onBack?: () => void;
  /** Required: becomes the `h2` and the accessible name of the dialog */
  title: string;
  /**
   * Optional accessible name of the dialog, used instead of `title` (`aria-label`).
   * The visible title does not change. It should start with the visible title.
   */
  ariaLabel?: string;
  /** Body content, same on mobile and desktop */
  children: ReactNode;
  /**
   * Fixed foot with a line above (`.foglio__piede`), for «Annulla» and the
   * main action: use `SheetFooter`. Never together with `action`.
   */
  footer?: ReactNode;
  /** Window: the foot holds only the main button, kept on the right (`.modale__piede--fine`) */
  footerEnd?: boolean;
  /** Written action on the right of the head (`.foglio__azione`), instead of a foot */
  action?: SheetAction;
  /** `start`: the title sits on the left after the X and wraps (long sentences) */
  titleAlign?: "center" | "start";
  /** Short line on the right of the head (`.foglio__info`), e.g. a hint and a `kbd` */
  info?: ReactNode;
  /** Optional side column (`.modale__lato`) in the window. Without it the modal is single (`.modale--singola`). */
  side?: ReactNode;
  /** Phone only: the sheet reaches up to the safe area (`.foglio--alto`) */
  tall?: boolean;
  /** While true X, Esc, the veil and the drag do not close the sheet (saving in progress) */
  locked?: boolean;
  /** Turns true when the parent wants the sheet to leave with its exit animation; `onClose` runs after it */
  closeRequested?: boolean;
  /** `id` of the text that describes the dialog (`aria-describedby`) */
  "aria-describedby"?: string;
  className?: string;
  "data-testid"?: string;
};

/** Share of the sheet height beyond which a drag closes it (decision D-5). */
const DRAG_CLOSE_RATIO = 0.25;

/**
 * Same content in two shapes: bottom sheet (`.foglio`) and, from 1024 px
 * wide (the same threshold as the pages), centered modal (`.modale`).
 */
export function Sheet(props: SheetProps) {
  if (!props.open || typeof document === "undefined") return null;
  return createPortal(<SheetContent {...props} />, document.body);
}

function SheetContent({
  onClose,
  onBack,
  title,
  ariaLabel,
  children,
  footer,
  footerEnd,
  action,
  titleAlign = "center",
  info,
  side,
  tall,
  locked: lockedProp = false,
  closeRequested = false,
  "aria-describedby": describedBy,
  className,
  "data-testid": testId,
}: SheetProps) {
  const windowShape = useIsDesktop();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<number | null>(null);
  const [aboveSheet] = useState(hasOpenOverlay);
  const { closing, requestClose: startClose } = useAnimatedClose(onClose);
  const locked = lockedProp || action?.busy === true;
  const lockedRef = useRef(locked);
  useEffect(() => {
    lockedRef.current = locked;
  });
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  });
  const requestClose = useCallback(() => {
    if (lockedRef.current) return;
    if (onBackRef.current) onBackRef.current();
    else startClose();
  }, [startClose]);
  useEffect(() => {
    if (closeRequested) startClose();
  }, [closeRequested, startClose]);

  useDialogFocus(dialogRef, { onEscape: requestClose, initialFocus: "field" });

  const onHeadDown = (event: PointerEvent<HTMLDivElement>) => {
    if (lockedRef.current) return;
    // The X and the action keep their own tap: the drag starts elsewhere.
    if ((event.target as HTMLElement).closest("button")) return;
    dragStart.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
    const dialog = dialogRef.current;
    if (dialog) {
      dialog.classList.remove("is-rientro");
      dialog.classList.add("is-trascinato");
    }
  };

  const onHeadMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return;
    const delta = Math.max(0, event.clientY - dragStart.current);
    dialogRef.current?.style.setProperty("--trascinamento", `${delta}px`);
  };

  const onHeadUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return;
    const delta = Math.max(0, event.clientY - dragStart.current);
    dragStart.current = null;
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.classList.remove("is-trascinato");
    const beyond =
      delta > dialog.offsetHeight * DRAG_CLOSE_RATIO && !lockedRef.current;
    if (beyond && !onBackRef.current) {
      requestClose();
      return;
    }
    // Going back: the sheet slides to its place first, then the parent acts.
    dialog.classList.add("is-rientro");
    dialog.style.removeProperty("--trascinamento");
    if (beyond) requestClose();
  };

  const dragProps = windowShape
    ? {}
    : {
        onPointerDown: onHeadDown,
        onPointerMove: onHeadMove,
        onPointerUp: onHeadUp,
        onPointerCancel: onHeadUp,
      };

  return (
    <>
      <div
        className={cx(
          "velo",
          aboveSheet && "velo--sopra-foglio",
          closing && "is-uscita",
        )}
        onClick={requestClose}
        aria-hidden="true"
        data-testid="velo"
      />
      {/* One tree for both shapes: crossing the threshold only changes
          classes, so the content (and what the user typed) is never remounted. */}
      <div
        ref={dialogRef}
        className={cx(
          windowShape ? "modale" : "foglio",
          windowShape && !side && "modale--singola",
          !windowShape && tall && "foglio--alto",
          !windowShape && Boolean(footer) && "foglio--con-piede",
          titleAlign === "start" && "foglio--titolo-inizio",
          closing && "is-uscita",
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabel ? undefined : titleId}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        data-testid={testId}
      >
        <div className={windowShape ? "modale__corpo" : "foglio__corpo"}>
          <div
            className="foglio__testa"
            data-testid="sheet-testa"
            {...dragProps}
          >
            <IconButton
              icon="x"
              aria-label={it.close}
              aria-disabled={locked}
              onClick={requestClose}
              className="foglio__chiudi"
              data-testid="sheet-chiudi"
            />
            {action ? <SheetActionButton action={action} /> : null}
            <h2 className="foglio__titolo" id={titleId}>
              {title}
            </h2>
            {info && !action ? (
              <span className="foglio__info">{info}</span>
            ) : null}
          </div>
          <div className="foglio__contenuto">{children}</div>
          {footer ? (
            <div
              className={
                windowShape
                  ? cx("modale__piede", footerEnd && "modale__piede--fine")
                  : "foglio__piede"
              }
            >
              {footer}
            </div>
          ) : null}
        </div>
        {windowShape && side ? (
          <aside className="modale__lato">{side}</aside>
        ) : null}
      </div>
    </>
  );
}

function SheetActionButton({ action }: { action: SheetAction }) {
  const { label, onClick, busy = false, disabled = false } = action;
  const inactive = busy || disabled;
  return (
    <button
      type="button"
      className={cx("btn-link", "foglio__azione", busy && "is-caricamento")}
      aria-label={busy ? label : undefined}
      aria-busy={busy || undefined}
      aria-disabled={inactive || undefined}
      onClick={inactive ? undefined : onClick}
      data-testid="sheet-azione"
    >
      {busy ? (
        <>
          <span className="foglio__azione-testo" aria-hidden="true">
            {label}
          </span>
          <Spinner />
        </>
      ) : (
        label
      )}
    </button>
  );
}

/**
 * Content of the fixed foot of a sheet: «Annulla», written and underlined, on
 * the left and the main action, full, on the right. Pass it as `footer`.
 */
export function SheetFooter({
  onCancel,
  cancelLabel = it.cancel,
  action,
}: {
  onCancel: () => void;
  cancelLabel?: string;
  action: {
    label: string;
    onClick?: () => void;
    /** `submit` with `form` sends a form that sits in the body of the sheet */
    type?: "button" | "submit";
    form?: string;
    loading?: boolean;
    inactive?: boolean;
  };
}) {
  return (
    <div className="foglio__piede-riga">
      <Button variant="link" onClick={onCancel} data-testid="sheet-annulla">
        {cancelLabel}
      </Button>
      <Button
        type={action.type}
        form={action.form}
        loading={action.loading}
        inactive={action.inactive}
        onClick={action.onClick}
        data-testid="sheet-azione-piede"
      >
        {action.label}
      </Button>
    </div>
  );
}
