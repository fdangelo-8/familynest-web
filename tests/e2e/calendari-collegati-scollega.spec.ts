import {
  GOOGLE,
  EMPTY_TITLE,
  accountSection,
  anySection,
  at,
  button,
  deleteOwnAccount,
  eventBlocks,
  expect,
  leftovers,
  linkAs,
  linkInBackground,
  needsFake,
  openDay,
  openSettings,
  revokedTokens,
  ritaRemovesU,
  snapshot,
  test,
  today,
  withEvents,
  withLinkerRita,
  withLinker,
} from "../fixtures/calendari-collegati";

// «Calendari collegati» (#34, parte 1): «Scollega» e cancellazione
// dell'account (CA-43, CA-44). La coda di revoca la lancia il test.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });
test.describe.configure({ timeout: 90_000 });

const VISITA = "Visita in banca";
const visita = {
  id: "visita",
  title: VISITA,
  startsAt: at(today(), 10),
  endsAt: at(today(), 11),
};

test.describe("scollega e cancellazione", () => {
  test("CA-43: «Scollega» toglie la sezione e gli impegni, e la coda di revoca revoca il token", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await linkAs(u, page, withEvents(GOOGLE, { personale: [visita] }));
      await u.waitForEvents(VISITA, 1);
      const before = await snapshot(u);
      expect(before.tokens.length).toBeGreaterThan(0);

      const dialog = await openSettings(
        page,
        accountSection(page, "google", GOOGLE.email),
        "Personale",
      );
      await button(dialog, "Scollega l'account Google").click();
      const confirm = page.getByRole("alertdialog", {
        name: `Scollegare «${GOOGLE.email}»?`,
        exact: true,
      });
      await expect(confirm).toBeVisible();
      await button(confirm, "Scollega").click();

      await expect(page.getByText(EMPTY_TITLE, { exact: true })).toBeVisible();
      await expect(anySection(page)).toHaveCount(0);
      await openDay(page, today());
      await expect(eventBlocks(page, VISITA)).toHaveCount(0);

      await expect
        .poll(async () => await revokedTokens(u), { timeout: 30_000 })
        .toEqual(expect.arrayContaining(before.tokens));
      expect(await leftovers(u, before)).toEqual({
        accounts: 0,
        calendars: 0,
        links: 0,
        events: 0,
        queue: 0,
      });
    });
  });

  test("CA-44: eliminando l'account FamilyNest la coda revoca il token e non resta niente di U", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinkerRita(baseURL, async (u) => {
      await u.prepare(GOOGLE);
      await linkInBackground(browser, u, "google");
      await u.setCalendar("Personale", { visibility: "household" });
      await u.provide(GOOGLE, "personale", [visita]);
      await u.fake.sync(u.user.id);
      await u.waitForEvents(VISITA, 1);
      expect((await u.events(VISITA))[0]?.visibility).toBe("household");
      const before = await snapshot(u);

      await deleteOwnAccount(u, page);

      await expect
        .poll(async () => await revokedTokens(u), { timeout: 30_000 })
        .toEqual(expect.arrayContaining(before.tokens));
      expect(await leftovers(u, before)).toEqual({
        accounts: 0,
        calendars: 0,
        links: 0,
        events: 0,
        queue: 0,
      });
    });
  });

  test("CA-44 (secondo caso): se Rita amministratrice toglie U dal Nest non resta niente di U", async ({
    page,
    browser,
    baseURL,
  }) => {
    needsFake();
    await withLinkerRita(baseURL, async (u) => {
      await u.prepare(GOOGLE);
      await linkInBackground(browser, u, "google");
      await u.setCalendar("Personale", { visibility: "household" });
      await u.provide(GOOGLE, "personale", [visita]);
      await u.fake.sync(u.user.id);
      await u.waitForEvents(VISITA, 1);
      const before = await snapshot(u);

      await ritaRemovesU(u, page);

      await expect
        .poll(async () => await revokedTokens(u), { timeout: 30_000 })
        .toEqual(expect.arrayContaining(before.tokens));
      expect(await leftovers(u, before)).toEqual({
        accounts: 0,
        calendars: 0,
        links: 0,
        events: 0,
        queue: 0,
      });
    });
  });
});
