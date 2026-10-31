"use client";

import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cx } from "../cx";
import { Alert } from "../Alert/Alert";
import { Button } from "../Button/Button";
import { useAnimatedClose, useDialogFocus } from "../overlay";

export type ConfirmAction = {
  label: string;
  /**
   * Sync: the dialog closes right after. Async: the button shows the spinner,
   * the other buttons are inactive and Esc and the veil do nothing until the
   * promise settles. It closes when the promise resolves, except with `false`;
   * with `false` or a rejection the dialog stays open and shows `errorText`.
   */
  onClick: () => void | boolean | Promise<void | boolean>;
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
  /** Shown between the text and the buttons when an async action fails */
  errorText?: string;
  /** The dialog opens over a sheet or modal: the veil gets `.velo--sopra-foglio` */
  aboveSheet?: boolean;
  className?: string;
  "data-testid"?: string;
};

const DEFAULT_ERROR =
  "Non siamo riusciti a completare l'azione. Controlla la connessione e riprova.";

export function ConfirmDialog(props: ConfirmDialogProps) {
  if (!props.open || typeof document === "undefined") return null;
  return createPortal(<ConfirmContent {...props} />, document.body);
}

function ConfirmContent({
  onClose,
  title,
  text,
  actions,
  errorText = DEFAULT_ERROR,
  aboveSheet = false,
  className,
  "data-testid": testId,
}: ConfirmDialogProps) {
  const titleId = useId();
  const textId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const { closing, requestClose } = useAnimatedClose(onClose);
  // Label of the running async action, null when idle
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // While an action runs nothing can close the dialog.
  const closeIfIdle = () => {
    if (busy === null) requestClose();
  };

  useDialogFocus(dialogRef, { onEscape: closeIfIdle, initialFocus: "marked" });

  const run = (action: ConfirmAction) => {
    if (closing || busy !== null) return;
    setFailed(false);
    let result: ReturnType<ConfirmAction["onClick"]>;
    try {
      result = action.onClick();
    } catch {
      setFailed(true);
      return;
    }
    if (result instanceof Promise) {
      setBusy(action.label);
      result.then(
        (value) => {
          setBusy(null);
          if (value === false) setFailed(true);
          else requestClose();
        },
        () => {
          setBusy(null);
          setFailed(true);
        },
      );
    } else if (result === false) {
      setFailed(true);
    } else {
      requestClose();
    }
  };

  return (
    <>
      <div
        className={cx(
          "velo",
          aboveSheet && "velo--sopra-foglio",
          closing && "is-uscita",
        )}
        onClick={closeIfIdle}
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
        {failed ? (
          <Alert variant="errore" data-testid="dialogo-errore">
            {errorText}
          </Alert>
        ) : null}
        <div
          className="dialogo__azioni"
          data-in-corso={busy !== null ? "" : undefined}
        >
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant ?? "secondary"}
              full
              loading={busy === action.label}
              onClick={() => run(action)}
              inactive={busy !== null && busy !== action.label}
            >
              {action.label}
            </Button>
          ))}
          <CancelButton onClick={closeIfIdle} inactive={busy !== null} />
        </div>
      </div>
    </>
  );
}

function CancelButton({
  onClick,
  inactive,
}: {
  onClick: () => void;
  inactive: boolean;
}) {
  return (
    <button
      type="button"
      className="btn-secondary btn--pieno"
      aria-disabled={inactive || undefined}
      onClick={inactive ? undefined : onClick}
      data-autofocus=""
    >
      <span className="btn__testo">Annulla</span>
    </button>
  );
}
