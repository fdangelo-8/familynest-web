import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar/Avatar";
import { Icon } from "@/components/ui/Icon/Icon";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import { formatTime } from "@/lib/datetime";
import { eventHref } from "@/lib/household-events";
import {
  MAX_AVATARS,
  participantsInNestOrder,
  type KeyedFullEvent,
  type Member,
} from "./model";

/**
 * «Impegno»: the chosen event, as a card that opens its detail (week and day,
 * desktop). The two pages write the information line and the note differently,
 * so they pass them in.
 */
export function EventPanel({
  event,
  members,
  info,
  note,
}: {
  event: KeyedFullEvent;
  members: readonly Member[];
  /** `Fino alle 21:30, Monza` */
  info: string;
  /** Who is in it, or who sees it */
  note: string;
}) {
  const people = participantsInNestOrder(event, members);
  return (
    <section className="sezione">
      <div className="sezione__testa">
        <h2 className="sezione__titolo">Impegno</h2>
        <span className="sezione__info">tocca un altro per cambiare</span>
      </div>
      <Link
        href={eventHref(event.id, event.startsAt)}
        className="scheda scheda--evidenza prossimo"
      >
        <span className="prossimo__alto">
          <span className="prossimo__ora">{formatTime(event.startsAt)}</span>
          <span className="prossimo__dati">
            <span className="prossimo__titolo">
              {event.title}
              {event.visibility === "private" ? (
                <>
                  <Icon name="lock" size="s" />
                  <VisuallyHidden>Visibile solo a te</VisuallyHidden>
                </>
              ) : null}
            </span>
            <span className="prossimo__info">{info}</span>
          </span>
        </span>
        <span className="prossimo__nota">
          <span>{note}</span>
          {people.length > 0 && people.length <= MAX_AVATARS ? (
            <span
              className="avatar-gruppo"
              role="img"
              aria-label={people.map((member) => member.name).join(", ")}
            >
              {people.map((member) => (
                <Avatar
                  key={member.id}
                  name={member.name}
                  color={member.color}
                  size="m"
                  nameShown
                />
              ))}
            </span>
          ) : null}
        </span>
      </Link>
    </section>
  );
}
