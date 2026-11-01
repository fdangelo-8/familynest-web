/**
 * Italian national holidays (issue #27), calculated in the app: no service, no
 * personal data. Days are Rome day keys (`YYYY-MM-DD`), so nothing depends on
 * the time zone of the browser.
 */

/** From this year on, 4 October (San Francesco) is a national holiday again. */
const SAN_FRANCESCO_FROM_YEAR = 2026;

const FIXED_HOLIDAYS: ReadonlyArray<{
  month: number;
  day: number;
  name: string;
  fromYear?: number;
}> = [
  { month: 1, day: 1, name: "Capodanno" },
  { month: 1, day: 6, name: "Epifania" },
  { month: 4, day: 25, name: "Festa della Liberazione" },
  { month: 5, day: 1, name: "Festa del Lavoro" },
  { month: 6, day: 2, name: "Festa della Repubblica" },
  { month: 8, day: 15, name: "Ferragosto" },
  {
    month: 10,
    day: 4,
    name: "San Francesco",
    fromYear: SAN_FRANCESCO_FROM_YEAR,
  },
  { month: 11, day: 1, name: "Ognissanti" },
  { month: 12, day: 8, name: "Immacolata" },
  { month: 12, day: 25, name: "Natale" },
  { month: 12, day: 26, name: "Santo Stefano" },
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Easter Sunday of a year in the Gregorian calendar (Meeus/Jones/Butcher). */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

const cache = new Map<number, ReadonlyMap<string, string>>();

/** Holidays of a year, by day key. */
function holidaysOfYear(year: number): ReadonlyMap<string, string> {
  const cached = cache.get(year);
  if (cached) return cached;
  const map = new Map<string, string>();
  for (const holiday of FIXED_HOLIDAYS) {
    if (holiday.fromYear !== undefined && year < holiday.fromYear) continue;
    map.set(`${year}-${pad(holiday.month)}-${pad(holiday.day)}`, holiday.name);
  }
  const easter = easterSunday(year);
  const sunday = Date.UTC(year, easter.month - 1, easter.day);
  const monday = new Date(sunday + 86_400_000);
  map.set(`${year}-${pad(easter.month)}-${pad(easter.day)}`, "Pasqua");
  map.set(
    `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())}`,
    "Pasquetta",
  );
  cache.set(year, map);
  return map;
}

/** Name of the national holiday on a Rome day (`YYYY-MM-DD`), or `null`. */
export function holidayName(dayKey: string): string | null {
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(dayKey);
  if (!match) return null;
  return holidaysOfYear(Number(match[1])).get(dayKey) ?? null;
}
