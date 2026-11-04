import type { IconName } from "@/components/ui/Icon/icon-paths";

/**
 * Sentences of the puntina (pin a space in Oggi), in one place for Esplora
 * (#28) and «In arrivo» (#29): the same words, never written twice (LEZIONI).
 * A plain module, without "use client". The shape fits `showToast`.
 */
export type PinToastKind =
  | "pinned"
  | "unpinned"
  | "limit"
  | "pin-failed"
  | "unpin-failed"
  /** «Annulla» of a pin that did not work: the space stays pinned */
  | "undo-failed-stays"
  /** «Annulla» of an unpin that did not work: the space is not pinned any more */
  | "undo-failed-gone";

export type PinToastText = {
  /** `null` = no icon */
  icon: IconName | null;
  /** Bold part before the text: the name of the space */
  lead?: string;
  text: string;
  /** Bold part after the text: the name of the space */
  emphasis?: string;
  /** Plain text right after `emphasis` */
  after?: string;
};

/** Text of the toast for `kind`, for the space called `name`. */
export function getPinToastText(
  kind: PinToastKind,
  name: string,
): PinToastText {
  switch (kind) {
    case "pinned":
      return { icon: "pin", lead: name, text: "fissato in fondo a Oggi." };
    case "unpinned":
      return { icon: "pin", lead: name, text: "tolto da Oggi." };
    case "limit":
      return {
        icon: null,
        text: "Puoi fissare al massimo sei spazi: togline uno per fissare",
        emphasis: name,
        after: ".",
      };
    case "pin-failed":
      return {
        icon: null,
        text: "Non siamo riusciti a fissare",
        emphasis: name,
        after: ". Riprova tra qualche secondo.",
      };
    case "unpin-failed":
      return {
        icon: null,
        text: "Non siamo riusciti a togliere",
        emphasis: name,
        after: ". Riprova tra qualche secondo.",
      };
    case "undo-failed-stays":
      return {
        icon: null,
        text: "Non siamo riusciti ad annullare:",
        emphasis: name,
        after: " resta in Oggi.",
      };
    case "undo-failed-gone":
      return {
        icon: null,
        text: "Non siamo riusciti ad annullare:",
        emphasis: name,
        after: " non è più in Oggi.",
      };
  }
}

/** Accessible name of the puntina: it changes with the state. */
export function getPinLabel(name: string, isPinned: boolean): string {
  return isPinned ? `Togli ${name} da Oggi` : `Fissa ${name} in Oggi`;
}
