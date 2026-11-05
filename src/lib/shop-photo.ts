import "server-only";
import sharp from "sharp";

/**
 * The reduced copy of the photo of a shop (#32 §5): longest side 320 px, WebP,
 * at most 100 KB (the limit of the database). Server only.
 *
 * The copy is made from the pixels only: `sharp` writes no metadata unless
 * asked, so EXIF (camera, GPS position, dates), XMP and IPTC of the original
 * never reach the copy; the orientation is applied first (`rotate()`), so the
 * picture still looks right. The result is checked once more before it is
 * returned.
 */

export const PHOTO_MAX_SIDE = 320;
export const PHOTO_MAX_BYTES = 100 * 1024;
/** Pictures with more pixels than this are refused before decoding. */
const PHOTO_MAX_INPUT_PIXELS = 40_000_000;
const QUALITIES = [80, 68, 56, 44, 32] as const;

export type ReducedPhoto = { contentType: "image/webp"; data: Buffer };

/** The reduced copy, or null if the image cannot be read or is too heavy. */
export async function reduceShopPhoto(
  input: Buffer,
): Promise<ReducedPhoto | null> {
  try {
    for (const quality of QUALITIES) {
      const data = await sharp(input, {
        limitInputPixels: PHOTO_MAX_INPUT_PIXELS,
        failOn: "error",
      })
        .rotate()
        .resize({
          width: PHOTO_MAX_SIDE,
          height: PHOTO_MAX_SIDE,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality })
        .toBuffer();
      if (data.length > PHOTO_MAX_BYTES) continue;
      const meta = await sharp(data).metadata();
      // Defence in depth: no metadata blocks in the copy.
      if (meta.format !== "webp" || meta.exif || meta.xmp || meta.iptc) {
        return null;
      }
      return { contentType: "image/webp", data };
    }
    return null;
  } catch {
    return null;
  }
}
