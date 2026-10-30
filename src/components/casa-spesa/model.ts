import type { MemberColor } from "@/components/ui/Avatar/Avatar";

/** A thing on the shopping list, as the page shows it. */
export type ShoppingItem = {
  /** Stable React key: the server id, or the temporary id for a new item */
  key: string;
  /** Server id (a temporary `tmp-` id until the insert is confirmed) */
  id: string;
  name: string;
  quantity: string | null;
  /** null = still to buy */
  checkedAt: string | null;
  createdAt: string;
  authorId: string | null;
};

export type ShoppingMember = {
  id: string;
  name: string;
  color: MemberColor;
  kind: "adult" | "child" | "pet";
};

export const COMMON_THINGS = [
  "Latte",
  "Pane",
  "Uova",
  "Frutta",
  "Caffè",
  "Carta igienica",
] as const;

/** Below this many things to buy, "Le più comuni" is shown (#43 point 19). */
export const FEW_THINGS_LIMIT = 3;

/** Comparison key for duplicates: same cleaning as the quick field, no case. */
export function nameKey(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLocaleLowerCase("it-IT");
}

function timeValue(value: string | null): number {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareTime(a: string | null, b: string | null): number {
  return timeValue(a) - timeValue(b) || compareStrings(a ?? "", b ?? "");
}

/** "Da prendere": oldest first. */
export function byCreation(a: ShoppingItem, b: ShoppingItem): number {
  return compareTime(a.createdAt, b.createdAt) || compareStrings(a.id, b.id);
}

/** "Presi": last taken first. */
export function byLastTaken(a: ShoppingItem, b: ShoppingItem): number {
  return compareTime(b.checkedAt, a.checkedAt) || compareStrings(a.id, b.id);
}

export function thingsLabel(count: number): string {
  return count === 1 ? "1 cosa" : `${count} cose`;
}
