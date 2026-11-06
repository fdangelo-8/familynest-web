import { createDecipheriv } from "node:crypto";
import {
  OUTLOOK,
  alerts,
  expect,
  linkAs,
  needsFake,
  openCalendars,
  test,
  withLinker,
} from "../fixtures/calendari-collegati";

// Adattatori veri (#329), la parte che si prova con il fornitore finto:
// «non configurato» (CA-34, CA-35), token rinnovato salvato (CA-8) e i diritti
// della funzione del database (CA-36).

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });
test.describe.configure({ timeout: 90_000 });

// The same format as `encryptCredentials`: `v<version>:` + base64url of
// iv (12) + tag (16) + encrypted bytes, with the version as authenticated data.
function decrypt(stored: string): string {
  const match = /^v(\d{1,3}):([A-Za-z0-9_-]+)$/.exec(stored);
  if (!match) throw new Error("Formato del token cifrato inatteso");
  const body = Buffer.from(match[2] as string, "base64url");
  const key = Buffer.from(process.env.CALENDAR_ENCRYPTION_KEY ?? "", "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, body.subarray(0, 12), {
    authTagLength: 16,
  });
  decipher.setAAD(
    Buffer.from(`familynest:calendar-credentials:v${match[1]}`, "utf8"),
  );
  decipher.setAuthTag(body.subarray(12, 28));
  return Buffer.concat([
    decipher.update(body.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}

test.describe("adattatori · non configurato e token rinnovato", () => {
  test("CA-34, CA-35: «non configurato» sulla pagina, senza «Riprova» e senza righe nuove", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await u.signIn(page);
      await page.context().addCookies([
        {
          name: "fn-calendar-link",
          value: "google.not_configured",
          url: baseURL as string,
          httpOnly: true,
        },
      ]);
      await openCalendars(page);
      const alert = alerts(page).first();
      await expect(alert).toHaveText(
        "Per ora non è possibile collegare Google o Outlook: il servizio non è ancora attivo su FamilyNest. Intanto puoi aggiungere gli impegni a mano.",
      );
      await expect(alert).not.toContainText("connessione");
      await expect(alert.getByRole("button")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Collega Google", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Collega Outlook", exact: true }),
      ).toBeVisible();
      expect(await u.accounts()).toHaveLength(0);
    });
  });

  test("CA-8, CA-36: il token rinnovato si salva cifrato e solo il server può farlo", async ({
    page,
    baseURL,
  }) => {
    needsFake();
    await withLinker(baseURL, async (u) => {
      await linkAs(u, page, OUTLOOK);
      await expect.poll(async () => (await u.accounts()).length).toBe(1);
      const before = (await u.accounts())[0];
      if (!before) throw new Error("Account di prova assente");

      await u.fake.fail({
        userId: u.user.id,
        provider: "outlook",
        email: OUTLOOK.email,
        rotateTokens: true,
      });
      await u.fake.sync(u.user.id);

      await expect
        .poll(async () => (await u.accounts())[0]?.credentials_ciphertext)
        .not.toBe(before.credentials_ciphertext);
      const after = (await u.accounts())[0];
      const issued = await u.tokens();
      expect(decrypt(after?.credentials_ciphertext ?? "")).toBe(
        issued[issued.length - 1],
      );
      expect(after?.status).toBe("active");

      // With the session of the adult (not the server) the function is closed.
      const denied = await u.user.client.rpc(
        "update_calendar_account_credentials",
        {
          p_account_id: before.id,
          p_previous_ciphertext: after?.credentials_ciphertext ?? "",
          p_credentials_ciphertext: before.credentials_ciphertext,
        },
      );
      expect(denied.error?.code).toBe("42501");
      expect((await u.accounts())[0]?.credentials_ciphertext).toBe(
        after?.credentials_ciphertext,
      );
    });
  });
});
