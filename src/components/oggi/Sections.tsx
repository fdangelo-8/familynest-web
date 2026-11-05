import Link from "next/link";
import type { ReactNode } from "react";
import { People } from "@/components/calendario/Rows";
import { SourceLabel } from "@/components/calendario/SourceLabel";
import {
  MAX_AVATARS,
  endInDay,
  eventInfo,
  eveningOthers,
  participantsInNestOrder,
  peopleTag,
  startInDay,
  type KeyedEvent,
  type KeyedFullEvent,
  type Member,
} from "@/components/calendario/model";
import { Alert } from "@/components/ui/Alert/Alert";
import { Avatar } from "@/components/ui/Avatar/Avatar";
import { Button } from "@/components/ui/Button/Button";
import { Checkbox } from "@/components/ui/Checkbox/Checkbox";
import { cx } from "@/components/ui/cx";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { Icon } from "@/components/ui/Icon/Icon";
import { Skeleton } from "@/components/ui/Skeleton/Skeleton";
import { Tag } from "@/components/ui/Tag/Tag";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import {
  BUSY_TITLE,
  formatBusyAccessibleName,
  formatFreeEveningRow,
  type FreeEvening,
} from "@/lib/calendar";
import {
  formatDayNumber,
  formatTime,
  formatTimeUntil,
  getWeekStartKey,
  howMuch,
  type CalendarDay,
} from "@/lib/datetime";
import { eventHref } from "@/lib/household-events";
import type { Lens } from "@/lib/lens";
import {
  adultsOf,
  atInfo,
  doneLabel,
  untilInfo,
  weekDayLabel,
  weekRowInfo,
  type DopoRow,
  type EventsView,
  type HouseView,
  type SpacesView,
  type StarterView,
  type SummaryView,
  type TodosView,
  type WeekRow,
} from "./model";

/**
 * The sections of Oggi (#30). Presentational: the page passes the views and
 * the callbacks. Every section takes a prefix (`m-` for the layout below
 * 1024 px, `d-` for the one from 1024 px) so the two layouts that sit in the
 * page never repeat an `id`.
 */

export type Ctx = {
  nowMs: number;
  lens: Lens;
  members: readonly Member[];
  meId: string;
  /** Rows of «Già fatti» are open (the same for both layouts) */
  doneOpen: boolean;
  onToggleDone: () => void;
  onToggleTodo: (id: string) => void;
  onRetry: () => void;
  retrying: boolean;
};

/* ---------- Pieces ---------- */

function Head({
  id,
  title,
  info,
  heading,
}: {
  id: string;
  title: string;
  info?: ReactNode;
  /** The title takes the focus when the last row below it leaves */
  heading?: boolean;
}) {
  return (
    <div className="sezione__testa">
      <h2
        className="sezione__titolo"
        id={id}
        tabIndex={heading ? -1 : undefined}
        data-focus={heading ? "todo-heading" : undefined}
      >
        {title}
      </h2>
      {info}
    </div>
  );
}

function Info({ children }: { children: ReactNode }) {
  return <span className="sezione__info">{children}</span>;
}

/** Error of one part, under the head of its section. */
function PartError({
  text,
  ctx,
}: {
  text: string;
  ctx: Pick<Ctx, "onRetry" | "retrying">;
}) {
  return (
    <Alert
      variant="errore"
      icon="wifi-off"
      action={
        <Button variant="link" loading={ctx.retrying} onClick={ctx.onRetry}>
          Riprova
        </Button>
      }
    >
      {text}
    </Alert>
  );
}

/** Avatars that only decorate a row whose text already names the people. */
function HiddenPeople({
  people,
  members,
}: {
  people: readonly Member[];
  members: readonly Member[];
}) {
  if (people.length === 0) return null;
  if (people.length > MAX_AVATARS) {
    return <Tag>{peopleTag(people, members)}</Tag>;
  }
  return (
    <span className="avatar-gruppo" aria-hidden="true">
      {people.map((member) => (
        <Avatar
          key={member.id}
          name={member.name}
          color={member.color}
          nameShown
        />
      ))}
    </span>
  );
}

/* ---------- Header and alerts ---------- */

export function OfflineAlert({
  at,
  retrying,
  onRetry,
}: {
  /** Epoch ms of the last reading that worked */
  at: number;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <div data-oggi-offline="">
      <Alert
        variant="errore"
        icon="wifi-off"
        action={
          <Button variant="link" loading={retrying} onClick={onRetry}>
            Riprova
          </Button>
        }
      >
        Sei offline. Vedi le cose aggiornate alle {formatTime(at)}; le modifiche
        partiranno appena torna la connessione.
      </Alert>
    </div>
  );
}

export function QuickAdd() {
  return (
    <Link href="/aggiungi" className="campo-rapido" aria-keyshortcuts="n">
      <span className="campo-rapido__piu">
        <Icon name="plus" />
      </span>
      {/* Not `.campo-rapido__input`: that class stretches to the height of a real
          field (`align-self: stretch`) and the text of a span would stay on top. */}
      <span className="t-secondario">
        Aggiungi un impegno, una spesa o una cosa da fare. Es. «nuoto Sofia
        giovedì alle 17»
      </span>
      <kbd className="kbd" aria-hidden="true">
        N
      </kbd>
    </Link>
  );
}

/* ---------- Event rows ---------- */

function OccupatoRow({
  event,
  members,
  day,
  past,
}: {
  event: KeyedEvent & { masked: true };
  members: readonly Member[];
  day: CalendarDay;
  past?: boolean;
}) {
  const author = members.find((member) => member.id === event.authorMemberId);
  const name = author?.name ?? "";
  const start = startInDay(event, day);
  return (
    <div
      className={cx(
        "riga-evento",
        "riga-evento--occupato",
        past && "riga-evento--passato",
      )}
      role="group"
      aria-label={formatBusyAccessibleName(name, start, endInDay(event, day))}
    >
      <span className="riga-evento__ora">{formatTime(start)}</span>
      <span className="riga-evento__testo">
        <span className="riga-evento__titolo">{BUSY_TITLE}</span>
        <span className="riga-evento__info">{name}</span>
      </span>
      {author ? (
        <span className="avatar-gruppo" aria-hidden="true">
          <Avatar name={author.name} color={author.color} nameShown />
        </span>
      ) : null}
    </div>
  );
}

function EventRow({
  event,
  members,
  day,
  info,
  past,
}: {
  event: KeyedFullEvent;
  members: readonly Member[];
  day: CalendarDay;
  info: string;
  past?: boolean;
}) {
  return (
    <Link
      href={eventHref(event.id, event.startsAt)}
      className={cx("riga-evento", past && "riga-evento--passato")}
      data-event-key={event.key}
    >
      <span className="riga-evento__ora">
        {formatTime(startInDay(event, day))}
      </span>
      <span className="riga-evento__testo">
        <span className="riga-evento__titolo">{event.title}</span>
        {info || event.sourceLabel ? (
          <span className="riga-evento__info">
            <SourceLabel label={event.sourceLabel} />
            {info}
          </span>
        ) : null}
      </span>
      <People
        people={participantsInNestOrder(event, members)}
        members={members}
      />
    </Link>
  );
}

function InsiemeRow({
  evening,
  members,
  meId,
}: {
  evening: FreeEvening;
  members: readonly Member[];
  meId: string;
}) {
  const adults = adultsOf(members);
  return (
    <Link
      href={`/calendario?settimana=${getWeekStartKey(evening.dayKey)}`}
      className="riga-evento riga-evento--insieme"
    >
      <span className="riga-evento__ora">{formatTime(evening.start)}</span>
      <span className="riga-evento__testo">
        <span className="riga-evento__titolo">Liberi insieme</span>
        <span className="riga-evento__info">
          {formatFreeEveningRow(evening, eveningOthers(adults, meId))}
        </span>
      </span>
      <People people={adults} members={members} />
    </Link>
  );
}

/* ---------- Prossimo, Dopo ---------- */

export function ProssimoSection({
  view,
  ctx,
  p,
}: {
  view: EventsView;
  ctx: Ctx;
  p: string;
}) {
  const event = view.prossimo;
  if (!event) return null;
  const until = formatTimeUntil(event.startsAt, ctx.nowMs);
  // The note speaks only of my own events (the others see them as they are).
  const mine = event.authorMemberId === ctx.meId;
  const visibility =
    mine && event.visibility === "busy" ? (
      <span className="riga-evento__info">
        <Icon name="eye-off" size="s" />
        Gli altri vedono «occupato»
      </span>
    ) : mine && event.visibility === "private" ? (
      <span className="riga-evento__info">
        <Icon name="lock" size="s" />
        Lo vedi solo tu
      </span>
    ) : null;

  return (
    <section className="sezione" aria-labelledby={`${p}prossimo-t`}>
      <Head
        id={`${p}prossimo-t`}
        title="Prossimo"
        info={until ? <Info>{until}</Info> : null}
      />
      <Link
        href={eventHref(event.id, event.startsAt)}
        className="scheda scheda--evidenza prossimo"
        data-event-key={event.key}
      >
        <span className="prossimo__alto">
          <span className="prossimo__ora">{formatTime(event.startsAt)}</span>
          <span className="prossimo__dati">
            <span className="prossimo__titolo">{event.title}</span>
            <span className="prossimo__info">
              {untilInfo(event, ctx.members, view.today, false, false)}
            </span>
          </span>
        </span>
        {visibility || event.sourceLabel ? (
          <p className="prossimo__nota">
            {/* The label of the source is on the left, the visibility on the right */}
            {event.sourceLabel ? (
              <SourceLabel label={event.sourceLabel} />
            ) : (
              <span aria-hidden="true" />
            )}
            {visibility}
          </p>
        ) : null}
      </Link>
    </section>
  );
}

function DopoItem({
  row,
  view,
  ctx,
}: {
  row: DopoRow;
  view: EventsView;
  ctx: Ctx;
}) {
  if (row.kind === "insieme") {
    return (
      <InsiemeRow evening={row.evening} members={ctx.members} meId={ctx.meId} />
    );
  }
  if (row.event.masked) {
    return (
      <OccupatoRow event={row.event} members={ctx.members} day={view.today} />
    );
  }
  const event = row.event as KeyedFullEvent;
  return (
    <EventRow
      event={event}
      members={ctx.members}
      day={view.today}
      info={untilInfo(event, ctx.members, view.today, row.inProgress)}
    />
  );
}

export function DopoSection({
  view,
  ctx,
  p,
}: {
  view: EventsView;
  ctx: Ctx;
  p: string;
}) {
  if (view.dopo.length === 0 && view.finished.length === 0) return null;
  const titles = view.finished.map((event) =>
    event.masked ? BUSY_TITLE : event.title,
  );
  return (
    <section className="sezione" aria-labelledby={`${p}dopo-t`}>
      <Head
        id={`${p}dopo-t`}
        title="Dopo"
        info={view.dopoInfo ? <Info>{view.dopoInfo}</Info> : null}
      />
      <div className="sezione">
        {view.dopo.map((row) => (
          <DopoItem key={row.key} row={row} view={view} ctx={ctx} />
        ))}
        {view.finished.length > 0 ? (
          <>
            <button
              type="button"
              className="riga-gia-fatti"
              aria-expanded={ctx.doneOpen}
              aria-controls={`${p}gia-fatti`}
              onClick={ctx.onToggleDone}
            >
              <Icon name="check" size="s" />
              <span>{doneLabel(titles)}</span>
              <Icon name="chevron-down" size="s" />
            </button>
            <div id={`${p}gia-fatti`} hidden={!ctx.doneOpen}>
              <div className="sezione">
                {view.finished.map((event) =>
                  event.masked ? (
                    <OccupatoRow
                      key={event.key}
                      event={event}
                      members={ctx.members}
                      day={view.today}
                      past
                    />
                  ) : (
                    <EventRow
                      key={event.key}
                      event={event as KeyedFullEvent}
                      members={ctx.members}
                      day={view.today}
                      info={untilInfo(
                        event as KeyedFullEvent,
                        ctx.members,
                        view.today,
                      )}
                      past
                    />
                  ),
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
      {view.allDone ? (
        <EmptyState
          icon="calendar"
          title="Per oggi è tutto"
          text="Il resto della settimana è nel"
          actions={<Link href="/calendario">calendario</Link>}
          after="."
        />
      ) : null}
    </section>
  );
}

/** «Oggi» when the lens has nothing today and nothing tomorrow. */
export function TodayEmptySection({
  p,
  askForCalendar,
}: {
  p: string;
  /** The person has no linked calendar: the text invites to link one */
  askForCalendar: boolean;
}) {
  return (
    <section className="sezione" aria-labelledby={`${p}oggi-t`}>
      <Head id={`${p}oggi-t`} title="Oggi" />
      <EmptyState
        icon="calendar"
        title="Giornata libera, per ora"
        text={askForCalendar ? "Collega il calendario o" : ""}
        actions={
          <Link href="/aggiungi">
            {askForCalendar ? "aggiungi un impegno" : "Aggiungi un impegno"}
          </Link>
        }
        after={askForCalendar ? "." : " e lo vedi qui."}
      />
    </section>
  );
}

/** The events could not be read: one notice, where «Prossimo» and «Dopo» would be. */
export function EventsErrorSection({ ctx, p }: { ctx: Ctx; p: string }) {
  return (
    <section className="sezione" aria-labelledby={`${p}oggi-t`}>
      <Head id={`${p}oggi-t`} title="Oggi" />
      <PartError
        text="Non riusciamo a caricare gli impegni. Controlla la connessione e riprova."
        ctx={ctx}
      />
    </section>
  );
}

/* ---------- Domani ---------- */

export function DomaniSection({
  view,
  ctx,
  p,
  columns,
}: {
  view: EventsView;
  ctx: Ctx;
  p: string;
  /** Two rows side by side (desktop); one under the other otherwise */
  columns: boolean;
}) {
  if (view.tomorrowEvents.length === 0) return null;
  return (
    <section className="sezione" aria-labelledby={`${p}domani-t`}>
      <Head
        id={`${p}domani-t`}
        title="Domani"
        info={
          <Info>
            {formatDayNumber(view.tomorrow.start, { capitalized: false })}
          </Info>
        }
      />
      <div className={columns ? "colonne colonne--due" : "sezione"}>
        {view.tomorrowEvents.map((event) => (
          <EventRow
            key={event.key}
            event={event as KeyedFullEvent}
            members={ctx.members}
            day={view.tomorrow}
            info={eventInfo(event as KeyedFullEvent, ctx.members, ctx.meId)}
          />
        ))}
      </div>
    </section>
  );
}

/* ---------- Questa settimana ---------- */

function WeekItem({ row, ctx }: { row: WeekRow; ctx: Ctx }) {
  const people =
    row.kind === "insieme"
      ? adultsOf(ctx.members)
      : participantsInNestOrder(row.event, ctx.members);
  return (
    <li>
      <Link
        href={`/calendario?settimana=${getWeekStartKey(row.dayKey)}`}
        className="riga-lista riga-lista--cliccabile"
      >
        <span className="riga-lista__ora">{weekDayLabel(row.dayKey)}</span>
        <span className="riga-lista__testo">
          <span className="riga-lista__titolo">
            {row.kind === "insieme" ? "Liberi insieme" : row.event.title}
          </span>
          <span className="riga-lista__info">
            {row.kind === "event" && row.event.sourceLabel ? (
              <>
                <SourceLabel label={row.event.sourceLabel} />{" "}
              </>
            ) : null}
            {weekRowInfo(row, ctx.members, ctx.meId)}
          </span>
        </span>
        <People people={people} members={ctx.members} />
      </Link>
    </li>
  );
}

export function WeekSection({
  view,
  ctx,
  p,
}: {
  view: EventsView;
  ctx: Ctx;
  p: string;
}) {
  const { week } = view;
  return (
    <section className="sezione" aria-labelledby={`${p}settimana-t`}>
      <Head
        id={`${p}settimana-t`}
        title={week.title}
        info={<Info>{week.range}</Info>}
      />
      {week.rows.length === 0 ? (
        <EmptyState
          icon="calendar-range"
          title="Ancora niente in programma"
          text="Gli impegni che aggiungi o che arrivano dal calendario compaiono qui."
          actions={null}
        />
      ) : (
        <ul className="scheda lista">
          {week.rows.map((row) => (
            <WeekItem key={row.key} row={row} ctx={ctx} />
          ))}
          {week.more > 0 ? (
            <li>
              <Link
                href="/calendario"
                className="riga-lista riga-lista--cliccabile riga-lista--senza-inizio"
              >
                <span className="riga-lista__testo">
                  <span className="riga-lista__titolo">
                    {week.more === 1
                      ? "Altro 1 impegno nel calendario"
                      : `Altri ${week.more} impegni nel calendario`}
                  </span>
                </span>
                <span className="riga-lista__valore">
                  <Icon name="chevron-right" />
                </span>
              </Link>
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

/* ---------- Things to do ---------- */

export function TodoSection({
  view,
  failed,
  ctx,
  p,
}: {
  view: TodosView | null;
  /** The things to do could not be read and have never been */
  failed: boolean;
  ctx: Ctx;
  p: string;
}) {
  const title = ctx.lens === "io" ? "Le mie cose" : "Da fare in casa";
  if (failed) {
    return (
      <section className="sezione" aria-labelledby={`${p}todo-t`}>
        <Head id={`${p}todo-t`} title={title} heading />
        <PartError
          text="Non riusciamo a caricare le cose da fare. Controlla la connessione e riprova."
          ctx={ctx}
        />
      </section>
    );
  }
  if (!view || view.rows.length === 0) return null;
  const count =
    ctx.lens === "io"
      ? `${view.open} da fare`
      : view.open === 1
        ? "1 aperto"
        : `${view.open} aperti`;
  return (
    <section className="sezione" aria-labelledby={`${p}todo-t`}>
      <Head
        id={`${p}todo-t`}
        title={title}
        info={<Info>{count}</Info>}
        heading
      />
      <ul className="scheda lista">
        {view.rows.map((row) => (
          <li
            key={row.todo.id}
            data-todo-id={row.todo.id}
            className={cx("riga-lista", row.barred && "riga-lista--fatto")}
          >
            <Checkbox
              variant="square"
              checked={row.barred}
              onChange={() => ctx.onToggleTodo(row.todo.id)}
              aria-label={`Segna come fatto: ${row.todo.title}`}
            />
            <span className="riga-lista__testo">
              <span className="riga-lista__titolo">{row.todo.title}</span>
              {row.info ? (
                <span
                  className={cx(
                    "riga-lista__info",
                    row.info.urgent && "riga-lista__info--allerta",
                  )}
                >
                  {row.info.text}
                </span>
              ) : null}
            </span>
            {ctx.lens === "io" && row.todo.isPrivate ? (
              <span className="riga-lista__lucchetto">
                <Icon name="lock" size="s" />
                <VisuallyHidden>Visibile solo a te</VisuallyHidden>
              </span>
            ) : row.assignee ? (
              <Avatar name={row.assignee.name} color={row.assignee.color} />
            ) : null}
          </li>
        ))}
        {view.more > 0 ? (
          <li>
            <Link
              href="/casa/da-fare"
              className="riga-lista riga-lista--cliccabile riga-lista--senza-inizio"
            >
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">
                  {view.more === 1
                    ? "Altro 1 da fare"
                    : `Altri ${view.more} da fare`}
                </span>
              </span>
              <span className="riga-lista__valore">
                <Icon name="chevron-right" />
              </span>
            </Link>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

/* ---------- Nel Nest, Casa ---------- */

export function NelNestSection({
  events,
  house,
  failed,
  ctx,
  p,
}: {
  events: EventsView | null;
  house: HouseView | null;
  failed: boolean;
  ctx: Ctx;
  p: string;
}) {
  if (failed) {
    return (
      <section className="sezione" aria-labelledby={`${p}nest-t`}>
        <Head id={`${p}nest-t`} title="Nel Nest" />
        <PartError
          text="Non riusciamo a caricare i numeri della casa. Controlla la connessione e riprova."
          ctx={ctx}
        />
      </section>
    );
  }
  const others = events?.othersToday ?? [];
  const shopping = house && house.shoppingCount > 0 ? house : null;
  const deadline = house?.nestDeadline ?? null;
  if (others.length === 0 && !shopping && !deadline) return null;
  const day = events?.today;
  return (
    <section className="sezione" aria-labelledby={`${p}nest-t`}>
      <Head id={`${p}nest-t`} title="Nel Nest" info={<Info>oggi</Info>} />
      <ul className="scheda lista">
        {day
          ? others.map((event) => (
              <li key={event.key}>
                <Link
                  href={eventHref(event.id, event.startsAt)}
                  className="riga-lista riga-lista--cliccabile"
                >
                  <span className="riga-lista__ora">
                    {formatTime(startInDay(event, day))}
                  </span>
                  <span className="riga-lista__testo">
                    <span className="riga-lista__titolo">{event.title}</span>
                    <span className="riga-lista__info">
                      {atInfo(event, ctx.members, day)}
                    </span>
                  </span>
                  <HiddenPeople
                    people={participantsInNestOrder(event, ctx.members)}
                    members={ctx.members}
                  />
                </Link>
              </li>
            ))
          : null}
        {shopping ? (
          <li>
            <Link
              href="/casa/spesa"
              className="riga-lista riga-lista--cliccabile"
            >
              <span className="riga-lista__ora">{shopping.shoppingCount}</span>
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">
                  {shopping.shoppingCount === 1
                    ? "Cosa da comprare"
                    : "Cose da comprare"}
                </span>
                <span className="riga-lista__info">
                  {shopping.shoppingInfo}
                </span>
              </span>
              <span className="riga-lista__valore">
                <Icon name="chevron-right" />
              </span>
            </Link>
          </li>
        ) : null}
        {deadline ? (
          <li>
            <Link
              href="/casa/scadenze"
              className="riga-lista riga-lista--cliccabile"
            >
              <span className="riga-lista__ora">{deadline.days}</span>
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">
                  {deadline.deadline.title}
                </span>
                <span className="riga-lista__info">
                  {deadline.days === 0
                    ? "Scade oggi"
                    : deadline.days === 1
                      ? "Scade domani"
                      : `Scade tra ${deadline.days} giorni`}
                  {deadline.urgent ? (
                    <VisuallyHidden>, urgente</VisuallyHidden>
                  ) : null}
                </span>
              </span>
              {deadline.urgent ? (
                <span className="pallino-urgente" aria-hidden="true" />
              ) : null}
            </Link>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

export type CounterData = {
  shoppingCount: number;
  shoppingInfo: string;
  /** The nearest shared deadlines, nearest first (at most two are shown) */
  deadlines: HouseView["shared"];
  /** Shared things still to do, with the line of the counter; null if unknown */
  todos: { count: number; info: string } | null;
};

export function CasaSection({
  counters,
  failed,
  at,
  desktop,
  ctx,
  p,
}: {
  counters: CounterData | null;
  failed: boolean;
  /** Epoch ms of the last reading of the numbers of the house */
  at: number;
  desktop: boolean;
  ctx: Ctx;
  p: string;
}) {
  if (failed || !counters) {
    return (
      <section className="sezione" aria-labelledby={`${p}casa-t`}>
        <Head id={`${p}casa-t`} title="Casa" />
        {failed ? (
          <PartError
            text="Non riusciamo a caricare i numeri della casa. Controlla la connessione e riprova."
            ctx={ctx}
          />
        ) : null}
      </section>
    );
  }

  const cards: ReactNode[] = [];
  cards.push(
    <Link key="spesa" href="/casa/spesa" className="scheda contatore">
      <span className="contatore__etichetta">Spesa</span>
      <span className="contatore__numero">
        {counters.shoppingCount}
        <VisuallyHidden>
          {counters.shoppingCount === 1
            ? " cosa da comprare:"
            : " cose da comprare:"}
        </VisuallyHidden>
      </span>
      <span className="contatore__info">
        {counters.shoppingCount > 0
          ? counters.shoppingInfo
          : "La lista è vuota"}
      </span>
    </Link>,
  );

  const deadlineCard = (
    view: HouseView["shared"][number] | undefined,
    key: string,
  ) => {
    if (!view) {
      return (
        <Link key={key} href="/casa/scadenze" className="scheda contatore">
          <span className="contatore__etichetta">Scadenza</span>
          <span />
          <span className="contatore__info">Nessuna scadenza in arrivo</span>
        </Link>
      );
    }
    return (
      <Link key={key} href="/casa/scadenze" className="scheda contatore">
        <span className="contatore__etichetta">Scadenza</span>
        <span className="contatore__numero">
          {howMuch(view.days).number}
          {view.urgent ? (
            <span className="pallino-urgente" aria-hidden="true" />
          ) : null}
        </span>
        <span className="contatore__info">
          {deadlineInfo(view)}
          {view.urgent ? <VisuallyHidden>, urgente</VisuallyHidden> : null}
        </span>
      </Link>
    );
  };
  cards.push(deadlineCard(counters.deadlines[0], "scadenza"));

  if (desktop) {
    if (counters.todos) {
      cards.push(
        <Link key="da-fare" href="/casa/da-fare" className="scheda contatore">
          <span className="contatore__etichetta">Da fare</span>
          <span className="contatore__numero">
            {counters.todos.count}
            <VisuallyHidden> da fare in casa:</VisuallyHidden>
          </span>
          <span className="contatore__info">{counters.todos.info}</span>
        </Link>,
      );
    }
    if (counters.deadlines[1]) {
      cards.push(deadlineCard(counters.deadlines[1], "scadenza-2"));
    }
  }

  return (
    <section className="sezione" aria-labelledby={`${p}casa-t`}>
      <Head
        id={`${p}casa-t`}
        title="Casa"
        info={at > 0 ? <Info>aggiornata alle {formatTime(at)}</Info> : null}
      />
      <div
        className={cx(
          "griglia-contatori",
          desktop && cards.length >= 4 && "griglia-contatori--quattro",
          desktop && cards.length === 3 && "griglia-contatori--tre",
        )}
      >
        {cards}
      </div>
    </section>
  );
}

function deadlineInfo(view: HouseView["shared"][number]): string {
  const title = `«${view.deadline.title}»`;
  const { unit } = howMuch(view.days);
  return unit === null ? `Oggi: ${title}` : `${unit} a ${title}`;
}

/* ---------- I tuoi spazi ---------- */

export function SpacesSection({
  view,
  p,
}: {
  view: SpacesView | null;
  p: string;
}) {
  if (!view) return null;
  return (
    <section className="sezione" aria-labelledby={`${p}spazi-t`}>
      <Head
        id={`${p}spazi-t`}
        title="I tuoi spazi"
        info={
          <Link
            href="/esplora"
            className="sezione__info sezione__link"
            aria-label="Modifica i tuoi spazi"
          >
            Modifica
          </Link>
        }
      />
      <ul className="spazi-fissati">
        {view.spaces.map((space) => (
          <li key={space.key}>
            <Link href={space.href} className="scheda scheda-spazio">
              <span className="scheda-spazio__icona">
                <Icon name={space.icon} />
              </span>
              <span>
                <span className="scheda-spazio__titolo">{space.name}</span>
                <span className="scheda-spazio__info">In arrivo</span>
              </span>
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="/esplora"
            className="scheda scheda--tratteggiata scheda-spazio"
          >
            <span className="scheda-spazio__icona">
              <Icon name="compass" />
            </span>
            <span>
              <span className="scheda-spazio__titolo">Esplora</span>
              {view.others > 0 ? (
                <span className="scheda-spazio__info">
                  {view.others === 1
                    ? "Altro 1 spazio"
                    : `Altri ${view.others} spazi`}
                </span>
              ) : null}
            </span>
          </Link>
        </li>
      </ul>
    </section>
  );
}

/* ---------- Starter list, summary ---------- */

export function StarterList({ view, p }: { view: StarterView; p: string }) {
  return (
    <section
      className="scheda scheda--evidenza lista-partenza"
      aria-labelledby={`${p}lp-t`}
    >
      <p className="lista-partenza__sopra">
        <span>Per cominciare</span>
        <span>
          {view.doneCount} di {view.steps.length}
        </span>
      </p>
      <h2 className="lista-partenza__titolo t-titolo-scheda" id={`${p}lp-t`}>
        {view.title}
      </h2>
      <ul className="lista-partenza__passi">
        {view.steps.map((step) => {
          const classes = cx("passo-partenza", step.done && "is-fatto");
          const circle = (
            <span className="passo-partenza__cerchio">
              {step.done ? <Icon name="check" size="s" /> : null}
            </span>
          );
          const text = (
            <span className="passo-partenza__testo">
              {step.text}
              <VisuallyHidden>
                {step.done ? ", fatto" : ", da fare"}
              </VisuallyHidden>
            </span>
          );
          return (
            <li key={step.key}>
              {step.href ? (
                <Link href={step.href} className={classes}>
                  {circle}
                  {text}
                  <Icon name="chevron-right" />
                </Link>
              ) : (
                <div className={classes}>
                  {circle}
                  {text}
                  {step.tag ? <Tag>{step.tag}</Tag> : <span />}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Word({
  children,
  insieme,
}: {
  children: ReactNode;
  insieme?: boolean;
}) {
  return (
    <span className={cx("parola", insieme && "parola--insieme")}>
      {children}
    </span>
  );
}

export function Summary({
  view,
  inviter,
  askForCalendar,
}: {
  view: SummaryView;
  /** Who sent the invitation; null if that person left the Nest */
  inviter: string | null;
  /** The person has no linked calendar: a second button leads to the page */
  askForCalendar: boolean;
}) {
  const hasShopping = view.shopping > 0;

  const eventPart = view.event ? (
    <>
      {view.event.when} c&apos;è <Word>{view.event.title}</Word> alle{" "}
      {view.event.time}
    </>
  ) : null;
  // With the event before it, the sentence goes on in lower case.
  const lead = view.shopping === 1 ? "manca" : "mancano";
  const shoppingPart = hasShopping ? (
    <>
      {eventPart ? lead : lead.charAt(0).toUpperCase() + lead.slice(1)}{" "}
      <Word>{view.shopping === 1 ? "1 cosa" : `${view.shopping} cose`}</Word>{" "}
      dalla spesa
    </>
  ) : null;

  const nothing = !eventPart && !shoppingPart && view.free === null;
  return (
    <section
      className="scheda scheda--evidenza sintesi"
      aria-label="La casa in una frase"
    >
      <p className="sintesi__sopra">
        {inviter ? <span>Da {inviter}</span> : <span />}
        <span>Sintesi</span>
      </p>
      <p className="sintesi__frase">
        {nothing ? (
          "Per ora la casa è tranquilla: niente in programma e niente da comprare."
        ) : (
          <>
            {eventPart}
            {eventPart && shoppingPart ? " e " : null}
            {shoppingPart}
            {eventPart || shoppingPart ? "." : null}
            {(eventPart || shoppingPart) && view.free ? " " : null}
            {view.free ? (
              <>
                {view.free} siete <Word insieme>liberi insieme</Word>.
              </>
            ) : null}
          </>
        )}
      </p>
      <div className="sintesi__azioni">
        <Button href="/calendario" small>
          Vedi la settimana
        </Button>
        {askForCalendar ? (
          <Button href="/calendari-collegati" variant="secondary" small>
            Collega il calendario
          </Button>
        ) : null}
      </div>
    </section>
  );
}

/* ---------- Loading ---------- */

export function LoadingBody({ desktop }: { desktop: boolean }) {
  if (!desktop) {
    return (
      <div aria-busy="true" aria-live="polite">
        <VisuallyHidden>Caricamento in corso</VisuallyHidden>
        <div className="gruppo-skeleton" aria-hidden="true">
          <Skeleton shape="testo-corto" />
          <Skeleton shape="grande" />
        </div>
        <div className="gruppo-skeleton" aria-hidden="true">
          <Skeleton shape="testo-corto" />
          <Skeleton shape="riga" />
          <Skeleton shape="riga" />
        </div>
        <div className="gruppo-skeleton" aria-hidden="true">
          <Skeleton shape="scheda" />
        </div>
      </div>
    );
  }
  return (
    <div aria-busy="true" aria-live="polite">
      <VisuallyHidden>Caricamento in corso</VisuallyHidden>
      <div className="gruppo-skeleton" aria-hidden="true">
        <Skeleton shape="riga" />
      </div>
      <div className="colonne colonne--due">
        <div className="gruppo-skeleton" aria-hidden="true">
          <Skeleton shape="grande" />
        </div>
        <div className="gruppo-skeleton" aria-hidden="true">
          <Skeleton shape="riga" />
          <Skeleton shape="riga" />
          <Skeleton shape="riga" />
        </div>
      </div>
      <div className="gruppo-skeleton" aria-hidden="true">
        <Skeleton shape="scheda" />
      </div>
    </div>
  );
}

export function LoadingSide() {
  return (
    <div aria-busy="true">
      <div className="gruppo-skeleton" aria-hidden="true">
        <Skeleton shape="testo-corto" />
        <Skeleton shape="riga" />
        <Skeleton shape="riga" />
      </div>
      <div className="gruppo-skeleton" aria-hidden="true">
        <Skeleton shape="testo-corto" />
        <Skeleton shape="riga" />
        <Skeleton shape="riga" />
        <Skeleton shape="riga" />
      </div>
    </div>
  );
}
