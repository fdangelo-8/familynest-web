import Link from "next/link";
import type { MouseEvent } from "react";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { Icon } from "@/components/ui/Icon/Icon";
import { formatFreeEveningWindow, type FreeEvening } from "@/lib/calendar";
import { formatDayNumber } from "@/lib/datetime";

function isPlainClick(event: MouseEvent): boolean {
  return !(
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

/**
 * «Serate libere insieme»: one line per evening of the week. With `onGo` the
 * evening of another day is a link to that day (the day view); the one already
 * shown is not. Without `onGo` no row is a control (the week view).
 */
export function EveningsPanel({
  evenings,
  hasAnyEvent,
  shownDayKey,
  onGo,
}: {
  evenings: readonly FreeEvening[];
  hasAnyEvent: boolean;
  shownDayKey?: string;
  /** A plain click on a row: go to that day without reloading */
  onGo?: (dayKey: string) => void;
}) {
  if (!hasAnyEvent) {
    return (
      <section className="sezione">
        <div className="sezione__testa">
          <h2 className="sezione__titolo">Serate libere insieme</h2>
        </div>
        <EmptyState
          icon="heart"
          title="Ancora niente da calcolare"
          text="Le serate in cui siete tutti liberi compaiono qui."
          actions={null}
        />
      </section>
    );
  }
  if (evenings.length === 0) {
    return (
      <section className="sezione">
        <div className="sezione__testa">
          <h2 className="sezione__titolo">Serate libere insieme</h2>
        </div>
        <EmptyState
          icon="heart"
          title="Nessuna serata libera insieme"
          text="Questa settimana ogni sera qualcuno ha un impegno."
          actions={null}
        />
      </section>
    );
  }
  return (
    <section className="sezione">
      <div className="sezione__testa">
        <h2 className="sezione__titolo">Serate libere insieme</h2>
        <span className="sezione__info">
          {evenings.length} questa settimana
        </span>
      </div>
      <ul className="scheda lista">
        {evenings.map((evening) => {
          const content = (
            <>
              <span className="icona-riquadro icona-riquadro--insieme">
                <Icon name="heart" />
              </span>
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">
                  {formatDayNumber(evening.start)}
                </span>
                <span className="riga-lista__info">
                  {formatFreeEveningWindow(evening)}
                </span>
              </span>
            </>
          );
          return (
            <li key={evening.dayKey}>
              {onGo === undefined || evening.dayKey === shownDayKey ? (
                <div className="riga-lista">{content}</div>
              ) : (
                <Link
                  href={`/calendario/giorno?giorno=${evening.dayKey}`}
                  className="riga-lista riga-lista--cliccabile"
                  onClick={(clickEvent) => {
                    if (!isPlainClick(clickEvent)) return;
                    clickEvent.preventDefault();
                    onGo(evening.dayKey);
                  }}
                >
                  {content}
                  <span className="riga-lista__valore">
                    <Icon name="chevron-right" />
                  </span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
