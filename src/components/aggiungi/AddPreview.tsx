import type { ReactNode } from "react";
import { Avatar } from "../ui/Avatar/Avatar";
import { Skeleton, SkeletonGroup } from "../ui/Skeleton/Skeleton";
import { BUSY_TITLE, formatBusyLabel } from "../../lib/calendar";
import { formatTime } from "../../lib/datetime";
import type { HouseholdEvent } from "../../lib/household-events";
import { dayLabel, joinNames, previewInfo } from "./labels";
import type { ParsedPhrase, PhraseSlot } from "./parse-phrase";
import { previewItems, type NestPerson } from "./preview";

/** What the reading of the events of the day gave (issue #20, specifica §4.2). */
export type DayState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; events: HouseholdEvent[] };

function AvatarsOf({ people }: { people: readonly NestPerson[] }) {
  return (
    <span
      className="avatar-gruppo"
      role="img"
      aria-label={people.map((p) => p.name).join(", ")}
    >
      {people.map((p) => (
        <Avatar key={p.id} name={p.name} color={p.color} nameShown />
      ))}
    </span>
  );
}

/**
 * Desktop side column when the phrase has a title and a time: the new event as
 * a card, then the day with the events the reader may see. The rows are not
 * links: following one would close Add and lose the phrase (proposal 12, #113).
 */
export function AddPreview({
  parsed,
  slot,
  todayKey,
  people,
  participants,
  day,
  notice,
}: {
  parsed: ParsedPhrase;
  slot: PhraseSlot;
  todayKey: string;
  people: readonly NestPerson[];
  participants: readonly NestPerson[];
  day: DayState;
  /** The «chi accompagna?» notice, already built, or nothing */
  notice: ReactNode;
}) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const start = formatTime(slot.startsAt);
  const items =
    day.status === "ready"
      ? previewItems(day.events, slot)
      : [{ type: "new" as const }];

  return (
    <>
      <p className="sottotitolo-gruppo">Anteprima</p>
      <div className="scheda scheda--evidenza prossimo">
        <span className="prossimo__alto">
          <span className="prossimo__ora">{start}</span>
          <span className="prossimo__dati">
            <span className="prossimo__titolo">{parsed.title}</span>
            <span className="prossimo__info">
              {previewInfo(slot, todayKey)}
            </span>
          </span>
        </span>
      </div>
      <p className="sottotitolo-gruppo">{dayLabel(slot.dayKey, todayKey)}</p>
      {day.status === "loading" ? (
        <SkeletonGroup>
          <Skeleton shape="riga" />
          <Skeleton shape="riga" />
        </SkeletonGroup>
      ) : (
        <div className="sezione">
          {items.map((item) => {
            if (item.type === "new") {
              return (
                <div
                  key="new"
                  className="riga-evento riga-evento--compatta riga-evento--attiva"
                >
                  <span className="riga-evento__ora">{start}</span>
                  <span className="riga-evento__testo">
                    <span className="riga-evento__titolo">{parsed.title}</span>
                    <span className="riga-evento__info">Nuovo</span>
                  </span>
                  {participants.length > 0 ? (
                    <AvatarsOf people={participants} />
                  ) : null}
                </div>
              );
            }
            const event = item.event;
            if (event.masked) {
              const author = byId.get(event.authorMemberId);
              return (
                <div
                  key={`busy-${event.authorMemberId}-${event.startsAt}-${event.endsAt}`}
                  className="riga-evento riga-evento--occupato riga-evento--compatta"
                >
                  <span className="riga-evento__ora">
                    {formatTime(event.startsAt)}
                  </span>
                  <span className="riga-evento__testo">
                    <span className="riga-evento__titolo">{BUSY_TITLE}</span>
                    {author ? (
                      <span className="riga-evento__info">
                        {formatBusyLabel(author.name)}
                      </span>
                    ) : null}
                  </span>
                  {author ? <AvatarsOf people={[author]} /> : null}
                </div>
              );
            }
            const who = event.memberIds
              .map((id) => byId.get(id))
              .filter((p): p is NestPerson => p !== undefined);
            return (
              <div
                key={`${event.id}-${event.startsAt}`}
                className="riga-evento riga-evento--compatta"
              >
                <span className="riga-evento__ora">
                  {formatTime(event.startsAt)}
                </span>
                <span className="riga-evento__testo">
                  <span className="riga-evento__titolo">{event.title}</span>
                  <span className="riga-evento__info">
                    {joinNames(who.map((p) => p.name))}
                  </span>
                </span>
                {who.length > 0 ? <AvatarsOf people={who} /> : null}
              </div>
            );
          })}
        </div>
      )}
      {notice}
    </>
  );
}
