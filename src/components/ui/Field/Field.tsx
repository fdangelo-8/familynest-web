import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cx } from "../cx";
import { Icon } from "../Icon/Icon";

type FieldShellProps = {
  /** Required visible label, linked to the control */
  label: string;
  /** Hint under the field (`.campo__aiuto`) */
  help?: string;
  /** Error text. The page decides when to show it (after submit, not while typing). */
  error?: string;
  className?: string;
};

type Described = { "aria-describedby"?: string; "aria-invalid"?: true };

function useFieldIds(id: string | undefined, help?: string, error?: string) {
  const generated = useId();
  const inputId = id ?? generated;
  const helpId = help ? `${inputId}-aiuto` : undefined;
  const errorId = error ? `${inputId}-errore` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  const described: Described = {
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
  };
  return { inputId, helpId, errorId, described };
}

function FieldShell({
  label,
  help,
  error,
  className,
  inputId,
  helpId,
  errorId,
  children,
}: FieldShellProps & {
  inputId: string;
  helpId?: string;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx("campo", error && "campo--errore", className)}>
      <label className="campo__etichetta" htmlFor={inputId}>
        {label}
      </label>
      {children}
      {help ? (
        <p className="campo__aiuto" id={helpId}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p className="campo__errore" id={errorId}>
          <Icon name="circle-alert" size="s" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type TextFieldProps = FieldShellProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "children"> & {
    multiline?: false;
  };

export type TextAreaFieldProps = FieldShellProps &
  Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    "className" | "children"
  > & {
    multiline: true;
  };

const SHELL_KEYS = ["label", "help", "error", "className", "multiline"];

/** Props that belong to the control itself, without the field wrapper ones. */
function controlProps(props: object): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...props };
  for (const key of SHELL_KEYS) delete rest[key];
  return rest;
}

/** Text input; with `multiline` it is a textarea. */
export function TextField(props: TextFieldProps | TextAreaFieldProps) {
  const { label, help, error, className, id } = props;
  const { inputId, helpId, errorId, described } = useFieldIds(id, help, error);
  const rest = controlProps(props);

  return (
    <FieldShell
      {...{ label, help, error, className, inputId, helpId, errorId }}
    >
      {props.multiline ? (
        <textarea
          rows={3}
          {...rest}
          id={inputId}
          className="campo__input"
          {...described}
        />
      ) : (
        <input
          type="text"
          {...rest}
          id={inputId}
          className="campo__input"
          {...described}
        />
      )}
    </FieldShell>
  );
}

export type SelectFieldProps = FieldShellProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "className">;

/** Select with the `chevron-down` arrow. Children are the `<option>` elements. */
export function SelectField({
  label,
  help,
  error,
  className,
  id,
  children,
  ...rest
}: SelectFieldProps) {
  const { inputId, helpId, errorId, described } = useFieldIds(id, help, error);
  return (
    <FieldShell
      {...{ label, help, error, className, inputId, helpId, errorId }}
    >
      <div className="campo__select-box">
        <select {...rest} id={inputId} className="campo__input" {...described}>
          {children}
        </select>
        <Icon name="chevron-down" size="s" />
      </div>
    </FieldShell>
  );
}

export type DateFieldProps = Omit<TextFieldProps, "type" | "multiline">;

/** `type="date"`. The value is `YYYY-MM-DD` (calendar day in Europe/Rome). */
export function DateField(props: DateFieldProps) {
  return <TextField {...props} type="date" />;
}

/** `type="time"`. The value is `HH:MM`, 24 h (Europe/Rome). */
export function TimeField(props: DateFieldProps) {
  return <TextField {...props} type="time" step={props.step ?? 60} />;
}

/** Two fields side by side (`.campo-doppio`). */
export function FieldPair({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("campo-doppio", className)}>{children}</div>;
}
