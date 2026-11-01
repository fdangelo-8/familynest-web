import type { ReactNode } from "react";
import { Avatar, type MemberColor } from "../ui/Avatar/Avatar";
import { Chip, ChipGroup } from "../ui/Chip/Chip";
import { cx } from "../ui/cx";
import { Icon } from "../ui/Icon/Icon";
import { Tag } from "../ui/Tag/Tag";
import { VisuallyHidden } from "../ui/VisuallyHidden/VisuallyHidden";
import type { HowMuch } from "../../lib/datetime";
import { REMINDERS } from "./texts";

/** The parts under the type selector for Spesa, Da fare and Scadenza (issue #22). */

export type ShoppingRow = {
  name: string;
  quantity: string | null;
  /** Already in «Da prendere»: it is not saved again */
  inList: boolean;
};

/** The things of the phrase, in order. The circles are only a drawing. */
export function ShoppingPreview({ rows }: { rows: readonly ShoppingRow[] }) {
  if (rows.length === 0) return null;
  return (
    <ul className="scheda lista scheda--carta" data-testid="aggiungi-spesa">
      {rows.map((row, index) => (
        <li key={`${index}-${row.name}`} className="riga-lista">
          <span className="tondo-spunta" aria-hidden="true">
            <Icon name="check" size="s" />
          </span>
          <span className="riga-lista__testo">
            <span className="riga-lista__titolo">{row.name}</span>
          </span>
          {row.inList ? (
            <Tag>
              <Icon name="info" size="s" />
              Già in lista
            </Tag>
          ) : row.quantity ? (
            <span className="riga-lista__quantita">{row.quantity}</span>
          ) : (
            <span />
          )}
        </li>
      ))}
    </ul>
  );
}

/** How much is left, the day and the title: the row of Casa · Scadenze, not a link. */
export function DeadlinePreview({
  howMuch,
  urgent,
  dayText,
  title,
}: {
  /** Null while the phrase has no date */
  howMuch: HowMuch | null;
  urgent: boolean;
  dayText: string;
  title: string;
}) {
  return (
    <div
      className="scheda scheda--carta riga-scadenza"
      data-testid="aggiungi-scadenza-anteprima"
    >
      <span className="riga-scadenza__giorni">
        <span
          className={cx(
            "riga-scadenza__numero",
            howMuch?.word && "riga-scadenza__numero--parola",
          )}
        >
          {howMuch ? howMuch.number : "—"}
          {urgent ? (
            <>
              <span className="pallino-urgente" aria-hidden="true" />
              <VisuallyHidden>, urgente</VisuallyHidden>
            </>
          ) : null}
        </span>
        {howMuch?.unit ? (
          <span className="riga-scadenza__unita">{howMuch.unit}</span>
        ) : null}
      </span>
      <span className="riga-lista__testo">
        <span className="riga-lista__titolo">{dayText}</span>
        {title ? <span className="riga-lista__info">{title}</span> : null}
      </span>
      <span />
    </div>
  );
}

export type ChoosablePerson = {
  id: string;
  name: string;
  color: MemberColor;
};

/** «Chi se ne occupa»: one at a time; the one chosen goes away with a second tap. */
export function WhoGroup({
  people,
  meId,
  chosenId,
  onChoose,
}: {
  /** «Tu» first, then the others */
  people: readonly ChoosablePerson[];
  meId: string | null;
  chosenId: string | null;
  onChoose: (id: string) => void;
}) {
  return (
    <div className="campo">
      <span className="campo__etichetta">Chi se ne occupa</span>
      <ChipGroup aria-label="Chi se ne occupa">
        {people.map((person) => (
          <Chip
            key={person.id}
            person
            pressed={person.id === chosenId}
            onClick={() => onChoose(person.id)}
            leading={
              <Avatar
                name={person.name}
                color={person.color}
                size="s"
                nameShown
              />
            }
          >
            {person.id === meId ? "Tu" : person.name}
          </Chip>
        ))}
      </ChipGroup>
    </div>
  );
}

/** «Lo vede tutto il Nest» / «Lo vedi solo tu»: a button whose name says its state. */
export function VisibilityChip({
  isPrivate,
  onToggle,
}: {
  isPrivate: boolean;
  onToggle: () => void;
}) {
  return (
    <Chip
      action
      icon={isPrivate ? "lock" : "users"}
      onClick={onToggle}
      data-testid="aggiungi-visibilita"
    >
      {isPrivate ? "Lo vedi solo tu" : "Lo vede tutto il Nest"}
    </Chip>
  );
}

/** Same look, for whoever did not create the thing: it cannot be changed. */
export function VisibilityLabel() {
  return (
    <Chip static icon="users">
      Lo vede tutto il Nest
    </Chip>
  );
}

/** A label of what was understood, with the button that takes it away (edit only). */
export function RemovableLabel({
  children,
  icon,
  leading,
  removeLabel,
  onRemove,
  testId,
}: {
  children: string;
  icon?: "calendar";
  leading?: ReactNode;
  removeLabel: string;
  onRemove: () => void;
  testId: string;
}) {
  return (
    <Chip static icon={icon} leading={leading} className="chip--con-togli">
      {children}
      <button
        type="button"
        className="chip__togli"
        aria-label={removeLabel}
        onClick={onRemove}
        data-testid={testId}
      >
        <Icon name="x" size="s" />
      </button>
    </Chip>
  );
}

/** «Avvisami»: several can be chosen, or none. */
export function ReminderGroup({
  chosen,
  onToggle,
}: {
  chosen: readonly number[];
  onToggle: (days: number) => void;
}) {
  return (
    <div className="campo">
      <span className="campo__etichetta">Avvisami</span>
      <ChipGroup aria-label="Avvisami">
        {REMINDERS.map((reminder) => (
          <Chip
            key={reminder.days}
            pressed={chosen.includes(reminder.days)}
            onClick={() => onToggle(reminder.days)}
          >
            {reminder.label}
          </Chip>
        ))}
      </ChipGroup>
    </div>
  );
}
