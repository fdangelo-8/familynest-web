import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  skipReason,
  signInAs,
  usersConfigured,
  type TestUserKey,
} from "../fixtures/auth";
import {
  NEST_A,
  NEST_B,
  adminClient,
  householdIdByName,
  isMobileProject,
} from "../fixtures/invito";
import {
  COOKIE,
  alertWith,
  anonClient,
  avatarGroup,
  avatarsOf,
  backControl,
  clickUntil,
  colorGroup,
  colorNames,
  colorPageReady,
  continueButton,
  expectedLead,
  h1,
  inviteCookie,
  lauraInvite,
  linkOf,
  mentions,
  radio,
  rawHtml,
  romeInstant,
  seedClient,
  setInviteCookie,
  statusWith,
  withDeSantisNest,
  withNestAndVisitor,
  visibleButtons,
  type Color,
} from "../fixtures/invito-ingresso";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";

// Ingresso con invito (#16): pages /invito, /invito/colore and the technical
// routes /invito/<token> and /invito/chiudi, one test per acceptance criterion
// (CA-1 ... CA-34, CA-34 is in tests/a11y/invito-ingresso.spec.ts) plus the two
// checks asked by the coordinator on 30/10: the «+N» with many members and the
// order of the colours «scelto, liberi, presi».
//
// The seed users only read (A = Marco, B = Giulia, C = no Nest): the invitation
// of Laura is never changed. Whatever changes data (message, expiry, joining
// the Nest) uses a throwaway Nest «Casa De Santis» (U: Ilaria, Davide, Pietro)
// and a throwaway visitor without a Nest (V). Where the criterion names Marco
// and Laura for such a case, the tests use Ilaria and Davide.
//
// Redirects that start inside <Suspense> can be made by the browser, not by
// the server: the tests check the final address and the invitation cookie,
// never the HTTP code (except for the link route, which answers 303 itself).

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

function needsUsers(...keys: TestUserKey[]) {
  test.skip(!usersConfigured(...keys), skipReason(...keys));
}
function needsThrowaway() {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
}
function onlyMobile() {
  test.skip(!isMobileProject(), "Disposizione solo mobile (390 px)");
}
function onlyDesktop() {
  test.skip(isMobileProject(), "Disposizione solo desktop (1280 px)");
}
const originOf = (baseURL: string | undefined) =>
  new URL(baseURL as string).origin;

const EXPIRED_TEXT =
  "Chiedi a chi ti ha mandato il link di invitarti di nuovo: dal suo FamilyNest bastano due tocchi.";
const OTHER_NEST_TEXT =
  "Con un account per ora si sta in un solo Nest. Il Nest in cui sei resta com'è.";

/** Text of the visible layout (both layouts are in the DOM). */
const visibleText = (page: Page, text: string) =>
  page.getByText(text, { exact: true }).filter({ visible: true });

/** The error state of /invito (CA-7): same texts for every reason. */
async function expectExpired(page: Page) {
  if (isMobileProject()) {
    await expect(h1(page)).toHaveText("Questo invito non vale più.", {
      useInnerText: true,
    });
  } else {
    await expect(h1(page)).toHaveText("Invito non più valido", {
      useInnerText: true,
    });
    await expect(page.locator("p.claim").filter({ visible: true })).toHaveText(
      "Questo invito non vale più.",
      { useInnerText: true },
    );
  }
  await expect(visibleText(page, EXPIRED_TEXT)).toBeVisible();
  // Web-first and scoped: during the page change two <main> can coexist.
  await expect(
    page.locator("main").filter({ hasText: EXPIRED_TEXT }),
  ).not.toContainText(/scadut/i);
  const enter = page.getByRole("link", { name: "Entra in FamilyNest" });
  await expect(enter).toBeVisible();
  await expect(enter).toHaveAttribute("href", "/accesso");
  await expect(
    page.getByRole("button", { name: /^Entra con (Apple|Google)$/ }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Usa la mail" })).toHaveCount(0);
  // After the client navigation the previous page (08) may stay in the DOM,
  // hidden: only what is visible counts.
  await expect(page.locator(".avatar").filter({ visible: true })).toHaveCount(
    0,
  );
  await expect(page.getByText("Continuando accetti")).toHaveCount(0);
}

/** The state «Sei già in un altro Nest» (CA-28). */
async function expectOtherNest(page: Page) {
  if (isMobileProject()) {
    await expect(h1(page)).toHaveText("Sei già in un altro Nest.", {
      useInnerText: true,
    });
  } else {
    await expect(h1(page)).toHaveCount(1);
    await expect(h1(page)).toHaveText("Già in un altro Nest", {
      useInnerText: true,
    });
  }
  await expect(visibleText(page, OTHER_NEST_TEXT)).toBeVisible();
  const go = page.getByRole("link", { name: "Vai a Oggi" });
  await expect(go).toBeVisible();
  await expect(go).toHaveAttribute("href", "/oggi");
}

/** The normal state of the welcome page for Laura (CA-2 and CA-3). */
async function expectLauraWelcome(page: Page, expiresAt: string) {
  if (isMobileProject()) {
    await expect(h1(page)).toHaveText("Marco ti aspetta in Casa D'Angelo", {
      useInnerText: true,
    });
  } else {
    await expect(h1(page)).toHaveText("Entra in Casa D'Angelo", {
      useInnerText: true,
    });
  }
  await expect(
    page.getByRole("button", { name: "Entra con Apple" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Entra con Google" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Usa la mail" })).toBeVisible();
  await expect(
    page.getByText("Continuando accetti").filter({ visible: true }),
  ).toHaveText(
    `${expectedLead(expiresAt)} Continuando accetti i Termini d'uso e l'Informativa sulla privacy.`,
  );
}

// ================================================================ contenuto

test.describe("benvenuto (07)", () => {
  test("CA-1: il link salva il token in un cookie HttpOnly e manda a /invito", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    const origin = originOf(baseURL);
    const laura = await lauraInvite();
    const link = linkOf(origin, laura.token);

    // The route answers by itself: 303 with the cookie.
    const response = await page.request.get(link, { maxRedirects: 0 });
    expect(response.status()).toBe(303);
    expect(
      new URL(response.headers()["location"]!, origin).href,
      "destinazione del redirect",
    ).toBe(`${origin}/invito`);
    const cookies = response
      .headersArray()
      .filter((header) => header.name.toLowerCase() === "set-cookie")
      .map((header) => header.value);
    const setCookie = cookies.find((value) => value.startsWith(`${COOKIE}=`));
    expect(setCookie, "Set-Cookie per familynest_invito").toBeDefined();
    expect(setCookie).toMatch(/;\s*HttpOnly/i);
    expect(setCookie).toMatch(/;\s*SameSite=Lax/i);
    expect(setCookie).toMatch(/;\s*Path=\//i);
    const maxAge = Number(/;\s*Max-Age=(\d+)/i.exec(setCookie!)?.[1]);
    expect(maxAge).toBeGreaterThanOrEqual(1);
    expect(maxAge).toBeLessThanOrEqual(86_400);

    // In the browser: final address exactly /invito, token out of reach.
    await page.context().clearCookies();
    await page.goto(link);
    await expect(h1(page)).toBeVisible();
    await expect(page).toHaveURL(`${origin}/invito`);
    expect(await page.evaluate(() => document.cookie)).not.toContain(
      laura.token,
    );
    const cookie = await inviteCookie(page);
    expect(cookie?.value).toBe(laura.token);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    expect(cookie?.path).toBe("/");
  });

  test("CA-2: su mobile 07 mostra titolo, accessi, nota e cinque avatar", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    onlyMobile();
    const laura = await lauraInvite();
    await page.goto(linkOf(originOf(baseURL), laura.token));
    await expectLauraWelcome(page, laura.expires_at);
    await expect(
      page
        .getByRole("link", { name: "Termini d'uso" })
        .filter({ visible: true }),
    ).toHaveAttribute("href", "/termini");
    await expect(
      page
        .getByRole("link", { name: "Informativa sulla privacy" })
        .filter({ visible: true }),
    ).toHaveAttribute("href", "/privacy");

    const avatars = await avatarsOf(page);
    expect(avatars.map((a) => a.text)).toEqual(["M", "S", "T", "B", "?"]);
    const classes = avatars.map((a) => a.classes);
    expect(classes[0]).toContain("membro-pomodoro");
    expect(classes[1]).toContain("membro-salvia");
    expect(classes[2]).toContain("membro-cobalto");
    expect(classes[3]).toContain("membro-zafferano");
    expect(classes[4]).toContain("avatar--vuoto");
    await expect(page.locator(".citazione")).toHaveCount(0);
  });

  test("CA-3: su desktop un solo h1 «Entra in …» e l'intestazione dell'invitato", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    onlyDesktop();
    const laura = await lauraInvite();
    await page.goto(linkOf(originOf(baseURL), laura.token));
    await expect(h1(page)).toHaveCount(1);
    await expect(visibleText(page, "Invito per Laura")).toBeVisible();
    await expect(page.locator("p.claim").filter({ visible: true })).toHaveText(
      "Marco ti aspetta in Casa D'Angelo",
      { useInnerText: true },
    );
    await expectLauraWelcome(page, laura.expires_at);
    await expect(
      page.getByText(expectedLead(laura.expires_at)).filter({ visible: true }),
    ).toBeVisible();
  });

  test("CA-4: gruppo di avatar senza nomi e HTML senza dati degli altri membri", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    const laura = await lauraInvite();
    await page.goto(linkOf(originOf(baseURL), laura.token));
    await expect(
      page.getByRole("img", { name: "Marco e altri 3 nel Nest" }),
    ).toHaveCount(1);
    await expect(avatarGroup(page)).toHaveAttribute("role", "img");

    // Every name, id and date that must not reach the browser.
    const admin = adminClient();
    const householdId = await householdIdByName(NEST_A);
    const { data: members, error } = await admin
      .from("household_members")
      .select("id")
      .eq("household_id", householdId);
    expect(error).toBeNull();
    const forbidden = [
      laura.token,
      householdId,
      laura.id,
      ...(members ?? []).map((m) => m.id as string),
      "2016-12-14",
      "2020-04-02",
    ];
    const html = await rawHtml(page, "/invito");
    expect(html, "la pagina è davvero quella dell'invito").toContain(
      "ti aspetta",
    );
    for (const value of forbidden) expect(html).not.toContain(value);
    for (const word of ["Sofia", "Tommaso", "Biscotto", "4821"]) {
      expect(mentions(html, word), word).toBe(false);
    }
    // Neither the text nor the names of the accessibility tree.
    const text = await page.locator("body").innerText();
    for (const word of ["Sofia", "Tommaso", "Biscotto"]) {
      expect(text).not.toContain(word);
    }
    expect(await avatarGroup(page).locator("[title]").count()).toBe(0);
  });

  test("CA-5: il messaggio di chi invita compare come citazione", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withDeSantisNest(async (nest) => {
      const update = await nest.owner.admin
        .from("invitations")
        .update({ message: "Entra anche tu!" })
        .eq("id", nest.invite.id);
      expect(update.error).toBeNull();
      await page.goto(linkOf(originOf(baseURL), nest.invite.token));
      await expect(
        page.locator(".citazione").filter({ visible: true }),
      ).toHaveText("Ilaria: «Entra anche tu!»", { useInnerText: true });
    });
  });

  test("CA-6: la scadenza dice «domani alle 12:00» e «oggi alle 23:59»", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withDeSantisNest(async (nest) => {
      const link = linkOf(originOf(baseURL), nest.invite.token);
      const lead = page
        .getByText("Continuando accetti")
        .filter({ visible: true });

      const tomorrow = romeInstant(1, 12, 0).toISOString();
      let update = await nest.owner.admin
        .from("invitations")
        .update({ expires_at: tomorrow })
        .eq("id", nest.invite.id);
      expect(update.error).toBeNull();
      await page.goto(link);
      await expect(lead).toContainText(
        "Invito valido fino a domani alle 12:00.",
      );

      // Only while 23:59 of today is still ahead.
      const lastMinute = romeInstant(0, 23, 59);
      if (lastMinute.getTime() - Date.now() > 5 * 60_000) {
        update = await nest.owner.admin
          .from("invitations")
          .update({ expires_at: lastMinute.toISOString() })
          .eq("id", nest.invite.id);
        expect(update.error).toBeNull();
        await page.goto(link);
        await expect(lead).toContainText(
          "Invito valido fino a oggi alle 23:59.",
        );
      }
    });
  });

  test("CA-7: un invito scaduto mostra lo stato errore, senza cookie e senza dati del Nest", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withDeSantisNest(async (nest) => {
      const expired = await nest.inviteFor(
        await nest.addMember("Franco", "lampone"),
        "expired",
      );
      const link = linkOf(originOf(baseURL), expired.token);

      // The page of an invitation that is gone says nothing of the Nest, even
      // when the cookie is still there.
      await setInviteCookie(page, baseURL as string, expired.token);
      const html = await rawHtml(page, "/invito");
      for (const word of [
        "Casa De Santis",
        "Ilaria",
        "Davide",
        "Franco",
        "Pietro",
      ]) {
        expect(html, word).not.toContain(word);
      }
      await page.context().clearCookies();

      await page.goto(link);
      await expectExpired(page);
      expect(await inviteCookie(page)).toBeUndefined();
    });
  });

  test("CA-8: token inventato, malformato, revocato o già usato: sempre lo stesso errore", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNestAndVisitor(async (nest, visitor) => {
      const origin = originOf(baseURL);
      const revoked = await nest.inviteFor(
        await nest.addMember("Elena", "peonia"),
        "revoked",
      );
      const usedMember = await nest.addMember("Franco", "lampone");
      const used = await nest.inviteFor(usedMember);
      const accepted = await visitor.client.rpc(
        "accept_invitation_with_color",
        {
          p_token: used.token,
          p_color: "lampone",
        },
      );
      expect(accepted.error).toBeNull();

      const tokens = [
        randomBytes(32).toString("hex"),
        "abc",
        revoked.token,
        used.token,
      ];
      for (const token of tokens) {
        await page.goto(linkOf(origin, token));
        await expectExpired(page);
        expect(await inviteCookie(page), "cookie dopo il link").toBeUndefined();
        await expect(page).toHaveURL(`${origin}/invito`);
      }
    });
  });

  test("CA-9: senza il cookie dell'invito /invito mostra lo stato errore", async ({
    page,
  }) => {
    test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL, "Supabase non impostato");
    await page.goto("/invito");
    await expectExpired(page);
    expect(await inviteCookie(page)).toBeUndefined();
  });

  test("CA-10: «Entra con Google» mette il bottone in caricamento e non porta il token", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const origin = originOf(baseURL);
    const laura = await lauraInvite();
    const authorize: string[] = [];
    // 204: the browser stays on the page, so the loading state stays too.
    await page.route(`${supabaseUrl}/auth/v1/authorize*`, async (route) => {
      authorize.push(route.request().url());
      await route.fulfill({ status: 204 });
    });
    await page.goto(linkOf(origin, laura.token));
    await expect(
      page.getByRole("button", { name: "Entra con Google" }),
    ).toBeVisible();

    await clickUntil(
      page.getByRole("button", { name: "Entra con Google" }),
      () =>
        expect
          .poll(() => authorize.length, { timeout: 2000 })
          .toBeGreaterThan(0),
    );
    // Read from the DOM: while the browser is being sent to the provider the
    // locators wait for that navigation (same as tests/e2e/login.spec.ts).
    await expect
      .poll(() => visibleButtons(page))
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            text: "Accesso con Google in corso",
            busy: "true",
          }),
          expect.objectContaining({
            text: "Entra con Apple",
            disabled: true,
          }),
        ]),
      );

    expect(authorize).toHaveLength(1);
    const raw = new URL(authorize[0]!).searchParams.get("redirect_to");
    expect(raw).not.toBeNull();
    expect(decodeURIComponent(raw!)).toBe(
      `${origin}/auth/callback?provider=google&next=/invito/colore`,
    );
    expect(authorize[0]).not.toContain(laura.token);
  });

  test("CA-11: accesso annullato presso Google: avviso sulla 07 con il cookie, su /accesso senza", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    const origin = originOf(baseURL);
    const laura = await lauraInvite();
    const cancelled =
      "Accesso con Google annullato. Riprova o scegli un altro modo per entrare.";

    // Without the cookie: as today.
    await page.goto("/auth/callback?provider=google&error=access_denied");
    await expect(page).toHaveURL(`${origin}/accesso?errore=google&annullato=1`);

    // With the cookie: back to the invitation.
    await page.goto(linkOf(origin, laura.token));
    await page.goto("/auth/callback?provider=google&error=access_denied");
    await expect(page).toHaveURL(`${origin}/invito?errore=google&annullato=1`);
    await expect(statusWith(page, cancelled)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Riprova" }).filter({ visible: true }),
    ).toBeVisible();
    await expectLauraWelcome(page, laura.expires_at);
  });

  test("CA-12: «Usa la mail» porta a /accesso/mail", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    const laura = await lauraInvite();
    await page.goto(linkOf(originOf(baseURL), laura.token));
    await page.getByRole("link", { name: "Usa la mail" }).click();
    await expect(page).toHaveURL(`${originOf(baseURL)}/accesso/mail`);
  });
});

// ================================================= accesso e giro dei redirect

test.describe("accesso e redirect", () => {
  test("CA-13: C con il cookie va da /accesso a /invito/colore, senza va a /onboarding", async ({
    page,
    baseURL,
  }) => {
    needsUsers("C");
    const origin = originOf(baseURL);
    const laura = await lauraInvite();
    await signInAs(page.context(), baseURL as string, "C");
    await page.goto(linkOf(origin, laura.token));
    await page.goto("/accesso");
    await expect(page).toHaveURL(`${origin}/invito/colore`);

    await page.context().clearCookies({ name: COOKIE });
    await page.goto("/accesso");
    await expect(page).toHaveURL(/\/onboarding(\/|$)/);
  });

  test("CA-25: senza sessione /invito/colore porta a /invito o /accesso; C senza cookie a /onboarding", async ({
    page,
    baseURL,
  }) => {
    needsUsers("C");
    const origin = originOf(baseURL);
    const laura = await lauraInvite();

    // Visitor without a session, with the cookie.
    await page.goto(linkOf(origin, laura.token));
    await page.goto("/invito/colore");
    await expect(page).toHaveURL(`${origin}/invito`);
    await expect(h1(page)).toBeVisible();

    // Without the cookie.
    await page.context().clearCookies();
    await page.goto("/invito/colore");
    await expect(page).toHaveURL(`${origin}/accesso`);

    // C with a session and no cookie.
    await signInAs(page.context(), baseURL as string, "C");
    await page.goto("/invito/colore");
    await expect(page).toHaveURL(/\/onboarding(\/|$)/);
  });

  test("CA-26: invito scaduto nel frattempo: errore, cookie cancellato, nessun giro di redirect", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNestAndVisitor(async (nest, visitor) => {
      const origin = originOf(baseURL);
      const expired = await nest.inviteFor(
        await nest.addMember("Franco", "lampone"),
        "expired",
      );
      await visitor.signInContext(page.context(), baseURL as string);
      // The cookie is there, the invitation is no longer valid.
      await setInviteCookie(page, baseURL as string, expired.token);

      await page.goto("/invito/colore");
      await expect(page).toHaveURL(`${origin}/invito`);
      await expectExpired(page);
      expect(await inviteCookie(page)).toBeUndefined();

      await page.goto("/accesso");
      await expect(page).toHaveURL(/\/onboarding(\/|$)/);
      await expect(page).not.toHaveURL(/\/invito/);
    });
  });

  test("CA-27: A, già nel Nest dell'invito, va a /oggi e l'invito resta com'è", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    const origin = originOf(baseURL);
    const laura = await lauraInvite();
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto(linkOf(origin, laura.token));
    await expect(page).toHaveURL(`${origin}/oggi`);
    expect(await inviteCookie(page)).toBeUndefined();
    const after = await lauraInvite();
    expect(after.id).toBe(laura.id);
    expect(after.status).toBe("pending");
  });

  test("CA-28 bis: un altro Nest con lo stesso nome non è il Nest dell'invito", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNestAndVisitor(async (nest, visitor) => {
      const origin = originOf(baseURL);
      // The visitor founds a Nest with the very same name as the one inviting.
      const created = await visitor.client.rpc("create_household", {
        name: nest.nest,
        household_type: "single",
        member_name: "Giorgio",
        color: "pomodoro",
      });
      expect(created.error).toBeNull();
      await visitor.signInContext(page.context(), baseURL as string);
      await page.goto(linkOf(origin, nest.invite.token));
      await expect(page).toHaveURL(/\/invito(\?stato=altro-nest)?$/);
      await expectOtherNest(page);
      expect(await inviteCookie(page)).toBeUndefined();
    });
  });

  test("CA-28: B, in un altro Nest, vede «Sei già in un altro Nest» e non il Nest dell'invito", async ({
    page,
    baseURL,
  }) => {
    needsUsers("B");
    const origin = originOf(baseURL);
    const laura = await lauraInvite();
    await signInAs(page.context(), baseURL as string, "B");

    // The page sent while the cookie is still there carries nothing of the Nest.
    await setInviteCookie(page, baseURL as string, laura.token);
    const early = await rawHtml(page, "/invito");
    for (const word of ["Marco", "Laura", "Sofia"]) {
      expect(mentions(early, word), word).toBe(false);
    }
    expect(early).not.toMatch(/D(&#x27;|&#39;|')Angelo/);
    await page.context().clearCookies({ name: COOKIE });

    await page.goto(linkOf(origin, laura.token));
    await expect(page).toHaveURL(/\/invito(\?stato=altro-nest)?$/);
    await expectOtherNest(page);
    const text = await page.locator("body").innerText();
    for (const word of ["Casa D'Angelo", "Marco", "Laura"]) {
      expect(text).not.toContain(word);
    }
    expect(await inviteCookie(page)).toBeUndefined();

    // Nothing changed in the database.
    const after = await lauraInvite();
    expect(after.id).toBe(laura.id);
    const admin = adminClient();
    const { data: lauraRow } = await admin
      .from("household_members")
      .select("user_id")
      .eq("id", laura.member_id)
      .single();
    expect(lauraRow?.user_id).toBeNull();
    const { data: giulia } = await admin
      .from("household_members")
      .select("household_id, user_id")
      .eq("id", "b1000000-0000-4000-8000-000000000001")
      .single();
    expect(giulia?.household_id).toBe(await householdIdByName(NEST_B));
    expect(giulia?.user_id).not.toBeNull();
  });
});

// ============================================================ colore (08)

test.describe("il tuo colore (08)", () => {
  /** C on the colour page of Laura. */
  async function colorAsC(page: Page, baseURL: string | undefined) {
    const laura = await lauraInvite();
    await signInAs(page.context(), baseURL as string, "C");
    await page.goto(linkOf(originOf(baseURL), laura.token));
    await page.goto("/invito/colore");
    await colorPageReady(page);
    return laura;
  }

  const LAURA_ORDER = [
    "Glicine",
    "Lampone",
    "Ceruleo",
    "Peonia",
    "Basilico",
    "Cannella",
    "Pomodoro (già di Marco)",
    "Salvia (già di Sofia)",
    "Cobalto (già di Tommaso)",
    "Zafferano (già di Biscotto)",
  ];

  test("CA-14: su mobile la 08 mostra saluto, passo, anteprima, colori e aiuto", async ({
    page,
    baseURL,
  }) => {
    needsUsers("C");
    onlyMobile();
    await colorAsC(page, baseURL);
    await expect(visibleText(page, "Ciao Laura")).toBeVisible();
    await expect(h1(page)).toHaveText("Scegli il tuo colore");
    const bar = page.getByRole("progressbar", { name: "Passo 1 di 3" });
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute("aria-valuenow", "1");
    await expect(bar).toHaveAttribute("aria-valuemax", "3");

    const preview = page.locator(".anteprima-avatar").filter({ visible: true });
    await expect(preview.locator(".avatar")).toHaveText("L");
    await expect(preview.locator(".avatar")).toHaveClass(/membro-glicine/);
    await expect(preview.locator(".anteprima-avatar__nome")).toHaveText(
      "Laura",
    );

    await expect(colorGroup(page).getByRole("radio")).toHaveCount(10);
    await expect(radio(page, "Glicine")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    for (const name of [
      "Pomodoro (già di Marco)",
      "Salvia (già di Sofia)",
      "Cobalto (già di Tommaso)",
      "Zafferano (già di Biscotto)",
    ]) {
      await expect(radio(page, name)).toBeDisabled();
    }
    for (const name of [
      "Glicine",
      "Lampone",
      "Ceruleo",
      "Peonia",
      "Basilico",
      "Cannella",
    ]) {
      await expect(radio(page, name)).toBeEnabled();
    }
    await expect(
      visibleText(
        page,
        "Marco ti aveva dato il glicine. I colori spenti sono già di qualcun altro.",
      ),
    ).toBeVisible();
    await expect(continueButton(page)).toBeVisible();
    await expect(backControl(page)).toHaveCount(1);
  });

  test("CA-15: su desktop un solo h1, «Continua», «Indietro» e passo, niente «Pediatra»", async ({
    page,
    baseURL,
  }) => {
    needsUsers("C");
    onlyDesktop();
    await colorAsC(page, baseURL);
    await expect(h1(page)).toHaveCount(1);
    await expect(h1(page)).toHaveText("Scegli il tuo colore");
    await expect(continueButton(page)).toBeVisible();
    await expect(
      page.getByRole("progressbar", { name: "Passo 1 di 3" }),
    ).toBeVisible();
    await expect(backControl(page)).toHaveCount(1);
    await expect(backControl(page)).toHaveAttribute("href", "/invito");
    const text = await page.locator("main").innerText();
    expect(text).not.toContain("Pediatra");
    expect(await rawHtml(page, "/invito/colore")).not.toContain("Pediatra");
  });

  test("CA-16: scegliere un colore cambia l'anteprima e non scrive niente", async ({
    page,
    baseURL,
  }) => {
    needsUsers("C");
    const laura = await colorAsC(page, baseURL);
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));

    await radio(page, "Peonia").click();
    await expect(radio(page, "Peonia")).toHaveAttribute("aria-checked", "true");
    await expect(
      page.locator(".anteprima-avatar .avatar").filter({ visible: true }),
    ).toHaveClass(/membro-peonia/);
    expect(requests, "richieste dopo il clic").toEqual([]);

    const { data } = await adminClient()
      .from("household_members")
      .select("color, user_id")
      .eq("id", laura.member_id)
      .single();
    expect(data?.color).toBe("glicine");
    expect(data?.user_id).toBeNull();
  });

  test("CA-17: le frecce seguono l'ordine mostrato e saltano i colori disabilitati", async ({
    page,
    baseURL,
  }) => {
    needsUsers("C");
    await colorAsC(page, baseURL);
    await radio(page, "Glicine").focus();
    // Right: free colours in the order shown, then back to the first one.
    const walk = [
      "Lampone",
      "Ceruleo",
      "Peonia",
      "Basilico",
      "Cannella",
      "Glicine",
      "Lampone",
    ];
    for (const name of walk) {
      await page.keyboard.press("ArrowRight");
      await expect(radio(page, name)).toBeFocused();
      await expect(radio(page, name)).toHaveAttribute("aria-checked", "true");
    }
    // Never on a colour of someone else.
    for (const name of [
      "Pomodoro (già di Marco)",
      "Salvia (già di Sofia)",
      "Cobalto (già di Tommaso)",
      "Zafferano (già di Biscotto)",
    ]) {
      await expect(radio(page, name)).not.toBeFocused();
    }
    // Left goes back the same way.
    await page.keyboard.press("ArrowLeft");
    await expect(radio(page, "Glicine")).toBeFocused();
  });

  test("Extra: i colori sono in 2 righe da 5 nell'ordine «scelto, liberi, presi»", async ({
    page,
    baseURL,
  }) => {
    needsUsers("C");
    await colorAsC(page, baseURL);
    expect(await colorNames(page)).toEqual(LAURA_ORDER);

    const boxes = await colorGroup(page)
      .getByRole("radio")
      .evaluateAll((nodes) =>
        nodes.map((node) => Math.round(node.getBoundingClientRect().top)),
      );
    const first = boxes.slice(0, 5);
    const second = boxes.slice(5);
    expect(new Set(first).size, "prima riga").toBe(1);
    expect(new Set(second).size, "seconda riga").toBe(1);
    expect(second[0]!).toBeGreaterThan(first[0]!);

    // One tab stop for the whole group: Tab leaves it for the next control
    // (on desktop «Indietro» comes first, then «Continua»).
    await radio(page, "Glicine").focus();
    await page.keyboard.press("Tab");
    if (!isMobileProject()) {
      await expect(backControl(page)).toBeFocused();
      await page.keyboard.press("Tab");
    }
    await expect(continueButton(page)).toBeFocused();
  });

  test("Extra: l'ordine dei colori non cambia quando se ne sceglie un altro", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNestAndVisitor(async (nest, visitor) => {
      await visitor.signInContext(page.context(), baseURL as string);
      await page.goto(linkOf(originOf(baseURL), nest.invite.token));
      await page.goto("/invito/colore");
      await colorPageReady(page);
      const expected = [
        "Cobalto",
        "Glicine",
        "Zafferano",
        "Lampone",
        "Ceruleo",
        "Peonia",
        "Basilico",
        "Cannella",
        "Pomodoro (già di Ilaria)",
        "Salvia (già di Pietro)",
      ];
      expect(await colorNames(page)).toEqual(expected);
      await radio(page, "Peonia").click();
      await expect(radio(page, "Peonia")).toHaveAttribute(
        "aria-checked",
        "true",
      );
      expect(await colorNames(page)).toEqual(expected);
      await expect(
        visibleText(
          page,
          "Ilaria ti aveva dato il cobalto. I colori spenti sono già di qualcun altro.",
        ),
      ).toBeVisible();
    });
  });

  test("CA-18: V sceglie Peonia e «Continua»: entra nel Nest di Davide", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNestAndVisitor(async (nest, visitor) => {
      await visitor.signInContext(page.context(), baseURL as string);
      await page.goto(linkOf(originOf(baseURL), nest.invite.token));
      await page.goto("/invito/colore");
      await colorPageReady(page);
      await radio(page, "Peonia").click();
      await expect(radio(page, "Peonia")).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await continueButton(page).click();
      await expect(page).toHaveURL(/\/oggi$/);
      expect(await inviteCookie(page)).toBeUndefined();

      const davide = await nest.member(nest.davideId);
      expect(davide.user_id).toBe(visitor.id);
      expect(davide.joined_at).not.toBeNull();
      expect(davide.is_admin).toBe(false);
      expect(davide.color).toBe("peonia");
      const invitation = await nest.invitation(nest.invite.id);
      expect(invitation.status).toBe("accepted");
      expect(
        Math.abs(Date.now() - new Date(invitation.accepted_at!).getTime()),
      ).toBeLessThan(2 * 60_000);
      expect(await nest.memberCount()).toBe(3);
    });
  });

  test("CA-19: «Continua» senza cambiare colore tiene il colore dato da chi invita", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNestAndVisitor(async (nest, visitor) => {
      await visitor.signInContext(page.context(), baseURL as string);
      await page.goto(linkOf(originOf(baseURL), nest.invite.token));
      await page.goto("/invito/colore");
      await colorPageReady(page);
      await continueButton(page).click();
      await expect(page).toHaveURL(/\/oggi$/);
      expect((await nest.member(nest.davideId)).color).toBe("cobalto");
      expect((await nest.member(nest.davideId)).user_id).toBe(visitor.id);
    });
  });

  test("CA-20: colore preso nel frattempo: avviso, colore spento, poi un altro colore", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNestAndVisitor(async (nest, visitor) => {
      await visitor.signInContext(page.context(), baseURL as string);
      await page.goto(linkOf(originOf(baseURL), nest.invite.token));
      await page.goto("/invito/colore");
      await colorPageReady(page);

      // Someone takes the colour after the page was drawn.
      const taken = await nest.owner.admin
        .from("household_members")
        .update({ color: "peonia" })
        .eq("id", nest.pietroId);
      expect(taken.error).toBeNull();

      await radio(page, "Peonia").click();
      await expect(radio(page, "Peonia")).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await continueButton(page).click();
      await expect(
        alertWith(
          page,
          "Pietro ha appena preso la peonia. Scegli un altro colore.",
        ),
      ).toBeVisible();
      await expect(page).toHaveURL(/\/invito\/colore$/);
      await expect(radio(page, "Peonia (già di Pietro)")).toBeDisabled();
      expect((await nest.member(nest.davideId)).user_id).toBeNull();

      await radio(page, "Basilico").click();
      await expect(radio(page, "Basilico")).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await continueButton(page).click();
      await expect(page).toHaveURL(/\/oggi$/);
      const davide = await nest.member(nest.davideId);
      expect(davide.user_id).toBe(visitor.id);
      expect(davide.color).toBe("basilico");
    });
  });

  test("CA-21: invito revocato dopo il caricamento: «Continua» porta allo stato errore", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNestAndVisitor(async (nest, visitor) => {
      const origin = originOf(baseURL);
      await visitor.signInContext(page.context(), baseURL as string);
      await page.goto(linkOf(origin, nest.invite.token));
      await page.goto("/invito/colore");
      await colorPageReady(page);

      const revoked = await nest.owner.admin
        .from("invitations")
        .update({ status: "revoked" })
        .eq("id", nest.invite.id);
      expect(revoked.error).toBeNull();

      await continueButton(page).click();
      await expect(page).toHaveURL(`${origin}/invito`);
      await expectExpired(page);
      expect(await inviteCookie(page)).toBeUndefined();
      expect((await nest.member(nest.davideId)).user_id).toBeNull();
    });
  });

  test("CA-22: errore di rete su «Continua»: avviso, scelta invariata, si resta sulla 08", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNestAndVisitor(async (nest, visitor) => {
      const origin = originOf(baseURL);
      await visitor.signInContext(page.context(), baseURL as string);
      await page.goto(linkOf(origin, nest.invite.token));
      await page.goto("/invito/colore");
      await colorPageReady(page);
      await radio(page, "Peonia").click();
      await expect(radio(page, "Peonia")).toHaveAttribute(
        "aria-checked",
        "true",
      );

      // The server action is a POST to the page itself.
      await page.route(
        (url) => url.pathname === "/invito/colore",
        (route) =>
          route.request().method() === "POST"
            ? route.abort()
            : route.continue(),
      );
      await continueButton(page).click();
      const notice = alertWith(
        page,
        "Non siamo riusciti ad andare avanti. Controlla la connessione e riprova.",
      );
      await expect(notice).toBeVisible();
      await expect(
        notice.getByRole("button", { name: "Riprova" }),
      ).toBeVisible();
      await expect(page).toHaveURL(`${origin}/invito/colore`);
      await expect(radio(page, "Peonia")).toHaveAttribute(
        "aria-checked",
        "true",
      );
      expect((await nest.member(nest.davideId)).user_id).toBeNull();
    });
  });

  test("CA-23: due clic su «Continua» fanno partire una sola richiesta", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNestAndVisitor(async (nest, visitor) => {
      await visitor.signInContext(page.context(), baseURL as string);
      await page.goto(linkOf(originOf(baseURL), nest.invite.token));
      await page.goto("/invito/colore");
      await colorPageReady(page);

      let calls = 0;
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route(
        (url) => url.pathname === "/invito/colore",
        async (route) => {
          if (route.request().method() !== "POST") return route.continue();
          calls += 1;
          await gate;
          return route.continue();
        },
      );

      const button = continueButton(page);
      await button.click();
      await expect(button).toHaveAttribute("aria-busy", "true");
      // The second tap lands while the first request is still waiting.
      await button.dispatchEvent("click");
      await expect.poll(() => calls).toBe(1);
      release();
      await expect(page).toHaveURL(/\/oggi$/);
      expect(calls, "richieste della server action").toBe(1);
      expect((await nest.member(nest.davideId)).user_id).toBe(visitor.id);
    });
  });

  test("CA-24b: con «Continua» in corso, il clic su «Indietro» non cambia pagina", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNestAndVisitor(async (nest, visitor) => {
      await visitor.signInContext(page.context(), baseURL as string);
      await page.goto(linkOf(originOf(baseURL), nest.invite.token));
      await page.goto("/invito/colore");
      await colorPageReady(page);

      await page.route(
        (url) => url.pathname === "/invito/colore",
        async (route) => {
          if (route.request().method() !== "POST") return route.continue();
          // The request never ends: «Continua» stays in progress.
          return new Promise<void>(() => undefined);
        },
      );
      const button = continueButton(page);
      await button.click();
      await expect(button).toHaveAttribute("aria-busy", "true");
      const back = backControl(page);
      await expect(back).toHaveAttribute("aria-disabled", "true");
      // Explicit wait: a navigation to /invito must NOT happen after the click.
      const navigation = page.waitForURL(/\/invito$/, { timeout: 1000 });
      await back.dispatchEvent("click");
      await expect(navigation).rejects.toThrow(/Timeout/);
      await expect(page).toHaveURL(`${originOf(baseURL)}/invito/colore`);
      await expect(h1(page)).toHaveText("Scegli il tuo colore");
    });
  });

  test("CA-24: «Indietro» riporta alla 07 nello stato normale (anche su desktop)", async ({
    page,
    baseURL,
  }) => {
    needsUsers("C");
    const laura = await colorAsC(page, baseURL);
    await backControl(page).click();
    await expect(page).toHaveURL(`${originOf(baseURL)}/invito`);
    await expectLauraWelcome(page, laura.expires_at);
    expect((await avatarsOf(page)).map((a) => a.text)).toEqual([
      "M",
      "S",
      "T",
      "B",
      "?",
    ]);
  });
});

// ===================================================== isolamento e database

test.describe("isolamento", () => {
  test("CA-29: C vede solo il Nest dell'invito", async ({ page, baseURL }) => {
    needsUsers("C");
    const origin = originOf(baseURL);
    const laura = await lauraInvite();
    const foreign = ["Giulia", "Paolo", "Leo", "Anna"];

    await signInAs(page.context(), baseURL as string, "C");
    await page.goto(linkOf(origin, laura.token));
    const welcome = await rawHtml(page, "/invito");
    expect(welcome).toContain("ti aspetta");
    await page.goto("/invito/colore");
    await colorPageReady(page);
    const colorHtml = await rawHtml(page, "/invito/colore");
    for (const html of [welcome, colorHtml]) {
      expect(html).not.toContain("Casa Bianchi");
      for (const word of foreign)
        expect(mentions(html, word), word).toBe(false);
    }
    // Only the four colours of Casa D'Angelo are switched off.
    const names = await colorNames(page);
    expect(names.filter((name) => name.includes("(già di"))).toEqual([
      "Pomodoro (già di Marco)",
      "Salvia (già di Sofia)",
      "Cobalto (già di Tommaso)",
      "Zafferano (già di Biscotto)",
    ]);
  });

  test("CA-29: V sulla 08 di Davide non vede il Nest di Laura", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withNestAndVisitor(async (nest, visitor) => {
      await visitor.signInContext(page.context(), baseURL as string);
      await page.goto(linkOf(originOf(baseURL), nest.invite.token));
      await page.goto("/invito/colore");
      await colorPageReady(page);
      const html = await rawHtml(page, "/invito/colore");
      expect(html).toMatch(/Ciao\s*(<!-- -->)?\s*Davide/);
      expect(html).not.toMatch(/D(&#x27;|&#39;|')Angelo/);
      for (const word of ["Marco", "Sofia", "Laura"]) {
        expect(mentions(html, word), word).toBe(false);
      }
    });
  });

  test("CA-30: l'anteprima non dà dati a chi non deve vederli e il Nest resta chiuso a C", async () => {
    needsUsers("A", "C");
    const laura = await lauraInvite();
    const anon = anonClient();

    // Unknown token: only «invalid», everything else empty.
    const unknown = await anon.rpc("invitation_preview", {
      p_token: randomBytes(32).toString("hex"),
    });
    expect(unknown.error).toBeNull();
    expect(unknown.data).toHaveLength(1);
    const miss = unknown.data[0] as Record<string, unknown>;
    expect(miss["status"]).toBe("invalid");
    for (const key of [
      "household_name",
      "inviter_name",
      "message",
      "invitee_name",
      "invitee_color",
      "expires_at",
      "members",
    ]) {
      expect(miss[key], key).toBeNull();
    }

    // Laura's token, no session: names of Marco and Laura only.
    const known = await anon.rpc("invitation_preview", {
      p_token: laura.token,
    });
    expect(known.error).toBeNull();
    expect(known.data).toHaveLength(1);
    const row = known.data[0] as Record<string, unknown>;
    expect(row["status"]).toBe("valid");
    expect(row["inviter_name"]).toBe("Marco");
    expect(row["invitee_name"]).toBe("Laura");
    const members = row["members"] as Array<Record<string, unknown>>;
    expect(members).toHaveLength(4);
    for (const member of members) {
      expect(member["name"], "nome di un membro").toBeNull();
      expect(Object.keys(member).sort()).toEqual(["color", "initial", "name"]);
    }
    const serialized = JSON.stringify(row);
    for (const value of [
      laura.token,
      "4821",
      "2016-12-14",
      "2020-04-02",
      laura.id,
    ]) {
      expect(serialized).not.toContain(value);
    }
    for (const word of ["Sofia", "Tommaso", "Biscotto"]) {
      expect(serialized).not.toContain(word);
    }
    expect(serialized).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
    );

    // A, who is in the Nest, does not get the names either.
    const member = await (
      await seedClient("A")
    ).rpc("invitation_preview", {
      p_token: laura.token,
    });
    const asMember = (member.data[0] as { members: Array<{ name: unknown }> })
      .members;
    expect(asMember.every((m) => m.name === null)).toBe(true);

    // C, signed in without a Nest, sees the Nest of the invitation only through
    // the function: the tables stay closed.
    const c = await seedClient("C");
    const people = await c.from("household_members").select("id");
    expect(people.error).toBeNull();
    expect(people.data).toEqual([]);
    const homes = await c.from("households").select("id");
    expect(homes.error).toBeNull();
    expect(homes.data).toEqual([]);
  });

  test("CA-31: senza sessione «entra con invito e colore» è rifiutata", async () => {
    needsUsers("A");
    const laura = await lauraInvite();
    const { error } = await anonClient().rpc("accept_invitation_with_color", {
      p_token: laura.token,
      p_color: "lampone",
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
    const { data } = await adminClient()
      .from("household_members")
      .select("user_id, color")
      .eq("id", laura.member_id)
      .single();
    expect(data?.user_id).toBeNull();
    expect(data?.color).toBe("glicine");
  });

  test("CA-32: cache privata, nessun referrer, il token non gira e nessun dominio estraneo", async ({
    page,
    baseURL,
  }) => {
    needsUsers("C");
    const origin = originOf(baseURL);
    const supabaseOrigin = new URL(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    ).origin;
    const laura = await lauraInvite();

    const requests: string[] = [];
    const documents = new Map<string, string | undefined>();
    page.on("request", (request) => requests.push(request.url()));
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (
        response.request().resourceType() === "document" &&
        response.status() === 200 &&
        url.origin === origin &&
        (url.pathname === "/invito" || url.pathname === "/invito/colore")
      ) {
        documents.set(url.pathname, response.headers()["cache-control"]);
      }
    });

    await signInAs(page.context(), baseURL as string, "C");
    await page.goto(linkOf(origin, laura.token));
    await expect(h1(page)).toBeVisible();
    await page.goto("/invito/colore");
    await colorPageReady(page);
    await page.goto("/invito");
    await expect(h1(page)).toBeVisible();

    // Cache-Control of the pages.
    for (const path of ["/invito", "/invito/colore"]) {
      expect(documents.has(path), `risposta di ${path}`).toBe(true);
      expect(documents.get(path), `Cache-Control di ${path}`).toMatch(
        /private|no-store/,
      );
    }

    // The link route and the cleaning route: no store, no referrer.
    for (const path of [
      `/invito/${laura.token}`,
      "/invito/chiudi?vai=errore",
    ]) {
      const response = await page.request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(303);
      expect(response.headers()["cache-control"], path).toContain("no-store");
      expect(response.headers()["referrer-policy"], path).toBe("no-referrer");
    }

    // After the first address the token is in no address.
    const [first, ...rest] = requests;
    expect(first).toContain(laura.token);
    for (const url of rest) expect(url, url).not.toContain(laura.token);

    // Only the app and Supabase.
    const foreign = requests
      .filter((url) => /^https?:/.test(url))
      .map((url) => new URL(url).origin)
      .filter((o) => o !== origin && o !== supabaseOrigin);
    expect(foreign).toEqual([]);
  });

  test("CA-33: un errore tecnico mostra «Questa pagina non si è caricata» e mai «scaduto»", async () => {
    // The browser cannot stop the database the server talks to, so this is the
    // second way the criterion allows: the error branch of both pages renders
    // OnboardingError before anything else, and OnboardingError has the texts.
    const read = (path: string) =>
      readFileSync(join(process.cwd(), path), "utf8");
    const welcome = read("src/app/invito/page.tsx");
    const colour = read("src/app/invito/colore/page.tsx");
    const error = read("src/components/onboarding/OnboardingError.tsx");
    const pageError = read("src/components/ui/PageError/PageError.tsx");

    for (const source of [welcome, colour]) {
      expect(source).toMatch(
        /session\.kind === "error"\)\s*return <OnboardingError \/>/,
      );
      expect(source).toMatch(
        /preview\.status === "error"\)\s*return <OnboardingError \/>/,
      );
    }
    // The session is read before the preview and before any decision.
    expect(welcome.indexOf('session.kind === "error"')).toBeLessThan(
      welcome.indexOf("<InviteEnded"),
    );
    expect(welcome.indexOf('preview.status === "error"')).toBeLessThan(
      welcome.indexOf('preview.status === "invalid"'),
    );
    expect(colour.indexOf('preview.status === "error"')).toBeLessThan(
      colour.indexOf('preview.status === "invalid"'),
    );

    expect(error).toContain("headingLevel={1}");
    expect(error).toContain('text="Controlla la connessione e riprova."');
    expect(error).toContain("onRetry={retry}");
    expect(error).not.toContain("exit=");
    expect(pageError).toContain("Questa pagina non si è caricata");
    expect(pageError).toContain("Riprova");
  });
});

// ================================================== il «+N» con molti membri

test.describe("gruppo di avatar", () => {
  test("Extra: da 5 altri membri compare «+N»; il nome conta sempre tutti", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withDeSantisNest(async (nest) => {
      const link = linkOf(originOf(baseURL), nest.invite.token);
      // Davide is the invitee, so he is never in the group.
      // Others so far: Ilaria and Pietro.
      await page.goto(link);
      await expect(
        page.getByRole("img", { name: "Ilaria e un altro nel Nest" }),
      ).toHaveCount(1);
      expect((await avatarsOf(page)).map((a) => a.text)).toEqual([
        "I",
        "P",
        "?",
      ]);

      // Four others: all four are drawn, no «+N».
      const more: Array<[string, Color]> = [
        ["Sara", "glicine"],
        ["Tina", "zafferano"],
        ["Ugo", "lampone"],
        ["Vera", "ceruleo"],
        ["Zoe", "peonia"],
        ["Anita", "basilico"],
        ["Bruno", "cannella"],
      ];
      await nest.addMember(...more[0]!);
      await nest.addMember(...more[1]!);
      await page.goto(link);
      await expect(
        page.getByRole("img", { name: "Ilaria e altri 3 nel Nest" }),
      ).toHaveCount(1);
      expect((await avatarsOf(page)).map((a) => a.text)).toEqual([
        "I",
        "P",
        "S",
        "T",
        "?",
      ]);

      // Five others: the first three, «+2» and the «?».
      await nest.addMember(...more[2]!);
      await page.goto(link);
      await expect(
        page.getByRole("img", { name: "Ilaria e altri 4 nel Nest" }),
      ).toHaveCount(1);
      let avatars = await avatarsOf(page);
      expect(avatars.map((a) => a.text)).toEqual(["I", "P", "S", "+2", "?"]);
      expect(avatars[3]!.classes).toContain("avatar--altri");
      expect(avatars[4]!.classes).toContain("avatar--vuoto");

      // Nine others (the Nest is full with Davide): «+6».
      for (const member of more.slice(3)) await nest.addMember(...member);
      expect(await nest.memberCount()).toBe(10);
      await page.goto(link);
      await expect(
        page.getByRole("img", { name: "Ilaria e altri 8 nel Nest" }),
      ).toHaveCount(1);
      avatars = await avatarsOf(page);
      expect(avatars.map((a) => a.text)).toEqual(["I", "P", "S", "+6", "?"]);
      expect(avatars).toHaveLength(5);

      // The page sent to the browser has no name of the others.
      const html = await rawHtml(page, "/invito");
      for (const word of [
        "Pietro",
        "Sara",
        "Tina",
        "Ugo",
        "Vera",
        "Zoe",
        "Anita",
      ]) {
        expect(mentions(html, word), word).toBe(false);
      }
    });
  });

  test("Extra: se chi invita non c'è più, «Ti aspettano» e «Già nel Nest: 3»", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withDeSantisNest(async (nest) => {
      const update = await nest.owner.admin
        .from("invitations")
        .update({ invited_by_member_id: null, message: "Ciao!" })
        .eq("id", nest.invite.id);
      expect(update.error).toBeNull();
      await nest.addMember("Sara", "glicine");
      await page.goto(linkOf(originOf(baseURL), nest.invite.token));
      if (isMobileProject()) {
        await expect(h1(page)).toHaveText("Ti aspettano in Casa De Santis", {
          useInnerText: true,
        });
      } else {
        await expect(h1(page)).toHaveText("Entra in Casa De Santis");
      }
      await expect(
        page.getByRole("img", { name: "Già nel Nest: 3" }),
      ).toHaveCount(1);
      // No inviter, no quotation.
      await expect(page.locator(".citazione")).toHaveCount(0);
    });
  });
});
