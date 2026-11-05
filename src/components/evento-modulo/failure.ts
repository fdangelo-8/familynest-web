/** Why a save of an event did not go through, as the page tells it. */
export type FailureReason =
  /** The event is gone (deleted by someone else) */
  | "missing"
  /** Another occurrence of the series starts on that day */
  | "day-taken"
  /** The escort does not see the event: only with «Tutti i prossimi» */
  | "escort"
  /** A repeated event lasts at most 7 days */
  | "duration"
  /** Network or any other failure: nothing is told about it */
  | "failed";

type DbError = { code?: string | null; message?: string | null };

/** Maps a database error to what the page tells the user. */
export function failureReason(error: DbError): FailureReason {
  const message = error.message ?? "";
  if (error.code === "P0002") return "missing";
  if (
    error.code === "P0001" &&
    message.includes("another occurrence of the event starts on that day")
  ) {
    return "day-taken";
  }
  if (error.code === "42501" && message.includes("must already see")) {
    return "escort";
  }
  if (message.includes("events_repeated_duration")) return "duration";
  return "failed";
}
