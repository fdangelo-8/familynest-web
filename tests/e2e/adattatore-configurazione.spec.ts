import { expect, test } from "@playwright/test";
import { isProviderConfigured } from "../../src/lib/calendar-sync/providers";

/*
 * CA-33: when a provider counts as configured (#329). Node only. The test
 * sets the variables it needs and puts the old values back at the end.
 */

test.describe.configure({ mode: "serial" });

const NAMES = [
  "CALENDAR_FAKE_PROVIDER",
  "VERCEL",
  "VERCEL_ENV",
  "GOOGLE_CALENDAR_CLIENT_ID",
  "GOOGLE_CALENDAR_CLIENT_SECRET",
  "MICROSOFT_CALENDAR_CLIENT_ID",
  "MICROSOFT_CALENDAR_CLIENT_SECRET",
  "CALENDAR_ENCRYPTION_KEY",
  "CALENDAR_ENCRYPTION_KEY_VERSION",
] as const;

const saved = new Map<string, string | undefined>();

test.beforeEach(() => {
  for (const name of NAMES) {
    saved.set(name, process.env[name]);
    delete process.env[name];
  }
});

test.afterEach(() => {
  for (const name of NAMES) {
    const value = saved.get(name);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

function setGoogle() {
  process.env.GOOGLE_CALENDAR_CLIENT_ID = "id";
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "secret";
}

test("CA-33: Google senza il segreto non è configurato", () => {
  process.env.GOOGLE_CALENDAR_CLIENT_ID = "id";
  process.env.CALENDAR_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
  expect(isProviderConfigured("google")).toBe(false);
});

test("CA-33: senza la chiave di cifratura non è configurato", () => {
  setGoogle();
  expect(isProviderConfigured("google")).toBe(false);
});

test("CA-33: con una chiave di 16 byte non è configurato", () => {
  setGoogle();
  process.env.CALENDAR_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString("base64");
  expect(isProviderConfigured("google")).toBe(false);
});

test("CA-33: con tutto presente è configurato, solo il proprio fornitore", () => {
  setGoogle();
  process.env.CALENDAR_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
  expect(isProviderConfigured("google")).toBe(true);
  expect(isProviderConfigured("outlook")).toBe(false);
});

test("CA-33: il fornitore finto acceso basta", () => {
  process.env.CALENDAR_FAKE_PROVIDER = "1";
  expect(isProviderConfigured("outlook")).toBe(true);
});
