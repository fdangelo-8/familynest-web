# #503 · F4a Componenti 2.0 di base · dettagli del requisito

Requisito e criteri di accettazione (CA) sono nella issue #503. Qui ci sono le tabelle che la issue cita con «§». Se issue e file si contraddicono, vale la issue. Fonti: `.claude/skills/design-system/riferimento/telefono.md` («Componenti 2.0», «Contrasti»), `computer.md` («Fuoco e mouse»), tavole `docs/design/telefono/componenti/tavola-p5-k1-*`, `k2-*`, `k3-*` (vale il «dopo» con l'etichetta scura), `ritocchi-p6/rt1-04`–`rt1-06`, `rt1-22`–`rt1-24`. Token: quelli di F2 (`docs/specifiche/196-token-e-font.md`). Dove questo file aggiunge qualcosa che le fonti non dicono, lo segna con **(default)** e la domanda è nella issue.

Regola generale: **stesso ruolo, stesso nome**. Una variante che esiste già e ha un equivalente 2.0 cambia aspetto e le pagine la seguono da sole. Una forma che ha un DOM diverso arriva come prop o componente nuovo, che le pagine adottano quando vengono riallineate. Nessuna prop esistente viene tolta o cambia significato.

## §1 Pulsanti, quattro livelli (`Button`, `k2-08`)

| `variant` esistente      | Livello 2.0                    | Aspetto dopo F4a                                                                                                                                                              |
| ------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `primary`                | 1 · pieno                      | fondo `--color-azione`, testo `--color-bianco`, `min-height: var(--size-azione)` (52), raggio `--radius-pulsante` (14), 600 `--text-controllo-*` (16/22)                      |
| `secondary`              | 2 · a filo                     | fondo `--color-superficie`, bordo `--border-sottile` `--color-inchiostro`, testo inchiostro, misure come il primario                                                          |
| `quieto` **nuovo**       | 3 · quieto                     | fondo `--color-carta-2`, senza bordo, testo inchiostro, misure come il primario                                                                                               |
| `tenue`                  | 3 · quieto, piccolo            | fondo `--color-carta-2` (oggi `--color-carta`, che con F2 è bianca); altezza invariata                                                                                        |
| `link`                   | 4 · testo                      | testo inchiostro 600, sottolineato `text-decoration-thickness: var(--border-link)`, `text-underline-offset: var(--space-link)`, area di tocco almeno `--size-tocco` (44 × 44) |
| `link-secondario`        | 4 · testo                      | come `link`, testo `--color-inchiostro-2`                                                                                                                                     |
| `pericolo`               | 4 · testo rosso                | come `link`, testo `--color-allerta`                                                                                                                                          |
| `pericolo-pieno`         | rosso pieno (solo nel dialogo) | fondo `--color-allerta`, testo `--color-bianco`, misure come il primario                                                                                                      |
| `chiaro`, `tratteggiato` | nessuno                        | **invariati**; `componenti.md` li segna «vecchi, non usare nelle pagine 2.0»                                                                                                  |

Stati di tutti i livelli: premuto (`:active`) `--color-azione-premuto` sul pieno, `--color-premuto` su a filo e quieto. Mouse (solo dentro `@media (hover: hover)`, solo cambio di fondo): pieno `--color-azione-premuto` **(default**, `--color-azione-mouse` è «da chiarire» in `computer.md`), quieto `--color-filo`. Disabilitato e caricamento restano come oggi, con stili separati (lezione «Caricamento con lo stile del disabilitato»). Le prop `full`, `small`, `icon`, `arrow`, `loading` restano.

## §2 Campi (`Field`, `PasswordField`, tavola k2 riga «Campi»)

| Stato                | Aspetto                                                                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scatola              | `min-height: var(--size-campo)` (56), raggio `--radius-m` (12), bordo `--border-sottile` `--color-filo-campo`, fondo `--color-superficie`; l'etichetta (`<label>`) sta **dentro** la scatola                                               |
| Vuoto, senza fuoco   | l'etichetta occupa il posto del valore, alla misura del valore (k2 «vuoto»)                                                                                                                                                                |
| Pieno o con il fuoco | etichetta in alto, `--text-etichetta-*` (12/16), peso 400, `--color-inchiostro-2`; valore sotto, `1rem` (16 px, così iOS non ingrandisce), inchiostro                                                                                      |
| Fuoco                | bordo di 2 px `--color-inchiostro`, senza spostare il contenuto (per esempio `box-shadow` interna); l'anello di fuoco globale non si somma sulla scatola                                                                                   |
| Errore               | bordo `--color-allerta`, fondo `--color-allerta-fondo`; sotto la scatola il segno (`circle-alert`) e il testo, `--text-nota-*` (13/18), 400, `--color-allerta`; l'etichetta **non** diventa rossa **(default**, correzione 6 del Passo 12) |
| Aiuto                | sotto la scatola, `--text-nota-*`, `--color-inchiostro-2`; con errore e aiuto, prima l'errore                                                                                                                                              |
| Movimento            | l'etichetta sale in `--durata-rapida` con `--curva`; con movimento ridotto cambia senza transizione                                                                                                                                        |

Data e ora (`DateField`, `TimeField`), `SelectField` (con `chevron-down` a destra) e area di testo (`multiline`) hanno sempre l'etichetta in alto **(default**: il campo nativo mostra già un formato o un valore). In `PasswordField` il pulsante «Mostra la password» sta dentro la scatola, a destra, con area di 44 px.

**Campi uniti, `FieldGroup` nuovo:** una sola scatola con raggio 12 e bordo `--color-filo-campo`. Dentro, i campi senza bordo proprio sono separati da un filo `--border-sottile` `--color-filo-campo`. `columns` mette due campi su una riga (scadenza e codice, tavola k2). Il fuoco e l'errore riguardano solo il campo interessato. Il testo d'errore va sotto il blocco ed è collegato con `aria-describedby` al campo sbagliato. `FieldPair` (due campi separati affiancati) resta com'è.

## §3 Avvisi, errore di pagina, vuoto, messaggio (tavola k3 riga «Avvisi, vuoti, errori, messaggi»)

**`Alert`.** Varianti `info`, `avviso`, `ok`: fondo `--color-carta-2`, raggio `--radius-m`, nessun bordo, icona nuda inchiostro (per `ok` `--color-ok`). Variante `errore`: fondo `--color-allerta-fondo`, icona `--color-allerta`, testo inchiostro **(default**, vedi domanda 4). Prop nuova `lead`: parole in grassetto prima del testo («Sei offline.»). Variante nuova `offline`: aspetto dell'errore, icona `wifi-off`, `lead` predefinito «Sei offline.» da `it.ts`, `role="status"`, nessuna `action` (il tipo non la ammette), resta ferma in cima (`position: sticky; top: 0`) mentre la pagina scorre. Senza rete l'avviso non ha «Riprova»: riprova da solo (`rt1-23`).

**`PageError`.** Icona nuda (senza cerchio), `--color-allerta`; titolo `--text-titolo-sezione-*` (21/27, 700); frase `--color-inchiostro-2`; «Riprova» è `Button` `secondary` di misura normale, senza icona, largo quanto il testo; tutto allineato a sinistra, come nella tavola. I testi predefiniti di oggi restano (F4a non cambia testi delle pagine); l'esempio della galleria usa quelli della tavola.

**`EmptyState`, variante nuova `box`:** tutto il riquadro è un solo `<a>` (`href`) o `<button>` (`onClick`). Bordo `--border-sottile` `--color-filo-2`, raggio `--radius-l` (16). Dentro: il + in un cerchio a filo (`plus`, inchiostro), il titolo in 600 e la frase in `--color-inchiostro-2`. Premuto: fondo `--color-premuto`. Il nome accessibile comincia con il titolo. Con `variant="box"` la prop `actions` non serve (tipo a varianti). Le varianti di oggi restano.

**`Toast`.** Fondo `--color-inchiostro`, testo `--color-bianco`, raggio `--radius-m`, in basso, resta 5 secondi (come oggi). «Annulla» è testo sottolineato bianco (`--border-link`, `--space-link`), senza icona, con area di 44 px. Senza `icon` non mostra nessuna icona **(default**, la tavola non ne ha; oggi mostra la spunta); `icon` si può ancora passare.

## §4 Freccia indietro D (`BackLink` e `CloseLink` in `src/components/ui/AppFrame/IconLinks.tsx`)

- Nuda: nessun fondo, bordo o ombra; area `--size-tocco` (44 × 44); icona `arrow-left` 24 px (`--size-icona-l`), inchiostro; `aria-label` «Indietro» (chiave `back` di `it.ts`); nessuna etichetta accanto. Il comportamento di oggi (indietro nella cronologia, altrimenti `fallback`) resta.
- Prop nuova `onMedia`: la stessa freccia dentro un disco `--color-superficie` di 40 px **(default**, misurato su `rt1-06` e scritto nella nota di k1) centrato nell'area di 44, ombra `--shadow-disco` (`telefono.md`; vedi domanda 2).
- `CloseLink` prende le stesse regole, con l'icona `x` e «Chiudi».

## §5 Righe e interruttore (tavola k1)

**`List`, prop nuova `flush`:** elenco a filo, senza fondo, scheda o ombra. Tra le righe c'è un divisore `--border-sottile` `--color-filo`. Senza `flush` la lista resta com'è oggi.

**`ListRow`, prop nuove** (senza, la riga resta com'è oggi):

| Prop            | Effetto                                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `title`, `text` | titolo e riga sotto (`--color-inchiostro-2`); titolo in 600 se la riga ha `href` o `onClick`, in 400 se è ferma                     |
| `icon`          | icona nuda a sinistra, 24 px, inchiostro (mai in un riquadro)                                                                       |
| `arrow`         | freccia sottile B in fondo: `chevron-right`, `--color-inchiostro-3`, `aria-hidden` (risposta 72); solo con `href` o `onClick`       |
| `value`         | scelta veloce: valore attuale a destra in `--color-inchiostro-2`, prima della freccia                                               |
| `add`           | al posto dell'icona, il cerchio a filo con il + (k1-09); solo con `href` o `onClick`                                                |
| `tone="danger"` | titolo e icona in `--color-allerta` (k1-09, «Togli Laura dal Nest»)                                                                 |
| `trailing`      | un controllo a destra (per esempio `Toggle`); il tipo lo ammette solo senza `href` e `onClick` (mai un interattivo dentro un altro) |

Misure delle righe 2.0: `min-height: var(--size-riga-alta)` (64), `padding-block: var(--space-riga)` (13), spazio di 16 px. Premuta: fondo `--color-premuto` da bordo a bordo della riga. Mouse (`hover: hover`): `--color-carta-2` **(default**, `--color-riga-mouse` arriva con il guscio da computer).

**`ValueRow` nuovo, «dato che si cambia» (k1-05):** etichetta sopra (`--text-etichetta-*`, `--color-inchiostro-2`), valore sotto (inchiostro), a destra «Modifica» (`Button` `link`, chiave `edit` di `it.ts`), con `onEdit` o `editHref`. Il nome accessibile di «Modifica» è «Modifica » seguito dall'etichetta (per esempio «Modifica Nome»): comincia con il testo visibile, il resto è in `VisuallyHidden` e lo spazio viene dalla struttura.

**`Toggle`:** acceso, binario `--color-inchiostro` e pallino `--color-superficie` (niente verde). Spento, binario `--color-filo-2` con bordo `--border-sottile` `--color-filo-campo` **(default**, domanda 5 di F2: oggi il pallino bianco sul binario ha 1,64:1). Misure, ruolo `switch` e tasti restano come oggi. Con movimento ridotto il pallino non scorre.

## §6 Vibrazione da una funzione unica (strada A, #397, commento di Francesco su questa issue)

`src/lib/haptic.ts` (nuovo): `export type HapticKind = "leggera" | "conferma" | "avviso"` e `export function haptic(kind: HapticKind): void`. I tre tipi sono quelli delle note di Fable: leggera (spunta, scelta, tocco), conferma (titolo arrivato, fine del primo avvio), avviso (dialogo di conferma, sovrapposti). **Sul web non fa nulla**: non chiama `navigator.vibrate` e non tocca nessuna API del browser. Nel guscio (N0–N5) il corpo chiamerà il plugin nativo, senza cambiare la firma. In F4a nessun componente la chiama (il dialogo di conferma è di F4c #505). La regola in `componenti.md` dice che nessun file di `src/` chiama `navigator.vibrate`.

## §7 Galleria `/design-system` (`Gallery.tsx`), un esempio per prop nuova

Testi e dati di prova come nelle tavole (Marco, Laura, Sofia, Biscotto):

1. «Pulsanti · quattro livelli»: «Salva» (primary), «Usa di nuovo» (secondary con icona), «Metti in spesa» (quieto con icona), «Annulla» (link), «Elimina la lista» (pericolo).
2. «Piede della pagina»: «Annulla» link a sinistra, «Salva» primario a destra (solo disposizione, il componente del piede è di F4c).
3. «Campi · vuoto, pieno, a fuoco»: tre `TextField` «Nome» (vuoto, «Sofia», «Sofi» con il fuoco).
4. «Campi · errore e aiuto»: «Telefono» con «02 48» e l'errore «Il numero è troppo corto: controlla le cifre.»; «Nota» (area di testo) con l'aiuto «Niente dati di salute delle persone.».
5. «Campi uniti»: «La tua mail» + «Password»; «Numero della carta» + «Scadenza» | «Codice» con `columns`.
6. «Avvisi»: informazione «Sofia non ha un account: il suo profilo lo tenete voi adulti.»; offline con «Sei offline.» e «Vedi le cose aggiornate alle 19:05; le modifiche partiranno appena torna la connessione.».
7. «Vuoto · tutto il riquadro»: «Nuova scadenza» con «Antiparassitario, vaccino, visita: ve li ricordiamo noi.».
8. «Errore di pagina»: «Questa pagina non si è caricata» con «Controlla la connessione e riprova.».
9. «Messaggio»: «Fatto: Passeggiata della sera» con «Annulla» (un pulsante lo apre).
10. «Freccia indietro»: nuda con «Modifica» a destra; `onMedia` sopra un riquadro scuro segnaposto (nessuna foto vera).
11. «Righe che portano altrove»: «Impostazioni» / «Tema, notifiche, privacy», «Calendari collegati» / «Google e Outlook», «Il tuo profilo» / «I tuoi dati e il tuo account», con icona e freccia.
12. «Dati che si cambiano»: Nome «Marco», Mail «marco.bianchi@esempio.it», Compleanno «18 settembre».
13. «Scelte veloci e interruttori»: «Promemoria prima di un impegno» con valore «Un'ora prima»; «Non disturbare» / «Dalle 22:00 alle 7:00» acceso; «Cose aggiunte alla spesa» spento.
14. «Azioni dentro un elenco»: «Invita una persona» / «Riceve un link ed entra» e «Aggiungi un figlio o un animale» (`add`); «Togli Laura dal Nest» (`tone="danger"`).

## §8 Test da toccare

Cambiano aspetto `primary`, `secondary`, `tenue`, `link*`, `pericolo*`, i campi, gli avvisi, l'errore di pagina, il messaggio, la freccia e l'interruttore in tutte le pagine (rischio accettato, come «pagine metà vecchie» di F2). Ordine di grandezza dei test che li citano: classi dei pulsanti 9 file, campi 15, avvisi 27, errore di pagina 9, interruttore 26 (ricerca in `tests/` del 26/11). I test e2e che usano ruolo e nome restano validi; si aggiornano quelli che controllano classi, colori o misure (`tests/e2e/design-system.spec.ts`, `design-system-static.spec.ts`, `tests/a11y/schermi-*.spec.ts`). Tutti i riferimenti visivi li rigenera il tester visivo. Se un test di una pagina fallisce per l'aspetto nuovo, lo sviluppatore lo scrive nella PR con file e motivo e il coordinatore decide.

## §9 Contrasti verificati dal test (formula WCAG 2.1 sui valori calcolati)

| Primo piano                                       | Fondo                                   | Minimo |
| ------------------------------------------------- | --------------------------------------- | ------ |
| testo del primario e del rosso pieno              | il loro fondo                           | 4,5    |
| testo di secondario, quieto, link                 | il loro fondo / `--color-superficie`    | 4,5    |
| testo di `pericolo`                               | `--color-superficie`                    | 4,5    |
| testo e «Annulla» del messaggio                   | fondo del messaggio                     | 4,5    |
| testo di ogni variante di `Alert`                 | fondo della variante                    | 4,5    |
| testo d'errore del campo                          | `--color-superficie`                    | 4,5    |
| etichetta dentro il campo                         | fondo del campo, anche in errore        | 4,5    |
| bordo del campo a riposo e in errore              | fondo intorno e fondo del campo         | 3      |
| bordo del secondario                              | `--color-superficie`                    | 3      |
| binario o bordo dell'interruttore spento e acceso | `--color-superficie`                    | 3      |
| disco della freccia `onMedia`                     | — (fondo variabile: c'è l'ombra)        | —      |
| anello di fuoco                                   | `--color-superficie`, `--color-carta-2` | 3      |
