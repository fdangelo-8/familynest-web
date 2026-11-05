"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert/Alert";
import { BarAction } from "@/components/ui/AppFrame/BarAction";
import { Avatar } from "@/components/ui/Avatar/Avatar";
import { Button } from "@/components/ui/Button/Button";
import { Chip } from "@/components/ui/Chip/Chip";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { Icon } from "@/components/ui/Icon/Icon";
import { ListRow } from "@/components/ui/List/List";
import { PageError } from "@/components/ui/PageError/PageError";
import { useToast } from "@/components/ui/Toast/ToastProvider";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import { formatShortWeekday, formatTime } from "@/lib/datetime";
import { eventHref, type FullEvent } from "@/lib/household-events";
import { ChildSheet, type SheetFocus } from "./ChildSheet";
import { ChildSkeleton } from "./ChildSkeleton";
import {
  birthdayCounter,
  deadlineCounter,
  eventInfo,
  eventsCounter,
  headSubtitle,
  isProfileEmpty,
  schoolView,
  sizesView,
  upcomingEvents,
  type ChildData,
  type CounterView,
  type SchoolView,
  type SizesView,
} from "./model";
import {
  saveChildProfile,
  type ChildProfileValues,
  type SaveResult,
} from "./save";
import { useChildProfile } from "./useChildProfile";

type OpenSheet = (focus: SheetFocus) => void;

/**
 * Profilo di un figlio (#31). The server has only checked that the address is
 * a child of the Nest; the data is read here, in the browser, so the page has
 * its own loading and error states and the HTML carries nothing of the child.
 */
export function ChildPage({
  childId,
  childName,
}: {
  childId: string;
  /** For the name of the pencil while the page loads */
  childName: string;
}) {
  const profile = useChildProfile(childId);
  const { showToast } = useToast();
  const [sheet, setSheet] = useState<{ focus: SheetFocus } | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const retriedPage = useRef(false);
  const wasOpen = useRef(false);

  const { status, data } = profile;
  const ready = status === "ready" && data !== null;
  const name = data?.child.name ?? childName;

  const focusHeading = useCallback(() => {
    mainRef.current?.querySelector<HTMLElement>("h1")?.focus();
  }, []);

  // After a «Riprova» of the page error that worked, the focus goes to the name.
  useEffect(() => {
    if (ready && retriedPage.current) {
      retriedPage.current = false;
      focusHeading();
    }
  }, [ready, focusHeading]);

  // The sheet has left. The sheet gives the focus back to what opened it; if
  // that is gone (the button of the empty state) the focus goes to the name.
  useEffect(() => {
    const isOpen = sheet !== null;
    if (wasOpen.current && !isOpen) {
      if (
        document.activeElement === null ||
        document.activeElement === document.body
      ) {
        focusHeading();
      }
    }
    wasOpen.current = isOpen;
  }, [sheet, focusHeading]);

  const openSheet: OpenSheet = (focus) => setSheet({ focus });

  const handleSave = async (
    values: ChildProfileValues,
  ): Promise<SaveResult> => {
    const result = await saveChildProfile(childId, values);
    if (!result.ok) return result;
    // The page shows the new values at once; a failed reading leaves the
    // «offline» notice, the save itself worked.
    await profile.reload();
    showToast({ text: "Modifiche salvate" });
    return result;
  };

  const handleOfflineRetry = async () => {
    const hadFocus = alertRef.current?.contains(document.activeElement);
    const ok = await profile.retry();
    if (ok && hadFocus) focusHeading();
  };

  return (
    <main
      ref={mainRef}
      id="contenuto"
      tabIndex={-1}
      className="pagina pagina-desktop"
    >
      {status === "loading" || ready ? (
        <BarAction
          icon="pencil"
          label={`Modifica il profilo di ${name}`}
          inactive={!ready}
          onClick={() => openSheet("name")}
        />
      ) : null}

      {status === "loading" ? <ChildSkeleton /> : null}

      {status === "error" ? (
        <PageError
          headingLevel={1}
          retrying={profile.retrying}
          onRetry={() => {
            retriedPage.current = true;
            void profile.retry();
          }}
          exit={{ label: "Torna a Oggi", href: "/oggi" }}
        />
      ) : null}

      {status === "missing" ? (
        <PageError
          headingLevel={1}
          title="Questa pagina non c’è"
          text="Il link potrebbe essere vecchio o scritto male."
          action={{ label: "Torna a Oggi", href: "/oggi" }}
        />
      ) : null}

      {ready ? (
        <>
          <ProfileContent
            data={data}
            offline={profile.offline}
            retrying={profile.retrying}
            alertRef={alertRef}
            onRetry={() => void handleOfflineRetry()}
            openSheet={openSheet}
          />
          <ChildSheet
            open={sheet !== null}
            onClose={() => setSheet(null)}
            focusOn={sheet?.focus ?? "name"}
            data={data}
            onSave={handleSave}
          />
        </>
      ) : null}
    </main>
  );
}

function ProfileContent({
  data,
  offline,
  retrying,
  alertRef,
  onRetry,
  openSheet,
}: {
  data: ChildData;
  offline: boolean;
  retrying: boolean;
  alertRef: React.RefObject<HTMLDivElement | null>;
  onRetry: () => void;
  openSheet: OpenSheet;
}) {
  const now = data.readAt;
  const upcoming = upcomingEvents(data.weekEvents, now);
  const empty = isProfileEmpty(data.profile, data.teachers);
  const hasOverview =
    !empty || data.weekEvents.length > 0 || data.deadline !== null;
  const school = schoolView(data.profile, data.teachers);
  const sizes = sizesView(data.profile, now);

  const head = <Head data={data} editable={!empty} openSheet={openSheet} />;
  const notice = offline ? (
    <div ref={alertRef}>
      <Alert
        variant="errore"
        icon="wifi-off"
        action={
          <Button variant="link" loading={retrying} onClick={onRetry}>
            Riprova
          </Button>
        }
      >
        Sei offline. Vedi il profilo aggiornato alle {formatTime(now)}; per
        modificarlo serve la connessione.
      </Alert>
    </div>
  ) : null;
  const emptyProfile = (
    <EmptyProfile name={data.child.name} openSheet={openSheet} />
  );

  // Nothing to show but the head: one column, as in the mockup.
  if (!hasOverview) {
    return (
      <>
        {head}
        {notice}
        {emptyProfile}
      </>
    );
  }

  return (
    <div className="colonne colonne--due">
      <div className="colonna">
        {head}
        {notice}
        <Counters data={data} />
        <WeekSection data={data} upcoming={upcoming} />
        {school ? <SchoolSection view={school} /> : null}
        {empty ? emptyProfile : null}
      </div>
      {sizes ? (
        <div className="colonna">
          <SizesSection view={sizes} />
        </div>
      ) : null}
    </div>
  );
}

function Head({
  data,
  editable,
  openSheet,
}: {
  data: ChildData;
  /** The «Modifica il profilo» button (desktop) is not in the empty state */
  editable: boolean;
  openSheet: OpenSheet;
}) {
  const subtitle = headSubtitle(data);
  return (
    <div className="profilo-testa profilo-testa--riga">
      <Avatar
        name={data.child.name}
        color={data.child.color}
        size="xl"
        nameShown
      />
      <div className="intestazione">
        <h1 className="t-titolo-pagina" tabIndex={-1}>
          {data.child.name}
        </h1>
        {subtitle ? <p className="intestazione__sotto">{subtitle}</p> : null}
      </div>
      {editable ? (
        <button
          type="button"
          className="btn-secondary btn--piccolo profilo-testa__azione"
          aria-haspopup="dialog"
          onClick={() => openSheet("name")}
        >
          <Icon name="pencil" />
          <span className="btn__testo">Modifica il profilo</span>
          <VisuallyHidden>{` di ${data.child.name}`}</VisuallyHidden>
        </button>
      ) : null}
    </div>
  );
}

function CounterNumber({ view }: { view: CounterView }) {
  if (view.number === null) {
    return (
      <span className="contatore__numero" aria-hidden="true">
        —
      </span>
    );
  }
  return (
    <span className="contatore__numero">
      {view.number}
      {view.urgent ? (
        <span className="pallino-urgente" aria-hidden="true" />
      ) : null}
    </span>
  );
}

function Counters({ data }: { data: ChildData }) {
  const now = data.readAt;
  const events = eventsCounter(data.weekEvents.length);
  const deadline = deadlineCounter(data.deadline, now);
  const birthday = birthdayCounter(data.child.birthDate, now);
  const cls = "scheda contatore contatore--piccolo";

  return (
    <div className="griglia-contatori griglia-contatori--tre">
      <div className={cls}>
        <CounterNumber view={events} />{" "}
        <span className="contatore__info">{events.info}</span>
      </div>
      {data.deadline ? (
        <Link
          href="/casa/scadenze"
          className={cls}
          aria-label={`${deadline.number} ${deadline.info}: «${data.deadline.title}»${deadline.urgent ? ", urgente" : ""}`}
        >
          <CounterNumber view={deadline} />{" "}
          <span className="contatore__info">{deadline.info}</span>
        </Link>
      ) : (
        <div className={cls}>
          <CounterNumber view={deadline} />{" "}
          <span className="contatore__info">{deadline.info}</span>
        </div>
      )}
      <div className={cls}>
        <CounterNumber view={birthday} />{" "}
        <span className="contatore__info">{birthday.info}</span>
      </div>
    </div>
  );
}

function WeekRow({ event }: { event: FullEvent }) {
  return (
    <ListRow href={eventHref(event.id, event.startsAt)}>
      <span className="riga-lista__ora">
        {formatShortWeekday(event.startsAt)}
      </span>
      <span className="riga-lista__testo">
        <span className="riga-lista__titolo">{event.title}</span>
        <span className="riga-lista__info">{eventInfo(event)}</span>
      </span>
      <span className="riga-lista__valore">
        {event.visibility === "private" ? (
          <span className="riga-lista__lucchetto">
            <Icon name="lock" size="s" />
            <VisuallyHidden>Visibile solo a te</VisuallyHidden>
          </span>
        ) : null}
        <Icon name="chevron-right" />
      </span>
    </ListRow>
  );
}

function WeekSection({
  data,
  upcoming,
}: {
  data: ChildData;
  upcoming: ReadonlyArray<FullEvent>;
}) {
  const titleId = useId();
  return (
    <section className="sezione" aria-labelledby={titleId}>
      <div className="sezione__testa">
        <h2 className="sezione__titolo" id={titleId}>
          Questa settimana
        </h2>
        <span className="sezione__info">
          <Link className="sezione__link" href="/calendario">
            Vedi nel calendario
          </Link>
        </span>
      </div>
      {upcoming.length > 0 ? (
        <ul className="scheda lista">
          {upcoming.map((event) => (
            <WeekRow key={`${event.id}-${event.startsAt}`} event={event} />
          ))}
        </ul>
      ) : data.weekEvents.length === 0 ? (
        <EmptyState
          title="Settimana libera, per ora"
          text={`${data.child.name} non ha impegni questa settimana.`}
          actions={<Link href="/aggiungi">Aggiungi un impegno</Link>}
          after="."
        />
      ) : (
        <p className="t-corpo t-secondario">
          Nessun altro impegno questa settimana.
        </p>
      )}
    </section>
  );
}

function SchoolSection({ view }: { view: SchoolView }) {
  const titleId = useId();
  const hasRows = view.timetable !== null || view.teachers.length > 0;
  return (
    <section className="sezione" aria-labelledby={titleId}>
      <div className="sezione__testa">
        <h2 className="sezione__titolo" id={titleId}>
          Scuola
        </h2>
        {view.classText ? (
          <span className="sezione__info">{view.classText}</span>
        ) : null}
      </div>
      {hasRows ? (
        <ul className="scheda lista">
          {view.timetable ? (
            <ListRow>
              <span className="icona-riquadro">
                <Icon name="clock" />
              </span>
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">
                  {view.timetable.title}
                </span>
                {view.timetable.info ? (
                  <span className="riga-lista__info">
                    {view.timetable.info}
                  </span>
                ) : null}
              </span>
            </ListRow>
          ) : null}
          {view.teachers.map((teacher) => {
            const body = (
              <>
                <span className="icona-riquadro">
                  <Icon name={teacher.href ? "phone" : "user-round"} />
                </span>
                <span className="riga-lista__testo">
                  <span className="riga-lista__titolo">{teacher.name}</span>
                  {teacher.info ? (
                    <span className="riga-lista__info">{teacher.info}</span>
                  ) : null}
                </span>
              </>
            );
            return teacher.href ? (
              <li key={teacher.id}>
                <a
                  className="riga-lista riga-lista--cliccabile"
                  href={teacher.href}
                >
                  {body}
                  <span className="riga-lista__valore">
                    <Icon name="chevron-right" />
                  </span>
                  <VisuallyHidden>, chiama</VisuallyHidden>
                </a>
              </li>
            ) : (
              <ListRow key={teacher.id}>{body}</ListRow>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

function SizesSection({ view }: { view: SizesView }) {
  const titleId = useId();
  return (
    <section className="sezione" aria-labelledby={titleId}>
      <div className="sezione__testa">
        <h2 className="sezione__titolo" id={titleId}>
          Taglie
        </h2>
        {view.updated ? (
          <span className="sezione__info">{view.updated}</span>
        ) : null}
      </div>
      <div className="scheda scheda--imbottita">
        <div className="gruppo-chip">
          {view.chips.map((chip) => (
            <Chip key={chip.label} static>
              {chip.label} <span className="chip__valore">{chip.value}</span>
            </Chip>
          ))}
        </div>
      </div>
    </section>
  );
}

function EmptyProfile({
  name,
  openSheet,
}: {
  name: string;
  openSheet: OpenSheet;
}) {
  return (
    <EmptyState
      large
      title={`Completa il profilo di ${name}`}
      text="Scuola, maestre, taglie: quello che serve sapere quando qualcuno chiede «che numero porta?»."
      actions={
        <>
          <button
            type="button"
            className="btn-primary btn--pieno"
            aria-haspopup="dialog"
            onClick={() => openSheet("school")}
          >
            <Icon name="plus" />
            <span className="btn__testo">Aggiungi la scuola</span>
          </button>
          <button
            type="button"
            className="btn-secondary btn--pieno"
            aria-haspopup="dialog"
            onClick={() => openSheet("sizes")}
          >
            <Icon name="plus" />
            <span className="btn__testo">Aggiungi le taglie</span>
          </button>
        </>
      }
    />
  );
}
