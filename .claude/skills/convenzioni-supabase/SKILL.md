---
name: convenzioni-supabase
description: Regole FamilyNest per database Supabase - migrazioni, RLS, test pgTAP, tipi generati, uso del client. Usala prima di scrivere o rivedere migrazioni, policy, query o codice che legge e scrive dati.
---

# Convenzioni Supabase di FamilyNest

Progetto unico consentito: `yksosqvugiempsldejyt`. Qualsiasi altro riferimento a un progetto Supabase è un errore da segnalare.

## Chi tocca cosa

- Solo l'agente `architetto-dati`, solo su un branch `db/<argomento>`, modifica `supabase/` e `src/types/database.ts`. Hook e CI lo impongono.
- Nessun agente applica migrazioni al database remoto: lo fa la CI al merge su `main`.
- Il resto del team legge lo schema dai file in `supabase/migrations/`, che sono la fonte di verità.

## Migrazioni

- Una cartella, file con nome `YYYYMMDDHHMMSS_descrizione_breve.sql` (crealo con `npx supabase migration new <nome>`).
- Le migrazioni già su `main` non si modificano mai: si aggiunge una nuova migrazione.
- Separare in file diversi: estensioni → tipi/enum → tabelle e vincoli → policy → dati iniziali.
- `ALTER TYPE ... ADD VALUE` sempre in una migrazione separata da chi usa il nuovo valore.
- Ogni migrazione deve funzionare su un database vuoto applicando tutte le precedenti (la CI lo verifica).
- Niente `CREATE POLICY IF NOT EXISTS` (non esiste): usa `DROP POLICY IF EXISTS` + `CREATE POLICY`.

## Modello dati: regole di base

- Schema `public`, nomi tabelle al plurale in `snake_case` inglese (`households`, `household_members`, `children`, `events`).
- Chiavi primarie `id uuid primary key default gen_random_uuid()`.
- Sempre `created_at timestamptz not null default now()` e, se modificabile, `updated_at` con trigger.
- Date e orari in `timestamptz` (UTC). Date senza orario (compleanni) in `date`.
- Ogni dato familiare appartiene a un nucleo: colonna `household_id uuid not null references households(id) on delete cascade`.
- Indice su ogni chiave esterna e su ogni colonna usata nelle policy.

## RLS: obbligatoria dal primo giorno

- `alter table ... enable row level security;` nella stessa migrazione che crea la tabella. Nessuna tabella senza RLS.
- Policy separate per `select`, `insert`, `update`, `delete`, scritte `to authenticated`.
- L'appartenenza al nucleo si verifica con **una funzione** `security definer` con `set search_path = ''`, per evitare ricorsioni tra policy:

```sql
create or replace function public.is_household_member(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = target and m.user_id = (select auth.uid())
  );
$$;
```

- Nelle policy usa `(select auth.uid())`, non `auth.uid()` nudo (prestazioni).
- Mai policy che si interrogano a vicenda tra due tabelle.
- Una policy che cambia richiede sempre un test pgTAP che dimostri l'isolamento.

## Test pgTAP (`supabase/tests/*.sql`)

Per ogni tabella almeno:
1. Utente del nucleo A legge i propri dati.
2. Utente del nucleo B **non** vede i dati del nucleo A (0 righe).
3. Utente del nucleo B non può inserire, modificare o cancellare dati del nucleo A.
4. Utente anonimo non vede nulla.

Si eseguono con `npx supabase test db` (Postgres locale) e in CI.

## Tipi TypeScript

- `src/types/database.ts` è generato, mai scritto a mano. Si rigenera a ogni migrazione con `npm run db:types:local` (database locale).
- Se il database locale non è disponibile nel tuo ambiente, la CI `db` genera i tipi e, se differiscono, fallisce mostrando il file atteso nel log e come artifact: copialo così com'è.

## Uso del client nell'app

- Server component e route handler: `createClient` da `@/lib/supabase/server`. Client component: `@/lib/supabase/client`.
- `@/lib/supabase/admin` (chiave segreta) solo per script di seed e operazioni amministrative lato server; mai in risposta a input dell'utente senza controlli.
- Mai concatenare `.select()` dopo `insert`/`update`/`delete`: se serve rileggere, fai una query separata.
- Gestisci sempre `error` restituito dal client: niente errori silenziosi.
- Nessun dato di un nucleo deve passare per variabili globali o cache condivise tra utenti.

## Skill collegate

Per approfondire indici, prestazioni e sicurezza Postgres consulta `supabase-postgres-best-practices`. In caso di conflitto valgono queste regole.
