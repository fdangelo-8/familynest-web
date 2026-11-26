# #549 · A16 Spazi: tessere e righe, punto delle novità, «Il tuo Nest» in fondo

Dettagli del requisito della issue #549 (analista, 26/11/2026). Nella issue ci sono le regole principali e i CA; qui il catalogo, i testi completi e i casi. Se issue e file si contraddicono, vale la issue.

Fonti: `docs/design/telefono/scelte-p7/sc1-18`, `sc1-19`; `app-fase-b/cb1-28`, `cb1-29`, `cb1-30`, `cb1-33` (con le note); risposte 123, 129, 133, 140, 154, 183 di `decisioni-fable.md`; `docs/design/computer/regole.md` §2; requisito di F5 #506 (§2, §3, §11 di `506-guscio-navigazione.md`); default 8 del piano #501; codice attuale in `src/components/esplora/` e `src/lib/spaces.ts`.

## §1 Catalogo degli spazi nuovi

Ordine fisso del design (`cb1-28`). La colonna «Si vede quando» vale **insieme** alla regola della rotta: uno spazio si vede solo se la sua pagina esiste già nell'elenco esplicito delle rotte di F5 (`src/lib/app-routes.ts`, default 8 del piano: «al lancio si vedono solo gli spazi già costruiti, che crescono via via»).

| #   | Spazio             | Icona      | Pagina di destinazione (issue che la costruisce) | Lancio | Si vede quando (oltre alla rotta)            | Riga sotto il nome                                                                                                                                   |
| --- | ------------------ | ---------- | ------------------------------------------------ | ------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Animali            | zampa      | spazio «Zampe» (A25c #559)                       | sì     | il Nest ha almeno un animale (`kind = pet`)  | nomi degli animali nell'ordine del Nest: «Biscotto e Miele»                                                                                          |
| 2   | Ricette            | cappello   | Ricette (B13a #566)                              | no     | sempre                                       | la dà B13a (design: «8 vostre»)                                                                                                                      |
| 3   | Pasti              | posate     | Pasti (B14 #382)                                 | no     | sempre                                       | la dà B14 (design: «Stasera: pasta al pesto»)                                                                                                        |
| 4   | Liste da riusare   | lista      | Liste da riusare (B12 #378)                      | no     | sempre                                       | la dà B12 (design: «4 liste»)                                                                                                                        |
| 5   | Compleanni         | torta      | Compleanni (B9 #387)                             | no     | sempre                                       | la dà B9 (design: «Nonna Anna, sabato»)                                                                                                              |
| 6   | Liste dei desideri | regalo     | elenco «Le liste dei figli» (A15 #548, `cb1-23`) | sì     | il Nest ha almeno un figlio (`kind = child`) | figli con almeno un'idea, nell'ordine del Nest: «Sofia: 5 idee · Tommaso: 3 idee»; «1 idea» al singolare; nessun figlio con idee: nessuna riga sotto |
| 7   | Documenti          | cartella   | Documenti (B17 #380)                             | no     | sempre                                       | la dà B17 (design: «12 file»)                                                                                                                        |
| 8   | Contatti           | telefono   | Contatti (B19 #385)                              | no     | sempre                                       | la dà B19 (design: «18 numeri utili»)                                                                                                                |
| 9   | Luoghi             | segnaposto | Luoghi (B20 #383)                                | no     | sempre                                       | la dà B20 (design: «6 luoghi»)                                                                                                                       |

- Gli spazi «dopo il lancio» sono nel catalogo con la sola struttura (nome, icona, posto): la loro riga sotto e la condizione di visibilità le scrive la loro issue quando aggiunge la rotta. A16 non legge le loro tabelle.
- Animali e Liste dei desideri sono del lancio ma le loro pagine arrivano con A25c (ondata 9) e A15 (ondata 9): quando A16 viene unita (ondata 5) **nessuno spazio si vede ancora** e la pagina mostra solo «Il tuo Nest» (§3, stato «nessuno spazio»). È voluto (default 8).
- Spazi del vecchio Esplora (A tavola, Noi due, Stare bene, Tempo insieme, Passioni, Casa in ordine, Progetti, Conti chiari, Crescere, Zampe come «In arrivo»): non compaiono più in `/spazi` (Esplora resta dentro Spazi, risposta 154; Tempo insieme e Stare bene sono della gamification, dopo il lancio). Le pagine `/spazi/<spazio>` e `src/lib/spaces.ts` **restano come sono** finché le usa Oggi (A1 #534): A16 toglie solo i link da `/spazi`.
- Etichetta grigia «Anteprima» su una funzione in prova (`cc1-46`): è di B6 #565, non di A16.

## §2 Tessere e righe

- I primi **quattro spazi visibili**, nell'ordine di §1, sono tessere (risposta 133); gli altri sono righe. Esempi:
  - tutti visibili (`cb1-28`): tessere Animali, Ricette, Pasti, Liste da riusare; righe Compleanni, Liste dei desideri, Documenti, Contatti, Luoghi;
  - senza animali e senza figli (`cb1-30`): tessere Ricette, Pasti, Liste da riusare, Compleanni; righe Documenti, Contatti, Luoghi;
  - solo Animali e Liste dei desideri (il lancio): due tessere, nessuna riga.
- Tessera: icona in alto, nome (grassetto), riga sotto. Due per riga sul telefono. La riga sotto può andare a capo (`cb1-30`, Compleanni).
- Riga: icona a sinistra, nome, riga sotto, freccia sottile B a destra; tutta la riga si tocca (Componenti 2.0).
- Tessera e riga sono un solo link verso la pagina dello spazio. Nome accessibile: comincia con il nome dello spazio (LEZIONI, axe `label-content-name-mismatch`); la riga sotto è dentro il link.

## §3 Stati

| Stato                  | Quando                                                          | Che cosa si vede                                                                                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pieno                  | almeno uno spazio visibile                                      | frase in cima, tessere, righe, eventuale frase «senza figli» (sotto), filo, «Il tuo Nest»                                                                                                                                        |
| Nessuno spazio         | nessuno spazio visibile (oggi: sempre, fino ad A15/A25c)        | solo il filo e la riga «Il tuo Nest»; niente frase in cima **(default, domanda 1)**                                                                                                                                              |
| Senza figli            | nessun `kind = child` e Liste dei desideri ha la rotta          | sotto le righe, prima del filo, la frase di `cb1-30` adattata (domanda 2)                                                                                                                                                        |
| Caricamento            | lettura in corso                                                | scheletro di tessere e righe deciso dal designer; con movimento ridotto non pulsa. «Il tuo Nest» c'è già (non dipende dai dati)                                                                                                  |
| Errore (senza copia)   | la lettura fallisce (rete o server) e non c'è una copia salvata | avviso in cima `cb1-33`: «Non riusciamo ad aggiornare gli Spazi.» e il link «Riprova»; sotto, gli spazi con la rotta **tutti come righe** (come `cb1-33`), senza riga sotto e senza filtro su animali e figli; poi «Il tuo Nest» |
| Errore (con copia, F7) | come sopra, con la copia salvata sul telefono da F7 #148        | avviso «Non riusciamo ad aggiornare gli Spazi. Vedi quello che era salvato alle {15:40}.» + «Riprova»; righe della copia con la riga sotto «Salvato alle {15:40}» (ora di Roma, `H:MM`). Si attiva solo quando F7 esiste         |

- «Riprova» rifà la lettura; durante la lettura il link ha `aria-busy` e l'avviso resta.
- Errore parziale (una delle letture fallisce) = errore: mai una pagina con un pezzo mancante e `ok: true` (LEZIONI).
- Il ripiego di `cb1-33` per Ricette («Le vostre ci sono; il catalogo torna con la rete») è di B13a.

## §4 Testi (in `messages/it.ts`, gruppo proposto `spaces`)

| Chiave proposta     | Testo                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `intro`             | «Tutto quello che non è calendario, spesa o cose da fare. Ogni cosa ha una pagina sua.»                                  |
| nomi                | «Animali», «Ricette», «Pasti», «Liste da riusare», «Compleanni», «Liste dei desideri», «Documenti», «Contatti», «Luoghi» |
| `ideas`             | «{nome}: {n} idee» / «{nome}: 1 idea», separatore « · »                                                                  |
| `noChildren`        | domanda 2                                                                                                                |
| `error`             | «Non riusciamo ad aggiornare gli Spazi.» · «Riprova»                                                                     |
| `errorSaved`        | «Non riusciamo ad aggiornare gli Spazi. Vedi quello che era salvato alle {ora}.» · «Salvato alle {ora}»                  |
| «Il tuo Nest»       | dal punto unico di F3; riga sotto «Persone, piano, impostazioni» (già in F5 §11)                                         |
| titolo della scheda | «Spazi» con il nome del prodotto (F5 §2)                                                                                 |

Nomi di animali e figli: uniti con la funzione unica (`joinNames`, «Biscotto e Miele», «A, B e C»). Nessun troncamento: la riga sotto va a capo.

## §5 Computer (da 760 px)

Spazi su computer non è disegnato (risposta 183 aperta): vale il telefono adattato con `regole.md` §2.

- Una colonna di contenuto larga al massimo 720 px, allineata a sinistra nell'area del contenuto **(default)**.
- Tessere: griglia che si dispone da sola, tessere larghe almeno 220 px, quante ne entrano nella colonna (`regole.md` §2); restano solo le prime quattro.
- Righe alte 52–56 px; passaggio del mouse: fondo grigio chiaro (`regole.md` §8); niente azioni che compaiono solo col mouse.
- Testata e barra in alto: quelle di F5 (titolo «Spazi», Cerca, Notifiche; nessun «Nuovo impegno»).
- Frecce su e giù tra le righe (`regole.md` §10): **non** in A16 (default; nessuna pagina le ha ancora; arrivano con il riallineamento generale).

## §6 Dati letti

Con la sessione dell'utente, solo nel suo Nest, solo le colonne mostrate:

| Serve a                     | Tabella e colonne                                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Animali visibile e nomi     | `household_members`: `id`, `name`, `kind`, `created_at` (ordine del Nest) dove `kind = pet`                                        |
| Liste dei desideri visibile | `household_members`: `id`, `name`, `kind`, `created_at` dove `kind = child`                                                        |
| Conti delle idee            | `wishlists` (`id`, `member_id`) e numero di `wishlist_items` per `wishlist_id` (solo il conteggio, mai titoli, prezzi, link, note) |

- Non si leggono date di nascita, colori, account, mail, codici dei link condivisi.
- Le due letture servono solo se il relativo spazio ha la rotta: finché A15 e A25c non ci sono, la pagina **non legge nulla** dal database.
- Niente nomi, conti o id nei log, negli eventi o nell'indirizzo.

## §7 Accessibilità

- Un solo `h1` (la testata di F5 «Spazi» è `p` se la pagina scrive il suo `h1`; decide F5 con `titleIsHeading`). Le tessere sono una `ul` con nome «Spazi principali» **(default)**, le righe una `ul` senza nome; «Il tuo Nest» fuori dalle due liste.
- Area di tocco: tutta la tessera e tutta la riga (≥ 44 × 44).
- Avviso d'errore `role="alert"`; «Riprova» è un `button`.
- Movimento ridotto: nessuna animazione propria (lo scheletro non pulsa).

## §8 Test da toccare nella stessa PR

| File                                                                                                                              | Cosa                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| test di F5 su `/spazi` (CA-15 di #506: «il contenuto di Esplora»)                                                                 | ora: pagina A16                                                                             |
| `tests/e2e/esplora*.spec.ts`, `spaces.spec.ts`, `percorso-casa-esplora-impostazioni.spec.ts`, `tests/a11y/membri-esplora.spec.ts` | la parte su `/spazi` (fissare, «In arrivo» da `/spazi`) esce; resta ciò che Oggi usa ancora |
| riferimenti visivi di `/spazi`                                                                                                    | rigenerati con `visual-baseline`; la PR li elenca                                           |
