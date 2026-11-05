import { expect, test, type Page } from "@playwright/test";
import { createThrowawayUser, type ThrowawayUser } from "./throwaway-user";

// Helpers shared by tests/visual/figlio.spec.ts and tests/a11y/figlio.spec.ts
// (page /figli/<id>, issue #31). The page reads everything in the browser with
// the session of the user, so each state uses a throwaway user with a Nest of
// its own; the dates of the data are counted from FIXED_NOW (the browser clock),
// not from the real day, so the references do not change with the calendar.

/** Monday 2 November 2026, 10:00 in Rome (the week is 2-8 November). */
export const FIXED_NOW = new Date("2026-11-02T10:00:00+01:00");

export const CHILD = "Sofia";

export const baseURL = () =>
  test.info().project.use.baseURL ?? "http://localhost:3000";

export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

export type ChildNest = { user: ThrowawayUser; childId: string };

/**
 * A throwaway user with a Nest and one child, Sofia (born 27 December 2017).
 * `complete` also has the data of the mockup: school, timetable, one teacher,
 * sizes, three events of the week (one already over on FIXED_NOW) and a
 * deadline in 14 days. `empty` has nothing: the empty profile.
 */
export async function childNest(
  page: Page,
  kind: "complete" | "empty",
): Promise<ChildNest> {
  const user = await createThrowawayUser("Ilaria De Santis");
  try {
    const { error } = await user.client.rpc("create_household", {
      name: "Casa De Santis",
      household_type: "family_with_children",
      member_name: "Ilaria",
      color: "pomodoro",
    });
    if (error) throw new Error("Nest di prova non creato");
    const { data: householdId } = await user.client.rpc("current_household_id");

    const insert = await user.client.from("household_members").insert({
      household_id: householdId as string,
      kind: "child",
      name: CHILD,
      color: "salvia",
      birth_date: "2017-12-27",
    });
    if (insert.error) throw new Error("Figlio di prova non aggiunto");
    const { data: row } = await user.client
      .from("household_members")
      .select("id")
      .eq("kind", "child")
      .eq("name", CHILD)
      .single();
    if (!row) throw new Error("Figlio di prova non letto");
    const childId = row.id as string;

    if (kind === "complete") {
      const profile = await user.admin.from("child_profiles").insert({
        household_id: householdId as string,
        member_id: childId,
        school_name: "scuola Manzoni",
        school_class: "4ª B",
        school_starts_at: "08:15",
        school_ends_at: "16:15",
        school_days: [1, 2, 3, 4, 5],
        school_note: "mensa compresa",
        shoe_size: "33",
        clothing_size: "9–10",
        pajama_size: "140",
      });
      if (profile.error) throw new Error("Profilo di prova non creato");
      const teacher = await user.admin.from("child_teachers").insert({
        household_id: householdId as string,
        member_id: childId,
        sort_order: 1,
        name: "Maestra Bianchi",
        subject: "Italiano e storia",
        phone: "039 234 5678",
      });
      if (teacher.error) throw new Error("Maestra di prova non creata");

      for (const event of [
        // Over on FIXED_NOW: counted, not listed.
        { title: "Doposcuola", from: "08:00", to: "09:00", day: "02" },
        {
          title: "Nuoto",
          from: "17:00",
          to: "18:30",
          day: "05",
          place: "piscina comunale",
        },
        {
          title: "Festa di Giulia",
          from: "16:00",
          to: "18:00",
          day: "07",
          place: "via Verdi 8",
        },
      ]) {
        const created = await user.client.rpc("create_event", {
          p_title: event.title,
          p_starts_at: new Date(
            `2026-11-${event.day}T${event.from}:00+01:00`,
          ).toISOString(),
          p_ends_at: new Date(
            `2026-11-${event.day}T${event.to}:00+01:00`,
          ).toISOString(),
          p_visibility: "household",
          p_member_ids: [childId],
          p_location: event.place ?? null,
          p_escort_member_id: null,
          p_recurrence: "none",
          p_recurrence_weekdays: null,
          p_recurrence_until: null,
          p_notes: null,
        });
        if (created.error) throw new Error("Impegno di prova non creato");
      }

      const deadline = await user.client.from("deadlines").insert({
        title: "Rinnovo carta d'identità di Sofia",
        due_date: "2026-11-16",
        note: null,
        assignee_member_id: null,
        for_member_id: childId,
        is_private: false,
      });
      if (deadline.error) throw new Error("Scadenza di prova non creata");
    }

    await user.signInContext(page.context(), baseURL());
    return { user, childId };
  } catch (error) {
    await user.remove();
    throw error;
  }
}

/** Opens /figli/<id> and waits for the real page (h1) and for React. */
export async function openChild(page: Page, childId: string) {
  await expect(async () => {
    await page.goto(`/figli/${childId}`);
    await expect(
      page.getByRole("heading", { level: 1, name: CHILD }),
    ).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("load");
}

/** «aggiornate a …» is the month of the real day of the test: pinned. */
export async function freezeTexts(page: Page) {
  await page.evaluate(() => {
    for (const s of document.querySelectorAll(".sezione__info")) {
      if (/^aggiornate a /.test(s.textContent ?? "")) {
        s.textContent = "aggiornate a settembre";
      }
    }
  });
}

/** Pins the pointer away and shoots: no hover state in the reference. */
export async function shoot(page: Page, name: string, fullPage = true) {
  await page.mouse.move(0, 0);
  await freezeTexts(page);
  await expect(page).toHaveScreenshot(name, { fullPage });
}

/** The pencil of the bar (mobile) or the button of the head (desktop). */
export const editButton = (page: Page) =>
  page.getByRole("button", { name: `Modifica il profilo di ${CHILD}` });

export const editDialog = (page: Page) =>
  page.getByRole("dialog", { name: `Modifica il profilo di ${CHILD}` });

/** The GET of the profile of the child answers like this; writes go on. */
export async function answerProfileReads(
  page: Page,
  answer: "error" | { hold: Promise<void> },
) {
  await page.route("**/rest/v1/child_profiles*", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    if (answer === "error") {
      return route.fulfill({
        status: 500,
        headers: { ...CORS, "content-type": "application/json" },
        body: JSON.stringify({ message: "boom" }),
      });
    }
    await answer.hold;
    return route.fallback();
  });
}

/**
 * Fills the sheet so that every kind of error shows at once: no name, a birth
 * date in the future, an exit before the entrance, a second teacher without
 * name and with a phone that is not a phone. Presses «Salva le modifiche».
 */
export async function provokeErrors(page: Page) {
  const dialog = editDialog(page);
  await dialog.getByLabel("Nome", { exact: true }).fill("");
  await dialog.getByLabel("Data di nascita").fill("2030-01-01");
  await dialog.getByLabel("Entra alle").fill("17:00");
  await dialog.getByRole("button", { name: "Aggiungi una maestra" }).click();
  const second = dialog.getByRole("group", { name: "Maestra 2" });
  await second.getByLabel("Materia").fill("Matematica");
  await second.getByLabel("Telefono").fill("abc");
  await dialog.getByRole("button", { name: "Salva le modifiche" }).click();
  await expect(
    dialog.getByText("Scrivi il nome per continuare."),
  ).toBeVisible();
}
