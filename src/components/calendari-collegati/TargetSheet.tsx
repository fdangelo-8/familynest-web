"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { useIsDesktop } from "@/components/ui/overlay";
import { Sheet } from "@/components/ui/Sheet/Sheet";
import { PROVIDER_NAME, type AccountItem } from "./model";
import { saveNewEventsCalendar } from "./save";

const SAVE_ERROR =
  "Non siamo riusciti a salvare. Controlla la connessione e riprova.";
/** Value of the choice «Nessuno» */
const NONE = "none";

export type TargetOption = {
  calendarId: string;
  name: string;
  provider: AccountItem["provider"];
  email: string;
};

/**
 * «Dove vanno i nuovi impegni» (#34 §5c): one calendar of the adult that is
 * switched on, «Entrata e uscita» and writable, or «Nessuno». Saved with
 * «Salva». Without any calendar that can receive events there is nothing to
 * choose and no «Salva».
 */
export function TargetSheet({
  options,
  currentId,
  onClose,
  onSaved,
}: {
  options: readonly TargetOption[];
  currentId: string | null;
  onClose: () => void;
  onSaved: (calendarId: string | null) => void;
}) {
  const desktop = useIsDesktop();
  const formId = useId();
  const [value, setValue] = useState<string>(currentId ?? NONE);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [closeRequested, setCloseRequested] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  const empty = options.length === 0;

  useEffect(() => {
    groupRef.current
      ?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')
      ?.focus();
  }, []);

  const onGroupKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    const backward = event.key === "ArrowUp" || event.key === "ArrowLeft";
    if (!forward && !backward) return;
    event.preventDefault();
    const radios = Array.from(
      groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [],
    );
    const at = radios.findIndex((r) => r === document.activeElement);
    const next =
      radios[(at + (forward ? 1 : -1) + radios.length) % radios.length];
    if (!next) return;
    next.focus();
    if (!saving) setValue(next.dataset.value ?? NONE);
  };

  const submit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFailed(false);
    const chosen = value === NONE ? null : value;
    const result = await saveNewEventsCalendar(chosen);
    setSaving(false);
    if (!result.ok) {
      setFailed(true);
      return;
    }
    onSaved(chosen);
    setCloseRequested(true);
  };

  const radio = (id: string, title: string, info?: string) => {
    const selected = value === id;
    return (
      <button
        key={id}
        type="button"
        className="scelta"
        role="radio"
        data-value={id}
        aria-checked={selected}
        tabIndex={selected ? 0 : -1}
        onClick={() => {
          if (!saving) setValue(id);
        }}
      >
        <span className="scelta__radio" aria-hidden="true" />
        <span>
          <span className="scelta__titolo">{title}</span>
          {info ? <span className="scelta__info">{info}</span> : null}
        </span>
        <span />
      </button>
    );
  };

  const saveButton = (
    <Button type="submit" form={formId} full={!desktop} loading={saving}>
      Salva
    </Button>
  );

  return (
    <Sheet
      open
      title="Dove vanno i nuovi impegni"
      onClose={onClose}
      closeRequested={closeRequested}
      locked={saving}
      data-testid="foglio-dove-vanno"
      footer={
        empty ? undefined : desktop ? (
          <>
            <Button
              variant="link-secondario"
              onClick={() => setCloseRequested(true)}
              inactive={saving}
            >
              Annulla
            </Button>
            {saveButton}
          </>
        ) : (
          saveButton
        )
      }
    >
      <form id={formId} onSubmit={submit} noValidate>
        {empty ? (
          <Alert variant="info">
            Nessun calendario può ricevere impegni: scegli «Entrata e uscita» in
            uno dei tuoi calendari.
          </Alert>
        ) : (
          <div className="campo">
            <p className="campo__aiuto">
              Quando scegli «Anche su» in Aggiungi, l&apos;impegno va in questo
              calendario.
            </p>
            <div
              ref={groupRef}
              className="gruppo-scelte"
              role="radiogroup"
              aria-label="Dove vanno i nuovi impegni"
              onKeyDown={onGroupKey}
            >
              {options.map((option) =>
                radio(
                  option.calendarId,
                  `${option.name} · ${PROVIDER_NAME[option.provider]}`,
                  option.email,
                ),
              )}
              {radio(NONE, "Nessuno")}
            </div>
          </div>
        )}
        {failed ? <Alert variant="errore">{SAVE_ERROR}</Alert> : null}
      </form>
    </Sheet>
  );
}
