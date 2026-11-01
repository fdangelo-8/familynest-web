"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLayoutEffect, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { Icon } from "@/components/ui/Icon/Icon";
import { IconButton } from "@/components/ui/IconButton/IconButton";
import { Lens, useLens } from "@/components/ui/Lens/Lens";
import { useIsDesktop } from "@/components/ui/overlay";
import { PageError } from "@/components/ui/PageError/PageError";
import { SectionSwitcher } from "@/components/ui/SegmentedControl/SectionSwitcher";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton/Skeleton";
import { hasTodayLinkOnError } from "@/lib/app-routes";
import {
  VISIBILITY_LABELS,
  eventsOfDay,
  formatHiddenCount,
} from "@/lib/calendar";
import {
  addDaysToDayKey,
  formatDayNumber,
  formatLongDay,
  formatMonthParam,
  formatTime,
  fromFieldValues,
  getCalendarDay,
  getWeekStartKey,
  isValidDayKey,
  startOfDay,
  toDayKey,
} from "@/lib/datetime";
import { buildWeekView } from "@/components/calendario-settimana/model";
import {
  type KeyedFullEvent,
  type Member,
} from "@/components/calendario/model";
import { useNowMinute } from "@/components/calendario/useNowMinute";
import { usePeriodData } from "@/components/calendario/usePeriodData";
import { DayGrid } from "./DayGrid";
import { EventPanel } from "@/components/calendario/EventPanel";
import { EveningsPanel } from "@/components/calendario/EveningsPanel";
import { OthersPanel } from "./DayPanels";
import {
  buildColumns,
  dayAnnouncement,
  defaultChoice,
  emptyDayText,
  isFull,
  layoutDayGrid,
  panelInfo,
  type GridPiece,
} from "./model";

const EMPTY_MEMBERS: readonly Member[] = [];
const PATH = "/calendario/giorno";
const VIEW_LABEL = "Chi è dove, dalle 8:00 alle 23:00";

/** Scrolls the view (never the page) to one hour before now, or to the top. */
function scrollView(
  view: HTMLElement,
  dayKey: string,
  isToday: boolean,
  nowMs: number,
) {
  view.scrollLeft = 0;
  const hours =
    (nowMs - fromFieldValues(dayKey, "08:00").getTime()) / 3_600_000 - 1;
  if (!isToday || hours <= 0) {
    view.scrollTop = 0;
    return;
  }
  const area = view.querySelector<HTMLElement>(".area-orari");
  const head = view.querySelector<HTMLElement>(".giorno-persone__testa");
  if (!area || !head) return;
  const hourHeight = area.offsetHeight / 15;
  const areaTop =
    area.getBoundingClientRect().top -
    view.getBoundingClientRect().top +
    view.scrollTop;
  const gap = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--space-2"),
  );
  view.scrollTop = Math.max(
    0,
    areaTop + hours * hourHeight - head.offsetHeight - 2 * (gap || 0),
  );
}

function LoadingBody({ desktop }: { desktop: boolean }) {
  const view = (
    <SkeletonGroup>
      <Skeleton shape="riga" />
      <Skeleton shape="grande" />
      <Skeleton shape="grande" />
    </SkeletonGroup>
  );
  if (!desktop) return view;
  return (
    <div className="colonne colonne--pannello">
      <div className="colonna">{view}</div>
      <aside className="colonna">
        <div className="gruppo-skeleton" aria-busy="true">
          <Skeleton shape="scheda" />
        </div>
      </aside>
    </div>
  );
}

function DayContent({ nowMs }: { nowMs: number }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isDesktop = useIsDesktop();
  const [lens] = useLens();

  const todayKey = toDayKey(nowMs);
  const rawDay = searchParams.get("giorno");
  const dayKey = rawDay !== null && isValidDayKey(rawDay) ? rawDay : todayKey;
  const isToday = dayKey === todayKey;
  const weekKey = getWeekStartKey(dayKey);
  const day = useMemo(() => getCalendarDay(dayKey), [dayKey]);

  const { entry, roster, failed, retrying, retry } = usePeriodData(weekKey, 7);
  const members = roster?.members ?? EMPTY_MEMBERS;
  const meId = roster?.meId ?? null;

  const [choice, setChoice] = useState<{
    dayKey: string;
    lens: string;
    eventKey: string;
  } | null>(null);
  const [groupChoice, setGroupChoice] = useState<{
    dayKey: string;
    lens: string;
    pieceKey: string;
  } | null>(null);
  const [announcedKey, setAnnouncedKey] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);

  const view = useMemo(
    () =>
      entry
        ? buildWeekView({
            weekKey,
            events: entry.events,
            members,
            meId,
            lens,
            todayKey,
          })
        : null,
    [entry, weekKey, members, meId, lens, todayKey],
  );
  const dayView = view?.days.find((candidate) => candidate.day.key === dayKey);
  // What the Nest lens shows: it decides if the day is empty and who has a column.
  const nestEvents = useMemo(
    () => (entry ? eventsOfDay(entry.events, day) : []),
    [entry, day],
  );
  const dayIsEmpty = entry !== undefined && nestEvents.length === 0;

  const columns = useMemo(
    () => buildColumns({ members, meId, lens, events: nestEvents }),
    [members, meId, lens, nestEvents],
  );
  const pieces = useMemo(
    () =>
      dayView && !dayIsEmpty
        ? layoutDayGrid({
            day,
            events: dayView.events,
            evening: dayView.evening,
            columns,
            compact: !isDesktop,
          })
        : [],
    [dayView, dayIsEmpty, day, columns, isDesktop],
  );

  // Desktop: the chosen event, or the one in progress / the next of the day.
  const chosen: KeyedFullEvent | null = useMemo(() => {
    if (!dayView) return null;
    if (choice?.dayKey === dayKey && choice.lens === lens) {
      const found = dayView.events.find(
        (event) => event.key === choice.eventKey,
      );
      if (found && isFull(found)) return found;
    }
    return defaultChoice(dayView.events, isToday, nowMs);
  }, [dayView, choice, dayKey, lens, isToday, nowMs]);

  const openPiece: GridPiece | null =
    groupChoice?.dayKey === dayKey && groupChoice.lens === lens
      ? (pieces.find((piece) => piece.key === groupChoice.pieceKey) ?? null)
      : null;

  const showPageError = failed && entry === undefined && roster === null;
  const showDayError = failed && entry === undefined && roster !== null;
  const showAlert = failed && entry !== undefined;
  const loading = !failed && entry === undefined;
  const showView = dayView !== undefined && !dayIsEmpty;
  const adultsCount = members.filter(
    (member) => member.kind === "adult",
  ).length;

  // Opening: the view is already scrolled to one hour before now. The page
  // does not scroll, and a change of lens does not move the view.
  const nowRef = useRef(nowMs);
  useEffect(() => {
    nowRef.current = nowMs;
  });
  useLayoutEffect(() => {
    if (viewRef.current) {
      scrollView(viewRef.current, dayKey, isToday, nowRef.current);
    }
  }, [dayKey, isToday, showView, isDesktop]);

  // The alert goes away while the focus was on «Riprova»: the focus would be
  // lost, so it goes to the title.
  const hadRetry = useRef(false);
  useEffect(() => {
    const hasRetry = showAlert || showPageError || showDayError;
    if (
      hadRetry.current &&
      !hasRetry &&
      (!document.activeElement || document.activeElement === document.body)
    ) {
      headingRef.current?.focus();
    }
    hadRetry.current = hasRetry;
  }, [showAlert, showPageError, showDayError]);

  const goTo = (key: string, focusTitle: boolean) => {
    window.history.pushState(null, "", `${PATH}?giorno=${key}`);
    setAnnouncedKey(key);
    if (focusTitle) headingRef.current?.focus({ preventScroll: true });
  };
  const goToday = () => {
    window.history.pushState(null, "", PATH);
    setAnnouncedKey(todayKey);
    headingRef.current?.focus({ preventScroll: true });
  };

  const switcherItems = [
    { key: "giorno", label: "Giorno", href: `${PATH}?giorno=${dayKey}` },
    {
      key: "settimana",
      label: "Settimana",
      href: `/calendario?settimana=${weekKey}`,
    },
    {
      key: "mese",
      label: "Mese",
      href: `/calendario/mese?mese=${formatMonthParam(startOfDay(dayKey))}`,
    },
  ];

  const title = isDesktop
    ? formatLongDay(day.start)
    : formatDayNumber(day.start);

  const period = (
    <div className="periodo">
      <h1 className="t-titolo-pagina" tabIndex={-1} ref={headingRef}>
        {title}
      </h1>
      <div className="periodo__frecce">
        {isToday ? null : (
          <Button
            variant="link"
            href={PATH}
            onClick={(event) => {
              if (
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return;
              }
              event.preventDefault();
              goToday();
            }}
          >
            Oggi
          </Button>
        )}
        <IconButton
          icon="chevron-left"
          aria-label="Giorno precedente"
          onClick={() => goTo(addDaysToDayKey(dayKey, -1), false)}
        />
        <IconButton
          icon="chevron-right"
          aria-label="Giorno successivo"
          onClick={() => goTo(addDaysToDayKey(dayKey, 1), false)}
        />
      </div>
    </div>
  );

  const switcher = (
    <SectionSwitcher
      aria-label="Vista del calendario"
      items={switcherItems}
      current="giorno"
    />
  );

  const status = (
    <div role="status" className="visivamente-nascosto">
      {announcedKey === dayKey && dayView
        ? dayAnnouncement(dayKey, todayKey)
        : ""}
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
  const dayError = showDayError ? (
    <Alert variant="errore" icon="wifi-off" action={retryButton}>
      Non riusciamo a caricare questo giorno. Controlla la connessione e
      riprova.
    </Alert>
  ) : null;

  const hiddenCount =
    lens === "io" && meId !== null && dayView && dayView.events.length === 0
      ? dayView.hiddenCount
      : 0;
  const hiddenLine =
    hiddenCount > 0 ? (
      <p className="sezione__info">
        <Icon name="eye-off" size="s" /> {formatHiddenCount(hiddenCount)}
      </p>
    ) : null;

  const emptyState = (
    <EmptyState
      icon="calendar"
      title="Giornata libera"
      text={emptyDayText(dayKey, todayKey)}
      actions={<Link href="/aggiungi">Aggiungi qualcosa</Link>}
      after="."
    />
  );

  const grid =
    showView && dayView ? (
      <div
        ref={viewRef}
        className="vista-giorno"
        role="region"
        aria-label={VIEW_LABEL}
        tabIndex={0}
      >
        <DayGrid
          day={day}
          columns={columns}
          pieces={pieces}
          members={members}
          meId={meId}
          desktop={isDesktop}
          chosenKey={isDesktop ? (chosen?.key ?? null) : null}
          nowMs={nowMs}
          isToday={isToday}
          weekKey={weekKey}
          onChoose={(eventKey) => {
            setGroupChoice(null);
            setChoice({ dayKey, lens, eventKey });
          }}
          onOpenGroup={(piece) =>
            setGroupChoice({ dayKey, lens, pieceKey: piece.key })
          }
        />
      </div>
    ) : null;

  const body = dayIsEmpty ? emptyState : grid;

  if (showPageError) {
    return (
      <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
        {isDesktop ? (
          <div className="intestazione-desktop">
            {period}
            <div className="nav-alto__azioni">
              <Lens />
              {switcher}
            </div>
          </div>
        ) : (
          <>
            {period}
            {switcher}
          </>
        )}
        <PageError
          headingLevel={2}
          icon="circle-alert"
          retrying={retrying}
          onRetry={retry}
          exit={
            hasTodayLinkOnError(pathname)
              ? { label: "Torna a Oggi", href: "/oggi" }
              : undefined
          }
        />
        {status}
      </main>
    );
  }

  if (!isDesktop) {
    return (
      <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
        {period}
        {switcher}
        {alert}
        {hiddenLine}
        {loading ? <LoadingBody desktop={false} /> : null}
        {dayError}
        {body}
        {status}
      </main>
    );
  }

  const adultsPanel =
    view && !dayIsEmpty && adultsCount >= 2 ? (
      <EveningsPanel
        evenings={view.evenings}
        shownDayKey={dayKey}
        hasAnyEvent={view.hasAnyEvent}
        onGo={(key) => goTo(key, true)}
      />
    ) : null;
  const eventPanel =
    view && !dayIsEmpty ? (
      openPiece ? (
        <OthersPanel
          piece={openPiece}
          ownerName={columns[openPiece.column]?.member.name ?? ""}
          isMe={columns[openPiece.column]?.isMe ?? false}
          day={day}
          members={members}
          meId={meId}
          nowMs={nowMs}
        />
      ) : chosen ? (
        <EventPanel
          event={chosen}
          members={members}
          info={panelInfo(chosen, dayKey)}
          note={VISIBILITY_LABELS[chosen.visibility]}
        />
      ) : null
    ) : null;

  return (
    <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
      <div className="intestazione-desktop">
        {period}
        <div className="nav-alto__azioni">
          <Lens />
          {switcher}
        </div>
      </div>
      {loading ? <LoadingBody desktop /> : null}
      {dayError ? (
        <div className="colonne colonne--pannello">
          <div className="colonna">{dayError}</div>
          <aside className="colonna" />
        </div>
      ) : null}
      {view ? (
        <div className="colonne colonne--pannello">
          <div className="colonna">
            {alert}
            {hiddenLine}
            {body}
          </div>
          <aside className="colonna">
            {eventPanel}
            {adultsPanel}
          </aside>
        </div>
      ) : null}
      {status}
    </main>
  );
}

/** Calendario · Giorno (`/calendario/giorno`). The day and the clock are the browser's. */
export function DayPage() {
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
  return <DayContent nowMs={nowMs} />;
}
