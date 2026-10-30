import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { formatAge, formatTimeUntil } from "../../src/lib/datetime";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import {
  inviteCountOfHousehold,
  householdIdByName,
  NEST_B,
  removeShare,
  shareCalls,
  stubShare,
} from "../fixtures/invito";
import {
  IDS,
  LOAD_ERROR,
  NOT_FOUND,
  PAGE_TITLE,
  adminClient,
  anyInvites,
  backLink,
  breakClipboard,
  cutServerActions,
  h1,
  memberById,
  memberPath,
  nestList,
  openMember,
  pageText,
  pendingDetails,
  randomId,
  removeButton,
  roleSwitch,
  sendAgain,
  sendFirst,
  sentText,
  slowServerActions,
  subtitle,
  toast,
  withMemberNest,
  withRita,
  yearsAgo,
} from "../fixtures/membro";
import {
  createThrowawayUser,
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";

// "Un membro del Nest" (#18, /membri/<id>): one test or more for every
// acceptance criterion CA-1 ... CA-40 (CA-15 was removed). The criteria that
// are about the changes to "Il tuo Nest" (CA-38, CA-40) are in
// tests/e2e/il-tuo-nest.spec.ts, where they replace CA-8 and CA-16 of #17.
// Seeded users A, B, B2, C only read; every test that writes uses its own
// throwaway user U (and U2), deleted at the end. A criterion without "(anche
// 1280)" holds at 390 px: on desktop it is skipped.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  permissions: ["clipboard-read", "clipboard-write"],
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

const isMobile = () => test.info().project.name === "mobile";

function onlyMobile() {
  test.skip(!isMobile(), "Criterio valido solo a 390 px");
}

function needsUsers(...keys: Parameters<typeof usersConfigured>) {
  test.skip(!usersConfigured(...keys), skipReason(...keys));
}

function needsThrowaway() {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
}

async function signIn(
  page: Page,
  baseURL: string | undefined,
  key: "A" | "B" | "B2" | "C",
) {
  await signInAs(page.context(), baseURL as string, key);
}

/** Server-rendered HTML of a page, as the browser receives it. */
async function htmlOf(page: Page, path: string) {
  const response = await page.request.get(path);
  return { response, text: await response.text() };
}

const nestDAngelo = /Casa D(?:'|&#x27;|&#39;|\\u0027)Angelo/;
const nestBianchi = /Casa Bianchi/;

const inviteLink = (page: Page, token: string) =>
  `${new URL(page.url()).origin}/invito/${token}`;

async function expectNotFound(page: Page, path: string) {
  await page.goto(path);
  await expect(h1(page)).toHaveText(NOT_FOUND);
  await expect(page.getByText(LOAD_ERROR)).toHaveCount(0);
}

// ------------------------------------------------- accesso e isolamento

test.describe("accesso e isolamento", () => {
  test("CA-1: senza sessione arriva a /accesso", async ({ page }) => {
    onlyMobile();
    await page.goto(memberPath(IDS.laura));
    await expect(page).toHaveURL(/\/accesso/);
  });

  test("CA-2: utente senza Nest arriva a /onboarding", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsUsers("C");
    await signIn(page, baseURL, "C");
    await page.goto(memberPath(IDS.laura));
    await expect(page).toHaveURL(/\/onboarding/);
  });

  test("CA-3: la propria pagina porta a /profilo", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsUsers("A");
    await signIn(page, baseURL, "A");
    await page.goto(memberPath(IDS.marco));
    await expect(page).toHaveURL(/\/profilo$/);
  });

  test("CA-4: un altro Nest riceve «Questa pagina non c’è», senza dati dell'altro", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsUsers("A", "B");
    const lauraToken = (await pendingDetails(IDS.laura))[0]!.token;
    const annaToken = (await anyInvites(IDS.anna))[0]!.token;

    // B looks at the members of Casa D'Angelo.
    await signIn(page, baseURL, "B");
    for (const id of [IDS.laura, IDS.biscotto]) {
      await expectNotFound(page, memberPath(id));
      const { text } = await htmlOf(page, memberPath(id));
      for (const forbidden of ["Laura", "Biscotto", "4821", lauraToken]) {
        expect(text, `L'HTML non deve contenere ${forbidden}`).not.toContain(
          forbidden,
        );
      }
      expect(text).not.toMatch(nestDAngelo);
    }

    // A looks at Anna of Casa Bianchi (a new context: another session).
    const other = await page.context().browser()!.newContext({ baseURL });
    try {
      const pageA = await other.newPage();
      await signInAs(other, baseURL as string, "A");
      await expectNotFound(pageA, memberPath(IDS.anna));
      const { text } = await htmlOf(pageA, memberPath(IDS.anna));
      for (const forbidden of ["Anna", "7305", annaToken]) {
        expect(text, `L'HTML non deve contenere ${forbidden}`).not.toContain(
          forbidden,
        );
      }
      expect(text).not.toMatch(nestBianchi);
    } finally {
      await other.close();
    }
  });

  test("CA-5: figlio, indirizzo non valido e id inesistente danno «Questa pagina non c’è»", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsUsers("A");
    await signIn(page, baseURL, "A");
    for (const path of [
      memberPath(IDS.sofia),
      "/membri/abc",
      memberPath(randomId()),
    ]) {
      await expectNotFound(page, path);
    }
  });
});

// ------------------------------------------------------------- contenuto

test.describe("contenuto", () => {
  test("CA-6: testa della pagina di Laura a 390 px", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsUsers("A");
    const [invite] = await pendingDetails(IDS.laura);
    expect(invite).toBeTruthy();
    await signIn(page, baseURL, "A");
    await openMember(page, IDS.laura, "Laura");
    await expect(page).toHaveTitle(PAGE_TITLE);
    await expect(h1(page)).toHaveCount(1);
    const avatar = page.locator("main .avatar").first();
    await expect(avatar).toHaveText("L");
    await expect(avatar).toHaveClass(/membro-glicine\b/);
    await expect(subtitle(page)).toHaveText(
      `Adulto · invito inviato ${sentText(invite!.created_at)}`,
    );
    await expect(backLink(page)).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Navigazione principale" }),
    ).toBeHidden();
  });

  test("CA-7: contenuto e ordine della pagina di Laura, senza codice né QR", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    const [invite] = await pendingDetails(IDS.laura);
    await signIn(page, baseURL, "A");
    await openMember(page, IDS.laura, "Laura");

    const again = sendAgain(page);
    await expect(again).toBeVisible();
    await expect(again).toContainText(
      `Il link scade ${formatTimeUntil(invite!.expires_at)}`,
    );
    const note = page.getByText(
      "Entrando, Laura vedrà quello che è condiviso con tutto il Nest. Le cose «Solo io» degli altri restano private.",
      { exact: true },
    );
    await expect(note).toBeVisible();
    const role = page.getByRole("heading", { name: "Ruolo", level: 2 });
    await expect(role).toBeVisible();
    await expect(
      page.getByText("Amministratore", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Può invitare, togliere persone e gestire il piano"),
    ).toBeVisible();
    const toggle = roleSwitch(page);
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(toggle).toBeDisabled();
    await expect(toggle).toHaveAccessibleDescription(
      "Potrà diventarlo dopo aver accettato l'invito.",
    );
    const help = page.getByText(
      "Potrà diventarlo dopo aver accettato l'invito.",
      {
        exact: true,
      },
    );
    await expect(help).toBeVisible();
    const remove = removeButton(page, "Laura");
    await expect(remove).toBeVisible();

    // Order from the top of the page.
    const ys: number[] = [];
    for (const locator of [again, note, role, toggle, remove]) {
      ys.push((await locator.boundingBox())!.y);
    }
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(new Set(ys).size).toBe(ys.length);

    // Nothing of the removed code and QR, nothing excluded by the decisions.
    await expect(
      page.getByRole("button", { name: /Mostra il codice/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /Mostra il codice/ }),
    ).toHaveCount(0);
    await expect(page.getByLabel(/Codice QR/i)).toHaveCount(0);
    await expect(page.locator(".qr, .codice-invito")).toHaveCount(0);
    const text = await pageText(page);
    for (const absent of [
      /codice/i,
      /NEST·/,
      /4821/,
      /Cosa vede/,
      /Salute/,
      /veterinario/i,
      /Pediatra/,
    ]) {
      expect(text, `La pagina non deve contenere ${absent}`).not.toMatch(
        absent,
      );
    }
  });

  test("CA-8: a 1280 px ci sono la navigazione principale e «Impostazioni», senza «Indietro»", async ({
    page,
    baseURL,
  }) => {
    test.skip(isMobile(), "Criterio valido solo a 1280 px");
    needsUsers("A");
    await signIn(page, baseURL, "A");
    await openMember(page, IDS.laura, "Laura");
    await expect(
      page.getByRole("navigation", { name: "Navigazione principale" }),
    ).toBeVisible();
    const settings = page.getByRole("navigation", { name: "Impostazioni" });
    await expect(settings).toBeVisible();
    await expect(
      settings.getByRole("link", { name: "Chi c’è" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(backLink(page)).toBeHidden();
    await expect(h1(page)).toHaveCount(1);
  });

  test("CA-9: la pagina di Biscotto ha solo testa e «Togli»", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsUsers("A");
    await signIn(page, baseURL, "A");
    await openMember(page, IDS.biscotto, "Biscotto");
    await expect(subtitle(page)).toHaveText("Animale");
    await expect(removeButton(page, "Biscotto")).toBeVisible();
    const text = await pageText(page);
    for (const absent of [
      /Ruolo/,
      /invito/i,
      /Manda/,
      /codice/i,
      /veterinario/i,
    ]) {
      expect(text, `La pagina non deve contenere ${absent}`).not.toMatch(
        absent,
      );
    }
  });

  test("CA-10: Anna, invito scaduto, vista da B", async ({ page, baseURL }) => {
    onlyMobile();
    needsUsers("B");
    await signIn(page, baseURL, "B");
    await openMember(page, IDS.anna, "Anna");
    await expect(subtitle(page)).toHaveText("Adulto · invito scaduto");
    const send = sendFirst(page);
    await expect(send).toBeVisible();
    await expect(send).toContainText("Il link vale 7 giorni");
    await expect(sendAgain(page)).toHaveCount(0);
    const text = await pageText(page);
    for (const absent of [/codice/i, /NEST·/, /7305/]) {
      expect(text, `La pagina non deve contenere ${absent}`).not.toMatch(
        absent,
      );
    }
  });

  test("CA-11: Paolo, adulto con account, vista da B", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsUsers("B");
    await signIn(page, baseURL, "B");
    await openMember(page, IDS.paolo, "Paolo");
    await expect(subtitle(page)).toHaveText("Adulto");
    await expect(sendFirst(page)).toHaveCount(0);
    await expect(sendAgain(page)).toHaveCount(0);
    await expect(page.getByText(/invito/i)).toHaveCount(0);
    const toggle = roleSwitch(page);
    await expect(toggle).toBeEnabled();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(removeButton(page, "Paolo")).toBeVisible();
  });

  test("CA-12: B2, non amministratore, vede solo nome e tipo", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsUsers("B2");
    const annaToken = (await anyInvites(IDS.anna))[0]!.token;
    await signIn(page, baseURL, "B2");
    for (const [id, name] of [
      [IDS.anna, "Anna"],
      [IDS.giulia, "Giulia"],
    ] as const) {
      await openMember(page, id, name);
      await expect(subtitle(page)).toHaveText("Adulto");
      await expect(page.getByRole("switch")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Manda/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Togli/ })).toHaveCount(0);
      await expect(page.getByText(/invito/i)).toHaveCount(0);
    }
    const { text } = await htmlOf(page, memberPath(IDS.anna));
    expect(text).not.toContain("7305");
    expect(text).not.toContain(annaToken);
  });

  test("CA-13: stato vuoto dell'invito, adulto «da invitare»", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withMemberNest(async ({ user, addAdult }) => {
      const laura = await addAdult("Laura");
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, laura, "Laura");
      await expect(subtitle(page)).toHaveText("Adulto · da invitare");
      await expect(sendFirst(page)).toBeVisible();
      await expect(sendAgain(page)).toHaveCount(0);
      await expect(page.getByRole("button", { name: /invito/i })).toHaveCount(
        1,
      );
    });
  });

  test("CA-14: Fido, animale con data di nascita, mostra l'età e la data solo all'amministratore", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withRita(async ({ user, addPet, u2 }) => {
      const birthDate = yearsAgo(3);
      const fido = await addPet("Fido", "lampone", birthDate);
      expect(formatAge(birthDate)).toBe("3 anni");

      // Not an administrator (Rita): the age text only, never the date.
      await u2.signInContext(page.context(), baseURL as string);
      await openMember(page, fido, "Fido");
      await expect(subtitle(page)).toHaveText("Animale · 3 anni");
      const viewer = await htmlOf(page, memberPath(fido));
      expect(viewer.text).not.toContain(birthDate);

      // Administrator: the date may reach the browser (edit sheet only).
      await page.context().clearCookies();
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, fido, "Fido");
      await expect(subtitle(page)).toHaveText("Animale · 3 anni");
    });
  });
});

// ---------------------------------------------------- manda di nuovo l'invito

test.describe("manda di nuovo l'invito", () => {
  test("CA-16: con la condivisione riuscita manda solo il link e non scrive nulla", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsUsers("A");
    const [before] = await pendingDetails(IDS.laura);
    await stubShare(page);
    await signIn(page, baseURL, "A");
    await openMember(page, IDS.laura, "Laura");
    await sendAgain(page).click();
    await expect.poll(async () => (await shareCalls(page)).length).toBe(1);
    const [call] = await shareCalls(page);
    expect(call).toEqual({ url: inviteLink(page, before!.token) });
    expect(Object.keys(call!)).toEqual(["url"]);
    await expect(toast(page, "Invito mandato di nuovo a Laura.")).toBeVisible();
    const after = await pendingDetails(IDS.laura);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({
      id: before!.id,
      created_at: before!.created_at,
      expires_at: before!.expires_at,
      status: before!.status,
    });
  });

  test("CA-17: se la condivisione è chiusa senza scegliere non compare nulla", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsUsers("A");
    await stubShare(page, "AbortError");
    await signIn(page, baseURL, "A");
    await openMember(page, IDS.laura, "Laura");
    await sendAgain(page).click();
    await expect.poll(async () => (await shareCalls(page)).length).toBe(1);
    await expect(sendAgain(page)).toBeFocused();
    await expect(page.getByTestId("toast")).toHaveCount(0);
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(
      0,
    );
  });

  test("CA-18: senza condivisione copia il link negli appunti", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    const [invite] = await pendingDetails(IDS.laura);
    await removeShare(page);
    await signIn(page, baseURL, "A");
    await openMember(page, IDS.laura, "Laura");
    await sendAgain(page).click();
    await expect(
      toast(page, "Link copiato. Mandalo a Laura dove preferisci."),
    ).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(inviteLink(page, invite!.token));
  });

  test("CA-19: se anche la copia fallisce compare l'errore di copia", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsUsers("A");
    await removeShare(page);
    await breakClipboard(page);
    await signIn(page, baseURL, "A");
    await openMember(page, IDS.laura, "Laura");
    await sendAgain(page).click();
    await expect(
      toast(page, "Non siamo riusciti a copiare il link. Riprova."),
    ).toBeVisible();
    await expect(toast(page, "Link copiato")).toHaveCount(0);
  });
});

// ------------------------------------------------------------ manda l'invito

test.describe("manda l'invito", () => {
  test("CA-20: crea l'invito, lo condivide e passa a «Manda di nuovo»", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await stubShare(page);
    await withMemberNest(async ({ user, adminMemberId, addAdult }) => {
      const laura = await addAdult("Laura");
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, laura, "Laura");
      await sendFirst(page).click();
      await expect(sendAgain(page)).toBeVisible();

      const pending = await pendingDetails(laura);
      expect(pending).toHaveLength(1);
      const invite = pending[0]!;
      expect(invite.invited_by_member_id).toBe(adminMemberId);
      expect(invite.token).toMatch(/^[0-9a-f]{64}$/);
      const expected = Date.now() + 7 * 24 * 60 * 60 * 1000;
      expect(Math.abs(Date.parse(invite.expires_at) - expected)).toBeLessThan(
        5 * 60 * 1000,
      );

      await expect.poll(async () => (await shareCalls(page)).length).toBe(1);
      const [call] = await shareCalls(page);
      expect(call).toEqual({ url: inviteLink(page, invite.token) });
      await expect(toast(page, "Invito mandato a Laura.")).toBeVisible();
      await expect(subtitle(page)).toHaveText(
        `Adulto · invito inviato ${sentText(invite.created_at)}`,
      );
      await expect(sendAgain(page)).toContainText("Il link scade tra 7 giorni");
      const text = await pageText(page);
      expect(text).not.toMatch(/Mostra il codice/);
      expect(text).not.toContain("NEST·");
      expect(text).not.toContain(invite.short_code);
      await expect(sendAgain(page)).toBeFocused();
      const url = new URL(page.url());
      expect(url.pathname).toBe(`/membri/${laura}`);
      expect(url.search).toBe("");
      expect(url.hash).toBe("");
    });
  });

  test("CA-21: l'invito scaduto viene revocato e ne nasce uno nuovo", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await stubShare(page);
    await withMemberNest(async ({ user, addAdult, invite }) => {
      const laura = await addAdult("Laura");
      const old = await invite(laura, "expired");
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, laura, "Laura");
      await expect(subtitle(page)).toHaveText("Adulto · invito scaduto");
      await sendFirst(page).click();
      await expect(sendAgain(page)).toBeVisible();

      const rows = await anyInvites(laura);
      expect(rows.find((r) => r.id === old.id)?.status).toBe("revoked");
      const pending = await pendingDetails(laura);
      expect(pending).toHaveLength(1);
      expect(pending[0]!.id).not.toBe(old.id);
      expect(Date.parse(pending[0]!.expires_at)).toBeGreaterThan(Date.now());
    });
  });

  test("CA-22: se né condivisione né copia riescono l'invito resta pronto", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await stubShare(page, "NotAllowedError");
    await breakClipboard(page);
    await withMemberNest(async ({ user, addAdult }) => {
      const laura = await addAdult("Laura");
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, laura, "Laura");
      await sendFirst(page).click();
      await expect(
        toast(
          page,
          "L'invito per Laura è pronto: tocca «Manda di nuovo l'invito» per mandarlo.",
        ),
      ).toBeVisible();
      await expect(sendAgain(page)).toBeVisible();
      expect(await pendingDetails(laura)).toHaveLength(1);
    });
  });

  test("CA-23: rete interrotta, errore e nessun invito creato", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withMemberNest(async ({ user, addAdult }) => {
      const laura = await addAdult("Laura");
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, laura, "Laura");
      await cutServerActions(page);
      await sendFirst(page).click();
      await expect(
        page.getByRole("alert").filter({
          hasText:
            "Non siamo riusciti a preparare l'invito. Controlla la connessione e riprova.",
        }),
      ).toBeVisible();
      await expect(sendFirst(page)).toBeVisible();
      expect(await anyInvites(laura)).toEqual([]);
    });
  });

  test("CA-24: due tocchi durante l'attesa creano un solo invito", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await stubShare(page);
    await withMemberNest(async ({ user, addAdult }) => {
      const laura = await addAdult("Laura");
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, laura, "Laura");
      await slowServerActions(page, 2000);
      const button = sendFirst(page);
      await button.click();
      await expect(button).toHaveAttribute("aria-busy", "true");
      await button.click({ force: true });
      await expect(sendAgain(page)).toBeVisible({ timeout: 15_000 });
      expect(await anyInvites(laura)).toHaveLength(1);
      expect(await pendingDetails(laura)).toHaveLength(1);
    });
  });
});

// ------------------------------------------------------------------ ruolo

test.describe("ruolo", () => {
  test("CA-25: lo switch dà e toglie il ruolo di amministratore", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withRita(async ({ user, ritaId }) => {
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, ritaId, "Rita");
      const toggle = roleSwitch(page);
      await expect(toggle).toBeEnabled();
      await expect(toggle).toHaveAttribute("aria-checked", "false");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", "true");
      await expect
        .poll(async () => (await memberById(ritaId))?.is_admin)
        .toBe(true);
      await page.reload();
      await expect(h1(page)).toHaveText("Rita");
      await expect(roleSwitch(page)).toHaveAttribute("aria-checked", "true");
      await roleSwitch(page).click();
      await expect(roleSwitch(page)).toHaveAttribute("aria-checked", "false");
      await expect
        .poll(async () => (await memberById(ritaId))?.is_admin)
        .toBe(false);
    });
  });

  test("CA-26: rete interrotta, lo switch torna indietro e compare l'errore", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withRita(async ({ user, ritaId }) => {
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, ritaId, "Rita");
      await cutServerActions(page);
      await roleSwitch(page).click();
      await expect(
        page.getByRole("alert").filter({
          hasText:
            "Non siamo riusciti a cambiare il ruolo. Controlla la connessione e riprova.",
        }),
      ).toBeVisible();
      await expect(roleSwitch(page)).toHaveAttribute("aria-checked", "false");
      expect((await memberById(ritaId))?.is_admin).toBe(false);
    });
  });

  test("CA-27: Rita non amministratrice non vede ruolo né «Togli» e il database la ferma", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withRita(async ({ u2, ritaId, adminMemberId }) => {
      await u2.signInContext(page.context(), baseURL as string);
      await openMember(page, adminMemberId, "Ilaria");
      await expect(subtitle(page)).toHaveText("Adulto");
      await expect(page.getByRole("switch")).toHaveCount(0);
      await expect(removeButton(page, "Ilaria")).toHaveCount(0);

      const { error } = await u2.client
        .from("household_members")
        .update({ is_admin: true })
        .eq("id", ritaId);
      expect(error).not.toBeNull();
      expect((await memberById(ritaId))?.is_admin).toBe(false);
    });
  });
});

// ----------------------------------------------------------- togli dal Nest

test.describe("togli dal Nest", () => {
  test("CA-28: il dialogo di conferma, Annulla ed Esc non cambiano nulla", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    await signIn(page, baseURL, "A");
    await openMember(page, IDS.laura, "Laura");
    const trigger = removeButton(page, "Laura");
    await trigger.click();
    const dialog = page.getByRole("alertdialog", {
      name: "Togliere Laura dal Nest?",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleDescription(
      "Laura non vedrà più la casa. Le cose che ha aggiunto restano; quelle «Solo io» vengono cancellate.",
    );
    await expect(
      dialog.getByRole("button", { name: "Togli Laura", exact: true }),
    ).toBeVisible();
    const cancel = dialog.getByRole("button", { name: "Annulla", exact: true });
    await expect(cancel).toBeVisible();
    await expect(cancel).toBeFocused();

    await cancel.click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    expect(await memberById(IDS.laura)).not.toBeNull();
    expect(await pendingDetails(IDS.laura)).toHaveLength(1);
  });

  test("CA-29: togliere Laura porta a /nest, senza tornare alla sua pagina", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withMemberNest(async ({ user, addAdult, invite }) => {
      const laura = await addAdult("Laura");
      await invite(laura);
      await user.signInContext(page.context(), baseURL as string);
      await page.goto("/nest");
      await nestList(page)
        .getByRole("link", { name: /^Laura/ })
        .click();
      await expect(h1(page)).toHaveText("Laura");
      await removeButton(page, "Laura").click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Togli Laura", exact: true })
        .click();
      await expect(page).toHaveURL(/\/nest$/);
      await expect(nestList(page)).toBeVisible();
      await expect(nestList(page).getByText("Laura")).toHaveCount(0);
      await expect(toast(page, "Laura non è più nel Nest.")).toBeVisible();

      await page.goBack();
      expect(page.url()).not.toContain(`/membri/${laura}`);

      expect(await memberById(laura)).toBeNull();
      expect(await anyInvites(laura)).toEqual([]);
    });
  });

  test("CA-30: le cose «Solo io» di chi esce spariscono, le altre restano senza autore", async ({
    page,
    browser,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withRita(async ({ user, u2, ritaId }) => {
      const stamp = randomId().slice(0, 8);
      const privateTitle = `Solo mia ${stamp}`;
      const sharedTitle = `Di tutti ${stamp}`;
      for (const [title, isPrivate] of [
        [privateTitle, true],
        [sharedTitle, false],
      ] as const) {
        const { error } = await u2.client
          .from("todos")
          .insert({ title, is_private: isPrivate });
        expect(error, `Cosa da fare non creata: ${title}`).toBeNull();
      }

      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, ritaId, "Rita");
      await removeButton(page, "Rita").click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Togli Rita", exact: true })
        .click();
      await expect(page).toHaveURL(/\/nest$/);
      expect(await memberById(ritaId)).toBeNull();

      const admin = adminClient();
      const found = await admin
        .from("todos")
        .select("title, created_by_member_id")
        .in("title", [privateTitle, sharedTitle]);
      expect(found.error).toBeNull();
      expect(found.data).toEqual([
        { title: sharedTitle, created_by_member_id: null },
      ]);

      const context = await browser.newContext({ baseURL });
      try {
        await u2.signInContext(context, baseURL as string);
        const other = await context.newPage();
        await other.goto("/oggi");
        await expect(other).toHaveURL(/\/onboarding/);
      } finally {
        await context.close();
      }
    });
  });

  test("CA-31: togliere un animale, testo del dialogo e rimozione", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withMemberNest(async ({ user, addPet }) => {
      const fido = await addPet("Fido", "lampone");
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, fido, "Fido");
      await removeButton(page, "Fido").click();
      const dialog = page.getByRole("alertdialog", {
        name: "Togliere Fido dal Nest?",
      });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAccessibleDescription(
        "Fido non comparirà più negli impegni e nelle cose da fare. Gli impegni e le cose da fare restano.",
      );
      await dialog
        .getByRole("button", { name: "Togli Fido", exact: true })
        .click();
      await expect(page).toHaveURL(/\/nest$/);
      await expect(nestList(page)).toBeVisible();
      await expect(nestList(page).getByText("Fido")).toHaveCount(0);
      expect(await memberById(fido)).toBeNull();
    });
  });

  test("CA-32: rete interrotta, Laura resta e compare l'errore", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsThrowaway();
    await withMemberNest(async ({ user, addAdult }) => {
      const laura = await addAdult("Laura");
      await user.signInContext(page.context(), baseURL as string);
      await openMember(page, laura, "Laura");
      await cutServerActions(page);
      await removeButton(page, "Laura").click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Togli Laura", exact: true })
        .click();
      await expect(
        page.getByRole("alert").filter({
          hasText:
            "Non siamo riusciti a togliere Laura. Controlla la connessione e riprova.",
        }),
      ).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`/membri/${laura}$`));
      expect(await memberById(laura)).not.toBeNull();
    });
  });
});

// ------------------------------------------------------ sicurezza e privacy

test.describe("sicurezza e privacy", () => {
  test("CA-33: B2 non può cancellare, cambiare ruoli né creare inviti", async ({}) => {
    onlyMobile();
    needsUsers("B2");
    test.skip(
      !secretKey || !supabaseUrl,
      "Chiave amministrativa non impostata",
    );
    const client = createClient(supabaseUrl!, publishableKey!, {
      auth: { persistSession: false },
    });
    const signed = await client.auth.signInWithPassword({
      email: process.env.TEST_USER_B2_EMAIL!,
      password: process.env.TEST_USER_B2_PASSWORD!,
    });
    expect(signed.error).toBeNull();

    const householdId = await householdIdByName(NEST_B);
    const invitesBefore = await inviteCountOfHousehold(householdId);
    const annaBefore = await memberById(IDS.anna);
    const giuliaBefore = await memberById(IDS.giulia);
    expect(annaBefore).not.toBeNull();
    expect(giuliaBefore?.is_admin).toBe(true);

    const removal = await client
      .from("household_members")
      .delete()
      .eq("id", IDS.anna)
      .select("id");
    expect(removal.error !== null || (removal.data ?? []).length === 0).toBe(
      true,
    );
    const role = await client
      .from("household_members")
      .update({ is_admin: false })
      .eq("id", IDS.giulia)
      .select("id");
    expect(role.error !== null || (role.data ?? []).length === 0).toBe(true);
    const invitation = await client
      .from("invitations")
      .insert({ household_id: householdId, member_id: IDS.anna });
    expect(invitation.error).not.toBeNull();

    expect(await memberById(IDS.anna)).toEqual(annaBefore);
    expect((await memberById(IDS.giulia))?.is_admin).toBe(true);
    expect(await inviteCountOfHousehold(householdId)).toBe(invitesBefore);
  });

  test("CA-34: U non cancella Laura e le server action usano il client dell'utente", async ({}) => {
    onlyMobile();
    needsThrowaway();
    const user = await createThrowawayUser("Ilaria De Santis");
    try {
      const { error: createError } = await user.client.rpc("create_household", {
        name: "Casa De Santis",
        household_type: "family_with_children",
        member_name: "Ilaria",
        color: "pomodoro",
      });
      expect(createError).toBeNull();
      const removal = await user.client
        .from("household_members")
        .delete()
        .eq("id", IDS.laura)
        .select("id");
      expect(removal.error !== null || (removal.data ?? []).length === 0).toBe(
        true,
      );
      expect(await memberById(IDS.laura)).not.toBeNull();
    } finally {
      await user.remove();
    }

    // Static check on the server actions of the page.
    const files = actionFiles();
    expect(files.length, "Nessuna server action trovata").toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).toMatch(/@\/lib\/supabase\/server/);
      expect(source).toMatch(/createClient/);
      expect(source).not.toMatch(/SUPABASE_SECRET_KEY/);
      expect(source).not.toMatch(/supabase\/admin|createAdminClient/);
      // No exported action receives a household id from the browser.
      const signatures = [
        ...source.matchAll(/export async function \w+\(([^)]*)\)/g),
      ];
      expect(signatures.length).toBeGreaterThan(0);
      for (const [, params] of signatures) {
        expect(params).not.toMatch(/household/i);
      }
    }
  });

  test("CA-35: nessun dato personale, codice o token nelle risposte né negli indirizzi", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsUsers("A");
    test.skip(
      !secretKey || !supabaseUrl,
      "Chiave amministrativa non impostata",
    );
    const [invite] = await pendingDetails(IDS.laura);
    const admin = adminClient();
    const emailA = process.env.TEST_USER_A_EMAIL!;
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
    const accountId = users?.users.find((u) => u.email === emailA)?.id;
    expect(accountId).toBeTruthy();

    await removeShare(page);
    const requests: string[] = [];
    const bodies: { url: string; text: string }[] = [];
    page.on("request", (request) => requests.push(request.url()));
    page.on("response", (response) => {
      void response
        .text()
        .then((text) => bodies.push({ url: response.url(), text }))
        .catch(() => undefined);
    });
    await signIn(page, baseURL, "A");
    const response = await page.goto(memberPath(IDS.laura));
    await expect(h1(page)).toHaveText("Laura");
    const html = await response!.text();
    for (const forbidden of [
      emailA,
      accountId!,
      "2016-12-14",
      "2020-04-02",
      "4821",
    ]) {
      expect(html, `L'HTML non deve contenere ${forbidden}`).not.toContain(
        forbidden,
      );
    }
    const cache = response!.headers()["cache-control"] ?? "";
    expect(cache).toMatch(/private|no-store/);

    await sendAgain(page).click();
    await expect(
      toast(page, "Link copiato. Mandalo a Laura dove preferisci."),
    ).toBeVisible();

    // The answers of the page that the browser has received.
    for (const { url, text } of bodies.filter(
      (b) => new URL(b.url).origin === new URL(page.url()).origin,
    )) {
      expect(
        text,
        `La risposta ${new URL(url).pathname} contiene 4821`,
      ).not.toContain("4821");
    }
    const allowed = new Set([
      new URL(page.url()).origin,
      new URL(supabaseUrl!).origin,
    ]);
    for (const url of requests.filter((u) => /^https?:/.test(u))) {
      const parsed = new URL(url);
      expect(allowed.has(parsed.origin), `Richiesta a ${parsed.origin}`).toBe(
        true,
      );
      expect(url).not.toContain(invite!.token);
      expect(url).not.toContain("4821");
      expect(url).not.toMatch(/laura/i);
    }
  });
});

// ---------------------------------------------------------------- errore

test.describe("errore", () => {
  test("CA-36: la pagina controlla il Nest prima di leggere e mostra l'errore con «Riprova»", async ({}) => {
    onlyMobile();
    const source = readFileSync(
      join(process.cwd(), "src/app/(app)/membri/[id]/page.tsx"),
      "utf8",
    );
    const guard = source.indexOf("await requireNest()");
    expect(guard).toBeGreaterThan(-1);
    // The only reading in the component is the call to `load`, after the guard
    // (the helper `load`, defined above, does the reads when it is called).
    const firstRead = source.indexOf("await load(");
    expect(firstRead).toBeGreaterThan(guard);
    expect(source).toMatch(/notFound\(\)/);
    expect(source).toMatch(/<MemberError\s*\/>/);
    expect(source).toMatch(/status:\s*"error"/);
    expect(source).not.toMatch(
      /SUPABASE_SECRET_KEY|supabase\/admin|createAdminClient/,
    );
    const error = readFileSync(
      join(process.cwd(), "src/components/membri/MemberError.tsx"),
      "utf8",
    );
    expect(error).toMatch(/PageError/);
    expect(error).toMatch(/router\.refresh\(\)/);
    const pageError = readFileSync(
      join(process.cwd(), "src/components/ui/PageError/PageError.tsx"),
      "utf8",
    );
    expect(pageError).toContain("Riprova");
  });
});

// -------------------------------------------- navigazione e Il tuo Nest

test.describe("navigazione", () => {
  test("CA-39: da /nest alla pagina di Laura e «Indietro» riporta a /nest", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    needsUsers("A");
    await signIn(page, baseURL, "A");
    await page.goto("/nest");
    await nestList(page)
      .getByRole("link", { name: /^Laura/ })
      .click();
    await expect(page).toHaveURL(new RegExp(`/membri/${IDS.laura}$`));
    await expect(h1(page)).toHaveText("Laura");
    await backLink(page).click();
    await expect(page).toHaveURL(/\/nest$/);

    // Opened directly in a new tab: «Indietro» goes to the fallback, /nest.
    const fresh = await page.context().newPage();
    await fresh.goto(memberPath(IDS.laura));
    await expect(h1(fresh)).toHaveText("Laura");
    await backLink(fresh).click();
    await expect(fresh).toHaveURL(/\/nest$/);
  });
});

// ----------------------------------------------------------------- helpers

/** Files with a server action in the folders of the page. */
function actionFiles(): string[] {
  const dirs = [
    join(process.cwd(), "src/app/(app)/membri"),
    join(process.cwd(), "src/components/membri"),
  ];
  const found: string[] = [];
  const walk = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name)) {
        if (/^\s*["']use server["']/m.test(readFileSync(path, "utf8"))) {
          found.push(path);
        }
      }
    }
  };
  dirs.forEach(walk);
  return found;
}
