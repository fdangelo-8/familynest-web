import { expect, test } from "@playwright/test";
import { signInAs } from "../fixtures/auth";
import { withFigli } from "../fixtures/figlio";
import {
  DATA_NETWORK_ERROR,
  DATA_SERVER_ERROR,
  MY_TITLES,
  UUID,
  alertWith,
  breakRoute,
  createEventAs,
  addShoppingAs,
  downloadData,
  needsThrowaway,
  needsUsers,
  openProfile,
  romeToday,
  withMemberNest,
  withRita,
  seedMine,
} from "../fixtures/profilo";

// "Il tuo profilo" (#38): the file «I tuoi dati» (CA-25 ... CA-30) and the two
// parts added by the coordinator on 04/11: the notification preferences and
// the space notices of the person, and only of the person.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

test.describe("file «I tuoi dati»", () => {
  test("CA-25: il file ha il nome con la data di Roma, la mail, il Nest e tutto quello che ho inserito", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async (ctx) => {
      await seedMine(ctx, MY_TITLES);
      await ctx.user.signInContext(page.context(), baseURL as string);
      await openProfile(page);

      const file = await downloadData(page);
      expect(file.name).toBe(`familynest-i-tuoi-dati-${romeToday()}.json`);
      expect(file.json.account.mail).toBe(ctx.user.email);
      expect(file.json.nest.nome).toBe("Casa di Ilaria");
      const titles = file.json.impegni.map((e) => e.titolo);
      expect(titles).toContain(MY_TITLES.shared);
      expect(titles).toContain(MY_TITLES.private);
      expect(file.json.da_fare.map((t) => t.titolo)).toContain(MY_TITLES.todo);
      expect(file.json.scadenze.map((d) => d.titolo)).toContain(
        MY_TITLES.deadline,
      );
      expect(file.json.spesa.map((s) => s.nome)).toContain(MY_TITLES.shopping);
      expect(file.json.spazi_fissati.map((s) => s.spazio)).toContain("meals");

      // The success toast.
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: "Dati scaricati: trovi il file tra i download." }),
      ).toBeVisible();
    });
  });

  test("CA-52 (#32): il file ha le idee regalo aggiunte da chi scarica, mai quelle degli altri né i nomi di chi regala", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withFigli(async (ctx) => {
      const ugo = ctx.nest.users["Ugo"]!;
      const vera = ctx.nest.users["Vera"]!;
      const add = async (
        user: typeof ugo,
        args: Record<string, string>,
      ): Promise<string> => {
        const { data, error } = await user.client.rpc("add_wishlist_item", {
          p_member_id: ctx.mia,
          p_title: args["p_title"]!,
          ...args,
        });
        expect(error).toBeNull();
        return data as string;
      };
      const diary = await add(ugo, {
        p_title: "Diario segreto con lucchetto",
        p_url: "https://negozio.example/diario",
        p_note: "Lo vuole tanto",
      });
      await add(vera, { p_title: "Set di acquerelli con pennelli" });

      // «Nonna Anna» takes the diary through the public function.
      const { data: link, error: linkError } = await ugo.client.rpc(
        "share_wishlist",
        { p_member_id: ctx.mia },
      );
      expect(linkError).toBeNull();
      const { data: outcome } = await ctx.admin.rpc(
        "reserve_public_wishlist_item",
        {
          p_code: link![0]!.code,
          p_item_id: diary,
          p_name: "Nonna Anna",
          p_giver_key: "k".repeat(40),
        },
      );
      expect(outcome).toBe("reserved");

      await ugo.signInContext(page.context(), baseURL as string);
      await openProfile(page);
      const file = await downloadData(page);
      expect(file.json.idee_regalo).toEqual([
        {
          titolo: "Diario segreto con lucchetto",
          link: "https://negozio.example/diario",
          nota: "Lo vuole tanto",
          aggiunta_il: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        },
      ]);
      expect(file.text).not.toContain("Set di acquerelli con pennelli");
      expect(file.text).not.toContain("Nonna Anna");
    });
  });

  test("CA-26: il file non contiene niente di quello che hanno inserito gli altri", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withRita(async (ctx) => {
      const { u2, ritaId, adminMemberId } = ctx;
      await createEventAs(u2, [ritaId], "Prova coro", "household");
      await addShoppingAs(u2, "Pane");
      await createEventAs(
        ctx.user,
        [adminMemberId],
        MY_TITLES.shared,
        "household",
      );
      await ctx.user.signInContext(page.context(), baseURL as string);
      await openProfile(page);

      const file = await downloadData(page);
      // Sanity: what U put in is there.
      expect(file.json.impegni.map((e) => e.titolo)).toEqual([
        MY_TITLES.shared,
      ]);
      expect(file.text).not.toContain("Prova coro");
      expect(file.text).not.toContain("Pane");
      expect(file.text).not.toContain(u2.email);
      // The mail of the throwaway user is made with a uuid: it is the person's
      // own mail and is taken out; no other identifier may be left.
      expect(file.text.split(ctx.user.email).join("")).not.toMatch(UUID);
    });
  });

  test("CA-27: chi non ha inserito niente scarica liste vuote e le preferenze di partenza", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user }) => {
      await user.signInContext(page.context(), baseURL as string);
      await openProfile(page);
      const file = await downloadData(page);
      expect(file.json.impegni).toEqual([]);
      expect(file.json.da_fare).toEqual([]);
      expect(file.json.scadenze).toEqual([]);
      expect(file.json.spesa).toEqual([]);
      expect(file.json.idee_regalo).toEqual([]);
      expect(file.json.spazi_fissati).toEqual([]);
      expect(file.json.avvisi_degli_spazi).toEqual([]);
      expect(file.json.preferenze_di_notifica).toBeNull();
      expect(file.json.preferenze).toEqual({
        all_apertura: "Io",
        sintesi_del_mattino: "7:30",
        visibilita_predefinita: "Occupato",
      });
    });
  });

  test("le preferenze di notifica e gli avvisi degli spazi sono nel file, solo i miei", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withRita(async (ctx) => {
      const { user, u2 } = ctx;
      // U: «Spesa» on (the other four stay as they are) and an interest in
      // the space «chores» (the database only accepts a space the Nest can have).
      const mine = await user.client.rpc("set_notification_preference", {
        p_preference: "shopping",
        p_enabled: true,
      });
      expect(mine.error).toBeNull();
      const mineSpace = await user.client.rpc("add_space_interest", {
        p_space: "chores",
      });
      expect(mineSpace.error).toBeNull();
      // Rita: «Impegni» off and an interest in the space «projects».
      const hers = await u2.client.rpc("set_notification_preference", {
        p_preference: "events",
        p_enabled: false,
      });
      expect(hers.error).toBeNull();
      const herSpace = await u2.client.rpc("add_space_interest", {
        p_space: "projects",
      });
      expect(herSpace.error).toBeNull();

      await user.signInContext(page.context(), baseURL as string);
      await openProfile(page);
      const file = await downloadData(page);
      expect(file.json.preferenze_di_notifica).toEqual({
        impegni: true,
        cose_da_fare_assegnate: true,
        spesa: true,
        liberi_insieme: true,
        sintesi_del_mattino: true,
      });
      expect(file.json.avvisi_degli_spazi.map((s) => s.spazio)).toEqual([
        "chores",
      ]);
    });
  });

  test("CA-28: il file di Giulia non ha niente di Casa D'Angelo", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A", "B");
    await signInAs(page.context(), baseURL as string, "B");
    await openProfile(page);
    const file = await downloadData(page);
    expect(file.json.account.mail).toBe(process.env.TEST_USER_B_EMAIL);
    expect(file.json.nest.nome).toBe("Casa Bianchi");
    expect(file.text).not.toContain("Casa D'Angelo");
    expect(file.text).not.toContain(process.env.TEST_USER_A_EMAIL as string);
  });

  test("CA-30: se la preparazione dà 500 non si scarica niente e c'è l'avviso del server", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user }) => {
      await user.signInContext(page.context(), baseURL as string);
      await breakRoute(page, "/profilo/dati", "server");
      await openProfile(page);
      let downloads = 0;
      page.on("download", () => {
        downloads += 1;
      });
      await page.getByText("I tuoi dati", { exact: true }).click();
      await expect(alertWith(page, DATA_SERVER_ERROR)).toHaveText(
        DATA_SERVER_ERROR,
      );
      expect(downloads).toBe(0);
    });
  });

  test("CA-30: se la richiesta non arriva (rete) il testo parla di connessione", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withMemberNest(async ({ user }) => {
      await user.signInContext(page.context(), baseURL as string);
      await breakRoute(page, "/profilo/dati", "network");
      await openProfile(page);
      let downloads = 0;
      page.on("download", () => {
        downloads += 1;
      });
      await page.getByText("I tuoi dati", { exact: true }).click();
      await expect(alertWith(page, DATA_NETWORK_ERROR)).toHaveText(
        DATA_NETWORK_ERROR,
      );
      expect(downloads).toBe(0);
    });
  });
});

test.describe("rotta /profilo/dati", () => {
  test("CA-29: solo POST, Origin controllato, niente dati senza sessione, no-store", async ({
    page,
    baseURL,
    request,
  }) => {
    needsUsers("A");
    await signInAs(page.context(), baseURL as string, "A");

    const get = await page.request.get("/profilo/dati");
    expect(get.status()).toBe(405);

    const foreign = await page.request.post("/profilo/dati", {
      headers: { origin: "https://altro-sito.example" },
    });
    expect(foreign.status()).toBe(403);
    expect(await foreign.text()).not.toContain("account");

    // Without a session (a context with no cookies): no data.
    const anonymous = await request.post("/profilo/dati", { maxRedirects: 0 });
    expect([401, 302, 303, 307, 308]).toContain(anonymous.status());
    expect(await anonymous.text()).not.toContain("familynest");
    if (anonymous.status() === 401) {
      expect(anonymous.headers()["cache-control"] ?? "").toContain("no-store");
    }

    const ok = await page.request.post("/profilo/dati");
    expect(ok.status()).toBe(200);
    expect(ok.headers()["cache-control"] ?? "").toContain("no-store");
    expect(ok.headers()["content-disposition"] ?? "").toContain("attachment");
    expect(ok.headers()["content-type"] ?? "").toContain("application/json");
  });
});
