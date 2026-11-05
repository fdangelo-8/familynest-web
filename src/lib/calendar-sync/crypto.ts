import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { getCalendarEncryptionKey } from "@/lib/env";

/*
 * Credentials of the external accounts (#34 §9): AES-256-GCM with a key that
 * exists only in the environment of the server. The database stores only the
 * result, in the format the column accepts: `v<key version>:<ciphertext>`,
 * where the ciphertext is base64url of `iv (12) + tag (16) + encrypted bytes`.
 * The version is also part of the authenticated data, so a ciphertext cannot
 * be passed off as one of another key version.
 *
 * Nothing here logs or puts a value in an error message.
 */

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const FORMAT = /^v([0-9]{1,3}):([A-Za-z0-9_-]+)$/;

export class CredentialsError extends Error {
  constructor() {
    // A fixed message: never the value, never the reason.
    super("Credentials could not be processed.");
    this.name = "CredentialsError";
  }
}

function additionalData(version: number): Buffer {
  return Buffer.from(`familynest:calendar-credentials:v${version}`, "utf8");
}

/** Encrypts a credential (a refresh token) with the current key. */
export function encryptCredentials(plain: string): string {
  if (plain.length === 0) throw new CredentialsError();
  const { version, key } = getCalendarEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv, {
    authTagLength: TAG_LENGTH,
  });
  cipher.setAAD(additionalData(version));
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const body = Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
  return `v${version}:${body.toString("base64url")}`;
}

/** Decrypts what `encryptCredentials` wrote (with the key of its version). */
export function decryptCredentials(stored: string): string {
  const match = FORMAT.exec(stored);
  if (!match || !match[1] || !match[2]) throw new CredentialsError();
  try {
    const version = Number(match[1]);
    const { key } = getCalendarEncryptionKey(version);
    const body = Buffer.from(match[2], "base64url");
    if (body.length <= IV_LENGTH + TAG_LENGTH) throw new CredentialsError();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      body.subarray(0, IV_LENGTH),
      { authTagLength: TAG_LENGTH },
    );
    decipher.setAAD(additionalData(version));
    decipher.setAuthTag(body.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH));
    return Buffer.concat([
      decipher.update(body.subarray(IV_LENGTH + TAG_LENGTH)),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new CredentialsError();
  }
}

/**
 * Compares two secrets in constant time: both are hashed first, so the length
 * of the secret does not show in the time either.
 */
export function secretsMatch(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}
