18/11/2026

Documento vivo: si aggiorna quando Anthropic o AWS cambiano prezzi, modelli o condizioni.

# Chiedi a Nest: l'assistente AI con Claude e il limite in token

Versione 1, 18/11/2026. Preparato dallo stratega per Francesco, dopo le sue risposte alle domande 49 e 50 di Fable (commento del 18/11 in #444). Riparte da #386, da `mappa-funzionalita.md` (righe A1–A6, pagine 8 e 9 della sezione 4), da `strategia-crescita.md` e da `prezzo-per-nest.md`. Prezzi e condizioni letti il 18/11/2026 sulle pagine ufficiali di Anthropic e di AWS. Fonti numerate in fondo. Issue: #466.

## Riassunto per Francesco

1. **Claude va bene ed è economico.** Con Claude Haiku 5.5 una domanda semplice costa meno di un decimo di centesimo; leggere la foto di un avviso costa circa 0,4 centesimi in media; pianificare una festa con Claude Sonnet 5.5 circa 8 centesimi (stime sui prezzi ufficiali [1]).
2. **Un Nest Plus costa da 2 centesimi a 1,22 € al mese** di AI, secondo l'uso (leggero, medio, intenso). Plus rende circa 2,33 € netti al mese a Nest con l'annuale: i conti tornano solo con un tetto.
3. **Il limite si misura in token, pesati per il prezzo del modello**, e si mostra come una barra «Energia di Nest» in percentuale, senza mai dire «token».
4. **Base: 30 punti al mese** (circa 35 domande o 7 foto, niente pianificazione). **Plus: 1.000 punti al mese per tutto il Nest**, cioè al massimo 1 € di costo. La prova di 30 giorni ne dà 300.
5. **Quando finisce:** nel base compare l'offerta di Plus senza interrompere nulla; in Plus resta una «modalità essenziale» per le domande semplici fino al rinnovo. Niente ricariche a pagamento al lancio.
6. **Dove passano i dati:** l'API diretta di Anthropic oggi elabora solo «global» o «us» [2]. Per tenere i dati in Europa consiglio Claude tramite **Amazon Bedrock con il profilo UE** (comprende Milano), con conservazione zero e Anthropic che non vede i contenuti [6], [7].
7. **Agenti dedicati:** un coordinatore e quattro agenti (Calendario, Casa, Lettura, Pianifica; Pasti in seconda fase). Nessuno salva da solo: propongono, l'adulto conferma.
8. **Mai all'AI:** dati sanitari, note degli impegni, «Solo io» degli altri, scuola, maestre, date di nascita e cognomi.
9. **Le alternative non cambiano il quadro:** Haiku 5.5 costa già meno di Mistral Large [12], e la sede UE si risolve con Bedrock.
10. **11 domande per te** in fondo, tutte con il mio consiglio.

---

## 1. Da dove partiamo

**Cosa c'è già (dati, `docs/agenti/APP.md` e #386).** Aggiungi capisce frasi come «Piscina di Sofia martedì alle 17» senza AI. «Liberi insieme» trova i momenti liberi degli adulti. La Ricerca del Nest rispetta «Occupato» e «Solo io». L'assistente non esiste ancora: è la riga A1 della mappa, prevista al mese 3 insieme a Plus.

**Cosa ha deciso Francesco il 18/11/2026 (#444):**

- domanda 49: il limite non si conta in domande ma in token consumati;
- domanda 50: valutare Claude con agenti dedicati;
- domanda 26: la Ricerca completa è Plus, il base vede gli ultimi 3 mesi (serve a capire cosa l'assistente può leggere nel base).

**Cosa cambia rispetto alla mappa.** La mappa proponeva «10 domande al mese» nel base e il contatore «7 su 10 questo mese» (pagina 8d). Con la decisione 49 il contatore diventa una barra di energia. Il resto della mappa resta valido.

**La tavola di Fable «Plus quando finisce il base».** Non è nel repository: l'ho cercata in `docs/` e nelle PR senza trovarla. Il capitolo 4.3 segue il titolo della tavola e le regole già scritte nella mappa (pagina 9f: il limite si mostra senza interrompere un'azione). Se la tavola dice altro, va aggiornato quel capitolo.

**Cosa dice la ricerca su Google (Ubersuggest, Italia, 18/11/2026).** «assistente ai famiglia», «app famiglia intelligenza artificiale» e «organizzare famiglia ai» non hanno volume misurabile. «assistente personale ai» ha 40 ricerche al mese; «app ai gratis» 1.600. **Lettura:** nessuno cerca «un'AI per la famiglia». Si vende il risultato («fotografa l'avviso, lo segna lui»), come già consigliato in `mappa-funzionalita.md` sezione 5.2, non la parola AI.

---

## 2. Architettura con Claude

### 2.1 Quali modelli (prezzi ufficiali al 18/11/2026)

Prezzi in dollari per milione di token, API di Anthropic [1].

| Modello           | Entrata | Uscita | Lettura dalla cache | Scrittura in cache (5 min) | Descrizione di Anthropic [3]                                                                   |
| ----------------- | ------- | ------ | ------------------- | -------------------------- | ---------------------------------------------------------------------------------------------- |
| Claude Haiku 5.5  | 0,10 $  | 0,50 $ | 0,01 $              | 0,125 $                    | il più veloce; «per compiti ad alto volume e sensibili alla latenza, come estrarre e smistare» |
| Claude Sonnet 5.5 | 2 $     | 10 $   | 0,10 $              | 2,50 $                     | «il miglior equilibrio tra velocità e intelligenza»                                            |
| Claude Opus 5.5   | 4 $     | 20 $   | 0,20 $              | 5 $                        | per lavori lunghi da agente                                                                    |
| Claude Fable 5.2  | 8 $     | 40 $   | 0,20 $              | 10 $                       | per ragionamenti molto impegnativi                                                             |

Altri fatti utili dalle stesse pagine:

- Haiku 5.5 costa di più (0,50 $ in entrata, 2,50 $ in uscita) solo se la richiesta supera 100.000 token [1]. Le nostre restano sotto i 10.000.
- Tutti i modelli leggono le immagini [3]. Un'immagine costa ⌈larghezza/28⌉ × ⌈altezza/28⌉ token; sui modelli recenti il lato lungo arriva a 2.576 pixel e fino a 4.784 token [4].
- La cache dei prompt vale da 512 token in su ed è condivisa dentro lo stesso spazio di lavoro, mai tra organizzazioni diverse [5].
- La Batch API costa la metà, per i lavori che possono aspettare [1].
- Fable 5.x è un «modello coperto»: richiede che Anthropic conservi i dati 30 giorni [2]. Anche solo per questo non lo usiamo.

**Cosa uso e per cosa (mia proposta):**

| Compito                                                     | Modello                                     | Perché                                                                                            |
| ----------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Capire la richiesta e smistarla                             | Haiku 5.5                                   | è il suo mestiere secondo Anthropic; costa quasi niente                                           |
| Domande sul calendario, sulla spesa, sulle cose da fare     | Haiku 5.5, ragionamento spento o basso      | domande corte, dati già filtrati dagli strumenti                                                  |
| Leggere la foto di un avviso o una mail inoltrata           | Haiku 5.5; Sonnet 5.5 se Haiku non è sicuro | estrarre date è un compito da Haiku; Sonnet solo per le foto difficili                            |
| Pianificare (festa, settimana piena, piano pasti in fase 2) | Sonnet 5.5                                  | più passaggi e più strumenti in fila                                                              |
| Riepilogo della settimana scritto dall'AI (A5, più avanti)  | Haiku 5.5, di notte                         | non è urgente                                                                                     |
| Opus e Fable                                                | non usati                                   | costano 2–4 volte Sonnet senza un compito che li richieda; Fable vuole 30 giorni di conservazione |

Una regola prima dell'AI: **se la domanda si risolve con una funzione che c'è già, non si chiama il modello.** «Aggiungi» capisce già le frasi; «Liberi insieme» calcola già i momenti liberi. L'assistente le usa come strumenti e non le rifà.

### 2.2 Gli agenti dedicati

Un **coordinatore** (Haiku 5.5) riceve la domanda e la passa a un agente. Ogni agente ha istruzioni brevi e vede solo i suoi strumenti: meno strumenti vuol dire meno token e meno errori.

**Regola per tutti:** gli strumenti che leggono restituiscono solo quello che l'adulto vede già nell'app, con le stesse regole del database («Solo io» degli altri escluso, «Occupato» senza testo). Gli strumenti che scrivono si chiamano tutti `proponi_…`: preparano una bozza e la mostrano. **Il salvataggio lo fa l'app, quando l'adulto tocca «Conferma»**, con le stesse funzioni del database che usa già il foglio Aggiungi. Nella prima versione nessun agente può cancellare, condividere o mandare messaggi.

| Agente                                                  | Modello                            | Strumenti di lettura                                                                                 | Strumenti che propongono (sempre con conferma)                                     | Esempi                                                         |
| ------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Calendario**                                          | Haiku 5.5                          | `cerca_impegni(dal, al, persone)`, `liberi_insieme(persone, durata, finestra)`, `chi_porta(impegno)` | `proponi_impegno`, `proponi_spostamento`, `proponi_promemoria`                     | «Cosa abbiamo sabato?», «Quando siamo liberi tutti e quattro?» |
| **Casa** (spesa, da fare, scadenze)                     | Haiku 5.5                          | `leggi_spesa`, `leggi_da_fare(persona)`, `leggi_scadenze(entro)`                                     | `proponi_voci_spesa`, `proponi_da_fare`, `proponi_scadenza`                        | «Metti in lista latte e pannolini», «Cosa scade a dicembre?»   |
| **Lettura** (foto, avvisi della scuola, mail inoltrate) | Haiku 5.5, poi Sonnet 5.5 se serve | nessuno: riceve solo l'immagine o il testo                                                           | `proponi_impegni_da_avviso` con risposta strutturata e l'etichetta «da verificare» | la foto della circolare della gita che diventa tre impegni     |
| **Pianifica**                                           | Sonnet 5.5                         | quelli di Calendario e Casa                                                                          | una proposta unica: data, cose da fare, spesa, testo dell'invito                   | «Organizza la festa di Sofia a marzo»                          |
| **Pasti** (seconda fase, dopo #381 e #382)              | Sonnet 5.5                         | `leggi_ricette`, `leggi_settimana`                                                                   | `proponi_piano_pasti`, `proponi_spesa_da_ricette`                                  | «Prepara le cene di questa settimana»                          |

**Come si costruisce (proposta per il team, non lo faccio io).** Chiamate alla Messages API di Claude dalle funzioni server dell'app, con strumenti definiti da noi che girano con la sessione dell'adulto. Sconsiglio i «Managed Agents» di Anthropic: tengono lo stato sui server di Anthropic, e le loro sessioni girano con sede dei dati «us» [2]. Le pagine e gli eventi da aggiungere all'app vanno proposti nella issue dell'Agente (#386), non li creo io.

**Sicurezza.** Il testo di un impegno, di una foto o di una mail è un dato, non un ordine: se dentro c'è scritto «cancella tutto», l'agente non ha comunque uno strumento per farlo, e ogni scrittura passa dalla conferma dell'adulto. Nella prima versione nessun agente va su internet.

### 2.3 Come si spendono meno token

| Tecnica                           | Cosa si fa                                                                                                                                        | Effetto (stima)                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Cache dei prompt**              | istruzioni e definizioni degli strumenti identiche per tutti i Nest, in testa alla richiesta; i dati del Nest vengono dopo                        | la parte fissa (circa 3.000 token) costa un decimo a ogni lettura [1]       |
| **Contesto minimo**               | niente calendario intero: lo strumento restituisce solo il periodo e le persone della domanda, una riga per impegno («mar 17:00 Piscina · Sofia») | 1.000–2.000 token invece di decine di migliaia                              |
| **Smistamento**                   | Haiku risponde quasi sempre; Sonnet solo per pianificare e per le foto difficili                                                                  | una domanda semplice su Sonnet costerebbe circa 10 volte tanto (capitolo 3) |
| **Risposte brevi**                | due o tre frasi; tetto di token in uscita per agente (Haiku 600, Sonnet 3.000); ragionamento basso o spento su Haiku                              | l'uscita costa 5 volte l'entrata [1]                                        |
| **Riassunti**                     | dopo sei scambi la conversazione diventa un riassunto di poche righe                                                                              | le conversazioni lunghe non crescono senza fine                             |
| **Immagini ridotte**              | lato lungo a 1.568 pixel e foto ritagliata sul foglio prima dell'invio                                                                            | circa 2.400 token invece di 4.784 [4]                                       |
| **Fuori tema = risposta fissa**   | «Rispondo sulle cose della casa»: niente compiti, codice o chiacchiere                                                                            | costo quasi zero e meno abusi                                               |
| **Lavori notturni a metà prezzo** | riepiloghi non urgenti con la Batch API [1]                                                                                                       | -50%; non disponibile su Bedrock per questi modelli [6], [7]                |

---

## 3. Costi

### 3.1 Costo di una richiesta tipica

**Stima mia.** Ipotesi: parte fissa di 3.000 token in cache; dati del Nest e domanda circa 600 token; risultato di uno strumento circa 1.200 token; risposta di 150–230 token. Prezzi del capitolo 2.1 [1]. Dove la cache è «fredda» (nessuno l'ha usata negli ultimi 5 minuti) aggiungo il costo di scriverla: è la stima prudente.

| Richiesta                                 | Modello              | Come è fatta                                                        | Costo                                            | Punti (capitolo 4) |
| ----------------------------------------- | -------------------- | ------------------------------------------------------------------- | ------------------------------------------------ | ------------------ |
| Domanda semplice («cosa abbiamo sabato?») | Haiku 5.5            | 2 chiamate (cerca, poi risponde)                                    | 0,04 centesimi di dollaro; 0,08 con cache fredda | 0,8                |
| La stessa domanda tutta su Sonnet 5.5     | Sonnet 5.5           | come sopra                                                          | circa 0,8 centesimi                              | 8                  |
| Foto di un avviso                         | Haiku 5.5            | 1 chiamata, immagine di circa 2.400 token, 400 token di risposta    | circa 0,09 centesimi                             | 0,9                |
| Foto difficile ripresa con Sonnet         | Sonnet 5.5           | come sopra                                                          | 1,1–1,8 centesimi                                | 15                 |
| Foto, media (1 su 5 passa a Sonnet)       | misto                | —                                                                   | circa 0,4 centesimi                              | 4                  |
| Pianifica una festa                       | Sonnet 5.5           | 5 chiamate, contesto che cresce fino a 7.000 token, 3.000 in uscita | circa 8 centesimi                                | 80                 |
| Ricerca online (seconda fase)             | Sonnet 5.5 + ricerca | 1 ricerca a 10 $ ogni 1.000 [1], risultati letti dal modello        | circa 3 centesimi (stima grezza)                 | 30                 |

### 3.2 Costo per Nest al mese

**Stima mia.** I tre profili sono ipotesi: non abbiamo ancora dati d'uso. Cambio: 1 € = 1,1014 $ (Banca d'Italia, 16/11/2026 [11]). Bedrock con il profilo UE costa il 10% in più dell'instradamento globale [1]: i due effetti quasi si annullano, e il costo in euro su Bedrock UE è circa uguale al costo in dollari sull'API diretta.

| Profilo                  | Uso in un mese (ipotesi)                | Punti       | Costo su Bedrock UE |
| ------------------------ | --------------------------------------- | ----------- | ------------------- |
| Leggero                  | 20 domande, 2 foto                      | 24          | circa 0,02 €        |
| Medio                    | 60 domande, 8 foto, 3 pianificazioni    | 320         | circa 0,32 €        |
| Intenso                  | 200 domande, 25 foto, 12 pianificazioni | 1.220       | circa 1,22 €        |
| Intenso, tutto su Sonnet | come sopra, senza smistamento           | circa 2.935 | circa 2,94 €        |

**Lettura.** La pianificazione pesa più di tutto il resto: nel profilo medio sono 240 punti su 320. Lo smistamento verso Haiku è la scelta che fa tornare i conti, non la cache.

### 3.3 Il confronto con il prezzo di Plus

Dal business case: Plus annuale a 34,99 € rende circa **28 € netti a casa** all'anno (IVA al 22% e circa 3% di commissioni), cioè **2,33 € al mese**. Il mensile a 3,99 € rende circa 3,17 € netti al mese (stesso calcolo, stima mia).

| Caso (Plus annuale)                                           | Costo AI al mese | Quota del ricavo netto |
| ------------------------------------------------------------- | ---------------- | ---------------------- |
| Medio                                                         | 0,32 €           | 14%                    |
| Al tetto proposto (1.000 punti)                               | 1,00 €           | 43%                    |
| Intenso senza tetto                                           | 1,22 €           | 52%                    |
| Intenso senza tetto e senza smistamento                       | 2,94 €           | 126%: in perdita       |
| **Media attesa** (stima: 50% leggeri, 35% medi, 15% al tetto) | circa 0,27 €     | circa 12%              |

**Lettura.** Con il tetto a 1.000 punti un Nest Plus non costa mai più del 43% di quello che rende, e in media circa il 12%. Il prezzo di Plus (3,99 €/mese, 34,99 €/anno) non va cambiato per l'AI.

---

## 4. Il limite in token

### 4.1 Come si misura

La decisione 49 dice «token consumati». Contare i token così come sono sarebbe ingiusto: un token di Sonnet costa 20 volte uno di Haiku, e un token in uscita 5 volte uno in entrata [1]. Propongo quindi di **pesare i token per il loro prezzo**:

- ogni risposta dell'API riporta i token usati (entrata, uscita, cache);
- l'app li moltiplica per il prezzo di listino del modello;
- **1 punto = 0,1 centesimi di dollaro di listino** (prezzo globale, senza il 10% della UE).

Così una domanda semplice vale meno di un punto, una foto circa 4, una festa organizzata circa 80. Il punto resta interno: l'utente non lo vede mai. Il conteggio vale per **tutto il Nest**, come Plus.

### 4.2 Come si mostra

**Una barra «Energia di Nest»**, nel foglio di Chiedi a Nest e in Impostazioni, con:

- la percentuale che resta, in parole: «Vi resta il 64% dell'energia di novembre»;
- una stima concreta: «basta per circa 40 domande o 8 foto»;
- la data in cui si ricarica: «Si ricarica il 1° dicembre» (nel base il primo del mese; in Plus il giorno del rinnovo).

**Mai:** «token», numeri di punti, conti alla rovescia rossi, notifiche push sull'energia. Un solo avviso dentro il foglio, quando l'energia scende al 20%. Niente classifica di chi la consuma nel Nest: al lancio si mostra solo il totale.

### 4.3 Quanto nel base e quanto in Plus

| Piano                        | Energia al mese | In pratica (stima)                                             | Costo massimo per Nest |
| ---------------------------- | --------------- | -------------------------------------------------------------- | ---------------------- |
| **Base**                     | 30 punti        | circa 35 domande o 7 foto; niente pianificazione (vale 80)     | 0,03 €                 |
| **Prova di Plus, 30 giorni** | 300 punti       | si prova tutto, festa compresa                                 | 0,30 €                 |
| **Plus**                     | 1.000 punti     | il profilo medio usa un terzo; l'intenso arriva al 25 del mese | 1,00 €                 |

Perché 30 punti nel base e non 10 domande: 30 punti bastano a provare l'assistente qualche volta a settimana. La pianificazione resta fuori da sola, perché vale più di 30 punti. Con 1.000 Nest base che usano tutto, la spesa è di circa 30 € al mese.

### 4.4 Cosa succede quando finisce

**Nel base («Plus quando finisce il base»).**

1. Prima di partire, l'app controlla l'energia. Se una richiesta comincia, finisce: niente risposte tagliate a metà.
2. Finita l'energia, nel foglio compare una scheda, non una finestra che blocca: «L'energia di novembre è finita. Torna il 1° dicembre. Con Plus ne avete 30 volte tanta, per tutto il Nest.» Due bottoni: «Prova Plus 30 giorni» e «Va bene».
3. Tutto il resto funziona come prima, compreso Aggiungi che capisce le frasi, perché non usa l'AI.
4. Nessuna notifica commerciale e nessuna mail sull'energia finita, come già deciso in `strategia-crescita.md`.

**In Plus.**

1. All'80% consumato, una riga nel foglio: «Avete usato gran parte dell'energia di questo mese».
2. Al 100% parte la **modalità essenziale** fino al rinnovo: domande semplici solo con Haiku, fino a 100 punti in più (circa 10 centesimi). Foto e pianificazione si fermano, con la data di ripresa.
3. Finita anche la riserva, l'assistente si ferma fino al rinnovo; il resto dell'app no.
4. **Niente ricariche a pagamento al lancio**: servono un secondo prodotto, l'IVA e le regole degli store. Si valuta se più del 5% dei Nest Plus arriva al tetto per due mesi di fila.

### 4.5 Come evitare gli abusi

| Rischio                                              | Misura                                                                                                                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un Nest consuma tutto in un giorno, o con uno script | tetto giornaliero al 20% del mese (Plus 200 punti, base 15); al massimo 10 richieste al minuto e 60 all'ora per adulto                                      |
| Richieste enormi                                     | testo fino a 1.000 caratteri; al massimo 3 foto per richiesta, ridotte sul server; tetto di token in uscita; al massimo 6 passaggi di strumenti per domanda |
| Usare Nest come chat generica (compiti, codice)      | istruzioni che rispondono solo sulle cose della casa; risposta fissa fuori tema                                                                             |
| Prova ripetuta                                       | una prova per Nest e per account; un solo Nest per account c'è già                                                                                          |
| Più persone per avere più energia                    | l'energia è per Nest, non per persona: invitare altri non la aumenta                                                                                        |
| Testo cattivo dentro un impegno o una foto           | nessuno strumento che cancella o condivide; ogni scrittura passa dalla conferma                                                                             |
| Costi fuori controllo                                | tetto di spesa e avvisi sul conto del fornitore (AWS Budgets su Bedrock); interruttore generale per spegnere l'assistente                                   |
| Misurare senza spiare                                | si registrano solo punti e conteggi per Nest, mai il testo delle domande (regola della skill `privacy-e-dati-minori`)                                       |

---

## 5. Privacy e contratto

### 5.1 Cosa dicono le condizioni (fatti, 18/11/2026)

**API diretta di Anthropic.**

| Tema                     | Cosa dice                                                                                                                                                                                                                                                        | Fonte     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Addestramento            | «Anthropic may not train models on Customer Content from Services» (condizioni commerciali, in vigore dal 17/06/2025)                                                                                                                                            | [8]       |
| Con chi si firma         | per chi ha sede nello Spazio economico europeo, Anthropic Ireland, Limited; legge irlandese                                                                                                                                                                      | [8]       |
| Dati personali           | trattati secondo il Data Processing Addendum, che fa parte delle condizioni; le clausole contrattuali tipo UE (moduli 2 e 3) sono citate da fonti secondarie, da verificare sul testo                                                                            | [8], [13] |
| Conservazione            | il Privacy Center (aggiornato al 01/07/2026) dice che input e output dell'API si cancellano entro 30 giorni; la documentazione tecnica dice che il contenuto non si conserva per impostazione, salvo i modelli coperti (30 giorni). Le due pagine non coincidono | [9], [2]  |
| Violazioni delle regole  | se un contenuto viene segnalato dai controlli automatici, input e output si conservano fino a 2 anni, anche con la conservazione zero                                                                                                                            | [2], [9]  |
| Conservazione zero (ZDR) | si chiede al commerciale di Anthropic; non vale per i modelli coperti (Fable, Mythos)                                                                                                                                                                            | [2]       |
| Dove si elabora          | `inference_geo` accetta solo «global» (predefinito) o «us»; i dati salvati stanno solo negli USA («us» è l'unica sede di lavoro possibile)                                                                                                                       | [10]      |
| Minori                   | i servizi di Anthropic per i consumatori sono solo per maggiorenni; per i prodotti di terzi le regole per chi serve minori valgono quando un minore usa i modelli direttamente                                                                                   | [14]      |

**Claude tramite Amazon Bedrock.**

| Tema                   | Cosa dice                                                                                                                                                                                                 | Fonte    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Elaborazione in Europa | Haiku 5.5 e Sonnet 5.5 hanno il profilo UE (`eu.anthropic.claude-haiku-5-5`, `eu.anthropic.claude-sonnet-5-5`); partendo da Milano si va solo in Francoforte, Stoccolma, Milano, Spagna, Irlanda e Parigi | [6], [7] |
| Anthropic vede i dati? | no: i modelli girano in account di AWS a cui i fornitori non hanno accesso, quindi non vedono richieste e risposte                                                                                        | [15]     |
| Conservazione          | si sceglie la modalità; con «none» nessun dato va su disco e niente arriva al fornitore. Solo Fable richiede la revisione umana di AWS                                                                    | [16]     |
| Prezzo                 | gli endpoint regionali costano il 10% in più di quelli globali                                                                                                                                            | [1]      |
| Limiti                 | su Bedrock questi modelli non hanno la Batch API e, tra gli strumenti lato server, solo la ricerca tra strumenti: niente ricerca web di Anthropic                                                         | [6], [7] |

**Lettura.** Con l'API diretta i dati delle famiglie passano dagli USA; con Bedrock UE restano in Europa e Anthropic non li vede. Per un'app di famiglie con bambini, che vuole dire «in Europa» nell'informativa, Bedrock UE è la scelta giusta. Costa un 10% in più su cifre di centesimi e un account AWS da aprire. Da verificare prima di partire: che Haiku 5.5 e Sonnet 5.5 accettino la modalità «none» (la pagina AWS fa l'esempio con Opus 4.8 [16]).

### 5.2 Cosa si può promettere agli utenti e cosa no

| Si può dire (se si sceglie Bedrock UE con conservazione zero)             | Non si può dire                                                                  |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| «Le vostre domande non servono ad addestrare nessuna AI»                  | «L'AI non sbaglia»: ogni azione ha anteprima e «da verificare»                   |
| «Le richieste all'AI vengono elaborate in Europa»                         | «I dati non escono mai dall'Europa» se si usa l'API diretta                      |
| «Mandiamo all'AI solo quello che serve per rispondere»                    | «Nessuno può mai vedere le richieste»: le leggi e i controlli anti abuso restano |
| «Le foto degli avvisi non le teniamo: si leggono e si buttano»            | «Anonimo»: i nomi propri degli impegni passano                                   |
| «Niente si salva senza il vostro tocco su Conferma»                       | «Gratis per sempre» sull'AI del base: l'energia del base può cambiare            |
| «Le conversazioni restano 30 giorni e le cancellate quando volete» (#386) |                                                                                  |

### 5.3 Cosa non va mai all'AI

- **Nessun dato sanitario**, in nessuna forma. Per regola l'app non ne ha, ma possono arrivare da una foto o da un testo libero. L'agente Lettura ha l'istruzione di non riportarli: se un avviso parla di salute (vaccini, pidocchi, allergie), propone solo data e ora e chiede all'adulto di scrivere il titolo.
- **Figli:** solo il nome o il soprannome e, se la domanda lo chiede, l'età in anni. Mai data di nascita, scuola, classe, maestre e i loro telefoni. Le taglie solo in seconda fase per le idee regalo, e solo nella richiesta che le usa.
- **Mai** gli impegni «Solo io» degli altri, il testo degli «Occupato», le note degli impegni, i cognomi, mail, telefoni, indirizzi, i codici della lista desideri pubblica, i token degli inviti, gli identificativi veri del database (all'AI vanno riferimenti brevi e temporanei).
- **Foto:** si chiede di fotografare il foglio, non le persone. La foto si riduce, si legge e non si conserva da noi.
- **Verso il fornitore** nessun dato che identifichi la persona: al massimo un codice casuale che cambia, se serve per gli abusi.
- **Niente pubblicità né profilazione** dalle domande all'assistente.

### 5.4 Domande per l'agente legale-privacy

Non decido io: sono le domande da chiudere prima di costruire.

1. Base giuridica del trattamento con l'AI: esecuzione del contratto (funzione chiesta dall'utente) o consenso separato al primo uso?
2. Informativa (#147): come descrivere Bedrock UE, AWS come responsabile, Anthropic che non riceve i dati, i 30 giorni delle conversazioni salvate da noi.
3. Va fatta una valutazione d'impatto (DPIA) per un'AI che legge dati familiari con nomi di minori?
4. La foto di un avviso con i nomi di altri bambini: basta leggerla senza conservarla, con un avviso prima dello scatto?
5. Regolamento europeo sull'AI: per un assistente che propone e non decide bastano gli obblighi di trasparenza («state parlando con un'AI»)?
6. Il filtro sui dati sanitari nelle foto basta, o serve vietare del tutto certi tipi di avviso?
7. Se in futuro i figli avranno un account (decisione 12 del 18/11), possono usare l'assistente? Le regole di Anthropic per chi serve minori [14] chiederebbero controlli in più. Il mio consiglio: no.
8. Contratto: il DPA di AWS e le condizioni di Anthropic su Bedrock bastano, o serve anche il DPA di Anthropic?
9. Il conteggio dell'energia per Nest e i limiti per adulto sono dati personali da indicare nell'informativa?

---

## 6. Alternative

| Strada                                | Cosa cambia                                                                                                                                                                 | Cambia il quadro?                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Claude con l'API diretta di Anthropic | stessi prezzi, Batch API e ricerca web disponibili; dati elaborati «global» o negli USA [10]; ZDR da chiedere [2]                                                           | no: va bene solo se Francesco accetta di elaborare fuori UE              |
| Claude tramite Google Cloud           | Google indica endpoint per area geografica [1]; non l'ho verificato modello per modello                                                                                     | no: è un piano B se AWS non va bene                                      |
| Mistral (azienda francese)            | Mistral Large a 0,5 $ in entrata e 1,5 $ in uscita per milione di token [12]: costa più di Haiku 5.5 e meno di Sonnet 5.5. La pagina dei prezzi non dice dove sono i server | no: non fa risparmiare e non l'ho provato in italiano sui nostri compiti |
| Modelli open su un cloud europeo      | costo fisso delle macchine e lavoro di manutenzione; prezzi non calcolati (servirebbe un preventivo)                                                                        | no, finché i Nest attivi sono migliaia: il costo dell'AI è di centesimi  |

**Lettura.** Il costo non spinge a cambiare fornitore: Haiku 5.5 è già il più economico tra quelli verificati. L'unico motivo per guardare altrove sarebbe la sede dei dati, e Bedrock UE lo risolve.

**I concorrenti.** Cozi Max costa 79 $ all'anno con l'AI che importa impegni e crea ricette, e i limiti d'uso dell'AI non risultano pubblicati (fonti secondarie [17]). Jam costa 119,99 $ all'anno (`concorrenti.md`). Nessuno, tra quelli visti, mostra un'energia o un contatore: una barra chiara può diventare un argomento di fiducia, se è generosa.

---

## 7. Proposta finale

**Architettura.** Coordinatore Haiku 5.5 e quattro agenti (Calendario, Casa, Lettura, Pianifica), Pasti in seconda fase. Strumenti di sola lettura con le regole dell'app e strumenti `proponi_…` che salvano solo dopo «Conferma». Messages API, senza Managed Agents.

**Fornitore.** Claude tramite Amazon Bedrock, profilo UE, regione di partenza Milano, conservazione «none».

**Modelli.** Haiku 5.5 per quasi tutto; Sonnet 5.5 per pianificare e per le foto difficili; niente Opus né Fable.

**Limiti.** Energia per Nest in punti pesati sul prezzo dei token. Base 30 punti, prova 300, Plus 1.000. Modalità essenziale con 100 punti di riserva. Tetto giornaliero al 20%.

**Prezzo.** Plus resta a 3,99 €/mese o 34,99 €/anno per tutto il Nest. Costo AI atteso circa 0,27 € al mese per Nest Plus, al massimo 1 €.

### 7.1 Rischi

| Rischio                                                                   | Probabilità   | Impatto | Cosa si fa                                                                                         |
| ------------------------------------------------------------------------- | ------------- | ------- | -------------------------------------------------------------------------------------------------- |
| Le stime d'uso sono sbagliate (non abbiamo dati)                          | alta          | medio   | la barra si tara dopo 30 giorni con le famiglie pioniere; il tetto protegge comunque i conti       |
| Haiku sbaglia date o persone in italiano                                  | media         | alto    | prova su 50 avvisi veri prima del lancio; «da verificare» sempre visibile; Sonnet per i casi dubbi |
| Prezzi o modelli cambiano (Haiku 5.5 resta almeno fino al 07/10/2027 [3]) | media         | medio   | il punto è legato al listino: si aggiorna il peso, non la barra                                    |
| Testo cattivo dentro impegni o foto                                       | media         | alto    | niente strumenti distruttivi, conferma obbligatoria, test dedicati del revisore sicurezza          |
| Dati sanitari che arrivano da una foto                                    | media         | alto    | istruzione all'agente Lettura, titolo scritto dall'adulto, domanda 6 all'agente legale-privacy     |
| L'energia del base sembra avara e irrita                                  | media         | medio   | 30 punti sono circa 35 domande; si misura quante case arrivano al limite                           |
| Bedrock non offre presto i modelli nuovi nel profilo UE                   | bassa         | medio   | AWS avverte che questi profili possono avere meno modelli [6]: si resta su Haiku e Sonnet 5.5      |
| Il nome «Nest» e Google Nest (domanda 47)                                 | da verificare | medio   | «Chiedi a Nest» aspetta la verifica del marchio; il piano B è «Chiedi a FamilyNest» della mappa    |

### 7.2 Domande per Francesco

| #   | Domanda                                                                                                        | Consiglio | Perché                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| 1   | Usiamo Claude come fornitore dell'assistente?                                                                  | **Sì**    | prezzi bassi, contratto che vieta l'addestramento, modelli adatti ai due tipi di compito |
| 2   | Lo usiamo tramite Amazon Bedrock con il profilo UE, invece dell'API diretta di Anthropic?                      | **Sì**    | i dati restano in Europa e Anthropic non li vede; costa il 10% in più su pochi centesimi |
| 3   | Haiku 5.5 per quasi tutto, Sonnet 5.5 solo per pianificare e per le foto difficili, niente Opus né Fable?      | **Sì**    | lo smistamento divide per dieci il costo delle domande semplici                          |
| 4   | Il limite si misura in token pesati per il prezzo e si mostra come «Energia di Nest» in percentuale?           | **Sì**    | rispetta la tua decisione 49 ed è giusto tra modelli diversi                             |
| 5   | Base con 30 punti al mese (circa 35 domande o 7 foto) e pianificazione solo in Plus?                           | **Sì**    | basta per provarlo; costa al massimo 3 centesimi a Nest                                  |
| 6   | Plus con 1.000 punti al mese per tutto il Nest, prova di 30 giorni con 300?                                    | **Sì**    | copre l'uso medio tre volte e tiene il costo sotto il 43% del ricavo netto               |
| 7   | Quando finisce l'energia di Plus: modalità essenziale fino al rinnovo, niente ricariche a pagamento al lancio? | **Sì**    | nessuno resta senza risposta e non serve un secondo prodotto da vendere                  |
| 8   | Il prezzo di Plus resta 3,99 €/mese e 34,99 €/anno?                                                            | **Sì**    | il costo AI atteso è circa il 12% del ricavo netto                                       |
| 9   | Conservazione «none» su Bedrock e conversazioni salvate da noi per 30 giorni, cancellabili?                    | **Sì**    | è quanto già promesso in #386, con il minimo di dati presso il fornitore                 |
| 10  | Nella prima versione l'assistente non va su internet (niente regali online né fornitori)?                      | **Sì**    | su Bedrock la ricerca web di Anthropic non c'è; si decide nella seconda fase             |
| 11  | Prima del lancio, una prova di Haiku 5.5 su 50 avvisi veri delle famiglie pioniere, con il loro consenso?      | **Sì**    | è il rischio più alto: l'italiano delle circolari scolastiche                            |

---

## Fonti

1. Anthropic, «Pricing», https://platform.claude.com/docs/en/about-claude/pricing, letta il 18/11/2026 (prezzi per modello, cache, Batch API, prezzo a lungo contesto di Haiku 5.5, ricerca web a 10 $ ogni 1.000, endpoint regionali +10%).
2. Anthropic, «API and data retention», https://platform.claude.com/docs/en/manage-claude/api-and-data-retention, letta il 18/11/2026.
3. Anthropic, «Models overview», https://platform.claude.com/docs/en/about-claude/models/overview, letta il 18/11/2026.
4. Anthropic, «Vision», https://platform.claude.com/docs/en/build-with-claude/vision, letta il 18/11/2026 (costo delle immagini).
5. Anthropic, «Prompt caching», https://platform.claude.com/docs/en/build-with-claude/prompt-caching, letta il 18/11/2026.
6. AWS, «Claude Haiku 5.5» (scheda del modello su Bedrock), https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-5-5.html, letta il 18/11/2026.
7. AWS, «Claude Sonnet 5.5» (scheda del modello su Bedrock), https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-5-5.html, letta il 18/11/2026.
8. Anthropic, «Commercial Terms of Service», https://www.anthropic.com/legal/commercial-terms, letta il 18/11/2026 (data in testa: 17/06/2025).
9. Anthropic Privacy Center, «How long do you store my organization's data?», https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data, aggiornata il 01/07/2026, letta il 18/11/2026.
10. Anthropic, «Data residency», https://platform.claude.com/docs/en/manage-claude/data-residency, letta il 18/11/2026.
11. Banca d'Italia, «Cambi di riferimento del 16 novembre 2026», https://www.bancaditalia.it/compiti/operazioni-cambi/cambio/cambi_rif_20261116 (1 € = 1,1014 $, dato riportato dalla ricerca web del 18/11/2026).
12. Mistral AI, «Pricing», https://mistral.ai/pricing, letta il 18/11/2026 (sulla pagina c'è solo il prezzo di Mistral Large).
13. Anthropic, «Data Processing Addendum», https://www.anthropic.com/legal/data-processing-addendum; per le clausole tipo (moduli 2 e 3) fonti secondarie come https://compound.law/en-DE/tools/anthropic-scc/, consultate il 18/11/2026. Da verificare sul testo ufficiale.
14. Anthropic Help Center, «Child safety guidance for developers», https://support.claude.com/en/articles/15591275-child-safety-guidance-for-developers, aggiornata il 26/06/2026, letta il 18/11/2026.
15. AWS, «Data protection» (Bedrock), https://docs.aws.amazon.com/bedrock/latest/userguide/data-protection.html, letta il 18/11/2026.
16. AWS, «Data retention» (Bedrock), https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html, letta il 18/11/2026.
17. Cozi, «Cozi Max», https://www.cozi.com/cozi-max/, e «Compare plans», https://www.cozi.com/compare-plans/, citati da una ricerca web del 18/11/2026; prezzo e funzioni da confermare sulla pagina.
18. Ubersuggest (account di Francesco), suggerimenti di parole chiave, Italia, lingua italiana, 18/11/2026.
19. Documenti interni: #386, #444 (commento del 18/11/2026), `mappa-funzionalita.md`, `strategia-crescita.md`, `prezzo-per-nest.md`, `business-case-mercato.md` (ricavo netto di 28 € a casa), `concorrenti.md`.
