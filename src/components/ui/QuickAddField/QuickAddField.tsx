"use client";

import { useId, type FormEvent } from "react";
import { cx } from "../cx";
import { Icon } from "../Icon/Icon";

/** Trims the text and turns every run of spaces into a single space. */
export function cleanQuickText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export type QuickAddFieldProps = {
  /** Hidden label, name of the form and placeholder, all the same sentence */
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Called with the cleaned text on Enter, only if it is not empty */
  onSubmit: (text: string) => void;
  maxLength?: number;
  /** Forces the active look (empty state of Spesa) */
  active?: boolean;
  id?: string;
  name?: string;
  className?: string;
  "data-testid"?: string;
};

/** "Add on the fly" field (`.campo-rapido`): one line, Enter adds. */
export function QuickAddField({
  label,
  value,
  onChange,
  onSubmit,
  maxLength = 80,
  active,
  id,
  name,
  className,
  "data-testid": testId,
}: QuickAddFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = cleanQuickText(value);
    if (!text) return;
    onSubmit(text);
    onChange("");
  };

  return (
    <form
      className={cx(
        "campo-rapido",
        (active || value !== "") && "campo-rapido--attivo",
        className,
      )}
      aria-label={label}
      onSubmit={handleSubmit}
      data-testid={testId}
    >
      <span className="campo-rapido__piu">
        <Icon name="plus" />
      </span>
      <label className="visivamente-nascosto" htmlFor={inputId}>
        {label}
      </label>
      <input
        className="campo-rapido__input"
        type="text"
        id={inputId}
        name={name}
        placeholder={label}
        maxLength={maxLength}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <span />
    </form>
  );
}
