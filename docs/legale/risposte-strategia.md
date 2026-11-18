# Risposte alle domande legali degli studi dello stratega

Bozza dell'agente legale-privacy, 18/11/2026. Risponde alle domande di:

- `docs/strategia/gamification-benessere.md`, Parte 2, sezione 9 (issue #462): domande G-L1 … G-L6;
- `docs/strategia/assistente-ai.md`, sezione 5.4 (issue #466): domande A-L1 … A-L9.

Non è il parere di un avvocato. Francesco, come titolare del trattamento, decide e approva. Per ogni risposta indico la fonte e se il punto è **obbligatorio** (lo chiede una norma) o **consigliato** (buona pratica o scelta prudente). I punti da far vedere a un professionista sono segnati con **Verifica professionale**.

## In breve

| #    | Domanda in poche parole                                        | Risposta in poche parole                                                                                | Tipo                                                    |
| ---- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| G-L1 | Impegno «movimento» conservato per anni: dato sanitario?       | No, finché non misura il corpo e non trae conclusioni sulla salute. Traguardo per Nest, non per persona | Classificazione obbligatoria; regole consigliate        |
| G-L2 | Idee per fascia d'età: finalità nuova da dichiarare?           | Finalità compatibile con il servizio, ma va scritta nell'informativa                                    | Obbligatorio (art. 13)                                  |
| G-L3 | Grazie e Traguardi: quanto si tengono, vanno in «I tuoi dati»? | Grazie 30 giorni; traguardi del Nest finché c'è il Nest, senza nome di chi; sì nel file                 | Termine obbligatorio da fissare; durate consigliate     |
| G-L4 | «Chi si occupa di cosa»: basta il consenso di tutti?           | Non serve un consenso privacy; l'accensione da parte di tutti resta come scelta di progetto             | Base e informativa obbligatorie; accensione consigliata |
| G-L5 | Passi o sonno da Apple Salute o Health Connect                 | Dati sanitari: consenso esplicito, DPIA, parere professionale. Consiglio di non farlo                   | Obbligatorio se si fa                                   |
| G-L6 | Linee guida DSA sui minori come regola interna?                | Sì. Non si applicano a noi, ma diverse regole arrivano comunque da GDPR e Codice del consumo            | Consigliato                                             |
| A-L1 | Base giuridica dell'assistente                                 | Esecuzione del contratto; nessun consenso separato per gli adulti                                       | Obbligatorio scegliere e dichiarare la base             |
| A-L2 | Informativa sull'assistente                                    | Testo pronto nella risposta                                                                             | Obbligatorio                                            |
| A-L3 | Serve una DPIA?                                                | Sì                                                                                                      | Obbligatorio                                            |
| A-L4 | Foto con nomi di altri bambini                                 | Sì, con avviso, ritaglio, nessuna conservazione e istruzioni al modello                                 | Obbligatorio il bilanciamento; misure consigliate       |
| A-L5 | AI Act: basta la trasparenza?                                  | Sì: trasparenza (art. 50) e alfabetizzazione (art. 4). Non è ad alto rischio                            | Obbligatorio                                            |
| A-L6 | Dati sanitari nelle foto                                       | Il filtro da solo non basta: vietare alcuni tipi di documenti e far rifiutare la lettura                | Obbligatorio non trattarli; misure consigliate          |
| A-L7 | Assistente negli account dei figli                             | Sotto i 14 anni serve il consenso del genitore; consiglio no per tutti i minori                         | Obbligatorio sotto 14; resto consigliato                |
| A-L8 | Basta il DPA di AWS?                                           | Sì, se Anthropic non accede ai dati; da verificare sui contratti                                        | Obbligatorio il contratto art. 28                       |
| A-L9 | Energia e limiti: dati personali?                              | Sì, da indicare nell'informativa con base e durata                                                      | Obbligatorio                                            |

C'è anche una domanda che lo stratega non ha fatto, ma va chiusa prima del lancio dell'assistente: la **prova su 50 avvisi veri** delle famiglie pioniere (domanda 11 per Francesco in `assistente-ai.md`). È in fondo, sezione 3.

Fatti dell'app su cui mi baso (letti nel codice e nelle migrazioni il 18/11/2026):

- i profili dei figli hanno una data di nascita facoltativa (`household_members.birth_date`);
- le cose da fare hanno «fatta da» e «fatta il» (`done_by_member_id`, `done_at`) e si cancellano 90 giorni dopo essere state fatte; le notifiche si cancellano dopo 30 giorni;
- gli **impegni passati non hanno una pulizia automatica**: restano finché qualcuno li cancella o finché il Nest esiste;
- il file «I tuoi dati» (`/profilo/dati`) contiene profilo, Nest, membri, impegni, cose da fare, scadenze, spesa, spazi fissati, preferenze delle notifiche e interessi per gli spazi;
- l'informativa completa non è ancora pubblicata (#147): la pagina `/privacy` oggi è provvisoria.

---

## 1. Gamification e Benessere (`gamification-benessere.md`, sezione 9)

### G-L1. Un impegno «all'aperto» o «movimento», conservato per anni, è un dato sanitario? E un traguardo che si somma?

**Risposta.** Di per sé **no**. Un impegno «Passeggiata della domenica» con Marco, Laura, Sofia e Tommaso dice come la famiglia organizza il tempo, non come sta. Per il GDPR un dato è sanitario quando riguarda la salute fisica o mentale e rivela qualcosa sullo stato di salute. Lo diventa anche in modo indiretto, se da quel dato si **ricava** un'informazione sulla salute. Il rischio cresce con tre cose, ed è lì che vanno messe le regole:

1. **Misure del corpo o della prestazione**: passi, minuti, distanza, calorie, frequenza. Con questi dati raccolti nel tempo si possono trarre conclusioni sulla salute (WP29, 2015).
2. **Conclusioni sulla salute** mostrate o calcolate: «Sofia si muove meno del solito», «siete più in forma», «Tommaso non fa movimento da 3 mesi».
3. **Riferimenti a una persona sola** nel tempo, soprattutto un figlio.

Il traguardo «la vostra ventesima passeggiata della domenica» resta fuori dai dati sanitari se è un **conteggio di impegni del Nest**, senza misure e senza conclusioni. Un traguardo «Sofia ha camminato 100 km quest'anno» no.

Un limite che c'è già: il **titolo libero** di un impegno può contenere dati sanitari («Fisioterapia di Marco»). Questo vale per tutto il calendario e non dipende dal tipo «movimento». La regola resta quella di oggi: nessun campo o tipo dedicato alla salute (D1), nessun esempio sanitario nei testi e nei test.

**Sulla conservazione per anni.** Il GDPR non fissa una durata, ma chiede che i dati si tengano solo per il tempo necessario (limitazione della conservazione). Oggi gli impegni passati non si cancellano mai da soli. Non è un problema del tipo «movimento», ma va deciso per tutto il calendario e scritto nell'informativa: per esempio «gli impegni restano finché li cancellate o cancellate il Nest». Se Francesco vuole un limite (per esempio 3 anni dopo la data dell'impegno), lo realizza l'architetto dati con un job `pg_cron`.

**Fonti.** art. 4, n. 15, e considerando 35 GDPR; art. 9, par. 1, GDPR; Corte di giustizia UE, C-184/20 (OT, 01/08/2022), sui dati che rivelano in modo indiretto categorie particolari; Gruppo di lavoro Articolo 29, allegato sui dati sanitari nelle app di benessere (05/02/2015); art. 5, par. 1, lett. e, GDPR; decisione D1.

**Tipo.** La classificazione dipende dalla legge (**obbligatorio** trattarlo come sanitario se lo diventa). Le regole sotto sono **consigliate** per restare fuori dall'art. 9. Il termine di conservazione degli impegni da scrivere nell'informativa è **obbligatorio** (art. 13, par. 2, lett. a).

**Criteri di accettazione da aggiungere alla specifica.**

1. Il tipo «insieme», «all'aperto» o «movimento» è un'etichetta dell'impegno, senza campi per durata misurata, distanza, passi, calorie o sforzo.
2. I traguardi di movimento contano gli impegni del Nest, non le persone, e non nominano un figlio.
3. Nessun testo dell'app trae conclusioni sulla salute o sulla forma fisica di qualcuno, né per gli adulti né per i figli.
4. Nessun traguardo legato a figli, età, scuola o crescita (già nella sezione 4 dello studio).

### G-L2. Il catalogo di idee per fascia d'età usa la data di nascita del profilo: va scritto nell'informativa come finalità nuova?

**Risposta.** Sì, va scritto, ma non serve un consenso nuovo.

- **È una finalità compatibile.** Il genitore ha inserito la data di nascita per organizzare la vita del figlio dentro il Nest. Usarla per proporre idee adatte all'età, dentro lo stesso Nest, è legato alla finalità di partenza, non porta i dati fuori e non ha conseguenze negative per il bambino. Sono i criteri della compatibilità dell'art. 6, par. 4. Trattandosi di un minore, la valutazione regge se la proposta resta semplice: fascia d'età larga, calcolata nell'app, mostrata solo agli adulti del Nest.
- **Va comunque scritta.** L'informativa deve elencare tutte le finalità per cui usiamo i dati (art. 13, par. 1, lett. c). Se un uso compatibile si aggiunge dopo che l'informativa è stata data, bisogna informare prima di cominciare (art. 13, par. 3). Visto che l'informativa completa non è ancora pubblicata (#147), basta inserirla da subito tra gli usi della data di nascita: «per mostrarvi le idee adatte all'età dei figli in Tempo insieme».
- **È profilazione?** Scegliere contenuti in base all'età è al limite della definizione di profilazione (art. 4, n. 4). Anche se lo fosse, non è una decisione con effetti giuridici o simili (art. 22), quindi non servono consenso o intervento umano. Basta la trasparenza.

**Fonti.** art. 5, par. 1, lett. b; art. 6, par. 4; art. 13, par. 1, lett. c, e par. 3; art. 4, n. 4; art. 22 GDPR; considerando 38 GDPR (protezione specifica dei minori).

**Tipo.** Scriverlo nell'informativa: **obbligatorio**. Le condizioni sotto: **consigliate**, ma senza di esse la compatibilità diventa discutibile.

**Criteri di accettazione.**

1. La fascia d'età si calcola dall'anno o dalla data di nascita già nel profilo; la funzione non chiede altri dati del figlio.
2. Fasce larghe (per esempio 0–2, 3–5, 6–10, 11–14 anni); né la data né l'età esatta compaiono nella pagina dell'idea.
3. La fascia non va negli analytics, nelle richieste all'assistente AI o a fornitori esterni, e non si usa per pubblicità o offerte.
4. Se un figlio non ha data di nascita, il catalogo mostra le idee per tutte le età e non chiede di completarla.
5. Una riga nella pagina spiega perché si vedono quelle idee («In base all'età di Sofia e Tommaso»).

### G-L3. «Grazie» e Traguardi del Nest: per quanto si tengono e devono uscire in «I tuoi dati»?

**Risposta sulla durata.** La legge non dà un numero: si tengono finché servono alla finalità, e il termine va scritto nell'informativa. La mia proposta:

| Dato                                                                   | Perché serve                                                               | Durata proposta                                                                                                                       |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Grazie**: chi l'ha detto, a chi, su quale cosa, quando               | mostrarlo in Oggi, nella sintesi del mattino, nel Riepilogo della domenica | **30 giorni**, come le notifiche; prima, se si cancella la cosa a cui si riferisce (la cosa da fare fatta si cancella dopo 90 giorni) |
| **Traguardo del Nest**: quale traguardo e quando                       | ricordare i momenti della casa                                             | **finché esiste il Nest**; non serve sapere chi l'ha fatto scattare, quindi non si salva                                              |
| Contatori per i traguardi che si sommano («decima settimana di spesa») | sapere quando scatta il traguardo                                          | un numero per Nest, non lo storico delle singole azioni né i nomi                                                                     |
| «Chi ha chiuso l'ultima cosa» della festa piccola                      | la frase con il nome                                                       | non si salva: si legge dalla riga già esistente                                                                                       |

Con queste scelte i Traguardi non contengono dati di una persona sola, ma restano dati del Nest, quindi delle persone che ne fanno parte.

**Risposta sul file «I tuoi dati».**

- Il **diritto di accesso** copre tutti i dati personali dell'utente: se qualcuno chiede «che dati avete su di me», grazie e traguardi vanno dati, file o non file, entro un mese.
- Il **diritto alla portabilità** copre i dati che l'utente ci ha fornito, compresi quelli che nascono dal suo uso del servizio: il grazie che Marco dà è un suo dato fornito. I traguardi sono calcolati da noi, e i dati calcolati non rientrano nella portabilità (Linee guida WP242).
- Il file «I tuoi dati» è il modo più semplice per rispettare entrambi i diritti senza lavoro a mano. **Consiglio di metterci** i grazie dati e ricevuti (il nome dell'altro adulto è già nel file, tra i membri) e i traguardi del Nest.

**Alla cancellazione dell'account**: i grazie dati e ricevuti da chi se ne va si cancellano; i traguardi restano al Nest, perché non nominano nessuno.

**Fonti.** art. 5, par. 1, lett. e; art. 13, par. 2, lett. a; art. 15; art. 20; art. 12, par. 3 (un mese per rispondere) GDPR; Gruppo di lavoro Articolo 29, Linee guida sul diritto alla portabilità dei dati, WP242 rev.01 (05/04/2017), sezione sui dati «forniti dall'interessato».

**Tipo.** Fissare e scrivere un termine: **obbligatorio**. Le durate proposte: **consigliate**. Dare i dati su richiesta: **obbligatorio**. Metterli nel file: **consigliato** (è il modo più semplice di rispettare l'obbligo).

**Criteri di accettazione.**

1. I grazie si cancellano dopo 30 giorni con un job `pg_cron`, e subito se si cancella la cosa a cui si riferiscono o l'account di chi li ha dati o ricevuti.
2. Nessun conteggio dei grazie per persona, né salvato né mostrato (già nello studio).
3. Il traguardo salva solo tipo e data, non la persona.
4. Il file «I tuoi dati» contiene i grazie dati e ricevuti e i traguardi del Nest.
5. Mai grazie da o verso i profili dei figli (già nello studio).

### G-L4. La vista «Chi si occupa di cosa» mostra a un adulto le responsabilità dell'altro: basta il consenso di tutti gli adulti dentro l'app?

**Risposta.** Non serve un consenso nel senso del GDPR, e consiglio di **non** usarlo come base giuridica. L'accensione da parte di tutti gli adulti va tenuta, ma come scelta di progetto.

- **Base giuridica: esecuzione del contratto.** Ogni adulto del Nest ha scelto di usare un servizio in cui gli altri adulti vedono chi si occupa delle cose della casa. I dati ci sono già (chi se ne occupa, nelle cose da fare e nelle scadenze); la vista li raccoglie per aree. È parte del servizio che l'adulto ha chiesto.
- **Perché non il consenso.** Il consenso deve essere libero e revocabile in ogni momento (art. 4, n. 11, e art. 7). In una coppia la libertà non è sempre scontata: chi dice no può sentirsi sotto pressione. Un consenso privacy dato in queste condizioni sarebbe fragile.
- **Perché tenere l'accensione di tutti.** È la protezione fin dalla progettazione dell'art. 25: la vista mette insieme informazioni in un modo nuovo (un quadro del carico) che può pesare nella vita di coppia. La regola «si accende solo se tutti dicono sì, si spegne da uno qualsiasi, nessuna notifica» riduce il rischio di uso come strumento di controllo. È coerente con il considerando 75, che tra i danni da evitare cita anche quelli non materiali.
- **Cosa dire.** Nell'informativa una riga sulla vista; nel foglio di accensione cosa mostra, a chi, e come si spegne. Serve l'informazione, non una firma.
- **Il dato si rivolge all'interno della famiglia**, ma l'esenzione per le attività domestiche (art. 2, par. 2, lett. c) vale per gli utenti tra loro, non per noi: il GDPR si applica a chi fornisce i mezzi (considerando 18).
- **Account dei figli (quando arriveranno):** la vista non si mostra ai figli.

**Fonti.** art. 6, par. 1, lett. b; art. 4, n. 11; art. 7; art. 25; art. 2, par. 2, lett. c, e considerando 18 e 75 GDPR; EDPB, Linee guida 05/2020 sul consenso, sezione 3.1 (libertà del consenso e squilibrio tra le parti).

**Tipo.** Base giuridica e informativa: **obbligatorie**. Accensione da parte di tutti e spegnimento da uno qualsiasi: **consigliati**.

**Criteri di accettazione.**

1. La vista resta spenta finché ogni adulto con account del Nest non la accetta dal proprio account.
2. Un qualsiasi adulto la spegne con un tocco; spenta, nessun adulto la vede.
3. Mostra solo aree e nomi dei responsabili; nessun numero, percentuale o grafico per persona.
4. Nessuna notifica, mail o riga nella sintesi del mattino sulla vista.
5. Un adulto che entra nel Nest dopo la vede spenta finché non la accetta anche lui.

### G-L5. Passi o sonno degli adulti da Apple Salute o Health Connect

**Risposta.** Sono **dati sanitari**, quindi categorie particolari. Concordo con lo stratega: serve un parere professionale prima di qualsiasi progetto, e il mio consiglio è di non farlo (domande B3 e B4 dello studio). Se un giorno Francesco volesse farlo, ecco cosa servirebbe:

| Tema                  | Cosa serve                                                                                                                                                          | Fonte                                                                     | Tipo                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------- |
| Base giuridica        | Consenso **esplicito** di ogni adulto, per i propri dati, separato dal resto, per ogni tipo di dato (passi, sonno), revocabile con la stessa facilità con cui si dà | art. 9, par. 2, lett. a; art. 6, par. 1, lett. a; art. 7, par. 3 GDPR     | Obbligatorio                             |
| Garanzie italiane     | Rispetto delle misure di garanzia del Garante per i dati sanitari, se adottate per questo tipo di trattamento (da verificare al momento)                            | art. 2-septies Codice privacy                                             | Obbligatorio                             |
| DPIA                  | Sì: dati sanitari, tecnologia nuova (lettura da dispositivi), dati raccolti nel tempo, condivisione in famiglia. Più di due criteri delle linee guida               | art. 35 GDPR; WP248 rev.01; Garante, provvedimento n. 467 dell'11/10/2018 | Obbligatorio                             |
| Condivisione nel Nest | Predefinito privato; ogni adulto sceglie per ogni dato se gli altri lo vedono                                                                                       | art. 25, par. 2 GDPR                                                      | Obbligatorio il predefinito protettivo   |
| Conservazione         | Solo i dati mostrati, per il periodo mostrato; cancellazione alla revoca del consenso e alla disconnessione                                                         | art. 5, par. 1, lett. c ed e; art. 17, par. 1, lett. b GDPR               | Obbligatorio                             |
| Fornitori             | Mai all'assistente AI né agli analytics                                                                                                                             | art. 5, par. 1, lett. b e c                                               | Consigliato                              |
| Regole degli store    | Apple: niente uso per pubblicità, niente dati di salute in iCloud. Google: dichiarazione nella Play Console e accesso solo per una funzione visibile                | Apple, App Review Guidelines 5.1.3; Google Play, regole di Health Connect | Obbligatorio per pubblicare              |
| Dispositivo medico    | Software per stile di vita e benessere non è un dispositivo medico; lo diventa se promette di prevenire, diagnosticare o curare                                     | considerando 19 e art. 2 Reg. UE 2017/745                                 | Obbligatorio non fare promesse sanitarie |
| Figli                 | Mai, in nessuna forma                                                                                                                                               | decisione D1                                                              | Decisione di Francesco                   |
| App nativa            | Le due interfacce esistono solo nelle app per iOS e Android                                                                                                         | documentazione Apple e Google citata dallo stratega                       | Fatto tecnico                            |

**Verifica professionale.** Obbligatoria nella sostanza prima di qualsiasi progetto: dati sanitari in un contesto familiare, con condivisione tra adulti, sono il caso in cui un errore costa di più.

### G-L6. Le linee guida della Commissione sul DSA per i minori non valgono per le piccole imprese: le adottiamo comunque come regola interna per tutta la gamification?

**Risposta.** **Sì, consiglio di adottarle** come regola interna. Ma è utile sapere che non valgono per noi per due motivi, e che alcune delle stesse regole arrivano comunque da altre leggi.

- **Perché non si applicano.** L'art. 28 del DSA riguarda le piattaforme online; le parti private del Nest non sono una piattaforma online, perché i contenuti non vanno al pubblico. E le micro e piccole imprese sono escluse dagli obblighi della sezione in cui sta l'art. 28 (art. 19 DSA). Lo stesso è già scritto in `eta-figli.md`, sezione 2.4.
- **Cosa arriva comunque da altre leggi:**
  - il GDPR chiede correttezza e protezione fin dalla progettazione: un'interfaccia che spinge a dare più dati del necessario è contraria agli artt. 5, par. 1, lett. a, e 25 (EDPB, Linee guida 03/2022 sui modelli di design ingannevoli);
  - il **Codice del consumo** vieta le pratiche commerciali aggressive e ingannevoli: «compra Plus per non perdere i traguardi», conti alla rovescia falsi o messaggi che fanno sentire in colpa per spingere all'acquisto possono diventarlo (artt. 20–26); è vietata in ogni caso l'esortazione diretta ai bambini a comprare o a convincere i genitori (art. 26, comma 1, lett. e). Questo vale per le schermate di Plus e per i futuri account dei figli;
  - se l'assistente AI entrasse nella gamification, l'AI Act vieta i sistemi che sfruttano la vulnerabilità dovuta all'età per distorcere il comportamento con danni significativi (art. 5, par. 1, lett. b, Reg. UE 2024/1689).
- **Cosa adottare.** Le regole della sezione 4 dello studio (niente serie, classifiche, valuta virtuale, protezioni a pagamento, notifiche «non perdere», confronti con altre famiglie) coincidono con le linee guida. Consiglio di scriverle come regola di prodotto valida **per tutti gli utenti**, adulti compresi, non solo per i minori.

**Fonti.** artt. 19 e 28 Reg. UE 2022/2065 (DSA); Commissione europea, linee guida sulla protezione dei minori ai sensi dell'art. 28 DSA (14/07/2025); artt. 5, par. 1, lett. a, e 25 GDPR; EDPB, Linee guida 03/2022 sui deceptive design patterns (versione 2.0, 14/02/2023); d.lgs. 206/2005 (Codice del consumo), artt. 20–26; art. 5, par. 1, lett. b, Reg. UE 2024/1689.

**Tipo.** Adottare le linee guida DSA: **consigliato**. Non usare pratiche commerciali aggressive o ingannevoli e niente design ingannevole sui dati: **obbligatorio** per le altre leggi citate.

---

## 2. Assistente AI (`assistente-ai.md`, sezione 5.4)

L'impostazione su cui rispondo è quella proposta dallo stratega: Claude tramite Amazon Bedrock con profilo UE, conservazione «none» presso AWS, conversazioni salvate da noi per 30 giorni, solo adulti, nessuna scrittura senza «Conferma». Se l'impostazione cambia (per esempio API diretta di Anthropic, con elaborazione negli Stati Uniti), alcune risposte cambiano: lo segnalo dove succede.

### A-L1. Base giuridica: esecuzione del contratto o consenso separato al primo uso?

**Risposta. Esecuzione del contratto**, per gli adulti. Nessun consenso privacy separato.

- L'assistente risponde a una richiesta dell'adulto («Cosa abbiamo sabato?»). Leggere i dati del Nest e mandarli al modello per rispondere è necessario per dare la funzione che ha chiesto. Il fornitore AI è il mezzo tecnico (responsabile del trattamento), non una finalità nuova.
- Questo vale anche per i dati degli **altri adulti** del Nest (sono parti dello stesso servizio, con le loro regole di visibilità) e dei **figli** (inseriti dai genitori proprio per organizzare la famiglia).
- Il consenso sarebbe la base sbagliata: dovrebbe essere revocabile in ogni momento e dato da ognuno per i propri dati, e Laura dovrebbe consentire perché Marco possa chiedere del calendario comune. Sarebbe ingestibile e poco chiaro.
- **Cosa serve al posto del consenso**: informativa completa (A-L2) e un foglio breve al primo uso che dica cosa legge l'assistente, che non salva nulla senza «Conferma» e che si tratta di un'AI (A-L5). Consiglio anche un interruttore per tutto il Nest, gestito da un amministratore, per spegnere l'assistente.
- **Due eccezioni**, con base diversa: i dati di **terzi nelle foto** (A-L4, interesse legittimo) e un eventuale **uso delle conversazioni per migliorare il servizio** o per addestramento, che oggi non è previsto e richiederebbe una nuova valutazione e probabilmente il consenso.
- **Figli con account sotto i 14 anni:** per la legge italiana sull'AI serve il consenso del genitore (A-L7).

**Fonti.** art. 6, par. 1, lett. b, GDPR; EDPB, Linee guida 2/2019 sull'art. 6, par. 1, lett. b, nel contesto dei servizi online (versione 2.0, 08/10/2019); art. 28 GDPR; art. 4, comma 4, legge 23 settembre 2025, n. 132.

**Tipo.** Scegliere, documentare e dichiarare la base: **obbligatorio** (artt. 5, par. 2, e 13, par. 1, lett. c). Foglio al primo uso: **obbligatorio** per la parte sull'AI (A-L5), consigliato per il resto. Interruttore del Nest: **consigliato**.

**Verifica professionale.** Consigliata, insieme alla DPIA (A-L3): il contratto come base per un'AI che legge dati di più persone di una famiglia è la scelta più diffusa, ma non ho trovato un provvedimento del Garante su un caso uguale.

### A-L2. Informativa: come descrivere Bedrock UE, AWS, Anthropic e i 30 giorni

**Risposta.** Ecco il testo per la sezione dell'informativa (#147). Va pubblicato **solo dopo** aver verificato i punti segnati con [da verificare]. Se si usa l'API diretta di Anthropic, il testo cambia: il fornitore diventa Anthropic Ireland, Limited e c'è un trasferimento verso gli Stati Uniti da descrivere.

> **L'assistente di FamilyNest**
>
> L'assistente risponde alle domande sulla vostra casa («Cosa abbiamo sabato?») e prepara impegni, voci della spesa e cose da fare. Niente si salva finché non toccate «Conferma».
>
> **Cosa legge.** Solo quello che chi fa la domanda vede già nell'app, e solo quello che serve per rispondere: per esempio gli impegni di sabato con i nomi delle persone. Non legge mai gli impegni «Solo io» degli altri, il testo degli impegni «Occupato», le note, la scuola dei figli, le maestre, le date di nascita, mail, telefoni e indirizzi. Dei figli usa il nome e, se la domanda lo chiede, l'età in anni.
>
> **Le foto.** Se fotografate un avviso, l'assistente lo legge per trovare date e orari. Non teniamo la foto: la leggiamo e la cancelliamo. Fotografate solo il foglio. Non fotografate documenti sanitari.
>
> **Chi lo fa funzionare.** Usiamo il modello di intelligenza artificiale Claude, attraverso il servizio Amazon Bedrock di Amazon Web Services EMEA SARL [da verificare: società con cui si firma il contratto], che tratta i dati per nostro conto come responsabile del trattamento. Le richieste sono elaborate in centri dati nell'Unione europea. AWS non conserva le domande né le risposte. Anthropic, la società che sviluppa Claude, non riceve i vostri dati [da verificare sui contratti, A-L8].
>
> **Addestramento.** Le vostre domande e le vostre foto non servono ad addestrare nessuna intelligenza artificiale.
>
> **Quanto teniamo le conversazioni.** Le conversazioni con l'assistente restano nel vostro account per 30 giorni, poi si cancellano. Potete cancellarle prima quando volete.
>
> **Limiti di utilizzo.** Contiamo quanta «energia» usa il vostro Nest e quante richieste fa ogni adulto, per applicare i limiti del piano ed evitare abusi. Non registriamo il testo delle domande per questo (dettagli in A-L9).
>
> **Base giuridica.** Trattiamo questi dati per darvi la funzione che chiedete (esecuzione del contratto). I dati di altre persone che compaiono in una foto li trattiamo per il nostro interesse legittimo e il vostro a leggere l'avviso, solo per il tempo della lettura.
>
> **Decisioni automatiche.** L'assistente propone, non decide: ogni azione la confermate voi. Non prende decisioni che hanno effetti giuridici su di voi.

**Cosa va anche in `fornitori.md` (quando esisterà):** AWS come responsabile, servizio Bedrock, regioni del profilo UE, DPA accettato con la data, conservazione «none», sub-responsabili di AWS; Anthropic come sviluppatore del modello senza accesso ai dati, con il riferimento alle condizioni accettate su Bedrock.

**Trasferimenti.** Con il profilo UE l'elaborazione resta nell'Unione. AWS però è una società di un gruppo statunitense, e il suo DPA prevede le garanzie per eventuali accessi da fuori UE (clausole tipo; il gruppo Amazon risulta tra le società certificate nel Data Privacy Framework UE-USA, [da verificare sulla lista ufficiale]). Nell'informativa basta dire dove sono elaborati i dati e, se il DPA lo prevede, che eventuali trasferimenti avvengono con le garanzie degli artt. 45 o 46.

**Fonti.** art. 13, par. 1, lett. c, e ed f, e par. 2, lett. a ed f; art. 12, par. 1; artt. 22, 28, 44–46 GDPR; decisione di adeguatezza UE-USA (Data Privacy Framework) della Commissione del 10/07/2023; fatti contrattuali da `assistente-ai.md`, sezione 5.1.

**Tipo.** Contenuti dell'informativa: **obbligatori**. Le frasi «non addestra» e «Anthropic non riceve i dati» si possono scrivere solo se vere: un'affermazione falsa è un'informativa scorretta e, verso chi paga Plus, una pratica commerciale ingannevole (art. 21 Codice del consumo).

### A-L3. Serve una valutazione d'impatto (DPIA) per un'AI che legge dati familiari con nomi di minori?

**Risposta. Sì.** L'assistente soddisfa almeno due criteri delle linee guida europee, e con due criteri la DPIA serve nella maggior parte dei casi:

- **dati di soggetti vulnerabili**: i figli, minori;
- **uso innovativo di tecnologie**: un modello di AI generativa che legge calendari e foto; il Garante lo indica nel suo elenco tra i casi da valutare insieme ad almeno un altro criterio;
- in parte anche **dati di carattere molto personale** (la vita quotidiana di una famiglia) e **dati di terzi** nelle foto.

La DPIA non è un documento a parte da zero: è un capitolo della DPIA generale dell'app (`dpia.md`, ancora da scrivere), da completare **prima del lancio dell'assistente**. Contenuti minimi: cosa legge ogni agente, cosa non legge mai (sezione 5.3 dello studio), percorso dei dati verso Bedrock, conservazione, rischi (errore del modello su date e persone, testo malevolo dentro impegni o foto, dati sanitari nelle foto, dati di altri bambini), misure e rischio residuo. Se il rischio residuo restasse alto, servirebbe la consultazione preventiva del Garante (art. 36); con le misure proposte dallo stratega non me lo aspetto.

**Fonti.** art. 35, parr. 1, 3 e 7, GDPR; Gruppo di lavoro Articolo 29, Linee guida sulla DPIA, WP248 rev.01 (04/10/2017), criteri 4, 7 e 8; Garante, provvedimento n. 467 dell'11/10/2018 (elenco delle tipologie di trattamenti soggetti a DPIA); art. 36 GDPR.

**Tipo. Obbligatorio.**

### A-L4. La foto di un avviso con i nomi di altri bambini: basta leggerla senza conservarla, con un avviso prima dello scatto?

**Risposta.** Sì, se le misure sono tutte insieme. I nomi di altri bambini (per esempio l'elenco dei turni per la merenda) sono dati di terzi che non hanno un rapporto con noi.

- **Base giuridica:** interesse legittimo (nostro e dell'utente: leggere l'avviso per organizzare la famiglia). Richiede un **bilanciamento scritto**: lettura di pochi secondi, nessuna conservazione, nessun uso diverso, nessun nome di terzi nella proposta. Con queste condizioni l'interesse prevale; trattandosi di minori, il bilanciamento va fatto con particolare cura (l'art. 6, par. 1, lett. f, lo dice espressamente).
- **Informativa ai terzi:** non possiamo sapere chi sono e non conserviamo nulla. Si applica l'esenzione per sforzo sproporzionato, da motivare nella DPIA, e la sezione dell'informativa pubblica descrive comunque questo trattamento.
- **Misure, tutte insieme:**
  1. avviso prima dello scatto: «Fotografa solo il foglio. Se ci sono nomi di altri bambini, puoi coprirli o ritagliarli.»;
  2. ritaglio prima dell'invio, già proposto dallo stratega per ridurre i token;
  3. istruzione all'agente Lettura: riportare solo date, orari, luogo generico e cosa portare per la propria famiglia; **mai** nomi di altri bambini o adulti nella proposta;
  4. nessuna conservazione: né la foto né il testo letto restano da noi o da AWS (conservazione «none»); resta solo l'impegno che l'adulto conferma;
  5. foto e testo letto mai nei log, negli errori, nella cronologia delle conversazioni dei 30 giorni o negli analytics (nella cronologia resta «Hai inviato una foto»).

**Fonti.** art. 6, par. 1, lett. f, GDPR; art. 14, par. 5, lett. b, GDPR; art. 5, par. 1, lett. c ed e; art. 25 GDPR; skill `privacy-e-dati-minori` (niente dati personali nei log).

**Tipo.** Base giuridica e bilanciamento documentato: **obbligatori**. Le cinque misure: **consigliate**, ma senza la 4 e la 5 il bilanciamento non regge.

**Criteri di accettazione.**

1. Prima della prima foto compare l'avviso del punto 1; si può rileggere in ogni momento.
2. La foto si può ritagliare prima dell'invio.
3. Su 20 avvisi di prova con nomi di altri bambini (dati di prova: Marco, Laura, Sofia, Tommaso e nomi inventati), nessuna proposta contiene nomi diversi da quelli del Nest.
4. Dopo la risposta, né la foto né il testo letto sono nel database, nello storage o nei log dell'app.

### A-L5. Regolamento europeo sull'AI: per un assistente che propone e non decide bastano gli obblighi di trasparenza?

**Risposta. Sì, con due aggiunte.** L'assistente non è vietato (art. 5) e non è ad alto rischio: non rientra negli usi dell'allegato III. L'allegato cita l'istruzione, ma per sistemi che decidono l'ammissione o valutano l'apprendimento, non per un calendario di famiglia. Noi siamo fornitori del sistema (lo mettiamo in servizio con il nostro nome, sopra un modello di Anthropic) e anche suoi utilizzatori. Gli obblighi sono:

| Obbligo                                                                                                                                                                                                                                                                                     | Fonte                                   | Dal                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------- |
| Dire in modo chiaro che si sta parlando con un'AI, al più tardi alla prima interazione, salvo che sia ovvio                                                                                                                                                                                 | art. 50, parr. 1 e 5, Reg. UE 2024/1689 | 02/08/2026                             |
| Contrassegnare in formato leggibile dalle macchine i contenuti generati (testo compreso). Per noi l'effetto pratico è piccolo (i testi restano nell'app e li conferma l'adulto), ma va verificato con le linee guida e il codice di buone pratiche della Commissione e con eventuali rinvii | art. 50, par. 2, Reg. UE 2024/1689      | 02/08/2026, salvo rinvii da verificare |
| Alfabetizzazione sull'AI di chi lavora sul sistema (per noi: Francesco e chi lo costruisce)                                                                                                                                                                                                 | art. 4 Reg. UE 2024/1689                | 02/02/2025                             |
| Minori di 14 anni: consenso del genitore                                                                                                                                                                                                                                                    | art. 4, comma 4, legge 132/2025         | in vigore                              |

Il fatto che l'assistente proponga e non decida conta: rende inapplicabile anche l'art. 22 GDPR sulle decisioni automatiche. **Da rifare la valutazione** se l'assistente comincia a valutare i figli (rendimento scolastico, comportamento) o a decidere qualcosa da solo.

**Fonti.** artt. 3, 4, 5, 6, 50 e 113, allegato III, Reg. UE 2024/1689 (AI Act); legge 23 settembre 2025, n. 132, art. 4; art. 22 GDPR.

**Tipo. Obbligatorio.** Verificare lo stato dei rinvii dell'art. 50 al momento dello sviluppo: **obbligatorio** (le date possono essere cambiate da atti UE successivi che non ho verificato).

**Criteri di accettazione.**

1. Il foglio dell'assistente dice «Stai usando un assistente basato sull'intelligenza artificiale. Può sbagliare: controlla prima di confermare.» alla prima apertura, e una riga breve resta sempre visibile.
2. Ogni proposta dell'assistente ha l'etichetta «Proposta dall'assistente» o «da verificare» finché l'adulto non conferma.

### A-L6. Il filtro sui dati sanitari nelle foto basta, o serve vietare del tutto certi tipi di avviso?

**Risposta. Il filtro da solo non basta.** L'istruzione all'agente Lettura agisce dopo che il modello ha già letto la foto: a quel punto il dato sanitario è già stato trattato (mandato al fornitore ed elaborato), anche se poi non lo riportiamo. Il filtro riduce il danno, ma non evita il trattamento. Serve anche agire **prima**:

1. **Vietare nelle condizioni d'uso e dire nell'avviso prima dello scatto** di fotografare:
   - documenti sanitari: certificati medici, referti, ricette, piani terapeutici, comunicazioni su allergie, intolleranze o diete, vaccinazioni;
   - documenti scolastici sulla disabilità o sui disturbi dell'apprendimento: PEI, PDP, certificazioni per il sostegno;
   - moduli che rivelano convinzioni religiose (per esempio la scelta sull'insegnamento della religione cattolica).
2. **Rifiuto della lettura:** se il modello riconosce uno di questi documenti, non estrae nulla e risponde con una frase fissa («Questo sembra un documento sanitario: non lo leggo. Puoi scrivere tu l'impegno.»).
3. **Avvisi generali** che parlano di salute senza riguardare una persona («controllate i pidocchi», «giornata della vaccinazione antinfluenzale»): si possono leggere, perché non riguardano la salute di un bambino identificato. Come propone lo stratega, l'agente propone solo data e ora, e il titolo lo scrive l'adulto.
4. **Nessuna conservazione** (già in A-L4).

Con queste misure il trattamento di un dato sanitario resta un evento raro e non voluto, contro le istruzioni date all'utente, con il minimo impatto possibile. Va descritto come rischio residuo nella DPIA.

**Fonti.** art. 9, par. 1, GDPR; art. 4, n. 15 GDPR; art. 25 GDPR; decisione D1; art. 2-septies Codice privacy.

**Tipo.** Non trattare dati sanitari senza una delle eccezioni dell'art. 9: **obbligatorio**. Il divieto nei termini, l'avviso e il rifiuto della lettura: **consigliati**, ma sono le misure che rendono difendibile l'impostazione.

**Verifica professionale.** Consigliata insieme alla DPIA: non ho trovato indicazioni del Garante o dell'EDPB sul caso preciso di dati sanitari caricati dall'utente contro le istruzioni in un'app che non li vuole trattare.

**Criteri di accettazione.**

1. L'avviso prima dello scatto elenca i documenti da non fotografare.
2. Su un set di prova di documenti sanitari e PEI di fantasia, l'assistente rifiuta la lettura con la frase fissa e non propone impegni con quei contenuti.
3. Per un avviso generale di salute, la proposta ha data e ora ma il titolo vuoto, da scrivere.

### A-L7. Se i figli avranno un account, possono usare l'assistente?

**Risposta. Consiglio di no**, per tutti i minori, almeno nella prima versione degli account dei figli. È coerente con `eta-figli.md`, sezione 2.3.

- **Sotto i 14 anni** la legge italiana richiede il consenso di chi ha la responsabilità genitoriale per l'accesso di un minore alle tecnologie di AI e per il trattamento dei suoi dati. Il testo non è chiarissimo e alcuni lo leggono in modo più restrittivo.
- **Dai 14 ai 17 anni** la legge permette al ragazzo di consentire da solo, con informazioni comprensibili. Ma aggiungere l'assistente agli account dei ragazzi vuol dire: istruzioni diverse per il modello, controlli sui contenuti adatti all'età, le regole che Anthropic chiede a chi serve minori con i suoi modelli (da verificare se e come valgono su Bedrock), una DPIA più ampia.
- Il valore per un ragazzo, in un organizer di famiglia, è basso rispetto a questo lavoro.

**Fonti.** art. 4, comma 4, legge 23 settembre 2025, n. 132; art. 8 GDPR e art. 2-quinquies Codice privacy; considerando 38 GDPR; Anthropic, indicazioni per gli sviluppatori sulla sicurezza dei minori (citate in `assistente-ai.md`, fonte [14]); `eta-figli.md`.

**Tipo.** Consenso del genitore sotto i 14 anni: **obbligatorio** se si offrisse l'assistente. Non offrirlo affatto ai minori: **consigliato**.

**Criterio di accettazione** (per quando arriveranno gli account dei figli): negli account dei figli l'assistente non compare e le sue rotte server rifiutano le richieste.

### A-L8. Contratto: bastano il DPA di AWS e le condizioni di Anthropic su Bedrock, o serve anche il DPA di Anthropic?

**Risposta.** Con Bedrock, **basta il DPA di AWS**, a una condizione da verificare sui contratti.

- Il contratto dell'art. 28 serve con chi tratta dati personali per nostro conto. Su Bedrock è **AWS**: riceve le richieste, le elabora nei suoi centri dati e risponde. Il DPA di AWS (il «GDPR Data Processing Addendum», che fa parte delle condizioni dei servizi AWS) è il contratto dell'art. 28 e copre anche i suoi sub-responsabili.
- **Anthropic** su Bedrock fornisce il modello, ma secondo la documentazione di AWS non accede alle richieste e alle risposte. Se è così, Anthropic non tratta dati personali per nostro conto e un suo DPA non serve. Si accettano comunque le condizioni di Anthropic per l'uso del modello su Bedrock (regole d'uso, divieti).
- **Da verificare prima di partire**, e da scrivere in `fornitori.md` con la data:
  1. che le condizioni di Anthropic accettate su Bedrock non diano ad Anthropic diritti sui contenuti (per esempio per addestramento o controlli);
  2. che la documentazione AWS confermi che i fornitori dei modelli non accedono ai dati, e che la conservazione «none» valga per Haiku 5.5 e Sonnet 5.5 (lo stratega lo segnala come dubbio);
  3. se i controlli anti abuso di Bedrock conservano qualcosa e dove;
  4. con quale società AWS si firma (per i clienti dello Spazio economico europeo di norma Amazon Web Services EMEA SARL, Lussemburgo).
- **Se invece si usa l'API diretta di Anthropic**, serve il DPA di Anthropic (fa parte delle condizioni commerciali), con le clausole tipo per il trasferimento negli Stati Uniti e una valutazione del trasferimento; il quadro è più pesante.

**Fonti.** art. 28, parr. 1, 3 e 4, GDPR; artt. 44–46 GDPR; fatti contrattuali da `assistente-ai.md`, sezione 5.1 (fonti [2], [8], [13], [15], [16] dello studio).

**Tipo.** Un contratto art. 28 con ogni responsabile: **obbligatorio**. Le quattro verifiche: **obbligatorie** nella sostanza, perché da esse dipende cosa possiamo scrivere nell'informativa.

**Verifica professionale.** Consigliata una lettura del DPA di AWS e delle condizioni di Anthropic su Bedrock prima del lancio dell'assistente: sono contratti lunghi, che cambiano, e la frase «Anthropic non riceve i dati» dipende da loro.

### A-L9. Il conteggio dell'energia per Nest e i limiti per adulto sono dati personali da indicare nell'informativa?

**Risposta. Sì.**

- L'energia è contata **per Nest**, e un Nest è un gruppo di persone identificate: un dato riferito a un Nest è un dato personale di chi ne fa parte. I limiti per adulto (10 richieste al minuto, 60 all'ora, tetto giornaliero) si contano per persona: sono dati personali di quell'adulto.
- **Basi giuridiche:** l'energia del piano è esecuzione del contratto (è una condizione del piano); i limiti anti abuso sono interesse legittimo alla sicurezza del servizio, che il GDPR riconosce espressamente.
- **Cosa scrivere nell'informativa:** la categoria «dati sull'uso dell'assistente» (quante richieste, quanta energia, quando), le due finalità, le basi, la durata, e che il testo delle domande non si usa per questo.
- **Durate proposte:** contatori per adulto 24 ore (bastano per i limiti al minuto, all'ora e al giorno); energia del Nest per il mese in corso e il precedente, per rispondere a contestazioni; dopo, solo statistiche aggregate senza riferimento al Nest.
- **Chi lo vede:** al lancio solo il totale del Nest, nessuna classifica di chi consuma di più (già nello studio). Se un giorno si mostrasse il consumo per persona agli altri adulti, va rifatta la valutazione.

**Un punto di diritto dei consumatori collegato.** L'energia di Plus è una caratteristica principale del servizio a pagamento: va descritta prima dell'acquisto in modo chiaro e concreto (la stima «circa 40 domande o 8 foto» aiuta). Ridurla durante un abbonamento in corso è una modifica del servizio digitale, ammessa solo alle condizioni del Codice del consumo (motivo indicato nel contratto, preavviso, diritto di recedere se la modifica peggiora il servizio). Per questo concordo con lo stratega: mai «gratis per sempre», e nei termini una clausola chiara sulle modifiche dei limiti. Da scrivere in `termini.md` quando arriva Plus.

**Fonti.** art. 4, n. 1, GDPR e Corte di giustizia UE, C-582/14 (Breyer, 19/10/2016) sull'identificabilità; art. 6, par. 1, lett. b ed f, e considerando 49 GDPR (sicurezza delle reti e dei servizi); art. 13, par. 1, lett. c, e par. 2, lett. a, GDPR; d.lgs. 206/2005, art. 49, comma 1, lett. a (informazioni precontrattuali), art. 33, comma 2, lett. m (clausole sulle modifiche unilaterali); direttiva (UE) 2019/770, art. 19 (modifica dei contenuti e servizi digitali), recepita nel Codice del consumo dal d.lgs. 173/2021.

**Tipo.** Indicarli nell'informativa: **obbligatorio**. Le durate proposte: **consigliate**. Informazioni precontrattuali su Plus: **obbligatorie**.

**Criteri di accettazione.**

1. I contatori per adulto si cancellano dopo 24 ore; l'energia del Nest dopo due mesi.
2. Nei contatori non c'è il testo delle domande né il contenuto delle risposte.
3. Nessuna schermata mostra il consumo di energia per persona.

---

## 3. Una domanda in più: la prova su 50 avvisi veri prima del lancio

Lo studio propone a Francesco (domanda 11) di provare Haiku 5.5 su 50 avvisi veri delle famiglie pioniere, con il loro consenso. Si può fare, ma è un trattamento a sé, diverso dall'assistente in produzione:

- **Base:** consenso delle famiglie pioniere per i propri dati (scritto, con spiegazione di cosa si fa, chi vede, quando si cancella). Per i nomi di altri bambini negli avvisi, il loro consenso non basta: vanno **coperti prima** di usare gli avvisi, da chi li raccoglie.
- **Chi li vede:** solo chi fa la prova; mai nel repository, che è pubblico, né nelle issue.
- **Dove passano:** lo stesso percorso di produzione (Bedrock UE, conservazione «none»), mai strumenti AI per consumatori.
- **Quanto restano:** si cancellano alla fine della prova, con una data scritta.
- **Avvisi sanitari:** esclusi dalla raccolta (A-L6).

**Fonti.** art. 6, par. 1, lett. a; art. 7; art. 5, par. 1, lett. b, c ed e, GDPR. **Tipo.** Base, informazioni e cancellazione: **obbligatorie**; il resto: **consigliato**.

---

## 4. Cosa deve decidere Francesco

1. **Conservazione degli impegni passati** (G-L1): restano finché li cancellate, oppure si cancellano dopo un periodo (per esempio 3 anni)?
2. **Durate di grazie, traguardi e contatori** (G-L3, A-L9): approvi 30 giorni per i grazie, traguardi finché c'è il Nest, 24 ore per i contatori per adulto e due mesi per l'energia del Nest?
3. **Assistente:** confermi la base «esecuzione del contratto» (A-L1) e l'interruttore per tutto il Nest?
4. **Documenti vietati nelle foto** (A-L6): approvi l'elenco (sanitari, PEI e PDP, moduli religiosi)?
5. **Assistente negli account dei figli** (A-L7): confermi «no» per tutti i minori?
6. **Benessere con dati sanitari** (G-L5): confermi di escluderlo (domande B3 e B4 dello studio)?

## 5. Cosa conviene far verificare a un professionista

- Il capitolo AI della DPIA, con la base giuridica dell'assistente (A-L1, A-L3) e la gestione dei dati sanitari caricati per sbaglio (A-L6).
- La lettura del DPA di AWS e delle condizioni di Anthropic su Bedrock (A-L8), prima di scrivere nell'informativa che Anthropic non riceve i dati.
- Qualsiasi progetto con dati di salute degli adulti (G-L5).

## 6. Documenti da aggiornare dopo le decisioni

- `informativa-privacy.md` (#147): sezione assistente (A-L2), uso della data di nascita per le idee (G-L2), grazie e traguardi (G-L3), vista «Chi si occupa di cosa» (G-L4), dati sull'uso dell'assistente (A-L9), durata degli impegni (G-L1).
- `dpia.md`: capitolo assistente (A-L3, A-L4, A-L6).
- `fornitori.md`: AWS Bedrock e la posizione di Anthropic (A-L8).
- `termini.md`: documenti da non fotografare (A-L6), modifiche dei limiti di Plus (A-L9).
- `registro-trattamenti.md`: assistente, prova sugli avvisi, gamification.
