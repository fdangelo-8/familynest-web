"use client";

import { useEffect, useRef } from "react";
import { Sheet } from "@/components/ui/Sheet/Sheet";
import { Spinner } from "@/components/ui/Spinner/Spinner";
import { ConnectForm } from "./ConnectForm";
import { LOGO_CLASS, PROVIDER_NAME, type ProviderKey } from "./model";

/*
 * «Collega un altro account» (#34 §5b): one row for each provider, always all
 * of them, because a second account of the same provider can be linked.
 * iCloud (#36) is not here until it exists. Outlook first, as in the mockup of
 * the onboarding (04).
 */
const ROWS: ReadonlyArray<{
  provider: ProviderKey;
  initial: string;
  info: string;
}> = [
  { provider: "outlook", initial: "O", info: "Lavoro e calendari condivisi" },
  { provider: "google", initial: "G", info: "Per il calendario personale" },
];

export function ConnectSheet({
  offline,
  onClose,
}: {
  offline: boolean;
  onClose: () => void;
}) {
  const firstRef = useRef<HTMLButtonElement>(null);
  // The first «Collega» takes the focus when the sheet opens (after the first
  // focus of the sheet itself, which lands on «Chiudi»).
  useEffect(() => {
    firstRef.current?.focus();
  }, []);
  return (
    <Sheet open title="Collega un altro account" onClose={onClose}>
      <ul className="scheda lista">
        {ROWS.map((row, index) => {
          const name = PROVIDER_NAME[row.provider];
          return (
            <li className="riga-lista" key={row.provider}>
              <span
                className={`logo-marchio ${LOGO_CLASS[row.provider]}`}
                aria-hidden="true"
              >
                {row.initial}
              </span>
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">{name}</span>
                <span className="riga-lista__info">{row.info}</span>
              </span>
              <ConnectForm provider={row.provider}>
                {(loading) => (
                  <button
                    type="submit"
                    className="btn-tenue"
                    ref={index === 0 ? firstRef : undefined}
                    aria-label={loading ? undefined : `Collega ${name}`}
                    aria-busy={loading || undefined}
                    aria-disabled={loading || undefined}
                    disabled={offline}
                    onClick={(event) => {
                      if (loading) event.preventDefault();
                    }}
                  >
                    {loading ? (
                      <>
                        <Spinner />
                        Collegamento
                      </>
                    ) : (
                      "Collega"
                    )}
                  </button>
                )}
              </ConnectForm>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
