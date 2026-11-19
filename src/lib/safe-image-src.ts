/**
 * Which addresses an avatar photo may use (#482). The address ends up in an
 * `img` `src`, so only these are accepted:
 * - `blob:` (the preview of the file just chosen);
 * - `data:image/webp` or `data:image/jpeg` (the reduced copy of the server);
 * - a path of this same site, starting with a single `/`.
 * Anything else is refused and the avatar shows the initial.
 */
const DATA_IMAGE = /^data:image\/(?:webp|jpeg)(?:;base64)?,[A-Za-z0-9+/=%_-]*$/;
const BLOB = /^blob:[A-Za-z0-9:/._-]+$/;
const SAME_SITE_PATH = /^\/(?![/\\])[^\s\\"'<>`]*$/;

export function safeImageSrc(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (
    DATA_IMAGE.test(value) ||
    BLOB.test(value) ||
    SAME_SITE_PATH.test(value)
  ) {
    return value;
  }
  return undefined;
}
