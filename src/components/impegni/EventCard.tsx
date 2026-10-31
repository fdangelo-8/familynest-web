"use client";

import { useId } from "react";
import { Avatar } from "@/components/ui/Avatar/Avatar";
import { Tag } from "@/components/ui/Tag/Tag";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import { VISIBILITY_LABELS } from "@/lib/calendar";
import { toDayKey, type Instant } from "@/lib/datetime";
import type { EventOccurrence } from "@/lib/household-events";
import {
  formatDayHeading,
  peopleBadge,
  peopleTexts,
  repeatRowText,
  timeTexts,
  type EventMember,
} from "./model";

/**
 * The card of the detail: the same as the «Prossimo» of Oggi (black thread on
 * top, big hours), not a link. Everything it shows comes from the occurrence
 * read in the browser.
 */
export function EventCard({
  occurrence,
  members,
  meId,
  now,
}: {
  occurrence: EventOccurrence;
  members: ReadonlyArray<EventMember>;
  meId: string;
  now: Instant;
}) {
  const titleId = useId();
  const time = timeTexts(occurrence.startsAt, occurrence.endsAt);
  const people = peopleTexts(occurrence, members, meId);
  const badge = peopleBadge(people.people, members);
  const repeat = repeatRowText(occurrence, now);
  const escort = occurrence.escortMemberId
    ? members.find((member) => member.id === occurrence.escortMemberId)
    : undefined;

  return (
    <article
      className="scheda scheda--evidenza prossimo"
      aria-labelledby={titleId}
    >
      <p className="intestazione__sopra">
        {formatDayHeading(toDayKey(occurrence.startsAt), now)}
      </p>
      <span className="prossimo__ora">
        <span aria-hidden="true">
          {time.range}
          {time.endNote ? (
            <span className="prossimo__ora-fine">{time.endNote}</span>
          ) : null}
        </span>
        <VisuallyHidden>{time.spoken}</VisuallyHidden>
      </span>
      <h1 className="prossimo__titolo" id={titleId} tabIndex={-1}>
        {occurrence.title}
      </h1>

      <div className="riga-lista riga-lista--senza-inizio">
        <span className="riga-lista__testo">
          <span className="riga-lista__titolo">{people.title}</span>
          {people.info ? (
            <span className="riga-lista__info">{people.info}</span>
          ) : null}
        </span>
        {badge.kind === "avatars" && badge.people.length === 1 ? (
          <Avatar
            name={badge.people[0]!.name}
            color={badge.people[0]!.color}
            size="l"
            nameShown
          />
        ) : null}
        {badge.kind === "avatars" && badge.people.length > 1 ? (
          <span className="avatar-gruppo avatar-gruppo--grande">
            {badge.people.map((member) => (
              <Avatar
                key={member.id}
                name={member.name}
                color={member.color}
                size="l"
                nameShown
              />
            ))}
          </span>
        ) : null}
        {badge.kind === "label" ? <Tag>{badge.text}</Tag> : null}
        {badge.kind === "none" ? (
          <Avatar name="" color="insieme" size="l" empty nameShown />
        ) : null}
      </div>

      <dl className="tabella-dati">
        {occurrence.location ? (
          <>
            <dt>Dove</dt>
            <dd>{occurrence.location}</dd>
          </>
        ) : null}
        {repeat ? (
          <>
            <dt>Ripete</dt>
            <dd>{repeat}</dd>
          </>
        ) : null}
        {escort ? (
          <>
            <dt>La porta</dt>
            <dd>
              <Avatar name={escort.name} color={escort.color} nameShown />
              {escort.id === meId ? "Tu" : escort.name}
            </dd>
          </>
        ) : null}
        <dt>Chi lo vede</dt>
        <dd>{VISIBILITY_LABELS[occurrence.visibility]}</dd>
        {occurrence.notes ? (
          <>
            <dt>Note</dt>
            <dd className="tabella-dati__nota">{occurrence.notes}</dd>
          </>
        ) : null}
      </dl>
    </article>
  );
}
