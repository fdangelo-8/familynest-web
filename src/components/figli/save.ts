import type { Database } from "@/types/database";
import type { ChoosableColor } from "@/components/ui/ColorChoice/ColorChoice";
import { createClient } from "@/lib/supabase/client";

/** What the sheet sends: the full new state of the profile of one child. */
export type ChildProfileValues = {
  name: string;
  birthDate: string | null;
  color: ChoosableColor;
  schoolName: string | null;
  schoolClass: string | null;
  /** `HH:MM` */
  startsAt: string | null;
  /** `HH:MM` */
  endsAt: string | null;
  /** ISO weekdays, only with a timetable */
  days: number[];
  note: string | null;
  shoeSize: string | null;
  clothingSize: string | null;
  pajamaSize: string | null;
  teachers: ReadonlyArray<{
    name: string;
    subject: string | null;
    phone: string | null;
  }>;
};

export type SaveResult =
  | { ok: true }
  | {
      ok: false;
      /** `color-taken`: 23505. `network`: no answer arrived. `server`: anything else. */
      reason: "color-taken" | "network" | "server";
    };

type Args = Database["public"]["Functions"]["save_child_profile"]["Args"];

/**
 * Saves everything in one call of `save_child_profile` (all or nothing). The
 * browser sends only the id of the child and the values: the Nest is decided
 * by the database from the session. Texts, names and dates travel in the body,
 * never in the address; the error is read only for its code and status, never
 * shown or logged.
 */
export async function saveChildProfile(
  childId: string,
  values: ChildProfileValues,
): Promise<SaveResult> {
  const args: Args = {
    p_member_id: childId,
    p_name: values.name,
    p_color: values.color,
    p_teachers: values.teachers.map((teacher) => ({
      name: teacher.name,
      subject: teacher.subject,
      phone: teacher.phone,
    })),
    ...(values.birthDate ? { p_birth_date: values.birthDate } : {}),
    ...(values.schoolName ? { p_school_name: values.schoolName } : {}),
    ...(values.schoolClass ? { p_school_class: values.schoolClass } : {}),
    ...(values.startsAt && values.endsAt
      ? {
          p_school_starts_at: values.startsAt,
          p_school_ends_at: values.endsAt,
          p_school_days: values.days,
        }
      : {}),
    ...(values.note ? { p_school_note: values.note } : {}),
    ...(values.shoeSize ? { p_shoe_size: values.shoeSize } : {}),
    ...(values.clothingSize ? { p_clothing_size: values.clothingSize } : {}),
    ...(values.pajamaSize ? { p_pajama_size: values.pajamaSize } : {}),
  };
  try {
    const supabase = createClient();
    const { error, status } = await supabase.rpc("save_child_profile", args);
    if (!error) return { ok: true };
    if (error.code === "23505") return { ok: false, reason: "color-taken" };
    return { ok: false, reason: status === 0 ? "network" : "server" };
  } catch {
    return { ok: false, reason: "network" };
  }
}
