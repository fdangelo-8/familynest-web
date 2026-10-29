"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button/Button";
import {
  ColorChoice,
  type ChoosableColor,
  type TakenColor,
} from "@/components/ui/ColorChoice/ColorChoice";
import {
  INVITE_PROVISIONAL_INTRO,
  MemberSheet,
  type MemberSaveResult,
  type MemberValues,
} from "@/components/ui/MemberSheet/MemberSheet";
import { SegmentedControl } from "@/components/ui/SegmentedControl/SegmentedControl";
import styles from "../gallery.module.css";

const TAKEN: TakenColor[] = [
  { color: "pomodoro", by: "Marco" },
  { color: "glicine", by: "Laura" },
  { color: "zafferano" },
];

const OUTCOMES = {
  ok: "Riuscito",
  colore: "Colore preso",
  completo: "Al completo",
  rete: "Rete",
  server: "Server",
  lento: "Lento",
} as const;
type Outcome = keyof typeof OUTCOMES;

const RESULTS: Record<Outcome, MemberSaveResult> = {
  ok: { ok: true },
  colore: { ok: false, reason: "color-taken" },
  completo: { ok: false, reason: "full" },
  rete: { ok: false, reason: "network" },
  server: { ok: false, reason: "server" },
  lento: { ok: true },
};

type Which = "add" | "edit" | "invite" | null;

/** Page used by the tests: the sheet never writes anywhere. */
export function MembersDemo() {
  const [which, setWhich] = useState<Which>(null);
  const [outcome, setOutcome] = useState<Outcome>("ok");
  const [color, setColor] = useState<ChoosableColor | null>("salvia");
  const [saved, setSaved] = useState<MemberValues | null>(null);
  const [calls, setCalls] = useState(0);

  return (
    <main className={styles.pagina}>
      <h1 className="t-titolo-pagina">Membri</h1>

      <div className="campo">
        <span className="campo__etichetta">Scelta del colore</span>
        <ColorChoice
          aria-label="Il tuo colore"
          value={color}
          onChange={setColor}
          taken={TAKEN}
          data-testid="scelta-colore-demo"
        />
      </div>

      <SegmentedControl
        paper
        aria-label="Esito del salvataggio"
        value={outcome}
        onChange={setOutcome}
        options={(Object.keys(OUTCOMES) as Outcome[]).map((value) => ({
          value,
          label: OUTCOMES[value],
        }))}
      />

      <Button variant="tratteggiato" onClick={() => setWhich("add")}>
        Aggiungi una persona o un animale
      </Button>
      <Button variant="secondary" onClick={() => setWhich("edit")}>
        Modifica Sofia
      </Button>
      <Button variant="secondary" onClick={() => setWhich("invite")}>
        Invita qualcuno
      </Button>

      <p data-testid="membri-chiamate">Chiamate: {calls}</p>
      <p data-testid="membri-salvato">
        {saved ? JSON.stringify(saved) : "Niente salvato"}
      </p>

      <MemberSheet
        open={which !== null}
        mode={which ?? "add"}
        defaultKind="child"
        member={{
          name: "Sofia",
          kind: "child",
          color: "salvia",
          birthDate: "2016-12-14",
        }}
        taken={TAKEN}
        intro={INVITE_PROVISIONAL_INTRO}
        onClose={() => setWhich(null)}
        onSave={async () => {
          setCalls((n) => n + 1);
          await new Promise((resolve) =>
            setTimeout(resolve, outcome === "lento" ? 2000 : 300),
          );
          return RESULTS[outcome];
        }}
        onSaved={setSaved}
      />
    </main>
  );
}
