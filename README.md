# FamilyNest

Organizer familiare web: calendario condiviso, profili dei figli, attività e liste. Un solo codice, due layout responsive (mobile e desktop).

Stack: Next.js (App Router) + TypeScript strict, CSS proprio con variabili CSS (niente Tailwind), Supabase, Playwright.

## Requisiti

- Node.js 22 (vedi `.nvmrc`)
- npm
- Un progetto Supabase (`yksosqvugiempsldejyt`) e le relative chiavi

## Avvio

```bash
nvm use
npm ci
cp .env.example .env.local   # poi compila i valori
npx playwright install chromium   # solo per i test
npm run dev
```

L'app parte su http://localhost:3000. Il progetto compila anche senza variabili d'ambiente: l'errore compare solo quando un client Supabase viene creato.

## Script

| Script                    | Cosa fa                                                  |
| ------------------------- | -------------------------------------------------------- |
| `dev`, `build`, `start`   | Standard Next.js                                         |
| `lint`                    | ESLint su tutto il progetto, senza warning ammessi       |
| `typecheck`               | `tsc --noEmit`                                           |
| `format` / `format:check` | Prettier (scrive / verifica)                             |
| `test:e2e`                | Playwright, cartella `tests/e2e`                         |
| `test:visual`             | Playwright, cartella `tests/visual`                      |
| `test:visual:update`      | Come sopra, aggiornando gli screenshot di riferimento    |
| `test:a11y`               | Playwright + axe, cartella `tests/a11y`                  |
| `test`                    | Tutte e tre le suite                                     |
| `check`                   | `lint` + `typecheck` + `format:check` (controllo veloce) |
| `db:types`                | Genera i tipi Supabase in `src/types/database.ts`        |

Con `PLAYWRIGHT_BASE_URL` impostata i test girano contro quell'URL; altrimenti Playwright costruisce e avvia l'app in locale.

Gli screenshot di riferimento vanno rigenerati con lo stesso container Playwright usato in CI (`mcr.microsoft.com/playwright`) se il rendering differisce.

## Struttura

```
src/
  app/            layout, pagine, globals.css (token del design system)
  components/     componenti React
  lib/
    supabase/     client.ts (browser), server.ts (server), admin.ts (solo server)
    env.ts        lettura e validazione variabili d'ambiente
  types/          tipi (database.ts generato da Supabase)
supabase/         config e migrazioni
tests/            e2e, visual, a11y, fixtures
docs/mockup/      mockup di design
.github/workflows CI (check, build, test)
```
