/**
 * Base messages shared by the whole app. Keys in English, values in Italian.
 * Plain strings and plural forms only: no functions, no JSX, no data access.
 */

import type { MessageTree } from "./types";

export const it = {
  loading: "Caricamento in corso",
  close: "Chiudi",
  back: "Indietro",
  cancel: "Annulla",
  retry: "Riprova",
} satisfies MessageTree;
