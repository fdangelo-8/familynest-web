"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { ErrorMain } from "@/components/ui/AppFrame/ErrorMain";
import { IconButton } from "@/components/ui/IconButton/IconButton";
import { Lens, useLens } from "@/components/ui/Lens/Lens";
import { useIsDesktop } from "@/components/ui/overlay";
import { SectionSwitcher } from "@/components/ui/SegmentedControl/SectionSwitcher";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton/Skeleton";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import {
  formatTime,
  getMonthGridDays,
  getMonthStartKey,
  getNextMonthKey,
  getPreviousMonthKey,
  getWeekStartKey,
  parseMonthParam,
  startOfDay,
  toDayKey,
} from "@/lib/datetime";
import { holidayName } from "@/lib/holidays";
import type { Member } from "@/components/calendario/model";
import { useNowMinute } from "@/components/calendario/useNowMinute";
import { usePeriodData } from "@/components/calendario/usePeriodData";
import { ChosenDay } from "./ChosenDay";
import { MonthGrid } from "./MonthGrid";
import {
  buildChosenDay,
  buildMonthCells,
  defaultChoice,
  monthTitle,
} from "./model";

const EMPTY_MEMBERS: readonly Member[] = [];
const PATH = "/calendario/mese";

/** Left-click without modifiers: the ones that stay on the page. */
function isPlainClick(event: MouseEvent<HTMLElement>): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function OpeningBody({ desktop }: { desktop: boolean }) {
  if (!desktop) {
    return (
      <SkeletonGroup>
        <Skeleton shape="grande" />
        <Skeleton shape="riga" />
        <Skeleton shape="riga" />
      </SkeletonGroup>
    );
  }
  return (
    <div className="colonne colonne--pannello">
      <SkeletonGroup className="colonna">
        <Skeleton shape="grande" />
        <Skeleton shape="grande" />
      </SkeletonGroup>
      <aside className="colonna">
        <div className="gruppo-skeleton" aria-busy="true">
          <Skeleton shape="riga" />
          <Skeleton shape="riga" />
        </div>
      </aside>
    </div>
  );
}

function MonthContent({ nowMs }: { nowMs: number }) {
  const searchParams = useSearchParams();
  const isDesktop = useIsDesktop();
  const [lens] = useLens();

  const todayKey = toDayKey(nowMs);
  const todayMonth = getMonthStartKey(todayKey);
  // The month without an address parameter is the one of the day the page was
  // opened (or of the last «Oggi»): it does not slide by itself at midnight.
  const [fallbackMonth, setFallbackMonth] = useState(todayMonth);
  const monthKey = parseMonthParam(
    searchParams.get("mese"),
    startOfDay(fallbackMonth),
  );
  const monthIsToday = monthKey === todayMonth;

  // One reading per month: the grid, from its Monday to its Sunday (28 to 42 days).
  const gridDays = useMemo(() => getMonthGridDays(monthKey), [monthKey]);
  const { entry, roster, failed, retrying, retry } = usePeriodData(
    gridDays[0]?.key ?? monthKey,
    gridDays.length,
  );
  const members = roster?.members ?? EMPTY_MEMBERS;
  const meId = roster?.meId ?? null;

  // The chosen day is decided when the month opens and then stays (a change of
  // lens or the clock do not move it).
  const [choice, setChoice] = useState(() => ({
    monthKey,
    dayKey: defaultChoice(monthKey, todayKey),
  }));
  if (choice.monthKey !== monthKey) {
    setChoice({ monthKey, dayKey: defaultChoice(monthKey, todayKey) });
  }
  const chosenKey =
    choice.monthKey === monthKey
      ? choice.dayKey
      : defaultChoice(monthKey, todayKey);

  const [announcedMonth, setAnnouncedMonth] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const cells = useMemo(
    () =>
      buildMonthCells({
        monthKey,
        events: entry?.events ?? null,
        members,
        meId,
        lens,
        todayKey,
      }),
    [monthKey, entry, members, meId, lens, todayKey],
  );
  const chosenCell = cells.find((cell) => cell.day.key === chosenKey);
  const chosenView = useMemo(
    () =>
      entry
        ? buildChosenDay({
            dayKey: chosenKey,
            events: entry.events,
            members,
            meId,
            lens,
            todayKey,
          })
        : null,
    [entry, chosenKey, members, meId, lens, todayKey],
  );

  const showPageError = failed && entry === undefined && roster === null;
  const showMonthError = failed && entry === undefined && roster !== null;
  const showAlert = failed && entry !== undefined;
  // Opening: nothing was ever read, so no grid yet. Later months keep the grid.
  const opening = !failed && entry === undefined && roster === null;
  const loading = !failed && entry === undefined && roster !== null;

  // The alert goes away while the focus was on «Riprova»: the focus would be
  // lost, so it goes to the title.
  const hadRetry = useRef(false);
  useEffect(() => {
    const hasRetry = showAlert || showPageError || showMonthError;
    if (
      hadRetry.current &&
      !hasRetry &&
      (!document.activeElement || document.activeElement === document.body)
    ) {
      headingRef.current?.focus();
    }
    hadRetry.current = hasRetry;
  }, [showAlert, showPageError, showMonthError]);

  if (showPageError) {
    return <ErrorMain onRetry={retry} retrying={retrying} />;
  }

  const goTo = (key: string) => {
    window.history.pushState(null, "", `${PATH}?mese=${key.slice(0, 7)}`);
    setAnnouncedMonth(key);
  };
  const goToday = () => {
    window.history.pushState(null, "", PATH);
    setFallbackMonth(todayMonth);
    setAnnouncedMonth(todayMonth);
    headingRef.current?.focus({ preventScroll: true });
  };

  const switcherItems = [
    {
      key: "giorno",
      label: "Giorno",
      href: `/calendario/giorno?giorno=${chosenKey}`,
    },
    {
      key: "settimana",
      label: "Settimana",
      href: `/calendario?settimana=${getWeekStartKey(chosenKey)}`,
    },
    {
      key: "mese",
      label: "Mese",
      href: `${PATH}?mese=${monthKey.slice(0, 7)}`,
    },
  ];

  const period = (
    <div className={monthIsToday ? "periodo" : "periodo periodo--con-oggi"}>
      <h1 className="t-titolo-pagina" tabIndex={-1} ref={headingRef}>
        {monthTitle(monthKey)}
      </h1>
      <div className="periodo__frecce">
        <IconButton
          icon="chevron-left"
          aria-label="Mese precedente"
          onClick={() => goTo(getPreviousMonthKey(monthKey))}
        />
        <IconButton
          icon="chevron-right"
          aria-label="Mese successivo"
          onClick={() => goTo(getNextMonthKey(monthKey))}
        />
      </div>
      {monthIsToday ? null : (
        <div className="periodo__oggi">
          <Button
            variant="link"
            href={PATH}
            onClick={(event) => {
              if (!isPlainClick(event)) return;
              event.preventDefault();
              goToday();
            }}
          >
            Oggi
          </Button>
        </div>
      )}
    </div>
  );

  const switcher = (
    <SectionSwitcher
      aria-label="Vista del calendario"
      items={switcherItems}
      current="mese"
    />
  );

  const status = (
    <div role="status" className="visivamente-nascosto">
      {announcedMonth === monthKey && entry ? monthTitle(monthKey) : ""}
    </div>
  );

  const retryButton = (
    <Button variant="link" loading={retrying} onClick={retry}>
      Riprova
    </Button>
  );
  const alert = showAlert ? (
    <Alert variant="errore" icon="wifi-off" action={retryButton}>
      Non riusciamo ad aggiornare il calendario. Vedi gli impegni salvati alle{" "}
      {formatTime(entry?.readAt ?? nowMs)}.
    </Alert>
  ) : null;
  const monthError = showMonthError ? (
    <Alert variant="errore" icon="wifi-off" action={retryButton}>
      Non riusciamo a caricare questo mese. Controlla la connessione e riprova.
    </Alert>
  ) : null;

  const grid = (
    <div aria-busy={loading ? "true" : undefined}>
      {loading ? <VisuallyHidden>Caricamento in corso</VisuallyHidden> : null}
      <MonthGrid
        title={monthTitle(monthKey)}
        cells={cells}
        meId={meId}
        chosenKey={chosenKey}
        onChoose={(dayKey) => setChoice({ monthKey, dayKey })}
      />
    </div>
  );

  const section = chosenCell ? (
    <ChosenDay
      day={chosenCell.day}
      holiday={holidayName(chosenKey)}
      isToday={chosenCell.isToday}
      isPast={chosenKey < todayKey}
      inMonth={chosenCell.inMonth}
      view={chosenView}
      loading={loading}
      members={members}
      meId={meId}
      nowMs={nowMs}
    />
  ) : null;

  if (!isDesktop) {
    return (
      <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
        {period}
        <div className="contenitore-selettore">{switcher}</div>
        {alert}
        {monthError}
        {opening ? (
          <OpeningBody desktop={false} />
        ) : (
          <>
            {grid}
            {section}
          </>
        )}
        {status}
      </main>
    );
  }

  return (
    <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
      <div className="intestazione-desktop">
        {period}
        <div className="nav-alto__azioni">
          <Lens />
          {switcher}
        </div>
      </div>
      {opening ? (
        <OpeningBody desktop />
      ) : (
        <div className="colonne colonne--pannello">
          <div className="colonna">
            {alert}
            {monthError}
            {grid}
          </div>
          <aside className="colonna">{section}</aside>
        </div>
      )}
      {status}
    </main>
  );
}

/** Calendario · Mese (`/calendario/mese`). The month and the clock are the browser's. */
export function MonthPage() {
  const nowMs = useNowMinute();
  if (nowMs === 0) {
    return (
      <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
        <SkeletonGroup className="colonna">
          <Skeleton shape="titolo" />
          <Skeleton shape="riga" />
          <Skeleton shape="riga" />
        </SkeletonGroup>
      </main>
    );
  }
  return <MonthContent nowMs={nowMs} />;
}
