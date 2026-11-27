import { BRAND } from "@/lib/brand";

/**
 * The written mark: «family» (400) and «nest» (700), in the colour of the text
 * around it, so it works on light and dark backgrounds. The accessible name is
 * the full product name, not the lowercase mark. Size comes from the place
 * where it is used.
 */
export function Brand() {
  return (
    <span
      className="marchio marchio--scritta"
      role="img"
      aria-label={BRAND.full}
    >
      <span className="marchio__famiglia">{BRAND.wordmark.family}</span>
      <span className="marchio__nido">{BRAND.wordmark.nest}</span>
    </span>
  );
}
