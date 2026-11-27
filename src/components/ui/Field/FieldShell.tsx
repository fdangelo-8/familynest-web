import { useId, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon } from "../Icon/Icon";

export type FieldShellProps = {
  /** Required visible label, linked to the control */
  label: string;
  /** Hint under the field (`.campo__aiuto`) */
  help?: string;
  /** Error text. The page decides when to show it (after submit, not while typing). */
  error?: string;
  className?: string;
  /** Set by `FieldGroup`: the field loses its own box. Do not pass it by hand. */
  grouped?: boolean;
  /** Set by `FieldGroup`: id of the error text under the block. Do not pass it by hand. */
  groupErrorId?: string;
};

type Described = { "aria-describedby"?: string; "aria-invalid"?: true };

export function useFieldIds(
  id: string | undefined,
  help?: string,
  error?: string,
  groupErrorId?: string,
) {
  const generated = useId();
  const inputId = id ?? generated;
  const helpId = help ? `${inputId}-aiuto` : undefined;
  const errorId = error ? (groupErrorId ?? `${inputId}-errore`) : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  const described: Described = {
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
  };
  return { inputId, helpId, errorId, described };
}

/**
 * Box with the label inside (`.campo__scatola`). The label sits on the value
 * when the field is empty and has no focus, and goes up when it has one
 * (`.campo--alto`: always up, for fields that always show something).
 */
export function FieldShell({
  label,
  help,
  error,
  className,
  inputId,
  helpId,
  errorId,
  always,
  grouped,
  groupErrorId,
  ownError,
  children,
}: FieldShellProps & {
  inputId: string;
  helpId?: string;
  errorId?: string;
  /** The label stays up (date, time, select, text area, own placeholder) */
  always?: boolean;
  /**
   * The error belongs to the field itself (a time that cannot be read): it is
   * written under the field even inside a `FieldGroup`.
   */
  ownError?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "campo",
        error && "campo--errore",
        always && "campo--alto",
        grouped && "campo--unito",
        className,
      )}
    >
      <div className="campo__scatola">
        {children}
        <label className="campo__etichetta" htmlFor={inputId}>
          {label}
        </label>
      </div>
      {help ? (
        <p className="campo__aiuto" id={helpId}>
          {help}
        </p>
      ) : null}
      {error && (!groupErrorId || ownError) ? (
        <p className="campo__errore" id={errorId}>
          <Icon name="circle-alert" size="s" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
