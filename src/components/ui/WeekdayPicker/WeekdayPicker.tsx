import { useId, type Ref } from "react";
import { it } from "@/lib/i18n/messages/it";
import { cx } from "../cx";
import { Chip, ChipGroup } from "../Chip/Chip";
import { Icon } from "../Icon/Icon";

const names = it.choicesPeople.weekdays;

/**
 * Weekdays from Monday: ISO number (1 = Monday … 7 = Sunday), short and full
 * name. The texts come from `it.ts` (F4b, #504).
 */
export const WEEKDAYS = [
  { day: 1, ...names.mon },
  { day: 2, ...names.tue },
  { day: 3, ...names.wed },
  { day: 4, ...names.thu },
  { day: 5, ...names.fri },
  { day: 6, ...names.sat },
  { day: 7, ...names.sun },
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
 * with the visible word first and the full name after it («Lun, lunedì»: axe
 * wants the visible word whole in the name, «lunedì» alone fails). The grid goes to four
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
              aria-label={`${short}, ${full}`}
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
