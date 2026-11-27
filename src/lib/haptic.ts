/**
 * The only door to vibration (#503, decision of 25/11, "App negli store",
 * strategy A). Components call `haptic(kind)` and nothing else: no file in
 * `src/` talks to the browser's vibration API.
 *
 * - `leggera`: a tick (check, choice, tap)
 * - `conferma`: something arrived (title received, end of the first start)
 * - `avviso`: attention (confirmation dialog, overlapping events)
 *
 * On the web it does nothing. In the native shell (N0–N5) the body will call
 * the plugin, with the same signature.
 */
export type HapticKind = "leggera" | "conferma" | "avviso";

export function haptic(kind: HapticKind): void {
  void kind;
}
