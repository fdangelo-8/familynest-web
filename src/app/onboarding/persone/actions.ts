"use server";

import { MEMBER_COLORS } from "@/components/ui/Avatar/Avatar";
import type {
  MemberSaveResult,
  MemberValues,
} from "@/components/ui/MemberSheet/MemberSheet";
import { toDateFieldValue } from "@/lib/datetime";
import { isHouseholdFullError } from "@/lib/household-limits";
import { createClient } from "@/lib/supabase/server";

const MAX_NAME = 40;
const KINDS = ["adult", "child", "pet"] as const;
const COLOR_KEY = "household_members_household_color_key";

/** Reads what the browser sent and keeps only the allowed values. */
function parse(input: unknown): MemberValues | null {
  if (typeof input !== "object" || input === null) return null;
  const { name, kind, birthDate, color } = input as Record<string, unknown>;
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  const length = Array.from(trimmed).length;
  if (length < 1 || length > MAX_NAME) return null;
  if (!KINDS.some((k) => k === kind)) return null;
  // "insieme" is not a colour a person can have.
  if (color === "insieme" || !MEMBER_COLORS.some((c) => c === color)) {
    return null;
  }
  let date: string | null = null;
  if (birthDate !== null && birthDate !== undefined) {
    // Adults have no birth date (the database forbids it); never in the future.
    if (kind === "adult") return null;
    if (typeof birthDate !== "string") return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
    // Round trip: "2026-02-31" parses but is not a real day.
    const parsed = new Date(`${birthDate}T00:00:00Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== birthDate
    ) {
      return null;
    }
    if (birthDate > toDateFieldValue(new Date())) return null;
    date = birthDate;
  }
  return {
    name: trimmed,
    kind: kind as MemberValues["kind"],
    birthDate: date,
    color: color as MemberValues["color"],
  };
}

type DbError = { code?: string | null; message?: string | null } | null;

/** Maps a database error to what the sheet shows. Never passes the message on. */
function failureOf(error: NonNullable<DbError>): MemberSaveResult {
  if (isHouseholdFullError(error)) return { ok: false, reason: "full" };
  if (error.code === "23505" && error.message?.includes(COLOR_KEY)) {
    return { ok: false, reason: "color-taken" };
  }
  // supabase-js reports an unreachable server as an error without a code.
  if (!error.code) return { ok: false, reason: "network" };
  return { ok: false, reason: "server" };
}

/**
 * Adds a person or a pet to the Nest of whoever is signed in. The browser
 * sends only name, role, birth date and colour: the Nest is decided here.
 * Row-level security lets only the Nest's members write to it.
 */
export async function addMember(input: unknown): Promise<MemberSaveResult> {
  const values = parse(input);
  if (!values) return { ok: false, reason: "server" };
  try {
    const supabase = await createClient();
    const { data: householdId, error: householdError } = await supabase.rpc(
      "current_household_id",
    );
    if (householdError) return failureOf(householdError);
    if (!householdId) return { ok: false, reason: "server" };

    const { error } = await supabase.from("household_members").insert({
      household_id: householdId,
      kind: values.kind,
      name: values.name,
      color: values.color,
      birth_date: values.birthDate,
    });
    if (error) return failureOf(error);
  } catch {
    return { ok: false, reason: "network" };
  }
  return { ok: true };
}

/**
 * Changes name, colour and birth date of a member of the Nest. The role
 * cannot change (the database forbids it), so it is not even read.
 */
export async function updateMember(
  id: unknown,
  input: unknown,
): Promise<MemberSaveResult> {
  const values = parse(input);
  if (!values || typeof id !== "string") return { ok: false, reason: "server" };
  try {
    const supabase = await createClient();
    const { error, count } = await supabase
      .from("household_members")
      .update(
        {
          name: values.name,
          color: values.color,
          birth_date: values.birthDate,
        },
        { count: "exact" },
      )
      .eq("id", id);
    if (error) return failureOf(error);
    // Zero rows: not a member of this Nest, or already gone.
    if (!count) return { ok: false, reason: "server" };
  } catch {
    return { ok: false, reason: "network" };
  }
  return { ok: true };
}
