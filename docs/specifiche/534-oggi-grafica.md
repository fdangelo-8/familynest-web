# #534 · A1 Oggi: cima unica, conti, giornata, riquadri di casa, Personalizza · specifica grafica

Designer, 26/11/2026. Fonti: `docs/design/telefono/` (D4) e `docs/design/computer/` (D5); token e Componenti 2.0 in `.claude/skills/design-system/riferimento/telefono.md` e `computer.md`; basi F2–F5 (`docs/specifiche/196-*`, `502-*` … `506-*`). Qui solo quello che le PNG non dicono. Righe impegno, «Liberi insieme», sovrapposti e «Laura è occupata» sono quelli di A2/A4 (`535-aggiungi-grafica.md` §6, `537-calendario-settimana-grafica.md` §2). Tablet fuori perimetro (Passo 16 di Fable in arrivo). Le domande aperte sono nel commento della designer su #534.

## 1. Quali PNG valgono

| Momento                                   | PNG che vale                                                               | Passo | Nota                                                                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Cima aperta, raccolta, lente Nest         | `oggi/og1-02`, `og1-03`, `og1-04`                                          | 6     | Una sola cima. `og1-01` è il «prima»: non vale.                                                                                        |
| Ore e sfondi                              | `og1-05` (mattina), `og1-06` (sera), `og1-07` (notte), `og1-08` (semplice) | 6     | Le scene `sf1-*` (Passo 5) danno i disegni; la cima e i comandi sono quelli del Passo 6.                                               |
| Coppia, giornata libera                   | `og1-09`, `og1-11`                                                         | 6     |                                                                                                                                        |
| Caricamento                               | `splash-p9/sp1-06` (dopo lo splash), `og1-12` (stesse misure)              | 9     | `rt1-19`/`rt1-20` sono superate nel movimento; resta la regola «se c'è la giornata salvata, niente scheletro».                         |
| Rete lenta, senza rete, niente di salvato | `ritocchi-p6/rt1-22`, `rt1-23`, `rt1-24`                                   | 6     |                                                                                                                                        |
| Aggiornamento non riuscito                | `og1-13`                                                                   | 6     |                                                                                                                                        |
| Riquadri di casa, Personalizza, misura    | `og1-14`, `og1-15`, `og1-16`                                               | 6     |                                                                                                                                        |
| Righe di turno degli animali nei riquadri | `animali/4-6-*`                                                            | 5     | Struttura delle righe; la cima delle tavole 4-6 è vecchia, vale quella del Passo 6.                                                    |
| Primo giorno                              | `og1-10`                                                                   | 6     | Contenuto della lista di partenza: A21 (#554). Primo Oggi di chi entra e avviso agli altri: B3 (#562), `decisioni-p8/ap1-31`–`ap1-35`. |
| Computer 1280 / 1440, pannello, stati     | `computer/oggi/01`–`09`                                                    | 10–11 | Valgono le correzioni del Passo 11 e la risposta 176 (scena a destra).                                                                 |
| Web da telefono                           | `computer/web-da-telefono/01`, `11`                                        | 11    | Cima già raccolta, niente splash.                                                                                                      |
| Disco dell'assistente nella barra         | tutte                                                                      | —     | Nascosto finché B15 non c'è (default 8 del piano).                                                                                     |

## 2. Disposizione e misure (390 px)

Misure dalle PNG (780 px, divise per 2). Dove un valore manca nei token è nella sezione 6 («richieste»).

| Parte                          | Misure e token                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scena                          | Alta 212 dal bordo dello schermo (sotto la zona sicura), a tutta larghezza, decorativa (`aria-hidden`). Il foglio bianco sale sopra la scena con raggio in alto `--radius-xl`, fondo `--color-carta`.                                                                                                                                                                                                          |
| Comandi sulla scena            | A `--space-12` dall'alto della zona sicura. Lente «Io · Nest» a sinistra (capsula 125 × 44, fondo `--color-superficie`, voce scelta `--color-inchiostro` con testo bianco, `--shadow-disco`); a destra Cerca e Notifiche in dischi 44 `--color-superficie` con `--shadow-disco`, distanza `--space-2`. Stanno sempre su bianco, con qualsiasi sfondo. Il sole non passa mai sotto i comandi.                   |
| Data e saluto                  | Data 400 `--text-sottotitolo-*` `--color-inchiostro-2`, `padding-top: var(--space-8)` nel foglio. Saluto `--text-titolo-pagina-*` peso 400, nome `--weight-pieno`; su una riga a 390, va a capo al 200%. È l'`h1` della pagina.                                                                                                                                                                                |
| Conti                          | Tre colonne `repeat(3, minmax(0, 1fr))`, filo `--color-filo` sopra, sotto e tra le colonne; padding `--space-5` in verticale, `--space-6` a sinistra delle colonne 2 e 3. Numero 700 24/28 cifre tabellari (token nuovo, richiesta 1), etichetta 400 `--text-corpo-*` `--color-inchiostro-2`. Con zero il numero sparisce e la frase va in 600 `--color-inchiostro-2` (`og1-07`, `og1-10`). `--space-6` sopra. |
| Testa della giornata           | «La giornata» 700 `--text-titolo-sezione-*` + meta 400 `--color-inchiostro-2` sulla stessa riga; a destra il + quadrato 44 di A4 (`--color-azione`, `--radius-pulsante`, `--shadow-controllo`). `--space-10` sopra.                                                                                                                                                                                            |
| Ora di «adesso»                | Linea 2 px `--color-adesso` tra le righe, con la pastiglia dell'ora a sinistra: fondo `--color-adesso`, testo **`--color-inchiostro`, il «testo sul giallo»** (`adesso_testo` `#10262A` di `tokens.json`), 600 `--text-tag-*`, cifre tabellari, raggio `--radius-capsula`, alta 24 (`--size-etichetta`), padding `0 var(--space-2)`. Mai `--color-insieme-testo`, mai bianco.                                  |
| Riquadri di casa               | Uno sotto l'altro, a tutta larghezza, distanza `--space-3`; `--space-6` sopra il primo. Bordo 1 px `--color-filo-2`, raggio `--radius-l`, padding `--space-4`, nessuna ombra. Testa: titolo 700 `--text-titolo-barra-*` + conto 400 `--color-inchiostro-2`; a destra il + leggero (cerchio 32 a filo `--color-filo-2`, area 44). Righe con la spunta neutra di F4b; «Altre 3 cose» collegamento `.lk2`.        |
| Riquadro «Solo il conto»       | Una riga sola dentro lo stesso bordo: titolo 700 + conto, freccia sottile B a destra; tutta la riga porta alla pagina («Scadenze · 2»).                                                                                                                                                                                                                                                                        |
| «Domani» di notte (`og1-07`)   | Riquadro come sopra, senza +: «Domani» + «3 impegni», righe impegno 2.0. Prende il posto della giornata nella fascia della notte (sezione 3).                                                                                                                                                                                                                                                                  |
| Cima raccolta (`og1-03`)       | Scorrendo oltre la scena: barra bianca alta `--size-barra-alta`, filo sotto `--color-filo`, stessi tre comandi nudi (lente su `--color-scelta-tenue`, icone 24 senza disco). `position: sticky`.                                                                                                                                                                                                               |
| Personalizza (`og1-15`)        | Pagina con freccia D, `h1` 700 30/36, sottotitolo 17/25. Gruppi «In Oggi 5» / «Non in Oggi 3» 700 21/27 con conto 400. Righe B con maniglia `grip-vertical` 24 a sinistra (pulsante, area 44), misura a destra in grigio + freccia sottile; righe da aggiungere con il cerchio + 44 a filo.                                                                                                                    |
| Foglio della misura (`og1-16`) | Foglio F4c: riga con interruttore «In Oggi» (icona `eye`), etichetta «Misura», due schede di scelta A con icona; piede «Annulla» / «Salva».                                                                                                                                                                                                                                                                    |

**Ore della scena e del saluto.** Quattro momenti fissi (risposta 119): mattino 5:00–12:59 «Buongiorno», pomeriggio 13:00–17:59 «Buon pomeriggio», sera 18:00–21:59 «Buonasera», notte 22:00–4:59 «Buona notte» (come `og1-07`; la notte comincia con il silenzio delle 22, risposta 87). `formatGreeting` di `src/lib/datetime.ts` oggi conosce tre momenti: va esteso (richiesta 4). Il cambio avviene al minuto, con la pagina aperta.

**Al buio c'è sempre la scena della notte.** Nella fascia della notte la cima mostra sempre una scena notturna, qualunque sfondo sia scelto: la casa e la città hanno la loro (`sf1-03`, `sf1-09`); il mare, lo sfondo semplice e la foto passano alla **casa di notte** (`sf1-03`), perché per loro la notte non è disegnata. Vale anche con il tema scuro (sezione 5), a qualsiasi ora. Di notte la campanella non ha il punto (decisione 87).

### Computer (1280 e 1440) e finestra stretta

Disegno in `computer/oggi/`. Da 760 px niente scena a tutta larghezza né comandi sulla scena: barra laterale di F5 con la lente in cima, barra in alto con «Oggi» (700 26/32), ricerca, Notifiche e «Nuovo impegno» (tasto N).

| Larghezza                    | Disposizione                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1280 (`01`)                  | Fascia: a sinistra data 15/20, saluto 500 34/40 −0,6 px (nome 700), conti 700 24/28 con etichetta 13,5/18 affiancati con filo verticale; a destra la scena 400 × 172, raggio 20. Sotto, griglia `minmax(0, 7fr) minmax(0, 5fr)`, canalina `--space-8`: giornata e riquadri di casa a sinistra; «I prossimi giorni» (da domani, due giorni) e «Apri il calendario» (pulsante quieto) a destra. |
| 1440 (`02`)                  | Contenuto fermo a 1200. Tre colonne `minmax(0, 1fr)`: giornata · riquadri di casa · prossimi giorni. La scena resta a destra della fascia.                                                                                                                                                                                                                                                    |
| Pannello aperto (`03`, `04`) | Barra a icone, pannello 420. Se al contenuto restano meno di 900 px la scena si nasconde e la seconda colonna scende sotto la prima (1280); a 1440 restano due colonne e la scena, più stretta.                                                                                                                                                                                               |
| 760–1099 (`09`)              | Barra a icone, una colonna, scena piccola 300 × 156.                                                                                                                                                                                                                                                                                                                                          |

- Il + della giornata e dei riquadri è un solo «+» leggero (Passo 11), non il quadrato pieno del telefono: l'azione piena è «Nuovo impegno» in alto.
- «Stasera si mangia» (cena) e la riga di Pasti compaiono solo quando Pasti esiste (default 8); fino ad allora la colonna destra ha solo «I prossimi giorni».
- La linea di «adesso» usa `--color-adesso`, come sul telefono: `#E2B93B` del canvas resta «da chiarire» (`computer.md`) e non si usa.
- Personalizza su computer: la stessa pagina nella colonna di lettura `--size-lettura-max`; il foglio della misura è la finestra al centro media (480).
- A 1280 la cima non si raccoglie: la barra in alto è già fissa.

### Web da telefono

Come l'app a 390, con tre differenze (`web-da-telefono/01`, `08`, `11`):

- niente splash: si apre con lo scheletro della sezione 3;
- **la cima parte raccolta**: barra bianca di `og1-03`, senza scena; sotto, data, saluto, conti e giornata come nell'app (in `01` la pagina è già scorsa fino alla giornata: vedi domanda 5);
- senza rete nella scheda del browser vale la pagina di sistema `11` («Qui serve la connessione»), non `rt1-23`; con l'icona sulla Home vale `rt1-23`.

La barra dell'app resta in basso; dove la barra del browser sta in basso, quella dell'app le resta sopra con il suo margine (`env(safe-area-inset-bottom)`).

## 3. Stati

| Stato                                    | Cosa si vede                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pieno                                    | `og1-02` (Io), `og1-04` (Nest), `og1-09` (coppia).                                                                                                                                                                                                                                                                                                                                     |
| Caricamento                              | Scena, comandi, data e saluto subito (li sa il telefono); conti a tre `.skeleton` alti 30 raggio `--radius-s`; giornata: barra del titolo + quattro righe (cerchio 40 + due barre). Stesse misure del contenuto vero. `aria-busy="true"` sul contenitore e «Caricamento in corso». Se c'è la giornata salvata, niente scheletro: si vede quella e si aggiorna da sola. Computer: `06`. |
| Rete lenta (oltre 2 s, con dati salvati) | `rt1-22`: riga quieta sotto i conti, icona `refresh-cw` 20 che gira piano (`--durata-ampia` × 3 per giro; ferma con movimento ridotto), testo 400 `--color-inchiostro-2`. Sparisce in 150 ms quando arrivano i dati.                                                                                                                                                                   |
| Vuoto: giornata libera                   | `og1-11`: riquadro vuoto nel posto della giornata, il resto uguale. Conto «Nessun impegno».                                                                                                                                                                                                                                                                                            |
| Vuoto: niente più oggi, di notte         | Dalle 22:00, se oggi non restano impegni, al posto della giornata il riquadro «Domani» (`og1-07`); se anche domani è vuoto, il riquadro dice «Domani è libero» senza righe.                                                                                                                                                                                                            |
| Riquadro di casa vuoto                   | Componente «Vuoti» di F4a: tutto il riquadro è il pulsante, + leggero, titolo e frase (sezione 4). Un riquadro spento non si vede.                                                                                                                                                                                                                                                     |
| Primo giorno                             | `og1-10` (telefono), `computer/oggi/05`. Su computer il saluto è «Ciao, Marco» e i conti mostrano `0`: vale la tavola del computer lì e `og1-10` sul telefono («Nessun impegno», «Niente da fare», «Spesa vuota»).                                                                                                                                                                     |
| Aggiornamento non riuscito               | `og1-13`: avviso d'errore pieno `--color-allerta-fondo` sotto i conti, icona `triangle-alert` `--color-allerta`, «Riprova» `.lk2` in linea. La pagina resta usabile.                                                                                                                                                                                                                   |
| Senza rete, con dati salvati             | `rt1-23`: avviso **bordato** (filo `--color-filo-2`, fondo bianco, icona `wifi-off`), fermo sotto i conti, senza «Riprova». Le cose aggiunte compaiono con «In attesa di connessione» sotto la riga (F7, #148). Computer: `07` (lì fondo rosa e «Riprova», come disegnato).                                                                                                            |
| Senza rete e niente di salvato           | `rt1-24`: cima com'è, sotto l'errore di pagina 2.0 con `wifi-off` e «Riprova» secondario.                                                                                                                                                                                                                                                                                              |
| Errore senza dati, con la rete           | Stesso schema di `rt1-24` con icona `circle-alert` e i testi della sezione 4.                                                                                                                                                                                                                                                                                                          |
| Spunta in un riquadro                    | `4-6-la-spunta`: la riga diventa «Fatto da te alle 19:22», resta `--durata-ampia` e scende in fondo; attenuata (`--opacity-passato`), non barrata.                                                                                                                                                                                                                                     |
| Spunta non salvata                       | `4-6-non-salvata`: la casella torna vuota, toast «Non siamo riusciti a segnarlo. Riprova.» senza icona.                                                                                                                                                                                                                                                                                |
| Personalizza salvata / non salvata       | Torna a Oggi con il nuovo ordine, nessun toast (si vede). Errore: avviso d'errore in cima alla pagina Personalizza, l'ordine resta quello scelto, «Riprova».                                                                                                                                                                                                                           |
| Disabilitato                             | Senza rete «Salva» di Personalizza è disabilitato (`--opacity-disabilitato`) con la riga d'aiuto della sezione 4.                                                                                                                                                                                                                                                                      |

## 4. Testi che le PNG non hanno

Tutti in `src/components/oggi/messages/it.ts` (CA-i18n); i plurali con `{ zero, one, other }`. Chiavi in inglese, indicative.

| Chiave                 | Testo                                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `greeting.*`           | «Buongiorno», «Buon pomeriggio», «Buonasera», «Buona notte», «Ciao» (primo giorno su computer e prima dello sblocco senza nome, risposta 150). |
| `counts.events`        | zero «Nessun impegno» · one «impegno» · other «impegni» (il numero sta sopra)                                                                  |
| `counts.todos`         | zero «Niente da fare» · «da fare»                                                                                                              |
| `counts.shopping`      | zero «Spesa vuota» · «in spesa»                                                                                                                |
| `day.meta`             | «restano {count} impegni» · «resta 1 impegno» · «finiti per oggi» (tutti passati)                                                              |
| `tomorrow.empty`       | «Domani è libero»                                                                                                                              |
| `box.todo.empty`       | titolo «Niente da fare per te» · frase «Aggiungi una cosa che tocca a te.»                                                                     |
| `box.shopping.empty`   | titolo «La spesa è vuota» · frase «Scrivi quello che manca, anche più cose insieme.»                                                           |
| `box.deadlines.empty`  | titolo «Nessuna scadenza in vista» · frase «Bollo, rinnovi, vaccini di Biscotto: aggiungili e ti avvisiamo prima.»                             |
| `box.more`             | «Altre {count} cose» · one «Un'altra cosa»                                                                                                     |
| `box.done`             | «Fatto da te alle {time}» · «Fatto da {name} alle {time}»                                                                                      |
| `slow`                 | «Aggiorno… Intanto vedi le cose com'erano alle {time}.»                                                                                        |
| `offline`              | «Senza rete. Vedi le cose com'erano alle {time}; quello che aggiungi parte appena torna.»                                                      |
| `updateFailed`         | «Non siamo riusciti ad aggiornare. Vedi le cose com'erano alle {time}.» + «Riprova»                                                            |
| `error.offline`        | «Non riusciamo a caricare la giornata» · «Sembra che manchi la rete. Appena torna, la giornata compare da sola.» · «Riprova»                   |
| `error.generic`        | «Non riusciamo a caricare la giornata» · «Riprova tra qualche istante. Se non passa, controlla la connessione.» · «Riprova»                    |
| `check.failed`         | «Non siamo riusciti a segnarlo. Riprova.»                                                                                                      |
| `customize.offline`    | «Senza rete non possiamo salvare l'ordine. Riprova quando torna.»                                                                              |
| `customize.saveFailed` | «Non siamo riusciti a salvare. Controlla la connessione e riprova.» + «Riprova»                                                                |
| `aria.lens`            | gruppo «Che cosa vedi»; voci «Io», «Nest» con `aria-pressed`                                                                                   |
| `aria.add`             | + della giornata «Nuovo impegno»; + dei riquadri «Aggiungi alla spesa», «Aggiungi una cosa da fare», «Aggiungi una scadenza»                   |
| `aria.handle`          | «Sposta {name}» · annunci «{name}, posizione {n} di {total}», «{name} spostato in posizione {n}», «Spostamento annullato»                      |
| `aria.now`             | «Adesso, {time}» sulla linea (`role="separator"`)                                                                                              |
| `aria.bell`            | «Notifiche» · «Notifiche, {count} nuove»                                                                                                       |

## 5. Tema scuro

Fuori dal lancio (risposta 128) e non disegnato: arriva dopo il Passo 12. Per non rifare la pagina:

- La pagina usa solo i token semantici della tavolozza comune (`--color-carta`, `--color-superficie`, `--color-inchiostro*`, `--color-filo*`, `--color-azione`, `--color-adesso*`, `--color-insieme*`, `--color-allerta*`, `.membro-*`): il tema scuro cambierà i valori in un punto solo, senza toccare Oggi. Nessun colore scritto a mano, nessun `prefers-color-scheme` nella pagina.
- **Con il tema scuro attivo la cima mostra sempre la scena della notte**, a qualsiasi ora (regola della sezione 2).
- Le parti già scure oggi (toast, scena notturna) restano come sono: il testo sopra la scena notturna non c'è (i comandi sono su dischi bianchi).
- I valori scuri della tavolozza comune (`palette.css` del canvas, tema diverso da `th-l`) non sono stati estratti: si aggiungono con il lavoro del tema scuro, non qui.

## 6. Componenti usati e richieste

Usati: avvisi (pieno, bordato), errore di pagina, vuoti, toast, righe B, + leggero, collegamento, pulsanti (F4a #503); spunta neutra, lente come selettore, schede di scelta A (F4b #504); fogli, finestra (F4c #505); testata, barra, barra laterale, ricerca (F5 #506); righe impegno 2.0 e riga «Liberi insieme» (richieste di A2/A4).

Da chiedere con `richiesta-condivisa` (il designer le definisce nella skill nella stessa PR `shared/*`):

1. **F2, testo dei conti:** `--text-conto-size: 1.5rem`, `--text-conto-line: 1.75rem` (24/28, 700, dal canvas `D-AC1:80–88`); su computer etichetta 13,5/18 (`--text-conto-etichetta-*: 0.84375rem / 1.125rem`).
2. **F2, scena della notte:** `--color-scena-notte-*` (cielo, case, finestre accese, luna) per la casa e la città. I valori non sono in `tokens.md`: si prendono dal canvas (`P5-SF1`); misurati nelle PNG, da confermare: cielo della città `#0D223D`–`#182A44`, finestre `#FFD9A0`.
3. **Sprite delle icone:** `grip-vertical` (maniglia), `rows-2` (Esteso), `minus` (Solo il conto), `cake` (riquadro Compleanni, con B9). Gli altri nomi di `og1-15` (`paw-print`, `eye`, `utensils`) ci sono già.
4. **`src/lib/datetime.ts`:** `formatGreeting` a quattro momenti e una funzione `sceneMoment(now)` (mattino, pomeriggio, sera, notte) con gli stessi confini, usata da scena, saluto e punto della campanella.
5. **Componenti nuovi di pagina** (classi in `components.css`, nomi da definire nella skill): `.cima-oggi` (scena + comandi + foglio, aperta e raccolta), `.conti`, `.riquadro-casa` (esteso e «solo il conto»), `.adesso` (linea con la pastiglia), `.riga-personalizza` (con maniglia).

## 7. Movimenti

| Cosa                               | Movimento                                                                                                                     | Movimento ridotto              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Arrivo dopo lo splash              | tutta la pagina insieme (`sp1-05`); dallo scheletro al contenuto dissolvenza 180–200 ms, niente si sposta                     | dissolvenza, scheletro fermo   |
| Cima che si raccoglie              | la scena esce scorrendo con la pagina; la barra bianca compare quando i comandi toccano il bordo (`--durata-rapida`, opacità) | uguale                         |
| Cambio di momento (es. sera→notte) | dissolvenza 600 ms tra le scene (`sf1-*`)                                                                                     | cambio netto                   |
| Lente Io ↔ Nest                    | voce scelta in `--durata-rapida`; righe in dissolvenza, niente scorrimenti                                                    | uguale                         |
| Spunta                             | cerchio pieno 150 ms; la riga resta `--durata-ampia`, poi scende in `--durata-normale`; vibrazione leggera                    | cambia posto senza scorrere    |
| Personalizza, trascinamento        | la riga presa si alza di 2 px, le altre fanno posto in 200 ms; vibrazione alla presa e al rilascio                            | le righe cambiano posto subito |
| «adesso»                           | la linea passa tra le righe al cambio del minuto, senza animazione                                                            | uguale                         |
| Computer: pannello                 | barra laterale che si stringe 200 ms, pannello da destra                                                                      | cambio immediato               |

## 8. Accessibilità

- Contrasti: testo 15,76:1; secondario `#55686C` 5,86:1; ora di «adesso» inchiostro su `#F6C945` 10,02:1; «Liberi insieme» 9,29:1 (o oltre 13:1 su `#FCEFC0`, vedi A4 domanda 6); avviso d'errore 5,78:1; voce scelta della lente bianco su inchiostro 15,76:1. Il bianco dei comandi sulla scena non ha testo sopra la scena: niente contrasto da verificare con i cieli.
- La scena è decorativa (`aria-hidden`); il momento è già detto dal saluto.
- Ordine del fuoco (telefono): «Vai al contenuto» → lente → Cerca → Notifiche → conti (solo se l'analista li rende toccabili: le PNG non lo dicono, domanda 4) → avviso («Riprova») → + della giornata → righe → riquadri (+, righe, «Altre cose») → barra. Computer: barra laterale, barra in alto, fascia, colonna sinistra, colonna destra, pannello.
- La linea di «adesso» non riceve il fuoco; il colore non è l'unico segno (c'è l'ora scritta).
- Maniglia di Personalizza: pulsante con `aria-describedby` «Spazio per prendere, frecce per spostare, Spazio per lasciare, Esc per annullare»; annunci in `aria-live="polite"` (sezione 4). Il trascinamento non è l'unico modo (regola del computer).
- Aree di tocco ≥ 44: lente (ogni voce), dischi, +, + leggero (cerchio 32 con area 44), caselle delle righe, maniglia, «Altre cose», «Riprova» in linea (area allargata, eccezione «in linea» solo per i link dentro frasi lunghe).
- Testo al 200%: il saluto va a capo; i conti restano tre colonne fino a 320 px di contenitore, poi le etichette vanno a capo sotto il numero; la testa della giornata va su due righe con il + in alto a destra.

## 9. Cosa cambia rispetto alla pagina attuale

- Una cima sola con la scena e tre comandi; via il quadrato del Nest, il logo e il righello (D5, risposta 123: «Il tuo Nest» da Spazi).
- I conti a filo al posto delle schede; la giornata con il + quadrato; i riquadri di casa a tutta larghezza al posto della griglia; nuova pagina Personalizza con il foglio della misura.
- Quattro momenti con la notte e la scena notturna; la campanella senza punto di notte.
- Computer: fascia con la scena a destra e colonne (non più la colonna del telefono centrata).
