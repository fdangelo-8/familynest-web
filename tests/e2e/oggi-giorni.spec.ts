import { isMobileProject } from "../fixtures/casa";
import {
  at,
  d,
  dayRange,
  dayWithNumber,
  ev,
  expect,
  info,
  lastSunday,
  open,
  sec,
  shortDay,
  T,
  test,
  addDays,
} from "../fixtures/oggi";

// Oggi (#30): giornata libera, «Domani» e «Questa settimana» (CA-16 ... CA-19,
// CA-46). The browser clock is stopped on a Tuesday at 15:52 Rome (or on a
// Sunday for the last case), so the days of the week are known.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

test.describe("giornata libera e domani", () => {
  test("CA-16: senza impegni oggi e domani c'è «Oggi» con «Giornata libera, per ora» e il link per aggiungere", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await open(page, baseURL, bianchi, "Paolo");
    const oggi = sec(page, "Oggi");
    await expect(oggi).toBeVisible();
    await expect(oggi).toContainText("Giornata libera, per ora");
    await expect(
      oggi.getByRole("link", { name: "Aggiungi un impegno" }),
    ).toHaveAttribute("href", "/aggiungi");
    await expect(oggi).toContainText("e lo vedi qui.");
    await expect(sec(page, "Prossimo")).toHaveCount(0);
    await expect(sec(page, "Dopo")).toHaveCount(0);
    await expect(sec(page, "Domani")).toHaveCount(0);
  });

  test("CA-17: con un impegno domani e niente oggi su mobile c'è «Domani» al posto di «Oggi»", async ({
    page,
    baseURL,
    casa,
  }) => {
    // At 23:10 the free evening of today (18:00 - 23:00) is over: with two
    // adults in the Nest and an event in the period, earlier in the day there
    // would be a «Liberi insieme» today, and today would not be empty.
    await ev(casa, "Marco", {
      title: "Cena fuori",
      day: d(1),
      from: "20:00",
      to: "22:00",
    });
    await open(page, baseURL, casa, "Marco", { now: at(T, "23:10") });
    const domani = sec(page, "Domani");
    await expect(domani).toBeVisible();
    await expect(info(domani)).toHaveText(dayWithNumber(d(1)));
    await expect(domani).toContainText("Cena fuori");
    await expect(domani).toContainText("20:00");
    await expect(sec(page, "Oggi")).toHaveCount(0);
  });

  test("CA-17: con anche un impegno oggi «Domani» non c'è su mobile e c'è su desktop", async ({
    page,
    baseURL,
    casa,
  }) => {
    await ev(casa, "Marco", {
      title: "Cena fuori",
      day: d(1),
      from: "20:00",
      to: "22:00",
    });
    await ev(casa, "Marco", { title: "Dentista", from: "17:52", to: "18:30" });
    await open(page, baseURL, casa, "Marco");
    await expect(sec(page, "Prossimo")).toContainText("Dentista");
    if (isMobileProject()) {
      await expect(sec(page, "Domani")).toHaveCount(0);
    } else {
      await expect(sec(page, "Domani")).toBeVisible();
      await expect(sec(page, "Domani")).toContainText("Cena fuori");
    }
  });
});

test.describe("questa settimana", () => {
  test("CA-18: «Questa settimana» (solo desktop) mostra la cena di dopodomani con giorno breve e ora, non quella delle 10:00", async ({
    page,
    baseURL,
    casa,
  }) => {
    await ev(casa, "Marco", {
      title: "Cena di Laura",
      day: d(2),
      from: "20:30",
      to: "21:30",
      members: ["Laura"],
    });
    await ev(casa, "Marco", {
      title: "Visita di mattina",
      day: d(2),
      from: "10:00",
      to: "11:00",
      members: ["Laura"],
    });
    await open(page, baseURL, casa, "Marco", { lens: "io" });
    if (isMobileProject()) {
      await expect(sec(page, "Questa settimana")).toHaveCount(0);
      return;
    }
    const week = sec(page, "Questa settimana");
    await expect(week).toBeVisible();
    await expect(info(week)).toHaveText(dayRange(d(1), d(5)));
    const row = week.getByRole("link").filter({ hasText: "Cena di Laura" });
    await expect(row).toBeVisible();
    await expect(row).toContainText(shortDay(d(2)));
    await expect(row).toContainText("20:30");
    await expect(week).not.toContainText("Visita di mattina");
  });

  test("CA-19: senza impegni serali da domani a domenica «Questa settimana» dice «Ancora niente in programma»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await open(page, baseURL, bianchi, "Paolo");
    if (isMobileProject()) {
      await expect(sec(page, "Questa settimana")).toHaveCount(0);
      return;
    }
    const week = sec(page, "Questa settimana");
    await expect(week).toContainText("Ancora niente in programma");
    await expect(week).toContainText(
      "Gli impegni che aggiungi o che arrivano dal calendario compaiono qui.",
    );
  });

  test("CA-46: con 8 impegni serali «Questa settimana» mostra 6 righe e «Altri 2 impegni nel calendario»", async ({
    page,
    baseURL,
    casa,
  }) => {
    // Two on Wednesday, Thursday and Friday, one on Saturday and Sunday: every
    // evening is busy from 18:00 to 23:00, so there is no «Liberi insieme».
    const days = [1, 1, 2, 2, 3, 3, 4, 5];
    for (const [index, offset] of days.entries()) {
      await ev(casa, "Marco", {
        title: `Serata ${index + 1}`,
        day: d(offset),
        from: "18:00",
        to: "23:00",
        members: ["Marco", "Laura"],
      });
    }
    await open(page, baseURL, casa, "Marco", { lens: "nest" });
    if (isMobileProject()) {
      await expect(sec(page, "Questa settimana")).toHaveCount(0);
      return;
    }
    const week = sec(page, "Questa settimana");
    await expect(week).toBeVisible();
    await expect(week.getByRole("listitem")).toHaveCount(7);
    await expect(
      week.locator("a.riga-lista:not(.riga-lista--senza-inizio)"),
    ).toHaveCount(6);
    await expect(week).not.toContainText("Liberi insieme");
    const more = week.getByRole("link", {
      name: /Altri 2 impegni nel calendario/,
    });
    await expect(more).toBeVisible();
    await expect(more).toHaveAttribute("href", "/calendario");
  });

  test("CA-46: la domenica il titolo è «La prossima settimana» e l'intervallo va dal lunedì alla domenica dopo", async ({
    page,
    baseURL,
    casa,
  }) => {
    const sunday = lastSunday();
    await ev(casa, "Marco", {
      title: "Cena del lunedì",
      day: addDays(sunday, 1),
      from: "19:00",
      to: "21:00",
      members: ["Marco", "Laura"],
    });
    await open(page, baseURL, casa, "Marco", {
      lens: "nest",
      now: at(sunday, "15:52"),
    });
    if (isMobileProject()) {
      await expect(sec(page, "Questa settimana")).toHaveCount(0);
      await expect(sec(page, "La prossima settimana")).toHaveCount(0);
      return;
    }
    const week = sec(page, "La prossima settimana");
    await expect(week).toBeVisible();
    await expect(sec(page, "Questa settimana")).toHaveCount(0);
    await expect(info(week)).toHaveText(
      dayRange(addDays(sunday, 1), addDays(sunday, 7)),
    );
    await expect(week).toContainText("Cena del lunedì");
  });
});
