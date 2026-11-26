import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
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
  /** Set by `FieldGroup`: the field loses its own box. Do not pass it by hand. */
  grouped?: boolean;
  /** Set by `FieldGroup`: id of the error text under the block. Do not pass it by hand. */
  groupErrorId?: string;
};

type Described = { "aria-describedby"?: string; "aria-invalid"?: true };

function useFieldIds(
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
function FieldShell({
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
  children,
}: FieldShellProps & {
  inputId: string;
  helpId?: string;
  errorId?: string;
  /** The label stays up (date, time, select, text area, own placeholder) */
  always?: boolean;
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
      {error && !groupErrorId ? (
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

const SHELL_KEYS = [
  "label",
  "help",
  "error",
  "className",
  "multiline",
  "grouped",
  "groupErrorId",
];

/** Types whose native control always shows a format or a value. */
const ALWAYS_UP_TYPES = new Set(["date", "time", "datetime-local", "month"]);

/** Props that belong to the control itself, without the field wrapper ones. */
function controlProps(props: object): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...props };
  for (const key of SHELL_KEYS) delete rest[key];
  return rest;
}

/** Text input; with `multiline` it is a textarea. */
export function TextField(props: TextFieldProps | TextAreaFieldProps) {
  const { label, help, error, className, id, grouped, groupErrorId } = props;
  const { inputId, helpId, errorId, described } = useFieldIds(
    id,
    help,
    error,
    groupErrorId,
  );
  const rest = controlProps(props);
  const type = props.multiline ? undefined : (props.type ?? "text");
  // The label can sit on the value only when the field has no placeholder
  // of its own and shows nothing by itself (a blank placeholder tells CSS
  // when the field is empty).
  const always =
    props.multiline ||
    props.placeholder !== undefined ||
    (type !== undefined && ALWAYS_UP_TYPES.has(type));

  return (
    <FieldShell
      {...{
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
      }}
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
          placeholder=" "
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
  grouped,
  groupErrorId,
  children,
  ...rest
}: SelectFieldProps) {
  const { inputId, helpId, errorId, described } = useFieldIds(
    id,
    help,
    error,
    groupErrorId,
  );
  return (
    <FieldShell
      {...{
        label,
        help,
        error,
        className,
        inputId,
        helpId,
        errorId,
        grouped,
        groupErrorId,
      }}
      always
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

type GroupChildProps = {
  error?: string;
  columns?: boolean;
  children?: ReactNode;
};

/** First error text among the fields of a group, nested rows included. */
function firstGroupError(children: ReactNode): string | undefined {
  let found: string | undefined;
  Children.forEach(children, (child) => {
    if (found || !isValidElement<GroupChildProps>(child)) return;
    if (child.props.error) found = child.props.error;
    else if (child.props.columns) found = firstGroupError(child.props.children);
  });
  return found;
}

/** Hands the box and the id of the error text to the fields of a group. */
function linkGroupChildren(children: ReactNode, errorId: string): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement<GroupChildProps>(child)) return child;
    return child.props.columns
      ? cloneElement(child as ReactElement<{ groupErrorId?: string }>, {
          groupErrorId: errorId,
        })
      : cloneElement(
          child as ReactElement<{ grouped?: boolean; groupErrorId?: string }>,
          { grouped: true, groupErrorId: errorId },
        );
  });
}

/**
 * Joined fields (`.campo-unito`): one box with a thin line between the
 * fields, which lose their own border. Focus and error concern only the field
 * involved. The error text of the first wrong field sits under the block and
 * is linked to that field with `aria-describedby`: the page passes `error` to
 * the wrong field as usual.
 *
 * `columns` puts the fields side by side. Inside another `FieldGroup` it is a
 * row of that block (for example expiry and code of a card).
 */
export function FieldGroup({
  children,
  columns,
  groupErrorId,
  className,
}: {
  children: ReactNode;
  columns?: boolean;
  /** Set by the outer `FieldGroup` on a row. Do not pass it by hand. */
  groupErrorId?: string;
  className?: string;
}) {
  const generated = useId();
  if (groupErrorId !== undefined) {
    return (
      <div className="campo-unito__colonne">
        {linkGroupChildren(children, groupErrorId)}
      </div>
    );
  }
  const errorId = `${generated}-errore`;
  const error = firstGroupError(children);
  return (
    <div className={cx("campo-gruppo", className)}>
      <div className={cx("campo-unito", columns && "campo-unito--colonne")}>
        {linkGroupChildren(children, errorId)}
      </div>
      {error ? (
        <p className="campo__errore" id={errorId}>
          <Icon name="circle-alert" size="s" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
