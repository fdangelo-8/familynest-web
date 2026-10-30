import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  signInAs,
  skipReason,
  usersConfigured,
  type TestUserKey,
} from "../fixtures/auth";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";
import {
  NEST_A,
  NEST_B,
  SEED_LAURA_INVITE_ID,
  SEED_LAURA_MEMBER_ID,
  backControl,
  copyButton,
  doneControl,
  expiryNote,
  heading,
  householdIdByName,
  inviteCountOfHousehold,
  inviteUrl,
  invitesOf,
  isMobileProject,
  memberIdByName,
  messages,
  openInvite,
  pendingInviteOf,
  readClipboard,
  removeShare,
  sendButton,
  shareCalls,
  signInThrowaway,
  skipControl,
  stubShare,
  visibleText,
  withInviteNest,
  adminClient,
  PATH,
  control,
} from "../fixtures/invito";

// Onboarding step 4 "Invito" (#14), written from the acceptance criteria
// before the page exists. Valid criteria: "Requisito aggiornato (senza QR)",
// "Specifica grafica aggiornata (senza QR)" and the coordinator decisions of
// 30/10 (no QR, no code "NEST·1234", note "Il link vale 7 giorni." / "Il link
// vale fino a <data>.", copy failure "Non siamo riusciti a copiare il link.
// Riprova."). 27 active CA (CA-11 removed).
//
// A, B2 and C only read. B (Giulia, Anna with an expired invite) is replaced by
// a throwaway administrator with the same data, because opening the page as B
// revokes and recreates the invite and the desktop and mobile runs would race
// on the shared seed. Everything that changes invitations or members uses a
// throwaway user, deleted at the end.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  permissions: ["clipboard-read", "clipboard-write"],
});

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

async function openAs(
  page: import("@playwright/test").Page,
  baseURL: string | undefined,
  key: TestUserKey,
  query = "",
) {
  await signInAs(page.context(), baseURL as string, key);
  return openInvite(page, query);
}

/** Link copied by pressing "Copia il link" (read back from the clipboard). */
async function copiedLink(page: import("@playwright/test").Page) {
  await copyButton(page).click();
  await expect(
    messages(page).filter({ hasText: "Link copiato" }),
  ).toBeVisible();
  return readClipboard(page);
}

// ================================================================ contenuto

test.describe("contenuto", () => {
  test.beforeEach(() => needsUsers("A"));

  test("CA-1: A su mobile vede titolo, barra, nota e i bottoni", async ({
    page,
    baseURL,
  }) => {
    onlyMobile();
    await openAs(page, baseURL, "A");
    const invite = await pendingInviteOf(SEED_LAURA_MEMBER_ID);
    await expect(visibleText(page, "Ultimo passo")).toBeVisible();
    await expect(heading(page)).toHaveCount(1);
    await expect(heading(page)).toHaveText("Invita Laura");
    const bar = page.getByRole("progressbar", { name: "Passo 4 di 4" });
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute("aria-valuenow", "4");
    await expect(bar).toHaveAttribute("aria-valuemax", "4");
    await expect(
      visibleText(page, expiryNote(invite.expires_at)),
    ).toBeVisible();
    await expect(sendButton(page, "Laura")).toBeVisible();
    await expect(copyButton(page)).toBeVisible();
    await expect(skipControl(page)).toBeVisible();
    await expect(backControl(page)).toBeVisible();
    await expect(doneControl(page)).toBeHidden();
  });

  test("CA-2: A su desktop vede un solo h1, la nota, i bottoni e «Indietro»", async ({
    page,
    baseURL,
  }) => {
    onlyDesktop();
    await openAs(page, baseURL, "A");
    const invite = await pendingInviteOf(SEED_LAURA_MEMBER_ID);
    await expect(heading(page)).toHaveCount(1);
    await expect(heading(page)).toHaveText("Invita Laura");
    await expect(
      visibleText(page, expiryNote(invite.expires_at)),
    ).toBeVisible();
    await expect(sendButton(page, "Laura")).toBeVisible();
    await expect(copyButton(page)).toBeVisible();
    await expect(doneControl(page)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Indietro", exact: true }),
    ).toBeVisible();
    await expect(skipControl(page)).toBeHidden();
  });

  test("CA-17: persone non valido (abc, 0, 99) mostra il primo adulto senza errore", async ({
    page,
    baseURL,
  }) => {
    await signInAs(page.context(), baseURL as string, "A");
    for (const value of ["abc", "0", "99"]) {
      await openInvite(page, `?persona=${value}`);
      await expect(heading(page)).toHaveText("Invita Laura");
      await expect(
        visibleText(page, "Questa pagina non si è caricata"),
      ).toHaveCount(0);
      await expect(
        page.getByRole("alert").filter({ hasText: /\S/ }),
      ).toHaveCount(0);
    }
  });

  test("CA-26: niente QR, niente codice, niente «inquadra»", async ({
    page,
    baseURL,
  }) => {
    await openAs(page, baseURL, "A");
    await expect(page.getByRole("img", { name: /Codice QR/i })).toHaveCount(0);
    await expect(page.getByLabel(/Codice QR/i)).toHaveCount(0);
    await expect(page.locator(".qr, svg.qr")).toHaveCount(0);
    const text = await page.locator("body").innerText();
    expect(text).not.toContain("NEST·");
    expect(text).not.toContain("4821");
    expect(text).not.toMatch(/inquadra/i);
  });

  test("CA-27: il link e il token non compaiono nel testo visibile", async ({
    page,
    baseURL,
  }) => {
    await openAs(page, baseURL, "A");
    const invite = await pendingInviteOf(SEED_LAURA_MEMBER_ID);
    const text = await page.locator("body").innerText();
    expect(text).not.toContain(invite.token);
    expect(text).not.toContain("/invito/");
  });
});

// ================================================================ invito

test.describe("invito creato, riusato e scaduto", () => {
  test("CA-3: aprire la pagina due volte riusa lo stesso invito", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    const householdId = await householdIdByName(NEST_A);
    const before = await inviteCountOfHousehold(householdId);
    await signInAs(page.context(), baseURL as string, "A");
    const links: string[] = [];
    for (let i = 0; i < 2; i++) {
      await openInvite(page);
      links.push(await copiedLink(page));
    }
    const seed = (await invitesOf(SEED_LAURA_MEMBER_ID)).find(
      (row) => row.id === SEED_LAURA_INVITE_ID,
    );
    expect(seed?.status).toBe("pending");
    const expected = `${new URL(page.url()).origin}/invito/${seed!.token}`;
    expect(links).toEqual([expected, expected]);
    const pending = (await invitesOf(SEED_LAURA_MEMBER_ID)).filter(
      (row) => row.status === "pending",
    );
    expect(pending.map((row) => row.id)).toEqual([SEED_LAURA_INVITE_ID]);
    expect(await inviteCountOfHousehold(householdId)).toBe(before);
  });

  test("CA-4: senza invito pending ne viene creato uno nuovo", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withInviteNest(async ({ user, addAdult, invite, adminMemberId }) => {
      const laura = await addAdult("Laura", "glicine");
      const old = await invite(laura, "revoked");
      await signInThrowaway(page, baseURL, user);
      await openInvite(page);
      await expect(heading(page)).toHaveText("Invita Laura");
      await expect(visibleText(page, "Il link vale 7 giorni.")).toBeVisible();

      const rows = await invitesOf(laura);
      const pending = rows.filter((row) => row.status === "pending");
      expect(pending).toHaveLength(1);
      const created = pending[0]!;
      expect(created.id).not.toBe(old.id);
      expect(created.invited_by_member_id).toBe(adminMemberId);
      expect(created.message ?? "").toBe("");
      expect(created.token).toMatch(/^[0-9a-f]{64}$/);
      const delta = new Date(created.expires_at).getTime() - Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      expect(Math.abs(delta - sevenDays)).toBeLessThan(5 * 60 * 1000);

      expect(await copiedLink(page)).toBe(inviteUrl(page, created.token));
    });
  });

  test("CA-5: un invito pending scaduto viene revocato e sostituito", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withInviteNest(async ({ user, addAdult, invite }) => {
      const anna = await addAdult("Anna", "salvia");
      const expired = await invite(anna, "expired");
      await signInThrowaway(page, baseURL, user);
      await openInvite(page);
      await expect(heading(page)).toHaveText("Invita Anna");
      await expect(visibleText(page, "Il link vale 7 giorni.")).toBeVisible();

      const rows = await invitesOf(anna);
      expect(rows.find((row) => row.id === expired.id)?.status).toBe("revoked");
      const pending = rows.filter((row) => row.status === "pending");
      expect(pending).toHaveLength(1);
      const delta = new Date(pending[0]!.expires_at).getTime() - Date.now();
      expect(Math.abs(delta - 7 * 24 * 60 * 60 * 1000)).toBeLessThan(
        5 * 60 * 1000,
      );

      const link = await copiedLink(page);
      expect(link).toBe(inviteUrl(page, pending[0]!.token));
      expect(link).not.toContain(expired.token);
    });
  });
});

// ================================================================ azioni

test.describe("copia e condivisione", () => {
  test.beforeEach(() => needsUsers("A"));

  test("CA-6: «Copia il link» copia il link di Laura e mostra il toast", async ({
    page,
    baseURL,
  }) => {
    await openAs(page, baseURL, "A");
    const invite = await pendingInviteOf(SEED_LAURA_MEMBER_ID);
    const before = page.url();
    await copyButton(page).click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Link copiato. Mandalo a Laura dove preferisci." }),
    ).toBeVisible();
    expect(await readClipboard(page)).toBe(inviteUrl(page, invite.token));
    expect(page.url()).toBe(before);
  });

  test("CA-7: «Manda il link a Laura» apre il foglio di condivisione una volta", async ({
    page,
    baseURL,
  }) => {
    await stubShare(page);
    await openAs(page, baseURL, "A");
    const invite = await pendingInviteOf(SEED_LAURA_MEMBER_ID);
    await sendButton(page, "Laura").click();
    await expect.poll(async () => (await shareCalls(page)).length).toBe(1);
    const [call] = await shareCalls(page);
    expect(call!.url).toBe(inviteUrl(page, invite.token));
    // Decision of the coordinator: share only the link, no title, no text.
    expect(Object.keys(call!).sort()).toEqual(["url"]);
    await expect(
      messages(page).filter({ hasText: "Link copiato" }),
    ).toHaveCount(0);
  });

  test("CA-8: se si chiude il foglio (AbortError) non compare nessun messaggio", async ({
    page,
    baseURL,
  }) => {
    await stubShare(page, "AbortError");
    await openAs(page, baseURL, "A");
    const before = page.url();
    await sendButton(page, "Laura").click();
    await expect.poll(async () => (await shareCalls(page)).length).toBe(1);
    await expect(messages(page)).toHaveCount(0);
    await expect(heading(page)).toHaveText("Invita Laura");
    expect(page.url()).toBe(before);
  });

  test("CA-9: senza navigator.share il bottone copia il link", async ({
    page,
    baseURL,
  }) => {
    await removeShare(page);
    await openAs(page, baseURL, "A");
    const invite = await pendingInviteOf(SEED_LAURA_MEMBER_ID);
    await sendButton(page, "Laura").click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Link copiato. Mandalo a Laura dove preferisci." }),
    ).toBeVisible();
    expect(await readClipboard(page)).toBe(inviteUrl(page, invite.token));
  });

  test("CA-10: se la copia fallisce compare l'avviso di errore e non il toast", async ({
    page,
    baseURL,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator.clipboard, "writeText", {
        configurable: true,
        value: () =>
          Promise.reject(new DOMException("denied", "NotAllowedError")),
      });
    });
    await openAs(page, baseURL, "A");
    await copyButton(page).click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Non siamo riusciti a copiare il link. Riprova." }),
    ).toBeVisible();
    await expect(
      messages(page).filter({ hasText: "Link copiato" }),
    ).toHaveCount(0);
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/codice/i);
    expect(text).not.toMatch(/inquadra/i);
  });

  test("CA-12: nessuna richiesta verso terzi e nessun token negli indirizzi", async ({
    page,
    baseURL,
  }) => {
    await stubShare(page);
    const urls: string[] = [];
    page.on("request", (request) => urls.push(request.url()));
    await openAs(page, baseURL, "A");
    const invite = await pendingInviteOf(SEED_LAURA_MEMBER_ID);
    await copyButton(page).click();
    await expect(
      messages(page).filter({ hasText: "Link copiato" }),
    ).toBeVisible();
    await sendButton(page, "Laura").click();
    await expect.poll(async () => (await shareCalls(page)).length).toBe(1);
    const allowed = new Set([
      new URL(page.url()).origin,
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL as string).origin,
    ]);
    const external = urls
      .filter((url) => /^https?:/.test(url))
      .filter((url) => !allowed.has(new URL(url).origin));
    expect(external).toEqual([]);
    expect(urls.filter((url) => url.includes(invite.token))).toEqual([]);
  });
});

// ================================================================ navigazione

test.describe("uscita e passi", () => {
  test("CA-13: «Lo faccio dopo» porta a Pronto e l'invito resta pending", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    onlyMobile();
    await openAs(page, baseURL, "A");
    await skipControl(page).click();
    await expect(page).toHaveURL(/\/onboarding\/pronto$/);
    expect((await pendingInviteOf(SEED_LAURA_MEMBER_ID)).id).toBe(
      SEED_LAURA_INVITE_ID,
    );
  });

  test("CA-14: «Ho finito» porta a Pronto", async ({ page, baseURL }) => {
    needsUsers("A");
    onlyDesktop();
    await openAs(page, baseURL, "A");
    await doneControl(page).click();
    await expect(page).toHaveURL(/\/onboarding\/pronto$/);
  });

  test("CA-15: con due adulti si invitano uno alla volta (Anna, poi Carla)", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    onlyMobile();
    await withInviteNest(async ({ user, addAdult }) => {
      const anna = await addAdult("Anna", "salvia");
      const carla = await addAdult("Carla", "glicine");
      await signInThrowaway(page, baseURL, user);
      await openInvite(page);

      await expect(
        visibleText(page, "Ultimo passo · invito 1 di 2"),
      ).toBeVisible();
      await expect(heading(page)).toHaveText("Invita Anna");
      await expect(control(page, "Ora invita Carla")).toBeVisible();
      await expect(skipControl(page)).toHaveCount(0);
      const annaLink = await copiedLink(page);

      await control(page, "Ora invita Carla").click();
      await expect(page).toHaveURL(/\/onboarding\/invito\?persona=2$/);
      await expect(
        visibleText(page, "Ultimo passo · invito 2 di 2"),
      ).toBeVisible();
      await expect(heading(page)).toHaveText("Invita Carla");
      await expect(
        page.getByRole("progressbar", { name: "Passo 4 di 4" }),
      ).toBeVisible();
      await expect(sendButton(page, "Carla")).toBeVisible();
      await expect(skipControl(page)).toBeVisible();
      const carlaLink = await copiedLink(page);
      expect(carlaLink).not.toBe(annaLink);

      await skipControl(page).click();
      await expect(page).toHaveURL(/\/onboarding\/pronto$/);
      for (const memberId of [anna, carla]) {
        const pending = (await invitesOf(memberId)).filter(
          (row) => row.status === "pending",
        );
        expect(pending).toHaveLength(1);
      }
    });
  });

  test("CA-16: «Indietro» da persona=2 torna ad Anna, poi al passo 2", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    onlyMobile();
    await withInviteNest(async ({ user, addAdult }) => {
      await addAdult("Anna", "salvia");
      await addAdult("Carla", "glicine");
      await signInThrowaway(page, baseURL, user);
      await openInvite(page, "?persona=2");
      await expect(heading(page)).toHaveText("Invita Carla");
      await backControl(page).click();
      await expect(heading(page)).toHaveText("Invita Anna");
      await expect(
        visibleText(page, "Ultimo passo · invito 1 di 2"),
      ).toBeVisible();
      await backControl(page).click();
      await expect(page).toHaveURL(/\/onboarding\/persone$/);
    });
  });
});

// ================================================================ guardie

test.describe("chi può entrare", () => {
  test("CA-18 (stato vuoto): senza adulti da invitare si va a Pronto, nessun invito", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withInviteNest(async ({ user, householdId }) => {
      // "Solo io": the Nest has only the administrator.
      await signInThrowaway(page, baseURL, user);
      await page.goto(PATH);
      await expect(page).toHaveURL(/\/onboarding\/pronto$/);
      expect(await inviteCountOfHousehold(householdId)).toBe(0);
    }, "single");
  });

  test("CA-19: B2 (non amministratore) va a /oggi e gli inviti non cambiano", async ({
    page,
    baseURL,
  }) => {
    needsUsers("B2");
    const householdId = await householdIdByName(NEST_B);
    const before = await inviteCountOfHousehold(householdId);
    await signInAs(page.context(), baseURL as string, "B2");
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/oggi$/);
    expect(await inviteCountOfHousehold(householdId)).toBe(before);
  });

  test("CA-20: senza sessione si va a /accesso", async ({ page }) => {
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/accesso/);
  });

  test("CA-21: C senza Nest va a /onboarding", async ({ page, baseURL }) => {
    needsUsers("C");
    await signInAs(page.context(), baseURL as string, "C");
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/onboarding$/);
  });
});

// ================================================================ isolamento

test.describe("isolamento tra nuclei", () => {
  test("CA-22: un amministratore con Anna vede solo i propri dati, mai quelli di Casa D'Angelo", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    needsThrowaway();
    const laura = await pendingInviteOf(SEED_LAURA_MEMBER_ID);
    await withInviteNest(async ({ user, addAdult, invite }) => {
      const anna = await addAdult("Anna", "salvia");
      await addAdult("Carla", "glicine");
      await invite(anna, "expired");
      await signInThrowaway(page, baseURL, user);
      for (const query of ["", "?persona=2"]) {
        await openInvite(page, query);
        const text = await page.locator("body").innerText();
        expect(text).not.toContain("Laura");
        expect(text).not.toContain(NEST_A);
        expect(text).not.toContain("4821");
      }
      await openInvite(page);
      const link = await copiedLink(page);
      const mine = (await invitesOf(anna)).find((r) => r.status === "pending");
      expect(link).toBe(inviteUrl(page, mine!.token));
      expect(link).not.toContain(laura.token);
    });
  });

  test("CA-22: A non vede mai Anna né Casa Bianchi, né i loro token", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    await openAs(page, baseURL, "A");
    const text = await page.locator("body").innerText();
    expect(text).not.toContain("Anna");
    expect(text).not.toContain(NEST_B);
    const link = await copiedLink(page);
    const householdB = await householdIdByName(NEST_B);
    const { data } = await adminClient()
      .from("invitations")
      .select("token")
      .eq("household_id", householdB);
    for (const row of data ?? []) {
      expect(link).not.toContain(row.token as string);
    }
    // And the link is Laura's, not somebody else's.
    const laura = await pendingInviteOf(SEED_LAURA_MEMBER_ID);
    expect(link).toBe(inviteUrl(page, laura.token));
    expect(await memberIdByName(await householdIdByName(NEST_A), "Laura")).toBe(
      SEED_LAURA_MEMBER_ID,
    );
  });
});

// ================================================================ errori

test.describe("errori", () => {
  // Server-side failures cannot be provoked from the browser (the page reads
  // on the server). As the criteria allow, they are checked statically on the
  // source of the page, and in local runs with Supabase stopped after sign-in.
  function pageSource(): string {
    const files = [
      "src/app/onboarding/invito/page.tsx",
      "src/components/onboarding/InviteStep.tsx",
    ].map((file) => join(process.cwd(), file));
    for (const file of files) {
      expect(existsSync(file), `${file} deve esistere`).toBe(true);
    }
    return files.map((file) => readFileSync(file, "utf8")).join("\n");
  }

  test("CA-23: se l'invito non si prepara il codice rende l'avviso con «Riprova»", () => {
    const source = pageSource();
    expect(source).toContain("Non riusciamo a preparare l'invito per");
    expect(source).toContain("Controlla la connessione e riprova.");
    expect(source).toContain(
      "per un problema nostro. Riprova tra qualche minuto.",
    );
    expect(source).toMatch(/role=["']alert["']|<Alert|avviso--errore/);
    expect(source).toContain("Riprova");
  });

  test("CA-28: se la pagina non si carica il codice rende OnboardingError", () => {
    const source = pageSource();
    expect(source).toContain("OnboardingError");
  });
});

// ================================================================ cache

test("CA-24: la risposta non è in cache condivisa e l'indirizzo non ha token", async ({
  page,
  baseURL,
}) => {
  needsUsers("A");
  const response = await openAs(page, baseURL, "A");
  const cache = response?.headers()["cache-control"] ?? "";
  expect(cache).toMatch(/private|no-store/);
  const invite = await pendingInviteOf(SEED_LAURA_MEMBER_ID);
  expect(page.url()).not.toContain(invite.token);
  expect(page.url()).not.toContain("4821");
});

// CA-25 (id duplicati e axe) is in tests/a11y/onboarding-invito.spec.ts.
