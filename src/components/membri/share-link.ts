export type ShareOutcome = "shared" | "aborted" | "copied" | "failed";

/**
 * Opens the system share sheet with the link only (no title, no text). If the
 * browser cannot share, or fails for a reason other than the user closing the
 * sheet, copies the link instead. Closing the sheet is not an error.
 */
export async function shareOrCopy(url: string): Promise<ShareOutcome> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ url });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return "aborted";
      }
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
