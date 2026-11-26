# Tavolozza comune · Passi 14–16 (telefono, web da telefono, computer)

> Archiviata il 26/11/2026 (PR dei Passi 12–16, #501). **È la fonte di verità per i colori in chiaro e al buio**, comune ai formati; vince sulle tavole, anche su quelle scure di `scuro-derivato/`. La cartella `regole-e-valori/` citata qui è `docs/design/computer/regole-e-valori-p12-16/`. Traduzione in token per l'app: `.claude/skills/design-system/riferimento/token.md`, «Tavolozza comune dei Passi 12–16». La barretta di Tommaso al buio (#4E7BE2 nella tavola, #3F6FE0 nel foglio di stile) è da chiarire: vedi la fine del §2.

Estratta il 26/11/2026 dal secondo canvas di Fable («FamilyNest: computer e web da telefono», https://claude.ai/artifact/PVgH6JrYhzhkPXu6js4Ktc, versione 1795707258-333f). Fonte dei valori: `project/v2.css`, riga 8 (`.v2`, tema chiaro) e riga 10 (`.v2.th-d`, tema scuro); nomi dei ruoli dalla tavola «Passo 14 · La tavolozza per ruoli» (`project/D-TV1.dc.html`, immagine in `regole-e-valori/`). Ho confrontato i 73 ruoli della tavola con il foglio di stile: i valori coincidono tutti. Lo stesso foglio vale per telefono e computer. Gli stessi dati, in forma leggibile da un programma, sono in `tavolozza.json`.

**Come si usa.** Ogni colore dell'interfaccia passa da un ruolo `--c-…`. Il tema scuro cambia solo i valori (classe `th-d` sul contenitore; nell'app sarà `prefers-color-scheme` più la scelta in Impostazioni › Aspetto). «uguale» vuol dire che il ruolo ha lo stesso valore nei due temi. Fable ha contato 60 ruoli al Passo 14; con i Passi 15 e 16 sono diventati **73**.

## 1 · I ruoli, con il valore chiaro e quello scuro

### Fondo e superfici

| Ruolo                                                                            | Nome                   | Chiaro                  | Scuro               |
| -------------------------------------------------------------------------------- | ---------------------- | ----------------------- | ------------------- |
| Fondo della pagina                                                               | `--c-fondo`            | `#FFFFFF`               | `#0F1819`           |
| Superficie alzata: pannello, finestra, foglio, menu                              | `--c-sup`              | `#FFFFFF`               | `#1A2729`           |
| Superficie bassa: barra laterale, riquadri, campi pieni                          | `--c-basso`            | `#F4F6F4`               | `#172224`           |
| Premuto, scelto, passaggio del mouse                                             | `--c-premuto`          | `#ECEFEC`               | `#263639`           |
| Scheletro del caricamento, binari spenti                                         | `--c-scheletro`        | `#DCE2DF`               | `#2B3A3C`           |
| Velo dietro finestre e fogli                                                     | `--c-velo`             | `rgba(16,38,42,.36)`    | `rgba(0,0,0,.62)`   |
| Ombra leggera                                                                    | `--c-ombra`            | `rgba(16,38,42,.08)`    | `rgba(0,0,0,.4)`    |
| Ombra di finestre, fumetti, avvisi                                               | `--c-ombra2`           | `rgba(16,38,42,.2)`     | `rgba(0,0,0,.6)`    |
| Barra in basso del telefono                                                      | `--c-barra`            | `rgba(255,255,255,.52)` | `rgba(30,45,48,.9)` |
| Splash: il fondo prende il colore del cielo della scena                          | `--c-cielo`            | `#BBE1F4`               | `#12294A`           |
| Splash: a metà dissolvenza                                                       | `--c-cielo-mezzo`      | `#2A7F8E`               | `#0D2238`           |
| Segnaposto di una foto che manca: uno solo, color sabbia, con l'icona del piatto | `--c-segnaposto`       | `#F1E9DD`               | `#2E2A22`           |
| Icona e testo sul segnaposto                                                     | `--c-segnaposto-testo` | `#5B5145`               | `#D9CDB8`           |
| Miniatura di un'idea: all'aperto                                                 | `--c-idea-1`           | `#E4EEDD`               | `#24332A`           |
| Miniatura di un'idea: al chiuso                                                  | `--c-idea-2`           | `#EFE6F2`               | `#322A38`           |
| Miniatura di un'idea: in casa                                                    | `--c-idea-3`           | `#F6E4CF`               | `#3A2F22`           |
| Fondo della scena e dello sfondo semplice                                        | `--c-scena`            | `#DDE9E4`               | `#1D3536`           |

### Fili e bordi

| Ruolo                                          | Nome        | Chiaro    | Scuro     |
| ---------------------------------------------- | ----------- | --------- | --------- |
| Filo leggero tra le righe                      | `--c-filo`  | `#E4E8E5` | `#2B3A3C` |
| Filo medio, bordo dei pulsanti quieti          | `--c-filo2` | `#C3CCC9` | `#3A4F52` |
| Bordo dei campi e dei tratteggi (almeno 3 a 1) | `--c-campo` | `#869390` | `#7E9496` |
| Anello del fuoco da tastiera                   | `--c-fuoco` | `#0F3D44` | `#F2F7F5` |

### Testo

| Ruolo                                        | Nome          | Chiaro    | Scuro     |
| -------------------------------------------- | ------------- | --------- | --------- |
| Testo e icone                                | `--c-testo`   | `#10262A` | `#EAF2EE` |
| Testo medio                                  | `--c-testo-m` | `#33474B` | `#C9D5D2` |
| Testo secondario                             | `--c-testo2`  | `#55686C` | `#A9C0BF` |
| Testo spento, mai da solo                    | `--c-testo3`  | `#8A989A` | `#84999A` |
| Testo e icone sopra l'accento                | `--c-su`      | `#FFFFFF` | uguale    |
| Testo secondario sopra l'accento e i fumetti | `--c-su2`     | `#D5DEDC` | uguale    |
| Collegamento                                 | `--c-link`    | `#0E5A66` | `#7FD3DE` |

### Accento

| Ruolo                                                                  | Nome               | Chiaro    | Scuro     |
| ---------------------------------------------------------------------- | ------------------ | --------- | --------- |
| Fondo pieno: pulsante principale, spunta, interruttore acceso          | `--c-pieno`        | `#10262A` | `#1F7D8A` |
| Accento: voce scelta, energia, barre                                   | `--c-accento`      | `#0F3D44` | `#1F7D8A` |
| Fondo scuro di marca: benvenuto, metà dell'accesso, splash. Non cambia | `--c-notte`        | `#0B2A31` | uguale    |
| Logo: il tetto                                                         | `--c-logo-a`       | `#0F3D44` | `#F2F6F3` |
| Logo: il secondo tratto                                                | `--c-logo-b`       | `#2F8F99` | `#8FD0CB` |
| Logo sul fondo scuro di marca                                          | `--c-logo-a-notte` | `#F2F6F3` | uguale    |
| Logo sul fondo scuro di marca, secondo tratto                          | `--c-logo-b-notte` | `#8FD0CB` | uguale    |
| Fumetto e avviso in basso                                              | `--c-fumetto`      | `#10262A` | `#2F4448` |
| Fondo del pulsante dell'assistente                                     | `--c-assistente`   | `#FCE7E0` | `#3B2621` |

### Stati

| Ruolo                                                   | Nome               | Chiaro    | Scuro     |
| ------------------------------------------------------- | ------------------ | --------- | --------- |
| Errore: testo, icona, filo                              | `--c-errore`       | `#B3261E` | `#FF9D90` |
| Errore: punto e pulsante pieno                          | `--c-errore-pieno` | `#B3261E` | `#C4483A` |
| Errore: fondo dell'avviso                               | `--c-errore-fondo` | `#FCEEEA` | `#3A1E1B` |
| Errore: bordo dell'avviso                               | `--c-errore-bordo` | `#E7B9AB` | `#7A3A32` |
| Giallo di «adesso»                                      | `--c-adesso`       | `#F6C945` | uguale    |
| Testo sul giallo di «adesso» e sui colori delle persone | `--c-adesso-testo` | `#10262A` | uguale    |
| «Liberi insieme»: fondo                                 | `--c-liberi`       | `#FCEFC0` | `#3A3112` |
| «Liberi insieme»: barretta                              | `--c-liberi-barra` | `#A38009` | `#E2B93B` |
| «Liberi insieme»: testo secondario                      | `--c-liberi-testo` | `#4A4630` | `#F1E3A8` |

### Persone e corsie

| Ruolo                                               | Nome                 | Chiaro    | Scuro     |
| --------------------------------------------------- | -------------------- | --------- | --------- |
| Marco, corallo: pallino scelto                      | `--c-marco`          | `#F2765C` | uguale    |
| Marco, corallo: barretta della corsia               | `--c-marco-barra`    | `#D75E45` | `#F2765C` |
| Marco, corallo: fondo dell'impegno                  | `--c-marco-fondo`    | `#FDEAE5` | `#452F29` |
| Laura, glicine: pallino scelto                      | `--c-laura`          | `#B9A2EC` | uguale    |
| Laura, glicine: barretta della corsia               | `--c-laura-barra`    | `#8F78BF` | `#B9A2EC` |
| Laura, glicine: fondo dell'impegno                  | `--c-laura-fondo`    | `#F2ECFC` | `#38394C` |
| Sofia, menta: pallino scelto                        | `--c-sofia`          | `#8FD0A8` | uguale    |
| Sofia, menta: barretta della corsia                 | `--c-sofia-barra`    | `#54936E` | `#8FD0A8` |
| Sofia, menta: fondo dell'impegno                    | `--c-sofia-fondo`    | `#E7F5EC` | `#2E443B` |
| Tommaso, blu: pallino scelto                        | `--c-tommaso`        | `#3F6FE0` | uguale    |
| Tommaso, blu: barretta della corsia                 | `--c-tommaso-barra`  | `#3F6FE0` | `#4E7BE2` |
| Tommaso, blu: fondo dell'impegno                    | `--c-tommaso-fondo`  | `#E5ECFC` | `#1B2D49` |
| Biscotto, ambra: pallino scelto                     | `--c-biscotto`       | `#E8A15C` | uguale    |
| Biscotto, ambra: barretta della corsia              | `--c-biscotto-barra` | `#B9762E` | `#E8A15C` |
| Biscotto, ambra: fondo dell'impegno                 | `--c-biscotto-fondo` | `#FCEEDD` | `#433929` |
| Miele, cannella: pallino scelto                     | `--c-miele`          | `#AF8273` | uguale    |
| Miele, cannella: barretta della corsia              | `--c-miele-barra`    | `#A67A6B` | `#AF8273` |
| Miele, cannella: fondo dell'impegno                 | `--c-miele-fondo`    | `#F5ECE8` | `#35312F` |
| Di casa, grigio: barretta                           | `--c-casa-barra`     | `#55686C` | `#A9C0BF` |
| Di casa, grigio: fondo dell'impegno                 | `--c-casa-fondo`     | `#EEF1EF` | `#1E2B2E` |
| Iniziale nel pallino scelto: scura nei due temi     | `--c-iniziale`       | `#10262A` | uguale    |
| Iniziale sul blu di Tommaso: bianca nei due temi    | `--c-iniziale-blu`   | `#FFFFFF` | uguale    |
| Rosa della tavolozza delle persone (chi è invitato) | `--c-rosa`           | `#F0A3C0` | uguale    |
| Pallino e barretta di quello che non è di nessuno   | `--c-nessuno`        | `#B4BFBC` | `#5E6F72` |
| Segno di conferma, piano scelto                     | `--c-conferma`       | `#2F8F99` | `#8FD0CB` |
| Tratto fatto della linea del tempo                  | `--c-conferma-fondo` | `#CFE5E1` | `#1F3F42` |
| Aiutanti: un solo colore neutro, con l'iniziale     | `--c-aiutante`       | `#D5DBD8` | uguale    |

## 2 · I colori delle persone

Sei colori, uno per chi vive in casa (animali compresi). Il pallino non cambia tra chiaro e buio; cambiano barretta e fondo dell'impegno. Gli aiutanti (nonni, babysitter) hanno tutti un colore neutro, `--c-aiutante` #D5DBD8 con l'iniziale scura (risposta 190). Chi è invitato e non è ancora entrato: `--c-rosa` #F0A3C0. Quello che non è di nessuno: `--c-nessuno` (#B4BFBC / #5E6F72). «Liberi insieme»: `--c-liberi` (vedi Stati).

| Persona         | Colore   | Pallino   | Iniziale       | Barretta chiaro | Barretta scuro | Fondo impegno chiaro | Fondo impegno scuro | Barretta/fondo chiaro | Barretta/fondo scuro | Testo/fondo chiaro · scuro |
| --------------- | -------- | --------- | -------------- | --------------- | -------------- | -------------------- | ------------------- | --------------------- | -------------------- | -------------------------- |
| Marco           | corallo  | `#F2765C` | «M» `#10262A`  | `#D75E45`       | `#F2765C`      | `#FDEAE5`            | `#452F29`           | 3,2                   | 4,4                  | 13,6 · 10,9                |
| Laura           | glicine  | `#B9A2EC` | «L» `#10262A`  | `#8F78BF`       | `#B9A2EC`      | `#F2ECFC`            | `#38394C`           | 3,2                   | 5,1                  | 13,6 · 9,9                 |
| Sofia           | menta    | `#8FD0A8` | «S» `#10262A`  | `#54936E`       | `#8FD0A8`      | `#E7F5EC`            | `#2E443B`           | 3,2                   | 5,9                  | 14,0 · 9,2                 |
| Tommaso         | blu      | `#3F6FE0` | «T» `#FFFFFF`  | `#3F6FE0`       | `#4E7BE2`      | `#E5ECFC`            | `#1B2D49`           | 3,9                   | 3,0 *                | 13,3 · 12,1                |
| Biscotto (cane) | ambra    | `#E8A15C` | «B» `#10262A`  | `#B9762E`       | `#E8A15C`      | `#FCEEDD`            | `#433929`           | 3,2                   | 5,2                  | 13,8 · 9,9                 |
| Miele (gatto)   | cannella | `#AF8273` | «Mi» `#10262A` | `#A67A6B`       | `#AF8273`      | `#F5ECE8`            | `#35312F`           | 3,2                   | 3,8                  | 13,5 · 11,3                |

Contrasti calcolati da me con la formula WCAG sui valori della tavolozza (testo: `--c-testo`). \* Tommaso al buio: vedi «Da chiarire» qui sotto.

### Le tinte scure delle barrette (Passo 12)

Decisione di Francesco del 25/11: la barretta a sinistra di ogni impegno stacca dal fondo almeno 3 a 1. Fable usa per ogni colore lo stesso colore con meno luce, fermato al primo valore sopra 3,2 a 1 sul fondo dell'impegno (e anche sul bianco). Pallino e fondo restano. Risposta 184: Menta e giallo vanno bene così, il fondo non si scurisce. Al buio la barretta torna al colore pieno della persona (vedi tabella sopra).

| Di chi            | Pallino (non cambia) | Fondo dell'impegno | Prima   | Tinta della barretta     | Dopo, sul fondo               |
| ----------------- | -------------------- | ------------------ | ------- | ------------------------ | ----------------------------- |
| Marco             | Corallo `#F2765C`    | `#FDEAE5`          | 2,4 : 1 | `#D75E45`                | 3,2 : 1                       |
| Laura             | Glicine `#B9A2EC`    | `#F2ECFC`          | 1,9 : 1 | `#8F78BF`                | 3,2 : 1                       |
| Sofia             | Menta `#8FD0A8`      | `#E7F5EC`          | 1,6 : 1 | `#54936E`                | 3,2 : 1                       |
| Tommaso           | Blu `#3F6FE0`        | `#E5ECFC`          | 3,9 : 1 | `#3F6FE0`                | 3,9 (non cambia) : 1          |
| Biscotto          | Ambra `#E8A15C`      | `#FCEEDD`          | 1,9 : 1 | `#B9762E`                | 3,2 : 1                       |
| Miele             | Cannella `#AF8273`   | `#F5ECE8`          | 2,9 : 1 | `#A67A6B`                | 3,2 : 1                       |
| libero            | Rosa `#F0A3C0`       | `#FDF2F6`          | 1,8 : 1 | `#BC7390`                | 3,2 : 1                       |
| libero            | Azzurro `#7CC7E0`    | `#EDF7FB`          | 1,7 : 1 | `#4792AA`                | 3,2 : 1                       |
| libero            | Sabbia `#D9B88F`     | `#FAF5EF`          | 1,7 : 1 | `#A3845D`                | 3,2 : 1                       |
| libero            | Ardesia `#6B7A90`    | `#EAECEF`          | 3,7 : 1 | `#6B7A90`                | 3,7 (non cambia) : 1          |
| Liberi insieme    | Giallo `#F6C945`     | `#FCEFC0`          | 1,4 : 1 | `#A38009`                | 3,2 : 1                       |
| Di casa / nessuno | —                    | `#EEF1EF`          | —       | `#55686C` (`--c-testo2`) | 7,6 : 1 al buio con `#A9C0BF` |

Nel foglio di stile la barretta si sceglie con la classe dell'impegno: `pM` → `--c-marco-barra`, `pL` → `--c-laura-barra`, `pS` → `--c-sofia-barra`, `pT` → `--c-tommaso`, `pB` → `--c-biscotto-barra`, `pG` (Miele) → `--c-miele-barra`, `pY` («Liberi insieme») → `--c-liberi-barra`, `pN` → `--c-testo2`; la barretta è `box-shadow: inset 3px 0 0`. Rosa, Azzurro, Sabbia e Ardesia sono i colori liberi della tavolozza delle persone (per chi arriva dopo): le loro tinte sono solo in questa tabella (tavola «I valori», `regole-e-valori/`), non sono ruoli e non hanno valori scuri. Il rosa è diventato `--c-rosa` (chi è invitato). Sul computer Biscotto e Miele avevano un ambra e un cannella un po' diversi dal telefono: Fable li ha riportati agli stessi valori.

**Da chiarire (Tommaso al buio).** La tavola della tavolozza dà come barretta scura `--c-tommaso-barra` = #4E7BE2 (3,5 : 1 sul fondo #1B2D49), ma il foglio di stile assegna alla classe `pT` il ruolo `--c-tommaso`, che resta #3F6FE0 (3,0 : 1, al limite). Chi sviluppa usa `--c-tommaso-barra`: rispetta la tavola e la soglia con margine.

## 3 · La regola del pallino (Passo 16)

Una regola sola, in chiaro e al buio, con l'iniziale sempre almeno a 4,5 a 1 (tavola «La regola del pallino», `regole-e-valori/`):

- **Scelto**: colore pieno della persona, iniziale scura `--c-iniziale` (#10262A); bianca `--c-iniziale-blu` (#FFFFFF) solo sul blu di Tommaso. Non cambia tra chiaro e buio.
- **Non scelto**: lo stesso colore al 30% sopra il fondo della pagina (`color-mix(in srgb, <colore> 30%, var(--c-fondo))`), iniziale nel colore del testo (`--c-testo`): scura in chiaro, chiara al buio. Niente ombra.
- Scelto e non scelto si distinguono per la pienezza del colore, non per la lettera; chi è scelto ha anche la spunta o l'anello (risposta 202).
- Vale in ogni fila di volti e in ogni selettore di persone: «Per chi» di «Nuovo impegno», la fila dei volti del giorno, i filtri del calendario, «Chi vedo».

| Persona  | Scelto, chiaro | Scelto, buio | Non scelto, chiaro | Non scelto, buio |
| -------- | -------------- | ------------ | ------------------ | ---------------- |
| Marco    | 5,6            | 5,6          | 11,7               | 9,7              |
| Laura    | 7,1            | 7,1          | 12,6               | 8,7              |
| Sofia    | 8,8            | 8,8          | 13,3               | 7,8              |
| Tommaso  | 4,6            | 4,6          | 10,6               | 11,2             |
| Biscotto | 7,3            | 7,3          | 12,7               | 8,6              |
| Miele    | 4,7            | 4,7          | 11,5               | 10,1             |

CSS del canvas: `.v2 .av{color:var(--c-iniziale)}`, `.v2 .av.u4{color:var(--c-iniziale-blu)}`, `.v2 .av.off{background:color-mix(in srgb,var(--avc,var(--c-nessuno)) 30%,var(--c-fondo));color:var(--c-testo);box-shadow:none}`. Critica di Fable: ha ricontrollato «Per chi», il giorno sul telefono e su computer e le corsie, non ogni selettore uno per uno.

## 4 · La scena della notte

Al buio la scena di Oggi è sempre la notte, anche di giorno; lo splash scuro usa la stessa scena (risposte 198 e 204). È un'immagine: i suoi colori sono scritti nella scena, non sono ruoli e non si invertono. SVG `viewBox="0 0 390 300"`, `preserveAspectRatio="xMidYMax slice"`, la stessa forma della scena del giorno.

| Parte           | Notte                                                | Giorno (pomeriggio, per confronto) |
| --------------- | ---------------------------------------------------- | ---------------------------------- |
| Cielo, in alto  | `#081A33`                                            | `#86C8EE`                          |
| Cielo, in basso | `#1E3A5C`                                            | `#DDF0F8`                          |
| Stelle          | #E8EEF6, opacità 0,42–0,89, raggio 0,8–1,3           | —                                  |
| Luna / sole     | #EEF2F7 (r 20) con l'ombra #0C2140 (r 18): una falce | #FFF4C8, alone al 35%              |
| Collina dietro  | `#1F3F50`                                            | `#7FC3B5`                          |
| Collina davanti | `#16303E`                                            | `#4FA394`                          |
| Casa            | `#C9D3DA`                                            | `#FFFFFF`                          |
| Tetto           | `#0F3D44`                                            | `#0F3D44`                          |
| Finestra        | `#FFDFA8 (accesa)`                                   | `#CFE3EE`                          |

Attorno alla scena: splash scuro dal fondo di marca `--c-notte` #0B2A31, a metà dissolvenza `--c-cielo-mezzo` #0D2238, all'arrivo `--c-cielo` #12294A (il cielo della scena); fondo della scena e anteprima dello sfondo «Semplice» `--c-scena` #1D3536 al buio. Il mattino in chiaro ha il cielo #BFE3F2 → #F8E6D8.

## 5 · Contrasti del tema scuro (tavola di Fable)

| Che cosa                                     | Contrasto | Serve |
| -------------------------------------------- | --------- | ----- |
| Testo sul fondo                              | 15,8 : 1  | 4,5   |
| Testo secondario sul fondo                   | 9,4 : 1   | 4,5   |
| Testo secondario sulla superficie alzata     | 8,0 : 1   | 4,5   |
| Testo spento sul fondo                       | 6,0 : 1   | 3     |
| Bordo dei campi sul fondo                    | 5,6 : 1   | 3     |
| Bordo dei campi sulla superficie alzata      | 4,8 : 1   | 3     |
| Bianco sul fondo pieno (pulsante principale) | 4,8 : 1   | 4,5   |
| Fondo pieno sul fondo della pagina           | 3,7 : 1   | 3     |
| Anello del fuoco sul fondo                   | 16,7 : 1  | 3     |
| Errore sul fondo                             | 9,0 : 1   | 4,5   |
| Errore sul suo fondo                         | 7,6 : 1   | 4,5   |
| Collegamento sul fondo                       | 10,5 : 1  | 4,5   |
| «Liberi insieme»: barretta sul suo fondo     | 6,9 : 1   | 3     |

Verde petrolio al buio `#1F7D8A` (`--c-pieno` e `--c-accento`) con il bianco sopra: bianco 4,8 : 1; sul fondo 3,7; su finestre e pannelli 3,2; sulla barra laterale 3,4; sul fondo «premuto» 2,6, dove non è mai l'unico segnale (risposte 196 e 202). Bordo dei campi: `#869390` in chiaro (3,2 sul bianco, anche sul telefono, risposta 197), `#7E9496` al buio.

## 6 · Gli ultimi colori portati nella tavolozza

- Passo 15: «1 viaggio scoperto» (#B4432F scritto a mano, 3,3 a 1 al buio) → --c-errore; con lui altri 29 colori in linea degli schermi del computer (testi, fondi, pulsante dell'assistente, segnaposto delle foto)
- Passo 15: iniziali dei pallini → --c-iniziale (#10262A) e --c-iniziale-blu (#FFFFFF); ora di «adesso» → --c-adesso-testo (#10262A nei due temi, 10 a 1)
- Passo 15: miniature delle idee → --c-idea-1/2/3; tessere dei Pasti senza foto → --c-segnaposto
- Passo 16: «Nessuno, per ora» → --c-testo2 su telefono e computer (classe .nn16)
- Passo 16: anteprima dello sfondo «Semplice» → --c-scena (#1D3536 al buio)
- Passo 16: un solo segnaposto per le ricette senza foto, color sabbia → --c-segnaposto / --c-segnaposto-testo (le quattro tinte di prima sono diventate un ruolo)
- Passo 16: il rosa di chi è invitato → --c-rosa
- Passo 17 (in attesa): #BFE5E1 della pagina «Piani» da portare nella tavolozza; al buio le due icone di «Piani» almeno a 3 a 1

Fable non elenca uno per uno i «cinque colori scritti a mano» chiesti nel Passo 16: l'elenco sopra viene dalle note delle tavole dei Passi 15 e 16 e dalla tavola della tavolozza. Restano scritti a mano, per scelta: veli e testi bianchi sopra le foto, colori dentro la scena di Oggi e dello splash, campioni degli sfondi (anteprime di immagini). Il segnaposto sabbia è un ruolo.

## 7 · Dove va nel repository

Questa tavolozza sostituisce i colori di `docs/design/telefono/tokens.md` e `docs/design/computer/tokens-computer.md` dove sono diversi: per la skill `design-system` (`.claude/skills/design-system/riferimento/`) e per le variabili CSS dell'app (un solo blocco `:root` per il chiaro e uno per lo scuro, con gli stessi nomi di ruolo).
