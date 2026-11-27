# #551 · A18 Impostazioni, Aspetto, Notifiche, sintesi del mattino, Privacy, Informazioni · dettagli

Dettagli del requisito della issue #551 (analista, 26/11/2026). Nella issue ci sono le regole principali e i CA; qui rotte, righe, valori, testi, scritture e casi. Se issue e file si contraddicono, vale la issue.

Fonti: `docs/design/telefono/app-fase-b/cb1-43` (Impostazioni), `cb1-44` (Aspetto), `cb1-45` (Notifiche), `cb1-46` (Privacy); `notifiche/come-riceverle.png` (Passo 5); `pagine-mancanti-p7/mn1-16` (sintesi), `mn1-39` (contenuti nascosti); `decisioni-p8/ap1-20` (Informazioni); `docs/design/computer/il-tuo-impostazioni-notifiche/05`, `06` (Passo 11) e `regole.md`; risposte 28, 86, 87, 128, 129, 137, 145, 172 di `decisioni-fable.md`; requisito di DB-2 #511 (PR #610 unita, PR #612 aperta); richiesta-condivisa #613; codice attuale in `src/app/(app)/impostazioni/` e `src/components/impostazioni/`.

Decisioni date dal coordinatore per questa issue: in Aspetto c'è la scelta «Chiaro / Scuro / Come il telefono»; «Nascondi il contenuto» è nelle Notifiche; le funzioni che arrivano dopo il lancio restano nascoste; forme neutre per il genere.

Regola comune delle righe «che portano a una pagina di un'altra issue»: la riga si vede **solo se la rotta di destinazione è nell'elenco esplicito di F5** (`hasAppRoute`, la stessa di A16 #549). Nelle tabelle è segnata «se esiste».

## §1 Rotte

| Rotta                               | Telefono: testata (F5 dettaglio), ripiego | Computer: contenuto a destra della lista                                                |
| ----------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------- |
| `/impostazioni`                     | Indietro → `/nest`                        | nessuna voce scelta; a destra «Chi vive qui», «Chi organizza» (e «Esci dalla casa», §2) |
| `/impostazioni/aspetto`             | Indietro → `/impostazioni`                | voce «Aspetto» scelta                                                                   |
| `/impostazioni/notifiche`           | Indietro → `/impostazioni`                | voce «Notifiche» scelta                                                                 |
| `/impostazioni/notifiche/ricezione` | Indietro → `/impostazioni/notifiche`      | voce «Notifiche» scelta; freccia indietro nella barra in alto                           |
| `/impostazioni/notifiche/sintesi`   | Indietro → `/impostazioni/notifiche`      | come sopra                                                                              |
| `/impostazioni/privacy`             | Indietro → `/impostazioni`                | voce «Privacy» scelta                                                                   |
| `/impostazioni/informazioni`        | Indietro → `/impostazioni`                | voce «Informazioni» scelta                                                              |

- Voce attiva della barra (F5 §2): come `/impostazioni` oggi (Spazi sul telefono, profilo sul computer); barra in basso assente sul telefono.
- L'ingranaggio della pagina `/notifiche` e ogni link a `/impostazioni#notifiche` passano a `/impostazioni/notifiche`.

## §2 Impostazioni (`cb1-43`; computer `05`)

**Telefono**, dall'alto:

| Riga / sezione                  | Valore                                                                                                                                                                        | Azione                                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `h1` «Impostazioni»             |                                                                                                                                                                               |                                                                                           |
| Chi vive qui                    | conti per tipo, separati da virgola, tipi a 0 omessi: «2 adulti, 2 figli, 2 animali»; singolare **(default, domanda 6)** «1 persona adulta», «1 figlio o figlia», «1 animale» | nessuna (non è un link)                                                                   |
| Chi organizza                   | pallini e nomi degli adulti con `is_admin`, uniti con `joinNames`: «Marco e Laura»                                                                                            | «Cambia», **solo per chi organizza** → foglio «Chi organizza» (§3)                        |
| sezione «Come si presenta»      |                                                                                                                                                                               |                                                                                           |
| Aspetto                         | «Chiaro», «Scuro», «Come il telefono» (sul computer «Come il computer»)                                                                                                       | → `/impostazioni/aspetto`                                                                 |
| Sfondo di Oggi                  | —                                                                                                                                                                             | **nascosta** (sfondi dopo il lancio, B23 #400 e DB-23 #533); la sezione resta con Aspetto |
| sezione «Avvisi e riservatezza» |                                                                                                                                                                               |                                                                                           |
| Notifiche                       | «Riepilogo alle {19:00} · silenzio dalle 22 alle 7»; con il silenzio spento «Riepilogo alle {19:00}»                                                                          | → `/impostazioni/notifiche`                                                               |
| Privacy                         | «Chi vede che cosa, i link accesi, i vostri dati»                                                                                                                             | → `/impostazioni/privacy`                                                                 |
| Account e privacy               | «Mail, consensi, i tuoi dati»                                                                                                                                                 | se esiste (A19 #552)                                                                      |
| sezione «Altro»                 |                                                                                                                                                                               |                                                                                           |
| Novità                          | (l'etichetta delle novità è di B5)                                                                                                                                            | se esiste (B5 #564)                                                                       |
| Proposte                        | —                                                                                                                                                                             | se esiste (B6 #565)                                                                       |
| Informazioni                    | «Versione {versione}»                                                                                                                                                         | → `/impostazioni/informazioni`                                                            |
| «Esci dalla casa» (temporaneo)  | il blocco di oggi (`LeaveHousehold`), in fondo                                                                                                                                | resta finché A19 #552 non lo porta nella sua pagina (`cb1-49`); poi A19 lo toglie da qui  |

- Spariscono rispetto a oggi: il nome del Nest come `h1` (decisione «senza nome», nota di `cb1-43`), l'elenco «Chi c'è» (ora in «Il tuo Nest», A13 #546), le notifiche dentro la pagina, il menu laterale `SettingsMenu`.
- «Chi vive qui» conta tutti i membri per `kind` (`adult`, `child`, `pet`), con o senza account.

**Tablet in verticale (fino a 899 px):** la pagina del telefono in una colonna di 640 px al centro, barra in alto larga quanto la finestra (`docs/design/tablet/verticale/13`).

**Computer (da 900 px e alta almeno 600, soglie di D8; il 760 di prima è superato):** titolo «Impostazioni» nella barra in alto. A sinistra la lista delle voci (icona, nome, riga sotto): Aspetto, (Sfondo di Oggi: nascosta), Notifiche («Riepilogo alle 19:00»), Privacy («Chi vede che cosa»), Account e privacy (se esiste), Novità (se esiste), Proposte (se esiste), Aiuto e contatti (nascosta, domanda 8), Crediti foto (se esiste, B13c #568), Informazioni («Versione …»). Voce scelta: fondo grigio (`05`), `aria-current="page"`. A destra una colonna di 600 px con il contenuto della rotta. Frecce su e giù spostano il fuoco tra le voci della lista, Invio la apre, Tab entra nel contenuto (`regole.md` §10).

## §3 Foglio «Chi organizza»

- Titolo «Chi organizza». Pastiglie con pallino e nome degli **adulti con account** del Nest, nell'ordine del Nest; scelte quelle con `is_admin`. Scelta multipla. «Annulla», «Fatto».
- Nessuno scelto: «Fatto» mostra «Scegli almeno una persona.» e il foglio resta aperto.
- «Fatto» scrive `household_members.is_admin` (permesso di oggi, solo per chi organizza; il trigger impedisce un Nest senza nessuno che organizza): prima mette `true` ai nuovi, poi `false` a chi esce, così non resta mai nessuno. Riuscito: foglio chiuso, riga aggiornata; se la persona ha tolto sé stessa, «Cambia» sparisce.
- Errore: il foglio resta aperto con «Non siamo riusciti a salvare. Controlla la connessione e riprova.» (rete) o «… per un problema nostro. Riprova tra qualche minuto.» (server); la pagina rilegge i valori veri.

## §4 Aspetto (`cb1-44`; computer `06`)

| Elemento                    | Contenuto                                                                                                                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `h1` «Aspetto»              |                                                                                                                                                                                                                 |
| tre schede (scelta singola) | «Chiaro» (sole), «Scuro» (luna), «Come il telefono» con «Scuro quando lo diventa il telefono, di solito la sera.» (sul computer «Come il computer» e «Scuro quando lo diventa il computer, di solito la sera.») |
| sezione «Movimento»         | riga non toccabile «Riduci il movimento» con «Segue il telefono: adesso è spento» / «… è acceso» (computer «Segue il computer: …»), dal valore di `prefers-reduced-motion`, aggiornato se cambia                |
| note sotto                  | «Con il movimento ridotto restano solo dissolvenze brevi: niente rimbalzi, niente festa.» · «L'aspetto è una scelta tua: {nome di un altro adulto} può tenere il suo.» (domanda 7)                              |

- La scheda scelta ha bordo d'inchiostro, fondo `--color-scelta-tenue` (più scuro della pagina in chiaro, più chiaro al buio) e spunta (Componenti 2.0, «Scelte a schede» A). Valore iniziale «Come il telefono» (`system`).
- Toccare una scheda salva subito `profiles.appearance` (**da creare**, §9) e applica la scelta senza ricaricare. Errore: torna la scelta di prima e compare l'avviso «Non siamo riusciti a salvare la scelta. Controlla la connessione e riprova.» (testo di oggi del profilo).
- Applicazione: l'elemento `html` ha l'attributo `data-aspetto` = `chiaro` | `scuro` | `sistema` e `color-scheme` coerente, scritti dal server senza lampo al caricamento (dal layout radice con il cookie `familynest_aspetto`, copia di `profiles.appearance` riallineata dal layout di `(app)`: decisione 1 di #623).
- **Le pagine senza account seguono il tema del sistema** (`data-aspetto="sistema"`): accesso, primo avvio prima dell'account, invito, lista dei desideri aperta da link, informativa, termini. D7 dice che il tema scuro c'è su tutti i formati e la tavola dell'accesso al buio (`computer/accesso-profilo-impostazioni-p12-16/03-accesso-scuro`, tablet `orizzontale-comandi-44-px/09-…-scuro`, `verticale/04-accesso-scuro`) è approvata. Restano chiare solo le mail. La riga di prima («le pagine pubbliche restano chiare») è superata (decisione 3 di #623).
- La tavolozza scura (D7: 75 ruoli, `docs/design/tavolozza.md` più i 2 del Passo 17) la porta nei token la richiesta condivisa #634 (`docs/specifiche/634-tema-scuro.md`), prima di F4b: tre blocchi di variabili in `globals.css`, chiaro, `data-aspetto="scuro"` e `prefers-color-scheme: dark` senza `data-aspetto="chiaro"`. Il CSS imposta da solo anche `color-scheme` (`light` o `dark`): il server scrive solo l'attributo `data-aspetto`. Lo scambio delle immagini (scena di Oggi) usa le classi `.solo-chiaro` e `.solo-scuro` di #634, che valgono anche con «Come il telefono». Questa pagina non aggiunge colori: la scheda scelta è quella di F4b (bordo `--color-inchiostro`, fondo `--color-scelta-tenue`, spunta `--color-pieno` con il segno `--color-latte`).
- «Telefono» o «computer» nei testi segue la forma della finestra (soglie di D8, 506 §1): con la forma del telefono (fino a 899 px, o alta meno di 600) «telefono», anche sul tablet in verticale (tavola `docs/design/tablet/verticale/13`: «Come il telefono»); con la forma del computer (da 900 px e alta almeno 600) «computer». Il testo cambia se la finestra cambia forma (rotazione del tablet).

## §5 Notifiche (`cb1-45`; computer `05`)

**Pagina `/impostazioni/notifiche`**, dall'alto (ordine **default**, domanda 2):

| #   | Elemento                                         | Valore o riga sotto                                                                                                                                   | Dato                                                  |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | `h1` «Notifiche», frase                          | telefono «Che cosa fa suonare il tuo telefono. Vale solo per te.»; computer «Che cosa ti avvisa, sul telefono e in questo browser. Vale solo per te.» | —                                                     |
| 2   | «Avvisi in questo browser» (solo computer)       | **nascosta** in A18: la costruisce B2 #561 con il push di F8 #508                                                                                     | —                                                     |
| 3   | riga «Come vuoi riceverle»                       | modo: «Una per una» / «Subito solo quello che tocca a te» / «Solo il riepilogo»                                                                       | `delivery_mode` → `/impostazioni/notifiche/ricezione` |
| 4   | titolo «Subito»                                  |                                                                                                                                                       |                                                       |
| 4a  | «Quando tocca a te portare o riprendere»         | «La sera prima e un'ora prima»                                                                                                                        | `rides`                                               |
| 4b  | «Prima di un tuo impegno»                        | «Un'ora prima»                                                                                                                                        | `event_reminders`                                     |
| 4c  | «Cose da fare con il tuo nome»                   | —                                                                                                                                                     | `assigned_todos`                                      |
| 4d  | «Scadenze»                                       | «7 giorni e 1 giorno prima, alle 9»                                                                                                                   | `deadlines`                                           |
| 5   | titolo «Nel riepilogo delle {19:00}»             | ora da `evening_digest_time`, `HH:MM`                                                                                                                 |                                                       |
| 5a  | «Cose aggiunte alla spesa»                       | —                                                                                                                                                     | `shopping`                                            |
| 5b  | «Impegni cambiati dagli altri»                   | —                                                                                                                                                     | `events`                                              |
| 5c  | «Compleanni»                                     | **nascosta** (dopo il lancio; domanda 8 di #511)                                                                                                      | —                                                     |
| 5d  | «Regali prenotati dalle liste»                   | —                                                                                                                                                     | `gifts`                                               |
| 6   | «Silenzio di notte»                              | «Dalle 22:00 alle 7:00»                                                                                                                               | `quiet_hours`                                         |
| 7   | «Nascondi il contenuto sulla schermata bloccata» | — (testo da `mn1-39`)                                                                                                                                 | `hide_content`                                        |
| 8   | riga «Sintesi del mattino»                       | accesa: «Alle {7:15}, {dal lunedì al venerdì}»; spenta: «Spenta»                                                                                      | → `/impostazioni/notifiche/sintesi`                   |

- 4a–7 sono interruttori (F4a) con icona a sinistra come nel disegno. Toccare cambia subito il valore e salva con `set_notification_preference(p_preference, p_enabled)`; mentre salva l'interruttore ha `aria-busy`. Errore: l'interruttore torna com'era e sotto la sezione compare «Non siamo riusciti a cambiare la notifica «{titolo}». Controlla la connessione e riprova.» (rete) o «… per un problema nostro. Riprova tra qualche minuto.» (server), come oggi.
- «Liberi insieme» (`free_together`) non è nel disegno: nessuna riga; il valore salvato resta (domanda 3).
- Gli interruttori valgono anche prima che il push esista (F8): decidono le notifiche dentro l'app come oggi (domanda 2 di #511: spento = nessuna notifica).

**Pagina `/impostazioni/notifiche/ricezione` («Come vuoi riceverle», `notifiche/come-riceverle`)**

- `h1` «Come vuoi riceverle»; frase «Vale per gli avvisi sul telefono. Nella pagina Notifiche trovi sempre tutto.»
- Tre schede a scelta singola: «Una per una» · «Un avviso per ogni cosa che cambia in casa.» (`each`); «Subito solo quello che tocca a te» · «Il resto arriva insieme, nel riepilogo.» (`mine_now`, predefinito); «Solo il riepilogo» · «Un avviso al giorno. Gli impegni che cambiano all'ultimo arrivano lo stesso.» (`digest_only`). Toccare salva subito con `set_notification_options(p_delivery_mode => …)` (gli altri parametri null).
- Sezione «Il riepilogo»: riga «Quando arriva» · «Ogni sera alle {19:00}» · «Cambia» → foglio dell'ora (§7) con ore da 07:00 a 21:45 a quarti d'ora; salva con `set_notification_options(p_evening_digest_time => …)`.
- Errori come gli interruttori: la scelta torna com'era e compare l'avviso.

**Pagina `/impostazioni/notifiche/sintesi` («Sintesi del mattino», `mn1-16`)**

| Elemento                          | Valore                                                               | Dato e scrittura                                                                                                       |
| --------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `h1`, frase                       | «Una volta al giorno, la giornata in poche righe. Vale solo per te.» | —                                                                                                                      |
| interruttore «Mandami la sintesi» | «Come avviso, e in cima a Oggi fino a mezzogiorno»                   | `morning_digest`, `set_notification_preference`                                                                        |
| «A che ora» · «Cambia»            | «7:15» (ora senza zero davanti, `digestTimeLabel`)                   | `profiles.morning_digest_time`; foglio dell'ora (§7) da 06:00 a 10:00 a quarti d'ora; scrittura sul profilo come oggi  |
| «In quali giorni» · «Cambia»      | §6                                                                   | `profiles.morning_digest_weekdays`; foglio dei giorni (§6); `set_notification_options(p_morning_digest_weekdays => …)` |
| titolo «Che cosa c'è dentro»      |                                                                      |                                                                                                                        |
| «I tuoi impegni di oggi»          | interruttore                                                         | `digest_events`                                                                                                        |
| «Chi porta e chi riprende»        | interruttore                                                         | `digest_rides`                                                                                                         |
| «Le scadenze di oggi e di domani» | interruttore                                                         | `digest_deadlines`                                                                                                     |
| «I grazie ricevuti ieri»          | **nascosta** finché non esistono i grazie (B22a #570, DB-22 #532)    | `digest_thanks`                                                                                                        |
| «Quante cose ci sono in spesa»    | interruttore, spento all'inizio                                      | `digest_shopping`                                                                                                      |
| nota in fondo                     | «Se in una giornata non c'è niente da dire, la sintesi non arriva.»  | —                                                                                                                      |

- Con «Mandami la sintesi» spenta le altre righe restano visibili e modificabili **(default, domanda 4)**.
- Predefiniti (DB-2): accesa, 07:15, lunedì–venerdì, tutto acceso tranne la spesa. I profili con 07:30 già salvato mostrano 7:30 (domanda 7 di #511).
- L'avviso del primo giorno (`mn1-17`, `mark_morning_digest_intro_seen`) e il riquadro in Oggi sono di B1 #560.

## §6 Giorni della sintesi

- Foglio «In quali giorni»: sette pastiglie Lun, Mar, Mer, Gio, Ven, Sab, Dom (44 px, scelta multipla, Componenti 2.0); «Annulla», «Fatto». Nessun giorno: «Fatto» mostra «Scegli almeno un giorno.» e il foglio resta.
- Valori salvati: 1 = lunedì … 7 = domenica, in ordine, senza doppioni (vincolo `profiles_morning_digest_weekdays_valid`).
- Testo della riga: {1,2,3,4,5} «Dal lunedì al venerdì»; {1,…,7} «Tutti i giorni»; {6,7} «Sabato e domenica»; altrimenti i nomi in ordine uniti con `joinNames`, con l'iniziale maiuscola solo sul primo: «Lunedì, mercoledì e venerdì», «Martedì».

## §7 Foglio dell'ora

- Foglio piccolo di F4c con il campo d'ora (`TimeField`, F4c §6), il valore attuale, «Annulla», «Fatto».
- Ammessi solo i quarti d'ora del limite: sintesi 06:00–10:00 (17 valori), riepilogo 07:00–21:45 (60 valori) (regola 2 di #511). Fuori limite o non a quarto d'ora: errore sotto il campo **(default)** «Scegli un'ora dalle 6:00 alle 10:00, a quarti d'ora.» / «Scegli un'ora dalle 7:00 alle 21:45, a quarti d'ora.»; nessuna richiesta.
- Le costanti delle ore vengono da `src/lib/digest.ts` (sintesi, rifatta a quarti d'ora con 07:15 da #613) e da una costante gemella per il riepilogo nello stesso modulo (richiesta-condivisa).

## §8 Privacy (`cb1-46`) e Informazioni (`ap1-20`)

**Privacy**

| Sezione / riga                  | Valore                                                                                                                                                                                   | Azione                                                                                                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| «Chi vede che cosa»             |                                                                                                                                                                                          |                                                                                                                                                                                                  |
| «Un impegno nuovo nasce»        | `household` «Visibile a tutti in casa»; `busy` o `private` «Solo io»                                                                                                                     | foglio «Un impegno nuovo nasce»: due schede «Visibile a tutti in casa» (`household`) e «Solo io» (`busy`); toccare salva subito `profiles.default_event_visibility` (scrittura di oggi) e chiude |
| «I calendari collegati nascono» | «Solo «occupato»» (fisso: è come nasce ogni calendario collegato)                                                                                                                        | → `/calendari-collegati`                                                                                                                                                                         |
| «I profili dei figli»           | «Li vedono e li cambiano solo gli adulti»                                                                                                                                                | nessuna (non è un link, niente freccia)                                                                                                                                                          |
| «Verso l'esterno»               |                                                                                                                                                                                          |                                                                                                                                                                                                  |
| «Link accesi»                   | link delle liste dei desideri attivi (`disabled_at` nullo e `expires_at` futuro): 0 «Nessuno»; 1 «1 · la lista dei desideri di Sofia»; 2+ «2 · le liste dei desideri di Sofia e Tommaso» | con almeno un link: → pagina della lista del primo figlio, nell'ordine del Nest, che ha un link (`/figli/<id>/lista-desideri`) **(default, domanda 5)**; con 0 nessuna azione                    |
| «Inviti in attesa»              | solo per chi organizza: inviti `pending` non scaduti: 0 «Nessuno»; altrimenti «{n} · {nomi}» («1 · Laura»)                                                                               | → `/nest`. Per chi non organizza la riga non c'è (la policy di `invitations` non lo permette)                                                                                                    |
| «I vostri dati»                 |                                                                                                                                                                                          |                                                                                                                                                                                                  |
| «Conversazioni con Nest»        | —                                                                                                                                                                                        | **nascosta** (Chiedi dopo il lancio, B15 #386)                                                                                                                                                   |
| «Esporta i miei dati»           | —                                                                                                                                                                                        | come nel profilo (A17 #550): scarica come oggi finché A19 non fa la sua pagina                                                                                                                   |
| frase in fondo                  | «I dati servono solo a far funzionare l'app per voi. …» (tagliata nella PNG)                                                                                                             | **non si mostra** finché il designer non riporta il testo intero dal canvas e `legale-privacy` non lo approva                                                                                    |

- Sblocco con il viso (`sc1-07`, risposta 137): nativo, proposta, non in A18.
- Dei link si leggono solo `wishlist_id`, `expires_at`, `disabled_at` (mai `code`); degli inviti solo `member_id`, `status`, `expires_at` (mai token o codice), come oggi.

**Informazioni** (telefono; sul computer le voci Novità, Proposte, Crediti foto, Aiuto e contatti sono già nella lista di §2 e qui restano solo informativa, termini e versione)

| Riga                               | Azione                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------- |
| Novità                             | se esiste (B5)                                                              |
| Proposte                           | se esiste (B6)                                                              |
| Informativa sulla privacy          | → `/privacy`                                                                |
| Termini d'uso                      | → `/termini`                                                                |
| Crediti foto · «Pexels e Unsplash» | se esiste (B13c #568)                                                       |
| Aiuto e contatti                   | **nascosta** (non disegnata, domanda 8)                                     |
| «Versione {versione}»              | testo, dalla costante unica `APP_VERSION` (da `package.json`, oggi «0.1.0») |

## §9 Dati

| Uso                         | Letto                                                                                                                                                                                                              | Scritto                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Chi vive qui, Chi organizza | `household_members`: `id`, `kind`, `name`, `color`, `user_id`, `is_admin`, `created_at`                                                                                                                            | `household_members.is_admin` (solo chi organizza)                                                           |
| Aspetto                     | `profiles.appearance` (**da creare**)                                                                                                                                                                              | `profiles.appearance`                                                                                       |
| Notifiche                   | `get_notification_preferences()` (colonne di DB-2 parti 1 e 2)                                                                                                                                                     | `set_notification_preference`, `set_notification_options`                                                   |
| Sintesi                     | `profiles.morning_digest_time`, `profiles.morning_digest_weekdays`, preferenze `morning_digest`, `digest_*`                                                                                                        | `profiles.morning_digest_time` (update), `set_notification_options` (giorni), `set_notification_preference` |
| Privacy                     | `profiles.default_event_visibility`; `wishlist_share_links` (`wishlist_id`, `expires_at`, `disabled_at`); `wishlists` (`id`, `member_id`); `invitations` (`member_id`, `status`, `expires_at`, solo chi organizza) | `profiles.default_event_visibility`                                                                         |

**`richiesta-db` (piccola):** enum `appearance_mode` (`light`, `dark`, `system`) e colonna `profiles.appearance appearance_mode not null default 'system'`; `grant update (appearance)` ad `authenticated`; policy di `profiles` invariate (solo il proprio profilo); test pgTAP: default, scrittura propria, Laura non cambia quella di Marco, `anon` nulla. Dato personale minimo (una preferenza), cancellato con l'account.

## §10 Stati comuni

- **Caricamento:** quello di oggi (`impostazioni/loading.tsx`), uno per pagina, deciso dal designer.
- **Errore di lettura:** `SettingsError` di oggi con «Riprova», per qualunque lettura fallita della pagina (mai metà pagina).
- **Successo:** nessun messaggio; il valore nuovo è la conferma (come oggi).

## §11 Test da toccare nella stessa PR

| File                                                                                | Cosa                                                                                    |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `tests/e2e/impostazioni.spec.ts`, `tests/a11y/impostazioni.spec.ts`                 | pagina nuova e sottopagine; niente «Chi c'è» né notifiche dentro `/impostazioni`        |
| `tests/e2e/percorso-casa-esplora-impostazioni.spec.ts`, `notifiche-nascita.spec.ts` | indirizzi `/impostazioni/notifiche`, valori predefiniti di DB-2 (07:15, «Spesa» accesa) |
| `tests/e2e/calendari-collegati-impostazioni.spec.ts`                                | se usa `SettingsMenu` o `/impostazioni#…`                                               |
| casi di `profilo-scelte.spec.ts` su sintesi e visibilità (tolti da A17 #550)        | rifatti qui su `/impostazioni/notifiche/sintesi` e `/impostazioni/privacy`              |
| riferimenti visivi di `/impostazioni`                                               | rigenerati con `visual-baseline`, più quelli delle pagine nuove; la PR li elenca        |
