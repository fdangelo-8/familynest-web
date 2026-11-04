import { joinNames } from "@/lib/spaces";

/**
 * Words of the confirmation dialog when someone leaves a Nest («Esci da…»,
 * #41) or deletes their account (#38). One function for both pages (LEZIONI
 * #193): the case «last adult with an account» is decided here, so the two
 * pages never say different things. A plain module, without "use client".
 *
 * Decision of Francesco (04/11): when the last adult with an account goes
 * away the household is deleted. The confirm button says it («Esci e cancella
 * la casa») and the dialog adds no other explanation.
 */
export type LeaveDialogInput = {
  /** `leave`: «Esci da…» (#41). `delete-account`: «Elimina l'account» (#38). */
  action: "leave" | "delete-account";
  /** Name of the household, as written */
  householdName: string;
  /** True when no other adult has an account: the household goes away too */
  isLastAdultWithAccount: boolean;
  /**
   * `delete-account`, when the household stays: names of who stays, in order
   * of insertion. Adults (with or without account) and children, no pets.
   */
  remainingNames?: readonly string[];
  /**
   * `delete-account`, when the household stays and the one who leaves is its
   * only administrator: name of who becomes administrator (the adult with an
   * account who joined first).
   */
  newAdministratorName?: string | null;
};

export type LeaveDialogCopy = {
  title: string;
  text: string;
  /** Label of the red confirm button (the last button, «Annulla», is the dialog's) */
  confirmLabel: string;
  /** Shown in the dialog when the action fails */
  errorText: { network: string; server: string };
  /** The household is deleted too */
  deletesHousehold: boolean;
};

/** Label of the red button when the household is deleted with the last adult. */
export const DELETE_HOUSEHOLD_LABEL = "Esci e cancella la casa";

const LOSE_TEXT = "Perderai impegni, liste e impostazioni.";

/** Title, text, button and errors of the dialog for this situation. */
export function getLeaveDialogCopy(input: LeaveDialogInput): LeaveDialogCopy {
  const { householdName, isLastAdultWithAccount } = input;

  if (input.action === "delete-account") {
    const errorText = {
      network:
        "Non siamo riusciti a eliminare l'account. Controlla la connessione e riprova.",
      server:
        "Non siamo riusciti a eliminare l'account per un problema nostro. Non è cambiato niente: riprova tra qualche minuto.",
    };
    const title = "Eliminare il tuo account?";
    if (isLastAdultWithAccount) {
      return {
        title,
        text: `${LOSE_TEXT} Non si può annullare.`,
        confirmLabel: DELETE_HOUSEHOLD_LABEL,
        errorText,
        deletesHousehold: true,
      };
    }
    const names = joinNames(input.remainingNames ?? []);
    const manager = input.newAdministratorName
      ? `, e da ora la gestirà ${input.newAdministratorName}`
      : "";
    return {
      title,
      text: `${LOSE_TEXT} ${householdName} resterà a ${names}${manager}. Non si può annullare.`,
      confirmLabel: "Elimina l'account",
      errorText,
      deletesHousehold: false,
    };
  }

  const errorText = {
    network:
      "Non siamo riusciti a farti uscire dalla casa. Controlla la connessione e riprova.",
    server:
      "Non siamo riusciti a farti uscire dalla casa per un problema nostro. Riprova tra qualche minuto.",
  };
  const title = `Uscire da ${householdName}?`;
  if (isLastAdultWithAccount) {
    return {
      title,
      text: "Non vedrai più il calendario, la spesa e le cose da fare della casa. Non si può annullare.",
      confirmLabel: DELETE_HOUSEHOLD_LABEL,
      errorText,
      deletesHousehold: true,
    };
  }
  return {
    title,
    text: "Non vedrai più il calendario, la spesa e le cose da fare della casa. Potrai rientrare solo con un nuovo invito.",
    confirmLabel: "Esci dalla casa",
    errorText,
    deletesHousehold: false,
  };
}

/** Text of the toast after leaving: the name of the household goes in bold. */
export function getLeaveDoneToast(
  householdName: string,
  deletedHousehold: boolean,
): { lead?: string; text: string; emphasis?: string; after?: string } {
  return deletedHousehold
    ? { lead: householdName, text: "è stata cancellata." }
    : { text: "Non fai più parte di", emphasis: householdName, after: "." };
}

/** Note under «Esci da…» when it is disabled (the only administrator, case B). */
export const LEAVE_BLOCKED_NOTE =
  "Sei l'unica persona che gestisce la casa: prima di uscire, dai il ruolo di amministratore a un altro adulto in «Chi c’è».";

/** Label of the «Esci da…» button of the page. */
export function getLeaveButtonLabel(householdName: string): string {
  return `Esci da ${householdName}`;
}
