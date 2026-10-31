"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { IconButton } from "@/components/ui/IconButton/IconButton";
import { Lens, useLens } from "@/components/ui/Lens/Lens";
import { useIsDesktop } from "@/components/ui/overlay";
import { ErrorMain } from "@/components/ui/AppFrame/ErrorMain";
import { SectionSwitcher } from "@/components/ui/SegmentedControl/SectionSwitcher";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton/Skeleton";
import {
  addDaysToDayKey,
  formatDayRange,
  formatMonthParam,
  formatTime,
  getWeekDays,
  parseWeekParam,
  startOfDay,
  toDayKey,
} from "@/lib/datetime";
import { setLens } from "@/lib/lens";
import {
  EventPanel,
  EveningsPanel,
  OthersPanel,
  WeekGrid,
  type OtherGroup,
  type Selection,
} from "./DesktopWeek";
import { DayList, DayStrip } from "./MobileWeek";
import {
  buildWeekView,
  defaultSelection,
  weekAnnouncement,
  type DayView,
  type KeyedFullEvent,
  type Member,
} from "./model";
import { useNowMinute } from "./useNowMinute";
import { useWeekData } from "./useWeekData";

const EMPTY_MEMBERS: readonly Member[] = [];

function barOffset(): number {
  const bar = document.querySelector<HTMLElement>(".barra");
  const space = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--space-4"),
  );
  const height =
    bar && getComputedStyle(bar).display !== "none" ? bar.offsetHeight : 0;
  return height + (Number.isNaN(space) ? 0 : space);
}

/** Scrolls so the head of a day sits just under the fixed bar (no animation). */
function scrollToDay(dayKey: string, focus: boolean) {
  const heading = document.getElementById(`m-giorno-${dayKey}`);
  if (!heading) return;
  const head = heading.parentElement ?? heading;
  window.scrollTo({
    top: head.getBoundingClientRect().top + window.scrollY - barOffset(),
    behavior: "instant",
  });
  if (focus) heading.focus({ preventScroll: true });
}

function LoadingBody({ desktop }: { desktop: boolean }) {
  if (desktop) {
    return (
      <div className="colonne colonne--pannello">
        <div className="colonna">
          <SkeletonGroup>
            <Skeleton shape="grande" />
            <Skeleton shape="grande" />
          </SkeletonGroup>
        </div>
        <aside className="colonna">
          <div className="gruppo-skeleton" aria-busy="true">
            <Skeleton shape="scheda" />
            <Skeleton shape="riga" />
            <Skeleton shape="riga" />
          </div>
        </aside>
      </div>
    );
  }
  return (
    <div className="colonna">
      <SkeletonGroup>
        <Skeleton shape="testo-corto" />
        <Skeleton shape="riga" />
        <Skeleton shape="riga" />
        <Skeleton shape="riga" />
        <Skeleton shape="testo-corto" />
        <Skeleton shape="riga" />
        <Skeleton shape="riga" />
      </SkeletonGroup>
    </div>
  );
}

function WeekContent({ nowMs }: { nowMs: number }) {
  const searchParams = useSearchParams();
  const isDesktop = useIsDesktop();
  const [lens] = useLens();

  const todayKey = toDayKey(nowMs);
  const weekKey = toDayKey(
    parseWeekParam(searchParams.get("settimana"), nowMs),
  );
  const weekDays = useMemo(() => getWeekDays(weekKey), [weekKey]);
  const containsToday = weekDays.some((day) => day.key === todayKey);

  const { entry, roster, failed, retrying, retry } = useWeekData(weekKey);
  const members = roster?.members ?? EMPTY_MEMBERS;
  const meId = roster?.meId ?? null;

  const [dayChoice, setDayChoice] = useState<{
    week: string;
    key: string;
  } | null>(null);
  const [eventChoice, setEventChoice] = useState<{
    week: string;
    lens: string;
    selection: Selection;
  } | null>(null);
  const [groupChoice, setGroupChoice] = useState<{
    week: string;
    lens: string;
    group: OtherGroup;
  } | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const headingRef = useRef<HTMLHeadingElement>(null);

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

  // Days without data (loading, error): the strip still has names and numbers.
  const blankDays: DayView[] = useMemo(
    () =>
      weekDays.map((day) => ({
        day,
        isToday: day.key === todayKey,
        events: [],
        hiddenCount: 0,
        evening: null,
      })),
    [weekDays, todayKey],
  );

  const defaultDay = containsToday ? todayKey : weekKey;
  const selectedDay =
    dayChoice?.week === weekKey && weekDays.some((d) => d.key === dayChoice.key)
      ? dayChoice.key
      : defaultDay;

  // Desktop: the chosen event, or the first one that has not started yet.
  const selection: Selection | null = useMemo(() => {
    if (!view) return null;
    if (eventChoice?.week === weekKey && eventChoice.lens === lens) {
      const chosen = eventChoice.selection;
      const day = view.days.find((d) => d.day.key === chosen.dayKey);
      const found = day?.events.find((event) => event.key === chosen.event.key);
      if (found && !found.masked) {
        return { event: found as KeyedFullEvent, dayKey: chosen.dayKey };
      }
    }
    const first = defaultSelection(view.days, containsToday, nowMs);
    if (!first) return null;
    const day = view.days.find((d) =>
      d.events.some((event) => event.key === first.key),
    );
    return day ? { event: first, dayKey: day.day.key } : null;
  }, [view, eventChoice, weekKey, lens, containsToday, nowMs]);

  const openGroup =
    groupChoice?.week === weekKey && groupChoice.lens === lens
      ? groupChoice.group
      : null;

  const range = formatDayRange(
    startOfDay(weekKey),
    startOfDay(addDaysToDayKey(weekKey, 6)),
  );
  const showAlert = failed && entry !== undefined;
  const showPageError = failed && entry === undefined;
  const loading = !failed && entry === undefined;
  const everEmpty = view !== null && !view.hasAnyEvent;
  const adultsCount = members.filter((m) => m.kind === "adult").length;

  // The first day of the Giorno link: the one picked (mobile) or today/Monday.
  const dayLinkKey = isDesktop ? defaultDay : selectedDay;
  const switcherItems = [
    {
      key: "giorno",
      label: "Giorno",
      href: `/calendario/giorno?giorno=${dayLinkKey}`,
    },
    { key: "settimana", label: "Settimana", href: "/calendario" },
    {
      key: "mese",
      label: "Mese",
      href: `/calendario/mese?mese=${formatMonthParam(startOfDay(dayLinkKey))}`,
    },
  ];

  const go = (delta: number) => {
    const next = addDaysToDayKey(weekKey, 7 * delta);
    window.history.pushState(null, "", `/calendario?settimana=${next}`);
    setAnnouncement(weekAnnouncement(next));
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  // Mobile: a tap on a day scrolls the list to its section (after it is drawn).
  const pendingScroll = useRef<string | null>(null);
  useEffect(() => {
    if (pendingScroll.current === null) return;
    scrollToDay(pendingScroll.current, true);
    pendingScroll.current = null;
  }, [dayChoice]);

  // The alert and the error go away while the focus was on «Riprova»: the
  // focus would be lost, so it goes to the title.
  const hadRetry = useRef(false);
  useEffect(() => {
    const hasRetry = showAlert || showPageError;
    if (
      hadRetry.current &&
      !hasRetry &&
      (!document.activeElement || document.activeElement === document.body)
    ) {
      headingRef.current?.focus();
    }
    hadRetry.current = hasRetry;
  }, [showAlert, showPageError]);

  const alert = showAlert ? (
    <Alert
      variant="errore"
      icon="wifi-off"
      action={
        <Button variant="link" loading={retrying} onClick={retry}>
          Riprova
        </Button>
      }
    >
      Non riusciamo ad aggiornare il calendario. Vedi gli impegni salvati alle{" "}
      {formatTime(entry?.readAt ?? nowMs)}.
    </Alert>
  ) : null;

  const noneOfMine =
    view !== null &&
    view.hasAnyEvent &&
    view.days.every((day) => day.events.length === 0);
  const othersCount = entry?.events.length ?? 0;

  const emptyState = noneOfMine ? (
    <EmptyState
      large
      title="Niente di tuo questa settimana"
      text={`Gli altri del Nest ${othersCount === 1 ? "ha 1 impegno" : `hanno ${othersCount} impegni`}: li vedi con la lente Nest.`}
      actions={
        <>
          <Button
            variant="primary"
            full={!isDesktop}
            onClick={() => {
              setLens("nest");
              headingRef.current?.focus();
            }}
          >
            Mostra tutto il Nest
          </Button>
          <Button variant="secondary" full={!isDesktop} href="/aggiungi">
            Aggiungi un impegno
          </Button>
        </>
      }
    />
  ) : (
    <EmptyState
      large
      title="Questa settimana è ancora vuota"
      text="Gli impegni che aggiungi compaiono qui, giorno per giorno."
      actions={
        <Button variant="primary" full={!isDesktop} href="/aggiungi">
          Aggiungi un impegno
        </Button>
      }
    />
  );
  const showEmpty = everEmpty || noneOfMine;
  const listStart = containsToday
    ? selectedDay < todayKey
      ? selectedDay
      : todayKey
    : weekKey;

  const period = (
    <div className="periodo">
      <h1 className="t-titolo-pagina" tabIndex={-1} ref={headingRef}>
        {range}
      </h1>
      <div className="periodo__frecce">
        <IconButton
          icon="chevron-left"
          aria-label="Settimana precedente"
          onClick={() => go(-1)}
        />
        <IconButton
          icon="chevron-right"
          aria-label="Settimana successiva"
          onClick={() => go(1)}
        />
      </div>
    </div>
  );

  const switcher = (
    <SectionSwitcher
      aria-label="Vista del calendario"
      items={switcherItems}
      current="settimana"
    />
  );

  const status = (
    <div role="status" className="visivamente-nascosto">
      {announcement}
    </div>
  );

  if (showPageError) {
    return <ErrorMain onRetry={retry} retrying={retrying} />;
  }

  if (!isDesktop) {
    return (
      <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
        {period}
        {switcher}
        <DayStrip
          weekKey={weekKey}
          loaded={view !== null}
          days={view?.days ?? blankDays}
          selectedKey={selectedDay}
          onSelect={(key) => {
            pendingScroll.current = key;
            setDayChoice({ week: weekKey, key });
          }}
        />
        {alert}
        {loading ? <LoadingBody desktop={false} /> : null}
        {view && showEmpty ? emptyState : null}
        {view && !showEmpty ? (
          <DayList
            view={view}
            startKey={listStart}
            members={members}
            meId={meId}
            nowMs={nowMs}
          />
        ) : null}
        {status}
      </main>
    );
  }

  const panels = view ? (
    <>
      {openGroup ? (
        <OthersPanel
          group={openGroup}
          view={view}
          members={members}
          meId={meId}
          nowMs={nowMs}
        />
      ) : selection ? (
        <EventPanel
          selection={selection}
          members={members}
          todayKey={todayKey}
        />
      ) : null}
      {adultsCount >= 2 ? (
        <EveningsPanel view={view} hasAnyEvent={view.hasAnyEvent} />
      ) : null}
    </>
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
      {view ? (
        <div className="colonne colonne--pannello">
          <div className="colonna">
            {alert}
            {showEmpty ? (
              emptyState
            ) : (
              <WeekGrid
                view={view}
                members={members}
                nowMs={nowMs}
                selection={selection}
                onSelect={(event, dayKey) => {
                  setGroupChoice(null);
                  setEventChoice({
                    week: weekKey,
                    lens,
                    selection: { event, dayKey },
                  });
                }}
                onOpenGroup={(group) =>
                  setGroupChoice({ week: weekKey, lens, group })
                }
              />
            )}
          </div>
          <aside className="colonna">{panels}</aside>
        </div>
      ) : null}
      {status}
    </main>
  );
}

/** Calendario · Settimana (`/calendario`). The week and the clock are the browser's. */
export function WeekPage() {
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
  return <WeekContent nowMs={nowMs} />;
}
