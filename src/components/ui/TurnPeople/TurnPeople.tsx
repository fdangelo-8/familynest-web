"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Avatar, type MemberColor } from "../Avatar/Avatar";
import { cx } from "../cx";
import { Chip, ChipGroup } from "../Chip/Chip";
import { Icon } from "../Icon/Icon";
import { IconButton } from "../IconButton/IconButton";
import { VisuallyHidden } from "../VisuallyHidden/VisuallyHidden";

export const TURN_MAX_PEOPLE = 6;

export type TurnPerson = { id: string; name: string; color: MemberColor };

export type TurnPeopleProps = {
  /** Everyone who can take a turn, in the order of the Nest (never pets) */
  people: readonly TurnPerson[];
  /** Ids of the chosen people, in turn order */
  value: readonly string[];
  onChange: (ids: string[]) => void;
  label?: string;
  /** Error text, for example «Scegli chi fa il turno.» */
  error?: string;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
};

type PendingFocus =
  | { kind: "row"; id: string; button: "up" | "down" | "remove" }
  | { kind: "chip"; id: string }
  | { kind: "firstChip" };

/**
 * «Chi, in ordine»: the people of a turn as a numbered list with «Sposta su»,
 * «Sposta giù» and «Togli», and the chips of the people still to add. No
 * dragging. The focus follows the row that moves; each change is announced.
 */
export function TurnPeople({
  people,
  value,
  onChange,
  label = "Chi, in ordine",
  error,
  disabled,
  className,
  "data-testid": testId,
}: TurnPeopleProps) {
  const id = useId();
  const labelId = `${id}-etichetta`;
  const helpId = `${id}-aiuto`;
  const errorId = error ? `${id}-errore` : undefined;
  const [announcement, setAnnouncement] = useState("");
  const pending = useRef<PendingFocus | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const chips = useRef(new Map<string, HTMLButtonElement>());

  const byId = new Map(people.map((person) => [person.id, person]));
  const chosen = value.flatMap((personId) => byId.get(personId) ?? []);
  const available = people.filter((person) => !value.includes(person.id));
  const full = chosen.length >= TURN_MAX_PEOPLE;
  const help = full
    ? "Al massimo 6 persone."
    : chosen.length === 0
      ? "Tocca chi fa il turno, nell'ordine."
      : undefined;

  // The focus is moved after the new order is on screen.
  useEffect(() => {
    const target = pending.current;
    if (!target) return;
    pending.current = null;
    if (target.kind === "row") {
      buttons.current.get(`${target.id}:${target.button}`)?.focus();
    } else if (target.kind === "chip") {
      chips.current.get(target.id)?.focus();
    } else {
      const first = people.find((person) => !value.includes(person.id));
      if (first) chips.current.get(first.id)?.focus();
    }
  }, [value, people]);

  function move(personId: string, direction: -1 | 1) {
    const from = value.indexOf(personId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= value.length) return;
    const next = [...value];
    next.splice(from, 1);
    next.splice(to, 0, personId);
    const atEdge = direction === -1 ? to === 0 : to === next.length - 1;
    pending.current = {
      kind: "row",
      id: personId,
      button: atEdge
        ? direction === -1
          ? "down"
          : "up"
        : direction === -1
          ? "up"
          : "down",
    };
    setAnnouncement(
      `${byId.get(personId)?.name ?? ""} ora è al posto ${to + 1}.`,
    );
    onChange(next);
  }

  function remove(personId: string) {
    const index = value.indexOf(personId);
    const next = value.filter((chosenId) => chosenId !== personId);
    const taker = next[index];
    pending.current = taker
      ? { kind: "row", id: taker, button: "remove" }
      : { kind: "firstChip" };
    setAnnouncement(`${byId.get(personId)?.name ?? ""} tolta dal turno.`);
    onChange(next);
  }

  function add(personId: string) {
    if (full) return;
    const index = available.findIndex((person) => person.id === personId);
    const neighbour = available[index + 1] ?? available[index - 1];
    pending.current = neighbour
      ? { kind: "chip", id: neighbour.id }
      : { kind: "row", id: personId, button: "remove" };
    setAnnouncement(
      `${byId.get(personId)?.name ?? ""} aggiunta al turno, al posto ${value.length + 1}.`,
    );
    onChange([...value, personId]);
  }

  function register(key: string) {
    return (node: HTMLButtonElement | null) => {
      if (node) buttons.current.set(key, node);
      else buttons.current.delete(key);
    };
  }

  const describedBy = [help ? helpId : undefined, errorId]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cx("campo", error && "campo--errore", className)}
      data-testid={testId}
    >
      <span className="campo__etichetta" id={labelId}>
        {label}
      </span>
      {chosen.length > 0 ? (
        <div className="scheda">
          <ol className="lista" aria-labelledby={labelId}>
            {chosen.map((person, index) => (
              <li key={person.id} className="riga-lista">
                <Avatar
                  name={person.name}
                  color={person.color}
                  size="s"
                  nameShown
                />
                <span className="riga-lista__titolo">{person.name}</span>
                <span className="riga-lista__azioni">
                  <IconButton
                    small
                    icon="chevron-up"
                    aria-label={`Sposta su: ${person.name}`}
                    aria-disabled={index === 0 || disabled}
                    buttonRef={register(`${person.id}:up`)}
                    onClick={() => {
                      if (index > 0 && !disabled) move(person.id, -1);
                    }}
                  />
                  <IconButton
                    small
                    icon="chevron-down"
                    aria-label={`Sposta giù: ${person.name}`}
                    aria-disabled={index === chosen.length - 1 || disabled}
                    buttonRef={register(`${person.id}:down`)}
                    onClick={() => {
                      if (index < chosen.length - 1 && !disabled) {
                        move(person.id, 1);
                      }
                    }}
                  />
                  <IconButton
                    small
                    icon="x"
                    aria-label={`Togli ${person.name}`}
                    aria-disabled={disabled}
                    buttonRef={register(`${person.id}:remove`)}
                    onClick={() => {
                      if (!disabled) remove(person.id);
                    }}
                  />
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      <ChipGroup
        aria-label="Aggiungi al turno"
        aria-describedby={describedBy || undefined}
      >
        {available.map((person) => (
          <Chip
            key={person.id}
            person
            action
            disabled={disabled || full}
            leading={
              <Avatar
                name={person.name}
                color={person.color}
                size="s"
                nameShown
              />
            }
            buttonRef={(node) => {
              if (node) chips.current.set(person.id, node);
              else chips.current.delete(person.id);
            }}
            onClick={() => add(person.id)}
          >
            {person.name}
          </Chip>
        ))}
      </ChipGroup>
      {help ? (
        <p className="campo__aiuto" id={helpId}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p className="campo__errore" id={errorId}>
          <Icon name="circle-alert" size="s" />
          {error}
        </p>
      ) : null}
      <div role="status" aria-live="polite">
        <VisuallyHidden>{announcement}</VisuallyHidden>
      </div>
    </div>
  );
}
