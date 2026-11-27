"use client";

import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { haptic } from "@/lib/haptic";
import { t } from "@/lib/i18n";
import { it } from "@/lib/i18n/messages/it";
import { Alert } from "../Alert/Alert";
import { cx } from "../cx";
import { Icon, type IconName } from "../Icon/Icon";
import { Spinner } from "../Spinner/Spinner";

export type ConnectStatus = "idle" | "busy" | "connected" | "error";

export type ConnectRowProps = {
  /** Name of the service («Outlook»): the only datum used in the notices */
  service: string;
  /** Sign of the service, 24 px, on the left */
  icon: IconName;
  /** Line under the name («Lavoro e calendari condivisi») */
  line: string;
  status: ConnectStatus;
  /** Line under the name once connected («12 impegni nelle prossime quattro settimane») */
  connectedLine?: string;
  /** Tap on the pill or on any point of the row. Not called while `busy` or `connected`. */
  onConnect: () => void;
  "data-testid"?: string;
};

/**
 * Row of a service to connect, form 1 (`.riga-collega`): sign and name on the
 * left, the pill «Collega» on the right; the whole row answers to the tap.
 * Use inside `ConnectList`.
 */
export function ConnectRow({
  service,
  icon,
  line,
  status,
  connectedLine,
  onConnect,
  "data-testid": testId,
}: ConnectRowProps) {
  const stateRef = useRef<HTMLSpanElement>(null);
  const previous = useRef<ConnectStatus>(status);

  // Just connected: the focus goes to the state, a light tick, the sign enters.
  useEffect(() => {
    if (previous.current !== "connected" && status === "connected") {
      haptic("leggera");
      stateRef.current?.focus();
    }
    previous.current = status;
  }, [status]);

  const connected = status === "connected";
  const busy = status === "busy";
  const pillLabel = status === "error" ? it.retry : it.sheetsDates.connect;
  const pillName = t(
    status === "error"
      ? it.sheetsDates.retryService
      : it.sheetsDates.connectService,
    { service },
  );

  return (
    <li
      className={cx("riga-collega", connected && "riga-collega--collegato")}
      data-testid={testId}
    >
      <Icon name={icon} size="l" />
      <span className="riga-collega__testo">
        <span className="riga-collega__nome">{service}</span>
        <span className="riga-collega__riga">
          {connected && connectedLine ? connectedLine : line}
        </span>
      </span>
      {connected ? (
        <span
          className="riga-collega__stato"
          ref={stateRef}
          tabIndex={-1}
          data-testid="collega-stato"
        >
          <Icon name="check" />
          {it.sheetsDates.connected}
        </span>
      ) : (
        <button
          type="button"
          className="pillola-collega"
          aria-label={pillName}
          aria-busy={busy || undefined}
          aria-disabled={busy || undefined}
          onClick={busy ? undefined : onConnect}
        >
          {busy ? (
            <>
              <span className="pillola-collega__testo" aria-hidden="true">
                {pillLabel}
              </span>
              <Spinner className="pillola-collega__rotella" />
            </>
          ) : (
            pillLabel
          )}
        </button>
      )}
      <span className="visivamente-nascosto" role="status" aria-live="polite">
        {connected ? t(it.sheetsDates.serviceConnected, { service }) : ""}
      </span>
    </li>
  );
}

type RowElement = ReactElement<ConnectRowProps>;

/**
 * List of `ConnectRow` with the error notice on top: when a row is in `error`
 * the notice names its service (`errorText` replaces the sentence).
 */
export function ConnectList({
  children,
  errorText,
  "data-testid": testId,
}: {
  children: ReactNode;
  /** Replaces «Non siamo riusciti a collegare <servizio>. Riprova, oppure continua senza.» */
  errorText?: string;
  "data-testid"?: string;
}) {
  const failed = Children.toArray(children).find(
    (child): child is RowElement =>
      isValidElement<ConnectRowProps>(child) && child.props.status === "error",
  );
  return (
    <div className="elenco-collega" data-testid={testId}>
      {failed ? (
        <Alert variant="errore" data-testid="collega-errore">
          {errorText ??
            t(it.sheetsDates.connectFailed, { service: failed.props.service })}
        </Alert>
      ) : null}
      <ul className="elenco-collega__righe">{children}</ul>
    </div>
  );
}
