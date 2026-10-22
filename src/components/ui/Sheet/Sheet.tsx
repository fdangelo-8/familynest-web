"use client";

import { useId, useRef, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "../cx";
import { IconButton } from "../IconButton/IconButton";
import { useAnimatedClose, useDialogFocus, useIsDesktop } from "../overlay";

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  /** Required: becomes the `h2` and the accessible name of the dialog */
  title: string;
  /** Body content, same on mobile and desktop */
  children: ReactNode;
  /** Actions at the bottom. Mobile: after the content. Desktop: `.modale__piede`. */
  footer?: ReactNode;
  /** Optional side column (`.modale__lato`) on desktop. Without it the modal is single (`.modale--singola`). */
  side?: ReactNode;
  /** Mobile only: the sheet reaches up to the bar (`.foglio--alto`) */
  tall?: boolean;
  className?: string;
  "data-testid"?: string;
};

/** Share of the sheet height beyond which a drag closes it (decision D-5). */
const DRAG_CLOSE_RATIO = 0.25;

/**
 * Same content in two shapes: bottom sheet under 1024 px (`.foglio`),
 * centered modal from 1024 px (`.modale`).
 */
export function Sheet(props: SheetProps) {
  if (!props.open || typeof document === "undefined") return null;
  return createPortal(<SheetContent {...props} />, document.body);
}

function SheetContent({
  onClose,
  title,
  children,
  footer,
  side,
  tall,
  className,
  "data-testid": testId,
}: SheetProps) {
  const desktop = useIsDesktop();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<number | null>(null);
  const { closing, requestClose } = useAnimatedClose(onClose);

  useDialogFocus(dialogRef, { onEscape: requestClose, initialFocus: "field" });

  const closeButton = (
    <IconButton
      icon="x"
      small
      aria-label="Chiudi"
      onClick={requestClose}
      data-testid="sheet-chiudi"
    />
  );

  const onHandleDown = (event: PointerEvent<HTMLDivElement>) => {
    dragStart.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
    const dialog = dialogRef.current;
    if (dialog) {
      dialog.classList.remove("is-rientro");
      dialog.classList.add("is-trascinato");
    }
  };

  const onHandleMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return;
    const delta = Math.max(0, event.clientY - dragStart.current);
    dialogRef.current?.style.setProperty("--trascinamento", `${delta}px`);
  };

  const onHandleUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return;
    const delta = Math.max(0, event.clientY - dragStart.current);
    dragStart.current = null;
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.classList.remove("is-trascinato");
    if (delta > dialog.offsetHeight * DRAG_CLOSE_RATIO) {
      requestClose();
    } else {
      dialog.classList.add("is-rientro");
      dialog.style.removeProperty("--trascinamento");
    }
  };

  return (
    <>
      <div
        className={cx("velo", closing && "is-uscita")}
        onClick={requestClose}
        aria-hidden="true"
        data-testid="velo"
      />
      {/* One tree for both shapes: crossing 1024 px only changes classes, so
          the content (and what the user typed) is never remounted. */}
      <div
        ref={dialogRef}
        className={cx(
          desktop ? "modale" : "foglio",
          desktop && !side && "modale--singola",
          !desktop && tall && "foglio--alto",
          closing && "is-uscita",
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid={testId}
      >
        {desktop ? null : (
          <div
            className="foglio__maniglia"
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}
            data-testid="sheet-maniglia"
          />
        )}
        <div className={desktop ? "modale__corpo" : "foglio__corpo"}>
          <div className="foglio__testa">
            <h2 className="foglio__titolo" id={titleId}>
              {title}
            </h2>
            {closeButton}
          </div>
          {children}
          {footer ? (
            <div className={desktop ? "modale__piede" : "foglio__piede"}>
              {footer}
            </div>
          ) : null}
        </div>
        {desktop && side ? (
          <aside className="modale__lato">{side}</aside>
        ) : null}
      </div>
    </>
  );
}
