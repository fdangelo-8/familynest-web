"use client";

import type { Ref } from "react";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon/Icon";

/**
 * Mail field of the sign-in screens. No `name`: a native submit before the
 * scripts have loaded must not put the address in the URL. `username` is the
 * value password managers use to recognise the account.
 */
export function MailField({
  id,
  value,
  onChange,
  error,
  inputRef,
  readOnly,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Error text, shown after the submit */
  error?: string | null;
  inputRef?: Ref<HTMLInputElement>;
  readOnly?: boolean;
}) {
  const errorId = error ? `${id}-errore` : undefined;
  return (
    <div className={cx("campo", error && "campo--errore")}>
      <label className="campo__etichetta" htmlFor={id}>
        La tua mail
      </label>
      <input
        ref={inputRef}
        id={id}
        className="campo__input"
        type="email"
        autoComplete="username"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="nome@esempio.it"
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
      />
      {error ? (
        <p className="campo__errore" id={errorId}>
          <Icon name="circle-alert" size="s" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
