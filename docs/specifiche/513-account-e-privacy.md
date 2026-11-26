# DB-4 #513 · Account e privacy: regole di dettaglio

Complemento del requisito della issue #513 (regole 10–13). Vale insieme alla issue; in caso di contrasto vale la issue.

## Regola 10 · Eliminazione vera

- Job `pg_cron` ogni ora. Una richiesta si esegue dalle 00:00 di Roma del giorno dopo `delete_on`: tutto il giorno `delete_on` resta per ripensarci.
- Fa esattamente quello che fa oggi `delete_own_account`: righe `auth` (registro, flussi, token, SCIM, utente), profilo, membro e tutto quello che va con loro. Una sola funzione in `private`, usata sia da `delete_own_account` sia dal job (LEZIONI: una sola fonte).
- La regola sulla casa si ricalcola al momento dell'eliminazione: **una casa con un altro adulto con account non si cancella mai**, anche se la richiesta diceva `deletes_household`. In quel caso l'altro adulto diventa amministratore, con la regola di oggi.
- Nelle cose condivise l'autore diventa null, come oggi. «Un ex componente» è il testo che la pagina mostra per un autore null: il database non salva nomi.
- Prima di cancellare, il job copia la mail dell'account in `private.account_deletion_mails(id, email, deleted_on, created_at)`, per l'ultima mail (risposta 159). Nessun altro dato.

## Regola 11 · Ultima mail

- `take_account_deletion_mails(p_limit)`: `p_limit` 1–50, solo `service_role`, solo POST (P0001 per ogni altro metodo, prima di leggere). Dà le righe più vecchie e le cancella nella stessa chiamata: ogni mail esce una volta sola.
- Il job `mail_purge` cancella comunque le righe più vecchie di 72 ore, anche se nessuno le ha prese.
- La mail «Il tuo account sarà eliminato il …» la manda il server al momento della richiesta (ha la sessione e la mail): nessuna tabella.

## Regola 12 · Esportazione

- Il file lo prepara il server **con la sessione dell'utente**, così valgono le regole di visibilità di sempre (come oggi `src/app/(app)/profilo/dati/build.ts`). Il database tiene solo lo stato e il file. Così non esiste una seconda copia delle regole di visibilità in una funzione `service_role`.
- `start_data_export()`: dà l'id di una riga nuova `preparing`. Se il chiamante ha già una `preparing` di meno di 30 minuti, dà quella. Al massimo 5 richieste al giorno (Roma) per account: la sesta dà 54000.
- File: `data-exports/<user_id>/<export_id>.zip`, bucket privato, al massimo 50 MiB.
- Policy di `storage.objects` sul bucket:
  - insert e update: solo il proprietario, solo nel proprio percorso, solo per un export suo `preparing`;
  - select: solo il proprietario, solo con riga `ready` ed `expires_at` futuro;
  - delete: nessuno dall'app;
  - nessun accesso per altri adulti (amministratore compreso) né per `anon`.
- `finish_data_export(p_id, p_size_bytes)`: solo su un export proprio `preparing` e solo se il file esiste (22023 altrimenti). Mette `ready`, `ready_at = now()`, `expires_at = ready_at + 24 ore`, `size_bytes`. Se il chiamante ha una casa, crea `data_export_ready` per lui, senza `actor_member_id`.
- `fail_data_export(p_id)`: export proprio `preparing` → `failed`.
- `get_my_data_export()`: l'ultima riga del chiamante (`id`, `status`, `requested_at`, `ready_at`, `expires_at`, `size_bytes`), o nessuna se l'ultima è `ready` e scaduta.
- Job `exports`:
  - `preparing` da più di 30 minuti → `failed`;
  - righe `ready` scadute o `failed` da più di 7 giorni → cancellate, ma solo dopo che il file non c'è più.
- I file scaduti si cancellano dall'API di Storage, non dall'SQL (Storage non toglie il file se si cancella la riga). `list_expired_data_exports(p_limit)` e `forget_data_export(p_id)`, solo `service_role`, solo POST, servono alla rotta del server che toglie i file entro 1 ora dalla scadenza. Anche se la rotta non gira, il file non si scarica più (policy di select).

## Regola 13 · Job

- `run_account_job(p_job, p_at)`, enum `account_job` = `deletions`, `exports`, `mail_purge`. Solo `service_role`, un solo lavoro per chiamata, rifacibile senza effetti doppi. Serve ai test pgTAP (ore date con `p_at`) e lo chiamano le pianificazioni `pg_cron`.
