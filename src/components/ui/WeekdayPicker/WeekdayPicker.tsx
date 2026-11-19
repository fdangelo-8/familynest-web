import { useId, type Ref } from "react";
import { cx } from "../cx";
import { Chip, ChipGroup } from "../Chip/Chip";
import { Icon } from "../Icon/Icon";

/** Weekdays from Monday: ISO number (1 = Monday … 7 = Sunday), short and full name. */
export const WEEKDAYS = [
  { day: 1, short: "Lun", full: "lunedì" },
  { day: 2, short: "Mar", full: "martedì" },
  { day: 3, short: "Mer", full: "mercoledì" },
  { day: 4, short: "Gio", full: "giovedì" },
  { day: 5, short: "Ven", full: "venerdì" },
  { day: 6, short: "Sab", full: "sabato" },
  { day: 7, short: "Dom", full: "domenica" },
] as const;

export type WeekdayPickerProps = {
  /** Chosen days, ISO numbers 1-7 */
  value: readonly number[];
  /** New chosen days, always in week order */
  onChange: (days: number[]) => void;
  label?: string;
  /** Error text, for example «Scegli almeno un giorno.» */
  error?: string;
  disabled?: boolean;
  /** Ref of the first chip (Lunedì), where the page moves the focus on an error */
  firstChipRef?: Ref<HTMLButtonElement>;
  className?: string;
  "data-testid"?: string;
};

/**
 * «Giorni»: seven chips from Monday (`.scelta-giorni`). Each chip is a toggle
 * with the full name («lunedì») as accessible name. The grid goes to four
 * columns when the container is narrow (large text).
 */
export function WeekdayPicker({
  value,
  onChange,
  label = "Giorni",
  error,
  disabled,
  firstChipRef,
  className,
  "data-testid": testId,
}: WeekdayPickerProps) {
  const id = useId();
  const labelId = `${id}-etichetta`;
  const errorId = error ? `${id}-errore` : undefined;

  function toggle(day: number) {
    const next = value.includes(day)
      ? value.filter((chosen) => chosen !== day)
      : [...value, day];
    onChange([...next].sort((a, b) => a - b));
  }

  return (
    <div
      className={cx("campo", error && "campo--errore", className)}
      data-testid={testId}
    >
      <span className="campo__etichetta" id={labelId}>
        {label}
      </span>
      <div className="contenitore-selettore">
        <ChipGroup
          aria-labelledby={labelId}
          aria-describedby={errorId}
          className="scelta-giorni"
        >
          {WEEKDAYS.map(({ day, short, full }) => (
            <Chip
              key={day}
              aria-label={full}
              pressed={value.includes(day)}
              disabled={disabled}
              onClick={() => toggle(day)}
              buttonRef={day === 1 ? firstChipRef : undefined}
            >
              {short}
            </Chip>
          ))}
        </ChipGroup>
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
