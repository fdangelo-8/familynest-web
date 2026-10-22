# FamilyNest Web — Architettura del team di agenti

Versione approvata da Francesco il 21/10/2026. Copia operativa per gli agenti: in caso di dubbio vale questo file.

## 1. Principi

1. **Il mockup approvato è la fonte di verità.** Nessun agente reinterpreta valori, testi o layout. Le migliorie passano solo come proposte.
2. **Una responsabilità per agente.** Ogni risorsa ha un solo proprietario: il database all'architetto dati, i file condivisi al coordinatore.
3. **Regole imposte dal sistema, non solo scritte.** Hook, CI e protezione di `main` bloccano le azioni vietate anche se un agente le dimentica.
4. **Niente arriva a Francesco se non è verde.** Revisione, test funzionali, test visivi e build devono passare.
5. **Tutto è tracciato.** Lo stato vive su GitHub: etichette, PR e la issue "Stato del lavoro" (etichetta `stato`), aggiornata dal coordinatore e leggibile da Francesco anche dal telefono.
6. **Nel dubbio, ci si ferma.** Un agente che non sa decidere apre una domanda, non inventa.

**Gerarchia delle regole** (vince la più alta): decisioni esplicite di Francesco → questo documento → skill di progetto → istruzioni del singolo agente → skill esterne.

**Decide solo Francesco:** merge su `main`, proposte del designer, domande aperte bloccanti, cambi di perimetro funzionale.

## 2. Contesto tecnico

| Elemento | Scelta |
|---|---|
| Repository | `fdangelo-8/familynest-web`, branch principale `main` |
| Framework | Next.js App Router, TypeScript strict |
| Stile | CSS proprio con variabili del design system; niente Tailwind, niente librerie UI |
| Database e login | Supabase, progetto `yksosqvugiempsldejyt` (unico consentito) |
| Hosting | Vercel, preview per ogni PR |
| Test | Playwright (e2e, visivi, a11y) + pgTAP per il database + controlli statici |
| Layout | Un solo codice, due layout responsive: mobile (390 px) e desktop (1280 px) |
| Lingua | Interfaccia in italiano; codice, commenti e nomi in inglese |

**Vietato a tutti gli agenti:** push o merge su `main`; accesso ad altri progetti Supabase (in particolare `jjvnygockahhcrnkfped`) o ad altri repository; scrivere segreti ovunque; installare skill o pacchetti non previsti senza approvazione; disattivare o aggirare hook, test e CI.

## 3. La squadra

Il coordinatore è la sessione principale avviata con `/sviluppa`: solo la sessione principale può lanciare gli altri agenti.

| Agente | File | Responsabilità | Non può | Modello |
|---|---|---|---|---|
| Coordinatore | `.claude/commands/sviluppa.md` | Pianifica, assegna, gestisce stato, etichette, file condivisi e blocchi | Scrivere codice delle pagine, fare merge | sessione principale |
| Analista | `analista` | Dal mockup al requisito con criteri di accettazione numerati | Inventare funzioni assenti dal mockup | Opus |
| Designer | `designer` | Stati mancanti, mobile/desktop, testi, design system, proposte | Applicare proposte non approvate | Opus |
| Architetto dati | `architetto-dati` | Migrazioni, RLS, test pgTAP, tipi generati | Toccare il codice delle pagine | Opus |
| Sviluppatore | `sviluppatore` | Implementa una pagina nel suo worktree | Toccare database e file condivisi non assegnati | Sonnet |
| Revisore | `revisore` | Qualità, coerenza, sicurezza, privacy | Modificare codice | Opus |
| Tester funzionale | `tester-funzionale` | Un test Playwright per ogni criterio di accettazione | Modificare codice dell'app | Sonnet |
| Tester visivo | `tester-visivo` | Confronto con mockup e specifica, accessibilità, screenshot di riferimento | Modificare codice dell'app | Sonnet |
| Documentalista | `documentalista` | `LEZIONI.md`, `APP.md`, documentazione | Toccare codice | Haiku |

**Regole comuni:** leggere questo file e `LEZIONI.md` all'avvio; lavorare solo sulla issue ricevuta; chiudere sempre con un esito scritto (`FATTO`, `DA CORREGGERE`, `BLOCCATO`); domanda nella issue invece di supposizioni.

## 4. Flusso di lavoro

Etichette di stato (una sola alla volta, le cambia solo il coordinatore):

`da-analizzare` → `in-specifica` → `da-sviluppare` → `in-sviluppo` → `in-revisione` → `in-test` → `pronta-per-francesco` → issue chiusa dal merge

Etichette aggiuntive: `bloccata`, `fondamenta`, `richiesta-db`, `richiesta-condivisa`, `proposta-design`.

| Passaggio | Riceve | Consegna |
|---|---|---|
| Analista + designer | Mockup in `docs/mockup/`, issue | Requisito, criteri di accettazione, specifica grafica, proposte |
| Architetto dati | Issue `richiesta-db` | PR da branch `db/*`: migrazione, RLS, test pgTAP, tipi |
| Sviluppatore | Issue `da-sviluppare` completa | PR da `feat/*` con `Closes #<issue>` |
| Revisore | PR | Commento con esito `APPROVATA` o lista numerata di problemi |
| Tester funzionale + visivo | PR approvata | Test e screenshot nel branch, commento con esito |
| Francesco | PR `pronta-per-francesco` | Merge, oppure commento con correzioni |
| Documentalista | Merge avvenuto | `LEZIONI.md` e `APP.md` aggiornati |

Revisione e test rimandano allo sviluppatore; al quarto rientro la pagina diventa `bloccata`.

## 5. Parallelismo e risorse condivise

- **Fondamenta in sequenza:** design system e stili globali, layout e navigazione, login e sessione, schema base. Nessuna pagina parte prima che le fondamenta siano unite su `main`.
- **Massimo 3 pagine in parallelo**, ognuna in un git worktree isolato e su branch `feat/<pagina>`.
- Lo sviluppatore modifica solo `src/app/(app)/<pagina>/`, `src/components/<pagina>/` e i test della pagina.

| Risorsa | Proprietario | Come si chiede |
|---|---|---|
| Database (migrazioni, RLS, test pgTAP, `src/types/database.ts`) | Architetto dati, solo su branch `db/*` | Issue `richiesta-db` |
| `src/app/globals.css`, `src/components/ui/`, layout, `src/lib/` | Coordinatore, che assegna una issue `richiesta-condivisa` | Issue `richiesta-condivisa` |
| Design system (`.claude/skills/design-system/`) | Designer | Commento nella issue |
| `docs/agenti/LEZIONI.md`, `APP.md` | Documentalista | — |
| Issue "Stato del lavoro" | Coordinatore | — |

Una modifica condivisa alla volta. Dopo ogni merge condiviso tutti i branch attivi si riallineano a `main`. Prima del merge la suite completa deve passare.

## 6. Database: come cambia senza dare password agli agenti

1. L'architetto dati scrive migrazione, policy RLS e test pgTAP su un branch `db/*` e apre una PR.
2. La CI (`db.yml`) avvia un Postgres Supabase locale, applica **tutte** le migrazioni da zero, esegue i test pgTAP e verifica che `src/types/database.ts` coincida con i tipi generati.
3. Al merge su `main`, la CI applica le migrazioni al progetto `yksosqvugiempsldejyt` usando il secret `SUPABASE_DB_URL`, che esiste solo su GitHub.

Nessun agente ha la password del database o un token Supabase personale. Il controllo di `guard.yml` rifiuta PR che toccano il database da branch diversi da `db/*`.

## 7. Skill

Tutte in `.claude/skills/`. Le skill di progetto vincono su quelle esterne (es. se una skill esterna suggerisce Tailwind, vale "niente Tailwind").

| Skill | Origine | Usata da |
|---|---|---|
| design-system | Progetto (da completare dal mockup) | Designer, sviluppatore, tester visivo, revisore |
| convenzioni-supabase | Progetto | Architetto dati, revisore |
| privacy-e-dati-minori | Progetto | Analista, architetto dati, revisore |
| flusso-git | Progetto | Tutti quelli che scrivono su git |
| definizione-di-fatto | Progetto | Tutti |
| test-playwright | Progetto | Tester |
| supabase-postgres-best-practices | Supabase (ufficiale) | Architetto dati, revisore |
| vercel-react-best-practices | Vercel (ufficiale) | Sviluppatore, revisore |
| webapp-testing | Anthropic (ufficiale) | Tester |
| frontend-design | Anthropic (ufficiale) | Designer |
| ux-copy, accessibility-review, write-spec, code-review, testing-strategy | Account di Francesco | Designer, tester visivo, analista, revisore, tester funzionale |

## 8. Guardrail automatici

| Livello | Dove | Cosa fa |
|---|---|---|
| Hook | `.claude/settings.json`, `.claude/hooks/` | Bloccano: push/merge su `main`, force push, comandi distruttivi, altri progetti Supabase, operazioni Supabase remote, lettura e stampa di segreti, gestione del repo. Impongono chi scrive cosa: database solo `architetto-dati` su `db/*`; file condivisi solo su `shared/*`; configurazione agenti e CI solo su `admin/*`; revisore nessun file, tester solo `tests/`, analista e documentalista solo `docs/`, designer `docs/` e skill design-system. A fine lavoro eseguono `npm run check` e rimandano l'agente a correggere |
| Permessi | `.claude/settings.json` | Comandi consentiti e negati |
| CI | `.github/workflows/ci.yml`, `db.yml`, `guard.yml`, `visual-baseline.yml` | Lint, tipi, build, test; database da zero e applicazione al merge; regole su branch, file e PR; screenshot di riferimento nello stesso container della CI |
| Protezione di `main` | GitHub | Merge solo via PR con controlli verdi, solo Francesco |

Modifiche a `.claude/` (configurazione), `.github/` e `CLAUDE.md` si fanno solo in una sessione di manutenzione avviata da Francesco su un branch `admin/*`; `guard.yml` rifiuta le PR che le contengono da altri branch.

## 9. Test

| Tipo | Chi | Dove | Quando |
|---|---|---|---|
| Statici | Sviluppatore | `npm run check`, `npm run build` | Hook a fine turno + CI |
| E2E | Tester funzionale | `tests/e2e/<pagina>.spec.ts` | CI su ogni PR |
| RLS e isolamento | Architetto dati | `supabase/tests/*.sql` (pgTAP) | CI `db` |
| Visivi | Tester visivo | `tests/visual/<pagina>.spec.ts` + riferimenti | CI su ogni PR |
| Accessibilità | Tester visivo | `tests/a11y/<pagina>.spec.ts` | CI su ogni PR |

Utenti di test: almeno due nuclei familiari distinti, creati dallo script di seed. Ogni PR esegue la suite completa.

## 10. Definizione di fatto e blocchi

Vedi la skill `definizione-di-fatto`. Una pagina si blocca per: più di 3 rientri, domanda aperta bloccante, errore tecnico ripetuto. Il coordinatore mette `bloccata`, scrive cosa è successo, cosa è stato provato e **una domanda a cui Francesco può rispondere in una riga**, poi passa ad altro.

## 11. Continuità

Lo stato vive in issue, etichette, PR e nella issue "Stato del lavoro", mai nella memoria di una sessione né in file da committare. Il coordinatore all'avvio rilegge tutto e riprende dal primo passaggio incompleto; un passaggio interrotto si rifà dall'ultimo commit. Un'attività programmata nel cloud lancia `/sviluppa` ogni 2-3 ore; se i limiti di utilizzo sono esauriti il giro si ferma e il successivo riprende.
