"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BarAction } from "@/components/ui/AppFrame/BarAction";
import { Button } from "@/components/ui/Button/Button";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon/Icon";
import { useIsDesktop } from "@/components/ui/overlay";
import { PageError } from "@/components/ui/PageError/PageError";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton/Skeleton";
import { useToast } from "@/components/ui/Toast/ToastProvider";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import { isValidDayKey, startOfDay } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/client";
import { eventHref } from "@/lib/household-events";
import { Alert } from "@/components/ui/Alert/Alert";
import { setAlsoOn, type AlsoOnRetry } from "./also-on";
import { EditEventSheet } from "./EditEventSheet";
import { EventCard } from "./EventCard";
import { calendarHref, mapsUrl } from "./model";
import { useEventDetail } from "./useEventDetail";

/** «Indicazioni»: a link to the maps, in a new tab, without Referer. */
function DirectionsLink({ place, full }: { place: string; full?: boolean }) {
  return (
    <a
      className={cx("btn-secondary", full && "btn--pieno")}
      href={mapsUrl(place)}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Icon name="map-pin" />
      <span className="btn__testo">Indicazioni</span>
      <VisuallyHidden>
        {` per ${place}, si apre in un'altra scheda`}
      </VisuallyHidden>
    </a>
  );
}

/** The id in `/impegni/<id>`, or null for any other address. */
function idFromPath(pathname: string): string | null {
  const match = /^\/impegni\/([^/]+)\/?$/.exec(pathname);
  return match?.[1] ?? null;
}

/**
 * Dettaglio impegno (#19): everything about one occurrence of an event, and
 * the way to change or delete it. The event is read in the browser after the
 * server has checked session and Nest, so loading and errors are the page's
 * own and the server HTML carries nothing of the event.
 */
export function EventDetailPage({
  eventId: firstEventId,
  day: firstDay,
}: {
  eventId: string;
  /** `giorno` of the address, if valid */
  day: string | null;
}) {
  // What the page shows is what the address says now, not the props: a save
  // changes the address with `history.replaceState`, and coming back with
  // «Indietro» the router restores the props it had before the save.
  const pathname = usePathname();
  const queryDay = useSearchParams().get("giorno");
  // With a sheet open over the page (Add, search) the address is not the
  // page's: keep the last id and day read from its own address.
  const [shown, setShown] = useState({
    eventId: idFromPath(pathname) ?? firstEventId,
    day:
      queryDay === null ? firstDay : isValidDayKey(queryDay) ? queryDay : null,
  });
  const addressId = idFromPath(pathname);
  if (addressId !== null) {
    const addressDay =
      queryDay === null ? firstDay : isValidDayKey(queryDay) ? queryDay : null;
    if (shown.eventId !== addressId || shown.day !== addressDay) {
      setShown({ eventId: addressId, day: addressDay });
    }
  }
  const { eventId, day } = shown;
  const detail = useEventDetail(eventId, day);
  const { showToast } = useToast();
  const desktop = useIsDesktop();
  // Only used once the event is read, so it never reaches the server HTML.
  const [now] = useState(() => new Date());
  const [editing, setEditing] = useState(false);
  // The event is saved but «Anche su» failed: what to send again.
  const [alsoOnRetry, setAlsoOnRetry] = useState<AlsoOnRetry | null>(null);
  const [alsoOnBusy, setAlsoOnBusy] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const retried = useRef(false);

  const { state, reload, markMissing } = detail;
  const ready = state.status === "ready";
  // An imported event changes only for its author (and only «Chi lo vede»).
  const canEdit =
    state.status !== "ready" ||
    !state.link.isImported ||
    state.occurrence.authorMemberId === state.meId;

  // After a «Riprova» that worked, the focus goes to the title.
  useEffect(() => {
    if (ready && retried.current) {
      retried.current = false;
      mainRef.current?.querySelector<HTMLElement>("h1")?.focus();
    }
  }, [ready]);

  const handleSaved = useCallback(
    async (saved: { id: string; day: string; alsoOnRetry?: AlsoOnRetry }) => {
      // Same page, new address: no new entry in the history.
      window.history.replaceState(
        null,
        "",
        eventHref(saved.id, startOfDay(saved.day)),
      );
      setAlsoOnRetry(saved.alsoOnRetry ?? null);
      await reload(saved.id, saved.day);
      showToast({ text: "Modifiche salvate" });
    },
    [reload, showToast],
  );

  const openEdit = () => setEditing(true);

  /** Sends «Anche su» again, never the event itself (it is already saved). */
  const retryAlsoOn = async () => {
    if (!alsoOnRetry || alsoOnBusy) return;
    setAlsoOnBusy(true);
    let ok = true;
    for (const call of alsoOnRetry.calls) {
      if (!(await setAlsoOn(createClient(), call.id, call.enabled))) {
        ok = false;
        break;
      }
    }
    setAlsoOnBusy(false);
    if (ok) {
      setAlsoOnRetry(null);
      showToast({ text: "Anche su aggiornato" });
    }
  };

  return (
    <main
      ref={mainRef}
      id="contenuto"
      tabIndex={-1}
      className="pagina pagina-desktop pagina-desktop--centrata"
    >
      {state.status === "loading" || (ready && canEdit) ? (
        <BarAction
          icon="pencil"
          label="Modifica"
          inactive={!ready}
          onClick={openEdit}
        />
      ) : null}

      {state.status === "loading" ? (
        <div aria-live="polite">
          <SkeletonGroup>
            <Skeleton shape="grande" />
            <Skeleton shape="riga" />
            <Skeleton shape="riga" />
          </SkeletonGroup>
        </div>
      ) : null}

      {state.status === "error" ? (
        <PageError
          headingLevel={1}
          retrying={detail.retrying}
          onRetry={() => {
            retried.current = true;
            detail.retry();
          }}
          exit={{ label: "Torna a Oggi", href: "/oggi" }}
        />
      ) : null}

      {state.status === "missing" ? (
        <PageError
          headingLevel={1}
          title="Questo impegno non c'è più"
          text="Forse l'ha eliminato chi l'aveva creato. Torna al calendario per vedere com'è ora la giornata."
          action={{ label: "Vai al calendario", href: "/calendario" }}
        />
      ) : null}

      {state.status === "ready" ? (
        <>
          {alsoOnRetry ? (
            <Alert
              variant="errore"
              data-testid="anche-su-errore"
              action={
                <Button
                  variant="tenue"
                  small
                  loading={alsoOnBusy}
                  onClick={() => void retryAlsoOn()}
                >
                  Riprova
                </Button>
              }
            >
              {`Le modifiche sono salvate, ma non siamo riusciti a mandarle a ${alsoOnRetry.providerLabel}. Controlla la connessione e riprova.`}
            </Alert>
          ) : null}
          <EventCard
            occurrence={state.occurrence}
            members={state.members}
            meId={state.meId}
            link={state.link}
            now={now}
          />
          {desktop ? (
            <div className="modale__piede">
              <Button
                variant="link-secondario"
                href={calendarHref(state.occurrence.startsAt)}
              >
                <span aria-hidden="true">←</span> Torna al calendario
              </Button>
              <div className="gruppo-chip">
                {state.occurrence.location ? (
                  <DirectionsLink place={state.occurrence.location} />
                ) : null}
                {canEdit ? (
                  <Button icon="pencil" onClick={openEdit}>
                    Modifica
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="dialogo__azioni">
              {canEdit ? (
                <Button full icon="pencil" onClick={openEdit}>
                  Modifica
                </Button>
              ) : null}
              {state.occurrence.location ? (
                <DirectionsLink place={state.occurrence.location} full />
              ) : null}
            </div>
          )}
          <EditEventSheet
            open={editing && canEdit}
            onClose={() => setEditing(false)}
            occurrence={state.occurrence}
            members={state.members}
            meId={state.meId}
            link={state.link}
            alsoOnTarget={state.alsoOnTarget}
            now={now}
            onSaved={handleSaved}
            onMissing={markMissing}
          />
        </>
      ) : null}
    </main>
  );
}
