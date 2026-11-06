"use client";

import { Alert } from "@/components/ui/Alert/Alert";
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
import { cx } from "@/components/ui/cx";
import { Toggle } from "@/components/ui/Toggle/Toggle";
import type { EventVisibility } from "@/lib/calendar";
import {
  NOTES_MAX_LENGTH,
  PLACE_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  meFirst,
  type EventFormValues,
  type EventMember,
  type FieldKey,
  type FocusKey,
  type FormErrors,
  type Locks,
  type RepeatChoice,
} from "./model";

/**
 * The fields of the full event form: «Modifica impegno» in the detail page
 * and «Nuovo impegno» of Aggiungi (#20, #171). It only shows and
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
  /**
   * An imported event (#34): everything but «Chi lo vede» is read-only, and
   * this sentence says where it is changed («Si cambia su Google»).
   */
  readOnlyDetails?: { text: string };
  /** The row «Anche su …» after «Chi lo vede» (#34, §16); missing = no row */
  alsoOn?: AlsoOnRow;
};

export type AlsoOnRow = {
  /** «Anche su Google» */
  title: string;
  /** «Nel calendario Personale», or the warning when `warning` is true */
  info: string;
  checked: boolean;
  disabled: boolean;
  /** The info is a warning (the account needs «Ricollega») */
  warning: boolean;
  onChange: (checked: boolean) => void;
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
export function fieldId(prefix: string, key: FocusKey): string {
  const names: Record<FocusKey, string> = {
    title: "titolo",
    day: "giorno",
    from: "dalle",
    to: "alle",
    repeat: "ripete",
    people: "chi",
    escort: "porta",
    visibility: "vede",
  };
  return `${prefix}-${names[key]}`;
}

/** Moves the focus to a field: the input, or the right chip of a group. */
export function focusField(prefix: string, key: FocusKey): void {
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
  readOnlyDetails,
  alsoOn,
}: EventFormFieldsProps) {
  const detailsLocked = readOnlyDetails !== undefined;
  const alsoOnInfoId = `${idPrefix}-anche-su-info`;
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
      {readOnlyDetails ? (
        <Alert variant="info">{readOnlyDetails.text}</Alert>
      ) : null}
      <TextField
        id={id("title")}
        disabled={detailsLocked}
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
        disabled={detailsLocked}
        value={values.day}
        error={errors.day}
        onChange={(event) => onChange({ day: event.target.value })}
      />

      <FieldPair>
        <TimeField
          id={id("from")}
          label="Dalle"
          disabled={detailsLocked}
          value={values.from}
          error={errors.from}
          onChange={(event) => onChange({ from: event.target.value })}
        />
        <TimeField
          id={id("to")}
          label="Alle"
          disabled={detailsLocked}
          value={values.to}
          help={endsHint ?? undefined}
          error={errors.to}
          onChange={(event) => onChange({ to: event.target.value })}
        />
      </FieldPair>

      <SelectField
        id={id("repeat")}
        label="Si ripete"
        disabled={detailsLocked}
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
        disabled={detailsLocked}
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
        disabled={locks.people || detailsLocked}
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
        disabled={locks.people || detailsLocked}
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
          id={fieldId(idPrefix, "visibility")}
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

      {alsoOn ? (
        <div className="riga-lista riga-lista--senza-inizio">
          <span className="riga-lista__testo">
            <span className="riga-lista__titolo">{alsoOn.title}</span>
            <span
              className={cx(
                "riga-lista__info",
                alsoOn.warning && "riga-lista__info--allerta",
              )}
              id={alsoOnInfoId}
            >
              {alsoOn.info}
            </span>
          </span>
          <Toggle
            checked={alsoOn.checked}
            disabled={alsoOn.disabled}
            onChange={alsoOn.onChange}
            aria-label={alsoOn.title}
            aria-describedby={alsoOnInfoId}
            data-testid="impegno-anche-su"
          />
        </div>
      ) : null}

      <TextField
        multiline
        id={`${idPrefix}-note`}
        label="Note"
        disabled={detailsLocked}
        maxLength={NOTES_MAX_LENGTH}
        value={values.notes}
        onChange={(event) => onChange({ notes: event.target.value })}
      />
    </>
  );
}
