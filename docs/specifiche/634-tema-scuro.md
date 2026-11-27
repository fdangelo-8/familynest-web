# #634 · Tema scuro: la tavolozza completa nei token · specifica grafica

Requisito e criteri di accettazione (CA-1–CA-28) sono nel commento dell'analista nella issue #634. Questo file è la specifica del designer: la tabella definitiva dei ruoli, le regole di `src/app/components.css` da cambiare, la correzione del testo secondario sul verde, il pallino non scelto, il gancio per scena e splash e i contrasti verificati. Se issue e file si contraddicono, vale la issue; dove questo file aggiunge qualcosa al requisito è segnato **(designer)**.

Fonti: `docs/design/tavolozza.md` e `tavolozza.json` (73 ruoli), `docs/design/tablet/decisioni.md` (Passo 17: barretta di Tommaso, 2 ruoli dei Piani), `docs/design/passi-12-16/regole-tema-scuro.md`, `docs/design/computer/tokens-computer.md`, skill `design-system` (`riferimento/token.md`, `computer.md`), `src/app/globals.css` e `src/app/components.css` su `origin/main` (29bce187; i numeri di riga sono di quel commit). Contrasti calcolati con la formula WCAG 2.1 sui valori della tabella §1.

## §1 Tabella definitiva: ruolo → token → chiaro → scuro (75 ruoli)

`*` = token nuovo. «uguale» = stesso valore nei due temi (`uguale_nei_due_temi: true` in `tavolozza.json`). Colonna «Oggi»: valore chiaro attuale in `globals.css`, solo dove cambia; «—» = non cambia o il token non c'è ancora.

**Confronto con `docs/design/`.** I 73 ruoli di `tavolozza.json` coincidono uno per uno con le tabelle di `tavolozza.md` §1 (chiaro e scuro). I 2 ruoli dei Piani vengono da `tablet/decisioni.md` e mancano in `tavolozza.json`: li aggiunge la PR (decisione 14 dell'analista). Scostamenti voluti, già decisi: barretta di Tommaso al buio #4E7BE2 e non #3F6FE0 del foglio di stile del canvas (Passo 17); ardesia #68778D al posto di #6B7A90 (Francesco, 25/11; non è un ruolo, è in §2).

### Fondo e superfici (17)

| Ruolo di Fable     | Token                        | Chiaro                  | Scuro               | Oggi                 |
| ------------------ | ---------------------------- | ----------------------- | ------------------- | -------------------- |
| `fondo`            | `--color-carta`              | `#FFFFFF`               | `#0F1819`           | —                    |
| `sup`              | `--color-superficie`         | `#FFFFFF`               | `#1A2729`           | —                    |
| `basso`            | `--color-carta-2`            | `#F4F6F4`               | `#172224`           | —                    |
| `premuto`          | `--color-premuto`            | `#ECEFEC`               | `#263639`           | —                    |
| `scheletro`        | `--color-scheletro`\*        | `#DCE2DF`               | `#2B3A3C`           | —                    |
| `velo`             | `--color-velo`               | `rgba(16,38,42,.36)`    | `rgba(0,0,0,.62)`   | `rgba(23,24,28,.30)` |
| `ombra`            | `--color-ombra`              | `rgba(16,38,42,.08)`    | `rgba(0,0,0,.4)`    | `rgba(16,38,42,.12)` |
| `ombra2`           | `--color-ombra-forte`        | `rgba(16,38,42,.2)`     | `rgba(0,0,0,.6)`    | —                    |
| `barra`            | `--color-barra`\*            | `rgba(255,255,255,.52)` | `rgba(30,45,48,.9)` | —                    |
| `cielo`            | `--color-cielo`\*            | `#BBE1F4`               | `#12294A`           | —                    |
| `cielo-mezzo`      | `--color-cielo-mezzo`\*      | `#2A7F8E`               | `#0D2238`           | —                    |
| `segnaposto`       | `--color-segnaposto`\*       | `#F1E9DD`               | `#2E2A22`           | —                    |
| `segnaposto-testo` | `--color-segnaposto-testo`\* | `#5B5145`               | `#D9CDB8`           | —                    |
| `idea-1`           | `--color-idea-1`\*           | `#E4EEDD`               | `#24332A`           | —                    |
| `idea-2`           | `--color-idea-2`\*           | `#EFE6F2`               | `#322A38`           | —                    |
| `idea-3`           | `--color-idea-3`\*           | `#F6E4CF`               | `#3A2F22`           | —                    |
| `scena`            | `--color-scena-fondo`\*      | `#DDE9E4`               | `#1D3536`           | —                    |

### Fili (4)

| Ruolo   | Token                | Chiaro    | Scuro     | Oggi      |
| ------- | -------------------- | --------- | --------- | --------- |
| `filo`  | `--color-filo`       | `#E4E8E5` | `#2B3A3C` | —         |
| `filo2` | `--color-filo-2`     | `#C3CCC9` | `#3A4F52` | —         |
| `campo` | `--color-filo-campo` | `#869390` | `#7E9496` | `#7F9092` |
| `fuoco` | `--color-fuoco`\*    | `#0F3D44` | `#F2F7F5` | —         |

### Testo (7)

| Ruolo     | Token                        | Chiaro    | Scuro     | Oggi      |
| --------- | ---------------------------- | --------- | --------- | --------- |
| `testo`   | `--color-inchiostro`         | `#10262A` | `#EAF2EE` | —         |
| `testo-m` | `--color-inchiostro-medio`\* | `#33474B` | `#C9D5D2` | —         |
| `testo2`  | `--color-inchiostro-2`       | `#55686C` | `#A9C0BF` | —         |
| `testo3`  | `--color-inchiostro-3`       | `#8A989A` | `#84999A` | —         |
| `su`      | `--color-latte`              | `#FFFFFF` | uguale    | `#F4F2EC` |
| `su2`     | `--color-latte-2`            | `#D5DEDC` | uguale    | `#B9B5AC` |
| `link`    | `--color-link`\*             | `#0E5A66` | `#7FD3DE` | —         |

### Accento (9)

| Ruolo          | Token                    | Chiaro    | Scuro     | Oggi      |
| -------------- | ------------------------ | --------- | --------- | --------- |
| `pieno`        | `--color-pieno`\*        | `#10262A` | `#1F7D8A` | —         |
| `accento`      | `--color-azione`         | `#0F3D44` | `#1F7D8A` | —         |
| `notte`        | `--color-notte`          | `#0B2A31` | uguale    | `#1B1A17` |
| `logo-a`       | `--color-logo-a`\*       | `#0F3D44` | `#F2F6F3` | —         |
| `logo-b`       | `--color-logo-b`\*       | `#2F8F99` | `#8FD0CB` | —         |
| `logo-a-notte` | `--color-logo-a-notte`\* | `#F2F6F3` | uguale    | —         |
| `logo-b-notte` | `--color-logo-b-notte`\* | `#8FD0CB` | uguale    | —         |
| `fumetto`      | `--color-fumetto`\*      | `#10262A` | `#2F4448` | —         |
| `assistente`   | `--color-assistente`\*   | `#FCE7E0` | `#3B2621` | —         |

### Stati (9)

| Ruolo          | Token                     | Chiaro    | Scuro     | Oggi      |
| -------------- | ------------------------- | --------- | --------- | --------- |
| `errore`       | `--color-allerta`         | `#B3261E` | `#FF9D90` | —         |
| `errore-pieno` | `--color-allerta-pieno`\* | `#B3261E` | `#C4483A` | —         |
| `errore-fondo` | `--color-allerta-fondo`   | `#FCEEEA` | `#3A1E1B` | —         |
| `errore-bordo` | `--color-allerta-bordo`\* | `#E7B9AB` | `#7A3A32` | —         |
| `adesso`       | `--color-adesso`          | `#F6C945` | uguale    | —         |
| `adesso-testo` | `--color-adesso-testo`\*  | `#10262A` | uguale    | —         |
| `liberi`       | `--color-insieme`         | `#FCEFC0` | `#3A3112` | `#FBEAAB` |
| `liberi-barra` | `--color-insieme-bordo`   | `#A38009` | `#E2B93B` | `#E0BE52` |
| `liberi-testo` | `--color-insieme-testo`   | `#4A4630` | `#F1E3A8` | `#4A3906` |

### Persone e corsie (29)

| Ruolo                      | Token                            | Chiaro    | Scuro     | Oggi      |
| -------------------------- | -------------------------------- | --------- | --------- | --------- |
| `marco` (corallo)          | `--color-membro-corallo`         | `#F2765C` | uguale    | —         |
| `marco-barra`              | `--color-membro-corallo-corsia`  | `#D75E45` | `#F2765C` | `#EF5839` |
| `marco-fondo`              | `--color-membro-corallo-tinta`   | `#FDEAE5` | `#452F29` | —         |
| `laura` (glicine)          | `--color-membro-glicine`         | `#B9A2EC` | uguale    | —         |
| `laura-barra`              | `--color-membro-glicine-corsia`  | `#8F78BF` | `#B9A2EC` | `#9978E3` |
| `laura-fondo`              | `--color-membro-glicine-tinta`   | `#F2ECFC` | `#38394C` | —         |
| `sofia` (menta)            | `--color-membro-menta`           | `#8FD0A8` | uguale    | —         |
| `sofia-barra`              | `--color-membro-menta-corsia`    | `#54936E` | `#8FD0A8` | `#419A63` |
| `sofia-fondo`              | `--color-membro-menta-tinta`     | `#E7F5EC` | `#2E443B` | —         |
| `tommaso` (blu)            | `--color-membro-blu`             | `#3F6FE0` | uguale    | —         |
| `tommaso-barra`            | `--color-membro-blu-corsia`      | `#3F6FE0` | `#4E7BE2` | —         |
| `tommaso-fondo`            | `--color-membro-blu-tinta`       | `#E5ECFC` | `#1B2D49` | —         |
| `biscotto` (ambra)         | `--color-membro-ambra`           | `#E8A15C` | uguale    | —         |
| `biscotto-barra`           | `--color-membro-ambra-corsia`    | `#B9762E` | `#E8A15C` | `#CE741D` |
| `biscotto-fondo`           | `--color-membro-ambra-tinta`     | `#FCEEDD` | `#433929` | —         |
| `miele` (cannella)         | `--color-membro-cannella`        | `#AF8273` | uguale    | —         |
| `miele-barra`              | `--color-membro-cannella-corsia` | `#A67A6B` | `#AF8273` | `#AD7F70` |
| `miele-fondo`              | `--color-membro-cannella-tinta`  | `#F5ECE8` | `#35312F` | —         |
| `casa-barra`               | `--color-membro-neutro-corsia`   | `#55686C` | `#A9C0BF` | `#7C8F8A` |
| `casa-fondo`               | `--color-membro-neutro-tinta`    | `#EEF1EF` | `#1E2B2E` | `#F1F4F2` |
| `iniziale`                 | `--color-iniziale`\*             | `#10262A` | uguale    | —         |
| `iniziale-blu`             | `--color-iniziale-blu`\*         | `#FFFFFF` | uguale    | —         |
| `rosa`                     | `--color-membro-rosa`            | `#F0A3C0` | uguale    | —         |
| `nessuno`                  | `--color-nessuno`\*              | `#B4BFBC` | `#5E6F72` | —         |
| `conferma`                 | `--color-conferma`\*             | `#2F8F99` | `#8FD0CB` | —         |
| `conferma-fondo`           | `--color-conferma-fondo`\*       | `#CFE5E1` | `#1F3F42` | —         |
| `aiutante`                 | `--color-aiutante`\*             | `#D5DBD8` | uguale    | —         |
| `piano-icona-1` (Passo 17) | `--color-piano-icona-1`\*        | `#FFFFFF` | `#10262A` | —         |
| `piano-icona-2` (Passo 17) | `--color-piano-icona-2`\*        | `#BFE5E1` | `#0E5A66` | —         |

**Nota sui valori chiari che cambiano** (CA-27). `--color-carta-2` **non** cambia (#F4F6F4 è già il valore di `basso`): va tolto dall'elenco di CA-27. Cambiano: `velo`, `ombra`, `filo-campo`, `notte`, `latte`, `latte-2`, `insieme`, `insieme-bordo`, `insieme-testo`, cinque corsie delle persone, `membro-neutro-corsia` e `membro-neutro-tinta`; per §3 anche il fondo di `.btn-primary` (#0F3D44 → #10262A) e degli scheletri (#F4F6F4 → #DCE2DF).

## §2 Token senza ruolo (tabella B dell'analista, confermata dal designer)

Valgono i valori della tabella B del requisito. Il designer li conferma con queste precisazioni:

| Token                                            | Chiaro    | Scuro                           | Designer                                                                                                                                                                                   |
| ------------------------------------------------ | --------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--color-scelta-tenue`                           | `#E2E9E5` | `#263639`                       | confermato: al buio la scheda scelta e la riga premuta hanno lo stesso fondo; la scheda scelta si riconosce da bordo e spunta                                                              |
| `--color-azione-premuto`                         | `#0A2D33` | `#1F7D8A`                       | dopo §3 C resta **senza usi**: si aggiunge alla tabella C e si toglie con gli altri superati                                                                                               |
| `--color-allerta-scuro`                          | `#A82A27` | `#C4483A`                       | confermato (al buio il rosso pieno non cambia al passaggio del mouse)                                                                                                                      |
| `--color-notte-2`                                | `#2A2925` | uguale                          | confermato come default (domanda 1): dopo §3 C si usa **solo sopra il fondo di marca**, mai sul verde. Vedi §8                                                                             |
| `--color-ok`                                     | `#1B6B45` | `#8FD0CB`                       | confermato: 10,35 sul fondo scuro, 8,82 sulla superficie                                                                                                                                   |
| `--color-info`, `--color-avviso`                 | invariati | `#EAF2EE`                       | confermato: al buio le icone degli avvisi sono nude nel colore del testo (F4a)                                                                                                             |
| tinte e corsie di sabbia, azzurro, rosa, ardesia | Passo 12  | corsia = pieno; tinta `#1E2B2E` | confermato il default della domanda 4: barretta sul fondo da 3,20 (ardesia) a 7,78 (sabbia), testo sul fondo 12,80. Resta da far confermare a Francesco: Fable non li ha disegnati al buio |

I quattro `-tinta` nuovi (`--color-membro-sabbia-tinta` ecc.) sostituiscono, nelle classi `.membro-lampone`, `-ceruleo`, `-peonia`, `-basilico`, il `--color-membro-neutro-tinta` di oggi.

## §3 Regole di `components.css` da cambiare (risposta 196: al buio il pieno resta scuro con il testo chiaro)

Regola unica: **ogni fondo pieno usa `--color-pieno`, con sopra `--color-latte`** (bianco nei due temi, 15,76 in chiaro e 4,82 al buio). Il toast usa `--color-fumetto`. Il rosso pieno usa `--color-allerta-pieno`. Nessuna regola cambia selettore, misura o forma: cambia solo la variabile.

### A · Le 20 regole con `background: var(--color-inchiostro)`

| #   | Riga | Selettore                                                       | Fondo nuovo       | Testo o segno sopra                                                         |
| --- | ---- | --------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------- |
| 1   | 344  | `.nav-basso__voce.is-attiva::after`                             | `--color-pieno`   | — (è il segno sotto la voce)                                                |
| 2   | 351  | `.btn-aggiungi`                                                 | `--color-pieno`   | `--color-latte` (resta)                                                     |
| 3   | 413  | `.nav-alto__voce.is-attiva`                                     | `--color-pieno`   | `--color-latte` (resta)                                                     |
| 4   | 531  | `.selettore__voce[aria-selected="true"]`                        | `--color-pieno`   | `--color-latte` (resta)                                                     |
| 5   | 894  | `.puntina[aria-pressed="true"]`                                 | `--color-pieno`   | `--color-latte` (resta)                                                     |
| 6   | 1537 | `.etichetta--scura`                                             | `--color-pieno`   | `--color-latte` (resta)                                                     |
| 7   | 1602 | `.chip[aria-pressed="true"]`                                    | `--color-pieno`   | `--color-latte`, anche `.chip[aria-pressed="true"] .icona` (1632)           |
| 8   | 1926 | `.campo-rapido--attivo .campo-rapido__piu`                      | `--color-pieno`   | `--color-latte` (resta)                                                     |
| 9   | 1975 | `.casella[aria-checked="true"]`                                 | `--color-pieno`   | segno `--color-latte` (da `.casella`, 1971)                                 |
| 10  | 1999 | `.tondo-spunta[aria-checked="true"]`                            | `--color-pieno`   | segno `--color-latte` (da `.tondo-spunta`, 1995)                            |
| 11  | 2042 | `.toggle[aria-checked="true"]`                                  | `--color-pieno`   | pallino `.toggle::after` `--color-latte` (2038)                             |
| 12  | 2596 | `.striscia-giorni__giorno.is-oggi .striscia-giorni__numero`     | `--color-pieno`   | `--color-latte` (resta)                                                     |
| 13  | 2683 | `.griglia-mese__cella--oggi .griglia-mese__numero`              | `--color-pieno`   | `--color-latte` (resta)                                                     |
| 14  | 2872 | `.griglia-settimana__giorno.is-oggi .griglia-settimana__numero` | `--color-pieno`   | `--color-latte` (resta)                                                     |
| 15  | 3005 | `.tacche-passi__tacca.is-fatta`                                 | `--color-pieno`   | —                                                                           |
| 16  | 3116 | `.passo-partenza.is-fatto .passo-partenza__cerchio`             | `--color-pieno`   | `--color-latte` (da `.passo-partenza__cerchio`, 3113)                       |
| 17  | 3165 | `.strappo__lama`                                                | `--color-pieno`   | `--color-latte` (resta)                                                     |
| 18  | 4002 | `.campo-rapido:focus-within .campo-rapido__piu`                 | `--color-pieno`   | `--color-latte` (resta)                                                     |
| 19  | 5111 | `.btn-icona[aria-pressed="true"]`                               | `--color-pieno`   | `--color-latte` (resta)                                                     |
| 20  | 6199 | `.toast`                                                        | `--color-fumetto` | `--color-latte` al posto di `--color-bianco`, anche `.toast__azione` (6203) |

In chiaro nessuna di queste regole cambia aspetto (`--color-pieno` e `--color-fumetto` valgono #10262A come l'inchiostro); cambia solo il testo, da #F4F2EC a #FFFFFF, perché `--color-latte` prende il valore di `su`.

### B · Altri fondi pieni (designer)

| Riga                        | Selettore                                                                                                           | Da → a                                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1666–1667                   | `.btn-primary`                                                                                                      | fondo `--color-azione` → `--color-pieno` (CA-15); testo `--color-bianco` → `--color-latte`                                                                                              |
| 273, 1317, 1553, 2825, 2836 | `.btn-icona__punto`, `.riga-notifica.is-nuova::after`, `.pallino-urgente`, `.linea-adesso`, `.linea-adesso::before` | `--color-allerta` → `--color-allerta-pieno` (punti e linee: «punto e pulsante pieno»)                                                                                                   |
| 1541, 1773                  | `.etichetta--allerta`, `.btn-pericolo-pieno`                                                                        | fondo `--color-allerta` → `--color-allerta-pieno`; testo `--color-bianco` → `--color-latte` (4,84 al buio)                                                                              |
| 2428                        | `.skeleton`                                                                                                         | `--color-carta-2` → `--color-scheletro`: al buio `carta-2` sul fondo fa 1,1 e lo scheletro non si vedrebbe; `scheletro` è il ruolo di Fable. `.skeleton--notte` resta `--color-notte-2` |

### C · Passaggio del mouse e premuto dei fondi pieni (designer, risponde alla domanda 2)

Oggi i pieni d'inchiostro passano a `--color-notte-2` (#2A2925, bruno) e `.btn-primary` a `--color-azione-premuto`. Al buio darebbe un pulsante verde che diventa bruno sotto il mouse. **Tutti passano a `--color-azione`**: in chiaro #10262A → #0F3D44 (si vede, 1,33 tra i due, testo bianco 11,86); al buio il ruolo vale come il pieno, quindi il colore non cambia, come chiede il default della domanda 2. Il fuoco e il premuto restano visibili per l'anello e per la risposta immediata della pagina.

Regole: in `@media (hover: hover)` riga 4079 (`.btn-primary:hover`), il gruppo di righe 4082–4087 (`.btn-aggiungi`, `.selettore__voce[aria-pressed]`, `.chip[aria-pressed]`, `.nav-alto__voce.is-attiva`), 4022 (`.strappo__lama:hover`), 4896 (`.puntina[aria-pressed]:hover`), 5117 (`.btn-icona[aria-pressed]:hover`); fuori: 4136 (`.btn-primary:active`), 4139 (`.btn-aggiungi:active`), 4170 (gruppo `:active` di selettore e chip), 4026 (`.strappo__lama:active`), 4915 (`.puntina[aria-pressed]:active`), 5121 (`.btn-icona[aria-pressed]:active`). Le altre `--color-notte-2` (4869, 4883, 4904, 4923, 6337, 6348, 244, 857, 1239, 3202) stanno sopra il fondo di marca e restano.

`.btn-pericolo-pieno:hover` e `:active` restano `--color-allerta-scuro` (§2).

### D · Testo scuro sopra un fondo chiaro che non cambia (designer, non c'era nel requisito)

Sette regole mettono `color: var(--color-inchiostro)` sopra `--color-latte` o sopra il colore di una persona, fondi uguali nei due temi. Al buio l'inchiostro diventa #EAF2EE e il testo sparirebbe (1,14 sul bianco). Passano a **`--color-adesso-testo`** (#10262A nei due temi: il ruolo di Fable per il testo sopra i colori fissi):

| Riga | Selettore                                             | Fondo                                               |
| ---- | ----------------------------------------------------- | --------------------------------------------------- |
| 366  | `.btn-aggiungi__piu`                                  | `--color-latte`                                     |
| 902  | `.scheda-modulo--scura .puntina[aria-pressed="true"]` | `--color-latte`                                     |
| 944  | `.porta__freccia`                                     | `--color-latte`                                     |
| 1681 | `.btn-chiaro`                                         | `--color-latte` (al mouse `--color-latte-2`: 11,49) |
| 1714 | `.btn__icona-box`                                     | `--color-latte`                                     |
| 2934 | `.adesivo`                                            | `--c` della persona                                 |
| 2966 | `.adesivo__nota`                                      | `--c` della persona                                 |

Proposta di CA per il test (da aggiungere a CA-13): «in `components.css` nessuna regola ha insieme un fondo `--color-latte`, `--c` o `--color-adesso` e `color: var(--color-inchiostro)`».

### E · Persone, fuoco, avvisi

- `.membro-*` (righe 44–107): `--c-iniziale: var(--color-inchiostro)` → `var(--color-iniziale)`; `var(--color-bianco)` di `cobalto` e `basilico` → `var(--color-iniziale-blu)`. Ogni `.membro-*` aggiunge `--c-spento` (§5). **`.membro-insieme` (110) tiene `--color-inchiostro`** (designer): il suo `--c` è `--color-insieme`, che al buio diventa scuro (#3A3112), e l'iniziale deve seguire il tema (13,69 in chiaro, 11,32 al buio).
- `.avatar` (1459): `var(--c-iniziale, var(--color-inchiostro))` resta: senza classe `.membro-*` il pallino non ha fondo e l'iniziale segue il testo.
- Fuoco: `:focus-visible` in `globals.css` (425–428) `--color-azione` → `--color-fuoco`; `.tema-notte .avviso :focus-visible` (components.css, riga ~3819) `--color-azione` → `--color-fuoco`. La regola `:is(.tema-notte, .toast, .scheda--scura, .scheda-modulo--scura, .split-onboarding__notte) :focus-visible` resta `--color-latte`: bianco su notte 15,11, su fumetto 10,29.
- Bordi e anelli in `--color-inchiostro` (`.btn-secondary`, anello del campo, anello del pallino scelto): restano. Al buio diventano chiari sul fondo scuro, come vuole Fable (filo del campo con il fuoco «scuro» in chiaro, chiaro al buio).

## §4 Testo secondario sopra il verde: la correzione di `--c-su2`

**Il problema.** `--color-latte-2` (ruolo `su2`, #D5DEDC, uguale nei due temi) sul pieno del buio #1F7D8A fa **3,51 : 1**, sotto 4,5. Lo stesso sul rosso pieno del buio #C4483A: 3,53.

**Ho cercato un valore che arrivi a 4,5.** Il bianco puro sul verde fa solo 4,82: ogni testo secondario deve stare tra 4,5 e 4,82, cioè quasi bianco.

| Candidato per `su2` al buio | Sul verde #1F7D8A | Distanza dal bianco (`su`) |
| --------------------------- | ----------------: | -------------------------: |
| `#D5DEDC` (oggi)            |              3,51 |                       1,37 |
| `#E6ECEA`                   |              4,03 |                       1,21 |
| `#F2F7F5` (`fuoco` al buio) |              4,45 |                       1,08 |
| `#F4F7F6`                   |              4,47 |                       1,08 |
| `#F5F8F7`                   |              4,51 |                       1,07 |
| `#FFFFFF` (`su`)            |              4,82 |                          — |

Il primo valore che passa, #F5F8F7, si distingue dal bianco per 1,07 : 1: a occhio è bianco, quindi non fa più il «secondario». Scurire il verde non si può: per portare `su2` a 4,5 il pieno dovrebbe scendere a #196873, che sul fondo della pagina fa 2,81 (sotto il 3 degli elementi).

**Correzione (designer, conferma la decisione 7 dell'analista).** Nessun valore nuovo, nessun colore fuori dalla tavolozza:

- `--color-latte-2` resta #D5DEDC nei due temi e si usa solo sopra `--color-fumetto` (7,50 al buio, 11,49 in chiaro) e sopra `--color-notte` (11,02).
- Sopra `--color-pieno` e `--color-allerta-pieno`, **in tutti e due i temi**, il testo secondario è `--color-latte` (4,82 e 4,84 al buio) e si distingue dal principale per peso e misura (400 e `--text-nota-*` contro 600), non per colore.
- Il test lo controlla (CA-13: `--color-latte-2` mai nella stessa regola di `--color-pieno`). Oggi nessuna regola mette `--color-latte-2` sopra l'inchiostro: la regola vale per F4b, F4c, F5 e le pagine.

Alternativa scartata: un token `--color-latte-2-pieno` (chiaro #D5DEDC, scuro #FFFFFF) terrebbe la differenza di colore solo in chiaro. Aggiunge un nome per un caso che oggi non esiste; se una pagina lo chiederà, si apre una `proposta-design`.

## §5 Pallino non scelto (`--c-spento`) e barrette

Ogni `.membro-*` (non `.membro-insieme`) definisce `--c-spento: color-mix(in srgb, var(--c) 30%, var(--color-carta));` e il pallino non scelto ha fondo `var(--c-spento)`, iniziale `var(--color-inchiostro)`, nessuna ombra (Passo 16). Sostituisce `--c-tinta` nel pallino non scelto. `--c-tinta` resta il fondo dell'impegno. Il pallino scelto: fondo `var(--c)`, iniziale `var(--c-iniziale)`, più la spunta o l'anello.

Valori calcolati (arrotondati al canale; tolleranza del test 1):

| Codice      | Pieno     | Scelto (iniziale) | Spento chiaro | Iniziale su spento | Spento buio | Iniziale su spento |
| ----------- | --------- | ----------------: | ------------- | -----------------: | ----------- | -----------------: |
| `pomodoro`  | `#F2765C` |              5,64 | `#FBD6CE`     |              11,71 | `#53342D`   |               9,72 |
| `glicine`   | `#B9A2EC` |              7,08 | `#EAE3F9`     |              12,65 | `#424158`   |               8,66 |
| `salvia`    | `#8FD0A8` |              8,82 | `#DDF1E5`     |              13,35 | `#354F44`   |               7,83 |
| `cobalto`   | `#3F6FE0` |     4,60 (bianca) | `#C5D4F6`     |              10,60 | `#1D3255`   |              11,24 |
| `zafferano` | `#E8A15C` |              7,27 | `#F8E3CE`     |              12,66 | `#50412D`   |               8,63 |
| `lampone`   | `#D9B88F` |              8,41 | `#F4EADD`     |              13,25 | `#4C483C`   |               8,02 |
| `ceruleo`   | `#7CC7E0` |              8,33 | `#D8EEF6`     |              13,12 | `#304D55`   |               7,95 |
| `peonia`    | `#F0A3C0` |              8,03 | `#FBE3EC`     |              12,98 | `#53424B`   |               8,20 |
| `basilico`  | `#68778D` |     4,55 (bianca) | `#D2D6DD`     |              10,81 | `#2A343C`   |              11,14 |
| `cannella`  | `#AF8273` |              4,70 | `#E7DAD5`     |              11,55 | `#3F3834`   |              10,09 |
| neutro      | `#B4BFBC` |              8,34 | `#E9ECEB`     |              13,25 | `#414A4A`   |               8,00 |

Gli esempi di CA-19 tornano (#fbd6ce, #53342d, #c5d4f6, #1d3255). Il pallino si calcola sempre su `--color-carta`, anche dentro un foglio (al buio `--color-superficie` è #1A2729): la differenza col foglio è minima e l'iniziale resta sopra 7,8.

`--color-nessuno` (#B4BFBC / #5E6F72) è il pallino e la barretta di ciò che non è di nessuno: **mai con un'iniziale sopra** (al buio con l'iniziale scura farebbe 3,0). Il pallino di una persona senza colore usa `.membro-neutro`, uguale nei due temi.

**Barrette al buio** (sul fondo dell'impegno, minimo 3): corallo 4,45 · glicine 5,08 · menta 5,86 · blu #4E7BE2 3,46 · ambra 5,22 · cannella 3,84 · sabbia 7,78 · azzurro 7,71 · rosa 7,43 · ardesia 3,20 · di casa 7,62. Testo sul fondo dell'impegno al buio: da 9,19 (menta) a 12,80. In chiaro le barrette dei colori liberi: 3,20–3,85.

## §6 Scena della notte, splash e gancio `.solo-chiaro` / `.solo-scuro`

Qui solo il gancio e i token: disegno e criteri della scena sono di F6 (#507, criteri F6-1–F6-6 copiati lì).

**Le due classi**, in `components.css`, solo CSS, senza script. Il tema effettivo è lo stesso dei token: `data-aspetto="scuro"` vince; `data-aspetto="chiaro"` vince; altrimenti (attributo assente, `sistema` o sbagliato) segue `prefers-color-scheme`. **(designer)** Il requisito non dice come nascondere `.solo-scuro` in chiaro senza nasconderlo anche col sistema scuro: serve la media negativa.

```css
/* Tema chiaro effettivo: si nasconde quello che è solo del buio */
@media not all and (prefers-color-scheme: dark) {
  :root:not([data-aspetto="scuro"]) .solo-scuro {
    display: none;
  }
}
:root[data-aspetto="chiaro"] .solo-scuro {
  display: none;
}
/* Tema scuro effettivo: si nasconde quello che è solo del chiaro */
:root[data-aspetto="scuro"] .solo-chiaro {
  display: none;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-aspetto="chiaro"]) .solo-chiaro {
    display: none;
  }
}
```

Regole d'uso:

- Le classi stanno sul contenitore dell'immagine (per esempio un `<span>` o `<div>` attorno a ciascun SVG), non su un elemento che ha già un suo `display` più specifico.
- Le due scene sono decorative: `aria-hidden="true"` su tutte e due; quella nascosta con `display: none` non si legge e non riceve tocchi.
- Si scambia l'immagine, non si filtra: niente `filter`, `mix-blend-mode`, `opacity` o inversioni su scena, foto, campioni degli sfondi (F6-3).
- Le scene sono immagini: i loro colori (tabella di `tavolozza.md` §4) stanno dentro l'SVG, come per le foto («restano scritti a mano, per scelta»). Non diventano token `--color-*`.
- In galleria `/design-system`: due riquadri d'esempio con testo «Solo col tema chiaro» e «Solo col tema scuro» (CA-25).

**Splash** (lo disegna F6): il fondo usa solo token, che cambiano da soli col tema: parte da `--color-notte` (#0B2A31 nei due temi), passa per `--color-cielo-mezzo` e arriva a `--color-cielo` (al buio #0D2238 → #12294A, in chiaro #2A7F8E → #BBE1F4). Logo sul fondo di marca: `--color-logo-a-notte` e `--color-logo-b-notte`. Fondo dietro la scena: `--color-scena-fondo`. La scena dello splash è la stessa di Oggi, con le stesse classi. Stessi tempi in chiaro e al buio (1,4 s e 2,9 s); con il movimento ridotto solo la dissolvenza.

**Cambio di tema.** Nessuna transizione su fondi e colori quando cambia il tema (CA-10): il cambio è immediato, come quello del sistema.

## §7 Contrasti verificati

Formula WCAG 2.1 sui valori di §1. «buio» = valori scuri.

**Testo (minimo 4,5).**

| Testo                       | Fondo                                   |                        Chiaro |                                Buio |
| --------------------------- | --------------------------------------- | ----------------------------: | ----------------------------------: |
| `inchiostro`                | carta · superficie · carta-2 · premuto  | 15,76 · 15,76 · 14,51 · 13,60 |       15,82 · 13,49 · 14,28 · 11,04 |
| `inchiostro-medio`          | carta · superficie · carta-2 · premuto  |     9,80 · 9,80 · 9,02 · 8,45 |        11,96 · 10,20 · 10,79 · 8,35 |
| `inchiostro-2`              | carta · superficie · carta-2 · premuto  |     5,86 · 5,86 · 5,40 · 5,06 |           9,42 · 8,04 · 8,51 · 6,58 |
| `link`                      | carta · superficie                      |                   7,86 · 7,86 |                        10,54 · 8,99 |
| `allerta`                   | carta · superficie · allerta-fondo      |            6,54 · 6,54 · 5,78 |                  8,99 · 7,67 · 7,58 |
| `latte`                     | pieno · fumetto · allerta-pieno · notte |  15,76 · 15,76 · 6,54 · 15,11 | **4,82** · 10,29 · **4,84** · 15,11 |
| `latte-2`                   | fumetto · notte                         |                 11,49 · 11,02 |                        7,50 · 11,02 |
| `latte-2`                   | pieno (vietato, §4)                     |                         11,49 |                          **3,51** ✗ |
| `insieme-testo`             | insieme                                 |                          8,26 |                               10,01 |
| `segnaposto-testo`          | segnaposto                              |                          6,44 |                                9,10 |
| `adesso-testo`              | adesso                                  |                         10,02 |                               10,02 |
| `adesso-testo`              | latte (§3 D) · latte-2                  |                 15,76 · 11,49 |                       15,76 · 11,49 |
| `inchiostro`                | ogni `-tinta` delle persone             |                   13,31–14,54 |                          9,19–12,80 |
| `inchiostro`                | `--c-spento` (§5)                       |                   10,60–13,35 |                          7,83–11,24 |
| iniziale del pallino scelto | `--c`                                   |                     4,55–8,82 |                 uguale (non cambia) |
| `piano-icona-1` · `-2`      | `conferma` · `inchiostro`               |                  3,81 · 11,64 |                         9,04 · 6,90 |

**Elementi (minimo 3).**

| Elemento        | Fondo                        |                 Chiaro |                  Buio |
| --------------- | ---------------------------- | ---------------------: | --------------------: |
| `filo-campo`    | carta · superficie · carta-2 | 3,19 · 3,19 · **2,93** |    5,63 · 4,80 · 5,09 |
| `fuoco`         | carta · superficie · carta-2 |  11,86 · 11,86 · 10,92 | 16,65 · 14,20 · 15,03 |
| anello `latte`  | notte                        |                  15,11 |                 15,11 |
| `pieno`         | carta · superficie · carta-2 |  15,76 · 15,76 · 14,51 |    3,74 · 3,19 · 3,38 |
| `pieno`         | premuto (eccezione)          |                  13,60 |              **2,61** |
| `allerta-pieno` | carta                        |                   6,54 |                  3,72 |
| `conferma`      | carta · superficie           |            3,81 · 3,81 |          10,35 · 8,82 |
| `insieme-bordo` | insieme                      |                   3,23 |                  6,90 |
| barrette        | fondo dell'impegno (§5)      |              3,20–3,90 |             3,20–7,78 |

**Eccezioni dichiarate** (CA-23), ognuna col suo motivo:

- `pieno` su `premuto` al buio (2,61): il verde non è mai l'unico segnale, c'è sempre la spunta o il testo (risposta 202).
- `filo-campo` su `carta-2` in chiaro (2,93), domanda 3. **(designer)** Il campo pieno (fondo `carta-2` con il filo) sta sulla pagina bianca: il filo confina col bianco (3,19) e passa. La regola: in chiaro nessun campo con il bordo `--color-filo-campo` sta **sopra** un fondo `--color-carta-2` (avvisi quieti, barra laterale). Oggi non ce n'è; F5 mette il campo Cerca nella barra in alto (bianca), non nella barra laterale.
- `inchiostro-3` (2,98 in chiaro), `filo`, `filo-2`, `scheletro`, `allerta-bordo`, `nessuno`: solo decorazione, mai testo né unico bordo di un controllo.
- `notte-2` sopra `notte` (1,04): solo decorazione sopra il fondo di marca (§8).

## §8 Domande aperte del designer (nessuna bloccante)

1. **`--color-notte-2` col fondo di marca nuovo.** Con `--color-notte` #0B2A31, il bruno #2A2925 sopra fa 1,04 : 1, contro 1,2 di oggi: i quadrati e i passaggi del mouse sulle schede scure quasi non si vedono, anche in chiaro. Sono decorativi e nessuno è l'unico segnale. _Default:_ resta così in questa PR; il valore giusto lo deve dare Fable, perché la tavolozza non ha un ruolo «sopra la notte». La domanda va a Francesco per il prossimo passo di Fable.
2. **Fondo scuro dei quattro colori liberi** (`#1E2B2E`): è il default dell'analista (domanda 4), coi valori di un ruolo esistente. Da far confermare a Francesco insieme alla domanda 1.

## §9 Note per le altre specifiche (già corrette in questo branch)

- **504 (F4b):** il testo sopra un pieno è `--color-latte` su `--color-pieno`; pallino non scelto `--c-spento` con l'iniziale `--color-inchiostro` (§5). Corretti `docs/specifiche/504-componenti-scelte-persone.md` §2 e §5; i punti del corpo della issue (§12, CA-7, CA-16, CA-31) sono nel commento su #504.
- **505 (F4c):** stessa regola per il giorno scelto; il rosso pieno è `--color-allerta-pieno`; il velo è `--color-velo`. Corretto `docs/specifiche/505-fogli-conferme-data.md`; i punti del corpo (§6, CA-12, CA-36) nel commento su #505.
- **506 (F5):** al posto dei 10 colori di `computer.md` i ruoli di §1; fuoco `--color-fuoco`, `--color-latte` sul fondo di marca; mouse sui pieni `--color-azione`. Corretto `docs/specifiche/506-guscio-navigazione.md` §9 e §13.
- **551 (A18):** §4 rimanda a questa issue; `color-scheme` lo scrive il CSS di #634, il server mette solo `data-aspetto`.
- **#623:** il colore della barra del browser (`<meta name="theme-color">`) non è nel perimetro di #634 (CA-28). Se #623 lo aggiunge: `--color-carta` del tema effettivo, scritto dal server con `data-aspetto`, o due `meta` con `media` per «sistema».
