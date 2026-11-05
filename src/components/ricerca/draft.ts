/**
 * The text of the field, kept in memory of this browser tab while the search
 * is open, so that crossing 1024 px (palette ↔ page) does not lose it (issue
 * #40, specification §2). Never saved anywhere and never sent: it is emptied
 * as soon as the search closes.
 */

let draft = "";

export function readDraft(): string {
  return draft;
}

export function writeDraft(text: string): void {
  draft = text;
}

/**
 * The search closed. The emptying waits one tick: a search that is replaced by
 * its other shape (palette ↔ page) reads the text in the same moment.
 */
export function releaseDraft(): void {
  window.setTimeout(() => {
    draft = "";
  }, 0);
}
