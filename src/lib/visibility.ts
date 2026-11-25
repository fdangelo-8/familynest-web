/**
 * Visibility values as the database can return them. `selected` (only some
 * people see the details, #510) has no screen yet: until the pages for it
 * exist (A2–A4) it reads as the narrowest word that already exists, «Solo io».
 * Accepts the values of any database version (with or without `selected`).
 */
export type StoredVisibility = "private" | "busy" | "selected" | "household";

export function narrowVisibility(
  value: StoredVisibility,
): "private" | "busy" | "household" {
  return value === "busy" || value === "household" ? value : "private";
}
