# #535 · A2 Aggiungi: foglio «Nuovo impegno», frase, «Da verificare», sovrapposti

Dettagli del requisito della issue #535 (analista, 25/11/2026). Nella issue ci sono le regole principali e i CA; qui i comportamenti e i testi completi, da leggere quando si sviluppa o si testa.

Fonti: `docs/design/telefono/decisioni-p8/ap1-36 … ap1-43`, `docs/design/telefono/pagine-mancanti-p7/mn1-21, mn1-24 … mn1-26`, `splash-p9/sp1-14`, risposte 11, 80, 81, 89, 93, 146, 160, 163, 167, 171 di `decisioni-fable.md`, requisito di DB-1 #510, codice in `src/components/aggiungi/` e `src/components/evento-modulo/`.

Il foglio a campi (`ap1-36`, Passo 8) è il punto di partenza; la frase (`mn1-24`, Passo 7) si apre da «Scrivilo con una frase» (vale il passo più recente; note di `ap1-36` e `sp1-14`).

## 1. Foglio «Nuovo impegno» (`ap1-36`, `ap1-37`)

In cima: X a sinistra (chiude senza salvare, come Esc), titolo «Nuovo impegno», «Salva» a destra. Nessuna conferma alla chiusura.

| Elemento                 | Valore iniziale                                                                                                                                                                     | Comportamento                                                                                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Titolo                   | vuoto, con il fuoco                                                                                                                                                                 | massimo 100 caratteri (il campo non accetta oltre); spazi iniziali, finali e doppi tolti al salvataggio (vincoli `events_title_*`)                                           |
| «Scrivilo con una frase» | —                                                                                                                                                                                   | apre il passo frase (§3)                                                                                                                                                     |
| Giorno                   | oggi a Roma, o `?giorno=AAAA-MM-GG` se valido                                                                                                                                       | selettore di data di F4c; formato «Mercoledì 18 novembre», con l'anno solo se diverso da quello di oggi                                                                      |
| Dalle / Alle             | prossima ora piena e un'ora dopo (15:52 → 16:00, 17:00); dalle 23:00 in poi 23:00 e 23:59                                                                                           | selettore d'ora di F4c, `HH:MM`. Cambiando «Dalle», «Alle» si sposta della stessa durata, fermandosi alle 23:59                                                              |
| Tutto il giorno          | spento                                                                                                                                                                              | acceso: Dalle, Alle e la riga «Avviso» spariscono; si salva dalle 00:00 del giorno alle 00:00 del giorno dopo (Roma), `all_day = true`, avviso null                          |
| Per chi                  | solo tu                                                                                                                                                                             | pallini con l'iniziale (due lettere per gli omonimi, default 4 del piano) di tutti i membri: tu, poi gli altri nell'ordine del Nest, animali compresi; scelta multipla       |
| Si ripete                | «Mai»                                                                                                                                                                               | foglio «Si ripete» (§2)                                                                                                                                                      |
| Dove                     | «Aggiungi un luogo»                                                                                                                                                                 | foglio «Dove»: campo di testo, massimo 100, «Annulla», «Fatto»                                                                                                               |
| Lo porta / Lo riprende   | «Nessuno»                                                                                                                                                                           | solo se «Per chi» ha almeno un figlio (`kind = child`); «Cambia» su una delle due apre «Chi porta e chi riprende». Senza figli le righe spariscono e si salvano null / false |
| Avviso                   | «Un'ora prima»                                                                                                                                                                      | foglio «Avviso»                                                                                                                                                              |
| Chi lo vede              | lente «Nest»: «Tutti in casa»; lente «Io» o nessuna: preferenza del profilo (`household` → Tutti in casa; `busy` e `private` → Solo io); preferenza non letta → «Solo io» (LEZIONI) | foglio «Chi lo vede»                                                                                                                                                         |
| Cosa portare             | —                                                                                                                                                                                   | non si mostra finché non c'è DB-13 #523 (default 8 di #510)                                                                                                                  |
| Note                     | vuoto                                                                                                                                                                               | foglio «Note»: area di testo, massimo 500, «Annulla», «Fatto»                                                                                                                |

«Salva» è sempre toccabile; finché il titolo è vuoto ha l'aspetto spento deciso dal designer (nota di `ap1-36`), ma non `disabled` né `aria-disabled`, perché il tocco porta al primo errore (`ap1-41`).

### Errori (`ap1-41`)

Controllati al tocco di «Salva»; il campo sbagliato prende il filo rosso, il fuoco va al primo errore nell'ordine del foglio, ogni errore sparisce appena il campo è corretto.

| Caso                             | Testo                                                                         | Dove                                             |
| -------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------ |
| Titolo vuoto                     | «Scrivi che cosa: basta una parola.»                                          | sotto «Titolo»                                   |
| «Alle» uguale o prima di «Dalle» | «Finisce prima di cominciare: controlla gli orari.»                           | sotto la coppia; etichetta «Alle» in rosso       |
| Nessuno in «Per chi»             | «Scegli almeno una persona.»                                                  | sotto i pallini                                  |
| Errore del server                | «Non siamo riusciti a salvare l'impegno. Controlla la connessione e riprova.» | avviso nel foglio, che resta aperto con i valori |

## 2. Fogli interni

Tutti: X a sinistra, titolo al centro, piede con «Annulla» (scarta) e «Fatto» (applica). X vale «Annulla».

### «Si ripete» (`ap1-38`)

- Pastiglie a scelta singola: Mai, Ogni giorno, Ogni settimana, Ogni due settimane, Ogni mese, Ogni anno → `none`, `daily`, `weekly`, `biweekly`, `monthly`, `yearly`.
- «In quali giorni»: Lun Mar Mer Gio Ven Sab Dom, scelta multipla, solo per settimanale e ogni due settimane. Parte con il giorno di «Giorno», che resta sempre scelto (vincolo `events_weekdays_include_start`).
- «Fino a»: «Sempre» (iniziale) o «Una data» (selettore di F4c). Una data prima di «Giorno»: «Scegli un giorno dal {1 dicembre} in poi.» e «Fatto» non chiude.
- «Fine della scuola» e «Salta i giorni senza scuola»: non si mostrano finché non c'è DB-10 #520.

Riassunto nella riga «Si ripete»:

| Ripetizione        | Testo                                                                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mai                | «Mai»                                                                                                                                                       |
| Ogni giorno        | «Ogni giorno»                                                                                                                                               |
| Ogni settimana     | «Ogni martedì», «Ogni martedì e giovedì», «Ogni lunedì, mercoledì e venerdì»                                                                                |
| Ogni due settimane | «Ogni due settimane, il martedì» (stessa unione dei giorni)                                                                                                 |
| Ogni mese          | «Ogni mese, il giorno 1»                                                                                                                                    |
| Ogni anno          | «Ogni anno, il 1° dicembre» (con «1°» solo per il primo del mese)                                                                                           |
| con una fine       | si aggiunge «, fino al 15 giugno»; «all'» davanti a 8 e 11 («fino all'8 giugno»), «al 1°» per il primo; l'anno solo se la fine è oltre 12 mesi dal «Giorno» |

### «Chi porta e chi riprende» (`ap1-39`)

- Gruppi «Lo porta» e «Lo riprende»: pastiglie degli adulti del Nest (pallino e nome, tu per primo) e «Da decidere»; scelta singola per gruppo; ritoccare la scelta la toglie («Nessuno»). La stessa persona può fare andata e ritorno.
- Le persone vicine (Nonna Anna) non ci sono fino a DB-21 #531 (default 6 di #510).
- Interruttore «Avvisa chi porta e chi riprende», sotto «La sera prima e un'ora prima», acceso all'inizio → `remind_rides`.
- Solo se l'impegno si ripete, in fondo: «Vale «di solito». Una volta sola si cambia dall'impegno di quel giorno.»
- Riga nel foglio principale: pallino e nome, «Da decidere» o «Nessuno», con «Cambia».
- Salvataggio: persona → `p_escort_member_id` / `p_pickup_member_id`; «Da decidere» → `p_escort_undecided` / `p_pickup_undecided` true con la persona null.

### «Avviso» (non disegnato, default D3)

Pastiglie: «Nessun avviso», «10 minuti prima», «30 minuti prima», «Un'ora prima», «Due ore prima», «Il giorno prima» → null, 10, 30, 60, 120, 1440 (`p_reminder_minutes_before`, limiti 1–10080 di #510).

Riga: il valore scelto; se `remind_rides` è acceso e c'è una persona in «Lo porta» o «Lo riprende» si aggiunge «, e la sera prima a chi porta» (`ap1-37`); con «Nessun avviso» diventa «La sera prima a chi porta».

### «Chi lo vede» (`ap1-40`)

| Scheda              | Sotto                                                                | Salva                       |
| ------------------- | -------------------------------------------------------------------- | --------------------------- |
| Tutti in casa       | «Compare nel calendario di tutti.»                                   | `household`                 |
| Solo io             | «Gli altri vedono soltanto che sei occupato, senza titolo né luogo.» | `busy`                      |
| Solo alcune persone | «Scegli chi lo vede; per gli altri sei occupato.»                    | `selected` + `p_viewer_ids` |

Con «Solo alcune persone» scelta, sotto la scheda compaiono le pastiglie degli altri adulti del Nest a scelta multipla (non disegnato, default D4). «Fatto» senza nessuno: «Scegli almeno una persona.». La scheda non c'è se non ci sono altri adulti. Riga: «Tutti in casa», «Solo io», «Solo tu e Laura», «Solo tu, Laura e Anna».

## 3. Passo frase (`mn1-24`) e «Controlla e aggiungi» (`mn1-25`)

### Passo frase

- Titolo «Nuovo impegno», X (chiude tutto).
- Area di testo con etichetta «Scrivi o detta una frase», massimo 200 caratteri. Si detta con la tastiera del telefono: nessun microfono nell'app.
- Sotto: «Capiamo che cosa, quando e per chi. Controlli tu prima di aggiungere.»
- Riga con la matita «Compila i campi a mano» e «Annulla»: tornano entrambe al foglio a campi com'era prima; il testo della frase si perde.
- «Avanti»: legge la frase e apre «Controlla e aggiungi». Frase vuota o senza un «che cosa» (es. «domani alle 17»): «Scrivi che cosa: basta una parola.» sotto il campo.
- Nessun foglio di consenso (default 2 del piano): la frase la legge `parse-phrase.ts` nel browser; non va al server, nell'indirizzo, in `localStorage`, nei log.

### Lettura della frase

Come oggi (`parse-phrase.ts`): primo giorno, prima ora, nomi del Nest; il resto è il titolo con la prima lettera maiuscola. In più le fasce, tolte dal titolo:

| Parola                                 | Giorno             | Ora scelta | Proposte            |
| -------------------------------------- | ------------------ | ---------- | ------------------- |
| «mattina»                              | quello della frase | 9:00       | 8:30, 9:00, 9:30    |
| «stamattina»                           | oggi               | 9:00       | 8:30, 9:00, 9:30    |
| «pomeriggio» (anche «oggi pomeriggio») | quello della frase | 16:00      | 15:30, 16:00, 16:30 |
| «sera»                                 | quello della frase | 20:00      | 19:30, 20:00, 20:30 |
| «stasera»                              | oggi               | 20:00      | 19:30, 20:00, 20:30 |

Un'ora esplicita vince sulla fascia («sabato sera alle 21» → 21:00, nessuna etichetta). Senza fine l'impegno dura un'ora (come oggi). «stamattina» e «stasera» danno il giorno: non è dedotto.

### «Controlla e aggiungi»

X (chiude tutto), «Indietro» (torna alla frase con il testo intatto), «Aggiungi così».

| Riga     | Detto nella frase                                        | Dedotto: etichetta «Da verificare» e frase                                                                                                                                                                                                                     | Campo     |
| -------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Che cosa | il titolo, «Cambia» lo rende un campo (massimo 100)      | mai dedotto                                                                                                                                                                                                                                                    | —         |
| Giorno   | il giorno, «Cambia» apre il selettore                    | manca: oggi; «Non l'hai detto: l'ho messo oggi.»                                                                                                                                                                                                               | `day`     |
| Ora      | «17:00–18:00», «Cambia» apre i selettori di Dalle e Alle | fascia: ««Sera» non è un'ora: ho messo le 20:00.» (la parola della frase, con la maiuscola) con le tre proposte, la centrale scelta, e «Altra ora». Nessuna ora: «Non l'hai detto: l'ho messo per tutto il giorno.» con «Tutto il giorno» scelto e «Altra ora» | `time`    |
| Per chi  | i pallini dei nomi riconosciuti                          | nessun nome: tutti gli adulti e i figli, non gli animali; «Non l'hai detto: l'ho messo per tutti e quattro.» (numero in lettere fino a dieci, poi in cifre). Nest di una sola persona: lei, senza etichetta                                                    | `members` |

- Toccare una proposta (anche quella già scelta), «Altra ora», un pallino o «Cambia» conferma il campo: etichetta e frase spariscono. I pallini si accendono e si spengono; con nessuno, «Aggiungi così» mostra «Scegli almeno una persona.».
- Il titolo oltre 100 caratteri: «Il titolo può avere al massimo 100 caratteri.» sotto «Che cosa», aperto come campo.
- Il resto prende i valori iniziali del foglio a campi (§1).
- «Aggiungi così» salva con `p_unverified_fields` = i campi che hanno ancora l'etichetta. Il segno nell'impegno (`mn1-26`) e «Sì, confermo» sono di A3 #536.

## 4. Salvataggio

1. «Salva» o «Aggiungi così» con i campi validi: se l'impegno non è «Tutto il giorno», l'app chiama `find_event_conflicts(p_starts_at, p_ends_at, p_member_ids, p_escort_member_id, p_pickup_member_id)` per la prima occorrenza (default 4 di #510).
2. Con almeno una riga: foglio dei sovrapposti (§5). Senza righe, o se la chiamata fallisce con stato diverso da 0: si salva subito.
3. Mentre controlla e salva, il pulsante diventa una rotella nello stesso posto (`aria-busy="true"`); altri tocchi non fanno niente; una sola `create_event`.
4. Riuscito: il foglio si chiude e si apre `/calendario/giorno?giorno=<giorno d'inizio>` (nota di `ap1-42`), con l'avviso in basso per 6 secondi e «Annulla».

| Ripetizione               | Testo dell'avviso                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Mai                       | «Aggiunto a martedì 1 dicembre.» (anno solo se diverso da oggi)                                                        |
| Ogni settimana, un giorno | «Aggiunto a tutti i martedì, fino all'8 giugno.»; «tutti i sabati», «tutte le domeniche»; senza fine niente «, fino …» |
| Le altre                  | «Aggiunto: » + riassunto della riga con l'iniziale minuscola + «.» (es. «Aggiunto: ogni due settimane, il martedì.»)   |

5. «Annulla» cancella l'impegno con tutte le occorrenze, come l'«Annulla» di oggi. Se fallisce: «Non siamo riusciti ad annullare. L'impegno è rimasto in calendario.»
6. Senza rete (`navigator.onLine` falso o stato 0, LEZIONI; `ap1-43`): nessun controllo dei sovrapposti; l'impegno entra nella coda di F7 #148 con tutti i parametri; il foglio si chiude, si apre il giorno dell'impegno con «Salvato sul telefono: parte appena torna la rete.» e «Annulla» (toglie dalla coda). Al ritorno della rete parte una sola `create_event`. La riga «In attesa di connessione» (risposta 93) la disegnano le pagine del calendario leggendo la coda di F7.

## 5. Foglio dei sovrapposti (`mn1-21`)

- Righe di `find_event_conflicts` (ordinate per inizio e persona). La prima decide il titolo:
  - la persona sei tu: «{Giovedì} alle {17:40} hai già un impegno»;
  - un'altra persona: «{Giovedì} alle {17:40} {Sofia} ha già un impegno».
  - Il giorno è il solo giorno della settimana, con la maiuscola; se l'occorrenza non è in questa settimana o nella prossima: «Giovedì 3 dicembre alle 17:40 …».
- Una scheda per occorrenza (una sola anche se tocca più persone): ora d'inizio, titolo, «Fino alle {19:00}» («Fino a {venerdì} alle {01:00}» se finisce un altro giorno), pallini di `member_ids`. Riga mascherata (`is_masked`): titolo «Occupato», solo il pallino dell'autore, niente altro.
- Sotto: «Non puoi essere in due posti. Che cosa preferisci?» oppure «{Sofia} non può essere in due posti. Che cosa preferisci?».
- «Cambia l'orario»: chiude e porta il fuoco su «Dalle» (foglio a campi) o sulla riga «Ora» («Controlla e aggiungi»). X uguale.
- «Salva lo stesso»: salva come al §4.
- «Chiedi a Laura di portare Tommaso» non c'è (default D5).
- Nessuna vibrazione sul web (default 3 del piano).

## 6. Accessibilità

- Ogni foglio è un dialogo modale con nome uguale al suo titolo; il foglio dei sovrapposti ha il fuoco su «Cambia l'orario».
- Esc e X chiudono il foglio in cima; il fuoco torna alla riga che l'ha aperto, o a chi ha aperto «Nuovo impegno».
- Pallini: pulsanti con `aria-pressed` e nome completo («Marco», «Biscotto»). Pastiglie a scelta singola: `radiogroup` con etichetta («Si ripete», «Fino a», «Lo porta», «Lo riprende», «Avviso», «Chi lo vede»). Giorni: pulsanti con `aria-pressed` e nome intero («Martedì»). Interruttori: `role="switch"`.
- Errori: `aria-invalid="true"` e `aria-describedby`; «Da verificare» e la sua frase sono nella descrizione del campo.
- Avvisi in basso: `role="status"`; «Annulla» raggiungibile da tastiera.
- Il nome accessibile comincia con il testo visibile (LEZIONI). Aree di tocco di almeno 44 px.
- Movimento ridotto: dissolvenza al posto della salita (nota di `ap1-36`).

## 7. Test esistenti

Da rifare o togliere (le parti sull'Impegno): `tests/e2e/aggiungi-impegni.spec.ts`, `aggiungi-impegni-ca.spec.ts`, `aggiungi-impegni-frase.spec.ts`, `aggiungi-impegni-modulo.spec.ts`, `aggiungi-impegni-modulo-ca.spec.ts`, `aggiungi-impegni-avviso.spec.ts`, `aggiungi-campi.spec.ts`, `aggiungi-anche-su.spec.ts`, `aggiungi-sopra-pagina.spec.ts`. Restano gli `aggiungi-casa-*` e `percorso-casa-aggiungi-ripetuto.spec.ts` (da controllare se usano il selettore «Tipo» con «Impegno»).
