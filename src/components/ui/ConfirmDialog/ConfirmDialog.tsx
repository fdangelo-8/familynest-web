"use client";

import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { cx } from "../cx";
import { Button } from "../Button/Button";
import { useAnimatedClose, useDialogFocus } from "../overlay";

export type ConfirmAction = {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "pericolo-pieno";
};

export type ConfirmDialogProps = {
  open: boolean;
  /** Called when the dialog closes: after an action, "Annulla", Esc or a tap on the veil */
  onClose: () => void;
  /** A question: becomes the accessible name */
  title: string;
  /** The consequence: becomes the accessible description */
  text: string;
  /** One or more actions, in the order given. "Annulla" is always added last. */
  actions: ReadonlyArray<ConfirmAction>;
  className?: string;
  "data-testid"?: string;
};

export function ConfirmDialog(props: ConfirmDialogProps) {
  if (!props.open || typeof document === "undefined") return null;
  return createPortal(<ConfirmContent {...props} />, document.body);
}

function ConfirmContent({
  onClose,
  title,
  text,
  actions,
  className,
  "data-testid": testId,
}: ConfirmDialogProps) {
  const titleId = useId();
  const textId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const { closing, requestClose } = useAnimatedClose(onClose);

  useDialogFocus(dialogRef, { onEscape: requestClose, initialFocus: "marked" });

  return (
    <>
      <div
        className={cx("velo", closing && "is-uscita")}
        onClick={requestClose}
        aria-hidden="true"
        data-testid="velo"
      />
      <div
        ref={dialogRef}
        className={cx("dialogo", closing && "is-uscita", className)}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        data-testid={testId}
      >
        <h2 className="dialogo__titolo" id={titleId}>
          {title}
        </h2>
        <p className="dialogo__testo" id={textId}>
          {text}
        </p>
        <div className="dialogo__azioni">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant ?? "secondary"}
              full
              onClick={() => {
                action.onClick();
                requestClose();
              }}
            >
              {action.label}
            </Button>
          ))}
          <CancelButton onClick={requestClose} />
        </div>
      </div>
    </>
  );
}

function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="btn-secondary btn--pieno"
      onClick={onClick}
      data-autofocus=""
    >
      <span className="btn__testo">Annulla</span>
    </button>
  );
}
