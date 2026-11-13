/**
 * Texts of the Notifiche page (#39), in a module without "use client" so the
 * server pages and the client components read the same words.
 */

export const PAGE_TITLE = "Notifiche";
export const MARK_ALL_LABEL = "Segna tutte come lette";
export const MARK_ALL_DONE_ANNOUNCEMENT =
  "Tutte le notifiche sono segnate come lette.";

export const EMPTY_TITLE = "Tutto tranquillo";
export const EMPTY_TEXT =
  "Quando qualcuno ti assegna una cosa o si avvicina una scadenza, lo trovi qui.";

export const DIGEST_ERROR =
  "Non riusciamo a caricare la sintesi di oggi. Controlla la connessione e riprova.";

export const TODO_GONE =
  "Questa cosa da fare non c'è più. Forse l'ha eliminata chi l'aveva creata.";

/** Why a request failed: no connection, or an answer of the server. */
export type Failure = "network" | "server";

export const MARK_ALL_FAILURE: Record<Failure, string> = {
  network:
    "Non siamo riusciti a segnare le notifiche come lette. Controlla la connessione e riprova.",
  server:
    "Non siamo riusciti a segnare le notifiche come lette per un problema nostro. Riprova tra qualche minuto.",
};

export function doneFailureText(title: string, failure: Failure): string {
  return failure === "network"
    ? `Non siamo riusciti a segnare come fatto «${title}». Controlla la connessione e riprova.`
    : `Non siamo riusciti a segnare come fatto «${title}» per un problema nostro. Riprova tra qualche minuto.`;
}

/** Standard text of the design system for a save that did not work. */
export const UNDO_FAILURE: Record<Failure, string> = {
  network: "Non siamo riusciti a salvare. Controlla la connessione e riprova.",
  server:
    "Non siamo riusciti a salvare per un problema nostro. Riprova tra qualche minuto.",
};

export function offlineText(time: string): string {
  return `Sei offline: vedi le notifiche arrivate fino alle ${time}.`;
}

/** `1 nuova`, `3 nuove`. */
export function newLabel(count: number): string {
  return count === 1 ? "1 nuova" : `${count} nuove`;
}
