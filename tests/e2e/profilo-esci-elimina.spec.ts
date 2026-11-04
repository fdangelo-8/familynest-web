import { expect, test, type Locator, type Page } from "@playwright/test";
import { signInAs } from "../fixtures/auth";
import {
  DELETED_NOTICE,
  DELETE_NETWORK_ERROR,
  DELETE_SERVER_ERROR,
  PATH,
  adminClient,
  authUserExists,
  breakRoute,
  createEventAs,
  addShoppingAs,
  deleteButton,
  deleteDialog,
  h1,
  householdExists,
  needsThrowaway,
  needsUsers,
  openProfile,
  rowsOfHousehold,
  seedMine,
  sessionCookieNames,
  signOutButton,
  signOutDialog,
  withMemberNest,
  withRita,
  type SeedTitles,
} from "../fixtures/profilo";

// "Il tuo profilo" (#38): «Esci» and «Elimina l'account» (CA-31 ... CA-40), the
// case FN003 (the forecast changes while the dialog is open), the deletion of
// the «Occupato» events and the route /profilo/elimina. The seeded Marco only
// opens and closes the dialog (CA-33): the deletion is always a throwaway user.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const DELETED_URL = /\/accesso\?account=eliminato$/;
const ONLY_LOSS =
  "Perderai impegni, liste e impostazioni. Non si può annullare.";

const inDialog = (dialog: Locator, name: string) =>
  dialog.getByRole("button", { name, exact: true });

/** Opens the deletion dialog from the page. */
async function openDeleteDialog(page: Page) {
  await deleteButton(page).click();
  const dialog = deleteDialog(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Names of the cookies set by an answer and whether all are already expired. */
function sessionCookiesOf(headers: Array<{ name: string; value: string }>) {
  return headers
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value)
    .filter((value) => value.startsWith("sb-"));
}

const isExpired = (setCookie: string) =>
  /max-age=0/i.test(setCookie) || /expires=thu, 01 jan 1970/i.test(setCookie);

// -------------------------------------------------------------------- Esci

test.describe("Esci", () => {
  test("CA-31: «Esci» apre il dialogo; «Annulla» lo chiude e il fuoco torna su «Esci»", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user }) => {
      await user.signInContext(page.context(), baseURL as string);
      await openProfile(page);
      await signOutButton(page).click();
      const dialog = signOutDialog(page);
      await expect(dialog).toBeVisible();
      await expect(inDialog(dialog, "Esci")).toBeVisible();
      await expect(inDialog(dialog, "Annulla")).toBeVisible();

      await inDialog(dialog, "Annulla").click();
      await expect(dialog).toBeHidden();
      await expect(signOutButton(page)).toBeFocused();

      await page.reload();
      await expect(h1(page)).toBeVisible();
      await expect(page).toHaveURL(/\/profilo$/);
    });
  });

  test("CA-32: confermare porta a /accesso, i cookie spariscono, account e Nest restano", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user }) => {
      await user.signInContext(page.context(), baseURL as string);
      await openProfile(page);
      expect((await sessionCookieNames(page)).length).toBeGreaterThan(0);
      await signOutButton(page).click();
      const dialog = signOutDialog(page);
      await expect(dialog).toBeVisible();
      await inDialog(dialog, "Esci").click();

      await expect(page).toHaveURL(/\/accesso$/);
      expect(await sessionCookieNames(page)).toEqual([]);
      await page.goto(PATH);
      await expect(page).toHaveURL(/\/accesso/);
      expect(await authUserExists(user.id)).toBe(true);
      expect(await user.nestCount()).toBe(1);
    });
  });
});

// --------------------------------------------------------------- Elimina

test.describe("dialogo «Elimina l'account»", () => {
  test("CA-33: Marco (unico adulto con account) vede il testo e il bottone «Esci e cancella la casa»; «Annulla» restituisce il fuoco", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    await signInAs(page.context(), baseURL as string, "A");
    await openProfile(page);
    const dialog = await openDeleteDialog(page);
    await expect(dialog).toHaveAccessibleDescription(ONLY_LOSS);
    await expect(dialog.getByRole("button")).toHaveText([
      "Esci e cancella la casa",
      "Annulla",
    ]);
    await expect(inDialog(dialog, "Elimina l'account")).toHaveCount(0);
    await expect(inDialog(dialog, "Annulla")).toBeFocused();

    await inDialog(dialog, "Annulla").click();
    await expect(dialog).toBeHidden();
    await expect(deleteButton(page)).toBeFocused();
    // The test never confirms the deletion of a seeded user.
  });

  test("CA-34: Rita vede chi resta nella casa, senza gli animali", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withRita(async (ctx) => {
      const added = await ctx.user.admin.from("household_members").insert({
        household_id: ctx.householdId,
        kind: "child",
        name: "Pietro",
        color: "salvia",
        birth_date: "2018-05-01",
      });
      expect(added.error).toBeNull();
      await ctx.addPet("Fido", "zafferano");

      await ctx.u2.signInContext(page.context(), baseURL as string);
      await openProfile(page);
      const dialog = await openDeleteDialog(page);
      await expect(dialog).toHaveAccessibleDescription(
        "Perderai impegni, liste e impostazioni. Casa di Ilaria resterà a Ilaria e Pietro. Non si può annullare.",
      );
      await expect(dialog.getByRole("button")).toHaveText([
        "Elimina l'account",
        "Annulla",
      ]);
      await inDialog(dialog, "Annulla").click();
      await expect(dialog).toBeHidden();
    });
  });
});

// ------------------------------------------------------- eliminazione vera

const NEST_TITLES: SeedTitles = {
  shared: "Cena di classe",
  private: "Appuntamento privato",
  busy: "Aperitivo occupato",
  todo: "Cosa da fare condivisa",
  privateTodo: "Cosa da fare solo mia",
  deadline: "Scadenza della casa",
  shopping: "Pasta",
};

test.describe("eliminazione", () => {
  test("CA-35: l'amministratore elimina l'account, la casa resta a Rita e gli impegni «Occupato» spariscono", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withRita(async (ctx) => {
      const { user, adminMemberId, householdId, ritaId } = ctx;
      await seedMine(ctx, NEST_TITLES);
      await user.signInContext(page.context(), baseURL as string);
      await openProfile(page);

      const requests: string[] = [];
      page.on("request", (request) => requests.push(request.url()));
      const answered = page.waitForResponse(
        (response) =>
          response.url().endsWith("/profilo/elimina") &&
          response.request().method() === "POST",
      );

      const dialog = await openDeleteDialog(page);
      await inDialog(dialog, "Elimina l'account").click();
      await expect(page).toHaveURL(DELETED_URL);
      await expect(
        page.getByText(DELETED_NOTICE).filter({ visible: true }),
      ).toBeVisible();

      // The cookies are deleted by the answer; no sign-out call is made.
      const response = await answered;
      expect(response.status()).toBe(200);
      const cookies = sessionCookiesOf(await response.headersArray());
      expect(cookies.length).toBeGreaterThan(0);
      for (const cookie of cookies) expect(isExpired(cookie)).toBe(true);
      expect(requests.filter((url) => /signout|logout/.test(url))).toEqual([]);
      expect(await sessionCookieNames(page)).toEqual([]);

      const admin = adminClient();
      expect(await authUserExists(user.id)).toBe(false);
      const profile = await admin
        .from("profiles")
        .select("id")
        .eq("id", user.id);
      expect(profile.data ?? []).toEqual([]);
      const member = await admin
        .from("household_members")
        .select("id")
        .eq("id", adminMemberId);
      expect(member.data ?? []).toEqual([]);

      const events = await admin
        .from("events")
        .select("title, author_member_id")
        .eq("household_id", householdId);
      expect(events.error).toBeNull();
      const titles = (events.data ?? []).map((e) => e.title as string);
      // «Tutto il Nest» stays, without an author; «Solo io» and «Occupato» go.
      expect(titles).toContain("Cena di classe");
      expect(titles).not.toContain("Appuntamento privato");
      expect(titles).not.toContain("Aperitivo occupato");
      const kept = (events.data ?? []).find(
        (e) => e.title === "Cena di classe",
      );
      expect(kept?.author_member_id).toBeNull();

      const todos = await admin
        .from("todos")
        .select("title")
        .eq("household_id", householdId);
      expect((todos.data ?? []).map((t) => t.title)).not.toContain(
        "Cosa da fare solo mia",
      );
      expect(await rowsOfHousehold("pinned_spaces", householdId)).toBe(0);

      expect(await householdExists(householdId)).toBe(true);
      const rita = await admin
        .from("household_members")
        .select("is_admin")
        .eq("id", ritaId)
        .single();
      expect(rita.data?.is_admin).toBe(true);
    });
  });

  test("CA-36 e CA-37: l'ultimo adulto esce e cancella la casa; poi /profilo e /oggi portano a /accesso", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async (ctx) => {
      const { user, householdId } = ctx;
      await ctx.addPet("Fido", "zafferano");
      await addShoppingAs(user, "Latte");
      await ctx.invite(await ctx.addAdult("Rita", "glicine"));
      expect(await rowsOfHousehold("invitations", householdId)).toBe(1);

      await user.signInContext(page.context(), baseURL as string);
      await openProfile(page);
      const dialog = await openDeleteDialog(page);
      await expect(dialog.getByRole("button")).toHaveText([
        "Esci e cancella la casa",
        "Annulla",
      ]);
      await inDialog(dialog, "Esci e cancella la casa").click();
      await expect(page).toHaveURL(DELETED_URL);
      await expect(
        page.getByText(DELETED_NOTICE).filter({ visible: true }),
      ).toBeVisible();

      expect(await authUserExists(user.id)).toBe(false);
      expect(await householdExists(householdId)).toBe(false);
      expect(await rowsOfHousehold("household_members", householdId)).toBe(0);
      expect(await rowsOfHousehold("invitations", householdId)).toBe(0);
      expect(await rowsOfHousehold("shopping_items", householdId)).toBe(0);

      // CA-37
      expect(await sessionCookieNames(page)).toEqual([]);
      await page.goto(PATH);
      await expect(page).toHaveURL(/\/accesso/);
      await page.goto("/oggi");
      await expect(page).toHaveURL(/\/accesso/);
      expect(await sessionCookieNames(page)).toEqual([]);
    });
  });

  test("CA-38: se l'eliminazione dà 500 il dialogo resta aperto con il testo del server e non cambia niente", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, householdId }) => {
      await user.signInContext(page.context(), baseURL as string);
      await breakRoute(page, "/profilo/elimina", "server");
      await openProfile(page);
      const dialog = await openDeleteDialog(page);
      const confirm = inDialog(dialog, "Esci e cancella la casa");
      await confirm.click();

      await expect(dialog.getByRole("alert")).toHaveText(DELETE_SERVER_ERROR);
      await expect(dialog).toBeVisible();
      await expect(confirm).toBeEnabled();
      await expect(confirm).not.toHaveAttribute("aria-busy", "true");
      expect(await authUserExists(user.id)).toBe(true);
      expect(await householdExists(householdId)).toBe(true);
      expect(await user.nestCount()).toBe(1);
    });
  });

  test("CA-38: se la richiesta non arriva (rete) il testo parla di connessione", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user, householdId }) => {
      await user.signInContext(page.context(), baseURL as string);
      await breakRoute(page, "/profilo/elimina", "network");
      await openProfile(page);
      const dialog = await openDeleteDialog(page);
      await inDialog(dialog, "Esci e cancella la casa").click();
      await expect(dialog.getByRole("alert")).toHaveText(DELETE_NETWORK_ERROR);
      expect(await authUserExists(user.id)).toBe(true);
      expect(await householdExists(householdId)).toBe(true);
    });
  });

  test("FN003: se la previsione cambia con il dialogo aperto, si riapre con testo e bottone nuovi e non elimina", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withRita(async (ctx) => {
      const { user, u2, householdId } = ctx;
      await user.signInContext(page.context(), baseURL as string);
      await openProfile(page);
      const dialog = await openDeleteDialog(page);
      await expect(dialog).toHaveAccessibleDescription(
        /Casa di Ilaria resterà a Rita/,
      );
      await expect(inDialog(dialog, "Elimina l'account")).toBeVisible();

      // Meanwhile the account of Rita goes away: U would be the last adult.
      await u2.remove();

      const conflict = page.waitForResponse(
        (response) =>
          response.url().endsWith("/profilo/elimina") &&
          response.request().method() === "POST",
      );
      await inDialog(dialog, "Elimina l'account").click();
      expect((await conflict).status()).toBe(409);

      // Nothing was deleted with the old confirmation.
      const renewed = page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Esci e cancella la casa", exact: true });
      await expect(renewed).toBeVisible();
      const reopened = deleteDialog(page);
      await expect(reopened).toHaveAccessibleDescription(ONLY_LOSS);
      await expect(reopened.getByRole("button")).toHaveText([
        "Esci e cancella la casa",
        "Annulla",
      ]);
      await expect(inDialog(reopened, "Annulla")).toBeFocused();
      expect(await authUserExists(user.id)).toBe(true);
      expect(await householdExists(householdId)).toBe(true);
      await expect(page).toHaveURL(/\/profilo$/);

      // With the new confirmation the account is deleted.
      await renewed.click();
      await expect(page).toHaveURL(DELETED_URL);
      expect(await authUserExists(user.id)).toBe(false);
    });
  });
});

// ------------------------------------------------------------------- rotta

test.describe("rotta /profilo/elimina", () => {
  test("CA-39: solo POST, Origin controllato, corpo valido, niente senza sessione; l'account resta", async ({
    page,
    baseURL,
    request,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user }) => {
      await user.signInContext(page.context(), baseURL as string);
      const stillThere = async () => {
        expect(await authUserExists(user.id)).toBe(true);
        expect(await user.nestCount()).toBe(1);
      };

      for (const method of ["GET", "HEAD", "PUT", "DELETE"]) {
        const response = await page.request.fetch("/profilo/elimina", {
          method,
        });
        expect(response.status(), method).toBe(405);
      }
      await stillThere();

      const foreign = await page.request.post("/profilo/elimina", {
        headers: { origin: "https://altro-sito.example" },
        data: { expectHouseholdDeletion: true },
      });
      expect(foreign.status()).toBe(403);
      await stillThere();

      for (const data of [{}, { expectHouseholdDeletion: "true" }, []]) {
        const bad = await page.request.post("/profilo/elimina", { data });
        expect(bad.status(), JSON.stringify(data)).toBe(400);
      }
      await stillThere();

      // Without a session (a context with no cookies) nothing is deleted.
      const anonymous = await request.post("/profilo/elimina", {
        data: { expectHouseholdDeletion: true },
        maxRedirects: 0,
      });
      expect([401, 302, 303, 307, 308]).toContain(anonymous.status());
      await stillThere();
    });
  });

  test("CA-40: elimina sempre l'account della sessione, mai quello di un altro Nest", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async (u) => {
      await withMemberNest(async (v) => {
        await createEventAs(
          v.user,
          [v.adminMemberId],
          "Evento di V",
          "household",
        );
        await u.user.signInContext(page.context(), baseURL as string);
        await page.goto(PATH);
        await expect(h1(page)).toBeVisible();

        // The browser tries to name V in every way it can think of.
        const response = await page.request.post("/profilo/elimina", {
          data: {
            expectHouseholdDeletion: true,
            userId: v.user.id,
            user_id: v.user.id,
            id: v.user.id,
            householdId: v.householdId,
            household_id: v.householdId,
          },
        });
        expect(response.status()).toBe(200);

        expect(await authUserExists(u.user.id)).toBe(false);
        expect(await householdExists(u.householdId)).toBe(false);

        expect(await authUserExists(v.user.id)).toBe(true);
        expect(await householdExists(v.householdId)).toBe(true);
        expect(await v.user.nestCount()).toBe(1);
        expect(await rowsOfHousehold("household_members", v.householdId)).toBe(
          1,
        );
        expect(await rowsOfHousehold("events", v.householdId)).toBe(1);
      });
    });
  });
});
