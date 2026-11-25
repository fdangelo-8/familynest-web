# #196 · F2 Token e font · dettagli del requisito

Requisito e criteri di accettazione (CA) sono nella issue #196. Qui ci sono le tabelle che la issue cita con «§». Se issue e file si contraddicono, vale la issue. Fonte dei valori: `.claude/skills/design-system/riferimento/telefono.md` (colonna «Nuovo valore»), `docs/design/telefono/tokens.md` e `tokens.json`. Dove questo file aggiunge qualcosa che `telefono.md` non dice, lo segna con **(default)** e la domanda è nella issue.

## §1 Font

| Cosa            | Oggi su `main`                                       | Dopo F2                                                                                                                                                      |
| --------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Caricamento     | `Parkinsans` e `Host_Grotesk` da `next/font/google`  | solo `Figtree` da `next/font/google`, font variabile (senza `weight`), un file per sottoinsieme                                                              |
| Opzioni         | `subsets: ["latin", "latin-ext"]`, `display: "swap"` | `subsets: ["latin", "latin-ext"]`, `display: "swap"`, `variable: "--font-figtree"`; `adjustFontFallback` e `preload` lasciati al valore predefinito (attivi) |
| `--font-titoli` | `var(--font-parkinsans), "Parkinsans", …`            | `var(--font-figtree), ui-sans-serif, system-ui, sans-serif`                                                                                                  |
| `--font-testo`  | `var(--font-host-grotesk), "Host Grotesk", …`        | uguale a `--font-titoli` (si tengono i due nomi, così le classi esistenti seguono)                                                                           |
| `--font-codice` | `ui-monospace, "SF Mono", Menlo, monospace`          | invariato                                                                                                                                                    |
| Fraunces        | —                                                    | **non** in F2: arriva con le pagine delle Ricette (`--font-ricette`)                                                                                         |

Figtree ha le misure nel file `capsize-font-metrics.json` di Next 16.4.6: il font di riserva con `size-adjust` («Figtree Fallback») viene generato da solo. Per Parkinsans mancavano, da qui l'avviso «Failed to find font override values» e il cambio di misura dopo il primo render.

## §2 Pesi

Solo 400, 600, 700. Si tengono i nomi, cambia il valore.

| Token              | Oggi | Dopo F2 | Perché                                                          |
| ------------------ | ---- | ------- | --------------------------------------------------------------- |
| `--weight-sottile` | 300  | 400     | il 300 sparisce; resta su `.t-display`, `.t-frase`, `.t-numero` |
| `--weight-normale` | 400  | 400     |                                                                 |
| `--weight-medio`   | 500  | 400     | `.t-nota` (aiuto ed errore del campo) è 400 nel design nuovo    |
| `--weight-semi`    | 600  | 600     |                                                                 |
| `--weight-forte`   | 650  | 600     | righe e titoli di riga sono 600; il 650 sparisce **(default)**  |
| `--weight-pieno`   | 700  | 700     |                                                                 |

Classi del testo in `src/app/components.css` (solo queste due righe, il resto delle classi resta):

- `.t-titolo-pagina`: `font-weight: var(--weight-pieno)` (titolo pagina 700 in `telefono.md`).
- `.t-etichetta`: `font-weight: var(--weight-normale)` (etichetta 400). Il maiuscolo, dove c'è, lo toglie F4a.

## §3 Testo (rem, regole della #313 invariate)

| Token                                  | Oggi       | Dopo F2     |
| -------------------------------------- | ---------- | ----------- |
| `--text-titolo-pagina-size`            | `2rem`     | `1.875rem`  |
| `--text-titolo-pagina-line`            | `2.25rem`  | `2.25rem`   |
| `--text-titolo-pagina-tracking`        | `-0.03em`  | `-0.02em`   |
| `--text-titolo-sezione-size` nuovo     | —          | `1.3125rem` |
| `--text-titolo-sezione-line` nuovo     | —          | `1.6875rem` |
| `--text-titolo-sezione-tracking` nuovo | —          | `-0.012em`  |
| `--text-sottotitolo-size` nuovo        | —          | `1.0625rem` |
| `--text-sottotitolo-line` nuovo        | —          | `1.5625rem` |
| `--text-titolo-barra-size` nuovo       | —          | `1rem`      |
| `--text-titolo-barra-line` nuovo       | —          | `1.375rem`  |
| `--text-controllo-size`                | `0.875rem` | `1rem`      |
| `--text-controllo-line`                | `1.25rem`  | `1.375rem`  |
| `--text-etichetta-tracking`            | `0.02em`   | `0`         |
| `--text-tag-size` nuovo                | —          | `0.75rem`   |
| `--text-tag-line` nuovo                | —          | `1rem`      |

Invariati: tutti gli altri `--text-*` (corpo, nota, etichetta size/line, display, ore e numeri di Oggi, cella, micro, misure da computer, `--text-avatar-*`). La scala del corpo e i testi grandi di Oggi mancano nel passaggio di Fable: restano come sono.

## §4 Colori dell'interfaccia

Si applica alla lettera la tabella «Colori» di `telefono.md`: 15 token cambiano valore e 13 nascono. Riassunto dei nomi (valori in `telefono.md`):

- **Cambiano valore:** `--color-inchiostro`, `--color-inchiostro-2`, `--color-inchiostro-3`, `--color-carta` (`#FFFFFF`), `--color-carta-2`, `--color-filo`, `--color-filo-2`, `--color-filo-campo` (`#7F9092`), `--color-allerta`, `--color-ok`, `--color-insieme`, `--color-insieme-testo`, `--color-insieme-bordo`, `--color-ombra`, `--color-ombra-forte`. `--color-superficie` resta `#FFFFFF`.
- **Nuovi:** `--color-inchiostro-2-fondo`, `--color-azione`, `--color-azione-premuto`, `--color-fondo-app`, `--color-premuto`, `--color-scelta-tenue`, `--color-anello-scelta`, `--color-filo-tenue`, `--color-filo-barra`, `--color-allerta-fondo`, `--color-scaduto`, `--color-adesso`, `--color-adesso-tinta`.
- **Nuovo (default, domanda 5 della specifica grafica di A4):** `--color-corsia-vuota: #EEF1EF`, barra vuota delle corsie.
- **Scena di Oggi, nuovi:** `--color-scena-mattino-cielo #BFE3F7`, `--color-scena-mattino-casa-1 #7DBFC2`, `--color-scena-mattino-casa-2 #4E9DA6`, `--color-scena-mattino-sole #FFB84D`; `--color-scena-pomeriggio-cielo #7FC4F2`, `-casa-1 #57B0B5`, `-casa-2 #2F8F99`, `-sole #FFF1A8`; `--color-scena-sera-cielo #35539E`, `-casa-1 #2A7F80`, `-casa-2 #0C4A52`, `-sole #FF9E3C`; `--color-scena-tetto #0F3D44`.
- **Invariati:** `--color-superficie`, `--color-notte*`, `--color-latte*`, `--color-occupato-*`, `--color-info` (anello di focus), `--color-avviso`, `--color-allerta-scuro`, `--color-bianco`, `--color-marchio-*`, `--color-velo`, `--color-ombra-adesivo`, `--color-avatar-su-colore`.

## §5 Colori delle persone

I codici dell'enum `member_color` (`supabase/migrations/20261022194748_enum_types.sql` e `20261029160826_member_color_ten_values.sql`) non cambiano e non si migra nulla. Cambia solo la tinta che il codice mostra.

| Codice (database)            | Tinta    | `--color-membro-<tinta>`          | `-tinta` (fondo tenue)  | `-corsia` (barra, ≥ 3:1)     | Iniziale   | Nome accessibile **(default)** |
| ---------------------------- | -------- | --------------------------------- | ----------------------- | ---------------------------- | ---------- | ------------------------------ |
| `pomodoro`                   | corallo  | `#F2765C`                         | `#FDEAE5`               | `#EF5839`                    | inchiostro | Corallo                        |
| `glicine`                    | glicine  | `#B9A2EC`                         | `#F2ECFC`               | `#9978E3`                    | inchiostro | Glicine                        |
| `salvia`                     | menta    | `#8FD0A8`                         | `#E7F5EC`               | `#419A63`                    | inchiostro | Menta                          |
| `cobalto`                    | blu      | `#3F6FE0`                         | `#E5ECFC`               | `#3F6FE0` (già ≥ 3:1)        | **bianco** | Blu                            |
| `zafferano`                  | ambra    | `#E8A15C`                         | `#FCEEDD`               | `#CE741D`                    | inchiostro | Ambra                          |
| `lampone`                    | sabbia   | `#D9B88F`                         | manca: tinta del neutro | `#B5803D`                    | inchiostro | Sabbia                         |
| `ceruleo`                    | azzurro  | `#7CC7E0`                         | manca: tinta del neutro | `#2C95B8`                    | inchiostro | Azzurro                        |
| `peonia`                     | rosa     | `#F0A3C0`                         | manca: tinta del neutro | `#E4588D`                    | inchiostro | Rosa                           |
| `basilico`                   | ardesia  | `#6B7A90` → `#68778D` (domanda 2) | manca: tinta del neutro | uguale al colore (già ≥ 3:1) | **bianco** | Ardesia                        |
| `cannella`                   | cannella | `#AF8273`                         | `#F5ECE8`               | `#AD7F70`                    | inchiostro | Cannella                       |
| — (solo interfaccia)         | neutro   | `#B4BFBC`                         | `#F1F4F2`               | `#7C8F8A`                    | inchiostro | —                              |
| `insieme` (solo interfaccia) | —        | `--color-insieme`                 | —                       | —                            | inchiostro | —                              |

**Come sono calcolate le tinte delle corsie** (decisione di Francesco del 25/11 su #196): stessa tonalità e saturazione del colore (HSL), luminosità abbassata a passi di 0,5% finché il contrasto WCAG è almeno 3:1 sia sul bianco sia su `--color-corsia-vuota` (`#EEF1EF`, il più scuro dei fondi delle corsie; vale quindi anche su `--color-carta-2` della colonna del giorno scelto). Se il colore arriva già a 3:1, la corsia usa il colore stesso. Risultati: da 3,00:1 a 3,06:1 su `#EEF1EF`, da 3,41:1 a 3,48:1 sul bianco, tonalità spostata al massimo di 0,6 gradi. Il designer le conferma nella sua specifica; se ne cambia una, deve restare sopra 3:1 (CA-22 della issue).

Contrasti delle iniziali (colore pieno con l'iniziale sopra): corallo 5,64; glicine 7,08; menta 8,82; blu (bianco) 4,60; ambra 7,27; sabbia 8,41; azzurro 8,33; rosa 8,03; ardesia (bianco) 4,36 con `#6B7A90`, 4,55 con `#68778D`; cannella 4,70; neutro 8,34.

**Classi** in `src/app/components.css` (sostituiscono le dieci `.membro-<codice>` di oggi, nei due punti dove sono):

```css
.membro-pomodoro {
  --c: var(--color-membro-corallo);
  --c-tinta: var(--color-membro-corallo-tinta);
  --c-corsia: var(--color-membro-corallo-corsia);
  --c-iniziale: var(--color-inchiostro);
}
```

Una per codice, più `.membro-neutro` e `.membro-insieme` (`--c: var(--color-insieme)`, `--c-iniziale: var(--color-inchiostro)`). Per `lampone`, `ceruleo`, `peonia`, `basilico`: `--c-tinta: var(--color-membro-neutro-tinta)` (domanda 3). `.avatar` usa `color: var(--c-iniziale)` al posto di `var(--color-inchiostro)`.

**Modulo `src/lib/member-colors.ts`** (unica fonte della corrispondenza codice → tinta; nessun altro file la riscrive):

- `MEMBER_COLOR_CODES`: i 10 codici nell'ordine di oggi (`pomodoro`, `glicine`, `salvia`, `cobalto`, `zafferano`, `lampone`, `ceruleo`, `peonia`, `basilico`, `cannella`), con tipo uguale all'enum `member_color` di `src/types/database.ts`.
- `MEMBER_COLOR_SHADES`: codice → tinta (tabella sopra).
- `memberColorClass(code | "insieme" | "neutro")` → `"membro-<code>"`.
- `memberColorLabel(code)` → nome accessibile, letto da `src/lib/i18n/messages` (F1).
- `Avatar` e `ColorChoice` importano da qui; `MEMBER_COLORS`, `MemberColor` (da `Avatar`) e `memberColorLabel` (da `ColorChoice`) restano esportati con lo stesso nome, così le pagine non cambiano. Il tipo `MemberColor` non si allarga al neutro in F2 (lo userà F4b).

Spariscono dai token: `--color-membro-pomodoro`, `-salvia`, `-cobalto`, `-zafferano`, `-lampone`, `-ceruleo`, `-peonia`, `-basilico`. Restano (con il valore nuovo) `--color-membro-glicine` e `--color-membro-cannella`.

## §6 Misure, raggi, ombre, movimento, collegamenti

| Token                         | Oggi                             | Dopo F2                                                                  |
| ----------------------------- | -------------------------------- | ------------------------------------------------------------------------ |
| `--grid-margine-mobile`       | `20px`                           | `24px` **(default, domanda 7)**                                          |
| `--size-etichetta`            | `28px`                           | `24px`                                                                   |
| `--size-campo` nuovo          | —                                | `56px`                                                                   |
| `--size-barra-alta` nuovo     | —                                | `56px` (`--size-barra` resta 64 fino a F5)                               |
| `--space-riga` nuovo          | —                                | `13px`                                                                   |
| `--space-link` nuovo          | —                                | `3px`                                                                    |
| `--border-link` nuovo         | —                                | `1.5px`                                                                  |
| `--radius-xl`                 | `24px`                           | `20px`                                                                   |
| `--radius-pulsante` nuovo     | —                                | `14px`                                                                   |
| `--radius-capsula` nuovo      | —                                | `28px`                                                                   |
| `--shadow-foglio`             | `0 -8px 32px var(--color-ombra)` | `0 -4px 16px -2px var(--color-ombra-forte)`                              |
| `--shadow-menu` nuovo         | —                                | `0 1px 2px var(--color-ombra), 0 8px 20px -6px var(--color-ombra-forte)` |
| `--shadow-disco` nuovo        | —                                | `0 2px 6px -1px var(--color-ombra-forte)`                                |
| `--shadow-controllo` nuovo    | —                                | `0 1px 3px var(--color-ombra)`                                           |
| `--curva-entrata` nuovo       | —                                | `cubic-bezier(0.22, 1, 0.36, 1)`                                         |
| `--curva-scatto` nuovo        | —                                | `cubic-bezier(0.16, 1, 0.3, 1)`                                          |
| `--durata-apertura` nuovo     | —                                | `420ms`                                                                  |
| `--durata-barra` nuovo        | —                                | `520ms`                                                                  |
| `--durata-splash-breve` nuovo | —                                | `1400ms`                                                                 |
| `--durata-splash-lungo` nuovo | —                                | `2900ms`                                                                 |

Invariati: scala `--space-*`, `--size-tocco`, `--size-azione`, `--size-chip`, `--size-riga-alta`, `--size-avatar-*`, gli altri raggi, `--shadow-scheda`, `--shadow-barra`, `--shadow-modale`, `--shadow-adesivo`, `--durata-rapida`, `--durata-normale`, `--durata-ampia`, `--curva`, z-index, opacità. Nessuna regola nuova per il movimento ridotto: quella di oggi resta.

## §7 Contrasti verificati dal test (formula WCAG 2.1 sui valori dei token)

| Primo piano                     | Fondo                                                           | Minimo |
| ------------------------------- | --------------------------------------------------------------- | ------ |
| `--color-inchiostro`            | `--color-carta`, `--color-carta-2`, `--color-fondo-app`         | 4,5    |
| `--color-inchiostro-2`          | `--color-carta`, `--color-carta-2`                              | 4,5    |
| `--color-inchiostro-2-fondo`    | `--color-fondo-app`                                             | 4,5    |
| `--color-bianco`                | `--color-azione`, `--color-azione-premuto`, `--color-allerta`   | 4,5    |
| `--color-allerta`               | `--color-superficie`, `--color-allerta-fondo`                   | 4,5    |
| `--color-ok`, `--color-scaduto` | `--color-superficie`                                            | 4,5    |
| `--color-insieme-testo`         | `--color-insieme`                                               | 4,5    |
| `--color-inchiostro`            | `--color-adesso`, `--color-adesso-tinta`                        | 4,5    |
| `--color-filo-campo`            | `--color-superficie`, `--color-carta-2`, `--color-fondo-app`    | 3      |
| `--color-info`                  | `--color-carta`, `--color-carta-2`, `--color-fondo-app`         | 3      |
| iniziale (`--c-iniziale`)       | `--c` di ogni codice e del neutro                               | 4,5    |
| `--c-corsia`                    | `--color-superficie`, `--color-carta-2`, `--color-corsia-vuota` | 3      |

Valori attesi (calcolati il 25/11): inchiostro 15,76 / 14,51 / 14,54; secondario 5,86 / 5,40; secondario sul fondo 6,23; bianco su azione 11,86, su premuto 14,62, su allerta 6,54; allerta 6,54 / 5,78; ok 6,49; scaduto 6,69; Liberi insieme 9,29; inchiostro su adesso 10,02 e 13,69; bordo del campo 3,33 / 3,07 / 3,07; focus 6,34 / 5,84 / 5,85.

Fuori dal test, perché decorativi per regola: `--color-inchiostro-3` (2,98:1), `--color-filo-tenue` (2,01:1), `--color-filo`, `--color-filo-2`.

**Interruttore spento.** Oggi la pista è `--color-filo-2` (`#CFD1CA`, pallino bianco 1,54:1); dopo F2 `#C3CCC9` (1,64:1): sotto 3:1 come prima, non peggiora. Si risolve in F4a (#503), dove l'interruttore si ridisegna; il designer lì propone come distinguere lo spento (per esempio bordo `--color-filo-campo`, 3,33:1).

## §8 Test da toccare nella stessa PR

| File                                                                                                                                                                         | Chi               | Cosa                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/e2e/design-system.spec.ts` CA-1                                                                                                                                       | tester funzionale | riferimento `docs/agenti/design/token.css` al posto di `docs/mockup/tokens.css`; le liste #52, #74, #313 spariscono (i valori sono nel file) |
| `tests/e2e/design-system.spec.ts` CA-2…CA-4                                                                                                                                  | tester funzionale | Figtree al posto di Parkinsans e Host Grotesk; `.t-display` 400                                                                              |
| `tests/e2e/design-system-static.spec.ts`                                                                                                                                     | tester funzionale | il suo CA-10 resta; si aggiungono i pesi (CA-12 della issue) e l'unicità della corrispondenza (CA-15)                                        |
| `tests/e2e/colori-membri.spec.ts` CA-6, CA-9                                                                                                                                 | tester funzionale | valori e classi nuovi                                                                                                                        |
| `tests/e2e/componenti-casa.spec.ts`                                                                                                                                          | tester funzionale | `INK` diventa il nuovo inchiostro                                                                                                            |
| test con «Pomodoro», «Salvia», … nei nomi accessibili (162 righe in 15 file: `grep -rn -E "Pomodoro\|Salvia\|Cobalto\|Zafferano\|Lampone\|Peonia\|Ceruleo\|Basilico" tests`) | tester funzionale | nomi nuovi (domanda 6)                                                                                                                       |
| commenti «Parkinsans is about 1.42 em» in `tests/a11y/schermi-*.spec.ts`                                                                                                     | tester visivo     | ricontrollare la misura con Figtree                                                                                                          |
| tutti i riferimenti `tests/visual/**`                                                                                                                                        | tester visivo     | rigenerati con `visual-baseline`                                                                                                             |

## §9 Documenti da allineare (designer, PR `docs/*` prima o insieme)

- `.claude/skills/design-system/SKILL.md` (sezione font) e `riferimento/telefono.md`: «Stato del codice», nota «Spariscono lampone e basilico … migrazione» da sostituire con la corrispondenza di §5 (default 4 del piano #501), risposte alle domande «Da chiarire».
- `docs/agenti/design/token.css`: diventa la copia esatta del `:root` di `src/app/globals.css`, con l'intestazione aggiornata (lo aggiorna lo sviluppatore nella PR `shared/*`, perché il test CA-9 lo confronta).
