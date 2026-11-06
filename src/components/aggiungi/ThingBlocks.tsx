import type { ReactNode } from "react";
import { Avatar, type MemberColor } from "../ui/Avatar/Avatar";
import { Chip, ChipGroup } from "../ui/Chip/Chip";
import { cx } from "../ui/cx";
import { Icon } from "../ui/Icon/Icon";
import { SegmentedControl } from "../ui/SegmentedControl/SegmentedControl";
import { Tag } from "../ui/Tag/Tag";
import { VisuallyHidden } from "../ui/VisuallyHidden/VisuallyHidden";
import type { EventVisibility } from "../../lib/calendar";
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

/**
 * «Chi se ne occupa» of Da fare, Scadenza and Spesa: any number of people, or
 * nobody; a second tap takes one away.
 */
export function WhoManyGroup({
  id,
  people,
  meId,
  chosenIds,
  onToggle,
  fromPhrase = false,
}: {
  /** Unique id of the group (the label and the help hang from it) */
  id: string;
  /** «Tu» first, then the others */
  people: readonly ChoosablePerson[];
  meId: string | null;
  chosenIds: readonly string[];
  onToggle: (id: string) => void;
  /** The people come from «<Nome> deve» in the phrase: «Preso dalla frase» */
  fromPhrase?: boolean;
}) {
  return (
    <div className="campo">
      <span className="campo__etichetta" id={`${id}-etichetta`}>
        Chi se ne occupa
      </span>
      <div
        id={id}
        role="group"
        aria-labelledby={`${id}-etichetta`}
        aria-describedby={fromPhrase ? `${id}-aiuto` : undefined}
        className="gruppo-chip"
      >
        {people.map((person) => (
          <Chip
            key={person.id}
            person
            pressed={chosenIds.includes(person.id)}
            onClick={() => onToggle(person.id)}
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
      </div>
      {fromPhrase ? (
        <p className="campo__aiuto" id={`${id}-aiuto`}>
          Preso dalla frase
        </p>
      ) : null}
    </div>
  );
}

/**
 * «Chi lo vede» of Da fare and Scadenza: two voices, always shown, one chosen
 * («Lo vede tutto il Nest», «Lo vedo solo io»). For whoever did not create the
 * thing the voices are shown but cannot be changed.
 */
export function VisibilityGroup({
  id,
  isPrivate,
  onChange,
  lockedText,
}: {
  /** Unique prefix of the id of the sentence */
  id: string;
  isPrivate: boolean;
  onChange: (isPrivate: boolean) => void;
  /** Whoever did not create the thing cannot change it: the sentence says why */
  lockedText?: string;
}) {
  const locked = lockedText !== undefined;
  const textId = `${id}-aiuto`;
  return (
    <div className="campo">
      <span className="campo__etichetta" aria-hidden="true">
        Chi lo vede
      </span>
      <div className="contenitore-selettore">
        <SegmentedControl<"nest" | "me">
          aria-label="Chi lo vede"
          paper
          value={isPrivate ? "me" : "nest"}
          onChange={(value) => onChange(value === "me")}
          describedBy={locked ? textId : undefined}
          options={[
            {
              value: "nest",
              label: "Lo vede tutto il Nest",
              icon: "users",
              disabled: locked,
            },
            {
              value: "me",
              label: "Lo vedo solo io",
              icon: "lock",
              disabled: locked,
            },
          ]}
          data-testid="aggiungi-visibilita"
        />
      </div>
      {locked ? (
        <p className="campo__aiuto" id={textId}>
          {lockedText}
        </p>
      ) : null}
    </div>
  );
}

/**
 * «Chi lo vede» of an Impegno: its three voices, always shown, with the
 * sentence that says what the chosen one means (the same as the full form).
 */
export function EventVisibilityGroup({
  id,
  value,
  onChange,
  text,
}: {
  /** Unique prefix of the ids of the sentence */
  id: string;
  value: EventVisibility;
  onChange: (value: EventVisibility) => void;
  /** The sentence under the voices */
  text: string;
}) {
  const textId = `${id}-aiuto`;
  return (
    <div className="campo">
      <span className="campo__etichetta" aria-hidden="true">
        Chi lo vede
      </span>
      <div className="contenitore-selettore">
        <SegmentedControl<EventVisibility>
          aria-label="Chi lo vede"
          paper
          value={value}
          onChange={onChange}
          describedBy={textId}
          options={[
            { value: "private", label: "Solo io", icon: "lock" },
            { value: "busy", label: "Occupato", icon: "eye-off" },
            { value: "household", label: "Tutti", icon: "users" },
          ]}
          data-testid="aggiungi-visibilita"
        />
      </div>
      <p className="campo__aiuto" id={textId} aria-live="polite">
        {text}
      </p>
    </div>
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
