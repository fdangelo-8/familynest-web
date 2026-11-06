import { expect } from "@playwright/test";
import type { AdapterOptions } from "../../src/lib/calendar-sync/http";

/*
 * A simulated `fetch` for the unit tests of the calendar adapters (#329). It
 * answers only the requests prepared by the test, in order; any other address
 * is recorded in `unexpected` and answered with a network failure, and
 * `done()` makes the test fail: no real call ever leaves the process.
 */

export type Reply = {
  status?: number;
  json?: unknown;
  headers?: Record<string, string>;
  /** The connection drops. */
  networkError?: boolean;
};

export type Call = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
};

type Route = {
  method: string;
  match: string | RegExp;
  replies: Reply[];
};

export const NOW = new Date("2026-11-06T10:00:00Z");
export const CLIENT_ID = "test-client-id";
export const CLIENT_SECRET = "test-client-secret";

const created: { unexpected: string[] }[] = [];

/**
 * Registered in every spec with `test.afterEach(assertNoUnexpectedRequests)`:
 * fails the test if any mock created in it received an unprepared request,
 * even when the test never called `done()` and the adapter swallowed the error.
 */
export function assertNoUnexpectedRequests() {
  const found = created.flatMap((m) => m.unexpected);
  created.length = 0;
  expect(found).toEqual([]);
}

export function createMock() {
  const routes: Route[] = [];
  const calls: Call[] = [];
  const unexpected: string[] = [];
  const sleeps: number[] = [];
  created.push({ unexpected });

  const fetchMock = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key] = value;
    });
    calls.push({
      method,
      url,
      headers,
      body: typeof init?.body === "string" ? init.body : null,
    });
    const route = routes.find(
      (r) =>
        r.method === method &&
        (typeof r.match === "string" ? r.match === url : r.match.test(url)),
    );
    const reply = route?.replies.length ? route.replies.shift() : undefined;
    if (!reply) {
      unexpected.push(`${method} ${url}`);
      throw new Error("Unexpected request");
    }
    if (reply.networkError) throw new Error("connection dropped");
    return new Response(
      reply.json === undefined ? null : JSON.stringify(reply.json),
      { status: reply.status ?? 200, headers: reply.headers },
    );
  }) as typeof fetch;

  return {
    calls,
    unexpected,
    sleeps,
    /** Prepares the answers (in order) for a method and an address. */
    on(method: string, match: string | RegExp, ...replies: Reply[]) {
      routes.push({ method, match, replies });
    },
    options(): AdapterOptions {
      return {
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        fetch: fetchMock,
        sleep: async (ms: number) => {
          sleeps.push(ms);
        },
        now: () => NOW,
      };
    },
    /** Fails the test if something outside the prepared list was asked. */
    done() {
      expect(unexpected).toEqual([]);
    },
  };
}

function b64(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

/** An unsigned `id_token` (the adapters read the claims only). */
export function idToken(claims: Record<string, unknown>): string {
  return `${b64({ alg: "none" })}.${b64(claims)}.x`;
}
