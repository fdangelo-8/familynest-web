"use client";

import { useRef, useState } from "react";
import {
  setNotificationPreference,
  type Failure,
  type PreferenceKey,
} from "@/app/(app)/impostazioni/actions";
import { Alert } from "@/components/ui/Alert/Alert";
import { Icon, type IconName } from "@/components/ui/Icon/Icon";
import { Toggle } from "@/components/ui/Toggle/Toggle";

export type NotificationValues = Record<PreferenceKey, boolean>;

const ROWS: ReadonlyArray<{
  key: PreferenceKey;
  icon: IconName;
  title: string;
  info?: string;
}> = [
  { key: "events", icon: "calendar", title: "Impegni e cambi d'orario" },
  {
    key: "assigned_todos",
    icon: "square-check",
    title: "Da fare assegnati a me",
  },
  {
    key: "shopping",
    icon: "shopping-basket",
    title: "Spesa",
    info: "Raggruppate, una volta al giorno",
  },
  { key: "free_together", icon: "heart", title: "Liberi insieme" },
  { key: "morning_digest", icon: "sunrise", title: "Sintesi del mattino" },
];

const SHOPPING_INFO_ID = "notifiche-spesa-info";

function errorText(title: string, reason: Failure): string {
  return reason === "network"
    ? `Non siamo riusciti a cambiare la notifica «${title}». Controlla la connessione e riprova.`
    : `Non siamo riusciti a cambiare la notifica «${title}» per un problema nostro. Riprova tra qualche minuto.`;
}

/**
 * The «Notifiche» card: five switches that save right away. The switch moves
 * at once and goes back if the saving fails. Only the caller's own choices.
 */
export function NotificationSettings({
  initial,
}: {
  initial: NotificationValues;
}) {
  const [values, setValues] = useState<NotificationValues>(initial);
  const [busy, setBusy] = useState<ReadonlySet<PreferenceKey>>(new Set());
  const [error, setError] = useState<{ title: string; reason: Failure } | null>(
    null,
  );
  // A second tap on the same switch while it saves sends nothing.
  const inFlight = useRef<Set<PreferenceKey>>(new Set());

  const setBusyKey = (key: PreferenceKey, on: boolean) =>
    setBusy((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const onChange = async (key: PreferenceKey, title: string, next: boolean) => {
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    setBusyKey(key, true);
    setError(null);
    setValues((current) => ({ ...current, [key]: next }));
    let failure: Failure | null = null;
    try {
      const result = await setNotificationPreference(key, next);
      if (!result.ok) failure = result.reason;
    } catch {
      failure = "network";
    }
    if (failure) {
      setValues((current) => ({ ...current, [key]: !next }));
      setError({ title, reason: failure });
    }
    inFlight.current.delete(key);
    setBusyKey(key, false);
  };

  return (
    <>
      <ul className="scheda lista">
        {ROWS.map((row) => (
          <li
            key={row.key}
            className="riga-lista"
            aria-busy={busy.has(row.key) || undefined}
          >
            <span className="icona-riquadro">
              <Icon name={row.icon} />
            </span>
            <span className="riga-lista__testo">
              <span className="riga-lista__titolo">{row.title}</span>
              {row.info ? (
                <span className="riga-lista__info" id={SHOPPING_INFO_ID}>
                  {row.info}
                </span>
              ) : null}
            </span>
            <Toggle
              checked={values[row.key]}
              aria-label={row.title}
              aria-describedby={row.info ? SHOPPING_INFO_ID : undefined}
              onChange={(next) => void onChange(row.key, row.title, next)}
            />
          </li>
        ))}
      </ul>
      <p className="t-nota t-secondario">
        Valgono solo per te: gli altri scelgono le loro.
      </p>
      {error ? (
        <Alert
          variant="errore"
          icon={error.reason === "network" ? "wifi-off" : "circle-alert"}
        >
          {errorText(error.title, error.reason)}
        </Alert>
      ) : null}
    </>
  );
}
