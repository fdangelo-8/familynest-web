"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Alert } from "@/components/ui/Alert/Alert";
import { Avatar, MEMBER_COLORS } from "@/components/ui/Avatar/Avatar";
import { Button } from "@/components/ui/Button/Button";
import { Card } from "@/components/ui/Card/Card";
import { Checkbox } from "@/components/ui/Checkbox/Checkbox";
import { Chip, ChipGroup } from "@/components/ui/Chip/Chip";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import {
  DateField,
  FieldPair,
  SelectField,
  TextField,
  TimeField,
} from "@/components/ui/Field/Field";
import { Icon } from "@/components/ui/Icon/Icon";
import { IconButton } from "@/components/ui/IconButton/IconButton";
import { List, ListRow } from "@/components/ui/List/List";
import { PageError } from "@/components/ui/PageError/PageError";
import { QuickAddField } from "@/components/ui/QuickAddField/QuickAddField";
import { SectionSwitcher } from "@/components/ui/SegmentedControl/SectionSwitcher";
import { SegmentedControl } from "@/components/ui/SegmentedControl/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet/Sheet";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton/Skeleton";
import { Spinner } from "@/components/ui/Spinner/Spinner";
import { Tag } from "@/components/ui/Tag/Tag";
import { Toggle } from "@/components/ui/Toggle/Toggle";
import { useToast } from "@/components/ui/Toast/ToastProvider";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import styles from "./gallery.module.css";

function colorLabel(color: string) {
  return color.charAt(0).toLocaleUpperCase("it-IT") + color.slice(1);
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={styles.sezione}>
      <h2 className={styles.titolo}>{title}</h2>
      <div className={styles.esempi}>{children}</div>
    </section>
  );
}

function Example({
  caption,
  children,
}: {
  caption: string;
  children: ReactNode;
}) {
  return (
    <figure className={styles.esempio}>
      <figcaption className={styles.didascalia}>{caption}</figcaption>
      <div>{children}</div>
    </figure>
  );
}

// The query string never changes while the page is open: nothing to watch.
function subscribeNever() {
  return () => {};
}

// #133: the clickable-row cards for the hover tests are shown only with
// ?righe-scheda=1, so the reference of the whole gallery does not change.
export function Gallery() {
  const rowCards = useSyncExternalStore(
    subscribeNever,
    () =>
      new URLSearchParams(window.location.search).get("righe-scheda") === "1",
    () => false,
  );
  return (
    <main className={styles.pagina}>
      <h1 className="t-titolo-pagina">Design system</h1>
      <TypographySection />
      <ButtonsSection />
      <FieldsSection />
      <ControlsSection />
      <PeopleSection />
      <ListSection rowCards={rowCards} />
      <OverlaysSection />
      <StatesSection />
    </main>
  );
}

function TypographySection() {
  return (
    <>
      <Section id="t-display" title="Testo">
        <Example caption="t-display">
          <p className="t-display" data-testid="t-display-esempio">
            Buon pomeriggio
          </p>
        </Example>
        <Example caption="t-titolo-pagina">
          <p className="t-titolo-pagina" data-testid="t-titolo-pagina-esempio">
            Calendari collegati
          </p>
        </Example>
        <Example caption="t-titolo-scheda">
          <p className="t-titolo-scheda">Completa il profilo di Sofia</p>
        </Example>
        <Example caption="t-frase">
          <p className="t-frase">Stasera siete liberi insieme dalle 21:30.</p>
        </Example>
        <Example caption="t-numero">
          <p className="t-numero">14</p>
        </Example>
        <Example caption="t-sezione">
          <p className="t-sezione">Questa settimana</p>
        </Example>
        <Example caption="t-corpo-forte">
          <p className="t-corpo-forte">Nuoto Sofia</p>
        </Example>
        <Example caption="t-corpo">
          <p className="t-corpo">Piscina comunale, la porta Laura</p>
        </Example>
        <Example caption="t-controllo">
          <p className="t-controllo">Aggiungi</p>
        </Example>
        <Example caption="t-nota">
          <p className="t-nota">Entro giovedì</p>
        </Example>
        <Example caption="t-etichetta">
          <p className="t-etichetta">OUTLOOK</p>
        </Example>
        <Example caption="t-micro">
          <p className="t-micro">Lun</p>
        </Example>
        <Example caption="t-secondario · t-forte · t-allerta">
          <p className="t-corpo">
            <span className="t-secondario">Secondario</span> ·{" "}
            <span className="t-forte">Forte</span> ·{" "}
            <span className="t-allerta">Scade il 3 novembre</span>
          </p>
        </Example>
      </Section>
      <Section id="icona" title="Icona">
        <Example caption="icona--s · icona · icona--l">
          <div className={styles.riga}>
            <Icon name="calendar" size="s" />
            <Icon name="calendar" />
            <Icon name="calendar" size="l" />
          </div>
        </Example>
      </Section>
      <Section
        id="visivamente-nascosto"
        title="Testo solo per lettori di schermo"
      >
        <Example caption="visivamente-nascosto">
          <p className="t-secondario">
            Dopo questa frase c&apos;è un testo che si vede solo con il lettore
            di schermo.
            <VisuallyHidden>Testo nascosto di esempio</VisuallyHidden>
          </p>
        </Example>
      </Section>
    </>
  );
}

function ButtonsSection() {
  const [primaryClicks, setPrimaryClicks] = useState(0);
  const [secondaryClicks, setSecondaryClicks] = useState(0);
  const bump = () => setPrimaryClicks((n) => n + 1);

  return (
    <>
      <Section id="btn-primary" title="Bottone principale">
        <Example caption="btn-primary · predefinito">
          <Button full onClick={bump} data-testid="btn-primary-predefinito">
            Continua
          </Button>
        </Example>
        <Example caption="btn-primary--freccia">
          <Button arrow type="submit" data-testid="btn-primary-freccia">
            Metti in giovedì 22
          </Button>
        </Example>
        <Example caption="btn-primary · normale">
          <Button icon="check" onClick={bump} data-testid="btn-primary-normale">
            Salva
          </Button>
        </Example>
        <Example caption="btn-primary · disabilitato">
          <Button
            icon="check"
            disabled
            onClick={bump}
            data-testid="btn-primary-disabilitato"
          >
            Salva
          </Button>
        </Example>
        <Example caption="btn-primary · caricamento">
          <Button loading onClick={bump} data-testid="btn-primary-caricamento">
            Salvataggio
          </Button>
        </Example>
        <Example caption="btn-primary · caricamento con freccia">
          <Button
            arrow
            loading
            type="submit"
            data-testid="btn-primary-freccia-caricamento"
          >
            Metti in giovedì 22
          </Button>
        </Example>
        <Example caption="contatore di clic">
          <p className={styles.contatore} data-testid="btn-primary-clic">
            Clic: {primaryClicks}
          </p>
        </Example>
      </Section>

      <Section id="btn-secondary" title="Bottone secondario">
        <Example caption="btn-secondary · predefinito">
          <Button
            variant="secondary"
            full
            onClick={() => setSecondaryClicks((n) => n + 1)}
            data-testid="btn-secondary-predefinito"
          >
            Aggiungi a mano
          </Button>
        </Example>
        <Example caption="btn-secondary · disabilitato">
          <Button
            variant="secondary"
            disabled
            data-testid="btn-secondary-disabilitato"
          >
            Indicazioni
          </Button>
        </Example>
        <Example caption="contatore di clic">
          <p className={styles.contatore} data-testid="btn-secondary-clic">
            Clic: {secondaryClicks}
          </p>
        </Example>
        <Example caption="btn-secondary · normale">
          <Button variant="secondary" icon="check">
            Salva
          </Button>
        </Example>
        <Example caption="btn-secondary · caricamento">
          <Button variant="secondary" loading full>
            Accesso con Google in corso
          </Button>
        </Example>
        <Example caption="btn-secondary · disabilitato, pieno">
          <Button variant="secondary" icon="apple" disabled full>
            Entra con Apple
          </Button>
        </Example>
        <Example caption="btn-secondary · btn--piccolo">
          <Button variant="secondary" small icon="rotate-cw">
            Riprova
          </Button>
        </Example>
        <Example caption="btn-secondary · btn--pieno">
          <Button variant="secondary" full>
            Continua
          </Button>
        </Example>
      </Section>

      <Section id="btn-chiaro" title="Bottone chiaro">
        <Example caption="btn-chiaro · predefinito">
          <div className="tema-notte">
            <div className={styles.notte}>
              <Button variant="chiaro" data-testid="btn-chiaro-predefinito">
                Entra in Casa D&apos;Angelo
              </Button>
            </div>
          </div>
        </Example>
        <Example caption="btn-chiaro · pieno, disabilitato, caricamento">
          <div className="tema-notte">
            <div className={styles.notte}>
              <div className={styles.colonna}>
                <Button variant="chiaro" icon="apple" full>
                  Continua con Apple
                </Button>
                <Button variant="chiaro" icon="apple" full disabled>
                  Continua con Apple
                </Button>
                <Button variant="chiaro" full loading>
                  Accesso con Google in corso
                </Button>
              </div>
            </div>
          </div>
        </Example>
        <Example caption="btn-chiaro · normale, disabilitato, caricamento">
          <div className="tema-notte">
            <div className={styles.notte}>
              <div className={styles.riga}>
                <Button variant="chiaro" icon="check">
                  Salva
                </Button>
                <Button variant="chiaro" icon="check" disabled>
                  Salva
                </Button>
                <Button variant="chiaro" loading>
                  Salvataggio
                </Button>
              </div>
            </div>
          </div>
        </Example>
        <Example caption="btn-chiaro · btn--piccolo, btn--pieno">
          <div className="tema-notte">
            <div className={styles.notte}>
              <div className={styles.colonna}>
                <Button variant="chiaro" small icon="rotate-cw">
                  Riprova
                </Button>
                <Button variant="chiaro" full>
                  Continua
                </Button>
              </div>
            </div>
          </div>
        </Example>
      </Section>

      <Section id="btn-tenue" title="Bottone tenue">
        <Example caption="btn-tenue · predefinito">
          <Button
            variant="tenue"
            icon="copy"
            data-testid="btn-tenue-predefinito"
          >
            Copia il link
          </Button>
        </Example>
      </Section>

      <Section id="btn-tratteggiato" title="Bottone tratteggiato">
        <Example caption="btn-tratteggiato · predefinito">
          <Button
            variant="tratteggiato"
            icon="plus"
            data-testid="btn-tratteggiato-predefinito"
          >
            Aggiungi una persona
          </Button>
        </Example>
      </Section>

      <Section id="btn-link" title="Link-bottone">
        <Example caption="btn-link · link (con href)">
          <Button
            variant="link"
            href="/design-system"
            data-testid="btn-link-link"
          >
            Usa la mail
          </Button>
        </Example>
        <Example caption="btn-link · azione (senza href)">
          <Button variant="link" data-testid="btn-link-azione">
            Usa la mail
          </Button>
        </Example>
        <Example caption="btn-link--secondario">
          <Button variant="link-secondario" data-testid="btn-link-secondario">
            Più tardi
          </Button>
        </Example>
      </Section>

      <Section id="btn-pericolo" title="Bottone pericoloso">
        <Example caption="btn-pericolo · predefinito">
          <Button variant="pericolo" data-testid="btn-pericolo-predefinito">
            Elimina impegno
          </Button>
        </Example>
      </Section>

      <Section id="btn-pericolo-pieno" title="Bottone pericoloso pieno">
        <Example caption="btn-pericolo-pieno · predefinito">
          <Button
            variant="pericolo-pieno"
            data-testid="btn-pericolo-pieno-predefinito"
          >
            Elimina solo questo
          </Button>
        </Example>
      </Section>

      <Section id="btn-icona" title="Bottone icona">
        <Example caption="btn-icona · predefinito">
          <IconButton
            icon="arrow-left"
            aria-label="Indietro"
            data-testid="btn-icona-predefinito"
          />
        </Example>
        <Example caption="btn-icona--carta">
          <IconButton
            icon="mic"
            paper
            aria-label="Detta a voce"
            data-testid="btn-icona-carta"
          />
        </Example>
        <Example caption="btn-icona--piccolo">
          <IconButton
            icon="pencil"
            small
            aria-label="Modifica Marco"
            data-testid="btn-icona-piccolo"
          />
        </Example>
        <Example caption="btn-icona · con btn-icona__punto">
          <IconButton
            icon="bell"
            dot
            aria-label="Notifiche, 3 nuove"
            data-testid="btn-icona-punto"
          />
        </Example>
        <Example caption="btn-icona · scelto">
          <IconButton
            icon="pin"
            pressed
            aria-label="Togli A tavola da Oggi"
            data-testid="btn-icona-scelto"
          />
        </Example>
      </Section>

      <Section id="spinner" title="Spinner">
        <Example caption="spinner · predefinito">
          <Spinner />
        </Example>
      </Section>
    </>
  );
}

function FieldsSection() {
  const [kind, setKind] = useState("Ogni martedì e giovedì");
  const [quickText, setQuickText] = useState("");
  const [quickSent, setQuickSent] = useState<string[]>([]);
  return (
    <>
      <Section id="campo" title="Campo">
        <Example caption="campo · predefinito">
          <TextField
            label="Nome"
            name="nome"
            defaultValue="Sofia"
            placeholder="Come si chiama?"
            data-testid="campo-predefinito"
          />
        </Example>
        <Example caption="campo--errore">
          <TextField
            label="Nome"
            name="nome-errore"
            placeholder="Come si chiama?"
            error="Scrivi il nome per continuare."
            data-testid="campo-errore"
          />
        </Example>
        <Example caption="campo · con aiuto">
          <TextField
            label="Nome del Nest"
            name="nest"
            help="Lo vedono solo le persone che inviti."
            placeholder="Es. Casa D'Angelo"
            data-testid="campo-aiuto"
          />
        </Example>
        <Example caption="campo · disabilitato">
          <TextField
            label="Nome"
            name="nome-disabilitato"
            defaultValue="Sofia"
            disabled
            data-testid="campo-disabilitato"
          />
        </Example>
        <Example caption="campo · più righe">
          <TextField
            multiline
            label="Nota"
            name="nota"
            placeholder="Scrivi una nota"
            data-testid="campo-nota"
          />
        </Example>
        <Example caption="campo · con campo__select-box">
          <SelectField
            label="Si ripete"
            name="ripetizione"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            data-testid="campo-select"
          >
            <option>Ogni martedì e giovedì</option>
            <option>Mai</option>
            <option>Ogni settimana</option>
            <option>Ogni mese</option>
          </SelectField>
        </Example>
      </Section>

      <Section id="campo-doppio" title="Campo doppio">
        <Example caption="campo-doppio · data e ora">
          <FieldPair>
            <DateField
              label="Giorno"
              name="giorno"
              defaultValue="2026-10-20"
              data-testid="campo-data"
            />
            <TimeField
              label="Ora"
              name="ora"
              defaultValue="17:00"
              data-testid="campo-ora"
            />
          </FieldPair>
        </Example>
      </Section>

      <Section id="campo-rapido" title="Campo rapido">
        <Example caption="campo-rapido · normale">
          <div className={styles.campoRapido}>
            <QuickAddField
              label="Aggiungi alla spesa…"
              value={quickText}
              onChange={setQuickText}
              onSubmit={(text) => setQuickSent((list) => [...list, text])}
              data-testid="campo-rapido-normale"
            />
            <p className={styles.contatore} data-testid="campo-rapido-inviati">
              Inviati:{" "}
              {quickSent.length > 0 ? quickSent.join(" | ") : "nessuno"}
            </p>
          </div>
        </Example>
        <Example caption="campo-rapido--attivo">
          <QuickAddField
            label="Cosa manca in casa?"
            value=""
            onChange={() => undefined}
            onSubmit={() => undefined}
            active
            data-testid="campo-rapido-attivo"
          />
        </Example>
      </Section>
    </>
  );
}

function ControlsSection() {
  const [emptyBox, setEmptyBox] = useState(false);
  const [fullBox, setFullBox] = useState(true);
  const [off, setOff] = useState(false);
  const [on, setOn] = useState(true);
  const [view, setView] = useState("settimana");
  const [paperView, setPaperView] = useState("figlio");
  const [chipA, setChipA] = useState(false);
  const [chipB, setChipB] = useState(false);
  const [roundEmpty, setRoundEmpty] = useState(false);
  const [roundFull, setRoundFull] = useState(true);
  const [roundRow1, setRoundRow1] = useState(false);
  const [roundRow2, setRoundRow2] = useState(false);

  return (
    <>
      <Section id="casella" title="Casella">
        <Example caption="casella · vuota">
          <Checkbox
            checked={emptyBox}
            onChange={setEmptyBox}
            aria-label="Segna come fatto: Chiamare il commercialista"
            data-testid="casella-vuota"
          />
        </Example>
        <Example caption="casella · attiva">
          <Checkbox
            checked={fullBox}
            onChange={setFullBox}
            aria-label="Segna come fatto: Preparare lo zaino"
            data-testid="casella-piena"
          />
        </Example>
        <Example caption="casella · disabilitata">
          <Checkbox
            checked={false}
            onChange={() => undefined}
            disabled
            aria-label="Segna come fatto: Comprare il pane"
            data-testid="casella-disabilitata"
          />
        </Example>
      </Section>

      <Section id="tondo-spunta" title="Spunta tonda">
        <Example caption="tondo-spunta · vuoto">
          <Checkbox
            variant="round"
            checked={roundEmpty}
            onChange={setRoundEmpty}
            aria-label="Preso: Latte"
            data-testid="tondo-vuoto"
          />
        </Example>
        <Example caption="tondo-spunta · pieno">
          <Checkbox
            variant="round"
            checked={roundFull}
            onChange={setRoundFull}
            aria-label="Rimetti in lista: Pane"
            data-testid="tondo-pieno"
          />
        </Example>
        <Example caption="tondo-spunta · disabilitato">
          <Checkbox
            variant="round"
            checked={false}
            onChange={() => undefined}
            disabled
            aria-label="Preso: Uova"
            data-testid="tondo-disabilitato"
          />
        </Example>
        <Example caption="tondo-spunta · in una lista">
          <List className="scheda">
            <ListRow>
              <Checkbox
                variant="round"
                checked={roundRow1}
                onChange={setRoundRow1}
                aria-label="Preso: Latte"
                data-testid="tondo-riga-1"
              />
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">Latte</span>
              </span>
            </ListRow>
            <ListRow>
              <Checkbox
                variant="round"
                checked={roundRow2}
                onChange={setRoundRow2}
                aria-label="Preso: Pane"
                data-testid="tondo-riga-2"
              />
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">Pane</span>
              </span>
            </ListRow>
          </List>
        </Example>
      </Section>

      <Section id="toggle" title="Interruttore">
        <Example caption="toggle · spento">
          <div className={styles.riga}>
            <Toggle
              checked={off}
              onChange={setOff}
              aria-label="Anche su Google"
              data-testid="toggle-spento"
            />
            <span data-testid="toggle-stato">{off ? "Acceso" : "Spento"}</span>
          </div>
        </Example>
        <Example caption="toggle · attivo">
          <Toggle
            checked={on}
            onChange={setOn}
            aria-label="Sincronizza Lavoro"
            data-testid="toggle-acceso"
          />
        </Example>
        <Example caption="toggle · disabilitato">
          <Toggle
            checked={false}
            onChange={() => undefined}
            disabled
            aria-label="Avvisi di gruppo"
            data-testid="toggle-disabilitato"
          />
        </Example>
      </Section>

      <Section id="selettore" title="Selettore">
        <Example caption="selettore · predefinito">
          <SegmentedControl
            aria-label="Vista del calendario"
            value={view}
            onChange={setView}
            options={[
              { value: "giorno", label: "Giorno" },
              { value: "settimana", label: "Settimana" },
              { value: "mese", label: "Mese" },
            ]}
            data-testid="selettore-predefinito"
          />
        </Example>
        <Example caption="selettore--carta">
          <SegmentedControl
            aria-label="Chi è"
            paper
            value={paperView}
            onChange={setPaperView}
            options={[
              { value: "adulto", label: "Adulto" },
              { value: "figlio", label: "Figlio o figlia" },
              { value: "animale", label: "Animale" },
            ]}
            data-testid="selettore-carta"
          />
        </Example>
        <Example caption="selettore · con selettore__conteggio">
          <SegmentedControl
            aria-label="Sezione della casa"
            value="spesa"
            onChange={() => undefined}
            options={[
              { value: "spesa", label: "Spesa", count: 4 },
              { value: "da-fare", label: "Da fare", count: 4 },
              { value: "scadenze", label: "Scadenze", count: 4 },
            ]}
            data-testid="selettore-conteggio"
          />
        </Example>
        <Example caption="selettore · con voci-link">
          <SectionSwitcher
            aria-label="Sezione della casa"
            current="spesa"
            items={[
              { key: "spesa", label: "Spesa", href: "/casa/spesa", count: 4 },
              {
                key: "da-fare",
                label: "Da fare",
                href: "/casa/da-fare",
                count: 0,
              },
              {
                key: "scadenze",
                label: "Scadenze",
                href: "/casa/scadenze",
                count: 120,
              },
            ]}
            data-testid="selettore-link"
          />
        </Example>
      </Section>

      <Section id="chip" title="Chip">
        <Example caption="chip · predefinito">
          <ChipGroup
            aria-label="Quando avvisare"
            data-testid="chip-predefinito"
          >
            <Chip pressed={chipA} onClick={() => setChipA((v) => !v)}>
              30 giorni prima
            </Chip>
            <Chip pressed={chipB} onClick={() => setChipB((v) => !v)}>
              7 giorni prima
            </Chip>
          </ChipGroup>
        </Example>
        <Example caption="chip--persona">
          <ChipGroup aria-label="Per chi">
            <Chip
              person
              pressed
              leading={<Avatar name="Laura" color="glicine" nameShown />}
              onClick={() => undefined}
            >
              Laura
            </Chip>
          </ChipGroup>
        </Example>
        <Example caption="chip--statico">
          <Chip static icon="calendar" data-testid="chip-statico">
            Giovedì 22
          </Chip>
        </Example>
        <Example caption="chip · con chip__conteggio">
          <Chip pressed count={5} onClick={() => undefined}>
            Tutto
          </Chip>
        </Example>
        <Example caption="chip · disabilitato">
          <Chip disabled>Solo adulti</Chip>
        </Example>
        <Example caption="chip · con chip__valore">
          <Chip static>
            Scarpe <span className="chip__valore">33</span>
          </Chip>
        </Example>
      </Section>
    </>
  );
}

function PeopleSection() {
  return (
    <>
      <Section id="avatar" title="Avatar">
        <Example caption="avatar--xs · predefinito · --m · --l · --xl">
          <div className={styles.riga}>
            <span data-testid="avatar-xs">
              <Avatar name="Marco" color="pomodoro" size="xs" />
            </span>
            <span data-testid="avatar-s">
              <Avatar name="Sofia" color="salvia" />
            </span>
            <span data-testid="avatar-m">
              <Avatar name="Marco" color="pomodoro" size="m" />
            </span>
            <span data-testid="avatar-l">
              <Avatar name="Marco" color="pomodoro" size="l" />
            </span>
            <span data-testid="avatar-xl">
              <Avatar name="Marco" color="pomodoro" size="xl" />
            </span>
          </div>
        </Example>
        <Example caption="avatar--punto">
          <span data-testid="avatar-punto">
            <Avatar name="Sofia" color="salvia" dot />
          </span>
        </Example>
        <Example caption="avatar--vuoto">
          <div className="tema-notte">
            <div className={styles.notte}>
              <span
                className="avatar avatar--xl avatar--vuoto"
                aria-hidden="true"
              >
                ?
              </span>
            </div>
          </div>
        </Example>
        <Example caption="avatar · cobalto, senza nome accanto">
          <span data-testid="avatar-cobalto">
            <Avatar name="Laura" color="cobalto" size="l" />
          </span>
        </Example>
        <Example caption="avatar · con il nome accanto">
          <div className={styles.riga} data-testid="avatar-con-nome">
            <Avatar name="Laura" color="cobalto" size="l" nameShown />
            <span>Laura</span>
          </div>
        </Example>
        <Example caption="avatar · tutti i colori">
          <div className={styles.riga}>
            <Avatar name="Marco" color="pomodoro" size="m" nameShown />
            <Avatar name="Laura" color="glicine" size="m" nameShown />
            <Avatar name="Sofia" color="salvia" size="m" nameShown />
            <Avatar name="Tommaso" color="cobalto" size="m" nameShown />
            <Avatar name="Biscotto" color="zafferano" size="m" nameShown />
            <Avatar name="Insieme" color="insieme" size="m" nameShown />
          </div>
        </Example>
        <Example caption="avatar · i 10 colori dei membri">
          <div className={styles.riga} data-testid="avatar-dieci-colori">
            {MEMBER_COLORS.filter((color) => color !== "insieme").map(
              (color) => (
                <Avatar
                  key={color}
                  name={colorLabel(color)}
                  color={color}
                  size="m"
                />
              ),
            )}
          </div>
        </Example>
        <Example caption="scelta-colore · 10 colori">
          <div
            className="scelta-colore"
            role="radiogroup"
            aria-label="Il tuo colore"
            data-testid="scelta-colore-dieci"
          >
            {MEMBER_COLORS.filter((color) => color !== "insieme").map(
              (color, index) => {
                const taken = color === "glicine" || color === "salvia";
                return (
                  <button
                    key={color}
                    type="button"
                    role="radio"
                    aria-checked={index === 0}
                    aria-label={
                      taken
                        ? `${colorLabel(color)} (già usato)`
                        : colorLabel(color)
                    }
                    disabled={taken}
                    className={`scelta-colore__colore membro-${color}`}
                  />
                );
              },
            )}
          </div>
        </Example>
      </Section>

      <Section id="etichetta" title="Etichetta">
        <Example caption="etichetta · predefinito">
          <Tag data-testid="etichetta-predefinito">Invito inviato</Tag>
        </Example>
        <Example caption="etichetta--scura">
          <Tag variant="scura" data-testid="etichetta-scura">
            Collegato
          </Tag>
        </Example>
        <Example caption="etichetta--allerta">
          <Tag variant="allerta" data-testid="etichetta-allerta">
            Scade oggi
          </Tag>
        </Example>
        <Example caption="etichetta--insieme">
          <Tag variant="insieme" data-testid="etichetta-insieme">
            Liberi insieme
          </Tag>
        </Example>
        <Example caption="etichetta--piccola">
          <Tag small data-testid="etichetta-piccola">
            Outlook
          </Tag>
        </Example>
      </Section>
    </>
  );
}

function ListSection({ rowCards }: { rowCards: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <>
      <Section id="scheda" title="Scheda">
        <Example caption="scheda · predefinito">
          <Card padded data-testid="scheda-predefinito">
            <p className="t-corpo-forte">Nuoto Sofia</p>
            <p className="t-nota t-secondario">Martedì 20 ottobre, 17:00</p>
          </Card>
        </Example>
        <Example caption="scheda--evidenza">
          <Card highlight padded data-testid="scheda-evidenza">
            <p className="t-corpo-forte">Call con Acme</p>
            <p className="t-nota t-secondario">Fino alle 17:00, Teams</p>
          </Card>
        </Example>
        <Example caption="scheda--carta">
          <Card paper padded data-testid="scheda-carta">
            <p className="t-corpo-forte">Chi porta Sofia?</p>
          </Card>
        </Example>
        <Example caption="scheda--scura">
          <Card dark padded data-testid="scheda-scura">
            <p className="t-corpo-forte">Pronti</p>
          </Card>
        </Example>
        <Example caption="scheda--tratteggiata">
          <Card dashed padded data-testid="scheda-tratteggiata">
            <p className="t-nota t-secondario">Qui andrà il prossimo impegno</p>
          </Card>
        </Example>
        <Example caption="scheda--imbottita">
          <Card padded data-testid="scheda-taglie">
            <div className="gruppo-chip">
              <Chip static>
                Scarpe <span className="chip__valore">33</span>
              </Chip>
              <Chip static>
                Vestiti <span className="chip__valore">9–10</span>
              </Chip>
              <Chip static>
                Pigiama <span className="chip__valore">140</span>
              </Chip>
            </div>
          </Card>
        </Example>
      </Section>

      <Section id="riga-lista" title="Riga di lista">
        <Example caption="riga-lista · predefinito">
          <List className="scheda">
            <ListRow data-testid="riga-lista-predefinita">
              <Avatar name="Marco" color="pomodoro" size="l" nameShown />
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">Marco, tu</span>
                <span className="riga-lista__info">Adulto</span>
              </span>
              <IconButton icon="pencil" small aria-label="Modifica Marco" />
            </ListRow>
          </List>
        </Example>
        <Example caption="riga-lista--cliccabile">
          <List className="scheda">
            <ListRow href="/design-system" data-testid="riga-lista-cliccabile">
              <span className="riga-lista__ora">17:00</span>
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">Nuoto Sofia</span>
                <span className="riga-lista__info">
                  Alle 17:00, la porta Laura
                </span>
              </span>
              <Avatar name="Sofia" color="salvia" nameShown />
            </ListRow>
          </List>
        </Example>
        {rowCards ? (
          <Example caption="riga-lista--cliccabile · righe in una scheda (#133)">
            <List className="scheda" data-testid="scheda-righe">
              {["Marco", "Laura", "Sofia"].map((name) => (
                <ListRow
                  key={name}
                  href="/design-system"
                  data-testid={`scheda-righe-${name.toLowerCase()}`}
                >
                  <span className="riga-lista__testo">
                    <span className="riga-lista__titolo">{name}</span>
                  </span>
                </ListRow>
              ))}
            </List>
            <List className="scheda" data-testid="scheda-riga-unica">
              <ListRow
                href="/design-system"
                data-testid="scheda-riga-unica-riga"
              >
                <span className="riga-lista__testo">
                  <span className="riga-lista__titolo">
                    Manda di nuovo l&apos;invito
                  </span>
                </span>
              </ListRow>
            </List>
          </Example>
        ) : null}
        {rowCards ? (
          <Example caption="testa del profilo in caricamento (#133)">
            <SkeletonGroup data-testid="profilo-testa-skeleton">
              <div className="profilo-testa profilo-testa--riga">
                <Skeleton shape="cerchio" />
                <div className="intestazione">
                  <Skeleton shape="titolo" />
                  <Skeleton shape="testo-corto" />
                </div>
              </div>
            </SkeletonGroup>
          </Example>
        ) : null}
        <Example caption="riga-lista · con casella">
          <List className="scheda">
            <ListRow
              modifier={done ? "riga-lista--fatto" : undefined}
              data-testid="riga-lista-con-casella"
            >
              <Checkbox
                checked={done}
                onChange={setDone}
                aria-label="Segna come fatto: Chiamare il commercialista"
              />
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">
                  Chiamare il commercialista
                </span>
                <span className="riga-lista__info">Entro domani, solo tu</span>
              </span>
              <span className="riga-lista__lucchetto">
                <Icon name="lock" size="s" />
              </span>
            </ListRow>
          </List>
        </Example>
        <Example caption="riga-lista--notte">
          <div className="tema-notte">
            <div className={styles.notte}>
              <List night>
                <ListRow night>
                  <Icon name="calendar-check" />
                  <span className="riga-lista__testo">
                    <span className="riga-lista__titolo">
                      12 impegni arrivati da Outlook
                    </span>
                  </span>
                </ListRow>
              </List>
            </div>
          </div>
        </Example>
        <Example caption="riga-lista--fatto">
          <List className="scheda">
            <ListRow modifier="riga-lista--fatto">
              <Checkbox
                checked
                onChange={() => undefined}
                aria-label="Segna come fatto: Chiamare il commercialista"
              />
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">
                  Chiamare il commercialista
                </span>
                <span className="riga-lista__info">Entro domani, solo tu</span>
              </span>
              <span className="riga-lista__lucchetto">
                <Icon name="lock" size="s" />
              </span>
            </ListRow>
          </List>
        </Example>
        <Example caption="riga-lista--preso">
          <List className="scheda">
            <ListRow modifier="riga-lista--preso">
              <button
                type="button"
                className="tondo-spunta"
                role="checkbox"
                aria-checked="true"
                aria-label="Rimetti in lista: Uova"
              >
                <Icon name="check" size="s" />
              </button>
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">Uova</span>
              </span>
              <span className="riga-lista__valore">
                <span className="riga-lista__quantita">6</span>
                <Avatar name="Marco" color="pomodoro" nameShown />
              </span>
            </ListRow>
          </List>
        </Example>
        <Example caption="riga-lista--senza-inizio">
          <div className="riga-lista riga-lista--senza-inizio">
            <span className="riga-lista__testo">
              <span className="riga-lista__titolo">Sofia</span>
              <span className="riga-lista__info">
                Impegno di Sofia, creato da Laura
              </span>
            </span>
            <Avatar name="Sofia" color="salvia" size="l" nameShown />
          </div>
        </Example>
        <Example caption="riga-lista · selezionata">
          <List>
            <ListRow href="/design-system" modifier="is-selezionata">
              <span className="riga-lista__ora">Oggi</span>
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">
                  <mark className="evidenzia">Nuoto</mark> Sofia
                </span>
                <span className="riga-lista__info">
                  17:00 – 18:30, piscina comunale
                </span>
              </span>
              <kbd className="kbd">↵</kbd>
            </ListRow>
          </List>
        </Example>
        <Example caption="riga-lista · con riga-lista__info--allerta">
          <List className="scheda">
            <ListRow>
              <Checkbox
                checked={false}
                onChange={() => undefined}
                aria-label="Segna come fatto: Firmare autorizzazione gita"
              />
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">
                  Firmare autorizzazione gita
                </span>
                <span className="riga-lista__info riga-lista__info--allerta">
                  Per Sofia, entro venerdì
                </span>
              </span>
              <Avatar name="Marco" color="pomodoro" nameShown />
            </ListRow>
          </List>
        </Example>
      </Section>

      <Section id="strappo" title="Strappo">
        <Example caption="strappo · a riposo">
          <div className="strappo" data-testid="strappo-riposo">
            <span className="strappo__linea" aria-hidden="true" />
            <span className="strappo__testo" aria-hidden="true">
              <span>Trascina per strappare i presi</span>
            </span>
            <button
              type="button"
              className="strappo__lama"
              aria-label="Togli dalla lista le 3 cose prese"
            >
              <Icon name="scissors" />
            </button>
          </div>
        </Example>
        <Example caption="strappo · trascinato">
          <div
            className={`strappo is-trascinato ${styles.strappoTrascinato}`}
            data-testid="strappo-trascinato"
          >
            <span className="strappo__linea" aria-hidden="true" />
            <span className="strappo__testo" aria-hidden="true">
              <span>Trascina per strappare i presi</span>
            </span>
            <button
              type="button"
              className="strappo__lama"
              aria-label="Togli dalla lista le 3 cose prese"
            >
              <Icon name="scissors" />
            </button>
          </div>
        </Example>
      </Section>
    </>
  );
}

function OverlaysSection() {
  const toast = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nestedOpen, setNestedOpen] = useState(false);
  const [nestedDeleted, setNestedDeleted] = useState(0);
  const [confirmed, setConfirmed] = useState(0);
  const [undone, setUndone] = useState(0);

  return (
    <>
      <Section id="foglio" title="Foglio (mobile) e modale (desktop)">
        <Example caption="foglio · sotto 1024 px · modale · da 1024 px">
          <Button
            variant="secondary"
            onClick={() => setSheetOpen(true)}
            data-testid="foglio-apri"
          >
            Apri foglio
          </Button>
          <Sheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title="Aggiungi"
            data-testid="foglio-aperto"
            footer={
              <Button full onClick={() => undefined}>
                Aggiungi
              </Button>
            }
          >
            <TextField
              label="Titolo"
              name="titolo"
              placeholder="Es. Nuoto Sofia"
            />
            <FieldPair>
              <DateField
                label="Giorno"
                name="giorno-foglio"
                defaultValue="2026-10-20"
              />
              <TimeField label="Ora" name="ora-foglio" defaultValue="17:00" />
            </FieldPair>
            <Button
              variant="pericolo"
              onClick={() => setNestedOpen(true)}
              data-testid="foglio-elimina"
            >
              Elimina impegno
            </Button>
            <span className={styles.contatore} data-testid="foglio-eliminati">
              Eliminati: {nestedDeleted}
            </span>
          </Sheet>
          <ConfirmDialog
            open={nestedOpen}
            onClose={() => setNestedOpen(false)}
            title="Eliminare «Nuoto Sofia»?"
            text="Laura e Sofia non lo vedranno più nel calendario."
            actions={[
              {
                label: "Elimina impegno",
                variant: "pericolo-pieno",
                onClick: () => setNestedDeleted((n) => n + 1),
              },
            ]}
            aboveSheet
            data-testid="dialogo-annidato"
          />
        </Example>
      </Section>
      <Section id="modale" title="Modale">
        <Example caption="modale · stesso contenuto del foglio">
          <p className="t-nota t-secondario">
            Da 1024 px il foglio diventa una modale centrata, con lo stesso
            contenuto.
          </p>
        </Example>
      </Section>

      <Section id="dialogo" title="Dialogo di conferma">
        <Example caption="dialogo · predefinito">
          <div className={styles.riga}>
            <Button
              variant="pericolo"
              onClick={() => setDialogOpen(true)}
              data-testid="dialogo-apri"
            >
              Elimina
            </Button>
            <span className={styles.contatore} data-testid="dialogo-conteggio">
              Eliminazioni: {confirmed}
            </span>
          </div>
          <ConfirmDialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            title="Eliminare «Nuoto Sofia»?"
            text="Si ripete ogni martedì e giovedì. Laura e Sofia non lo vedranno più nel calendario."
            actions={[
              {
                label: "Elimina tutti i prossimi",
                variant: "secondary",
                onClick: () => undefined,
              },
              {
                label: "Elimina solo questo",
                variant: "pericolo-pieno",
                onClick: () => setConfirmed((n) => n + 1),
              },
            ]}
            data-testid="dialogo-aperto"
          />
        </Example>
      </Section>

      <Section id="toast" title="Toast">
        <Example caption="toast · con Annulla">
          <div className={styles.riga}>
            <Button
              variant="secondary"
              data-testid="toast-mostra"
              onClick={() =>
                toast.showToast({
                  text: "Fatto:",
                  emphasis: "Chiamare il commercialista",
                  onUndo: () => setUndone((n) => n + 1),
                })
              }
            >
              Mostra toast
            </Button>
            <Button
              variant="secondary"
              data-testid="toast-mostra-altro"
              onClick={() =>
                toast.showToast({
                  text: "Link copiato. Mandalo a Laura dove preferisci.",
                })
              }
            >
              Mostra un altro toast
            </Button>
            <Button
              variant="secondary"
              data-testid="toast-mostra-inizio"
              onClick={() =>
                toast.showToast({
                  lead: "3 cose",
                  text: "tolte dalla lista.",
                  icon: "scissors",
                  onUndo: () => setUndone((n) => n + 1),
                })
              }
            >
              Mostra toast con grassetto all&rsquo;inizio
            </Button>
            <Button
              variant="secondary"
              data-testid="toast-mostra-senza-icona"
              onClick={() =>
                toast.showToast({
                  lead: "Latte",
                  text: "è già in lista.",
                  icon: null,
                })
              }
            >
              Mostra toast senza icona
            </Button>
            <span className={styles.contatore} data-testid="toast-annullato">
              Annullato: {undone}
            </span>
          </div>
        </Example>
      </Section>
    </>
  );
}

function StatesSection() {
  const [retries, setRetries] = useState(0);
  const [exitRetries, setExitRetries] = useState(0);
  return (
    <>
      <Section id="stato-vuoto" title="Stato vuoto">
        <Example caption="stato-vuoto · predefinito">
          <EmptyState
            icon="calendar"
            title="Giornata libera, per ora"
            text="Collega il calendario o"
            actions={<Link href="/design-system">aggiungi un impegno</Link>}
            after="."
            data-testid="stato-vuoto-predefinito"
          />
        </Example>
        <Example caption="stato-vuoto--grande">
          <EmptyState
            large
            title="Questa settimana è ancora vuota"
            text="Porta qui i tuoi impegni da Google, Outlook o iCloud, oppure aggiungili a mano."
            actions={
              <>
                <Button full icon="calendar-arrow-down" href="/design-system">
                  Collega il calendario
                </Button>
                <Button variant="secondary" full href="/design-system">
                  Aggiungi a mano
                </Button>
              </>
            }
            data-testid="stato-vuoto-grande"
          />
        </Example>
      </Section>

      <Section id="skeleton" title="Scheletro di caricamento">
        <Example caption="skeleton · testo, testo-corto, titolo, riga, scheda, cerchio, grande">
          <div className={styles.riga}>
            <Skeleton shape="testo" />
            <Skeleton shape="testo-corto" />
            <Skeleton shape="cerchio" />
          </div>
          <Skeleton shape="riga" />
          <Skeleton shape="scheda" />
          <Skeleton shape="grande" />
        </Example>
        <Example caption="skeleton--testo">
          <Skeleton shape="testo" />
        </Example>
        <Example caption="skeleton--titolo">
          <Skeleton shape="titolo" />
        </Example>
        <Example caption="skeleton--notte">
          <div className="tema-notte">
            <div className={styles.notte}>
              <Skeleton shape="cerchio" night />
            </div>
          </div>
        </Example>
      </Section>
      <Section id="gruppo-skeleton" title="Gruppo di scheletri">
        <Example caption="gruppo-skeleton · predefinito">
          <SkeletonGroup data-testid="gruppo-skeleton">
            <Skeleton shape="cerchio" />
            <Skeleton shape="titolo" />
            <Skeleton shape="testo" />
          </SkeletonGroup>
        </Example>
        <Example caption="gruppo-skeleton · su fondo scuro">
          <div className="tema-notte">
            <div className={styles.notte}>
              <SkeletonGroup>
                <Skeleton shape="cerchio" night />
                <Skeleton shape="titolo" night />
                <Skeleton shape="testo" night />
              </SkeletonGroup>
            </div>
          </div>
        </Example>
      </Section>

      <Section id="avviso" title="Avviso">
        <Example caption="avviso--errore">
          <Alert
            variant="errore"
            action={
              <Button variant="link" data-testid="avviso-riprova">
                Riprova
              </Button>
            }
            data-testid="avviso-errore"
          >
            Non riusciamo a caricare gli impegni. Controlla la connessione e
            riprova.
          </Alert>
        </Example>
        <Example caption="avviso--avviso">
          <Alert variant="avviso" data-testid="avviso-avviso">
            Laura è dal pediatra con Tommaso fino alle 17:15: chi porta Sofia?
          </Alert>
        </Example>
        <Example caption="avviso--info">
          <Alert variant="info" data-testid="avviso-info">
            Tutti riceveranno un avviso se cambi l&apos;orario.
          </Alert>
        </Example>
        <Example caption="avviso--senza-azione">
          <Alert variant="info" data-testid="avviso-senza-azione">
            Tutti riceveranno un avviso se cambi l&apos;orario.
          </Alert>
        </Example>
        <Example caption="avviso · icona a scelta (wifi-off)">
          <Alert
            variant="avviso"
            icon="wifi-off"
            data-testid="avviso-icona-personalizzata"
          >
            Sei offline. Le modifiche partiranno appena torna la connessione.
          </Alert>
        </Example>
        <Example caption="avviso--ok">
          <Alert
            variant="ok"
            action={<Button variant="link">Riprova</Button>}
            data-testid="avviso-ok"
          >
            Calendario Google collegato. Gli impegni arrivano tra un minuto.
          </Alert>
        </Example>
      </Section>

      <Section id="errore-pagina" title="Errore di pagina">
        <Example caption="errore-pagina · predefinito">
          <PageError
            onRetry={() => setRetries((n) => n + 1)}
            data-testid="errore-pagina"
          />
          <p className={styles.contatore} data-testid="errore-pagina-conteggio">
            Riprova: {retries}
          </p>
        </Example>
        <Example caption="errore-pagina · con uscita">
          <PageError
            onRetry={() => setExitRetries((n) => n + 1)}
            exit={{ label: "Torna a Oggi", href: "/oggi" }}
            data-testid="errore-pagina-con-uscita"
          />
          <p
            className={styles.contatore}
            data-testid="errore-pagina-con-uscita-conteggio"
          >
            Riprova: {exitRetries}
          </p>
        </Example>
      </Section>
    </>
  );
}
