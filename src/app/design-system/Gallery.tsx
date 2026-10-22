"use client";

import { useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/Alert/Alert";
import { Avatar } from "@/components/ui/Avatar/Avatar";
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
import { SegmentedControl } from "@/components/ui/SegmentedControl/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet/Sheet";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton/Skeleton";
import { Spinner } from "@/components/ui/Spinner/Spinner";
import { Tag } from "@/components/ui/Tag/Tag";
import { Toggle } from "@/components/ui/Toggle/Toggle";
import { useToast } from "@/components/ui/Toast/ToastProvider";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden/VisuallyHidden";
import styles from "./gallery.module.css";

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

export function Gallery() {
  return (
    <main className={styles.pagina}>
      <h1 className="t-titolo-pagina">Design system</h1>
      <TypographySection />
      <ButtonsSection />
      <FieldsSection />
      <ControlsSection />
      <PeopleSection />
      <ListSection />
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
            17:00
          </p>
        </Example>
        <Example caption="t-titolo-pagina">
          <p className="t-titolo-pagina" data-testid="t-titolo-pagina-esempio">
            Buon pomeriggio, Marco
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

function ListSection() {
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
  return (
    <>
      <Section id="stato-vuoto" title="Stato vuoto">
        <Example caption="stato-vuoto · predefinito">
          <EmptyState
            icon="calendar"
            title="Giornata libera, per ora"
            text="Collega il calendario o"
            actions={<a href="/design-system">aggiungi un impegno</a>}
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
      </Section>
    </>
  );
}
