# #550 · A17 Profilo semplificato · dettagli del requisito

Dettagli del requisito della issue #550 (analista, 26/11/2026). Nella issue ci sono le regole principali e i CA; qui righe, fogli, testi, dati e test da toccare. Se issue e file si contraddicono, vale la issue.

Fonti: `docs/design/telefono/profilo/profilo.png` (Passo 5, risposta 88: «Profilo senza "Accesso"»); `docs/design/computer/il-tuo-impostazioni-notifiche/04-il-tuo-profilo.png` (Passo 11); `docs/design/computer/regole.md`; requisito di F5 #506 (rotta `/profilo`: dettaglio, ripiego `/nest`, titolo «Il tuo profilo» sul computer); DB-2 #511; codice attuale in `src/app/(app)/profilo/` e `src/components/profilo/`.

## §1 Telefono (sotto i 760 px)

Testata di dettaglio di F5: freccia indietro (ripiego `/nest`). Poi tre blocchi separati da un filo (nota di Fable: «i tuoi dati, le tue impostazioni, uscire»).

**Cima.** Pallino grande del colore della persona con l'iniziale del suo nome nel Nest (`Avatar` `xl`), accanto l'`h1` con il nome dell'account (`profiles.display_name`; se vuoto, il nome nel Nest) e sotto «Il tuo profilo».

**Blocco 1 · i tuoi dati** (righe con etichetta piccola sopra, valore sotto, azione testuale sottolineata a destra):

| Etichetta | Valore                                                                                                                                                                                                                                                                | Azione   | Che cosa fa                                                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Nome      | `display_name` (se vuoto: nome nel Nest)                                                                                                                                                                                                                              | Modifica | foglio «Il tuo nome» (§3)                                                                                                               |
| Colore    | pallino piccolo con l'iniziale + nome della tinta da `memberColorLabel()` («Corallo»)                                                                                                                                                                                 | Cambia   | foglio «Il tuo colore» (§3)                                                                                                             |
| Mail      | mail dell'account                                                                                                                                                                                                                                                     | Modifica | va alla pagina «Mail e password» di A19 #552. **Il link c'è solo se la sua rotta esiste** (`hasAppRoute`); senza, la riga non ha azione |
| Password  | con l'accesso con mail: «Cambiata il {12 settembre}» (anno solo se diverso da quello di oggi a Roma) da `password_changed_at`; data assente: nessun valore (domanda 3). Senza accesso con mail: «Accedi con Google», «Accedi con Apple» o «Accedi con Apple e Google» | Cambia   | come Mail: pagina di A19, solo se esiste e solo con l'accesso con mail                                                                  |

**Blocco 2 · le tue impostazioni** (righe toccabili con icona a sinistra, freccia sottile B a destra):

| Riga                | Riga sotto                                                                                                               | Destinazione                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Notifiche           | il modo di ricezione: `each` «Una per una», `mine_now` «Subito quello che tocca a te», `digest_only` «Solo il riepilogo» | `/impostazioni/notifiche` (A18 #551)                                                                                                                                 |
| Calendari collegati | come oggi (`profileCalendarsInfo`: nomi dei servizi, «Outlook»)                                                          | `/calendari-collegati`                                                                                                                                               |
| Esporta i miei dati | nessuna                                                                                                                  | finché la pagina di A19 non esiste: scarica il file come oggi («I tuoi dati», `POST /profilo/dati`, rotella nella riga, stessi errori); poi: link alla pagina di A19 |

**Blocco 3 · uscire:**

- «Esci» (icona di uscita): apre la conferma di oggi (`SIGN_OUT_TEXT`), poi esce e cancella i dati locali con la funzione unica (LEZIONI), poi `/accesso`.
- «Elimina l'account» (rosso, icona del cestino): apre la conferma di oggi con le conseguenze per il Nest (`DeletionOutlook`). A19 #552 la sostituisce con il flusso dei 14 giorni.

**Cosa sparisce rispetto a oggi**

| Oggi                                               | Dopo A17                                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| sottotitolo «mail · Adulto in {Nest}»              | «Il tuo profilo» (la mail è una riga)                                                  |
| scelta del colore sempre aperta sotto il nome      | riga «Colore» con il foglio                                                            |
| «Come usi l'app» → «All'apertura» (lente iniziale) | non c'è più nella pagina (domanda 1); il valore salvato resta e continua a valere      |
| «Come usi l'app» → «Sintesi del mattino» (ora)     | in Impostazioni → Notifiche → Sintesi del mattino (A18)                                |
| «Come usi l'app» → «Visibilità predefinita»        | in Impostazioni → Privacy → «Un impegno nuovo nasce» (A18)                             |
| «Account» → «Accesso» («Con Google e la mail»)     | non c'è più (risposta 88); la riga Password dice come si accede quando non c'è la mail |
| «I tuoi dati»                                      | «Esporta i miei dati», stesso comportamento                                            |
| menu laterale delle impostazioni (`SettingsMenu`)  | non c'è più su `/profilo`                                                              |

## §2 Computer (da 760 px)

Come `04-il-tuo-profilo` (Passo 11). Titolo nella barra in alto «Il tuo profilo» (F5). Due colonne (si passa a una colonna se il contenuto è sotto i 900 px, regola unica del pannello, F5 §1):

- **Sinistra:** pallino, nome, riga sotto (domanda 2), poi le quattro righe del blocco 1.
- **Destra:** Notifiche, Calendari collegati, «Account e privacy» («Consensi, i tuoi dati», verso la pagina di A19, **solo se la sua rotta esiste**), Esporta i miei dati, filo, «Esci da questo computer», «Elimina l'account».
- «Piano e pagamenti» del disegno non c'è: Plus arriva dopo (decisione del 24/11).
- Il blocco dell'app (sblocco con il viso) non c'è sul computer (nota di Fable) e non c'è nemmeno sul telefono finché N0–N5 non lo costruiscono.
- Passaggio del mouse e fuoco: `regole.md` §8.

## §3 Fogli

Fogli di F4c (sul computer la finestra al centro stretta, 420 px). X a sinistra vale «Annulla»; Esc chiude; il fuoco torna sull'azione che l'ha aperto.

**«Il tuo nome»**

- Campo «Nome» con il nome dell'account, il fuoco dentro, massimo 100 caratteri (il campo non accetta oltre; vincolo `profiles_display_name_length`). «Annulla» e «Salva».
- Al salvataggio si tolgono gli spazi all'inizio e alla fine (vincolo `profiles_display_name_trimmed`). Vuoto o di soli spazi: errore sotto il campo «Scrivi il tuo nome.» **(default)**, `aria-invalid`, nessuna richiesta.
- Si scrive solo `profiles.display_name` della persona. Il nome nel Nest (`household_members.name`, quello dei pallini) non cambia: si cambia dalla scheda nel tuo Nest (A13 #546) (domanda 4).
- Mentre salva: «Salva» con la rotella e `aria-busy`. Riuscito: il foglio si chiude, `h1` e riga mostrano il nome nuovo. Errore: il foglio resta aperto con il testo scritto e l'avviso «Non siamo riusciti a salvare il nome. Controlla la connessione e riprova.» (rete, stato 0) o «Non siamo riusciti a salvare il nome per un problema nostro. Riprova tra qualche minuto.» (server) **(default, sul modello dei testi di oggi)**.

**«Il tuo colore»**

- La scelta del colore di oggi (`ColorChoice`, i colori presi dagli altri mostrano l'iniziale e non si scelgono). Toccare un colore libero lo salva subito (come oggi, `household_members.color` della propria riga).
- Riuscito: il foglio si chiude; pallini e riga mostrano il colore nuovo. Preso da qualcun altro nel frattempo (`23505`): il foglio resta aperto con «Questo colore l'ha appena preso qualcun altro: scegline un altro.» Errori di rete e server: i testi di oggi (`COLOR_ERROR`).

## §4 Stati

| Stato        | Che cosa si vede                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Caricamento  | quello di oggi (`profilo/loading.tsx`), riallineato dal designer                                                                                                                                 |
| Errore       | qualunque lettura fallita (account, profilo, membri, preferenze delle notifiche, calendari, esito dell'eliminazione): `ProfileError` di oggi con «Riprova»; mai una pagina con un pezzo mancante |
| Esportazione | rotella nella riga, poi «Dati scaricati: trovi il file tra i download.» o gli errori di oggi                                                                                                     |

## §5 Dati

Letti con la sessione della persona, solo ciò che la pagina mostra:

| Dato                          | Da dove                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| mail, modi di accesso         | `auth.getUser()`: `email`, `identities[].provider` (solo il nome del servizio)                |
| nome dell'account             | `profiles.display_name`                                                                       |
| data del cambio di password   | `profiles.password_changed_at` (**da creare**, §6)                                            |
| nome, colore nel Nest         | `household_members` (`id`, `name`, `color`, `kind`, `user_id`, `created_at`) del proprio Nest |
| modo di ricezione             | `get_notification_preferences()` → `delivery_mode` (dopo DB-2 parte 2, PR #612)               |
| calendari collegati           | `readLinkedCalendars` come oggi                                                               |
| conseguenze dell'eliminazione | `get_account_deletion_outcome()` come oggi                                                    |

Non si leggono più `start_lens`, `morning_digest_time`, `default_event_visibility` (non servono alla pagina). Degli altri membri lasciano il server solo colore (per la scelta) e i nomi che servono al testo della conferma di eliminazione, come oggi.

## §6 Richiesta al database (proposta; il coordinatore sceglie se dentro DB-4 #513 o a parte)

- `profiles.password_changed_at timestamptz null`: quando la persona ha cambiato la password dall'app l'ultima volta. Serve solo alla riga «Cambiata il …» (`profilo.png`). Nessun valore all'inizio per gli account esistenti.
- Scritta solo dal database con una funzione `mark_password_changed()` (`security definer`, solo `authenticated`, scrive `now()` sul profilo di chi chiama, nessun parametro), chiamata dalle pagine che cambiano la password (A19 #552, A20 #553) dopo il cambio riuscito. Nessun privilegio di `update` diretto sulla colonna.
- Isolamento: la policy di `profiles` resta «solo il proprio profilo» (test pgTAP: Laura non legge la data di Marco).
- Privacy: è un dato sull'account, non sui figli; cancellato con l'account (cascata già esistente da `auth.users`).

## §7 Testi (in `messages/it.ts`, gruppo proposto `profile`)

«Il tuo profilo», «Nome», «Colore», «Mail», «Password», «Modifica», «Cambia», «Cambiata il {data}», «Accedi con {servizi}», «Notifiche», «Una per una», «Subito quello che tocca a te», «Solo il riepilogo», «Calendari collegati», «Account e privacy», «Consensi, i tuoi dati», «Esporta i miei dati», «Esci», «Esci da questo computer», «Elimina l'account», «Il tuo nome», «Il tuo colore», «Annulla», «Salva», «Scrivi il tuo nome.», i due errori del nome. Restano quelli di oggi per colore, esportazione, uscita ed eliminazione.

## §8 Accessibilità

- Un solo `h1` (il nome). Le azioni «Modifica» e «Cambia» hanno un nome accessibile che comincia con il testo visibile e dice il campo: «Modifica» + `aria-describedby` verso l'etichetta, oppure nome «Modifica il nome» **(default del designer; LEZIONI su `label-content-name-mismatch`)**.
- Righe del blocco 2 come link (o `button` per Esporta finché scarica); aree di tocco ≥ 44 px.
- Le conferme di uscita ed eliminazione restano quelle di oggi (`ConfirmDialog`).

## §9 Test da toccare nella stessa PR

| File                                                             | Cosa                                                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `tests/e2e/profilo-pagina.spec.ts`, `tests/a11y/profilo.spec.ts` | nuova struttura (cima, tre blocchi), sottotitolo, niente `SettingsMenu`              |
| `tests/e2e/profilo-scelte.spec.ts`                               | lente, sintesi e visibilità escono dal profilo: i casi passano ai test di A18 (#551) |
| `tests/e2e/profilo-dati.spec.ts`, `profilo-esci-elimina.spec.ts` | nuovi nomi delle righe («Esporta i miei dati», «Esci»), stesso comportamento         |
| test del colore nel profilo                                      | la scelta passa nel foglio                                                           |
| riferimenti visivi di `/profilo`                                 | rigenerati con `visual-baseline`; la PR li elenca                                    |
