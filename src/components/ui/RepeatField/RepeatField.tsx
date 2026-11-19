import {
  REPEAT_DAYS_HELP,
  REPEAT_DAYS_LABEL,
  REPEAT_EVERY_N_DAYS,
  REPEAT_LABEL,
  REPEAT_OPTIONS,
  type RepeatKind,
} from "@/lib/repeat-options";
import { SelectField, TextField } from "../Field/Field";

export type RepeatFieldProps = {
  /** `deadline`: Mai … Ogni … giorni; `todo`: Mai, Ogni giorno, Giorni scelti */
  kind: RepeatKind;
  /** The chosen option (a `value` of `REPEAT_OPTIONS[kind]`) */
  value: string;
  onChange: (value: string) => void;
  /** With «Ogni … giorni»: the number written in «Quanti giorni» (as text) */
  days?: string;
  onDaysChange?: (days: string) => void;
  /** Error of the number, under «Quanti giorni» */
  daysError?: string;
  /** Hint under «Si ripete», for example «L'intervallo lo decide il vostro veterinario.» */
  help?: string;
  /** Error under «Si ripete» */
  error?: string;
  label?: string;
  disabled?: boolean;
  /** `id` of the select (the page moves the focus to it) */
  id?: string;
  /** `id` of the number field */
  daysId?: string;
  className?: string;
};

/**
 * «Si ripete»: the `SelectField` of mockup 11, plus «Quanti giorni» when the
 * choice is «Ogni … giorni». The number disappears (and is lost) when another
 * choice is made: the page clears `days` in `onChange`.
 */
export function RepeatField({
  kind,
  value,
  onChange,
  days = "",
  onDaysChange,
  daysError,
  help,
  error,
  label = REPEAT_LABEL,
  disabled,
  id,
  daysId,
  className,
}: RepeatFieldProps) {
  const showDays = kind === "deadline" && value === REPEAT_EVERY_N_DAYS;
  return (
    <>
      <SelectField
        id={id}
        label={label}
        help={help}
        error={error}
        className={className}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {REPEAT_OPTIONS[kind].map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
      {showDays ? (
        <TextField
          id={daysId}
          label={REPEAT_DAYS_LABEL}
          help={REPEAT_DAYS_HELP}
          error={daysError}
          inputMode="numeric"
          autoComplete="off"
          value={days}
          disabled={disabled}
          onChange={(event) => onDaysChange?.(event.target.value)}
        />
      ) : null}
    </>
  );
}
