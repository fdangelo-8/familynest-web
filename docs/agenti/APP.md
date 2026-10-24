# Mappa dell'app

Aggiornata dal documentalista dopo ogni merge. Una riga per pagina o fondamenta chiusa.

| Percorso                    | Scopo                                                                                             | Tabelle                                                                                        | Componenti condivisi                                                                                | Issue / PR                           |
| --------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `/accesso`                  | Entrare con Apple, Google o mail; avviso se l'accesso è annullato o fallisce                      | — (Supabase Auth)                                                                              | `src/components/accesso/` (AccessScreen, parts), `src/lib/auth/safe-next.ts`                        | #11 · PR #59                         |
| `/accesso/mail`             | Scrivere la mail e ricevere il link; schermata «Controlla la posta»                               | — (Supabase Auth, OTP)                                                                         | `src/components/accesso/MailScreen.tsx`                                                             | #11 · PR #59                         |
| `/accesso/link-scaduto`     | Link scaduto o non valido, si torna a chiedere il link                                            | —                                                                                              | `src/components/accesso/ExpiredScreen.tsx`                                                          | #11 · PR #59                         |
| `/termini`, `/privacy`      | Testi legali (in arrivo)                                                                          | —                                                                                              | `src/components/accesso/LegalPage.tsx`                                                              | #11 · PR #59                         |
| `/profilo` (segnaposto)     | Bottone «Esci» (invia `POST /auth/signout`)                                                       | —                                                                                              | `src/components/accesso/SignOutForm.tsx`, `PlaceholderPage`                                         | #11 · PR #59                         |
| `/onboarding`               | Primo passo «Chi vive con te?»: crea il Nest lato server; guardia di sessione con `requireUser()` | `profiles`, lettura di `current_household_id()`, RPC `create_household`                        | `src/components/onboarding/` (OnboardingStep, choices, names), `FrameError`, Brand, Stickers, Claim | #12 · PR #64 (guardia: #11 · PR #59) |
| (database) `shopping_items` | Lista della spesa del Nest, pronta per Casa · Spesa (#21); nessuna pagina ancora                  | `shopping_items`, `private.removed_shopping_items` (Annulla, 10 minuti), pulizia con `pg_cron` | —                                                                                                   | #62 · PR #65                         |
| (design system)             | Correzioni approvate: bordo dei campi, giorni fuori mese, bottone rosso al passaggio del mouse    | —                                                                                              | `src/app/globals.css`, `src/app/components.css`                                                     | #52 · PR #60, #61                    |

## Rotte tecniche (senza pagina)

- `/auth/callback`: ritorno da Apple e Google, scambio del codice lato server; `access_denied` e `user_cancelled_authorize` portano a `/accesso?errore=…&annullato=1`.
- `/auth/confirm`: link della mail, `verifyOtp` con `token_hash`; link non valido o scaduto → `/accesso/link-scaduto`.
- `/auth/signout`: solo `POST`, rifiuta un `Origin` diverso (403), cancella i cookie di sessione con scadenza passata.
- `/accesso/mail/invio`: solo `POST`, risponde 303 a `/accesso/mail`; serve come `action` dei form della mail.

## Note condivise

- `src/proxy.ts` (Node): rinnova solo i cookie di sessione; non controlla l'accesso e non reindirizza. I controlli stanno nei layout e nelle pagine (`requireNest()`, `requireUser()`).
- `src/lib/auth/`: `safeNextPath()` (normalizza con `new URL` prima dei controlli), destinazione dopo l'accesso, `requireUser()`.
- Per la pagina Casa · Spesa (#21): le cancellazioni Realtime arrivano a tutti gli iscritti con il solo `id`; la pagina ignora i DELETE con un id che non è nella lista mostrata. Il client non manda `id` nell'insert.
