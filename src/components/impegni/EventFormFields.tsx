"use client";

import { Avatar } from "@/components/ui/Avatar/Avatar";
import { Chip } from "@/components/ui/Chip/Chip";
import {
  DateField,
  FieldPair,
  SelectField,
  TextField,
  TimeField,
} from "@/components/ui/Field/Field";
import { Icon, type IconName } from "@/components/ui/Icon/Icon";
import type { EventVisibility } from "@/lib/calendar";
import {
  NOTES_MAX_LENGTH,
  PLACE_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  meFirst,
  type EventFormValues,
  type EventMember,
  type FieldKey,
  type FormErrors,
  type Locks,
  type RepeatChoice,
} from "./model";

/**
 * The fields of the full event form: «Modifica impegno» in the detail page
 * and, later, «Più dettagli» of Aggiungi (#20, #171). It only shows and
 * reports: the page that owns it decides when to check and what to save.
 */
export type EventFormFieldsProps = {
  /** Unique prefix of the ids, so two forms never share an id */
  idPrefix: string;
  members: ReadonlyArray<EventMember>;
  /** Member id of the signed-in user: written «Tu», first in the lists */
  meId: string;
  values: EventFormValues;
  onChange: (patch: Partial<EventFormValues>) => void;
  /** Shown under the fields (after the first save attempt, not while typing) */
  errors: FormErrors;
  repeatOptions: ReadonlyArray<{ value: RepeatChoice; label: string }>;
  /** `Finisce mercoledì 21.` under «Alle» */
  endsHint: string | null;
  locks: Locks;
  /** The sentence under «Chi lo vede» */
  visibilityText: string;
  /** The sentence under «La porta» when «Chi» and «La porta» are locked */
  peopleLockedText: string | null;
};

const VISIBILITY_CHOICES: ReadonlyArray<{
  value: EventVisibility;
  label: string;
  icon: IconName;
}> = [
  { value: "private", label: "Solo io", icon: "lock" },
  { value: "busy", label: "Occupato", icon: "eye-off" },
  { value: "household", label: "Tutti", icon: "users" },
];

/** Id of a field of the form, to move the focus to it. */
export function fieldId(prefix: string, key: FieldKey): string {
  const names: Record<FieldKey, string> = {
    title: "titolo",
    day: "giorno",
    from: "dalle",
    to: "alle",
    repeat: "ripete",
    people: "chi",
    escort: "porta",
  };
  return `${prefix}-${names[key]}`;
}

/** Moves the focus to a field: the input, or the right chip of a group. */
export function focusField(prefix: string, key: FieldKey): void {
  const element = document.getElementById(fieldId(prefix, key));
  if (!element) return;
  if (element.getAttribute("role") === "group") {
    const target =
      element.querySelector<HTMLElement>('button[aria-pressed="true"]') ??
      element.querySelector<HTMLElement>("button:not(:disabled)");
    target?.focus();
    return;
  }
  element.focus();
}

function PeopleChips({
  id,
  label,
  people,
  meId,
  isPressed,
  onToggle,
  disabled,
  help,
  error,
}: {
  id: string;
  label: string;
  people: ReadonlyArray<EventMember>;
  /** Written «Tu» */
  meId: string;
  isPressed: (member: EventMember) => boolean;
  onToggle: (member: EventMember) => void;
  disabled: boolean;
  /** Sentence under the group, linked to it */
  help?: { id: string; text: string };
  error?: string;
}) {
  const labelId = `${id}-etichetta`;
  const errorId = `${id}-errore`;
  const described =
    [help?.id, error ? errorId : undefined].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className={error ? "campo campo--errore" : "campo"}>
      <span className="campo__etichetta" id={labelId}>
        {label}
      </span>
      <div
        id={id}
        role="group"
        aria-labelledby={labelId}
        aria-describedby={described}
        className="gruppo-chip"
      >
        {people.map((member) => (
          <Chip
            key={member.id}
            person
            pressed={isPressed(member)}
            disabled={disabled}
            onClick={() => onToggle(member)}
            leading={
              <Avatar name={member.name} color={member.color} nameShown />
            }
          >
            {member.id === meId ? "Tu" : member.name}
          </Chip>
        ))}
      </div>
      {help ? (
        <p className="campo__aiuto" id={help.id}>
          {help.text}
        </p>
      ) : null}
      {error ? (
        <p className="campo__errore" id={errorId}>
          <Icon name="circle-alert" size="s" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function EventFormFields({
  idPrefix,
  members,
  meId,
  values,
  onChange,
  errors,
  repeatOptions,
  endsHint,
  locks,
  visibilityText,
  peopleLockedText,
}: EventFormFieldsProps) {
  const id = (key: FieldKey) => fieldId(idPrefix, key);
  const visibilityTextId = `${idPrefix}-vede-aiuto`;
  const lockedTextId = `${idPrefix}-persone-aiuto`;
  const everyone = meFirst(members, meId);
  const adults = everyone.filter((member) => member.kind === "adult");

  const toggleMember = (member: EventMember) => {
    const has = values.memberIds.includes(member.id);
    onChange({
      memberIds: has
        ? values.memberIds.filter((memberId) => memberId !== member.id)
        : [...values.memberIds, member.id],
    });
  };

  return (
    <>
      <TextField
        id={id("title")}
        label="Titolo"
        maxLength={TITLE_MAX_LENGTH}
        autoComplete="off"
        value={values.title}
        error={errors.title}
        onChange={(event) => onChange({ title: event.target.value })}
      />

      <DateField
        id={id("day")}
        label="Giorno"
        value={values.day}
        error={errors.day}
        onChange={(event) => onChange({ day: event.target.value })}
      />

      <FieldPair>
        <TimeField
          id={id("from")}
          label="Dalle"
          value={values.from}
          error={errors.from}
          onChange={(event) => onChange({ from: event.target.value })}
        />
        <TimeField
          id={id("to")}
          label="Alle"
          value={values.to}
          help={endsHint ?? undefined}
          error={errors.to}
          onChange={(event) => onChange({ to: event.target.value })}
        />
      </FieldPair>

      <SelectField
        id={id("repeat")}
        label="Si ripete"
        value={values.repeat}
        error={errors.repeat}
        onChange={(event) =>
          onChange({ repeat: event.target.value as RepeatChoice })
        }
      >
        {repeatOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>

      <TextField
        id={`${idPrefix}-dove`}
        label="Dove"
        maxLength={PLACE_MAX_LENGTH}
        autoComplete="off"
        value={values.place}
        onChange={(event) => onChange({ place: event.target.value })}
      />

      <PeopleChips
        id={id("people")}
        label="Chi"
        people={everyone}
        meId={meId}
        isPressed={(member) => values.memberIds.includes(member.id)}
        onToggle={toggleMember}
        disabled={locks.people}
        error={errors.people}
      />

      <PeopleChips
        id={id("escort")}
        label="La porta"
        people={adults}
        meId={meId}
        isPressed={(member) => values.escortId === member.id}
        onToggle={(member) =>
          onChange({
            escortId: values.escortId === member.id ? null : member.id,
          })
        }
        disabled={locks.people}
        help={
          locks.people && peopleLockedText
            ? { id: lockedTextId, text: peopleLockedText }
            : undefined
        }
        error={errors.escort}
      />

      <div className="campo">
        <span className="campo__etichetta" aria-hidden="true">
          Chi lo vede
        </span>
        {/* The same group as `SegmentedControl`, with the icons of the mockup,
            which the shared component cannot show yet. */}
        <div
          role="group"
          aria-label="Chi lo vede"
          aria-describedby={visibilityTextId}
          className="selettore selettore--carta"
        >
          {VISIBILITY_CHOICES.map((choice) => (
            <button
              key={choice.value}
              type="button"
              className="selettore__voce"
              aria-pressed={values.visibility === choice.value}
              disabled={locks.visibility}
              aria-disabled={locks.visibility ? true : undefined}
              onClick={() => onChange({ visibility: choice.value })}
            >
              <Icon name={choice.icon} size="s" />
              {choice.label}
            </button>
          ))}
        </div>
        <p
          className="campo__aiuto"
          id={visibilityTextId}
          aria-live={locks.visibility ? undefined : "polite"}
        >
          {visibilityText}
        </p>
      </div>

      <TextField
        multiline
        id={`${idPrefix}-note`}
        label="Note"
        maxLength={NOTES_MAX_LENGTH}
        value={values.notes}
        onChange={(event) => onChange({ notes: event.target.value })}
      />
    </>
  );
}
