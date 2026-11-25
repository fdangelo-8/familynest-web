# #536 · A3 · Impegno: dettaglio, modifica, elimina, privato — dettagli del requisito

Allegato al requisito della issue #536. Lo leggono sviluppatore e tester solo quando serve un testo esatto o un caso limite. In caso di contrasto vale la issue.

Fonti: `docs/design/telefono/app-fase-b/cb1-01 … cb1-05` (passo 6), `decisioni-p8/ap1-36 … ap1-41` (passo 8, foglio e sotto-fogli riusati in Modifica), `pagine-mancanti-p7/mn1-26` (passo 7, «Da verificare» nel dettaglio). Vale il passo più recente. `cb1-06 … cb1-08` (settimana vuota, errore, caricamento del calendario) sono stati del Calendario: li copre A4 #537, non questa pagina.

## 1. Testi esatti

Tutti in `messages/it.ts`. `<…>` è un valore; date e ore in `Europe/Rome`.

### Dettaglio

| Dove                                  | Testo                                                                                                                                                                                                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Freccia indietro (nome accessibile)   | «Indietro»                                                                                                                                                                                                                                                                  |
| Azione in alto a destra               | «Modifica» (icona matita, decorativa)                                                                                                                                                                                                                                       |
| Sotto il titolo, impegno con orari    | «<Giorno della settimana> <g> <mese>, dalle <HH:MM> alle <HH:MM>» (es. «Mercoledì 13 gennaio, dalle 17:00 alle 18:30»). Se finisce un altro giorno vale il testo di oggi (`timeTexts`).                                                                                     |
| Sotto il titolo, tutto il giorno      | «<Giorno della settimana> <g> <mese>, tutto il giorno»; su più giorni «Da <giorno g mese> a <giorno g mese>, tutto il giorno»                                                                                                                                               |
| Sezione                               | «Chi porta e chi riprende»                                                                                                                                                                                                                                                  |
| Righe                                 | «Lo porta», «Lo riprende»; valore: pallino + nome (anche se sei tu, come in `cb1-01`), oppure «Da decidere» (senza pallino), oppure «Nessuno» (senza pallino)                                                                                                               |
| Azione delle righe                    | «Cambia» · nome accessibile «Cambia chi lo porta» / «Cambia chi lo riprende»                                                                                                                                                                                                |
| Sezione                               | «Dettagli»                                                                                                                                                                                                                                                                  |
| Riga «Per chi»                        | pallini + nomi uniti con «e» («Sofia», «Sofia e Tommaso»); «Tutti» se ci sono tutti i membri                                                                                                                                                                                |
| Riga «Dove»                           | valore = luogo; azione «Indicazioni» · nome accessibile «Indicazioni per <luogo>, si apre in un'altra scheda». Se il luogo comincia con `https://`: azione «Apri» (stessa scheda nuova, senza Referer), nome accessibile «Apri il collegamento, si apre in un'altra scheda» |
| Riga «Nota»                           | testo della nota, a capo come scritto                                                                                                                                                                                                                                       |
| Riga «Chi lo vede»                    | `household` «Tutti in casa» · `busy` «Solo io» · `private` (vecchi) «Solo io» · `selected` all'autore «Solo alcune persone: <nomi>», agli scelti «Solo alcune persone»                                                                                                      |
| Azione su «Chi lo vede» (solo autore) | «Cambia» · nome accessibile «Cambia chi lo vede»                                                                                                                                                                                                                            |
| Riga «Si ripete»                      | stesso testo della riga «Si ripete» del foglio di A2 (es. «Ogni mercoledì, fino al 9 giugno», «Ogni anno»)                                                                                                                                                                  |
| Riga «Avviso»                         | «<scelta> prima, a <nomi> e a te» / «… prima, a te» / «… prima, a <nomi>»; con `remind_rides` si aggiunge «; la sera prima e un'ora prima a chi porta e chi riprende». `<scelta>` = etichetta dell'elenco degli avvisi di A2                                                |
| Riga «Origine» (importati, come oggi) | `SourceLabel` + nome del calendario                                                                                                                                                                                                                                         |
| Link in fondo                         | «Elimina l'impegno» (rosso)                                                                                                                                                                                                                                                 |
| Messaggio dopo un salvataggio         | «Modifiche salvate»                                                                                                                                                                                                                                                         |

Destinatari dell'avviso (risposta 11): autore, persone dell'impegno, chi porta, chi riprende; solo adulti (i figli non hanno account), ognuno una volta, nell'ordine dei membri; chi guarda è «te», sempre per ultimo.

### Titolo mascherato

Domanda aperta 1 della issue: finché Francesco non decide, «Occupato · <Nome dell'autore>», uguale nelle righe del calendario (A4–A6) e in Oggi (A1).

### Privato, visto dall'autore (`cb1-04`)

| Dove             | Testo                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sezione          | «Che cosa vedono gli altri»                                                                                                                                                                                                                                                                                                                                                                                        |
| Riga d'anteprima | ora d'inizio; titolo mascherato; sotto «Fino alle <HH:MM>»; lucchetto decorativo; pallino dell'autore                                                                                                                                                                                                                                                                                                              |
| Didascalia       | «<nomi> vedono solo l'orario e la parola «occupato». Titolo, luogo e note restano tuoi. Vale anche per le notifiche.» Con un solo nome: «<nome> vede solo …». `<nomi>` = tutti i membri del nucleo tranne te e gli animali; per `selected` tranne te, gli scelti e i coinvolti (se non resta nessuno la sezione non c'è). La frase su «Chiedi a …» si aggiunge solo quando B15 #386 è unita (default 8 del piano). |

### Privato, visto da un altro (`cb1-05`)

| Dove                     | Testo                                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Titolo (foglio o pagina) | titolo mascherato                                                                                                                              |
| Testo                    | «<Giorno della settimana> <g>, dalle <HH:MM> alle <HH:MM>. <Nome> ha scelto di non mostrare che cos'è: tu vedi solo che in quell'ora non c'è.» |
| Testo piccolo            | «Se ti serve proprio quell'ora, chiediglielo: da qui non si può spostare né aprire.»                                                           |
| Pulsante                 | «Ho capito»                                                                                                                                    |

### Da verificare (`mn1-26`)

| Campi in `unverified_fields` | Testo del riquadro                                                            |
| ---------------------------- | ----------------------------------------------------------------------------- |
| uno                          | «<Campo> l'abbiamo dedotto dalla tua frase. Va bene?» («dedotta» per «L'ora») |
| più di uno                   | «<Campo>, <campo> e <campo> li abbiamo dedotti dalla tua frase. Vanno bene?»  |
| Azione                       | «Sì, confermo»                                                                |

Nomi dei campi: `title` «Il titolo», `day` «Il giorno», `time` «L'ora», `members` «Per chi» tra caporali, `location` «Il luogo»; dopo il primo, iniziale minuscola («L'ora e «per chi» …»). Ordine: titolo, giorno, ora, per chi, luogo. Esempio di `mn1-26`: «L'ora e «per chi» li abbiamo dedotti dalla tua frase. Vanno bene?».

Segno sui valori: «<valore> · da verificare» sulle righe «Giorno», «Ora», «Per chi», «Dove». Le righe «Giorno» e «Ora» compaiono in cima a «Dettagli» solo quando quel campo è da verificare (valori «Mercoledì 13 gennaio», «17:00»), ciascuna con «Cambia». Per il titolo resta il solo riquadro.

### Modifica

| Dove                      | Testo                                                                                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Titolo del foglio         | «Modifica l'impegno»                                                                                                                                                    |
| Chiusura                  | X, nome accessibile «Chiudi»                                                                                                                                            |
| Azione                    | «Salva»                                                                                                                                                                 |
| Campi                     | gli stessi del foglio «Nuovo impegno» di A2, stessi testi ed errori; senza «Scrivilo con una frase», «Cosa portare», «Fine della scuola», «Salta i giorni senza scuola» |
| Errore di salvataggio     | «Non riusciamo a salvare le modifiche. Controlla la connessione e riprova.» (come oggi)                                                                                 |
| Importato, campi bloccati | «Si cambia su <fornitore>» (come oggi)                                                                                                                                  |

### Salvare un impegno ripetuto (testi di oggi, `src/lib/event-texts.ts`)

- Titolo: «Salvare le modifiche a «<titolo>»?»
- Solo campi della volta cambiati → due scelte: «Salva solo questo» (primaria), «Salva tutti i prossimi»; testo `saveChoiceText` di oggi.
- Cambiato qualcosa della serie → una scelta: «Salva tutti i prossimi»; testo `saveAllText` di oggi, con questi nomi in più nell'elenco «Hai cambiato …»: «tutto il giorno», «l'avviso», «le persone che lo vedono».

| Campo                                                                                                                    | Vale per la sola volta?           |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| Titolo, giorno, orari, dove, nota, lo porta, lo riprende, «Da decidere»                                                  | sì (`update_event_occurrence`)    |
| Tutto il giorno, si ripete (frequenza, giorni, fino a), per chi, avviso, avviso a chi porta, chi lo vede, persone scelte | no: solo «Salva tutti i prossimi» |

Regola di oggi che resta: un adulto che non vede l'impegno si può scegliere in «Lo porta» o «Lo riprende» solo con «Salva tutti i prossimi» (`escortRefusedText`, esteso a «Lo riprende»).

### Foglio «Chi porta e chi riprende» aperto dal dettaglio (`ap1-39`)

- Titolo «Chi porta e chi riprende»; gruppi «Lo porta» e «Lo riprende»; pastiglie: gli adulti del nucleo che vedono l'impegno per intero, con il pallino, poi «Da decidere». Toccare la pastiglia già scelta la toglie (= «Nessuno»).
- Niente interruttore «Avvisa chi porta e chi riprende» e niente frase «Vale «di solito»…» (sono della serie, stanno in Modifica). Al loro posto, se l'impegno si ripete: «Vale solo per <giorno della settimana> <g>. Per tutte le volte usa «Modifica».» (testo da confermare dal designer).
- Piede: «Annulla» a sinistra, «Fatto» a destra. Errore: «Non riusciamo a salvare le modifiche. Controlla la connessione e riprova.»

### Eliminare

| Dove                       | Testo                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Titolo del dialogo         | «Eliminare «<titolo>»?»                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Testo                      | [«Si ripete <regola>.»] + persone + «Per qualche secondo potrai annullare.» Persone: «<nome> non lo vedrà più.» / «<nomi> non lo vedranno più.»; senza persone e senza ripetizione: «Sparisce dal calendario.» Persone = autore, persone dell'impegno, chi porta, chi riprende, senza te e senza animali (come `peopleToTell`, più chi riprende). Esempio `cb1-03`: «Si ripete ogni mercoledì. Laura e Sofia non lo vedranno più. Per qualche secondo potrai annullare.» |
| Pulsanti, impegno ripetuto | «Solo <giorno della settimana> <g>» (secondario, bordato) · «Questo e tutti i prossimi» (rosso pieno) · «Annulla» (testo)                                                                                                                                                                                                                                                                                                                                                |
| Pulsanti, impegno singolo  | «Elimina» (rosso pieno) · «Annulla» (testo)                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Messaggio dopo             | «Eliminato: <titolo>.» / «Eliminato <giorno g mese>: <titolo>.» / «Eliminato da <giorno g mese> in poi: <titolo>.» (`deleteToast` di oggi) + «Annulla»                                                                                                                                                                                                                                                                                                                   |
| Errore dopo il messaggio   | «Non riusciamo a eliminare l'impegno. Controlla la connessione e riprova.»                                                                                                                                                                                                                                                                                                                                                                                               |

## 2. Chi può fare che cosa

| Azione                     | `household`      | `busy` / `selected`, autore | `busy` / `selected`, scelto o coinvolto             | mascherato      | importato                         |
| -------------------------- | ---------------- | --------------------------- | --------------------------------------------------- | --------------- | --------------------------------- |
| Vedere il dettaglio        | tutti gli adulti | sì                          | sì                                                  | solo «occupato» | sì (secondo «Chi lo vede»)        |
| Modifica                   | sì               | sì                          | sì, senza persone e chi lo vede (lucchetti di oggi) | no              | solo l'autore, solo «Chi lo vede» |
| «Cambia» su porta/riprende | sì               | sì                          | no (DB-1 regola 3)                                  | no              | no (sezione nascosta)             |
| «Cambia» su chi lo vede    | solo autore      | sì                          | no                                                  | no              | solo autore                       |
| Elimina                    | sì               | sì                          | sì                                                  | no              | no                                |
| «Sì, confermo»             | sì               | sì                          | sì                                                  | no              | —                                 |

Vecchi `private`: li vede solo l'autore (come oggi); per gli altri l'indirizzo dà «Questo impegno non c'è più».

## 3. Eliminazione con «Annulla»: come funziona

1. Conferma nel dialogo → il dialogo si chiude, l'app va al Calendario nella settimana dell'occorrenza (`calendarHref` di oggi) e mostra il messaggio con «Annulla» per 5 secondi (durata del toast; si ferma con il puntatore sopra o il fuoco dentro, come oggi).
2. Durante quei secondi l'eliminazione **non è ancora mandata**: è in un elenco «in attesa» nel browser; la lettura comune degli impegni la toglie da Oggi, Calendario e Ricerca.
3. «Annulla» → si toglie dall'elenco, l'impegno ricompare, nessuna richiesta parte.
4. Fine del messaggio, un altro messaggio che lo sostituisce, o `pagehide` (scheda chiusa, app in secondo piano) → parte l'eliminazione di oggi (`deleteEvent` con l'ambito scelto; per `pagehide` con `keepalive`).
5. Errore della richiesta → l'impegno ricompare e compare il messaggio d'errore.
6. Nessun testo dell'impegno è salvato in `localStorage` o simili: l'elenco «in attesa» vive solo in memoria.
