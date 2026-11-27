"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Brand, Claim, LegalLine, Stickers } from "@/components/accesso/parts";
import { Alert } from "@/components/ui/Alert/Alert";
import { Avatar } from "@/components/ui/Avatar/Avatar";
import {
  MEMBER_COLOR_CODES,
  memberColorClass,
  memberColorLabel,
} from "@/lib/member-colors";
import { Button } from "@/components/ui/Button/Button";
import { Card } from "@/components/ui/Card/Card";
import { Checkbox } from "@/components/ui/Checkbox/Checkbox";
import { Chip, ChipGroup } from "@/components/ui/Chip/Chip";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import {
  DateField,
  FieldGroup,
  FieldPair,
  SelectField,
  TextField,
  TimeField,
} from "@/components/ui/Field/Field";
import { Icon } from "@/components/ui/Icon/Icon";
import { ColorChoice } from "@/components/ui/ColorChoice/ColorChoice";
import { IconButton } from "@/components/ui/IconButton/IconButton";
import { BackLink } from "@/components/ui/AppFrame/IconLinks";
import { List, ListRow, ValueRow } from "@/components/ui/List/List";
import { PasswordField } from "@/components/ui/PasswordField/PasswordField";
import { PhotoField } from "@/components/ui/PhotoField/PhotoField";
import { RepeatField } from "@/components/ui/RepeatField/RepeatField";
import {
  TurnPeople,
  type TurnPerson,
} from "@/components/ui/TurnPeople/TurnPeople";
import { WeekdayPicker } from "@/components/ui/WeekdayPicker/WeekdayPicker";
import { AvatarStack } from "@/components/ui/AvatarStack/AvatarStack";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup/ChoiceGroup";
import { FaceGrid } from "@/components/ui/FaceGrid/FaceGrid";
import { PersonPicker } from "@/components/ui/PersonPicker/PersonPicker";
import { Tile, TileGrid } from "@/components/ui/Tile/Tile";
import { it } from "@/lib/i18n/messages/it";
import { t } from "@/lib/i18n";
import { memberInitials } from "@/lib/member-initials";
import { askNest, brandText, messages, nestEnergy } from "@/lib/brand";
import { PHOTO_REDUCE_ERROR } from "@/lib/photo-field-texts";
import { REPEAT_DAYS_ERROR } from "@/lib/repeat-options";
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
  wide = false,
}: {
  caption: string;
  children: ReactNode;
  /** Takes the whole width of the gallery, not one of the two columns */
  wide?: boolean;
}) {
  return (
    <figure
      className={wide ? `${styles.esempio} ${styles.ampio}` : styles.esempio}
    >
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
// #221: the examples of the page parts (profile of a child, «In arrivo»,
// Impostazioni) are shown only with ?pezzi-pagine=1, for the same reason.
function useQueryFlag(name: string): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => new URLSearchParams(window.location.search).get(name) === "1",
    () => false,
  );
}

// #482 (for #460): the pieces of the animals. A person can take a turn, a pet
// cannot, so the turn list below is made of people only. Shown only with
// ?pezzi-pagine=1, in a section of its own.
const TURN_SAMPLE_PEOPLE: readonly TurnPerson[] = [
  { id: "marco", name: "Marco", color: "cobalto" },
  { id: "laura", name: "Laura", color: "glicine" },
  { id: "sofia", name: "Sofia", color: "salvia" },
  { id: "tommaso", name: "Tommaso", color: "pomodoro" },
  { id: "rita", name: "Rita", color: "lampone" },
  { id: "paolo", name: "Paolo", color: "ceruleo" },
  { id: "giulia", name: "Giulia", color: "peonia" },
];

// A picture that cannot be opened, as a data address: no request is made.
const BROKEN_PHOTO = "data:image/webp;base64,AAAA";

// A small WebP picture (2:1) as a data address, like the copy of the server.
const ANIMAL_SAMPLE_PHOTO =
  "data:image/webp;base64,UklGRkIAAABXRUJQVlA4IDYAAAAQAwCdASooABQAPtFmrFEoJaQipWgBABoJZwAAKa1mnwAA/u69n/qqnr8bv90n6nuMeQEiAAA=";

function AnimalParts() {
  const [photoPicked, setPhotoPicked] = useState("nessuna foto");
  const [photoError, setPhotoError] = useState<string | undefined>(undefined);
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [turn, setTurn] = useState<string[]>(["laura", "sofia", "marco"]);
  const [emptyTurn, setEmptyTurn] = useState<string[]>([]);
  const [repeat, setRepeat] = useState("monthly");
  const [repeatDays, setRepeatDays] = useState("");
  const [everyN, setEveryN] = useState("every-n-days");
  const [everyNDays, setEveryNDays] = useState("400");
  const [todoRepeat, setTodoRepeat] = useState("chosen-days");
  return (
    <Section id="pezzi-animali" title="Animali (#460)">
      <Example caption="Avatar photoSrc e photoAlt (xl) · foto che non si carica · photoSrc a 24 px">
        <div className={styles.riga} data-testid="avatar-foto">
          <Avatar
            name="Biscotto"
            color="zafferano"
            size="xl"
            photoSrc={ANIMAL_SAMPLE_PHOTO}
            photoAlt="Foto di Biscotto"
          />
          <Avatar
            name="Biscotto"
            color="zafferano"
            size="xl"
            photoSrc={ANIMAL_SAMPLE_PHOTO}
            nameShown
          />
          <Avatar
            name="Miele"
            color="cannella"
            size="xl"
            photoSrc={BROKEN_PHOTO}
          />
          <Avatar
            name="Biscotto"
            color="zafferano"
            size="s"
            photoSrc={ANIMAL_SAMPLE_PHOTO}
          />
        </div>
      </Example>
      <Example caption="Avatar photoSrc con un indirizzo non ammesso (javascript:, //sito): resta l'iniziale">
        <div className={styles.riga} data-testid="avatar-foto-rifiutata">
          <Avatar
            name="Biscotto"
            color="zafferano"
            size="xl"
            photoSrc="javascript:void(0)"
          />
          <Avatar
            name="Miele"
            color="cannella"
            size="xl"
            photoSrc="//esempio.test/foto.webp"
          />
        </div>
      </Example>
      <Example caption="PhotoField · senza foto, con foto (photoSrc) e scelta qui sotto">
        <div className="colonna" data-testid="campo-foto">
          <PhotoField
            name="Biscotto"
            color="zafferano"
            onPick={(file) => setPhotoPicked(file.name)}
            onRemove={() => setPhotoPicked("nessuna foto")}
          />
          <p className="t-nota t-secondario" role="status">
            Scelta: {photoPicked}
          </p>
          <PhotoField
            name="Biscotto"
            color="zafferano"
            photoSrc={ANIMAL_SAMPLE_PHOTO}
            onPick={() => {}}
            onRemove={() => {}}
          />
        </div>
      </Example>
      <Example caption="PhotoField · foto che la pagina non riesce a ridurre: l'errore arriva e l'anteprima torna com'era">
        <div className="colonna" data-testid="campo-foto-errore">
          <PhotoField
            name="Biscotto"
            color="zafferano"
            error={photoError}
            onPick={() => {
              setPhotoError(undefined);
              window.setTimeout(() => setPhotoError(PHOTO_REDUCE_ERROR), 600);
            }}
            onRemove={() => setPhotoError(undefined)}
          />
        </div>
      </Example>
      <Example caption="PhotoField · in riduzione (reducing), errore (error), disabilitato (disabled)">
        <div className="colonna" data-testid="campo-foto-stati">
          <PhotoField
            name="Biscotto"
            color="zafferano"
            reducing
            onPick={() => {}}
            onRemove={() => {}}
          />
          <PhotoField
            name="Biscotto"
            color="zafferano"
            error={PHOTO_REDUCE_ERROR}
            onPick={() => {}}
            onRemove={() => {}}
          />
          <PhotoField
            name="Biscotto"
            color="zafferano"
            photoSrc={ANIMAL_SAMPLE_PHOTO}
            disabled
            onPick={() => {}}
            onRemove={() => {}}
          />
        </div>
      </Example>
      <Example caption="WeekdayPicker · scelti, errore (error), disabilitato (disabled)">
        <div className="colonna" data-testid="scelta-giorni">
          <WeekdayPicker value={days} onChange={setDays} />
          <WeekdayPicker
            value={[]}
            onChange={() => {}}
            error="Scegli almeno un giorno."
          />
          <WeekdayPicker value={[2, 4]} onChange={() => {}} disabled />
        </div>
      </Example>
      <Example caption="WeekdayPicker nel contenitore stretto (quattro colonne, testo grande)">
        <div className="colonna" data-testid="scelta-giorni-stretta">
          <div className={styles.stretta}>
            <WeekdayPicker value={[1, 6, 7]} onChange={() => {}} />
          </div>
        </div>
      </Example>
      <Example caption="TurnPeople · con tre persone (su, giù, togli) e chip di chi manca">
        <div className="colonna" data-testid="turno-persone">
          <TurnPeople
            people={TURN_SAMPLE_PEOPLE}
            value={turn}
            onChange={setTurn}
          />
        </div>
      </Example>
      <Example caption="TurnPeople · vuoto con errore (error), al massimo 6 persone, disabilitato">
        <div className="colonna" data-testid="turno-persone-stati">
          <TurnPeople
            people={TURN_SAMPLE_PEOPLE}
            value={emptyTurn}
            onChange={setEmptyTurn}
            error="Scegli chi fa il turno."
          />
          <TurnPeople
            people={TURN_SAMPLE_PEOPLE}
            value={["marco", "laura", "sofia", "tommaso", "rita", "paolo"]}
            onChange={() => {}}
          />
          <TurnPeople
            people={TURN_SAMPLE_PEOPLE}
            value={["laura", "sofia"]}
            onChange={() => {}}
            disabled
          />
        </div>
      </Example>
      <Example caption="RepeatField kind=deadline · Ogni mese, con aiuto (help)">
        <div className="colonna" data-testid="si-ripete-scadenza">
          <RepeatField
            kind="deadline"
            value={repeat}
            onChange={(next) => {
              setRepeat(next);
              setRepeatDays("");
            }}
            days={repeatDays}
            onDaysChange={setRepeatDays}
            help="L'intervallo lo decide il vostro veterinario."
          />
        </div>
      </Example>
      <Example caption="RepeatField kind=deadline · Ogni … giorni con errore del numero (daysError), disabilitato">
        <div className="colonna" data-testid="si-ripete-giorni">
          <RepeatField
            kind="deadline"
            value={everyN}
            onChange={(next) => {
              setEveryN(next);
              setEveryNDays("");
            }}
            days={everyNDays}
            onDaysChange={setEveryNDays}
            daysError={REPEAT_DAYS_ERROR}
          />
          <RepeatField
            kind="deadline"
            value="yearly"
            onChange={() => {}}
            disabled
          />
        </div>
      </Example>
      <Example caption="RepeatField kind=todo · Mai, Ogni giorno, Giorni scelti">
        <div className="colonna" data-testid="si-ripete-cosa">
          <RepeatField
            kind="todo"
            value={todoRepeat}
            onChange={setTodoRepeat}
            help="Le cose di ogni giorno le vede tutto il Nest."
          />
        </div>
      </Example>
    </Section>
  );
}

// #503 (F4a): the basic components 2.0, one example for every new prop, with
// the texts of the boards of Fable (docs/specifiche/503-componenti-base.md §7).
function BaseComponentsSection() {
  const toast = useToast();
  const [retries, setRetries] = useState(0);
  const [boxClicks, setBoxClicks] = useState(0);
  const [undone, setUndone] = useState(0);
  const [edits, setEdits] = useState(0);
  const [reminderClicks, setReminderClicks] = useState(0);
  const [doNotDisturb, setDoNotDisturb] = useState(true);
  const [shopping, setShopping] = useState(false);
  const [invited, setInvited] = useState(0);
  const [added, setAdded] = useState(0);
  const [removed, setRemoved] = useState(0);
  const [mail, setMail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <Section id="base-2" title="Componenti di base 2.0 (#503)">
      <Example caption="1 · Pulsanti · quattro livelli" wide>
        <div className={styles.riga} data-testid="base-pulsanti">
          <Button>Salva</Button>
          <Button variant="secondary" icon="rotate-cw">
            Usa di nuovo
          </Button>
          <Button variant="quieto" icon="shopping-basket">
            Metti in spesa
          </Button>
          <Button variant="link">Annulla</Button>
          <Button variant="pericolo">Elimina la lista</Button>
        </div>
      </Example>
      <Example caption="2 · Piede della pagina">
        <div className={styles.piede} data-testid="base-piede">
          <Button variant="link">Annulla</Button>
          <Button>Salva</Button>
        </div>
      </Example>
      <Example caption="3 · Campi · vuoto, pieno, a fuoco">
        <div className="colonna" data-testid="base-campi">
          <TextField label="Nome" id="base-nome-vuoto" />
          <TextField
            label="Nome"
            id="base-nome-pieno"
            defaultValue="Sofia"
            autoComplete="off"
          />
          <TextField
            label="Nome"
            id="base-nome-fuoco"
            defaultValue="Sofi"
            autoComplete="off"
          />
        </div>
      </Example>
      <Example caption="4 · Campi · errore e aiuto">
        <div className="colonna" data-testid="base-campi-errore">
          <TextField
            label="Telefono"
            id="base-telefono"
            type="tel"
            defaultValue="02 48"
            error="Il numero è troppo corto: controlla le cifre."
          />
          <TextField
            label="Nota"
            id="base-nota"
            multiline
            help="Niente dati di salute delle persone."
          />
        </div>
      </Example>
      <Example caption="5 · Campi uniti">
        <div className="colonna" data-testid="base-campi-uniti">
          <FieldGroup>
            <TextField
              label="La tua mail"
              id="base-mail"
              type="email"
              value={mail}
              onChange={(event) => setMail(event.target.value)}
            />
            <PasswordField
              label="Password"
              id="base-password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </FieldGroup>
          <FieldGroup>
            <TextField
              label="Numero della carta"
              id="base-carta"
              inputMode="numeric"
            />
            <FieldGroup columns>
              <TextField label="Scadenza" id="base-scadenza" />
              <TextField label="Codice" id="base-codice" />
            </FieldGroup>
          </FieldGroup>
        </div>
      </Example>
      <Example caption="6 · Avvisi">
        <div className="colonna" data-testid="base-avvisi">
          <Alert variant="info" data-testid="base-avviso-info">
            Sofia non ha un account: il suo profilo lo tenete voi adulti.
          </Alert>
          <Alert variant="offline" data-testid="base-avviso-offline">
            Vedi le cose aggiornate alle 19:05; le modifiche partiranno appena
            torna la connessione.
          </Alert>
        </div>
      </Example>
      <Example caption="7 · Vuoto · tutto il riquadro">
        <div data-testid="base-vuoto-box">
          <EmptyState
            variant="box"
            title="Nuova scadenza"
            text="Antiparassitario, vaccino, visita: ve li ricordiamo noi."
            onClick={() => setBoxClicks((n) => n + 1)}
          />
          <p className={styles.contatore} data-testid="base-vuoto-conteggio">
            Aperto: {boxClicks}
          </p>
        </div>
      </Example>
      <Example caption="8 · Errore di pagina">
        <div data-testid="base-errore-pagina">
          <PageError
            title="Questa pagina non si è caricata"
            text="Controlla la connessione e riprova."
            onRetry={() => setRetries((n) => n + 1)}
          />
          <p className={styles.contatore} data-testid="base-errore-conteggio">
            Riprova: {retries}
          </p>
        </div>
      </Example>
      <Example caption="9 · Messaggio">
        <div className={styles.riga}>
          <Button
            variant="secondary"
            data-testid="base-messaggio-mostra"
            onClick={() =>
              toast.showToast({
                text: "Fatto:",
                emphasis: "Passeggiata della sera",
                onUndo: () => setUndone((n) => n + 1),
              })
            }
          >
            Mostra il messaggio
          </Button>
          <span
            className={styles.contatore}
            data-testid="base-messaggio-conteggio"
          >
            Annullato: {undone}
          </span>
        </div>
      </Example>
      <Example caption="10 · Freccia indietro" wide>
        <div className="colonna" data-testid="base-freccia">
          <div className={styles.barraFreccia}>
            <BackLink fallback="/design-system" />
            <Button
              variant="link"
              onClick={() => setEdits((n) => n + 1)}
              data-testid="base-freccia-modifica"
            >
              Modifica
            </Button>
          </div>
          <p className={styles.contatore}>Modifica: {edits}</p>
          <div className={styles.mediaSegnaposto}>
            <BackLink fallback="/design-system" onMedia />
          </div>
        </div>
      </Example>
      <Example caption="11 · Righe che portano altrove">
        <div data-testid="base-righe">
          <List flush>
            <ListRow
              href="/design-system"
              icon="settings"
              title="Impostazioni"
              text="Tema, notifiche, privacy"
              arrow
            />
            <ListRow
              href="/design-system"
              icon="calendar"
              title="Calendari collegati"
              text="Google e Outlook"
              arrow
            />
            <ListRow
              href="/design-system"
              icon="user-round"
              title="Il tuo profilo"
              text="I tuoi dati e il tuo account"
              arrow
            />
          </List>
        </div>
      </Example>
      <Example caption="12 · Dati che si cambiano">
        <List flush>
          <ValueRow
            label="Nome"
            value="Marco"
            onEdit={() => setEdits((n) => n + 1)}
          />
          <ValueRow
            label="Mail"
            value="marco.bianchi@esempio.it"
            onEdit={() => setEdits((n) => n + 1)}
          />
          <ValueRow
            label="Compleanno"
            value="18 settembre"
            onEdit={() => setEdits((n) => n + 1)}
          />
        </List>
      </Example>
      <Example caption="13 · Scelte veloci e interruttori">
        <div data-testid="base-interruttori">
          <List flush>
            <ListRow
              onClick={() => setReminderClicks((n) => n + 1)}
              title="Promemoria prima di un impegno"
              value="Un'ora prima"
              arrow
            />
            <ListRow
              title="Non disturbare"
              text="Dalle 22:00 alle 7:00"
              trailing={
                <Toggle
                  checked={doNotDisturb}
                  onChange={setDoNotDisturb}
                  aria-label="Non disturbare"
                />
              }
            />
            <ListRow
              title="Cose aggiunte alla spesa"
              trailing={
                <Toggle
                  checked={shopping}
                  onChange={setShopping}
                  aria-label="Cose aggiunte alla spesa"
                />
              }
            />
          </List>
          <p className={styles.contatore}>Scelte: {reminderClicks}</p>
        </div>
      </Example>
      <Example caption="14 · Azioni dentro un elenco">
        <div data-testid="base-azioni">
          <List flush>
            <ListRow
              onClick={() => setInvited((n) => n + 1)}
              icon="user-plus"
              title="Invita una persona"
              text="Riceve un link ed entra"
              arrow
            />
            <ListRow
              onClick={() => setAdded((n) => n + 1)}
              add
              title="Aggiungi un figlio o un animale"
            />
            <ListRow
              onClick={() => setRemoved((n) => n + 1)}
              tone="danger"
              icon="log-out"
              title="Togli Laura dal Nest"
            />
          </List>
          <p className={styles.contatore}>
            Invitati: {invited} · Aggiunti: {added} · Tolti: {removed}
          </p>
        </div>
      </Example>
    </Section>
  );
}

// CA-13 (#503): view with the offline notice at the top and more than 800 px of
// content under it, to try the notice while the page scrolls. Shown only with
// ?avviso-offline=1.
function OfflineNoticeView() {
  return (
    <>
      <Alert variant="offline" data-testid="base-avviso-offline-alto">
        Vedi le cose aggiornate alle 19:05; le modifiche partiranno appena torna
        la connessione.
      </Alert>
      <main className={styles.pagina}>
        <h1 className="t-titolo-pagina">Design system</h1>
        <div data-testid="base-avviso-offline-contenuto">
          {Array.from({ length: 150 }, (_, i) => (
            <p className="t-corpo" key={i}>
              Riga di prova {i + 1}: il contenuto continua sotto l&apos;avviso
              per provare lo scorrimento della pagina.
            </p>
          ))}
        </div>
      </main>
    </>
  );
}

// F4b (#504): choices and people. Fixed data, the same for tests and visual
// references (`docs/specifiche/504-componenti-scelte-persone.md` §6).
const CHOICE_COHABITANTS = [
  {
    value: "coppia",
    title: "In coppia",
    line: "Voi due, sotto lo stesso tetto",
    icon: "heart",
  },
  {
    value: "famiglia",
    title: "In famiglia, con figli",
    line: "Con i profili dei figli, la scuola e la lista dei desideri",
    icon: "house",
  },
] as const;

const CHOICE_TILES = [
  { value: "coppia", title: "In coppia", icon: "heart" },
  { value: "famiglia", title: "In famiglia", icon: "house" },
  { value: "solo", title: "Per conto mio", icon: "user-round" },
  { value: "coinquilini", title: "Con coinquilini", icon: "users" },
] as const;

const NEST_MEMBERS = [
  { id: "marco", name: "Marco", color: "pomodoro", at: "2026-11-01" },
  { id: "laura", name: "Laura", color: "glicine", at: "2026-11-01T01:00" },
  { id: "sofia", name: "Sofia", color: "salvia", at: "2026-11-01T02:00" },
  { id: "tommaso", name: "Tommaso", color: "cobalto", at: "2026-11-01T03:00" },
  {
    id: "biscotto",
    name: "Biscotto",
    color: "zafferano",
    at: "2026-11-01T04:00",
  },
  { id: "miele", name: "Miele", color: "cannella", at: "2026-11-02" },
] as const;

const NEST_INITIALS = memberInitials(
  NEST_MEMBERS.map((member) => ({
    id: member.id,
    householdId: "gallery",
    name: member.name,
    createdAt: member.at,
  })),
);

const GALLERY_PEOPLE = NEST_MEMBERS.map((member) => ({
  id: member.id,
  name: member.name,
  color: member.color,
  initials: NEST_INITIALS.get(member.id),
}));

const TEN_NAMES = [
  "Marco",
  "Laura",
  "Sofia",
  "Tommaso",
  "Biscotto",
  "Rita",
  "Paolo",
  "Giulia",
  "Anna",
  "Miele",
] as const;

const TEN_PEOPLE = MEMBER_COLOR_CODES.map((color, index) => ({
  id: `dieci-${color}`,
  name: TEN_NAMES[index] ?? color,
  color,
}));

const FACE_LINES: Record<string, string> = {
  marco: "Tu",
  laura: "Invito da mandare",
  sofia: "9 anni",
  tommaso: "6 anni",
  biscotto: "Cane",
};

const FACE_PEOPLE = GALLERY_PEOPLE.filter(
  (person) => person.id !== "miele",
).map((person) => ({
  ...person,
  line: FACE_LINES[person.id],
  photoSrc: person.id === "biscotto" ? ANIMAL_SAMPLE_PHOTO : undefined,
}));

const FILTERS = [
  { id: "tutto", label: "Tutto", count: 9 },
  { id: "impegni", label: "Impegni", count: 5 },
  { id: "da-fare", label: "Da fare", count: 2 },
  { id: "spesa", label: "Spesa", count: 0 },
  { id: "scadenze", label: "Scadenze", count: 1 },
  { id: "animali", label: "Animali", count: 3 },
] as const;

function ChoicesPeopleSection() {
  const [household, setHousehold] = useState<string | null>("famiglia");
  const [tile, setTile] = useState<string | null>("famiglia");
  const [kinds, setKinds] = useState<string[]>(["compleanno"]);
  const [people, setPeople] = useState<string[]>(["sofia", "biscotto"]);
  const [forWhom, setForWhom] = useState<string[]>(["tommaso"]);
  const [forWhomTen, setForWhomTen] = useState<string[]>([]);
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [filter, setFilter] = useState<string>("tutto");
  const [food, setFood] = useState(false);
  const [walk, setWalk] = useState(true);
  const [touched, setTouched] = useState("");

  const toggleIn = (
    list: readonly string[],
    value: string,
    set: (next: string[]) => void,
  ) =>
    set(
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    );

  const stackFour = GALLERY_PEOPLE.slice(0, 4);
  const stackSix = [...stackFour, GALLERY_PEOPLE[4]!, GALLERY_PEOPLE[5]!];

  return (
    <Section id="scelte-persone" title="Scelte e persone (F4b, #504)">
      <Example caption="ChoiceGroup · schede (A)">
        <ChoiceGroup
          label="Chi vive con te?"
          value={household}
          onChange={setHousehold}
          options={CHOICE_COHABITANTS}
          data-testid="ds-scelte-schede"
        />
      </Example>
      <Example caption="ChoiceGroup · schede · errore">
        <ChoiceGroup
          label="Chi vive con te?"
          value={null}
          onChange={() => undefined}
          options={CHOICE_COHABITANTS}
          error={it.choicesPeople.chooseOne}
          data-testid="ds-scelte-schede-errore"
        />
      </Example>
      <Example caption="ChoiceGroup · tessere (B)">
        <ChoiceGroup
          label="Con chi vivi?"
          variant="tiles"
          value={tile}
          onChange={setTile}
          options={CHOICE_TILES}
          data-testid="ds-scelte-tessere"
        />
      </Example>
      <Example caption="Chip · pastiglie (C)">
        <ChipGroup aria-label="Che cosa festeggiate" data-testid="ds-pastiglie">
          {(
            [
              ["compleanno", "Compleanno"],
              ["anniversario", "Anniversario"],
              ["onomastico", "Onomastico"],
              ["altro", "Altro"],
            ] as const
          ).map(([id, label]) => (
            <Chip
              key={id}
              pressed={kinds.includes(id)}
              onClick={() => toggleIn(kinds, id, setKinds)}
            >
              {label}
            </Chip>
          ))}
        </ChipGroup>
      </Example>
      <Example caption="Chip · pastiglie delle persone">
        <ChipGroup aria-label="Per chi" data-testid="ds-pastiglie-persone">
          {GALLERY_PEOPLE.filter((p) =>
            ["sofia", "tommaso", "biscotto"].includes(p.id),
          ).map((person) => (
            <Chip
              key={person.id}
              person
              pressed={people.includes(person.id)}
              onClick={() => toggleIn(people, person.id, setPeople)}
              leading={
                <Avatar
                  name={person.name}
                  color={person.color}
                  initials={person.initials}
                  nameShown
                />
              }
            >
              {person.name}
            </Chip>
          ))}
          <Chip
            icon="users"
            pressed={people.includes("tutta")}
            onClick={() => toggleIn(people, "tutta", setPeople)}
          >
            Tutta la casa
          </Chip>
        </ChipGroup>
      </Example>
      <Example caption="PersonPicker · «Per chi»">
        <PersonPicker
          label="Per chi"
          people={GALLERY_PEOPLE}
          value={forWhom}
          onChange={setForWhom}
          data-testid="ds-per-chi"
        />
      </Example>
      <Example caption="PersonPicker · dieci persone, a capo">
        <PersonPicker
          label="Per chi, dieci persone"
          people={TEN_PEOPLE}
          value={forWhomTen}
          onChange={setForWhomTen}
          data-testid="ds-per-chi-dieci"
        />
      </Example>
      <Example caption="PersonPicker · caricamento">
        <PersonPicker
          label="Per chi, in caricamento"
          people={[]}
          value={[]}
          onChange={() => undefined}
          loading
          data-testid="ds-per-chi-caricamento"
        />
      </Example>
      <Example caption="WeekdayPicker · giorni">
        <WeekdayPicker
          value={days}
          onChange={setDays}
          data-testid="ds-giorni"
        />
      </Example>
      <Example caption="ChipGroup scroll · filtri che scorrono" wide>
        <ChipGroup scroll aria-label="Filtri" data-testid="ds-filtri">
          {FILTERS.map((item) => (
            <Chip
              key={item.id}
              pressed={filter === item.id}
              count={item.count}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </Chip>
          ))}
        </ChipGroup>
      </Example>
      <Example caption="Spunta neutra · riga fatta">
        <List className="scheda" data-testid="ds-spunta">
          <ListRow>
            <Checkbox
              variant="round"
              checked={food}
              onChange={setFood}
              aria-label="Segna come fatto: Cibo di Biscotto"
            />
            <span className="riga-lista__testo">
              <span className="riga-lista__titolo">Cibo di Biscotto</span>
              <span className="riga-lista__info">Sera · tocca a Laura</span>
            </span>
            <Avatar name="Laura" color="glicine" dot nameShown />
          </ListRow>
          <ListRow modifier={walk ? "riga-lista--fatto" : undefined}>
            <Checkbox
              variant="round"
              checked={walk}
              onChange={setWalk}
              aria-label="Segna come fatto: Passeggiata del mattino"
            />
            <span className="riga-lista__testo">
              <span className="riga-lista__titolo">
                Passeggiata del mattino
              </span>
              <span className="riga-lista__info">Fatto da te alle 7:42</span>
            </span>
            <Avatar name="Marco" color="pomodoro" dot nameShown />
          </ListRow>
        </List>
      </Example>
      <Example caption="FaceGrid · volti in griglia">
        <FaceGrid
          label="Persone del Nest"
          people={FACE_PEOPLE}
          onSelect={(id) => {
            const person = FACE_PEOPLE.find((p) => p.id === id);
            if (person) {
              setTouched(t(it.choicesPeople.touched, { name: person.name }));
            }
          }}
          onAdd={() => undefined}
          data-testid="ds-volti"
        />
        <p
          className="t-nota"
          role="status"
          aria-live="polite"
          data-testid="ds-volti-stato"
        >
          {touched}
        </p>
      </Example>
      <Example caption="FaceGrid · nessuna persona">
        <FaceGrid
          label="Persone del Nest, nessuna"
          people={[]}
          onSelect={() => undefined}
          onAdd={() => undefined}
          data-testid="ds-volti-vuoto"
        />
      </Example>
      <Example caption="AvatarStack · Avatar con foto e con due lettere">
        <div className={styles.riga} data-testid="ds-foto-e-pila">
          <span data-testid="ds-pila-quattro">
            <AvatarStack people={stackFour} />
          </span>
          <span>Tutti e quattro</span>
          <span data-testid="ds-pila-sei">
            <AvatarStack people={stackSix} />
          </span>
          <span data-testid="ds-biscotto-foto">
            <Avatar
              name="Biscotto"
              color="zafferano"
              size="xl"
              photoSrc={ANIMAL_SAMPLE_PHOTO}
              ring
            />
          </span>
          <span data-testid="ds-biscotto-senza-foto">
            <Avatar
              name="Biscotto"
              color="zafferano"
              size="xl"
              photoSrc={BROKEN_PHOTO}
              ring
            />
          </span>
          <span data-testid="ds-miele-s">
            <Avatar name="Miele" color="cannella" initials="Mi" />
          </span>
          <span data-testid="ds-miele-m">
            <Avatar name="Miele" color="cannella" initials="Mi" size="m" />
          </span>
          <span data-testid="ds-miele-l">
            <Avatar name="Miele" color="cannella" initials="Mi" size="l" />
          </span>
          <span data-testid="ds-miele-xl">
            <Avatar name="Miele" color="cannella" initials="Mi" size="xl" />
          </span>
        </div>
      </Example>
      <Example caption="Avatar neutro · aiutante">
        <div className={styles.riga} data-testid="ds-aiutante">
          <Avatar name="Anna" color="neutro" size="s" />
          <Avatar name="Anna" color="neutro" size="m" />
          <Avatar name="Anna" color="neutro" size="l" />
          <Avatar name="Anna" color="neutro" size="xl" />
          <span>nonna Anna</span>
        </div>
      </Example>
      <Example caption="Tile · tessere di Spazi">
        <TileGrid data-testid="ds-tessere-spazi">
          <Tile
            href="#"
            icon="paw-print"
            title="Animali"
            line="Biscotto e Miele"
          />
          <Tile href="#" icon="book-open" title="Ricette" line="8 vostre" />
          <Tile
            href="#"
            icon="utensils"
            title="Pasti"
            line="Stasera: pasta al pesto"
          />
          <Tile
            href="#"
            icon="repeat"
            title="Liste da riusare"
            line="4 liste"
          />
        </TileGrid>
      </Example>
      <Example
        caption="Tile · tessere del Nest (avatar, in attesa, 4 colonne)"
        wide
      >
        <TileGrid columns={4} data-testid="ds-tessere-nest">
          <Tile
            href="#"
            avatar={{ name: "Marco", color: "pomodoro" }}
            title="Marco"
            line="Tu"
          />
          <Tile
            href="#"
            avatar={{ name: "Laura", color: "glicine" }}
            title="Laura"
            line="Adulta"
          />
          <Tile
            href="#"
            avatar={{ name: "Sofia", color: "salvia" }}
            title="Sofia"
            line="9 anni"
          />
          <Tile
            href="#"
            avatar={{ name: "Tommaso", color: "cobalto" }}
            title="Tommaso"
            line="6 anni"
          />
          <Tile
            variant="pending"
            avatar={{ name: "Giorgia", color: "peonia" }}
            title="Giorgia"
            line="Invito mandato ieri · vale ancora 6 giorni"
            data-testid="ds-tessera-attesa"
          />
        </TileGrid>
      </Example>
      <Example caption="Tag · allerta">
        <Tag variant="allerta" data-testid="ds-tag-allerta">
          Da verificare
        </Tag>
      </Example>
    </Section>
  );
}

export function Gallery() {
  const rowCards = useQueryFlag("righe-scheda");
  const pageParts = useQueryFlag("pezzi-pagine");
  const passwordField = useQueryFlag("campo-password");
  const splitUnico = useQueryFlag("split-unico");
  const offlineView = useQueryFlag("avviso-offline");
  if (offlineView) return <OfflineNoticeView />;
  return (
    <main className={styles.pagina}>
      <h1 className="t-titolo-pagina">Design system</h1>
      <TypographySection />
      <ThemeSection />
      <ButtonsSection />
      <FieldsSection />
      <ControlsSection />
      <PeopleSection />
      <ChoicesPeopleSection />
      <ListSection rowCards={rowCards} />
      <BaseComponentsSection />
      <OverlaysSection />
      <StatesSection />
      <DayViewSection />
      <EditableRowsSection />
      <MonthSection />
      {passwordField ? <PasswordFieldSection /> : null}
      {splitUnico ? <SplitUnicoSection /> : null}
      {pageParts ? <PageParts /> : null}
      {pageParts ? <WishlistParts /> : null}
      {pageParts ? <LinkedCalendarParts /> : null}
      {pageParts ? <AccessParts /> : null}
      {pageParts ? <AnimalParts /> : null}
    </main>
  );
}

// #461: the sign-in page, with the same structure and texts as the page: the
// brand mark in the head, the form, «Oppure» and the two providers in
// `.accesso-altri`. Shown only with ?pezzi-pagine=1, in a section of its own.
function AccessParts() {
  return (
    <Section id="pezzi-accesso" title="Accesso (#461)">
      <Example
        wide
        caption="split-onboarding__passo--accesso · passo-onboarding__testa--marchio · accesso-altri"
      >
        <div
          className="split-onboarding split-onboarding--unico"
          data-testid="accesso-pezzi"
        >
          <div className="split-onboarding__notte">
            <Brand />
            <Stickers />
            <Claim as="p" />
          </div>
          <div className="split-onboarding__passo split-onboarding__passo--unico split-onboarding__passo--accesso">
            <div className="passo-onboarding__testa passo-onboarding__testa--marchio">
              <Brand />
            </div>
            <div className="split-onboarding__mid">
              <div className="intestazione">
                <p className="intestazione__sopra">Benvenuto</p>
                <h3 className="intestazione__titolo t-titolo-pagina">
                  {brandText(messages.brand.enter)}
                </h3>
                <p className="intestazione__sotto">
                  Il calendario, la spesa e le cose da fare di chi vive con te,
                  in un posto solo.
                </p>
              </div>
              <div className="split-onboarding__blocco">
                <div className="sezione">
                  <SegmentedControl
                    aria-label="Hai già un account?"
                    options={[
                      { value: "login", label: "Entra" },
                      { value: "register", label: "Registrati" },
                    ]}
                    value="login"
                    onChange={() => {}}
                  />
                  <TextField
                    label="La tua mail"
                    type="email"
                    autoComplete="username"
                    placeholder="nome@esempio.it"
                    defaultValue=""
                  />
                  <PasswordField
                    label="Password"
                    autoComplete="current-password"
                    value=""
                    onChange={() => {}}
                  />
                  <div className="gruppo-chip">
                    <Button variant="link" href="/design-system">
                      Password dimenticata?
                    </Button>
                  </div>
                </div>
                <div className="dialogo__azioni">
                  <Button variant="primary" full>
                    Entra
                  </Button>
                </div>
              </div>
              <div className="accesso-altri">
                <p className="t-nota t-secondario">Oppure</p>
                <Button variant="secondary" full icon="apple">
                  Continua con Apple
                </Button>
                <Button variant="secondary" full>
                  Continua con Google
                </Button>
              </div>
            </div>
            <div className="split-onboarding__legale">
              <LegalLine className="t-nota t-secondario" />
            </div>
          </div>
        </div>
      </Example>
      <Example caption="Il nome · Brand · brand.enter · brand.askNest · brand.nestEnergy (#502)">
        <div className="colonna" data-testid="il-nome">
          <div className="tema-notte">
            <Brand />
          </div>
          <p className="t-titolo-scheda">{brandText(messages.brand.enter)}</p>
          <p className="t-corpo">{askNest()}</p>
          <p className="t-corpo">{nestEnergy()}</p>
        </div>
      </Example>
    </Section>
  );
}

// Dark theme (#634): one image per theme, the other one is hidden with CSS.
function ThemeSection() {
  return (
    <Section id="tema" title="Tema">
      <Example caption="solo-chiaro · solo-scuro">
        <div className="colonna" data-testid="solo-tema">
          <div className="solo-chiaro" data-testid="solo-chiaro">
            <p className="t-corpo">Solo col tema chiaro</p>
          </div>
          <div className="solo-scuro" data-testid="solo-scuro">
            <p className="t-corpo">Solo col tema scuro</p>
          </div>
        </div>
      </Example>
    </Section>
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
        <Example caption="btn-primary--freccia · con arrowIcon">
          <Button
            arrow
            arrowIcon="arrow-up-right"
            type="submit"
            data-testid="btn-primary-freccia-diagonale"
          >
            Aggiungi 2 cose
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

// #327: the password field is shown only with ?campo-password=1, so the
// reference of the whole gallery does not change.
function PasswordFieldSection() {
  const [typed, setTyped] = useState("");
  const [short, setShort] = useState("abc");
  return (
    <Section id="campo-password" title="Campo password">
      <Example caption="campo-password · con regole">
        <PasswordField
          label="Password"
          autoComplete="new-password"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          rules
          data-testid="campo-password-regole"
        />
      </Example>
      <Example caption="campo-password · accesso, senza regole">
        <PasswordField
          label="Password"
          autoComplete="current-password"
          value="segreta-segreta"
          onChange={() => {}}
          data-testid="campo-password-accesso"
        />
      </Example>
      <Example caption="campo--errore · con regole">
        <PasswordField
          label="Password"
          autoComplete="new-password"
          value={short}
          onChange={(event) => setShort(event.target.value)}
          error="La password è troppo corta: servono almeno 8 caratteri."
          rules
          data-testid="campo-password-errore"
        />
      </Example>
      <Example caption="campo-password · disabilitato">
        <PasswordField
          label="Password"
          autoComplete="current-password"
          value="segreta-segreta"
          onChange={() => {}}
          disabled
          data-testid="campo-password-disabilitato"
        />
      </Example>
    </Section>
  );
}

// #345: the single-DOM onboarding step is shown only with ?split-unico=1, so
// the reference of the whole gallery does not change.
function SplitUnicoSection() {
  return (
    <Section id="split-onboarding-unico" title="Onboarding, un solo DOM">
      <Example caption="split-onboarding--unico · passo sotto 1024 px, split da 1024 px">
        <div
          className="split-onboarding split-onboarding--unico"
          data-testid="split-onboarding-unico"
        >
          <div className="split-onboarding__notte">
            <p className="t-frase">Il vostro Nest, in un posto solo.</p>
          </div>
          <div className="split-onboarding__passo--unico">
            <div className="passo-onboarding__testa">
              <span aria-hidden="true" />
              <span aria-hidden="true" />
              <span className="barra__vuoto" aria-hidden="true" />
            </div>
            <div className="split-onboarding__mid">
              <h3 className="t-titolo-pagina">Entra con la mail</h3>
              <div className="split-onboarding__blocco">
                <div className="sezione">
                  <TextField
                    label="Mail"
                    type="email"
                    autoComplete="email"
                    defaultValue=""
                  />
                </div>
                <div className="dialogo__azioni">
                  <Button full>Continua</Button>
                  <p className="t-nota t-secondario split-onboarding__solo-desktop">
                    Solo da 1024 px
                  </p>
                </div>
              </div>
            </div>
            <div className="split-onboarding__legale">
              <p className="t-nota t-secondario">
                Continuando accetti le condizioni d&apos;uso.
              </p>
            </div>
          </div>
        </div>
      </Example>
    </Section>
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
  const [chipPrivate, setChipPrivate] = useState(false);
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
        <Example caption="tondo-spunta · decorativo, senza bottone">
          <span
            className="tondo-spunta"
            aria-hidden="true"
            data-testid="tondo-decorativo"
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
        <Example caption="selettore · con icona (da 1024 px)">
          <SegmentedControl
            aria-label="Tipo"
            paper
            value="spesa"
            onChange={() => undefined}
            options={[
              { value: "impegno", label: "Impegno", icon: "calendar" },
              { value: "da-fare", label: "Da fare", icon: "square-check" },
              { value: "spesa", label: "Spesa", icon: "shopping-basket" },
              { value: "scadenza", label: "Scadenza", icon: "file-clock" },
            ]}
            data-testid="selettore-icone"
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
        <Example caption="chip · azione, senza aria-pressed">
          <Chip
            action
            icon={chipPrivate ? "lock" : "users"}
            onClick={() => setChipPrivate((v) => !v)}
            data-testid="chip-azione"
          >
            {chipPrivate ? "Lo vedi solo tu" : "Lo vede tutto il Nest"}
          </Chip>
        </Example>
        <Example caption="chip--con-togli · chip__togli">
          <span className="chip chip--statico chip--con-togli">
            <Icon name="calendar" size="s" />
            Entro venerdì 23
            <button
              type="button"
              className="chip__togli"
              aria-label="Togli la data"
              data-testid="chip-togli"
            >
              <Icon name="x" size="s" />
            </button>
          </span>
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
            {MEMBER_COLOR_CODES.map((color) => (
              <Avatar
                key={color}
                name={memberColorLabel(color)}
                color={color}
                size="m"
              />
            ))}
          </div>
        </Example>
        <Example caption="colori delle persone · pieno, tinta, corsia">
          <div className={styles.esempi} data-testid="colori-persone">
            {[...MEMBER_COLOR_CODES, "neutro" as const].map((color) => (
              <div
                key={color}
                className={`${styles.tinte} ${memberColorClass(color)}`}
                data-testid={`colori-persone-${color}`}
              >
                <span className={`${styles.tinta} ${styles["tinta--pieno"]}`} />
                <span className={`${styles.tinta} ${styles["tinta--tinta"]}`} />
                <span
                  className={`${styles.tinta} ${styles["tinta--corsia"]}`}
                />
              </div>
            ))}
          </div>
        </Example>
        <Example caption="scelta-colore · 10 colori">
          <div
            className="scelta-colore"
            role="radiogroup"
            aria-label="Il tuo colore"
            data-testid="scelta-colore-dieci"
          >
            {MEMBER_COLOR_CODES.map((color, index) => {
              const taken = color === "pomodoro";
              return (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={index === 1}
                  aria-label={
                    taken
                      ? `${memberColorLabel(color)} (già di Laura)`
                      : memberColorLabel(color)
                  }
                  disabled={taken}
                  className={`scelta-colore__colore ${memberColorClass(color)}`}
                />
              );
            })}
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
  const [namedOpen, setNamedOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nestedOpen, setNestedOpen] = useState(false);
  const [nestedDeleted, setNestedDeleted] = useState(0);
  const [confirmed, setConfirmed] = useState(0);
  const [undone, setUndone] = useState(0);

  return (
    <>
      <Section id="foglio" title="Foglio (mobile) e modale (desktop)">
        <Example caption="foglio con nome accessibile diverso dal titolo (ariaLabel, #290)">
          <Button
            variant="secondary"
            onClick={() => setNamedOpen(true)}
            data-testid="foglio-nome-apri"
          >
            Apri con nome accessibile
          </Button>
          <Sheet
            open={namedOpen}
            onClose={() => setNamedOpen(false)}
            title="Personale · Google"
            ariaLabel="Personale · Google, impostazioni del calendario"
            data-testid="foglio-nome"
            footer={
              <Button full onClick={() => setNamedOpen(false)}>
                Fatto
              </Button>
            }
          >
            <p className="t-corpo">
              Il titolo resta visibile; il nome letto dal lettore di schermo
              comincia uguale e dice che sono le impostazioni del calendario.
            </p>
          </Sheet>
        </Example>
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
        <Example caption="modale__piede--fine · solo il bottone di invio">
          <div
            className="modale__piede modale__piede--fine"
            data-testid="modale-piede-fine"
          >
            <Button>Aggiungi</Button>
          </div>
        </Example>
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
        <Example caption="gruppo-skeleton · aria-live">
          <SkeletonGroup aria-live="polite" data-testid="gruppo-skeleton-live">
            <Skeleton shape="scheda" />
          </SkeletonGroup>
        </Example>
      </Section>

      <Section id="scheda-modulo" title="Scheda di uno spazio">
        <Example caption="scheda-modulo__link · puntina vuota">
          <div className="scheda-modulo" data-testid="scheda-modulo">
            <div className="scheda-modulo__alto">
              <span className="scheda-modulo__icona">
                <Icon name="utensils" />
              </span>
              <button
                type="button"
                className="puntina"
                aria-pressed="false"
                aria-label="Fissa A tavola in Oggi"
              >
                <Icon name="pin" />
              </button>
            </div>
            <Link className="scheda-modulo__link" href="/design-system">
              <span className="scheda-modulo__titolo">A tavola</span>
              <span className="scheda-modulo__promessa">
                Cosa mangiamo questa settimana.
              </span>
            </Link>
          </div>
        </Example>
        <Example caption="puntina piena">
          <div className="scheda-modulo">
            <div className="scheda-modulo__alto">
              <span className="scheda-modulo__icona">
                <Icon name="leaf" />
              </span>
              <button
                type="button"
                className="puntina"
                aria-pressed="true"
                aria-label="Togli Stare bene da Oggi"
              >
                <Icon name="pin" />
              </button>
            </div>
            <Link className="scheda-modulo__link" href="/design-system">
              <span className="scheda-modulo__titolo">Stare bene</span>
              <span className="scheda-modulo__promessa">
                Prendersi cura di sé.
              </span>
            </Link>
          </div>
        </Example>
        <Example caption="scheda-modulo--scura">
          <div className="scheda-modulo scheda-modulo--scura">
            <div className="scheda-modulo__alto">
              <span className="scheda-modulo__icona">
                <Icon name="heart-handshake" />
              </span>
              <button
                type="button"
                className="puntina"
                aria-pressed="false"
                aria-label="Fissa Noi due in Oggi"
              >
                <Icon name="pin" />
              </button>
            </div>
            <Link className="scheda-modulo__link" href="/design-system">
              <span className="scheda-modulo__titolo">Noi due</span>
              <span className="scheda-modulo__promessa">
                Il vostro tempo, le vostre date.
              </span>
            </Link>
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

const DAY_HOURS = Array.from({ length: 15 }, (_, i) => `${i + 8}:00`);

const DAY_PEOPLE = [
  { name: "Marco", label: "Tu", color: "pomodoro" },
  { name: "Laura", label: "Laura", color: "glicine" },
  { name: "Sofia", label: "Sofia", color: "salvia" },
  { name: "Tommaso", label: "Tommaso", color: "cobalto" },
  { name: "Giuseppina", label: "Giuseppina", color: "lampone" },
  { name: "Anna", label: "Anna", color: "ceruleo" },
] as const;

function DayGrid({
  columns,
  wide,
  children,
}: {
  columns: number;
  wide?: boolean;
  children: ReactNode;
}) {
  const people = DAY_PEOPLE.slice(0, columns);
  return (
    <div
      className="vista-giorno"
      role="region"
      aria-label="Chi è dove, dalle 8:00 alle 23:00"
      tabIndex={0}
    >
      <div
        className={`giorno-persone persone-${columns}${wide ? " giorno-persone--larga" : ""}`}
      >
        <div className="giorno-persone__testa" aria-hidden="true">
          <span />
          {people.map((p) => (
            <div key={p.name} className="giorno-persone__persona">
              <Avatar name={p.name} color={p.color} size="m" nameShown />
              <span className="giorno-persone__nome">{p.label}</span>
            </div>
          ))}
        </div>
        <div className="giorno-persone__corpo">
          <div className="colonna-ore" aria-hidden="true">
            {DAY_HOURS.map((h) => (
              <span key={h} className="colonna-ore__ora">
                {h}
              </span>
            ))}
          </div>
          <div className="area-orari ore-15">
            {children}
            {Array.from({ length: columns - 1 }, (_, i) => i + 2).map((k) => (
              <span
                key={k}
                className={`area-orari__corsia sep-${k}`}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DayViewSection() {
  return (
    <Section id="giorno-persone" title="Calendario Giorno, chi è dove">
      <Example caption="giorno-persone--larga">
        <DayGrid columns={6} wide>
          <a
            className="blocco-orario da-9-00 per-1 col-1 largo-1"
            href="#giorno-persone"
          >
            <span className="blocco-orario__titolo">Palestra</span>
            <span className="blocco-orario__ora">9:00 – 10:00</span>
          </a>
          <a
            className="blocco-orario da-10-00 per-2 col-2 largo-2"
            href="#giorno-persone"
          >
            <span className="blocco-orario__titolo">Dentista</span>
            <span className="blocco-orario__ora">10:00 – 12:00</span>
          </a>
          <div className="blocco-orario blocco-orario--occupato da-9-00 per-3 col-6 largo-1">
            <span className="blocco-orario__titolo">Occupato</span>
            <span className="blocco-orario__ora">9:00 – 12:00</span>
          </div>
        </DayGrid>
      </Example>
      <Example caption="parte-2-1 e parte-2-2">
        <DayGrid columns={3}>
          <a
            className="blocco-orario da-10-00 per-2 col-1 largo-2"
            href="#giorno-persone"
          >
            <span className="blocco-orario__titolo">Cena dai nonni</span>
            <span className="blocco-orario__ora">10:00 – 12:00</span>
          </a>
          <a
            className="blocco-orario da-11-00 per-1 col-3 largo-1 parte-2-1"
            href="#giorno-persone"
          >
            <span className="blocco-orario__titolo">Compiti</span>
            <span className="blocco-orario__ora">11:00 – 12:00</span>
          </a>
          <a
            className="blocco-orario da-11-00 per-1 col-3 largo-1 parte-2-2"
            href="#giorno-persone"
          >
            <span className="blocco-orario__titolo">Basket</span>
            <span className="blocco-orario__ora">11:00 – 12:00</span>
          </a>
        </DayGrid>
      </Example>
      <Example caption="blocco-orario__lucchetto">
        <DayGrid columns={2}>
          <a
            className="blocco-orario da-9-00 per-1 col-1 largo-1"
            href="#giorno-persone"
          >
            <span className="blocco-orario__titolo">
              <span className="blocco-orario__lucchetto" aria-hidden="true">
                <Icon name="lock" size="s" />
              </span>
              Colloquio
            </span>
            <span className="blocco-orario__ora">9:00 – 10:00</span>
          </a>
        </DayGrid>
      </Example>
    </Section>
  );
}

// A wide picture (2:1) as a data address: no request to other sites.
const WISHLIST_SAMPLE_PHOTO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='100'%3E%3Crect width='200' height='100' fill='%23f2c6a0'/%3E%3C/svg%3E";

// #272 (for #34, #35 and #37): the two rules of the linked calendars page.
// Shown only with ?pezzi-pagine=1, in a section of its own.
function LinkedCalendarParts() {
  return (
    <Section
      id="pezzi-calendari-collegati"
      title="Calendari collegati (#34, #35, #37)"
    >
      <Example caption="scelta disabilitata · «Entrata e uscita» di un calendario di sola lettura">
        <div className="colonna" data-testid="scelta-disabilitata">
          <div
            className="gruppo-scelte"
            role="radiogroup"
            aria-label="Direzione"
            aria-describedby="galleria-direzione-aiuto"
          >
            <button
              type="button"
              className="scelta"
              role="radio"
              aria-checked="false"
              aria-disabled="true"
              data-testid="scelta-direzione-disabilitata"
            >
              <span className="scelta__radio" aria-hidden="true" />
              <span>
                <span className="scelta__titolo">Entrata e uscita</span>
                <span className="scelta__info">
                  {brandText(messages.calendariCollegati.directionBoth, {
                    provider: "Outlook",
                  })}
                </span>
              </span>
              <span />
            </button>
            <button
              type="button"
              className="scelta"
              role="radio"
              aria-checked="true"
              data-testid="scelta-direzione-attiva"
            >
              <span className="scelta__radio" aria-hidden="true" />
              <span>
                <span className="scelta__titolo">Solo in entrata</span>
                <span className="scelta__info">
                  {brandText(messages.calendariCollegati.directionIncoming, {
                    work: "",
                    provider: "Outlook",
                  })}
                </span>
              </span>
              <span />
            </button>
          </div>
          <p className="campo__aiuto" id="galleria-direzione-aiuto">
            Festività in Italia è di sola lettura su Outlook: si può solo
            portare qui.
          </p>
        </div>
      </Example>
      <Example caption="sezione__testa > sezione__info · mail lunga che va a capo a destra">
        <div className="sezione" data-testid="sezione-mail-lunga">
          <div className="sezione__testa">
            <h3 className="sezione__titolo">Outlook</h3>
            <span className="sezione__info">
              francesca.dangelo-rossi@studiolegaleassociato.it
            </span>
          </div>
          <ul className="scheda lista">
            <li className="riga-lista">
              <span
                className="logo-marchio logo-marchio--piccolo logo-marchio--outlook"
                aria-hidden="true"
              >
                L
              </span>
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">Lavoro</span>
                <span className="riga-lista__info">
                  Entrata e uscita · Occupato
                </span>
              </span>
            </li>
          </ul>
        </div>
      </Example>
    </Section>
  );
}

// #263 (for #32 and #33): the shared pieces of the wish list and of its
// public page. Shown only with ?pezzi-pagine=1, in a section of its own so
// the reference of `#pezzi-pagine` does not change.
function WishlistParts() {
  return (
    <Section
      id="pezzi-lista-desideri"
      title="Lista desideri e pagina pubblica (#32, #33)"
    >
      <Example caption="riga-regalo--modificabile · foto__immagine · etichetta con il nome">
        <ul className="scheda lista" data-testid="lista-desideri-righe">
          <li className="riga-regalo riga-regalo--modificabile">
            <span className="foto" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="foto__immagine"
                src={WISHLIST_SAMPLE_PHOTO}
                alt=""
              />
            </span>
            <span className="riga-lista__testo">
              <button type="button" className="riga-regalo__titolo">
                Diario segreto con lucchetto
              </button>
              <span className="riga-lista__info">
                Feltrinelli · lo vuole tanto
              </span>
            </span>
            <span className="riga-regalo__prezzo">18 €</span>
          </li>
          <li className="riga-regalo riga-regalo--modificabile">
            <span className="foto" aria-hidden="true">
              <Icon name="gift" size="l" />
            </span>
            <span className="riga-lista__testo">
              <button type="button" className="riga-regalo__titolo">
                Biglietti per il musical
              </button>
              <span className="riga-lista__info">
                Un&apos;esperienza da fare con la nonna
              </span>
            </span>
            <span />
          </li>
        </ul>
        <ul className="scheda lista" data-testid="lista-desideri-prese">
          <li className="riga-regalo riga-regalo--preso riga-regalo--modificabile">
            <span className="foto" aria-hidden="true">
              <Icon name="gift" size="l" />
            </span>
            <span className="riga-lista__testo">
              <button type="button" className="riga-regalo__titolo">
                Puzzle da 1000 pezzi
              </button>
              <span className="etichetta">
                <Icon name="check" size="s" />
                <span>
                  Zia Carla con un nome molto lungo per vedere i puntini
                </span>
              </span>
            </span>
            <span className="riga-regalo__prezzo">22 €</span>
          </li>
        </ul>
      </Example>
      <Example caption="scheda--scura con lista--notte (margini interni di 16 px)">
        <div
          className="scheda scheda--scura"
          data-testid="lista-desideri-scura"
        >
          <ul className="lista lista--notte">
            <li className="riga-lista riga-lista--notte">
              <span className="icona-riquadro icona-riquadro--scura">
                <Icon name="link" />
              </span>
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">Non ancora condivisa</span>
                <span className="riga-lista__info">
                  Crea il link e mandalo a nonni e parenti.
                </span>
              </span>
              <button type="button" className="btn-chiaro btn--piccolo">
                <span className="btn__testo">Condividi</span>
              </button>
            </li>
          </ul>
        </div>
      </Example>
      <Example caption="a.riga-regalo__titolo · riga-regalo--barrato · scheda-regalo--preso">
        <ul className="scheda lista" data-testid="lista-desideri-link">
          <li className="riga-regalo">
            <span className="foto" aria-hidden="true">
              <Icon name="gift" size="l" />
            </span>
            <span className="riga-lista__testo">
              <a
                className="riga-regalo__titolo"
                href="#pezzi-lista-desideri"
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                Set di acquerelli con pennelli
              </a>
              <span className="riga-lista__info">24,90 €</span>
            </span>
            <button type="button" className="btn-primary btn--piccolo">
              <span className="btn__testo">Lo regalo io</span>
            </button>
          </li>
          <li className="riga-regalo riga-regalo--barrato">
            <span className="foto" aria-hidden="true">
              <Icon name="gift" size="l" />
            </span>
            <span className="riga-lista__testo">
              <a
                className="riga-regalo__titolo"
                href="#pezzi-lista-desideri"
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                Casco per la bici
              </a>
              <span className="riga-lista__info">35 €</span>
            </span>
            <span className="etichetta">
              <Icon name="check" size="s" />
              Già preso
            </span>
          </li>
        </ul>
      </Example>
      <Example caption="scheda-regalo con foto__immagine (foto 160 px dentro .foto, #284)">
        <ul className="colonne colonne--tre" data-testid="scheda-regalo-foto">
          <li className="scheda scheda-regalo">
            <span className="foto" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="foto__immagine"
                src={WISHLIST_SAMPLE_PHOTO}
                alt=""
              />
            </span>
            <div className="scheda-regalo__info">
              <button type="button" className="riga-regalo__titolo">
                Diario segreto con lucchetto
              </button>
              <span className="riga-lista__info">
                Feltrinelli · lo vuole tanto
              </span>
              <div className="scheda-regalo__piede">
                <span className="riga-regalo__prezzo">18 €</span>
                <button type="button" className="btn-primary btn--piccolo">
                  <span className="btn__testo">Lo regalo io</span>
                </button>
              </div>
            </div>
          </li>
        </ul>
      </Example>
      <Example caption="cornice-pubblica · pubblica-solo-mobile · pubblica-solo-desktop">
        <div className="cornice-pubblica" data-testid="cornice-pubblica">
          <div className="pagina">
            <p
              className="pubblica-solo-mobile t-nota"
              data-testid="pubblica-solo-mobile"
            >
              Si vede sotto 1024 px
            </p>
            <p
              className="pubblica-solo-desktop t-nota"
              data-testid="pubblica-solo-desktop"
            >
              Si vede da 1024 px
            </p>
            <p className="marchio t-nota t-secondario">
              <span className="quadrato-nest" aria-hidden="true">
                <span className="quadrato-nest__punto membro-pomodoro" />
                <span className="quadrato-nest__punto membro-glicine" />
                <span className="quadrato-nest__punto membro-salvia" />
                <span className="quadrato-nest__punto membro-cobalto" />
              </span>
              {brandText(messages.brand.createdWith)}
            </p>
          </div>
        </div>
      </Example>
    </Section>
  );
}

function EditableRowsSection() {
  return (
    <Section id="righe-modifica" title="Righe di Casa che aprono Modifica">
      <Example caption="riga-lista--modificabile">
        <ul className="scheda lista" data-testid="righe-modificabili">
          <li className="riga-lista riga-lista--modificabile">
            <Checkbox
              checked={false}
              onChange={() => {}}
              aria-label="Segna come fatto: Chiamare il commercialista"
            />
            <span className="riga-lista__testo">
              <button type="button" className="riga-lista__titolo">
                Chiamare il commercialista
              </button>
              <span className="riga-lista__info">Entro giovedì</span>
            </span>
            <Avatar name="Laura" color="glicine" nameShown />
          </li>
          <li className="riga-lista riga-lista--modificabile">
            <Checkbox
              checked={false}
              onChange={() => {}}
              aria-label="Segna come fatto: Preparare lo zaino"
            />
            <span className="riga-lista__testo">
              <button type="button" className="riga-lista__titolo">
                Preparare lo zaino
              </button>
            </span>
            <span />
          </li>
        </ul>
      </Example>
      <Example caption="a.riga-scadenza">
        <ul className="scheda lista" data-testid="righe-scadenza">
          <li>
            <a className="riga-scadenza" href="#righe-modifica">
              <span className="riga-scadenza__giorni">
                <span className="riga-scadenza__numero">3</span>
                <span className="riga-scadenza__unita">giorni</span>
              </span>
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">
                  Rinnovo assicurazione
                </span>
                <span className="riga-lista__info">Giovedì 23 ottobre</span>
              </span>
              <span />
            </a>
          </li>
          <li>
            <a className="riga-scadenza" href="#righe-modifica">
              <span className="riga-scadenza__giorni">
                <span className="riga-scadenza__numero">12</span>
                <span className="riga-scadenza__unita">giorni</span>
              </span>
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">
                  Iscrizione al centro estivo
                </span>
                <span className="riga-lista__info">Mercoledì 4 novembre</span>
              </span>
              <span />
            </a>
          </li>
        </ul>
      </Example>
    </Section>
  );
}

const MONTH_WEEK = [
  { day: "27", label: "27 ottobre", dots: [] as string[] },
  { day: "28", label: "28 ottobre", dots: ["salvia"] },
  { day: "29", label: "29 ottobre", dots: ["pomodoro", "glicine", "cobalto"] },
  {
    day: "30",
    label: "30 ottobre",
    dots: ["pomodoro", "glicine", "salvia", "cobalto", "zafferano", "peonia"],
  },
  { day: "31", label: "31 ottobre", dots: [] as string[] },
  { day: "1", label: "1 novembre", dots: [] as string[] },
  { day: "2", label: "2 novembre", dots: [] as string[] },
];

function MonthDots({ dots }: { dots: readonly string[] }) {
  return (
    <span
      className={`griglia-mese__punti${dots.length > 4 ? " griglia-mese__punti--molti" : ""}`}
    >
      {dots.map((color) => (
        <span
          key={color}
          className={`avatar avatar--punto membro-${color}`}
          aria-hidden="true"
        />
      ))}
      {dots.length > 4 ? (
        <span className="griglia-mese__altri" aria-hidden="true" />
      ) : null}
    </span>
  );
}

function MonthRow({ loading }: { loading?: boolean }) {
  return (
    <div className="griglia-mese">
      <div className="griglia-mese__riga">
        {["L", "M", "M", "G", "V", "S", "D"].map((letter, index) => (
          <span
            key={index}
            className="griglia-mese__intestazione"
            aria-hidden="true"
          >
            {letter}
          </span>
        ))}
      </div>
      <div className="griglia-mese__riga">
        {MONTH_WEEK.map((cell, index) => (
          <button
            key={cell.label}
            type="button"
            className={[
              "griglia-mese__cella",
              index >= 5 ? "griglia-mese__cella--weekend" : "",
              index === 5 ? "griglia-mese__cella--festa" : "",
              index === 2 ? "griglia-mese__cella--selezionata" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={cell.label}
          >
            <span className="griglia-mese__numero">{cell.day}</span>
            <MonthDots dots={loading ? [] : cell.dots} />
          </button>
        ))}
      </div>
    </div>
  );
}

function MonthSection() {
  return (
    <Section id="griglia-mese" title="Calendario Mese">
      <Example caption="griglia-mese__altri">
        <MonthRow />
      </Example>
      <Example caption="griglia in caricamento">
        <MonthRow loading />
      </Example>
      <Example caption="contorno dei punti">
        <div className="griglia-mese">
          <div className="griglia-mese__riga">
            <button
              type="button"
              className="griglia-mese__cella"
              aria-label="15 novembre"
            >
              <span className="griglia-mese__numero">15</span>
              <MonthDots dots={["zafferano", "peonia", "salvia"]} />
            </button>
          </div>
        </div>
      </Example>
      <Example caption="periodo--con-oggi">
        <div className="periodo periodo--con-oggi">
          <h3 className="t-titolo-pagina">Dicembre 2026</h3>
          <div className="periodo__frecce">
            <IconButton icon="chevron-left" aria-label="Mese precedente" />
            <IconButton icon="chevron-right" aria-label="Mese successivo" />
          </div>
          <div className="periodo__oggi">
            <Link href="#griglia-mese" className="btn-link">
              Oggi
            </Link>
          </div>
        </div>
      </Example>
    </Section>
  );
}

function PageParts() {
  const [backOpen, setBackOpen] = useState(false);
  const [backCount, setBackCount] = useState(0);
  return (
    <Section id="pezzi-pagine" title="Pezzi delle pagine (#29, #31, #38, #41)">
      <Example caption="sezione__link · link nella testa di una sezione">
        <div className="sezione" data-testid="sezione-link">
          <div className="sezione__testa">
            <h3 className="sezione__titolo">Questa settimana</h3>
            <Link href="#pezzi-pagine" className="sezione__info sezione__link">
              Vedi nel calendario
            </Link>
          </div>
          <List className="scheda">
            <ListRow href="#pezzi-pagine">
              <span className="riga-lista__ora">Gio</span>
              <span className="riga-lista__testo">
                <span className="riga-lista__titolo">Nuoto Sofia</span>
                <span className="riga-lista__info">
                  Giovedì alle 17:00, piscina comunale
                </span>
              </span>
            </ListRow>
          </List>
        </div>
      </Example>
      <Example caption="profilo-testa__azione · solo da 1024 px">
        <div
          className="profilo-testa profilo-testa--riga"
          data-testid="profilo-testa-azione"
        >
          <Avatar name="Sofia" color="salvia" size="xl" />
          <div className="intestazione">
            <h3 className="intestazione__titolo t-titolo-pagina">Sofia</h3>
            <p className="intestazione__sotto">9 anni · Figlio o figlia</p>
          </div>
          <button
            type="button"
            className="btn-secondary btn--piccolo profilo-testa__azione"
            aria-haspopup="dialog"
          >
            <Icon name="pencil" size="s" />
            Modifica il profilo
            <VisuallyHidden> di Sofia</VisuallyHidden>
          </button>
        </div>
      </Example>
      <Example caption="modulo-gruppo e modulo-gruppo--sezione">
        <form className="modulo-gruppo" data-testid="modulo-gruppi">
          <TextField label="Nome" defaultValue="Sofia" />
          <div className="modulo-gruppo modulo-gruppo--sezione">
            <TextField
              label="Nome della scuola"
              placeholder="Es. scuola Manzoni"
            />
            <TextField label="Classe" placeholder="Es. 4ª B" />
          </div>
        </form>
      </Example>
      <Example caption="campo-doppio--tre · tre campi corti">
        <div
          className="campo-doppio campo-doppio--tre"
          data-testid="campo-doppio-tre"
        >
          <TextField label="Scarpe" placeholder="Es. 33" />
          <TextField label="Vestiti" placeholder="Es. 9–10" />
          <TextField label="Pigiama" placeholder="Es. 140" />
        </div>
      </Example>
      <Example caption="a.parola · parola--insieme · parola--a-capo (sintesi di Notifiche, #39)">
        <section
          className="scheda scheda--evidenza sintesi"
          aria-label="Il tuo martedì"
          data-testid="sintesi-parole"
        >
          <p className="sintesi__frase">
            Alle{" "}
            <Link href="#pezzi-pagine" className="parola">
              16:00
            </Link>{" "}
            hai{" "}
            <Link
              href="#pezzi-pagine"
              className="parola parola--a-capo"
              data-testid="parola-a-capo"
            >
              Riunione di condominio con tutti i vicini del palazzo
            </Link>
            , poi tu e Laura siete{" "}
            <Link href="#pezzi-pagine" className="parola parola--insieme">
              liberi dalle 21:30
            </Link>
            .
          </p>
        </section>
      </Example>
      <Example caption="Ricerca (#40): campo con anello, numero dei chip, palette con risultati che scorrono, stato vuoto con testo lungo">
        <div className="colonna" data-testid="ricerca-pezzi">
          <form className="campo-ricerca" role="search">
            <Icon name="search" />
            <label className="visivamente-nascosto" htmlFor="galleria-ricerca">
              Cerca nel Nest
            </label>
            <input
              id="galleria-ricerca"
              type="search"
              className="campo-ricerca__input"
              placeholder="Cerca nel Nest"
              autoComplete="off"
            />
          </form>
          <ChipGroup aria-label="Filtra i risultati">
            <Chip count={3}>Impegni</Chip>
            <Chip count={2} pressed>
              Spesa
            </Chip>
          </ChipGroup>
          <div data-testid="palette-esempio">
            <div className="palette__risultati" data-testid="palette-risultati">
              <div className="palette__gruppo">
                <p className="palette__gruppo-titolo">Impegni</p>
                <ul className="lista">
                  <li>
                    <div className="riga-lista">
                      <span className="riga-lista__testo">
                        <span className="riga-lista__titolo">Nuoto Sofia</span>
                      </span>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
            <div className="palette__piede">
              <span>↑ ↓ per scorrere</span>
              <span>↵ per aprire</span>
              <span>esc per chiudere</span>
            </div>
          </div>
          <EmptyState
            large
            data-testid="vuoto-lungo"
            title="Niente per «aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa»"
            text="Prova con un’altra parola."
            actions={<Button variant="secondary">Cerca ancora</Button>}
          />
        </div>
      </Example>
      <Example caption="sezione--ancora · si ferma sotto la barra">
        <section
          id="notifiche-esempio"
          className="sezione sezione--ancora"
          aria-labelledby="notifiche-esempio-titolo"
          data-testid="sezione-ancora"
        >
          <div className="sezione__testa">
            <h3 className="sezione__titolo" id="notifiche-esempio-titolo">
              Notifiche
            </h3>
          </div>
        </section>
      </Example>
      <Example caption="spazio-arrivo · link solo desktop, scheletro del bottone">
        <div className="colonna" data-testid="spazio-arrivo">
          <Link
            href="#pezzi-pagine"
            className="btn-link btn-link--secondario spazio-arrivo__desktop"
          >
            <span aria-hidden="true">←</span> Esplora
          </Link>
          <div className="sezione spazio-arrivo">
            <div className="spazio-arrivo__alto">
              <span className="stato-vuoto__icona" aria-hidden="true">
                <Icon name="utensils" />
              </span>
            </div>
            <span className="etichetta">
              <Icon name="hourglass" size="s" />
              In arrivo
            </span>
            <h3 className="t-display">A tavola</h3>
            <SkeletonGroup data-testid="skeleton-bottone">
              <Skeleton shape="bottone" />
            </SkeletonGroup>
          </div>
        </div>
      </Example>
      <Example caption="Button con pressed, aria-haspopup e ColorChoice busy (#236)">
        <div className="colonna" data-testid="pezzi-bottoni-236">
          <Button variant="primary" full icon="bell" pressed={false}>
            Avvisami quando è pronto
          </Button>
          <Button variant="secondary" full icon="check" pressed>
            Ti avvisiamo appena è pronto
          </Button>
          <Button variant="pericolo" aria-haspopup="dialog">
            Elimina l&apos;account
          </Button>
          <ColorChoice
            aria-label="Colore in salvataggio"
            value="salvia"
            busy
            onChange={() => undefined}
            idPrefix="galleria-busy"
          />
        </div>
      </Example>
      <Example caption="Alert con role status e con fuoco da codice (#251)">
        <div className="colonna" data-testid="pezzi-alert-251">
          <Alert variant="errore" role="status" data-testid="alert-status">
            Non riusciamo a caricare le notifiche.
          </Alert>
          <Alert
            variant="avviso"
            role="alert"
            tabIndex={-1}
            data-testid="alert-focus"
          >
            Controlla la connessione e riprova.
          </Alert>
        </div>
      </Example>
      <Example caption="riga-evento--passato (testo secondario, senza opacità)">
        <div className="colonna" data-testid="riga-passata">
          <div
            className="riga-evento riga-evento--compatta riga-evento--passato"
            data-testid="riga-passata-normale"
          >
            <span className="riga-evento__ora">8:00</span>
            <span className="riga-evento__testo">
              <span className="riga-evento__titolo">Scuola Sofia</span>
              <span className="riga-evento__info">la porta Laura</span>
            </span>
          </div>
          <div
            className="riga-evento riga-evento--compatta riga-evento--insieme riga-evento--passato"
            data-testid="riga-passata-insieme"
          >
            <span className="riga-evento__ora">19:00</span>
            <span className="riga-evento__testo">
              <span className="riga-evento__titolo">Cena dai nonni</span>
              <span className="riga-evento__info">li porta Marco</span>
            </span>
          </div>
        </div>
      </Example>
      <Example caption="oggi-solo-mobile e oggi-solo-desktop · lista-partenza__passi">
        <div className="colonna" data-testid="oggi-disposizioni">
          <p className="oggi-solo-mobile t-nota" data-testid="oggi-solo-mobile">
            Si vede sotto 1024 px
          </p>
          <p
            className="oggi-solo-desktop t-nota"
            data-testid="oggi-solo-desktop"
          >
            Si vede da 1024 px
          </p>
          <section className="scheda scheda--evidenza lista-partenza">
            <p className="lista-partenza__sopra">
              <span>Per cominciare</span>
              <span>1 di 3</span>
            </p>
            <h4 className="lista-partenza__titolo t-titolo-scheda">
              Tre cose e la casa è pronta
            </h4>
            <ul className="lista-partenza__passi" data-testid="lista-passi">
              <li>
                <div className="passo-partenza is-fatto">
                  <span className="passo-partenza__cerchio" aria-hidden="true">
                    <Icon name="check" size="s" />
                  </span>
                  <span className="passo-partenza__testo">Crea il Nest</span>
                </div>
              </li>
              <li>
                <div className="passo-partenza">
                  <span
                    className="passo-partenza__cerchio"
                    aria-hidden="true"
                  />
                  <span className="passo-partenza__testo">
                    Scrivi la prima cosa da comprare
                  </span>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </Example>
      <Example caption="riga-opzione come bottone · is-in-corso · Sheet con onBack (#258)">
        <div className="colonna" data-testid="riga-opzione-258">
          <div className="scheda">
            <button type="button" className="riga-opzione">
              <Icon name="calendar" />
              <span className="riga-opzione__nome">Giovedì 22 ottobre</span>
              <span className="riga-opzione__valore">17:00 – 18:00</span>
            </button>
            <div className="is-in-corso">
              <button
                type="button"
                className="riga-opzione"
                aria-disabled="true"
              >
                <Icon name="users" />
                <span className="riga-opzione__nome">Chi</span>
                <span className="riga-opzione__valore">Sofia</span>
              </button>
              <button
                type="button"
                className="btn-link btn-link--secondario"
                aria-disabled="true"
              >
                <Icon name="sliders-horizontal" size="s" />
                Più dettagli
              </button>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() => setBackOpen(true)}
            data-testid="foglio-ritorno-apri"
          >
            Apri foglio con ritorno
          </Button>
          <span className="t-nota t-secondario" data-testid="foglio-ritorno-n">
            Indietro: {backCount}
          </span>
          <Sheet
            open={backOpen}
            onClose={() => setBackOpen(false)}
            onBack={() => setBackCount((n) => n + 1)}
            title="Nuovo impegno"
            data-testid="foglio-ritorno"
            footer={
              <Button full onClick={() => setBackOpen(false)}>
                Chiudi il foglio
              </Button>
            }
          >
            <p className="t-corpo">
              X, Esc, velo e maniglia tornano indietro senza chiudere.
            </p>
          </Sheet>
        </div>
      </Example>
    </Section>
  );
}
