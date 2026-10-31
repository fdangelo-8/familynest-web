"use client";

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

/**
 * Dettaglio impegno (#19): everything about one occurrence of an event, and
 * the way to change or delete it. The event is read in the browser after the
 * server has checked session and Nest, so loading and errors are the page's
 * own and the server HTML carries nothing of the event.
 */
export function EventDetailPage({
  eventId,
  day,
}: {
  eventId: string;
  /** `giorno` of the address, if valid */
  day: string | null;
}) {
  const detail = useEventDetail(eventId, day);
  const { showToast } = useToast();
  const desktop = useIsDesktop();
  // Only used once the event is read, so it never reaches the server HTML.
  const [now] = useState(() => new Date());
  const [editing, setEditing] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const retried = useRef(false);

  const { state, reload, markMissing } = detail;
  const ready = state.status === "ready";

  // After a «Riprova» that worked, the focus goes to the title.
  useEffect(() => {
    if (ready && retried.current) {
      retried.current = false;
      mainRef.current?.querySelector<HTMLElement>("h1")?.focus();
    }
  }, [ready]);

  const handleSaved = useCallback(
    async (saved: { id: string; day: string }) => {
      // Same page, new address: no new entry in the history.
      window.history.replaceState(
        null,
        "",
        `/impegni/${encodeURIComponent(saved.id)}?giorno=${saved.day}`,
      );
      await reload(saved.id, saved.day);
      showToast({ text: "Modifiche salvate" });
    },
    [reload, showToast],
  );

  const openEdit = () => setEditing(true);

  return (
    <main
      ref={mainRef}
      id="contenuto"
      tabIndex={-1}
      className="pagina pagina-desktop pagina-desktop--centrata"
    >
      {state.status === "loading" || ready ? (
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
          <EventCard
            occurrence={state.occurrence}
            members={state.members}
            meId={state.meId}
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
                <Button icon="pencil" onClick={openEdit}>
                  Modifica
                </Button>
              </div>
            </div>
          ) : (
            <div className="dialogo__azioni">
              <Button full icon="pencil" onClick={openEdit}>
                Modifica
              </Button>
              {state.occurrence.location ? (
                <DirectionsLink place={state.occurrence.location} full />
              ) : null}
            </div>
          )}
          <EditEventSheet
            open={editing}
            onClose={() => setEditing(false)}
            occurrence={state.occurrence}
            members={state.members}
            meId={state.meId}
            now={now}
            onSaved={handleSaved}
            onMissing={markMissing}
          />
        </>
      ) : null}
    </main>
  );
}
