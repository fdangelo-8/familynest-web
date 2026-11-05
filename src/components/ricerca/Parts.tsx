"use client";

import Link from "next/link";
import {
  useEffect,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Alert } from "@/components/ui/Alert/Alert";
import { Avatar } from "@/components/ui/Avatar/Avatar";
import { Button } from "@/components/ui/Button/Button";
import { Chip, ChipGroup } from "@/components/ui/Chip/Chip";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { Icon } from "@/components/ui/Icon/Icon";
import { SEARCH_MAX_TEXT_LENGTH } from "@/lib/search-household";
import {
  ERROR_TEXT,
  EXAMPLES,
  FIELD_PLACEHOLDER,
  FILTER_LABELS,
  FILTER_ORDER,
  OFFLINE_TEXT,
  emptyTitle,
} from "./model";
import type { SearchController } from "./useSearchController";

/** The field with the lens; `end` is «Annulla» (mobile) or the «esc» sign. */
export function SearchField({
  ctrl,
  inputRef,
  end,
  combobox,
  onKeyDown,
  onSubmit,
}: {
  ctrl: SearchController;
  inputRef: RefObject<HTMLInputElement | null>;
  end: ReactNode;
  /** Palette: the field is a combobox over the list the arrows move in */
  combobox?: {
    expanded: boolean;
    controls: string | undefined;
    activeDescendant: string | undefined;
  };
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  onSubmit?: () => void;
}) {
  const fieldId = `${ctrl.uid}-campo`;
  return (
    <form
      className="campo-ricerca"
      role="search"
      data-testid="ricerca-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <Icon name="search" />
      <label className="visivamente-nascosto" htmlFor={fieldId}>
        Cerca nel Nest
      </label>
      {/* No `name`: before the page is ready a submit would put the text in the address. */}
      <input
        ref={inputRef}
        id={fieldId}
        className="campo-ricerca__input"
        type="search"
        placeholder={FIELD_PLACEHOLDER}
        value={ctrl.text}
        maxLength={SEARCH_MAX_TEXT_LENGTH}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        role={combobox ? "combobox" : undefined}
        aria-autocomplete={combobox ? "list" : undefined}
        aria-expanded={combobox ? combobox.expanded : undefined}
        aria-controls={combobox?.controls}
        aria-activedescendant={combobox?.activeDescendant}
        onChange={(event) =>
          ctrl.setText(event.target.value.slice(0, SEARCH_MAX_TEXT_LENGTH))
        }
        onKeyDown={onKeyDown}
      />
      {end}
    </form>
  );
}

/** Filter chips (mobile). With `counts` every chip with results has its number. */
export function FilterChips({
  ctrl,
  counts,
}: {
  ctrl: SearchController;
  counts: boolean;
}) {
  const { filter } = ctrl;
  // The chip chosen comes into view if the row scrolls.
  useEffect(() => {
    document
      .querySelector<HTMLElement>(
        '[data-testid="ricerca-filtri"] [aria-pressed="true"]',
      )
      ?.scrollIntoView?.({ inline: "nearest", block: "nearest" });
  }, [filter]);

  const keys = FILTER_ORDER.filter(
    (key) => !counts || key === "all" || key === filter || ctrl.counts[key] > 0,
  );
  return (
    <ChipGroup
      scroll
      aria-label="Filtra i risultati"
      data-testid="ricerca-filtri"
    >
      {keys.map((key) => (
        <Chip
          key={key}
          pressed={filter === key}
          count={counts && ctrl.counts[key] > 0 ? ctrl.counts[key] : undefined}
          onClick={() => ctrl.setFilter(key)}
        >
          {FILTER_LABELS[key]}
        </Chip>
      ))}
    </ChipGroup>
  );
}

/** Persone: one chip per member, «Tu» first (mobile). */
export function PeopleSection({ ctrl }: { ctrl: SearchController }) {
  if (ctrl.people.length === 0) return null;
  const me = ctrl.people.find((person) => person.id === ctrl.meId);
  const ordered = me
    ? [me, ...ctrl.people.filter((person) => person.id !== me.id)]
    : ctrl.people;
  return (
    <section className="sezione" data-testid="ricerca-persone">
      <div className="sezione__testa">
        <h2 className="sezione__titolo">Persone</h2>
      </div>
      <div className="scheda scheda--imbottita">
        <div className="gruppo-chip">
          {ordered.map((person) => (
            <Chip
              key={person.id}
              person
              action
              leading={
                <Avatar name={person.name} color={person.color} nameShown />
              }
              onClick={() => ctrl.setTextNow(`cose di ${person.name}`)}
            >
              {person.id === me?.id ? "Tu" : person.name}
            </Chip>
          ))}
        </div>
      </div>
    </section>
  );
}

/** «Cancella»: the name says what it clears, and starts with the visible word. */
export function ClearRecentsButton({ ctrl }: { ctrl: SearchController }) {
  return (
    <button
      type="button"
      className="btn-link btn-link--secondario"
      aria-label="Cancella le ricerche recenti"
      onClick={ctrl.clearRecents}
    >
      Cancella
    </button>
  );
}

/** Recenti on mobile: buttons that write the text again. */
export function RecentsSection({ ctrl }: { ctrl: SearchController }) {
  if (ctrl.recents.length === 0) return null;
  return (
    <section className="sezione" data-testid="ricerca-recenti">
      <div className="sezione__testa">
        <h2 className="sezione__titolo">Recenti</h2>
        <span className="sezione__info">
          <ClearRecentsButton ctrl={ctrl} />
        </span>
      </div>
      <ul className="scheda lista">
        {ctrl.recents.map((recent) => (
          <li key={recent}>
            <button
              type="button"
              className="riga-lista riga-lista--cliccabile"
              onClick={() => ctrl.setTextNow(recent)}
            >
              <span className="icona-riquadro">
                <Icon name="history" />
              </span>
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">{recent}</span>
              </span>
              <Icon name="arrow-up-left" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Prova a cercare on mobile: three fixed examples. */
export function ExamplesSection({ ctrl }: { ctrl: SearchController }) {
  return (
    <section className="sezione" data-testid="ricerca-esempi">
      <div className="sezione__testa">
        <h2 className="sezione__titolo">Prova a cercare</h2>
      </div>
      <div className="gruppo-chip">
        {EXAMPLES.map((example) => (
          <Chip key={example} action onClick={() => ctrl.setTextNow(example)}>
            {example}
          </Chip>
        ))}
      </div>
    </section>
  );
}

/** «Nessun risultato»: with «aggiungilo», which opens Aggiungi with the text. */
export function NoResults({ ctrl }: { ctrl: SearchController }) {
  const inFilter = ctrl.filter !== "all" && ctrl.counts.all > 0;
  return (
    <EmptyState
      icon="search"
      title={emptyTitle(ctrl.shownText, inFilter ? ctrl.filter : "all")}
      text="Prova con un'altra parola, oppure"
      actions={
        <Link href="/aggiungi" onClick={ctrl.onAddClick}>
          aggiungilo
        </Link>
      }
      after="."
      data-testid="ricerca-vuoto"
    />
  );
}

/** The search failed or the connection is down: the notice and «Riprova». */
export function SearchProblem({
  ctrl,
  offline,
}: {
  ctrl: SearchController;
  offline: boolean;
}) {
  return (
    <div data-testid={offline ? "ricerca-offline" : "ricerca-errore"}>
      <Alert
        variant="errore"
        icon={offline ? "wifi-off" : undefined}
        action={
          <Button variant="link" loading={ctrl.retrying} onClick={ctrl.retry}>
            Riprova
          </Button>
        }
      >
        {offline ? OFFLINE_TEXT : ERROR_TEXT}
      </Alert>
    </div>
  );
}
