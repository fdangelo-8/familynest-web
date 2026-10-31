import { expect, test } from "@playwright/test";
import type { HouseholdEvent } from "../../src/lib/household-events";
import {
  escortNotice,
  type NestPerson,
} from "../../src/components/aggiungi/preview";
import type { PhraseSlot } from "../../src/components/aggiungi/parse-phrase";

// «Chi accompagna?» notice (#20, §7.2): pure function, no browser.

const person = (
  id: string,
  name: string,
  kind: NestPerson["kind"],
): NestPerson => ({ id, name, color: "pomodoro", kind, userId: null });

const MEMBERS = [
  person("marco", "Marco", "adult"),
  person("laura", "Laura", "adult"),
  person("sofia", "Sofia", "child"),
  person("tommaso", "Tommaso", "child"),
];

const slot: PhraseSlot = {
  dayKey: "2026-10-22",
  endDayKey: "2026-10-22",
  startsAt: new Date("2026-10-22T15:00:00Z"),
  endsAt: new Date("2026-10-22T16:00:00Z"),
};

function full(
  overrides: Partial<Extract<HouseholdEvent, { masked: false }>>,
): HouseholdEvent {
  return {
    masked: false,
    id: "e1",
    startsAt: "2026-10-22T14:30:00Z",
    endsAt: "2026-10-22T15:15:00Z",
    visibility: "household",
    authorMemberId: "marco",
    title: "Qualcosa",
    location: null,
    escortMemberId: null,
    memberIds: [],
    ...overrides,
  };
}

function notice(events: HouseholdEvent[], participants: string[]) {
  return escortNotice({
    events,
    members: MEMBERS,
    meId: "marco",
    participantIds: participants,
    slot,
  });
}

test.describe("Aggiungi · avviso «chi accompagna?»", () => {
  test("un adulto che partecipa a un impegno sovrapposto", () => {
    expect(notice([full({ memberIds: ["laura"] })], ["sofia"])).toBe(
      "Laura ha un impegno fino alle 17:15: chi accompagna Sofia?",
    );
  });

  test("l'autore di un «Occupato» visto per intero è occupato (Nuoto Sofia, poi Inglese Tommaso)", () => {
    const nuoto = full({
      visibility: "busy",
      authorMemberId: "marco",
      memberIds: ["sofia"],
    });
    expect(notice([nuoto], ["tommaso"])).toBe(
      "Hai un impegno fino alle 17:15: chi accompagna Tommaso?",
    );
  });

  test("l'autore di un «Tutto il Nest» che non partecipa non è occupato", () => {
    expect(
      notice(
        [full({ authorMemberId: "laura", memberIds: ["sofia"] })],
        ["tommaso"],
      ),
    ).toBeNull();
  });

  test("l'«Occupato» mascherato di un altro conta", () => {
    const masked: HouseholdEvent = {
      masked: true,
      startsAt: "2026-10-22T14:00:00Z",
      endsAt: "2026-10-22T15:30:00Z",
      visibility: "busy",
      authorMemberId: "laura",
    };
    expect(notice([masked], ["sofia", "tommaso"])).toBe(
      "Laura ha un impegno fino alle 17:30: chi accompagna Sofia e Tommaso?",
    );
  });

  test("senza figli o senza sovrapposizione l'avviso non c'è", () => {
    const busy = full({ memberIds: ["laura"] });
    expect(notice([busy], ["marco"])).toBeNull();
    expect(
      notice(
        [
          full({
            memberIds: ["laura"],
            startsAt: "2026-10-22T17:00:00Z",
            endsAt: "2026-10-22T18:00:00Z",
          }),
        ],
        ["sofia"],
      ),
    ).toBeNull();
  });
});
