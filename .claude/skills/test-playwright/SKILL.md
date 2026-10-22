---
name: test-playwright
description: Convenzioni FamilyNest per scrivere test Playwright end-to-end, visivi e di accessibilità, con utenti di test e screenshot di riferimento. Usala ogni volta che scrivi, aggiorni o esegui test nella cartella tests/.
---

# Test Playwright di FamilyNest

## Struttura

```
tests/
  e2e/<pagina>.spec.ts      un test per ogni criterio di accettazione
  visual/<pagina>.spec.ts   screenshot degli stati principali
  a11y/<pagina>.spec.ts     controllo axe di ogni stato
  fixtures/                 utenti e dati di test, helper di login
  visual/__screenshots__/   riferimenti approvati
```

Progetti Playwright già configurati: `desktop` (1280×800) e `mobile` (390×844). Ogni test gira su entrambi salvo motivo scritto.

## Test end-to-end

- Nome del test = codice del criterio: `test('CA-3: aggiungere un evento lo mostra nel giorno giusto', ...)`.
- Un CA → almeno un test. Se un CA non si può automatizzare, scrivilo nella PR con il motivo.
- Selettori in quest'ordine: `getByRole` con nome accessibile → `getByLabel` → `getByText` per contenuti → `getByTestId` solo se non c'è alternativa.
- Mai attese fisse (`waitForTimeout`): usa le asserzioni web-first (`await expect(locator).toBeVisible()`).
- Ogni test crea e pulisce i propri dati, così i test sono indipendenti e ripetibili.
- Usa gli utenti di test delle fixture (nucleo A e nucleo B), mai account reali. Le credenziali arrivano solo da variabili d'ambiente.
- Verifica sempre almeno un caso negativo per i dati: l'utente del nucleo B non vede ciò che crea il nucleo A.

## Test visivi

- Screenshot dell'intera pagina per ogni stato rilevante: normale, vuoto, errore (e altri stati della specifica).
- Nascondi o blocca ciò che cambia da solo: date correnti (orologio fissato con `page.clock`), avatar casuali, animazioni.
- I riferimenti si generano **solo** nello stesso container usato dalla CI, altrimenti i pixel differiscono. Se non puoi, lascia che la CI fallisca sul primo confronto, scarica l'artifact e usa quelle immagini come riferimento, segnalandolo nella PR.
- Mai aggiornare i riferimenti di altre pagine per far passare la tua: se un'altra pagina cambia aspetto è una regressione da segnalare.

## Confronto con il mockup (tester visivo)

Prima di creare i riferimenti, confronta lo screenshot della pagina con il mockup in `docs/mockup/` aperto nello stesso viewport. Controlla: colori (token), font e pesi, dimensioni dei testi, spaziature, allineamenti, ordine degli elementi, testi parola per parola, icone. Elenca ogni differenza con lo screenshot affiancato.

## Accessibilità

```ts
const results = await new AxeBuilder({ page }).analyze();
expect(results.violations.filter(v => ['serious','critical'].includes(v.impact ?? ''))).toEqual([]);
```

Più controlli manuali: navigazione completa da tastiera, focus visibile, etichette dei campi, area di tocco di almeno 44×44 px su mobile.

## Esecuzione

```bash
npm run test:e2e -- tests/e2e/<pagina>.spec.ts
npm run test:visual -- tests/visual/<pagina>.spec.ts
npm run test:a11y
npm run test          # suite completa prima di dare l'esito
```

Contro la preview Vercel: `PLAYWRIGHT_BASE_URL=<url-preview> npm run test:e2e`.

Per tecniche avanzate di interazione con il browser consulta `webapp-testing`; in caso di conflitto valgono queste regole.
