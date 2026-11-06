"use client";

import {
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type Ref,
} from "react";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  isPasswordLengthValid,
} from "@/lib/auth/password";
import { cx } from "../cx";
import { Icon } from "../Icon/Icon";
import { VisuallyHidden } from "../VisuallyHidden/VisuallyHidden";

export type PasswordFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "children" | "type" | "value" | "autoComplete"
> & {
  /** Required visible label, linked to the control */
  label: string;
  /** Always controlled: the rules read it while the person types */
  value: string;
  /** `current-password` to sign in, `new-password` to register or change it */
  autoComplete: "current-password" | "new-password";
  /** Error text. The page decides when to show it (after submit, not while typing). */
  error?: string;
  /** Shows the visible rule «Da 8 a 72 caratteri» under the field */
  rules?: boolean;
  /**
   * Password shown as text. Optional: without it the field keeps its own
   * state. A page passes it to hide the password again on submit, when the
   * mode changes or when the screen changes.
   */
  shown?: boolean;
  onShownChange?: (shown: boolean) => void;
  /** Ref of the `<input>`, to move the focus to the first wrong field */
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
};

/**
 * Password field with show/hide button and, optionally, the visible rule
 * (#327). One `<input>` only: the type switches between `password` and `text`.
 */
export function PasswordField({
  label,
  value,
  autoComplete,
  error,
  rules,
  shown,
  onShownChange,
  inputRef,
  className,
  id,
  ...rest
}: PasswordFieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const errorId = error ? `${inputId}-errore` : undefined;
  const rulesId = rules ? `${inputId}-regole` : undefined;
  const describedBy = [errorId, rulesId].filter(Boolean).join(" ") || undefined;
  const [ownShown, setOwnShown] = useState(false);
  const visible = shown ?? ownShown;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const fulfilled = isPasswordLengthValid(value);

  function toggle() {
    const next = !visible;
    if (shown === undefined) setOwnShown(next);
    onShownChange?.(next);
    // Safari does not focus a button on click: the focus stays on the toggle.
    toggleRef.current?.focus();
  }

  return (
    <div className={cx("campo", error && "campo--errore", className)}>
      <label className="campo__etichetta" htmlFor={inputId}>
        {label}
      </label>
      <div className="campo-password">
        <input
          {...rest}
          ref={inputRef}
          id={inputId}
          className="campo__input"
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          spellCheck={false}
          autoCapitalize="none"
          {...(autoComplete === "new-password"
            ? { passwordrules: "minlength: 8; maxlength: 72;" }
            : {})}
          value={value}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
        />
        <button
          ref={toggleRef}
          type="button"
          className="campo-password__mostra"
          aria-label="Mostra la password"
          aria-pressed={visible}
          aria-controls={inputId}
          disabled={rest.disabled}
          onClick={toggle}
        >
          <Icon name={visible ? "eye-off" : "eye"} />
        </button>
      </div>
      {error ? (
        <p className="campo__errore" id={errorId}>
          <Icon name="circle-alert" size="s" />
          {error}
        </p>
      ) : null}
      {rules ? (
        <ul className="regole-password" id={rulesId}>
          <li
            className={cx(
              "regole-password__regola",
              fulfilled && "regole-password__regola--rispettata",
            )}
          >
            {fulfilled ? (
              <Icon name="check" size="s" />
            ) : (
              <span className="regole-password__segno" aria-hidden="true" />
            )}
            {`Da ${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caratteri`}
            {fulfilled ? <VisuallyHidden>, fatto</VisuallyHidden> : null}
          </li>
        </ul>
      ) : null}
    </div>
  );
}
