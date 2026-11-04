import { expect, isMobileProject, test } from "../fixtures/casa";
import {
  PHRASE,
  dialogOf,
  eventsOf,
  fieldOf,
  openAdd,
} from "../fixtures/aggiungi";
import {
  lensButton,
  setPreferences,
  type DefaultVisibility,
} from "../fixtures/preferenze";

// Default visibility of a new event in the Add sheet (issue #231, tests e-g of
// the review): with the lens «Io» it is the one chosen in the profile; with the
// lens «Nest» it is always «Tutto il Nest». When the preferences cannot be read
// the page starts from «Io» and «Solo io». Every test uses its own throwaway
// Nest; what is saved is read from the database.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const LABELS: Record<DefaultVisibility, string> = {
  household: "Tutto il Nest",
  busy: "Occupato",
  private: "Solo io",
};

/** The row «Chi lo vede» of the desktop sheet (the mobile sheet has no such row). */
const visibilityRow = (page: Parameters<typeof dialogOf>[0]) =>
  dialogOf(page).locator(".riga-opzione").filter({ hasText: "Chi lo vede" });

/** Types the phrase, checks the row on desktop and saves. */
async function saveWithLabel(
  page: Parameters<typeof dialogOf>[0],
  expected: string,
) {
  await fieldOf(page).fill(PHRASE);
  if (!isMobileProject()) {
    await expect(visibilityRow(page)).toContainText(expected);
  }
  await dialogOf(page)
    .getByRole("button", { name: "Metti in giovedì 22" })
    .click();
  await expect(dialogOf(page)).toHaveCount(0);
}

test.describe("visibilità predefinita in Aggiungi (#231)", () => {
  const cases: {
    id: string;
    lens: "io" | "nest";
    preference: DefaultVisibility;
    saved: DefaultVisibility;
  }[] = [
    { id: "e", lens: "io", preference: "private", saved: "private" },
    { id: "f", lens: "io", preference: "household", saved: "household" },
    { id: "f", lens: "io", preference: "busy", saved: "busy" },
    { id: "g", lens: "nest", preference: "private", saved: "household" },
    { id: "g", lens: "nest", preference: "busy", saved: "household" },
    { id: "g", lens: "nest", preference: "household", saved: "household" },
  ];

  for (const item of cases) {
    test(`${item.id}) lente «${item.lens === "io" ? "Io" : "Nest"}» e ${item.preference}: si vede «${LABELS[item.saved]}» e nel database si salva ${item.saved}`, async ({
      page,
      baseURL,
      casa,
    }) => {
      await setPreferences(casa.users["Marco"]!, {
        default_event_visibility: item.preference,
      });
      await openAdd(page, baseURL, casa, "Marco", { lens: item.lens });
      await saveWithLabel(page, LABELS[item.saved]);

      await expect
        .poll(async () => (await eventsOf(casa)).map((row) => row.visibility))
        .toEqual([item.saved]);
    });
  }

  test("h) se le preferenze non si leggono si parte da «Io» e «Solo io» (decisione della #231)", async ({
    page,
    baseURL,
    casa,
  }) => {
    // The frame reads the profile on the server, so the browser cannot make the
    // read fail: the row is removed, which the page reads as «not readable».
    const marco = casa.users["Marco"]!;
    await setPreferences(marco, {
      start_lens: "nest",
      default_event_visibility: "household",
    });
    const { error } = await marco.admin
      .from("profiles")
      .delete()
      .eq("id", marco.id);
    if (error) throw new Error("Profilo di prova non rimosso");

    await openAdd(page, baseURL, casa, "Marco", { lens: null });
    await expect(lensButton(page, "Io")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await saveWithLabel(page, "Solo io");
    await expect
      .poll(async () => (await eventsOf(casa)).map((row) => row.visibility))
      .toEqual(["private"]);
  });

  test("isolamento: la preferenza di un utente non vale per un altro Nest", async ({
    page,
    baseURL,
    casa,
    bianchi,
  }) => {
    await setPreferences(bianchi.users["Giulia"]!, {
      default_event_visibility: "private",
    });
    await openAdd(page, baseURL, casa, "Marco", { lens: "io" });
    await saveWithLabel(page, "Occupato");
    await expect
      .poll(async () => (await eventsOf(casa)).map((row) => row.visibility))
      .toEqual(["busy"]);
    expect(await eventsOf(bianchi)).toEqual([]);
  });
});
