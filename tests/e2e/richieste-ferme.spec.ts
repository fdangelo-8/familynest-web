import type { Page, Request } from "@playwright/test";
import { addDays, romeDay, weekdayIndex } from "../fixtures/casa";
import { createNuoto, expect, test } from "../fixtures/impegni";
import { waitHydrated } from "../fixtures/profilo";

// #330: a page left alone must stay quiet. In production /oggi sent endless
// RSC requests to `calendario?settimana=…`. Each test opens a page, lets it
// settle, then listens for a window of time and checks that nothing repeats:
// no request to an app route (prefetch or refresh), and no read of the
// database more than twice (the declared readings are one at load plus, at
// most, one more after the network or the clock moves). Every test builds its
// own throwaway Nest (Marco is its administrator).

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });
test.describe.configure({ timeout: 150_000 });

const SETTLE_MS = 8000;
const WINDOW_MS = 60_000;
/** Most times the same database read may repeat while the page stays still. */
const MAX_SAME_READ = 2;

type Seen = { url: string; kind: string };

function describeRequest(request: Request): Seen {
  const url = new URL(request.url());
  const headers = request.headers();
  const kind = headers["next-router-prefetch"]
    ? "prefetch"
    : headers["rsc"]
      ? "rsc"
      : request.resourceType();
  const params = new URLSearchParams(url.search);
  params.delete("_rsc");
  const query = params.toString();
  return {
    url: `${request.method()} ${url.host}${url.pathname}${query ? `?${query}` : ""}`,
    kind,
  };
}

/** Listens for `WINDOW_MS` and checks nothing is in a loop. */
async function expectQuiet(page: Page, label: string): Promise<void> {
  await page.waitForTimeout(SETTLE_MS);
  const seen: Seen[] = [];
  const onRequest = (request: Request) => {
    if (request.url().startsWith("data:")) return;
    seen.push(describeRequest(request));
  };
  page.on("request", onRequest);
  await page.waitForTimeout(WINDOW_MS);
  page.off("request", onRequest);

  const counts = new Map<string, number>();
  for (const { url, kind } of seen) {
    const key = `${kind} ${url}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const report = [...counts].map(([key, n]) => `${n} x ${key}`).join("\n");
  console.log(
    `[${label}] ${seen.length} richieste in ${WINDOW_MS} ms\n${report}`,
  );

  // No navigation request of the app at all while nobody navigates.
  const appRequests = seen.filter(
    ({ kind, url }) =>
      (kind === "prefetch" || kind === "rsc" || kind === "document") &&
      !url.includes("supabase"),
  );
  expect(appRequests, `${label}: richieste di pagina ferme\n${report}`).toEqual(
    [],
  );
  const calendar = seen.filter(({ url }) => /\/calendario(\?|$)/.test(url));
  expect(calendar, `${label}: richieste a /calendario\n${report}`).toEqual([]);
  for (const [key, n] of counts) {
    expect(n, `${label}: ${key} ripetuta\n${report}`).toBeLessThanOrEqual(
      MAX_SAME_READ,
    );
  }
}

async function ready(page: Page, path: string): Promise<void> {
  await page.goto(path);
  const h1 = page.getByRole("main").getByRole("heading", { level: 1 });
  await expect(h1).toBeVisible({ timeout: 20_000 });
  await waitHydrated(h1);
}

/** The next Tuesday: the Nuoto repeats on Tuesdays and Thursdays. */
function nextTuesday(): string {
  let day = romeDay();
  while (weekdayIndex(day) !== 2) day = addDays(day, 1);
  return day;
}

async function openAndCloseAdd(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "Aggiungi" });
  const opener = page.getByRole("link", { name: "Aggiungi", exact: true });
  await expect(async () => {
    if (!(await dialog.isVisible())) await opener.first().click();
    await expect(dialog).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
}

test("Oggi fermo: nessuna richiesta ripetuta", async ({
  page,
  baseURL,
  casa,
}) => {
  await createNuoto(casa);
  await casa.signIn(page, baseURL, "Marco");
  await ready(page, "/oggi");
  await expectQuiet(page, "oggi");
});

test("Oggi dopo aver aperto e chiuso Aggiungi: nessuna richiesta ripetuta", async ({
  page,
  baseURL,
  casa,
}) => {
  await casa.signIn(page, baseURL, "Marco");
  await ready(page, "/oggi");
  await openAndCloseAdd(page);
  await expectQuiet(page, "oggi dopo Aggiungi");
});

test("Calendario settimana fermo: nessuna richiesta ripetuta", async ({
  page,
  baseURL,
  casa,
}) => {
  await createNuoto(casa);
  await casa.signIn(page, baseURL, "Marco");
  await ready(page, "/calendario");
  await expectQuiet(page, "calendario");
});

test("Calendario settimana dopo aver aperto e chiuso Aggiungi: nessuna richiesta ripetuta", async ({
  page,
  baseURL,
  casa,
}) => {
  await casa.signIn(page, baseURL, "Marco");
  await ready(page, "/calendario");
  await openAndCloseAdd(page);
  await expectQuiet(page, "calendario dopo Aggiungi");
});

test("Casa ferma: nessuna richiesta ripetuta", async ({
  page,
  baseURL,
  casa,
}) => {
  await casa.signIn(page, baseURL, "Marco");
  await ready(page, "/casa");
  await expectQuiet(page, "casa");
});

test("Dettaglio impegno fermo: nessuna richiesta ripetuta", async ({
  page,
  baseURL,
  casa,
}) => {
  const id = await createNuoto(casa);
  await casa.signIn(page, baseURL, "Marco");
  await ready(page, `/impegni/${id}?giorno=${nextTuesday()}`);
  await expectQuiet(page, "dettaglio impegno");
});
