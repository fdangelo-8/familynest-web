import {
  addDaysToDayKey,
  startOfDay,
  toDateFieldValue,
  toDayKey,
  toTimeFieldValue,
} from "../datetime";
import {
  ProviderAuthError,
  ProviderTemporaryError,
  ProviderUnavailableError,
} from "./types";

/*
 * What the real adapters (Google, Outlook) share (#329): the HTTP calls with
 * their time limit, the retries, the classification of the errors, the reading
 * of the `id_token` and the token requests. No "server-only", no `@/lib/env`:
 * everything comes from outside (`HttpDeps`), so the tests load this file in
 * Node with a simulated `fetch`.
 *
 * Nothing here puts a token, a code, a mail, a name, a title or a body of a
 * response in an error or a log: only the fixed classes of `types.ts` travel.
 */

export type HttpDeps = {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => Date;
};

export type AdapterOptions = HttpDeps & {
  clientId: string;
  clientSecret: string;
};

export const REQUEST_TIMEOUT_MS = 10_000;
export const MAX_RETRY_WAIT_MS = 10_000;
export const MAX_PAGES = 100;
const MAX_RETRIES = 2;
const BACKOFF_MS = [1_000, 2_000] as const;

export type ApiResponse = {
  status: number;
  /** Parsed JSON, or null when the body is empty or not JSON. */
  body: unknown;
  headers: Headers;
};

export type RequestSpec = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  url: string;
  headers?: Record<string, string>;
  /** Already serialised (JSON or form). */
  body?: string;
  contentType?: string;
  /** A request that creates something: retried only after 429 and 503. */
  creates?: boolean;
  /** Statuses given back to the caller instead of being classified. */
  accept?: readonly number[];
};

/** How a request with an access token gets and renews it. */
export type Authorizer = {
  token(): string;
  /** Asks for a new access token (once per request). */
  renew(): Promise<void>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function recordOf(value: unknown): Record<string, unknown> {
  return asRecord(value) ?? {};
}

export function stringOf(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function arrayOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function readBody(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    return text ? (JSON.parse(text) as unknown) : null;
  } catch {
    return null;
  }
}

const QUOTA_REASONS = [
  "rateLimitExceeded",
  "userRateLimitExceeded",
  "quotaExceeded",
  "dailyLimitExceeded",
];
const PERMISSION_REASONS = [
  "insufficientPermissions",
  "ACCESS_TOKEN_SCOPE_INSUFFICIENT",
  "authError",
  "ErrorAccessDenied",
];

// Looks for a known reason anywhere in the (parsed) error body. The body is
// never copied anywhere: it only decides which class of error this is.
function bodyHas(body: unknown, reasons: readonly string[]): boolean {
  if (body === null) return false;
  let text: string;
  try {
    text = JSON.stringify(body);
  } catch {
    return false;
  }
  return reasons.some((reason) => text.includes(`"${reason}"`));
}

function retryDelay(headers: Headers, retryNumber: number): number {
  const raw = headers.get("retry-after");
  if (raw !== null && /^\d{1,6}$/.test(raw.trim())) {
    return Math.min(Number(raw.trim()) * 1000, MAX_RETRY_WAIT_MS);
  }
  return BACKOFF_MS[Math.min(retryNumber, BACKOFF_MS.length - 1)] ?? 1_000;
}

type Verdict = "ok" | "retry" | "auth" | "temporary";

function judge(status: number, body: unknown, creates: boolean): Verdict {
  if (status >= 200 && status < 300) return "ok";
  if (status === 429 || status === 503) return "retry";
  if (status === 403) {
    if (bodyHas(body, PERMISSION_REASONS)) return "auth";
    if (bodyHas(body, QUOTA_REASONS)) return "retry";
    return "temporary";
  }
  if (status === 500 || status === 502 || status === 504) {
    return creates ? "temporary" : "retry";
  }
  return "temporary";
}

/**
 * One request with the rules of the issue: 10 s limit, one renewal of the
 * token after a 401, up to 2 more tries after 429 / 503 / quota / 5xx, one
 * more try after a network failure (never for a creation).
 */
export async function send(
  deps: HttpDeps,
  spec: RequestSpec,
  auth: Authorizer | null,
): Promise<ApiResponse> {
  const creates = spec.creates === true;
  let retries = 0;
  let networkRetried = false;
  let renewed = false;

  for (;;) {
    const headers: Record<string, string> = { ...(spec.headers ?? {}) };
    if (spec.contentType) headers["Content-Type"] = spec.contentType;
    if (auth) headers.Authorization = `Bearer ${auth.token()}`;

    let response: Response;
    try {
      response = await deps.fetch(spec.url, {
        method: spec.method,
        headers,
        body: spec.body,
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      if (creates || networkRetried) throw new ProviderTemporaryError();
      networkRetried = true;
      await deps.sleep(BACKOFF_MS[0]);
      continue;
    }

    const status = response.status;
    const body = await readBody(response);
    const answer: ApiResponse = { status, body, headers: response.headers };

    if (spec.accept?.includes(status)) return answer;
    if (status === 401 && auth) {
      if (renewed) throw new ProviderAuthError();
      renewed = true;
      await auth.renew();
      continue;
    }

    const verdict = judge(status, body, creates);
    if (verdict === "ok") return answer;
    if (verdict === "auth") throw new ProviderAuthError();
    if (verdict === "temporary" || retries >= MAX_RETRIES) {
      throw new ProviderTemporaryError();
    }
    await deps.sleep(retryDelay(response.headers, retries));
    retries += 1;
  }
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export type TokenAnswer = {
  accessToken: string;
  refreshToken: string | null;
  idToken: string | null;
  scope: string;
};

/** POST to the token service; `client_id` and `client_secret` in the form. */
export async function requestToken(
  options: AdapterOptions,
  url: string,
  params: Record<string, string>,
): Promise<TokenAnswer> {
  const form = new URLSearchParams({
    ...params,
    client_id: options.clientId,
    client_secret: options.clientSecret,
  });
  const answer = await send(
    options,
    {
      method: "POST",
      url,
      body: form.toString(),
      contentType: "application/x-www-form-urlencoded",
      headers: { Accept: "application/json" },
      accept: [400, 401],
    },
    null,
  );
  const body = recordOf(answer.body);
  if (answer.status === 400 || answer.status === 401) {
    const code = stringOf(body.error);
    if (
      code === "invalid_grant" ||
      code === "interaction_required" ||
      code === "consent_required"
    ) {
      throw new ProviderAuthError();
    }
    // A configuration problem (expired secret, wrong client): the account is
    // not at fault, so it does not go to «Ricollega».
    if (code === "invalid_client" || code === "unauthorized_client") {
      throw new ProviderUnavailableError();
    }
    throw new ProviderTemporaryError();
  }
  const accessToken = stringOf(body.access_token);
  if (!accessToken) throw new ProviderTemporaryError();
  return {
    accessToken,
    refreshToken: stringOf(body.refresh_token) ?? null,
    idToken: stringOf(body.id_token) ?? null,
    scope: stringOf(body.scope) ?? "",
  };
}

/**
 * Reads the claims of an `id_token`. It comes straight from the token service
 * over TLS, so the signature is not checked (#329 §3): the caller checks the
 * claims it needs.
 */
export function readIdToken(idToken: string | null): Record<string, unknown> {
  if (!idToken) throw new ProviderAuthError();
  const parts = idToken.split(".");
  if (parts.length !== 3 || !parts[1]) throw new ProviderAuthError();
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return recordOf(JSON.parse(json));
  } catch {
    throw new ProviderAuthError();
  }
}

/** Same rules as the database constraint `calendar_accounts_email_format`. */
export function isValidEmail(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 3 &&
    value.length <= 254 &&
    value === value.trim() &&
    !/\s/.test(value) &&
    value.indexOf("@") > 1
  );
}

export function hasAudience(claims: Record<string, unknown>, clientId: string) {
  const aud = claims.aud;
  return Array.isArray(aud) ? aud.includes(clientId) : aud === clientId;
}

export function isNotExpired(
  claims: Record<string, unknown>,
  now: Date,
): boolean {
  return typeof claims.exp === "number" && claims.exp * 1000 > now.getTime();
}

/** The scopes of a token answer, lower case, as a set. */
export function scopeSet(scope: string): Set<string> {
  return new Set(scope.toLowerCase().split(/\s+/).filter(Boolean));
}

/** Encodes a value for a path: ids can hold `/`, `#`, `+`, `@`. */
export function seg(value: string): string {
  return encodeURIComponent(value);
}

// ---------------------------------------------------------------------------
// Cursors, days and repetitions (shared by the two adapters)
// ---------------------------------------------------------------------------

// The longest cursor the database keeps (`external_calendars.sync_cursor`).
const MAX_CURSOR_LENGTH = 8_192;

/** `<prefix>.<day of the full read, Rome>.<token>`; null when too long. */
export function buildCursor(
  prefix: string,
  day: string,
  token: string | null | undefined,
): string | null {
  if (!token) return null;
  const cursor = `${prefix}.${day}.${token}`;
  return cursor.length <= MAX_CURSOR_LENGTH ? cursor : null;
}

/**
 * The token of a cursor of today, or null (no cursor, unknown format, or a
 * cursor of another day: then the window must advance with a full read).
 */
export function readCursor(
  prefix: string,
  cursor: string | null,
  today: string,
): string | null {
  if (!cursor) return null;
  const head = `${prefix}.${today}.`;
  if (!cursor.startsWith(head)) return null;
  const token = cursor.slice(head.length);
  return token.length > 0 ? token : null;
}

/** Wall clock of Rome for an instant: `YYYY-MM-DDTHH:mm:ss`. */
export function romeLocalDateTime(instant: string): string {
  return `${toDateFieldValue(instant)}T${toTimeFieldValue(instant)}:00`;
}

/** Day of the month (Rome) of an instant. */
export function romeDayOfMonth(instant: string): number {
  return Number(toDayKey(instant).slice(8, 10));
}

/** 1 = Monday ... 7 = Sunday, in Rome. */
export function romeIsoWeekday(instant: string): number {
  const day = toDayKey(instant);
  const weekday = new Date(
    Date.UTC(
      Number(day.slice(0, 4)),
      Number(day.slice(5, 7)) - 1,
      Number(day.slice(8, 10)),
    ),
  ).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

/** Weekdays of a weekly series: the chosen ones, or the day of the start. */
export function weeklyDays(
  weekdays: number[] | null,
  startsAt: string,
): number[] {
  const chosen = (weekdays ?? []).filter(
    (d) => Number.isInteger(d) && d >= 1 && d <= 7,
  );
  const days = chosen.length > 0 ? chosen : [romeIsoWeekday(startsAt)];
  return [...new Set(days)].sort((a, b) => a - b);
}

/** Last instant (UTC) of the day `until` in Rome, minus nothing: 23:59:59. */
export function endOfRomeDay(until: string): Date {
  return new Date(startOfDay(addDaysToDayKey(until, 1)).getTime() - 1000);
}

/** The instant as an ISO UTC string, or null when it is not a date. */
export function toUtcIso(value: string | undefined): string | null {
  if (!value) return null;
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const date = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** The UTC day of an instant moved 12 hours forward (all-day events). */
export function dayOfNoon(value: string | undefined): string | null {
  const iso = toUtcIso(value);
  if (!iso) return null;
  return new Date(Date.parse(iso) + 12 * 3_600_000).toISOString().slice(0, 10);
}
