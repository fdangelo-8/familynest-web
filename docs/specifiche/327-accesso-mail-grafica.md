# #327 · Accesso con mail e password · specifica grafica completa

Designer, 06/11/2026. Il riassunto sta nella sezione **Specifica grafica** della issue #327; qui ci sono stati, testi, CSS e accessibilità per intero.

Decisione di Francesco del 06/11 (issue #327): mail e password al posto del link magico. Sostituisce la specifica di M1, M2 e M3 della #11 (le schermate «Usa la mail»), non il mockup `01-accesso`, che resta com'è. Allineata al requisito dell'analista e alle decisioni del coordinatore su D2–D6 (commento del 06/11 nella #327).

**Fonti:** `01-accesso`, specifica della #11 (M1, M2, M3, mail), `07-invito-benvenuto` (errore su notte), `08-invito-colore` (passo chiaro con campo), skill `design-system`. Tutto quello che segue è **[ricavato]** (non disegnato nel mockup). **[nuovo]** = componente o classe nuova, definita nella skill (`riferimento/componenti.md`, «Campo password e regole»). `[D: chiave]` = testo citato nei criteri di accettazione.

## 1. Schermate e rotte

| Sigla | Schermata                        | Rotta (requisito)                             | Da dove si arriva                                                                  |
| ----- | -------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------- |
| A     | Accesso (mockup `01`, invariato) | `/accesso`                                    | —                                                                                  |
| E     | Entra                            | `/accesso/mail`, voce «Entra»                 | «Usa la mail» di A; «Entra con la mail» di L                                       |
| R     | Registrati                       | `/accesso/mail`, voce «Registrati»            | voce del selettore; «Usa un'altra mail» di C                                       |
| C     | Controlla la posta               | `/accesso/mail`, dopo l'invio                 | R riuscito; «Rimanda la mail» nell'avviso di E                                     |
| F     | Password dimenticata             | `/accesso/password-dimenticata`               | «Password dimenticata?» e «Scegli una password» di E; «Mandami un nuovo link» di L |
| T     | Ti abbiamo scritto               | `/accesso/password-dimenticata`, dopo l'invio | F                                                                                  |
| N     | Nuova password                   | `/accesso/nuova-password`                     | link della mail di reimpostazione                                                  |
| L     | Link scaduto                     | `/accesso/link-scaduto?tipo=…`                | link scaduto, già usato o non valido                                               |

### Come si passa da Entra a Registrati

**Un selettore a due voci nella stessa pagina** (`SegmentedControl`, `.selettore`, voci `button[aria-pressed]`, gruppo con `aria-label` «Hai già un account?»): «Entra» · «Registrati». Predefinita «Entra». Perché:

- chi arriva da «Usa la mail» spesso non sa se ha già un account (chi entrava con il link magico ce l'ha, ma senza password): le due strade si vedono insieme, con lo stesso peso, prima dei campi;
- la **mail scritta resta** passando da una voce all'altra (memoria della pagina, mai nell'indirizzo); la password invece si svuota, torna nascosta e gli errori spariscono, così una password di accesso non diventa per sbaglio una password nuova;
- è il controllo che il sistema usa già per scegliere tra due modi (Casa, Calendario).

Cambiando voce cambiano titolo, sottotitolo, `autocomplete` e testo del bottone; il focus resta sulla voce.

F, T, N e L sono passi a sé, senza selettore. F è una rotta a sé: il campo parte vuoto (mai la mail nell'indirizzo).

## 2. Cornice

Come M1 e M2 della #11 (codice attuale di `/accesso/mail`):

- **390 px:** passo chiaro `main.passo-onboarding` (fondo `--color-carta`): testa con «Indietro» (`a.btn-icona`, icona `arrow-left`, `aria-label` «Indietro») + due `span` vuoti; `div.intestazione` (`p.intestazione__sopra`, `h1.intestazione__titolo.t-titolo-pagina`, `p.intestazione__sotto`); contenuto in `div.sezione`; in fondo `div.dialogo__azioni`.
- **1280 px:** `split-onboarding`. Sinistra `div.split-onboarding__notte` identica ad A (marchio, quattro adesivi fermi, `p.t-display.claim` «La casa, **in un posto solo.**»). Destra `div.split-onboarding__passo`: `span` vuoto, `div.sezione` (intestazione, contenuto, azioni), poi la frase legale o un `span` vuoto. Al posto della freccia, ultimo dei link in `div.gruppo-chip`, `a.btn-link` «Torna all'accesso».
- **768–1023 px:** come 390, colonna stretta centrata (regola già scritta nella #11).
- **L** resta come M3 della #11: notte con claim su mobile, split con claim a sinistra su desktop.

**Un solo modulo nel DOM per schermata [aggiunto].** Oggi `/accesso/mail` scrive il modulo due volte (mobile e desktop) e ne nasconde uno. Con le password non va bene: alcuni gestori compilano o salvano anche i campi nascosti, o non capiscono quale usare. Le due disposizioni usano **lo stesso `<form>` e gli stessi campi**: il pannello notte è un fratello che c'è solo da 1024 px e il passo chiaro diventa la colonna destra. Se il codice tiene due disposizioni, quella nascosta non contiene campi né bottoni di invio.

## 3. Campi, gestori di password, mostra/nascondi

Ogni modulo è un `<form method="post" action="…/invio" novalidate>` vero con il bottone `type="submit"` (dentro o con l'attributo `form`): i gestori di password riconoscono l'invio solo così. Niente `name` (requisito); bastano `id` stabili e `autocomplete`.

| Schermata | Campo           | Etichetta             | Attributi                                                                                                                                   |
| --------- | --------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| E, R, F   | mail            | «La tua mail»         | `type="email"` `autocomplete="username"` `inputmode="email"` `autocapitalize="none"` `spellcheck="false"` `placeholder="nome@esempio.it"`   |
| E         | password        | «Password»            | `type="password"` `autocomplete="current-password"` `autocapitalize="none"` `spellcheck="false"`, senza segnaposto                          |
| R         | password        | «Scegli una password» | `type="password"` `autocomplete="new-password"` `passwordrules="minlength: 8; maxlength: 72;"` `autocapitalize="none"` `spellcheck="false"` |
| N         | mail (nascosta) | —                     | `input type="email" autocomplete="username" readonly hidden` con la mail dell'account (attributo `hidden`, niente stile in linea)           |
| N         | password        | «Nuova password»      | come la password di R                                                                                                                       |

- **`autocomplete="username"` sul campo mail [diverso dal requisito, che scrive `email`].** È il valore che Chrome, Safari, 1Password e Bitwarden usano per riconoscere l'identificativo di un account: propongono le credenziali salvate in E e salvano la coppia giusta in R e N. Con `email` propongono solo la mail dei contatti e a volte non associano la password. Il tipo resta `email` per la tastiera. CA-19 non cambia.
- **`passwordrules`** fa proporre a Safari una password che rispetta 8–72 caratteri.
- **Campo nascosto in N:** il gestore sa quale password sta aggiornando.
- **Un solo campo password** (D5): niente «Ripeti la password».

**Mostra/nascondi [nuovo, `PasswordField`]:** bottone dentro il campo, a destra, icona `eye` (nascosta) o `eye-off` (visibile), `aria-label` fisso «Mostra la password», `aria-pressed` `false`/`true`, `aria-controls` verso il campo. Premuto: il campo passa a `type="text"`, focus sul bottone. Torna nascosta da sola all'invio, al cambio di voce del selettore e al cambio di schermata. Su Edge si spegne l'occhio del browser (`::-ms-reveal`).

**Regole visibili [nuovo, `.regole-password`]:** in R e N, sotto il campo, `ul.regole-password` con una riga: «Da 8 a 72 caratteri». A riposo: cerchio vuoto 16 px e testo `--color-inchiostro-2`. Appena rispettata (mentre si scrive): icona `check` 16 px `--color-ok` al posto del cerchio, testo `--color-inchiostro`, e per il lettore di schermo il testo nascosto «, fatto». Nessuna regione `aria-live`. Il campo ha `aria-describedby` verso l'errore (quando c'è) e la lista. L'errore sta sopra la lista.

## 4. Stati e testi

Regole comuni: l'errore di un campo compare dopo l'invio, non mentre si scrive; all'invio il focus va al primo campo sbagliato. Gli avvisi stanno dentro il modulo, sopra i campi (in C e T sopra il bottone). Durante un invio: bottone `.is-caricamento` + `aria-busy`, campi `readonly` senza cambio di aspetto; selettore, «Indietro» e link restano attivi. Nessuno stato vuoto (sono moduli); disabilitato solo il bottone durante l'attesa di 60 s. Mai codici o testi del fornitore.

### E · Entra

Sopra «Accesso con la mail» · h1 «Entra con la mail» · sotto «Scrivi la mail e la password del tuo account.» · selettore · mail · password · `div.gruppo-chip` › `a.btn-link` «Password dimenticata?» (sotto il campo password, a sinistra) · `button.btn-primary.btn--pieno` «Entra» · frase legale come in A (`p.t-nota.t-secondario` con i due link).

390: testa · intestazione · `div.sezione` (selettore, modulo) · `div.dialogo__azioni` in fondo («Entra», frase legale). 1280: a destra `span` · `div.sezione` (intestazione, selettore, modulo, `div.dialogo__azioni` con «Entra» e «Torna all'accesso») · frase legale.

| Stato                 | Cosa si vede                                                                                                                                                                          | Testo                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Mail vuota            | `.campo--errore` + `p.campo__errore` con `circle-alert` 16 px                                                                                                                         | «Scrivi la tua mail per entrare.»                                                                                                        |
| Mail non valida       | come sopra                                                                                                                                                                            | «Controlla la mail: dovrebbe essere come nome@esempio.it.»                                                                               |
| Password vuota        | come sopra, sulla password                                                                                                                                                            | «Scrivi la password per entrare.»                                                                                                        |
| Invio                 | «Entra» in caricamento                                                                                                                                                                | «Accesso in corso»                                                                                                                       |
| `[D: credenziali]`    | `div.avviso.avviso--errore[role="alert"]`, icona `circle-alert`, azione `a.btn-link` «Scegli una password» (→ F). Nessun campo in rosso; mail resta; password svuotata e con il focus | «La mail e la password non corrispondono. Se finora entravi con il link nella mail, la password non ce l'hai ancora: scegline una.»      |
| `[D: non-confermata]` | `div.avviso.avviso--info[role="status"]`, icona `info`, azione `button.btn-link` «Rimanda la mail» (in caricamento: spinner, testo invariato); riuscito → C con l'attesa già partita  | «Questa mail non è ancora confermata. Apri la mail «Conferma il tuo indirizzo» che ti abbiamo mandato, oppure fattene mandare un'altra.» |
| `[D: limite]`         | `div.avviso.avviso--info.avviso--senza-azione[role="status"]`, icona `clock`                                                                                                          | «Troppi tentativi di fila. Aspetta qualche minuto e riprova.»                                                                            |
| `[D: rete]`           | `div.avviso.avviso--errore[role="alert"]`, icona `wifi-off`, azione «Riprova» (stessi dati)                                                                                           | «Non siamo riusciti a farti entrare. Controlla la connessione e riprova.»                                                                |
| Riuscito              | destinazione del requisito; nessun toast                                                                                                                                              | —                                                                                                                                        |

### R · Registrati

Sopra «Accesso con la mail» · h1 «Crea il tuo account» · sotto «Poi ti mandiamo una mail per confermare l'indirizzo.» · selettore · mail · «Scegli una password» con mostra/nascondi e regole · `button.btn-primary.btn--pieno` «Crea l'account» · frase legale. Stessa disposizione di E, senza «Password dimenticata?».

| Stato                                        | Cosa si vede                                                      | Testo                                                                                              |
| -------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Mail vuota / non valida                      | errore del campo                                                  | «Scrivi la tua mail per registrarti.» / «Controlla la mail: dovrebbe essere come nome@esempio.it.» |
| Password vuota                               | errore del campo                                                  | «Scegli una password per registrarti.»                                                             |
| `[D: password-corta]`                        | errore del campo; la regola resta col cerchio vuoto               | «La password è troppo corta: servono almeno 8 caratteri.»                                          |
| `[D: password-lunga]`                        | errore del campo                                                  | «La password è troppo lunga: al massimo 72 caratteri.»                                             |
| `[D: password-debole]`                       | errore del campo, password non svuotata                           | «Questa password è troppo facile da indovinare: scegline una più lunga.»                           |
| Invio                                        | «Crea l'account» in caricamento                                   | «Creazione dell'account in corso»                                                                  |
| `[D: limite]`                                | `avviso--info.avviso--senza-azione[role="status"]`, icona `clock` | «Ti abbiamo appena mandato una mail. Cercala nella posta, oppure riprova tra un minuto.»           |
| `[D: rete]`                                  | `avviso--errore[role="alert"]`, icona `wifi-off`, «Riprova»       | «Non siamo riusciti a creare l'account. Controlla la connessione e riprova.»                       |
| Riuscito, anche con mail già registrata (D2) | C, password svuotata                                              | —                                                                                                  |

### C · Controlla la posta `[D: posta-neutro]`

Come M2 della #11, testi neutri: valgono uguali per una mail nuova e per una già registrata (D2, nessuna enumerazione).

- Sopra «Registrazione» (da R) o «Accesso con la mail» (da E) · h1 `tabindex="-1"` «Controlla la posta» · sotto «Se è un indirizzo nuovo, ti abbiamo mandato una mail a **<mail>**. Aprila e tocca «Conferma l'indirizzo»: entri subito in FamilyNest.» (mail come scritta, `overflow-wrap: anywhere`).
- `ul.scheda.lista`, righe non cliccabili `li.riga-lista` con `span.icona-riquadro`:
  - `clock` · «Vale un'ora» · «E funziona una volta sola.»
  - `search` · «Non la trovi?» · «Guarda nella posta indesiderata o nelle promozioni.»
  - `key-round` · «Hai già un account con questa mail?» · «Allora non ti arriva niente: entra con la tua password.»
  - solo con il cookie d'invito (D4; la pagina riceve dal server un sì o no, mai il token): `users` · «Apri il link su questo dispositivo» · «Così entri subito nel Nest che ti ha invitato.»
- `button.btn-secondary.btn--pieno` «Rimanda la mail» · `div.gruppo-chip` › `button.btn-link` «Usa un'altra mail» (→ R con la mail nel campo) + `button.btn-link` «Entra con la password» (→ E con la mail nel campo) + su desktop «Torna all'accesso». Niente frase legale.

| Stato             | Cosa si vede                                                                                                    | Testo                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Attesa (60 s)     | «Rimanda la mail» `disabled`, sotto `p.t-nota.t-secondario` collegata con `aria-describedby`, senza `aria-live` | «Puoi rimandarla tra 42 secondi.» («tra 1 secondo» al singolare)            |
| Invio             | bottone in caricamento                                                                                          | «Invio della mail in corso»                                                 |
| `[D: rimandata]`  | `Toast` con icona `check`, `.toast--senza-nav` su mobile, senza «Annulla»; riparte l'attesa                     | «Mail rimandata: usa quella più recente.»                                   |
| `[D: limite]`     | `avviso--info.avviso--senza-azione[role="status"]`, icona `clock`; riparte l'attesa                             | «La mail di prima è appena partita. Puoi rimandarla tra un minuto.»         |
| `[D: rete]`       | `avviso--errore[role="alert"]`, icona `wifi-off`, «Riprova»                                                     | «Non siamo riusciti a mandare la mail. Controlla la connessione e riprova.» |
| Pagina ricaricata | R con i campi vuoti                                                                                             | —                                                                           |

«Vale un'ora» = `otp_expiry` 3600 s: se cambia, cambiano questo testo, T, L e le mail.

### F · Password dimenticata

Testa con «Indietro» verso E · sopra «Accesso con la mail» · h1 «Hai dimenticato la password?» · sotto «Scrivi la mail del tuo account: ti mandiamo un link per sceglierne una nuova.» · campo «La tua mail» · `button.btn-primary.btn--pieno` «Mandami il link» · su desktop `a.btn-link` «Torna all'accesso» (→ E). Niente frase legale.

| Stato                   | Cosa si vede                                     | Testo                                                                                                   |
| ----------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Mail vuota / non valida | errore del campo                                 | «Scrivi la tua mail per ricevere il link.» / «Controlla la mail: dovrebbe essere come nome@esempio.it.» |
| Invio                   | bottone in caricamento                           | «Invio del link in corso»                                                                               |
| `[D: rete]`             | `avviso--errore`, icona `wifi-off`, «Riprova»    | «Non siamo riusciti a mandare il link. Controlla la connessione e riprova.»                             |
| Riuscito o 429          | T (requisito: il 429 si mostra come un successo) | —                                                                                                       |

### T · Ti abbiamo scritto `[D: recupero-inviato]`

Struttura di C. Sopra «Password dimenticata» · h1 `tabindex="-1"` «Ti abbiamo scritto» · sotto «Se **<mail>** è la mail di un account FamilyNest, ti è arrivato un link. Aprilo e tocca «Scegli una nuova password».» · righe: `clock` «Vale un'ora» / «E funziona una volta sola.»; `search` «Non la trovi?» / «Guarda nella posta indesiderata. Se non arriva, forse l'account usa un'altra mail.» · `button.btn-secondary.btn--pieno` «Mandami un altro link» · `div.gruppo-chip` › `button.btn-link` «Usa un'altra mail» (→ F con la mail nel campo) + su desktop «Torna all'accesso».

Stati come C: attesa «Puoi chiederne un altro tra 42 secondi.»; caricamento «Invio del link in corso»; riuscito **e 429** toast «Nuovo link mandato: usa quello più recente.» con l'attesa che riparte; rete «Non siamo riusciti a mandare il link. Controlla la connessione e riprova.» + «Riprova».

### N · Nuova password

Testa senza «Indietro» (tre `span` vuoti: la persona è già dentro) · sopra «Password dimenticata» · h1 «Scegli una nuova password» · sotto «Per l'account **<mail>**.» · mail nascosta · «Nuova password» con mostra/nascondi e regole · `button.btn-primary.btn--pieno` «Salva la password». Su desktop nessun link. Niente frase legale.

| Stato                  | Cosa si vede                                                  | Testo                                                                           |
| ---------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Vuota                  | errore del campo                                              | «Scrivi la nuova password.»                                                     |
| Corta, lunga, debole   | come R                                                        | testi di R                                                                      |
| `[D: stessa-password]` | errore del campo                                              | «È la password che usavi già: scegline una diversa.»                            |
| Invio                  | bottone in caricamento                                        | «Salvataggio in corso»                                                          |
| `[D: rete]`            | `avviso--errore`, icona `wifi-off`, «Riprova»; password resta | «Non siamo riusciti a salvare la password. Controlla la connessione e riprova.» |
| Riuscito               | destinazione; lì `Toast` con icona `check`, senza «Annulla»   | «Nuova password salvata.»                                                       |

### L · Link scaduto

Struttura di M3 della #11 (claim «Questo link **non vale più.**», `p.citazione`, `a.btn-chiaro.btn--pieno` su mobile, `a.btn-secondary` su desktop, `div.gruppo-chip` › «Torna all'accesso»; a destra su desktop sopra «Accesso con la mail», h1 «Link non più valido»). Due varianti:

| `tipo`               | Citazione                                                                                                                            | Bottone                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| `conferma` o assente | «I link nelle nostre mail valgono un'ora e si usano una volta sola. Se avevi già confermato l'indirizzo, entra con mail e password.» | «Entra con la mail» → `/accesso/mail` |
| `password`           | «Il link per scegliere una nuova password vale un'ora e si usa una volta sola. Chiedine uno nuovo.»                                  | «Mandami un nuovo link» → F           |

Chi non aveva confermato, da E vede l'avviso con «Rimanda la mail»: un solo bottone basta.

## 5. Mail di sistema (E1, E2)

Link e variabili come nell'allegato dell'analista. Struttura: `h2`, un paragrafo, il link-bottone, un paragrafo finale. Nessun nome, nessuna immagine.

**E1 · Conferma** (modello «Confirm signup»)

- Oggetto: «Conferma il tuo indirizzo per FamilyNest»
- `h2`: «Conferma il tuo indirizzo»
- Testo: «Hai creato un account FamilyNest con questa mail. Tocca il bottone per confermarla: entri subito.»
- Bottone: «Conferma l'indirizzo»
- Chiusura: «Il link vale un'ora e si usa una volta sola. Se non hai chiesto tu di registrarti, ignora questa mail: senza conferma l'account non si attiva.»

**E2 · Nuova password** (modello «Reset password»)

- Oggetto: «Scegli una nuova password per FamilyNest»
- `h2`: «Scegli una nuova password»
- Testo: «Hai chiesto di cambiare la password del tuo account FamilyNest.»
- Bottone: «Scegli una nuova password»
- Chiusura: «Il link vale un'ora e si usa una volta sola. Se non l'hai chiesto tu, ignora questa mail: la tua password resta quella di prima.»

## 6. CSS dei componenti nuovi

Nel blocco «STATI AGGIUNTI DAL DESIGNER» di `src/app/components.css`, in fondo, prima di «CORNICE DELL'APP». Solo token.

```css
/* #327 · Campo password con mostra/nascondi */
.campo-password {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}
.campo-password .campo__input {
  padding-right: calc(var(--size-tocco) + var(--space-2));
}
.campo-password .campo__input::-ms-reveal {
  display: none;
}
.campo-password__mostra {
  position: absolute;
  top: 0;
  bottom: 0;
  right: var(--space-1);
  margin-block: auto;
  width: var(--size-tocco);
  height: var(--size-tocco);
  padding: var(--space-0);
  border: 0;
  border-radius: var(--radius-s);
  background: transparent;
  display: grid;
  place-items: center;
  color: var(--color-inchiostro-2);
  cursor: pointer;
}
.campo-password__mostra[aria-pressed="true"] {
  color: var(--color-inchiostro);
}
@media (hover: hover) {
  .campo-password__mostra {
    transition: background-color var(--durata-rapida) var(--curva);
  }
  .campo-password__mostra:hover {
    background: var(--color-carta);
    color: var(--color-inchiostro);
  }
}
.campo-password__mostra:active {
  background: var(--color-carta);
}

/* #327 · Regole della password */
.regole-password {
  display: grid;
  gap: var(--space-1);
  margin: var(--space-0);
  padding: var(--space-0);
  list-style: none;
}
.regole-password__regola {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-nota-size);
  line-height: var(--text-nota-line);
  color: var(--color-inchiostro-2);
}
.regole-password__segno {
  width: var(--size-icona-s);
  height: var(--size-icona-s);
  flex: none;
  border-radius: var(--radius-tondo);
  box-shadow: inset 0 0 0 var(--border-medio) var(--color-inchiostro-2);
}
.regole-password__regola--rispettata {
  color: var(--color-inchiostro);
}
.regole-password__regola--rispettata > .icona {
  color: var(--color-ok);
}

/* #327 · Campi compilati dal browser: restano bianchi con il loro bordo */
.campo__input:-webkit-autofill {
  -webkit-text-fill-color: var(--color-inchiostro);
  box-shadow:
    inset 0 0 0 var(--border-sottile) var(--color-filo-campo),
    inset 0 0 0 var(--size-azione) var(--color-superficie);
}
.campo__input:-webkit-autofill:focus {
  box-shadow:
    inset 0 0 0 var(--border-medio) var(--color-inchiostro),
    inset 0 0 0 var(--size-azione) var(--color-superficie);
}
.campo--errore .campo__input:-webkit-autofill {
  box-shadow:
    inset 0 0 0 var(--border-medio) var(--color-allerta),
    inset 0 0 0 var(--size-azione) var(--color-superficie);
}
```

Struttura:

```
div.campo[.campo--errore]
  label.campo__etichetta[for]
  div.campo-password
    input.campo__input#…[type=password|text]
    button.campo-password__mostra[type=button][aria-label="Mostra la password"][aria-pressed][aria-controls]
      svg.icona (eye | eye-off)
  [p.campo__errore#…]
  [ul.regole-password#…]
    li.regole-password__regola[.regole-password__regola--rispettata]
      span.regole-password__segno[aria-hidden]  (a riposo)
      svg.icona.icona--s (check)                 (rispettata, al posto del segno)
      «Da 8 a 72 caratteri» [+ VisuallyHidden «, fatto»]
```

## 7. Accessibilità

**Contrasti** (in più rispetto alla #11, invariati)

| Testo o segno                                                   | Fondo                                              | Rapporto                                |
| --------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------- |
| occhio `--color-inchiostro-2` / premuto `--color-inchiostro`    | `--color-superficie` · `--color-carta` (passaggio) | 6,59:1 / 17,74:1 · 5,86:1 / 15,78:1     |
| regola `--color-inchiostro-2` / rispettata `--color-inchiostro` | `--color-carta`                                    | 5,86:1 / 15,78:1                        |
| cerchio `--color-inchiostro-2` · spunta `--color-ok`            | `--color-carta`                                    | 5,86:1 · 4,72:1 (non testuali, min 3:1) |
| voce scelta del selettore `--color-latte`                       | `--color-inchiostro`                               | 15,85:1                                 |
| voce non scelta `--color-inchiostro-2`                          | `--color-superficie`                               | 6,59:1                                  |

Lo stato della regola non è detto solo dal colore: cambiano il segno e il testo nascosto.

**Ordine del focus** (ordine del codice, nessun `tabindex` positivo)

- E: Indietro (mobile) → Entra, Registrati → [azione dell'avviso] → mail → password → Mostra la password → Password dimenticata? → Entra → [Torna all'accesso] → Termini d'uso → Informativa sulla privacy.
- R: come E, senza «Password dimenticata?», bottone «Crea l'account».
- C: Indietro (mobile) → [Riprova] → Rimanda la mail → Usa un'altra mail → Entra con la password → [Torna all'accesso].
- F: Indietro (mobile) → [Riprova] → mail → Mandami il link → [Torna all'accesso].
- T: Indietro (mobile) → [Riprova] → Mandami un altro link → Usa un'altra mail → [Torna all'accesso].
- N: [Riprova] → Nuova password → Mostra la password → Salva la password.
- L: bottone → Torna all'accesso.

**Focus all'arrivo:** E, R, F, N sul primo campo solo da 1024 px; C e T sull'h1; L nessuno. `[D: credenziali]`: sul campo password svuotato.

**Aree di tocco:** «Mostra la password» 44 × 44 dentro il campo di 52; selettore, `btn-link` e `btn-icona` con le regole del sistema (44 px). Il testo scritto non passa sotto l'occhio (`padding-right`).

**Testo ingrandito (#313):** l'occhio resta centrato (`margin-block: auto`); le regole vanno a capo.

## 8. Lavoro condiviso

`richiesta-condivisa` (punto 3 dell'analista): `PasswordField` in `src/components/ui/PasswordField/` (prop: `id`, `label`, `autoComplete` `"current-password" | "new-password"`, `rules?` `{ text, met }[]`, `error?`, `inputRef`, `readOnly`, `value`, `onChange`) con le classi della sezione 6, le regole di riempimento automatico, esempi in galleria (`?pezzi-pagine=1`): nascosta, mostrata, regola a riposo e rispettata, con errore. Skill aggiornata in `riferimento/componenti.md` e `registro.md`.
