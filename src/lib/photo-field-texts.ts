/** Texts and limits of `PhotoField` (#460). */

export const PHOTO_FIELD_LABEL = "Foto";
export const PHOTO_FIELD_HELP = "Solo l'animale, senza persone.";
export const PHOTO_PICK_LABEL = "Scegli una foto";
export const PHOTO_CHANGE_LABEL = "Cambia la foto";
export const PHOTO_REMOVE_LABEL = "Togli la foto";

/** Formats the field offers; the server reduces the copy (see `shop-photo.ts`). */
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";
export const PHOTO_TYPES: readonly string[] = PHOTO_ACCEPT.split(",");

export const PHOTO_TYPE_ERROR =
  "Questo file non si apre: scegli una foto JPEG, PNG o WebP.";
export const PHOTO_REDUCE_ERROR =
  "Non riusciamo a usare questa foto: provane un'altra.";
