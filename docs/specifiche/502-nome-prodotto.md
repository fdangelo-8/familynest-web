# #502 · F3 Nome del prodotto da un punto solo · dettagli del requisito

Requisito e criteri di accettazione (CA) sono nella issue #502. Qui ci sono gli elenchi che la issue cita con «§». Se issue e file si contraddicono, vale la issue. Fonti: `docs/design/telefono/LEGGIMI.md` («Regole fisse»), `docs/design/computer/LEGGIMI.md` («Regole fisse»), tavola `docs/design/telefono/componenti/tavola-p5-k3-*` (riga «Il nome, in un punto solo»), `decisioni-fable.md` risposte 2, 47, 74, 136, 140. Le righe indicate sono quelle di `main` al 26/11/2026: lo sviluppatore cerca di nuovo prima di cominciare (`grep -rn "FamilyNest" src/`).

## §1 Le parti del nome

| Parte      | Valore segnaposto                                  | Dove si usa                                                                |
| ---------- | -------------------------------------------------- | -------------------------------------------------------------------------- |
| `full`     | `FamilyNest`                                       | nome nei testi, titoli del browser, metadata                               |
| `short`    | `Nest`                                             | la casa: «Il tuo Nest», «Chiedi a Nest», «Energia di Nest», «Nest ha …»    |
| `wordmark` | `family` (peso 400) + `nest` (peso 700), minuscolo | marchio scritto (risposta 2; segnaposto 5A: «qui c'è solo la scritta», k3) |
| `slug`     | `familynest`                                       | nomi dei file scaricati                                                    |

Il segno grafico del marchio (splash, `splash-p9/sp1-02`) **non** è in F3: arriva con F6 (#507) quando il designer ne dà il disegno. Formule nei messaggi (`src/lib/i18n/messages/it.ts`), segnaposti `{app}` (= `full`) e `{nest}` (= `short`):

| Chiave (**default**)   | Testo                                     |
| ---------------------- | ----------------------------------------- |
| `brand.description`    | `{app} — l'organizer per la tua famiglia` |
| `brand.yourNest`       | `Il tuo {nest}`                           |
| `brand.yourNestLower`  | `il tuo {nest}`                           |
| `brand.askNest`        | `Chiedi a {nest}`                         |
| `brand.nestEnergy`     | `Energia di {nest}`                       |
| `brand.titleSeparator` | `·` (tra le parti del titolo del browser) |

I testi delle pagine di §2 diventano messaggi con `{app}` o `{nest}` nello stesso file (una chiave per testo, sotto un gruppo col nome della cartella, per esempio `calendariCollegati.intro`). Il testo mostrato resta identico carattere per carattere.

## §2 Testi visibili che cambiano sorgente (il testo mostrato non cambia)

| File                                                   | Righe                 | Cosa diventa                                                                                                                |
| ------------------------------------------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/components/calendari-collegati/CalendarSheet.tsx` | 142, 226, 234         | messaggi con `{app}`                                                                                                        |
| `src/components/calendari-collegati/CalendarsView.tsx` | 457, 464, 499, 564    | messaggi con `{app}`                                                                                                        |
| `src/app/(app)/calendari-collegati/loading.tsx`        | 20                    | stesso messaggio della riga 499 di `CalendarsView`                                                                          |
| `src/components/ui/MemberSheet/MemberSheet.tsx`        | 290                   | messaggio con `{app}`                                                                                                       |
| `src/components/aggiungi/labels.ts`                    | 22, 25                | messaggi con `{app}`                                                                                                        |
| `src/components/desideri/PublicWishlistPage.tsx`       | 332                   | messaggio con `{app}`                                                                                                       |
| `src/components/onboarding/CalendarStep.tsx`           | 71                    | messaggio con `{app}`                                                                                                       |
| `src/components/profilo/DangerZone.tsx`                | 12                    | messaggio con `{app}` («Uscire da FamilyNest?» è l'uscita dall'account, non dalla casa)                                     |
| `src/components/invito/InviteEnded.tsx`                | 14, 15                | messaggi con `{app}`                                                                                                        |
| `src/components/accesso/AccessScreen.tsx`              | 495, 560              | messaggi con `{app}`                                                                                                        |
| `src/components/accesso/ConfirmLinkScreen.tsx`         | 27                    | messaggio con `{app}`                                                                                                       |
| `src/components/accesso/ForgotScreen.tsx`              | 126                   | messaggio con `{app}`                                                                                                       |
| `src/components/accesso/LegalPage.tsx`                 | 27                    | `BRAND.full`                                                                                                                |
| `src/app/termini/page.tsx`, `src/app/privacy/page.tsx` | 14                    | messaggi con `{app}`                                                                                                        |
| `src/app/fornitore-finto/[provider]/page.tsx`          | 73                    | messaggio con `{app}`                                                                                                       |
| `src/app/design-system/Gallery.tsx`                    | 400, 2389, 2405, 2628 | stessi messaggi delle pagine che l'esempio copia                                                                            |
| `src/components/accesso/parts.tsx`                     | 7–20 (`Brand`)        | il componente unico `Brand` (scritta); `parts.tsx` lo riesporta, oppure i 5 file che lo importano passano al percorso nuovo |
| `src/components/ui/AppFrame/TopNav.tsx`                | 25                    | `<Brand />` (scritta), nome accessibile «FamilyNest»                                                                        |
| `src/components/ui/AppFrame/SettingsMenu.tsx`          | 34                    | `brand.yourNest`                                                                                                            |
| `src/components/ui/NestSquare/NestSquare.tsx`          | 12                    | messaggio con `{nest}` («Apri il tuo {nest}: …»)                                                                            |
| `src/components/onboarding/OnboardingStep.tsx`         | 19, 21                | messaggi con `{nest}` («… il tuo {nest} …»)                                                                                 |

Titoli del browser e metadata (stesso valore di oggi, composti con `pageTitle(...)` di `src/lib/brand.ts`): `src/app/layout.tsx` (24 `title`, 25 `description`, più `applicationName`), `src/lib/app-routes.ts` (righe 271–377, 16 `browserTitle`; riga 334 `title` = `brand.yourNest`), e i `metadata.title` di: `design-system/page.tsx`, `design-system/membri/page.tsx`, `termini`, `privacy`, `fornitore-finto/[provider]`, `(app)/figli/[id]`, `(app)/figli/[id]/lista-desideri`, `(app)/esplora`, `(app)/esplora/[spazio]` (anche il ripiego senza spazio = `BRAND.full`), `(app)/casa/spesa`, `(app)/casa/scadenze`, `(app)/casa/da-fare`, `(app)/membri/[id]`, `(app)/impegni/[id]`, `desideri/[codice]`, le 5 pagine di `onboarding/`, `invito`, `invito/colore`, `accesso/layout.tsx`, `accesso/mail-confermata`, `accesso/conferma-recupero`, `accesso/conferma-mail`.

Derivati dal nome, non testi:

| File                                  | Riga | Diventa                                                     |
| ------------------------------------- | ---- | ----------------------------------------------------------- |
| `src/components/profilo/save.ts`      | 93   | `` `${BRAND.slug}-i-tuoi-dati.json` ``                      |
| `src/app/(app)/profilo/dati/route.ts` | 51   | `` `${BRAND.slug}-i-tuoi-dati-<data>.json` ``               |
| `src/lib/shop-link.ts`                | 40   | `` `${BRAND.full}Bot/1.0 (lista desideri)` `` (**default**) |

## §3 Identificatori tecnici che NON cambiano

Cambiarli farebbe perdere dati salvati, sessioni o credenziali cifrate. Restano scritti a mano, byte per byte, e il test di CA-2 li controlla:

| File                                      | Valore                                                            |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `src/components/aggiungi/coordination.ts` | `familynest:lists-changed`, `familynest:lists-refreshed`          |
| `src/components/ricerca/from-app.ts`      | `familynest:search-from-app`                                      |
| `src/components/membri/texts.ts`          | `familynest:focus-invite`                                         |
| `src/lib/public-wishlist.ts`              | `familynest.wishlist.giver-key`, `familynest.wishlist.giver-name` |
| `src/lib/events-changed.ts`               | `familynest:events-changed`                                       |
| `src/lib/auth/recovery-cookie.ts`         | `familynest_recupero`                                             |
| `src/lib/invitations.ts`                  | `familynest_invito`                                               |
| `src/lib/lens.ts`                         | `familynest.lens`                                                 |
| `src/lib/recent-searches.ts`              | `familynest:recent-searches:`                                     |
| `src/lib/calendar-sync/oauth.ts`          | `familynest:calendar-oauth-cookie`                                |
| `src/lib/calendar-sync/crypto.ts`         | `familynest:calendar-credentials:v`                               |
| `src/lib/calendar-sync/fake-provider.ts`  | `familynest.calendar-fake-provider`                               |

Nessuno di questi usa `BRAND.slug`: un commento in `src/lib/brand.ts` lo dice. I commenti del codice e delle migrazioni che nominano FamilyNest restano (non si vedono).

## §4 Fuori da `src/`: controllati, non cambiati

`supabase/config.toml` (righe 268 e 272, oggetti delle mail) e `supabase/templates/conferma.html`, `nuova-password.html` contengono «FamilyNest» e non possono leggere `brand.ts`. F3 non li tocca (sono dell'architetto dati; le mail passano a F9 #509). Il test di CA-13 verifica che contengano `BRAND.full`: quando il nome cambia, il test fallisce e ricorda la PR `db/*`. Oggi **non** serve una PR `db/*`.

Manifest: in `main` non esiste (`public/` assente). Lo crea F7 (#148), con `name` e `short_name` presi da `src/lib/brand.ts` (nota da riportare in #148).

## §5 «Nest» nelle pagine non ancora riallineate

`main` ha circa 75 righe di codice con la parola «Nest» in un testo visibile (per esempio «Tutto il Nest», «Cerca nel Nest», la lente «Nest»). F3 non le riscrive: ogni pagina le porta a `{nest}` (o a «casa», risposta 136) quando viene riallineata (A1–A25). Perché non tornino a crescere, F3 aggiunge `tests/fixtures/brand-nest-baseline.json`: per ogni file di `src/` il numero di stringhe o testi JSX che contengono la parola intera `Nest`, al momento del merge. Il test di CA-12 fallisce se un file supera il suo numero o se un file nuovo ne contiene; quando una pagina li toglie, la stessa PR abbassa il numero.

## §6 Test da toccare

Il testo mostrato non cambia: i test e2e esistenti che cercano «FamilyNest» restano validi. Cambiano i riferimenti visivi dove compare il marchio (`tests/visual/login.spec.ts`, `pezzi-accesso-461.spec.ts`, `onboarding-persone.spec.ts`, `smoke.spec.ts` a 1280 per la barra in alto, e gli esempi della galleria): li rigenera il tester visivo. I test nuovi possono importare `BRAND` da `src/lib/brand.ts` invece di scrivere il nome.
