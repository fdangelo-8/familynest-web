import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, test } from "@playwright/test";
import { clearLinkResultOptions } from "../../src/lib/calendar-sync/link-response";
import {
  clearRecoveryCookieOptions,
  recoveryCookieOptions,
} from "../../src/lib/auth/recovery-cookie";
import {
  buildInviteLink,
  clearInviteCookieOptions,
  inviteCookieOptions,
} from "../../src/lib/invitations";
import {
  buildAuthCallbackLink,
  buildWishlistLink,
  originForHost,
} from "../../src/lib/origin";

const SRC = join(__dirname, "..", "..", "src");
const THE_ONE = "lib/request-origin.ts";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

test.describe("indirizzo dell'app: un solo modo", () => {
  test("CA1: solo request-origin.ts legge gli header dell'host", () => {
    const reader =
      /["'`](x-forwarded-host|x-forwarded-proto|host)["'`]|\.get\(\s*["'`]host/i;
    const offenders = sourceFiles(SRC)
      .filter((file) => relative(SRC, file) !== THE_ONE)
      .filter((file) => reader.test(readFileSync(file, "utf8")))
      .map((file) => relative(SRC, file));
    expect(offenders).toEqual([]);
    expect(readFileSync(join(SRC, THE_ONE), "utf8")).toContain("server-only");
  });

  test("https salvo localhost e 127.0.0.1", () => {
    expect(originForHost("app.example.org")).toBe("https://app.example.org");
    expect(originForHost("localhost:3000")).toBe("http://localhost:3000");
    expect(originForHost("127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
    expect(originForHost("localhost.evil.org")).toBe(
      "https://localhost.evil.org",
    );
    expect(originForHost("a.org, b.org")).toBe("https://a.org");
    expect(originForHost(null)).toBe("http://localhost");
    expect(originForHost("bad host/")).toBe("http://localhost");
  });

  for (const origin of [
    "https://app.example.org",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]) {
    test(`CA2: cancellazione dei cookie uguale alla creazione (${origin})`, () => {
      const invite = inviteCookieOptions(origin, null, new Date());
      const clearedInvite = clearInviteCookieOptions(origin);
      expect(clearedInvite).toMatchObject({
        secure: invite?.secure,
        path: invite?.path,
        sameSite: invite?.sameSite,
      });

      const recovery = recoveryCookieOptions(origin);
      expect(clearRecoveryCookieOptions(origin)).toMatchObject({
        secure: recovery.secure,
        path: recovery.path,
        sameSite: recovery.sameSite,
      });

      const result = clearLinkResultOptions(origin);
      expect(result).toMatchObject({
        secure: origin.startsWith("https:"),
        path: "/",
        sameSite: "lax",
      });
      expect(result.expires.getTime()).toBe(0);
    });
  }

  test("CA3: un solo costruttore per tipo di link", () => {
    expect(buildInviteLink("https://a.org/", "tok")).toBe(
      "https://a.org/invito/tok",
    );
    expect(buildWishlistLink("https://a.org/", "abc")).toBe(
      "https://a.org/desideri/abc",
    );
    expect(buildAuthCallbackLink("https://a.org", "password")).toBe(
      "https://a.org/auth/callback?tipo=password",
    );
    const inline = /location\.origin\}?\s*\/?(invito|desideri)/;
    const offenders = sourceFiles(SRC)
      .filter((file) => inline.test(readFileSync(file, "utf8")))
      .map((file) => relative(SRC, file));
    expect(offenders).toEqual([]);
  });
});
