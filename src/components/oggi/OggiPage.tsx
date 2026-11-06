"use client";

import { useEffect, useRef, useState, type FocusEvent } from "react";
import { useNowMinute } from "@/components/calendario/useNowMinute";
import { useNest } from "@/components/ui/AppFrame/NestProvider";
import { Lens, useLens } from "@/components/ui/Lens/Lens";
import { PageError } from "@/components/ui/PageError/PageError";
import { Skeleton } from "@/components/ui/Skeleton/Skeleton";
import { formatGreeting, formatLongDay, toDayKey } from "@/lib/datetime";
import type { Lens as LensValue } from "@/lib/lens";
import { createClient } from "@/lib/supabase/client";
import {
  buildEventsView,
  buildHouseView,
  buildSpacesView,
  buildStarter,
  buildSummary,
  buildTodosView,
  todoCounterInfo,
} from "./model";
import {
  CasaSection,
  DomaniSection,
  DopoSection,
  EventsErrorSection,
  LoadingBody,
  LoadingSide,
  NelNestSection,
  OfflineAlert,
  ProssimoSection,
  QuickAdd,
  SpacesSection,
  StarterList,
  Summary,
  TodayEmptySection,
  TodoSection,
  WeekSection,
  type CounterData,
  type Ctx,
} from "./Sections";
import type { OpenTodo } from "./read";
import { useOggi } from "./useOggi";

function Header({
  nowMs,
  greeting,
  name,
}: {
  nowMs: number;
  greeting: string;
  name: string | null;
}) {
  return (
    <div className="intestazione">
      <p className="intestazione__sopra">{formatLongDay(nowMs)}</p>
      <h1 className="intestazione__titolo t-titolo-pagina" tabIndex={-1}>
        {name ? (
          <>
            {greeting},<br />
            <b>{name}</b>
          </>
        ) : (
          greeting
        )}
      </h1>
    </div>
  );
}

/** What the server sends: the clock and the data are the browser's. */
function Waiting() {
  return (
    <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
      <div className="colonna oggi-solo-mobile">
        <div className="intestazione">
          <Skeleton shape="titolo" />
        </div>
      </div>
      <div className="oggi-solo-desktop">
        <div className="intestazione-desktop">
          <div className="intestazione">
            <Skeleton shape="titolo" />
          </div>
          <Lens />
        </div>
      </div>
    </main>
  );
}

const NO_MEMBERS: never[] = [];

function visible(elements: Iterable<HTMLElement>): HTMLElement | undefined {
  return Array.from(elements).find(
    (element) => element.getClientRects().length > 0,
  );
}

function OggiContent({ nowMs }: { nowMs: number }) {
  const { me } = useNest();
  const [lens] = useLens();
  const rootRef = useRef<HTMLElement>(null);
  const oggi = useOggi(toDayKey(nowMs), rootRef);
  const { data, failed } = oggi;

  // «Già fatti» is open for one lens only: another lens finds it closed.
  const [doneState, setDoneState] = useState<{
    lens: LensValue;
    open: boolean;
  }>({ lens, open: false });
  const doneOpen = doneState.lens === lens && doneState.open;

  const people = data.people;
  const members = people?.members ?? NO_MEMBERS;
  const meId = people?.meId ?? "";
  const ready = oggi.phase === "ready";

  const eventsView =
    people && data.events
      ? buildEventsView({ events: data.events, lens, meId, members, nowMs })
      : null;

  const barred = new Map<string, OpenTodo>();
  for (const [id, entry] of oggi.done) {
    if (entry.barred) barred.set(id, entry.todo);
  }
  const todosView =
    people && data.todos
      ? buildTodosView({
          todos: data.todos,
          barred,
          hidden: new Set(oggi.done.keys()),
          lens,
          meId,
          members,
          nowMs,
        })
      : null;

  const houseView = data.house
    ? buildHouseView({
        shopping: data.house.shopping,
        deadlines: data.house.deadlines,
        nowMs,
      })
    : null;
  const sharedOpen = data.todos
    ? data.todos.filter((todo) => !todo.isPrivate && !oggi.done.has(todo.id))
    : null;
  const counters: CounterData | null = houseView
    ? {
        shoppingCount: houseView.shoppingCount,
        shoppingInfo: houseView.shoppingInfo,
        deadlines: houseView.shared.slice(0, 2),
        todos: sharedOpen
          ? {
              count: sharedOpen.length,
              info: todoCounterInfo(sharedOpen, nowMs),
            }
          : null,
      }
    : null;

  const spacesView =
    people && data.pinned ? buildSpacesView(data.pinned, members) : null;

  // The person who joined with an invitation: a sentence instead of the list.
  const welcome = data.welcome;
  const invited = welcome?.status === "named" || welcome?.status === "unnamed";
  const inviter = welcome?.status === "named" ? welcome.inviterName : null;
  const summary =
    invited && people && data.events
      ? buildSummary({
          events: data.events,
          members,
          shoppingCount: data.house?.shopping.length ?? 0,
          nowMs,
        })
      : null;

  // Starter list: when every step is done the database is asked to close it.
  const starter = people
    ? buildStarter({
        household: data.household,
        invites: data.invites,
        isAdmin: people.isAdmin,
        members,
        nowMs,
      })
    : null;
  const [completion, setCompletion] = useState<"idle" | "done" | "failed">(
    "idle",
  );
  const completing = useRef(false);
  const starterAllDone = starter?.allDone === true;
  useEffect(() => {
    if (!starterAllDone || completing.current) return;
    completing.current = true;
    void (async () => {
      let closed = false;
      try {
        const { data: result, error } = await createClient().rpc(
          "complete_starter_list",
        );
        closed = !error && result === true;
      } catch {
        closed = false;
      }
      // A failure is silent: the list stays, and it is tried again next time.
      setCompletion(closed ? "done" : "failed");
    })();
  }, [starterAllDone]);
  const showStarter =
    starter !== null && !(starter.allDone && completion !== "failed");

  // The offline notice does not take the focus; when it goes away after
  // «Riprova», the focus goes to the title.
  const showOffline = ready && oggi.offline;
  const offlineHadFocus = useRef(false);
  const wasOffline = useRef(false);
  useEffect(() => {
    if (wasOffline.current && !showOffline && offlineHadFocus.current) {
      offlineHadFocus.current = false;
      visible(
        rootRef.current?.querySelectorAll<HTMLElement>("h1") ?? [],
      )?.focus();
    }
    wasOffline.current = showOffline;
  }, [showOffline]);
  const focusedEvent = useRef<string | null>(null);
  const trackFocus = (event: FocusEvent<HTMLElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    offlineHadFocus.current = target?.closest("[data-oggi-offline]") != null;
    focusedEvent.current =
      target?.closest("[data-event-key]")?.getAttribute("data-event-key") ??
      null;
  };
  // Every minute the rows are sorted again. A row with the focus that has just
  // ended moves into «Già fatti»: the focus goes to that button.
  useEffect(() => {
    const key = focusedEvent.current;
    if (!key || !eventsView) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    if (!eventsView.finished.some((event) => event.key === key)) return;
    focusedEvent.current = null;
    visible(
      rootRef.current?.querySelectorAll<HTMLElement>(".riga-gia-fatti") ?? [],
    )?.focus();
  }, [eventsView]);

  const ctx: Ctx = {
    nowMs,
    lens,
    members,
    meId,
    doneOpen,
    onToggleDone: () => setDoneState({ lens, open: !doneOpen }),
    onToggleTodo: oggi.toggleTodo,
    onRetry: oggi.retry,
    retrying: oggi.retrying,
  };

  const header = (
    <Header
      nowMs={nowMs}
      greeting={invited ? "Eccoti" : formatGreeting(nowMs)}
      name={me?.name ?? null}
    />
  );

  if (oggi.pageError) {
    return (
      <main
        id="contenuto"
        tabIndex={-1}
        ref={rootRef}
        className="pagina pagina-desktop pagina-desktop--centrata"
      >
        <PageError
          headingLevel={1}
          icon="circle-alert"
          text="Controlla la connessione e riprova."
          retrying={oggi.retrying}
          onRetry={oggi.retry}
        />
      </main>
    );
  }

  const offlineAlert = showOffline ? (
    <OfflineAlert
      at={oggi.lastOkAt || nowMs}
      retrying={oggi.retrying}
      onRetry={oggi.retry}
    />
  ) : null;

  // The invitation to link a calendar only when the reading says there is none.
  const askForCalendar = data.household?.hasLinkedCalendar === false;

  const starterOrSummary = (p: string) =>
    summary ? (
      <Summary
        view={summary}
        inviter={inviter}
        askForCalendar={askForCalendar}
      />
    ) : showStarter && starter ? (
      <StarterList view={starter} p={p} />
    ) : null;

  const eventsBlock = (p: string, desktop: boolean) => {
    if (failed.events && !data.events) {
      return <EventsErrorSection ctx={ctx} p={p} />;
    }
    if (!eventsView) return null;
    if (eventsView.todayEmpty) {
      if (eventsView.tomorrowEvents.length > 0) {
        // Nothing today but something tomorrow: on the phone «Domani» takes
        // the place of «Oggi»; on the desktop it is already in its place.
        return desktop ? null : (
          <DomaniSection view={eventsView} ctx={ctx} p={p} columns={false} />
        );
      }
      return <TodayEmptySection p={p} askForCalendar={askForCalendar} />;
    }
    const prossimo = <ProssimoSection view={eventsView} ctx={ctx} p={p} />;
    const dopo = <DopoSection view={eventsView} ctx={ctx} p={p} />;
    return desktop ? (
      <div className="colonne colonne--due">
        {prossimo}
        {dopo}
      </div>
    ) : (
      <>
        {prossimo}
        {dopo}
      </>
    );
  };

  const todoSection = (p: string) => (
    <TodoSection
      view={todosView}
      failed={failed.todos && !data.todos}
      ctx={ctx}
      p={p}
    />
  );

  const nestSection = (p: string, desktop: boolean) =>
    lens === "io" ? (
      <NelNestSection
        events={eventsView}
        house={houseView}
        failed={failed.house && !data.house}
        ctx={ctx}
        p={p}
      />
    ) : (
      <CasaSection
        counters={counters}
        failed={failed.house && !data.house}
        at={oggi.houseAt}
        desktop={desktop}
        ctx={ctx}
        p={p}
      />
    );

  return (
    <main
      id="contenuto"
      tabIndex={-1}
      ref={rootRef}
      className="pagina pagina-desktop"
      onFocus={trackFocus}
    >
      <div className="colonna oggi-solo-mobile">
        {header}
        {offlineAlert}
        {ready ? (
          <>
            {starterOrSummary("m-")}
            {eventsBlock("m-", false)}
            {todoSection("m-")}
            {nestSection("m-", false)}
            <SpacesSection view={spacesView} p="m-" />
          </>
        ) : (
          <LoadingBody desktop={false} />
        )}
      </div>

      <div className="colonne oggi-solo-desktop">
        <div className="colonna">
          <div className="intestazione-desktop">
            {header}
            <Lens />
          </div>
          {offlineAlert}
          {ready ? <QuickAdd /> : null}
          {ready ? (
            <>
              {starterOrSummary("d-")}
              {eventsBlock("d-", true)}
              {nestSection("d-", true)}
              {eventsView && !summary ? (
                <DomaniSection view={eventsView} ctx={ctx} p="d-" columns />
              ) : null}
            </>
          ) : (
            <LoadingBody desktop />
          )}
        </div>
        <div className="colonna">
          {ready ? (
            <>
              {eventsView && summary ? (
                <DomaniSection
                  view={eventsView}
                  ctx={ctx}
                  p="d-"
                  columns={false}
                />
              ) : null}
              {todoSection("d-")}
              {eventsView ? (
                <WeekSection view={eventsView} ctx={ctx} p="d-" />
              ) : null}
              <SpacesSection view={spacesView} p="d-" />
            </>
          ) : (
            <LoadingSide />
          )}
        </div>
      </div>
    </main>
  );
}

/** Oggi (`/oggi`): the home of the Nest. */
export function OggiPage() {
  const nowMs = useNowMinute();
  if (nowMs === 0) return <Waiting />;
  return <OggiContent nowMs={nowMs} />;
}
