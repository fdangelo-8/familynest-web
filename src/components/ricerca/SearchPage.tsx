"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button/Button";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton/Skeleton";
import { takeSearchFromApp } from "./from-app";
import { GROUP_TITLES } from "./model";
import {
  ExamplesSection,
  FilterChips,
  NoResults,
  PeopleSection,
  RecentsSection,
  SearchField,
  SearchProblem,
} from "./Parts";
import { PageRow } from "./Rows";
import {
  useSearchController,
  type SearchController,
} from "./useSearchController";
import type { SearchKind } from "@/lib/search-household";

const GROUP_ORDER: readonly SearchKind[] = [
  "event",
  "deadline",
  "todo",
  "shopping_item",
];

function ResultGroups({ ctrl }: { ctrl: SearchController }) {
  const kinds = ctrl.filter === "all" ? GROUP_ORDER : [ctrl.filter];
  return (
    <>
      {kinds.map((kind) => {
        const rows = ctrl.groups[kind];
        if (rows.length === 0) return null;
        return (
          <section
            className="sezione"
            key={kind}
            data-testid={`ricerca-gruppo-${kind}`}
          >
            <div className="sezione__testa">
              <h2 className="sezione__titolo">{GROUP_TITLES[kind]}</h2>
              {kind === "event" && ctrl.eventInfo ? (
                <span className="sezione__info">{ctrl.eventInfo}</span>
              ) : null}
            </div>
            <ul className="scheda lista">
              {rows.map((row, position) => (
                <PageRow
                  key={row.key}
                  row={row}
                  position={position}
                  ctrl={ctrl}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

function Body({ ctrl }: { ctrl: SearchController }) {
  const { phase, filter, counts } = ctrl;

  if (phase === "idle") {
    return (
      <>
        <FilterChips ctrl={ctrl} counts={false} />
        <PeopleSection ctrl={ctrl} />
        <RecentsSection ctrl={ctrl} />
        <ExamplesSection ctrl={ctrl} />
      </>
    );
  }

  // While loading, failing or offline the chips stay only to leave a filter.
  const chosenFilter = filter !== "all";
  if (phase === "loading") {
    return (
      <>
        {chosenFilter ? <FilterChips ctrl={ctrl} counts={false} /> : null}
        <SkeletonGroup aria-live="polite" data-testid="ricerca-caricamento">
          <Skeleton shape="testo-corto" />
          <Skeleton shape="riga" />
          <Skeleton shape="riga" />
        </SkeletonGroup>
      </>
    );
  }
  if (phase === "error" || phase === "offline") {
    return (
      <>
        {chosenFilter ? <FilterChips ctrl={ctrl} counts={false} /> : null}
        <SearchProblem ctrl={ctrl} offline={phase === "offline"} />
      </>
    );
  }

  // Answer received.
  if (counts.all === 0) {
    return (
      <>
        {chosenFilter ? <FilterChips ctrl={ctrl} counts /> : null}
        <NoResults ctrl={ctrl} />
      </>
    );
  }
  return (
    <>
      <FilterChips ctrl={ctrl} counts />
      {chosenFilter && counts[filter] === 0 ? (
        <NoResults ctrl={ctrl} />
      ) : (
        <ResultGroups ctrl={ctrl} />
      )}
    </>
  );
}

/**
 * The search as a page, under 1024 px (issue #40): the field with «Annulla»
 * works as the bar, there is no bottom navigation, and the filter chips scroll
 * sideways.
 */
export function SearchPage() {
  const router = useRouter();
  // An app page is behind this one, and «Annulla» goes back to it.
  const fromApp = useRef(false);
  useEffect(() => {
    if (takeSearchFromApp()) fromApp.current = true;
  }, []);

  const close = useCallback(() => {
    if (fromApp.current) router.back();
    else router.replace("/oggi");
  }, [router]);

  const { ctrl, inputRef } = useSearchController({
    mode: "page",
    onClose: close,
    addByReplace: () => fromApp.current,
  });

  return (
    <main
      id="contenuto"
      tabIndex={-1}
      className="pagina pagina--stretta-alto"
      data-testid="ricerca-pagina"
    >
      <h1 className="visivamente-nascosto">Cerca nel Nest</h1>
      <SearchField
        ctrl={ctrl}
        inputRef={inputRef}
        end={
          <Button
            variant="link-secondario"
            href="/oggi"
            onClick={(event) => {
              event.preventDefault();
              close();
            }}
          >
            Annulla
          </Button>
        }
        onSubmit={() => {
          // Enter saves the search and closes the keyboard.
          if (ctrl.phase === "ready" && ctrl.counts.all > 0) ctrl.remember();
          inputRef.current?.blur();
        }}
      />
      <p
        className="visivamente-nascosto"
        role="status"
        data-testid="ricerca-annuncio"
      >
        {ctrl.announcement}
      </p>
      <Body ctrl={ctrl} />
    </main>
  );
}
