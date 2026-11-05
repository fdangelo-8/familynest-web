import { calendarDaysUntil, dayAndMonth, formatTime } from "@/lib/datetime";

/*
 * The clock phrases of «Calendari collegati», always in Europe/Rome and with
 * the functions of `src/lib/datetime.ts` (hours without a leading zero).
 */

/** `oggi alle 15:48`, `ieri alle 15:48`, `il 18 ottobre alle 15:48`. */
export function atText(value: string, now: Date): string {
  const days = calendarDaysUntil(value, now);
  const time = formatTime(value);
  if (days === 0) return `oggi alle ${time}`;
  if (days === -1) return `ieri alle ${time}`;
  return `il ${dayAndMonth(value, now)} alle ${time}`;
}

/** `dalle 13:10`, `da ieri alle 13:10`, `dal 19 ottobre alle 13:10`. */
export function sinceText(value: string, now: Date): string {
  const days = calendarDaysUntil(value, now);
  const time = formatTime(value);
  if (days === 0) return `dalle ${time}`;
  if (days === -1) return `da ieri alle ${time}`;
  return `dal ${dayAndMonth(value, now)} alle ${time}`;
}

/** `alle 13:10` when it was today, otherwise like `atText`. */
export function updatedText(value: string, now: Date): string {
  return atText(value, now).replace(/^oggi /, "");
}
