import { HOUSEHOLD_FULL_MESSAGE } from "@/lib/household-limits";

/**
 * Texts and limits of the member sheet (`MemberSheet`), in a module without
 * "use client" so that server code and the sheet of a child's profile (#31)
 * import real values from it (LEZIONI). `MemberSheet` itself reads them from
 * here: one place for the words.
 */

/** Longest name of a member, as in the database check. */
export const MEMBER_NAME_MAX_LENGTH = 40;

export const MEMBER_NAME_ERROR = "Scrivi il nome per continuare.";
export const MEMBER_DATE_ERROR =
  "Questa data è nel futuro: scegli un giorno fino a oggi.";
export const MEMBER_COLOR_TAKEN_ERROR =
  "Questo colore l'ha appena preso qualcun altro: scegline un altro.";

/** Why saving a member failed: unreachable, other failure, Nest with 10 members. */
export type MemberFailure = "network" | "server" | "full";

export const MEMBER_FAILURE_TEXT: Record<MemberFailure, string> = {
  network: "Non siamo riusciti a salvare. Controlla la connessione e riprova.",
  server:
    "Non siamo riusciti a salvare per un problema nostro. Riprova tra qualche minuto.",
  full: HOUSEHOLD_FULL_MESSAGE,
};

export const MEMBER_NAME_LABEL = "Nome";
export const MEMBER_NAME_PLACEHOLDER = "Come si chiama?";
export const MEMBER_KIND_LABEL = "Chi è";
export const MEMBER_BIRTH_LABEL = "Data di nascita";
export const MEMBER_BIRTH_HELP =
  "Serve a calcolare l'età e a ricordare il compleanno.";
export const MEMBER_COLOR_LABEL = "Colore";
export const MEMBER_COLOR_HELP = "I colori spenti sono già di qualcun altro.";
export const MEMBER_SAVE_LABEL = "Salva le modifiche";
