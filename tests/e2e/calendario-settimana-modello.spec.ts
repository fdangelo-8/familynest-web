import { expect, test } from "@playwright/test";
import {
  eventInfo,
  panelPeople,
  type KeyedFullEvent,
  type Member,
} from "../../src/components/calendario-settimana/model";

// Pure functions: no browser needed.

const giulia: Member = {
  id: "g",
  name: "Giulia",
  color: "pomodoro",
  kind: "adult",
};
const paolo: Member = {
  id: "p",
  name: "Paolo",
  color: "glicine",
  kind: "adult",
};
const members: Member[] = [giulia, paolo];

function privateEvent(memberIds: string[]): KeyedFullEvent {
  return {
    masked: false,
    key: "k",
    id: "e1",
    startsAt: "2026-10-20T08:00:00Z",
    endsAt: "2026-10-20T09:00:00Z",
    visibility: "private",
    authorMemberId: "p",
    title: "Allenamento",
    location: null,
    escortMemberId: null,
    memberIds,
  };
}

test.describe("calendario settimana: «Solo tu»", () => {
  test("solo se sono l'unico partecipante, in riga e nel pannello", () => {
    const mine = privateEvent(["g"]);
    expect(eventInfo(mine, members, "g")).toBe("Solo tu");
    expect(panelPeople(mine, [giulia], members, "g")).toBe("Solo tu");
  });

  test("con altre persone non si scrive «Solo tu»", () => {
    const shared = privateEvent(["g", "p"]);
    expect(eventInfo(shared, members, "g")).not.toBe("Solo tu");
    expect(panelPeople(shared, members, members, "g")).toBe("Tutto il Nest");
    const others = privateEvent(["p"]);
    expect(panelPeople(others, [paolo], members, "g")).toBe("Paolo");
  });
});
