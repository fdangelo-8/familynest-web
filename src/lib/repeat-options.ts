/**
 * The choices of the «Si ripete» field (`RepeatField`, #460): one source for
 * the sheets. The values are only names of the choices; what the database
 * stores is decided by the page that saves.
 */

export type RepeatKind = "deadline" | "todo";

export type RepeatOption = { value: string; label: string };

export const REPEAT_LABEL = "Si ripete";

export const REPEAT_DAYS_LABEL = "Quanti giorni";
export const REPEAT_DAYS_HELP = "Da 1 a 365.";

export const REPEAT_NEVER = "never";

/** Choice of a deadline that comes back every N days (needs the number). */
export const REPEAT_EVERY_N_DAYS = "every-n-days";

/** Choice of a thing to do that comes back on the days picked. */
export const REPEAT_CHOSEN_DAYS = "chosen-days";

export const REPEAT_OPTIONS: Record<RepeatKind, readonly RepeatOption[]> = {
  deadline: [
    { value: REPEAT_NEVER, label: "Mai" },
    { value: "monthly", label: "Ogni mese" },
    { value: "every-3-months", label: "Ogni 3 mesi" },
    { value: "every-6-months", label: "Ogni 6 mesi" },
    { value: "yearly", label: "Ogni anno" },
    { value: REPEAT_EVERY_N_DAYS, label: "Ogni … giorni" },
  ],
  todo: [
    { value: REPEAT_NEVER, label: "Mai" },
    { value: "daily", label: "Ogni giorno" },
    { value: REPEAT_CHOSEN_DAYS, label: "Giorni scelti" },
  ],
};
