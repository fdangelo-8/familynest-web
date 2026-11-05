"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon/Icon";
import { useAnimatedClose } from "@/components/ui/overlay";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton/Skeleton";
import type { SearchKind } from "@/lib/search-household";
import { EXAMPLES, GROUP_TITLES } from "./model";
import {
  ClearRecentsButton,
  NoResults,
  SearchField,
  SearchProblem,
} from "./Parts";
import { PaletteRow } from "./Rows";
import {
  useSearchController,
  type SearchController,
} from "./useSearchController";

const GROUP_ORDER: readonly SearchKind[] = [
  "event",
  "deadline",
  "todo",
  "shopping_item",
];

/** Recent searches and examples, before anything is typed. */
function IdleContent({ ctrl }: { ctrl: SearchController }) {
  const recentsTitle = `${ctrl.uid}-recenti-titolo`;
  const examplesTitle = `${ctrl.uid}-esempi-titolo`;
  return (
    <>
      {ctrl.recents.length > 0 ? (
        <section className="sezione" data-testid="ricerca-recenti">
          <div className="sezione__testa">
            <h2 className="sezione__titolo" id={recentsTitle}>
              Recenti
            </h2>
            <span className="sezione__info">
              <ClearRecentsButton ctrl={ctrl} />
            </span>
          </div>
          <ul
            className="scheda lista"
            role="listbox"
            id={`${ctrl.uid}-recenti`}
            aria-labelledby={recentsTitle}
          >
            {ctrl.recents.map((recent, index) => {
              const key = `recent-${index}`;
              const selected = ctrl.activeKey === key;
              return (
                <li role="presentation" key={key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    id={ctrl.itemId(key)}
                    tabIndex={-1}
                    className={cx(
                      "riga-lista",
                      "riga-lista--cliccabile",
                      selected && "is-selezionata",
                    )}
                    onClick={() => ctrl.setTextNow(recent)}
                    onMouseMove={() => {
                      if (!selected) ctrl.select(key);
                    }}
                  >
                    <span className="icona-riquadro">
                      <Icon name="history" />
                    </span>
                    <span className="riga-lista__testo">
                      <span className="riga-lista__titolo">{recent}</span>
                    </span>
                    {selected ? (
                      <kbd className="kbd" aria-hidden="true">
                        ↵
                      </kbd>
                    ) : (
                      <Icon name="arrow-up-left" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      <section className="sezione" data-testid="ricerca-esempi">
        <div className="sezione__testa">
          <h2 className="sezione__titolo" id={examplesTitle}>
            Prova a cercare
          </h2>
        </div>
        <div
          className="gruppo-chip"
          role="listbox"
          aria-orientation="horizontal"
          id={`${ctrl.uid}-esempi`}
          aria-labelledby={examplesTitle}
        >
          {EXAMPLES.map((example, index) => {
            const key = `example-${index}`;
            const selected = ctrl.activeKey === key;
            return (
              <button
                type="button"
                role="option"
                aria-selected={selected}
                key={key}
                id={ctrl.itemId(key)}
                tabIndex={-1}
                className={cx("chip", selected && "is-selezionata")}
                onClick={() => ctrl.setTextNow(example)}
                onMouseMove={() => {
                  if (!selected) ctrl.select(key);
                }}
              >
                {example}
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}

/** Groups of results and the last one, «Azioni». */
function ResultsContent({ ctrl }: { ctrl: SearchController }) {
  const addSelected = ctrl.activeKey === "add";
  return (
    <>
      {GROUP_ORDER.map((kind) => {
        const rows = ctrl.groups[kind];
        if (rows.length === 0) return null;
        const titleId = `${ctrl.uid}-gruppo-${kind}`;
        return (
          <div
            className="palette__gruppo"
            role="group"
            aria-labelledby={titleId}
            key={kind}
            data-testid={`ricerca-gruppo-${kind}`}
          >
            <p className="palette__gruppo-titolo" id={titleId}>
              {GROUP_TITLES[kind]}
            </p>
            <ul className="lista" role="presentation">
              {rows.map((row) => (
                <PaletteRow key={row.key} row={row} ctrl={ctrl} />
              ))}
            </ul>
          </div>
        );
      })}
      <div
        className="palette__gruppo"
        role="group"
        aria-labelledby={`${ctrl.uid}-gruppo-azioni`}
        data-testid="ricerca-gruppo-azioni"
      >
        <p className="palette__gruppo-titolo" id={`${ctrl.uid}-gruppo-azioni`}>
          Azioni
        </p>
        <ul className="lista" role="presentation">
          <li role="presentation">
            <Link
              href="/aggiungi"
              className={cx(
                "riga-lista",
                "riga-lista--cliccabile",
                addSelected && "is-selezionata",
              )}
              role="option"
              aria-selected={addSelected}
              id={ctrl.itemId("add")}
              tabIndex={-1}
              onClick={ctrl.onAddClick}
              onMouseMove={() => {
                if (!addSelected) ctrl.select("add");
              }}
              data-testid="ricerca-azione-aggiungi"
            >
              <span className="icona-riquadro">
                <Icon name="plus" />
              </span>
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">
                  Aggiungi «{ctrl.shownText}» come impegno
                </span>
                <span className="riga-lista__info">
                  Si apre Aggiungi con il testo già scritto
                </span>
              </span>
              {addSelected ? (
                <kbd className="kbd" aria-hidden="true">
                  ↵
                </kbd>
              ) : null}
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
}

function tabbables(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>("input, button, a[href]"),
  ).filter(
    (element) =>
      element.getAttribute("tabindex") !== "-1" &&
      !element.hasAttribute("disabled"),
  );
}

/**
 * The search as a palette, from 1024 px (issue #40): a dialog over the page
 * with a veil. The focus stays in the field; the arrows move a selection
 * among the rows (`aria-activedescendant`), ↵ opens it, Esc closes.
 */
export function SearchPalette({ direct }: { direct: boolean }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const leaving = useRef(false);

  // The element that had the focus (the lens) gets it back when the palette
  // closes. Declared before the controller, whose effect moves the focus.
  useEffect(() => {
    const active = document.activeElement;
    opener.current =
      active instanceof HTMLElement && active !== document.body ? active : null;
    return () => {
      if (!leaving.current) return;
      const target = direct
        ? document.getElementById("contenuto")
        : opener.current;
      if (target && document.contains(target)) target.focus();
    };
  }, [direct]);

  const leave = useCallback(() => {
    leaving.current = true;
    // Opened from a page: back to it. Opened by address: Today.
    if (direct) router.replace("/oggi");
    else router.back();
  }, [direct, router]);
  const { closing, requestClose } = useAnimatedClose(leave);

  const { ctrl, inputRef } = useSearchController({
    mode: "palette",
    onClose: requestClose,
    addByReplace: () => !direct,
  });

  if (typeof document === "undefined") return null;

  const { phase } = ctrl;
  const results = phase === "ready" && ctrl.counts.all > 0;
  // Offline keeps recent searches and examples under the notice.
  const idle = phase === "idle" || phase === "offline";
  const listIds = results
    ? `${ctrl.uid}-risultati`
    : idle
      ? [
          ctrl.recents.length > 0 ? `${ctrl.uid}-recenti` : null,
          `${ctrl.uid}-esempi`,
        ]
          .filter((id) => id !== null)
          .join(" ")
      : undefined;

  const onFieldKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      ctrl.move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      ctrl.move(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      ctrl.activateSelected();
    }
  };

  const onDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const root = dialogRef.current;
    if (!root) return;
    // Control+K / Command+K with the palette open: nothing, and not the
    // browser's own shortcut.
    if (
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !event.shiftKey &&
      event.key.toLowerCase() === "k"
    ) {
      event.preventDefault();
      event.stopPropagation();
      inputRef.current?.focus();
      return;
    }
    if (event.key !== "Tab") return;
    const items = tabbables(root);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (!root.contains(active)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // A click on a bare part of the palette keeps the focus in the field.
  const onDialogMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (!target.closest("button, a, input")) event.preventDefault();
  };

  return createPortal(
    <>
      <div
        className={cx("velo", closing && "is-uscita")}
        onClick={requestClose}
        aria-hidden="true"
        data-testid="velo"
      />
      <div
        ref={dialogRef}
        className={cx(
          "modale",
          "modale--singola",
          "palette",
          closing && "is-uscita",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Cerca nel Nest"
        data-testid="ricerca-palette"
        onKeyDown={onDialogKeyDown}
        onMouseDown={onDialogMouseDown}
      >
        <SearchField
          ctrl={ctrl}
          inputRef={inputRef}
          end={
            <kbd className="kbd" aria-hidden="true">
              esc
            </kbd>
          }
          combobox={{
            expanded: ctrl.items.length > 0,
            controls: listIds,
            activeDescendant:
              ctrl.activeKey !== null ? ctrl.itemId(ctrl.activeKey) : undefined,
          }}
          onKeyDown={onFieldKeyDown}
        />
        <p
          className="visivamente-nascosto"
          role="status"
          data-testid="ricerca-annuncio"
        >
          {ctrl.announcement}
        </p>
        <div
          className="palette__risultati"
          role={results ? "listbox" : undefined}
          aria-label={results ? "Risultati" : undefined}
          id={results ? `${ctrl.uid}-risultati` : undefined}
        >
          {phase === "loading" ? (
            <SkeletonGroup aria-live="polite" data-testid="ricerca-caricamento">
              <Skeleton shape="riga" />
              <Skeleton shape="riga" />
            </SkeletonGroup>
          ) : null}
          {phase === "error" || phase === "offline" ? (
            <SearchProblem ctrl={ctrl} offline={phase === "offline"} />
          ) : null}
          {idle ? <IdleContent ctrl={ctrl} /> : null}
          {phase === "ready" && !results ? <NoResults ctrl={ctrl} /> : null}
          {results ? <ResultsContent ctrl={ctrl} /> : null}
        </div>
        <div className="palette__piede">
          <span>
            <kbd className="kbd">↑</kbd>
            <kbd className="kbd">↓</kbd>
            per scorrere
          </span>
          <span>
            <kbd className="kbd">↵</kbd>
            per aprire
          </span>
          <span>
            <kbd className="kbd">esc</kbd>
            per chiudere
          </span>
        </div>
      </div>
    </>,
    document.body,
  );
}
