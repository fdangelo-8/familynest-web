import { MEMBER_COLORS } from "@/components/ui/Avatar/Avatar";

/**
 * Most members (adults, children, pets) one Nest can have (#74): one distinct
 * colour for each. Must stay equal to the limit in the database trigger.
 */
export const MAX_HOUSEHOLD_MEMBERS = MEMBER_COLORS.filter(
  (color) => color !== "insieme",
).length;

/** Text shown wherever a form reports a full Nest. Never the technical message. */
export const HOUSEHOLD_FULL_MESSAGE =
  "Il Nest è al completo: ci stanno al massimo 10 tra persone e animali.";

/** Technical message raised by the database trigger (code P0001). */
const HOUSEHOLD_FULL_DB_MESSAGE = "household member limit reached";

/** True only for the error the database raises when the Nest already has 10 members. */
export function isHouseholdFullError(
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  return (
    error?.code === "P0001" &&
    typeof error.message === "string" &&
    error.message.includes(HOUSEHOLD_FULL_DB_MESSAGE)
  );
}
