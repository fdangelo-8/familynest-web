# #333 · Aggiungi: campi a mano, niente «Esempi», niente «La porta», visibilità a due voci, più persone in «Chi se ne occupa»

Dettagli del requisito della issue #333 (analista, 06/11/2026). Nella issue ci sono regole e CA; qui le analisi lunghe, da leggere solo se serve.

Fonti: decisioni di Francesco del 06/11 (corpo e commento della #333), requisiti di #20, #22, #171, #335 (modifica della Spesa), codice in `src/components/aggiungi/` e `src/components/evento-modulo/`, schema in `supabase/migrations/`.

## 1. Dove compaiono oggi «chi la porta» e «Chi se ne occupa»

| Testo                                                         | Dove                                                                                                     | Cos'è                                                                                       | Con la #333                                                                                  |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| «La porta» (riga del riepilogo, icona `car`, valore «Scegli») | Foglio Aggiungi, tipo Impegno, solo da 1024 px (`AddSheet.tsx`, `OptionRow entry="escort"`)              | Apre «Nuovo impegno» con il fuoco su «La porta»                                             | Si toglie, con le altre righe del riepilogo (§3)                                             |
| «La porta» (gruppo di chip, solo adulti)                      | Modulo «Nuovo impegno» aperto da «Più dettagli» / «Tutti i dettagli» (`EventFormFields`, condiviso)      | Accompagnatore, `events.escort_member_id`, uno solo                                         | Non si mostra nel modulo aperto da Aggiungi; l'impegno si salva con `escort_member_id` nullo |
| «La porta», «la porta Laura»                                  | «Modifica impegno» del Dettaglio (#19, stesso `EventFormFields`), scheda del Dettaglio, Oggi, Calendario | Mostra o cambia l'accompagnatore salvato                                                    | **Resta** (fuori da Aggiungi, domanda D2)                                                    |
| Avviso «… chi accompagna Sofia?»                              | Foglio Aggiungi, tipo Impegno                                                                            | Avviso informativo, non un campo                                                            | Resta (domanda D3)                                                                           |
| «Chi se ne occupa»                                            | Foglio Aggiungi, tipi **Da fare** e **Scadenza**, anche in «Modifica» (`WhoGroup` in `ThingBlocks.tsx`)  | Chi deve fare la cosa: `todos.assignee_member_id`, `deadlines.assignee_member_id`, uno solo | **Non è «La porta»**: resta e diventa a scelta multipla (decisione 5)                        |
| —                                                             | Spesa                                                                                                    | Nessuno dei due oggi                                                                        | Arriva «Chi se ne occupa» a più scelte (decisione 5; anche nella modifica della #335)        |

«Chi la porta» esiste solo nel tipo Impegno; in Spesa non c'è mai stato.

## 2. Campi per tipo

«Dalla frase» = il riconoscimento di oggi (#20 §4, #22 §2-§5), che non cambia.

| Tipo     | Campo (nome accessibile proposto)                                                                         | Valore iniziale                                                         | Obbligatorio | Scrive                                                               |
| -------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------- |
| Impegno  | Titolo                                                                                                    | la frase senza le parti riconosciute (nessun campo a parte)             | sì           | `events.title`                                                       |
| Impegno  | «Giorno» (`DateField`)                                                                                    | dalla frase; solo l'ora → oggi; niente → vuoto                          | sì           | `starts_at`                                                          |
| Impegno  | «Dalle», «Alle» (campi ora del modulo #19)                                                                | dalla frase; «Alle» = «Dalle» + 1 ora se la frase non la dice           | sì           | `starts_at`, `ends_at`                                               |
| Impegno  | «Chi» (più scelte, gli stessi membri del modulo #19)                                                      | i nomi della frase, altrimenti «Tu»                                     | almeno uno   | `event_members`                                                      |
| Impegno  | «Chi lo vede» («Solo io», «Occupato», «Tutti»)                                                            | lente «Nest» → «Tutti»; lente «Io» → preferenza del profilo (come oggi) | sì           | `events.visibility`                                                  |
| Da fare  | «Data» (`DateField`)                                                                                      | dalla frase, altrimenti vuoto                                           | no           | `todos.due_date`                                                     |
| Da fare  | «Chi se ne occupa» (più scelte: adulti e figli, niente animali)                                           | dalla frase («<Nome> deve», «Devo»), altrimenti nessuno                 | no           | `todo_assignees` (§6)                                                |
| Da fare  | «Per <Nome>»                                                                                              | dalla frase, come oggi (non è un campo a mano)                          | no           | `todos.for_member_id`                                                |
| Da fare  | Visibilità (due voci)                                                                                     | «Lo vede tutto il Nest»                                                 | sì           | `todos.is_private`                                                   |
| Scadenza | «Data» (`DateField`)                                                                                      | dalla frase, altrimenti vuoto                                           | **sì**       | `deadlines.due_date`                                                 |
| Scadenza | «Chi se ne occupa» (più scelte)                                                                           | dalla frase, altrimenti «Tu»                                            | no           | `deadline_assignees` (§6)                                            |
| Scadenza | Riguarda («Sofia»)                                                                                        | dalla frase, come oggi                                                  | no           | `deadlines.for_member_id`                                            |
| Scadenza | «Avvisami»                                                                                                | 30, 7, 1 (come oggi)                                                    | no           | `deadlines.reminder_days`                                            |
| Scadenza | Visibilità (due voci)                                                                                     | «Lo vede tutto il Nest»                                                 | sì           | `deadlines.is_private`                                               |
| Spesa    | le cose e le quantità: la frase è la lista, le righe dell'anteprima mostrano nome e quantità (domanda D4) | dalla frase                                                             | almeno una   | `shopping_items`                                                     |
| Spesa    | «Chi se ne occupa» (più scelte, come Da fare)                                                             | nessuno; la frase non lo riconosce                                      | no           | `shopping_item_assignees` (§6), uguale per tutte le cose della frase |

Spesa non ha visibilità: è sempre di tutto il Nest (nessuna colonna `is_private`).

Solo nel modulo «Più dettagli» / «Tutti i dettagli» (Impegno): Dove, Si ripete, Note. Il modulo parte dai valori **dei campi del foglio** (non più dalla sola frase), senza «La porta».

## 3. Righe del riepilogo da 1024 px

Le quattro righe di oggi (Quando, Chi, La porta, Chi lo vede) ripetono i campi nuovi: si tolgono. Restano «Tutti i dettagli» (computer) e «Più dettagli» (telefono). Chiudendo il modulo, il fuoco torna su quel bottone.

## 4. Frase e campi: esempio passo per passo

Regole R1-R7 nella issue. [OR] = martedì 20/10/2026, tipo Da fare.

| Passo | Azione                                                   | Campo «Data» | Perché                                                       |
| ----- | -------------------------------------------------------- | ------------ | ------------------------------------------------------------ |
| 1     | scrive «chiamare la nonna entro venerdì»                 | 2026-10-23   | segue la frase (R1)                                          |
| 2     | sceglie a mano 2026-10-26                                | 2026-10-26   | a mano (R2)                                                  |
| 3     | aggiunge « subito»                                       | 2026-10-26   | la data riconosciuta non è cambiata (R3)                     |
| 4     | cambia «venerdì» in «giovedì»                            | 2026-10-22   | la frase riconosce un'altra data: vince l'ultima azione (R3) |
| 5     | sceglie a mano 2026-10-26, poi cancella « entro giovedì» | vuoto        | la frase ha perso la data: vince l'ultima azione (R3)        |
| 6     | sceglie a mano 2026-10-27, tocca «Scadenza»              | 2026-10-27   | la data a mano passa tra Da fare e Scadenza (R5)             |
| 7     | tocca «Impegno», poi «Da fare»                           | dalla frase  | gli altri cambi di tipo azzerano le scelte a mano (R5)       |

Il titolo salvato è sempre la frase senza le parti riconosciute: al passo 2 è «Chiamare la nonna», anche se la data viene dal campo.

«Chi se ne occupa» usa la stessa regola, che è già quella di oggi (`writtenRef` in `AddSheet.tsx`): un nuovo «<Nome> deve» / «Devo», o la sua scomparsa, rimette la scelta a quella della frase (una persona; senza nome nessuno in Da fare, «Tu» in Scadenza).

**Cambio di tipo e Spesa («Compleanno Filippo – sld», analisi nella #335).** Con Scadenza senza data il bottone non salva niente (già oggi). Il testo arrivato nella Spesa è passato quasi certamente da un tocco su «Spesa», che tiene la frase. Regola: cambiare tipo non salva mai; con Spesa l'anteprima mostra le righe che si aggiungeranno e il bottone dice quante sono, prima di ogni salvataggio (CA-29).

## 5. Testi proposti (il designer può cambiarli; il coordinatore allinea i CA)

| Dove                                    | Testo                                                                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Bottone Da fare con altre persone       | «Dai a Laura», «Dai a Laura e Sofia», «Dai a Laura, Sofia e Tommaso»: gli altri nell'ordine del gruppo, «Tu» non si nomina |
| Bottone Da fare con nessuno o solo «Tu» | «Aggiungi ai da fare»                                                                                                      |
| Toast Da fare con altre persone         | «Dato a **Laura e Sofia**: Chiamare la nonna.»                                                                             |
| Visibilità                              | «Lo vede tutto il Nest» · «Lo vedo solo io» (parole di Francesco; sostituisce «Lo vedi solo tu»)                           |
| Scadenza senza data                     | «Manca la data: sceglila qui sotto o scrivila nella frase.»                                                                |
| Data passata (Da fare e Scadenza)       | «Questa data è già passata: scegli una data da oggi in poi.»                                                               |
| Data oltre il 2100                      | «Scegli una data entro il 2100.»                                                                                           |
| Impegno senza giorno o senza ora        | «Manca il giorno.» · «Manca l'ora.» (senza «scrivi per esempio …»)                                                         |

L'errore di un campo sta sotto il campo e il fuoco va sul campo; gli errori del titolo restano sotto la frase.

## 6. Richiesta-db comune a #333 e #335

**Schema attuale (verificato nelle migrazioni):**

| Cosa                | Dove                                                                                                                                                                                                        | Responsabili                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Cose da fare        | `todos.assignee_member_id` (FK `(assignee_member_id, household_id)` → `household_members`, `on delete set null`; trigger `private.todos_check_assignee`: adulto o figlio; vincolo `todos_private_assignee`) | **uno solo**                            |
| Scadenze            | `deadlines.assignee_member_id` (stesse regole: `private.deadlines_check_assignee`, `deadlines_private_assignee`)                                                                                            | **uno solo**                            |
| Spesa               | `shopping_items` non ha responsabili (solo `added_by_member_id`); `grant update (checked_at)`; policy `shopping_items_delete`                                                                               | **nessuno**                             |
| Impegni, «Chi»      | tabella `event_members`                                                                                                                                                                                     | più persone, già pronto                 |
| Impegni, «La porta» | `events.escort_member_id`                                                                                                                                                                                   | uno; non cambia (si toglie da Aggiungi) |

**A. Più responsabili (#333, decisione 5) — sostituisce il punto 1 della richiesta della #335**

1. Tabelle `public.todo_assignees`, `public.deadline_assignees`, `public.shopping_item_assignees`: id della cosa, `member_id`, `household_id`, `created_at`. Chiave primaria (cosa, membro). FK composte verso la cosa `(id, household_id)` e verso `household_members (id, household_id)`, `on delete cascade` su entrambe (membro che esce o cosa eliminata portano via le righe).
2. Trigger: il membro è un adulto (anche senza account) o un figlio dello stesso Nest, mai un animale (errore `23514`, come `*_check_assignee`). Per `todos` e `deadlines`: con `is_private` vero l'unico responsabile ammesso è l'autore, controllato sia scrivendo i responsabili sia passando la cosa a «Solo io».
3. RLS: chi vede la cosa vede i suoi responsabili e li cambia se può cambiare la cosa; un altro Nest legge 0 righe e non scrive; `anon` nulla. pgTAP nei due versi, anche con la chiave amministrativa (`update`/`delete` con `returning` a 0 righe, `insert` con id altrui `42501`).
4. Scrittura in una transazione (LEZIONI): RPC `security invoker` con la logica in `private` (`security definer`), il ruolo controllato in un'istruzione a sé:
   - creare e modificare una cosa da fare o una scadenza **con** i responsabili (`p_assignee_member_ids uuid[]`, vuoto = nessuno); serve anche per «Annulla» dopo «Salva»;
   - aggiungere più cose alla spesa con gli stessi responsabili (`p_items`: nome e quantità; `p_assignee_member_ids`), saltando i doppioni come oggi (`23505`), e restituendo gli id salvati per «Annulla» (`undo_added_shopping_items` resta; i responsabili spariscono in cascata);
   - cambiare i responsabili di una cosa della spesa (#335).
     Id, autore e `added_by_member_id` li scrive il database.
5. Dati esistenti: ogni `todos.assignee_member_id` / `deadlines.assignee_member_id` non nullo diventa una riga della tabella nuova.
6. Compatibilità: `todos.assignee_member_id` e `deadlines.assignee_member_id` restano per una fase, tenute dal database uguali al primo responsabile in ordine di inserimento (o nulle), non più scrivibili dai client; si tolgono con una migrazione successiva quando tutte le pagine leggono le tabelle nuove. Per la spesa nessuna colonna `assignee_member_id` (la #335 la prevedeva singola: non serve più).
7. Notifiche (`private.todos_notify_assignee`): una `todo_assigned` a ogni persona **aggiunta** ai responsabili, se ha l'account, non è chi agisce, la cosa non è «Solo io» e la preferenza `assigned_todos` lo consente. Niente a chi era già responsabile o viene tolto. Spesa: nessuna notifica (#335, domanda 4).
8. Avvisi delle scadenze (`20261104200005_notifications_functions_and_triggers.sql`, ~riga 520): oggi, se il responsabile è un adulto con account, l'avviso va solo a lui. Diventa: a tutti i responsabili adulti con account; se nessuno, la regola di oggi («Solo io» → autore, altrimenti tutti).
9. `search_household` (`20261104211359`) e righe del calendario (`20261105121822_calendar_rows_with_source.sql`): il filtro per persona vale per **qualsiasi** responsabile; le uscite aggiungono `assignee_member_ids uuid[]`.
10. Cancellazione dell'account (`20261104152241`): l'utente sparisce anche dalle tabelle nuove.

**B. Modifica ed eliminazione della spesa (#335, punti 2-6 della sua richiesta, adattati ad A)**

11. Grant `update (checked_at, name, quantity)` su `shopping_items`; `insert` invariato.
12. `private.shopping_items_before_update`: permette `name` e `quantity` (normalizzati come nell'insert); vieta ancora `id`, `household_id`, `added_by_member_id`, `created_at`. Cambio nome di una cosa da prendere: regola dei doppioni con lo stesso lock, `23505` (`shopping_items_to_buy_name_unique`) solo contro un'**altra** cosa da prendere; cambiare solo maiuscole è permesso. «Rimetti in lista» mai rifiutato.
13. Policy `shopping_items_delete`: anche le cose da prendere, solo del proprio Nest.
14. `private.removed_shopping_items` conserva anche i responsabili (per esempio `assignee_member_ids uuid[]`); `clear_checked_shopping_items` li copia e `restore_shopping_items` li rimette (solo quelli ancora membri del Nest). La pulizia `pg_cron` esistente vale anche per loro.
15. pgTAP: isolamento nei due versi per update e delete; doppione al cambio nome; solo maiuscole permesso; responsabile di altro Nest o animale rifiutato; delete di una cosa da prendere del proprio Nest; `anon` nulla.

**C. Per tutte e due**

16. Una migrazione per passo; `src/types/database.ts` rigenerato; etichetta `suite-completa` prima del merge (tocca trigger e funzioni).

Privacy: nessun dato personale nuovo; solo collegamenti tra cose e membri già esistenti dello stesso Nest.

**Pagine da adattare dopo la richiesta-db** (issue a parte, le apre il coordinatore; come mostrare più persone lo decide il designer di quelle issue): Casa · Da fare (`src/components/casa-da-fare/`), Casa · Scadenze (`casa-scadenze/`), Casa · Spesa (#335), Oggi (`oggi/`), Notifiche (`notifiche/data.ts`), profilo figlio (`figli/useChildProfile.ts`), esportazione dati (`src/app/(app)/profilo/dati/build.ts`), Ricerca (`src/lib/search-household.ts`).

## 7. CA vecchi che cambiano

| Issue | CA                                         | Diventa                                                                                    |
| ----- | ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| #20   | CA-26, CA-27                               | tolti (esempi) → CA-1                                                                      |
| #20   | CA-28, CA-33                               | tolti (righe del riepilogo) → CA-4, CA-7                                                   |
| #171  | CA-2                                       | solo «Tutti i dettagli» accanto al bottone d'invio, niente quattro bottoni                 |
| #171  | CA-6                                       | un solo ingresso, «Tutti i dettagli» / «Più dettagli», fuoco sul Titolo                    |
| #171  | CA-8, CA-13                                | senza «La porta»; `escort_member_id` nullo                                                 |
| #171  | CA-14                                      | Esc e velo tornano alla frase con il fuoco su «Tutti i dettagli» / «Più dettagli»          |
| #171  | CA con «in La porta solo Tu, Paolo e Anna» | tolta la parte «La porta»                                                                  |
| #22   | CA-6, CA-7                                 | come prima; in più con responsabili scelti → CA-30                                         |
| #22   | CA-14                                      | CA-9 (campo «Data») e CA-15 (visibilità)                                                   |
| #22   | CA-18                                      | CA-17 (un'altra persona si aggiunge)                                                       |
| #22   | CA-19, CA-65                               | CA-16                                                                                      |
| #22   | CA-25, CA-26                               | CA-10                                                                                      |
| #22   | CA-32 (prima parte)                        | CA-13                                                                                      |
| #22   | CA-35                                      | uguale, ma «Data» = 2026-10-23 al posto dell'etichetta «Entro venerdì»                     |
| #22   | CA-36                                      | Marco tocca «Tu» (lo toglie) e poi «Laura»                                                 |
| #22   | CA-37, CA-68                               | data: CA-12. «Togli Per Sofia» resta; dopo, il fuoco va sulla voce scelta della visibilità |
| #22   | CA-40, CA-67 (prima parte)                 | CA-21                                                                                      |
| #22   | CA-48, CA-50                               | tolti (esempi) → CA-1                                                                      |
| #22   | CA-59                                      | anche l'insieme dei responsabili torna quello di prima → CA-19                             |
| #22   | errori di data con «scrivi per esempio …»  | testi del §5                                                                               |
| #335  | CA-15, CA-16                               | con più responsabili: la #335 li aggiorna (tabella `shopping_item_assignees`)              |

## 8. Test esistenti da aggiornare

| File                                                                                                                                     | Perché                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `tests/e2e/aggiungi-casa-comuni.spec.ts`                                                                                                 | esempi (#22 CA-48, CA-50), «Chi se ne occupa»                                                             |
| `tests/e2e/aggiungi-casa-da-fare.spec.ts`                                                                                                | etichetta data, scelta singola, bottone visibilità, «Dai a …»                                             |
| `tests/e2e/aggiungi-casa-scadenza.spec.ts`                                                                                               | «Manca la data», errori, visibilità                                                                       |
| `tests/e2e/aggiungi-casa-modifica.spec.ts`                                                                                               | «Togli la data», etichetta fissa della visibilità, «Annulla» con i responsabili                           |
| `tests/e2e/aggiungi-casa-spesa.spec.ts`                                                                                                  | salvataggio con la RPC nuova, «Chi se ne occupa»                                                          |
| `tests/e2e/aggiungi-impegni-modulo-ca.spec.ts`                                                                                           | riga e gruppo «La porta», quattro righe, esempi                                                           |
| `tests/e2e/aggiungi-impegni.spec.ts`, `aggiungi-impegni-ca.spec.ts`, `aggiungi-impegni-frase.spec.ts`, `aggiungi-impegni-modulo.spec.ts` | errori «Manca l'ora», etichette, campi nuovi                                                              |
| `tests/e2e/percorso-casa-aggiungi-ripetuto.spec.ts`                                                                                      | «Chi se ne occupa»                                                                                        |
| `tests/e2e/aggiungi-impegni-avviso.spec.ts`, `aggiungi-sopra-pagina.spec.ts`                                                             | da rieseguire; cambiano solo dove toccano esempi o disposizione                                           |
| `tests/visual/aggiungi-casa.spec.ts`, `aggiungi-impegni.spec.ts`, `aggiungi-impegni-modulo.spec.ts`, `aggiungi-sopra-pagina.spec.ts`     | riferimenti da rigenerare (niente «Esempi», campi nuovi)                                                  |
| `tests/a11y/aggiungi-casa.spec.ts`, `aggiungi-impegni.spec.ts`, `aggiungi-impegni-modulo.spec.ts`                                        | esempi, «La porta», «Togli la data», visibilità                                                           |
| `tests/e2e/dettaglio-impegno*.spec.ts`, `tests/a11y/dettaglio-impegno.spec.ts`                                                           | **non** cambiano («Modifica impegno» tiene «La porta», D2); da rieseguire perché `EventFormFields` cambia |
| `tests/e2e/casa-da-fare.spec.ts`, `casa-scadenze.spec.ts`, `casa-spesa*.spec.ts`, `oggi-*.spec.ts`, notifiche                            | cambiano con le issue delle pagine del §6                                                                 |
