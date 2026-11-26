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
  memberColors: {
    pomodoro: "Corallo",
    glicine: "Glicine",
    salvia: "Menta",
    cobalto: "Blu",
    zafferano: "Ambra",
    lampone: "Sabbia",
    ceruleo: "Azzurro",
    peonia: "Rosa",
    basilico: "Ardesia",
    cannella: "Cannella",
  },
} satisfies MessageTree;
