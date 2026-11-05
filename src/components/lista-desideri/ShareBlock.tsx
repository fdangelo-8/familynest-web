"use client";

import type { Ref } from "react";
import { Button } from "@/components/ui/Button/Button";
import { Icon } from "@/components/ui/Icon/Icon";
import type { ShareView } from "./model";

/**
 * The dark block of the sharing (#32 §3.3 and §6; designer §4): the state of
 * the link, its expiry and «Disattiva il link». The only dark element of the
 * page. Without a birth date there is no «Condividi»: the link would have no
 * expiry (decision D2).
 */
export function ShareBlock({
  view,
  sharing,
  onShare,
  onDisable,
  shareRef,
  disableRef,
}: {
  view: ShareView;
  sharing: boolean;
  onShare: () => void;
  onDisable: () => void;
  shareRef: Ref<HTMLButtonElement>;
  disableRef: Ref<HTMLButtonElement>;
}) {
  const shared = view.kind === "active";
  return (
    <div className="scheda scheda--scura">
      <ul className="lista lista--notte">
        <li className="riga-lista riga-lista--notte">
          <span className="icona-riquadro icona-riquadro--scura">
            <Icon name="link" />
          </span>
          <span className="riga-lista__testo">
            <span className="riga-lista__titolo">
              {shared ? "Condivisa con un link" : "Non ancora condivisa"}
            </span>
            <span className="riga-lista__info">
              {view.kind === "active"
                ? view.taken
                : view.kind === "no-birth"
                  ? "Per condividere serve la data del compleanno."
                  : "Crea il link e mandalo a nonni e parenti: vedono le idee e segnano cosa regalano."}
            </span>
          </span>
          {view.kind === "no-birth" ? null : (
            <Button
              variant="chiaro"
              small
              loading={sharing}
              buttonRef={shareRef}
              onClick={onShare}
              data-testid="lista-condividi"
            >
              Condividi
            </Button>
          )}
        </li>
        {view.kind === "active" ? (
          <li className="riga-lista riga-lista--notte">
            <span className="icona-riquadro icona-riquadro--scura">
              <Icon name="hourglass" />
            </span>
            <span className="riga-lista__testo">
              <span className="riga-lista__titolo">{view.until}</span>
              <span className="riga-lista__info">
                Il giorno dopo il compleanno
              </span>
            </span>
            <Button
              variant="link"
              aria-haspopup="dialog"
              buttonRef={disableRef}
              onClick={onDisable}
              data-testid="lista-disattiva"
            >
              Disattiva il link
            </Button>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
