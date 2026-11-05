/**
 * Text handed from one page to the Add sheet (issue #40: «aggiungilo» in the
 * search opens Add with what was searched already written).
 *
 * The text lives only in memory: never in the address (no `?`), never in
 * `localStorage`, never on the server. It is read once: `takeAddText` gives
 * it back and empties the module, so a second sheet opened later starts
 * empty.
 */

import type { AddType } from "@/components/aggiungi/detect-type";

export type AddTextHandoff = {
  text: string;
  /** Type the sheet starts with, as if the person had tapped it */
  type?: AddType;
};

/** Longest text handed over: the sheet's field has no limit, a search has 100. */
const MAX_LENGTH = 200;

let pending: AddTextHandoff | null = null;

/** Leaves a text for the next Add sheet. An empty text leaves nothing. */
export function setAddText(handoff: AddTextHandoff): void {
  const text = handoff.text.trim().slice(0, MAX_LENGTH);
  pending = text === "" ? null : { text, type: handoff.type };
}

/** Reads the text left by `setAddText` once, and empties the module. */
export function takeAddText(): AddTextHandoff | null {
  const handoff = pending;
  pending = null;
  return handoff;
}

/** Throws away a text nobody read (the person went elsewhere). */
export function dropAddText(): void {
  pending = null;
}
