"use client";

import { useRef, useState, type ReactNode } from "react";
import { BottomNavView } from "@/components/ui/AppFrame/BottomNav";
import { NestProvider } from "@/components/ui/AppFrame/NestProvider";
import { Shell } from "@/components/ui/AppFrame/Shell";
import { SideNav } from "@/components/ui/AppFrame/SideNav";
import { Button } from "@/components/ui/Button/Button";
import { Panel } from "@/components/ui/Panel/Panel";
import { Tooltip } from "@/components/ui/Tooltip/Tooltip";
import styles from "./gallery.module.css";

/**
 * Examples of the new frame (F5 #506), shown only with `?guscio=1` so the
 * reference of the whole gallery does not change. The page is drawn inside a
 * real `Shell` with the real `SideNav`, so the panel can be measured beside
 * the content: the sidebar goes to icons and the content gets narrower.
 */
export function ShellDemo() {
  return (
    <NestProvider
      nestName={null}
      members={[
        { name: "Marco", color: "pomodoro" },
        { name: "Laura", color: "glicine" },
        { name: "Sofia", color: "salvia" },
      ]}
      me={{ name: "Marco", color: "pomodoro" }}
      startLens="io"
      defaultVisibility="household"
    >
      <Shell sidebar={<SideNav />}>
        <main
          id="contenuto"
          tabIndex={-1}
          className={styles.pagina}
          data-testid="guscio-contenuto"
        >
          <h1 className="t-titolo-pagina">Guscio</h1>
          <BottomBarExamples />
          <PanelExample />
          <TooltipExample />
        </main>
      </Shell>
    </NestProvider>
  );
}

function Frame({
  caption,
  children,
}: {
  caption: string;
  children: ReactNode;
}) {
  return (
    <figure className={styles.esempio}>
      <figcaption className={styles.didascalia}>{caption}</figcaption>
      <div className={styles.guscioProva}>{children}</div>
    </figure>
  );
}

function BottomBarExamples() {
  return (
    <section className={styles.sezione} id="barra-basso">
      <h2 className={styles.titolo}>Barra in basso</h2>
      <div className={styles.esempi}>
        <Frame caption="barra-basso · Oggi scelta">
          <BottomNavView pathname="/oggi" />
        </Frame>
        <Frame caption="barra-basso · Spazi con novità">
          <BottomNavView pathname="/spazi" spacesNews />
        </Frame>
      </div>
    </section>
  );
}

function PanelExample() {
  const [open, setOpen] = useState(false);
  // The panel gives the focus back to the control that opened it (§7).
  const opener = useRef<HTMLButtonElement>(null);
  return (
    <section className={styles.sezione} id="pannello">
      <h2 className={styles.titolo}>Pannello</h2>
      <div className={styles.esempi}>
        <figure className={styles.esempio}>
          <figcaption className={styles.didascalia}>
            pannello · si apre a destra, la barra va a icone
          </figcaption>
          <Button
            variant="secondary"
            buttonRef={opener}
            aria-haspopup="dialog"
            data-testid="pannello-apri"
            onClick={() => setOpen(true)}
          >
            Apri il pannello
          </Button>
        </figure>
      </div>
      <Panel
        open={open}
        onClose={() => setOpen(false)}
        title="Dettaglio di prova"
        data-testid="pannello-prova"
        footerStart={<Button variant="pericolo">Elimina</Button>}
        footerEnd={
          <>
            <Button variant="quieto" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button onClick={() => setOpen(false)}>Salva</Button>
          </>
        }
      >
        <p>Il contenuto del pannello scorre, la testata e il piede restano.</p>
      </Panel>
    </section>
  );
}

function TooltipExample() {
  return (
    <section className={styles.sezione} id="fumetto">
      <h2 className={styles.titolo}>Fumetto delle icone</h2>
      <div className={styles.esempi}>
        <figure className={styles.esempio}>
          <figcaption className={styles.didascalia}>
            fumetto · mouse e fuoco da tastiera, Esc lo nasconde
          </figcaption>
          <Tooltip label="Nome della voce">
            <Button variant="secondary" data-testid="fumetto-prova">
              Voce
            </Button>
          </Tooltip>
        </figure>
      </div>
    </section>
  );
}
