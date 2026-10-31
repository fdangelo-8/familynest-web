import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarAction,
  BarActionProvider,
  BarActionSlot,
} from "@/components/ui/AppFrame/BarAction";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog/ConfirmDialog";
import { PageError } from "@/components/ui/PageError/PageError";

// Browser harness for the shared components of #165 (ConfirmDialog with async
// actions, BarAction, PageError with `action`). No page uses them yet, so the
// tests bundle this file (see ../component-harness.ts) and mount a scenario
// on a public page of the app. It runs in the browser, never in Node.

type Pending = {
  resolve: (value: boolean | undefined) => void;
  reject: () => void;
};

export type HarnessControl = {
  /** Labels of the actions clicked, in order */
  calls: string[];
  pending: Pending[];
  /** Settles the oldest pending action: `undefined` = ok, `false` = failed */
  resolve: (value?: boolean) => void;
  reject: () => void;
};

export type Scenario = "dialogo" | "barra" | "errore-pagina";

declare global {
  interface Window {
    __ctl: HarnessControl;
    __mount: (scenario: Scenario) => void;
  }
}

const ctl: HarnessControl = {
  calls: [],
  pending: [],
  resolve: (value) => ctl.pending.shift()?.resolve(value),
  reject: () => ctl.pending.shift()?.reject(),
};
window.__ctl = ctl;

function slowAction(label: string) {
  return () =>
    new Promise<void | boolean>((resolve, reject) => {
      ctl.calls.push(label);
      ctl.pending.push({ resolve, reject });
    });
}

function DialogScenario() {
  const [open, setOpen] = useState(false);
  const [closed, setClosed] = useState(0);
  return (
    <div>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => setOpen(true)}
      >
        Apri dialogo
      </button>
      <p data-testid="chiusure">Chiusure: {closed}</p>
      <ConfirmDialog
        open={open}
        onClose={() => {
          setOpen(false);
          setClosed((n) => n + 1);
        }}
        title="Eliminare «Nuoto Sofia»?"
        text="Si ripete ogni martedì e giovedì."
        errorText="Non siamo riusciti a eliminare l'impegno. Riprova."
        actions={[
          {
            label: "Elimina tutti i prossimi",
            variant: "secondary",
            onClick: slowAction("Elimina tutti i prossimi"),
          },
          {
            label: "Elimina solo questo",
            variant: "pericolo-pieno",
            onClick: slowAction("Elimina solo questo"),
          },
        ]}
        data-testid="dialogo-prova"
      />
    </div>
  );
}

function BarScenario() {
  const [shown, setShown] = useState(true);
  const [inactive, setInactive] = useState(false);
  const [presses, setPresses] = useState(0);
  return (
    <BarActionProvider>
      <header className="barra" data-testid="barra-prova">
        <span className="barra__vuoto" aria-hidden="true" />
        <div className="barra__centro" />
        <BarActionSlot />
      </header>
      <section>
        {shown ? (
          <BarAction
            icon="pencil"
            label="Modifica"
            inactive={inactive}
            onClick={() => setPresses((n) => n + 1)}
          />
        ) : null}
        <button type="button" onClick={() => setInactive((v) => !v)}>
          Cambia stato
        </button>
        <button type="button" onClick={() => setShown((v) => !v)}>
          Mostra o nascondi
        </button>
        <p data-testid="pressioni">Pressioni: {presses}</p>
      </section>
    </BarActionProvider>
  );
}

function ErrorScenario() {
  const [retries, setRetries] = useState(0);
  return (
    <div>
      <PageError
        action={{
          label: "Vai al calendario",
          href: "#calendario",
          icon: "calendar",
        }}
        title="Questo impegno non c'è più"
        text="Può essere stato eliminato."
        icon="calendar"
        data-testid="errore-azione"
      />
      <PageError
        onRetry={() => setRetries((n) => n + 1)}
        data-testid="errore-riprova"
      />
      <p data-testid="riprova-conteggio">Riprova: {retries}</p>
    </div>
  );
}

window.__mount = (scenario) => {
  document.getElementById("harness-root")?.remove();
  const host = document.createElement("div");
  host.id = "harness-root";
  document.body.append(host);
  const node =
    scenario === "dialogo" ? (
      <DialogScenario />
    ) : scenario === "barra" ? (
      <BarScenario />
    ) : (
      <ErrorScenario />
    );
  createRoot(host).render(node);
};
