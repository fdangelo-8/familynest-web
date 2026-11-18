# Parere: da che età un figlio può usare FamilyNest con un suo account

Bozza dell'agente legale-privacy, 18/11/2026, per la domanda 12 di Francesco (issue #444). Non è un parere di un avvocato: Francesco, come titolare del trattamento, decide e approva. I punti che conviene far verificare a un professionista sono segnati con **Verifica professionale**.

## 1. In breve

- Oggi i figli **non hanno un account** (vincolo nel database: `household_members_account_only_adult`, solo gli adulti hanno un `user_id`). Questo parere serve per la fase in cui arriveranno.
- Proposta in tre fasce:

| Fascia                       | Account proprio                                                       | Chi lo attiva                                        |
| ---------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------- |
| **Sotto i 10 anni**          | No. Il figlio resta un profilo gestito dai genitori, come oggi        | Nessuno                                              |
| **Da 10 a 13 anni**          | Sì, **account gestito**: poche funzioni, tutto deciso dal genitore    | Un genitore amministratore del Nest, dal suo account |
| **Da 14 a 17 anni** (Italia) | Sì, **account ragazzo**: più funzioni, alcune scelte le fa il ragazzo | Un genitore amministratore del Nest, dal suo account |
| **18 anni**                  | L'account diventa un account adulto, con avviso al ragazzo            | Automatico al compleanno, con conferma del ragazzo   |

- La regola che semplifica tutto: **l'account di un minore lo crea sempre un genitore dal proprio account**. Nessun figlio si registra da solo dallo store o dal sito. Così il consenso del genitore c'è sempre, in tutti i paesi, e la soglia dei 14 anni (o 13, 15, 16 negli altri paesi) decide solo quali scelte il ragazzo può fare da solo.
- I 10 anni sono una **scelta di prodotto**, non un obbligo di legge: la legge non fissa un'età minima per usare un'app con il consenso del genitore. Li propongo perché sotto quell'età un bambino legge poco e non gestisce un calendario da solo, e ogni account in più è un dato in più da proteggere. Francesco può spostarli (vedi domande).

## 2. Cosa dice la legge

### 2.1 Consenso digitale del minore

| Regola                                                                                                                                                          | Fonte                                                                   | Obbligo                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------- |
| Se il trattamento si basa sul **consenso** e il servizio digitale è offerto direttamente a un minore, il minore può consentire da solo solo sopra una certa età | art. 8, par. 1, GDPR                                                    | Obbligatorio           |
| In Italia l'età è **14 anni**; sotto, il consenso lo dà chi ha la responsabilità genitoriale                                                                    | art. 2-quinquies, comma 1, Codice privacy                               | Obbligatorio           |
| Le informazioni rivolte al minore vanno scritte in linguaggio «particolarmente chiaro e semplice», comprensibile dal minore                                     | art. 2-quinquies, comma 2, Codice privacy; art. 12, par. 1, GDPR        | Obbligatorio           |
| Il titolare fa «ogni ragionevole sforzo» per verificare che il consenso venga davvero dal genitore, con le tecnologie disponibili                               | art. 8, par. 2, GDPR                                                    | Obbligatorio           |
| La verifica è proporzionata al rischio: per un servizio a basso rischio basta un controllo semplice, per uno più rischioso serve di più                         | EDPB, Linee guida 05/2020 sul consenso, sez. 7.1                        | Indicazione dell'EDPB  |
| Le regole sull'età del consenso non toccano le norme nazionali sui contratti (capacità di un minore di concludere un contratto)                                 | art. 8, par. 3, GDPR                                                    | Obbligatorio           |
| I minori meritano una protezione specifica dei loro dati                                                                                                        | considerando 38 GDPR; art. 25 GDPR (protezione fin dalla progettazione) | Obbligatorio (art. 25) |
| Chi ha dato il consenso da minore può chiedere la cancellazione dei dati                                                                                        | art. 17, par. 1, lett. f, GDPR                                          | Obbligatorio           |

**Attenzione alla base giuridica.** L'art. 8 vale quando il trattamento si basa sul consenso (art. 6, par. 1, lett. a). Oggi i dati dei figli li tratta FamilyNest per dare al genitore il servizio che ha chiesto (esecuzione del contratto con il genitore, art. 6, par. 1, lett. b). Per l'account del figlio propongo di restare sulla stessa base: il genitore chiede un servizio in più per la sua famiglia. Il consenso resterebbe per le funzioni facoltative (per esempio l'assistente AI). Ma un minore non può concludere da solo un contratto valido in Italia (la capacità di agire si acquista a 18 anni, art. 2 del Codice civile): per questo è il genitore la parte del contratto, e il ragazzo è un utente del servizio del genitore. **Verifica professionale:** questa impostazione (contratto con il genitore, figlio come utente) va confermata da un avvocato privacy prima di sviluppare gli account dei figli, perché da essa dipendono informativa, termini e DPIA.

### 2.2 Le età negli altri paesi UE

L'art. 8 lascia a ogni Stato la scelta tra 13 e 16 anni. Le soglie più citate (fonti secondarie, da ricontrollare sulla legge nazionale prima di aprire ogni paese):

| Età | Paesi                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------- |
| 13  | Belgio, Danimarca, Estonia, Finlandia, Lettonia, Malta, Portogallo, Svezia                                                 |
| 14  | Austria, Bulgaria, Cipro, Italia, Lituania, Spagna                                                                         |
| 15  | Cechia, Francia, Grecia, Slovenia                                                                                          |
| 16  | Croazia, Germania, Irlanda, Lussemburgo, Paesi Bassi, Polonia, Romania, Slovacchia, Ungheria (soglia predefinita del GDPR) |

- **Spagna:** un progetto di legge sulla protezione dei minori negli ambienti digitali voleva portare la soglia da 14 a 16 anni. Secondo le notizie trovate il progetto sarebbe decaduto con lo scioglimento delle Cortes di ottobre 2026. Non l'ho verificato sul BOE: va ricontrollato prima di aprire in Spagna.
- **Quale legge si applica:** il GDPR non dice se conta il paese del ragazzo o quello del titolare. La lettura prudente è il paese in cui vive il ragazzo. Con la regola «l'account lo crea sempre il genitore» il problema si riduce: la soglia del paese decide solo quali scelte facoltative il ragazzo fa da solo.

### 2.3 Intelligenza artificiale (Italia)

La legge 23 settembre 2025, n. 132, art. 4, comma 4, prevede che l'accesso dei **minori di 14 anni** alle tecnologie di intelligenza artificiale, e il relativo trattamento dei dati, richieda il **consenso di chi esercita la responsabilità genitoriale**. Dai 14 anni il minore consente da solo, con informazioni comprensibili. Alcuni commentatori leggono la norma in modo più largo, quasi come un divieto sotto i 14 anni: il testo non è chiaro. Conseguenza per FamilyNest: l'assistente («Chiedi a …», domande 49 e 50) **resta spento negli account dei figli sotto i 14 anni**. Obbligatorio il consenso del genitore; consigliato non offrirlo proprio, perché il valore per un bambino è basso e il rischio di dati condivisi con un fornitore AI è alto.

Dal 2 agosto 2026 vale anche l'obbligo di dire chiaramente alle persone che stanno parlando con un sistema di AI (art. 50, par. 1, Regolamento UE 2024/1689, AI Act), salvo rinvii decisi dall'UE che vanno verificati quando l'assistente arriva.

### 2.4 DSA (Regolamento UE 2022/2065)

- L'art. 28 chiede misure di protezione dei minori alle **piattaforme online** accessibili ai minori. Le linee guida della Commissione del 14/07/2025 lo spiegano nel dettaglio (impostazioni private per i minori, niente meccanismi che spingono a usare l'app di più, verifica dell'età proporzionata).
- FamilyNest oggi **non è una piattaforma online** per la parte privata: i contenuti del Nest non sono diffusi al pubblico. Possono diventarlo due parti: le proposte degli utenti visibili a tutti (decisione di Francesco del 18/11, sezione 6.5 della mappa) e, in misura minore, la lista desideri pubblica.
- Le micro e piccole imprese sono escluse dagli obblighi della sezione 3 del DSA, compreso l'art. 28 (art. 19 DSA). FamilyNest oggi lo è. Restano comunque per tutti i servizi di hosting gli artt. 14 (termini chiari) e 16 (segnalazione di contenuti illeciti).
- Consiglio, non obbligo: applicare comunque le linee guida dell'art. 28 agli account dei figli, perché coincidono con quello che proponiamo qui. E **niente accesso dei figli alle proposte della community**.

### 2.5 Riferimenti non vincolanti

- **Age Appropriate Design Code del Regno Unito** (ICO, in vigore dal 2/09/2020, 15 standard, minori fino a 18 anni). Non si applica a noi finché non offriamo il servizio nel Regno Unito, ma è il riferimento più concreto su come si progetta per i ragazzi. I punti che usiamo: interesse del minore prima di tutto, impostazioni più private come predefinite, minimo di dati, niente geolocalizzazione, niente profilazione, niente spinte a restare nell'app, e se i genitori vedono quello che fa il ragazzo, **il ragazzo lo deve sapere**.
- **EDPB, Statement 1/2025 sull'age assurance** (11/02/2025): la verifica dell'età deve essere proporzionata, raccogliere il minimo e non diventare un nuovo rischio.

## 3. Regole degli store

| Regola                                                                                                                                                                                                             | Fonte                            | Cosa significa per noi                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| La categoria Kids è per app pensate per i bambini: niente link esterni né acquisti senza «parental gate», niente analytics o pubblicità di terzi                                                                   | Apple, App Review Guidelines 1.3 | FamilyNest **non va nella categoria Kids**: è un'app per la famiglia gestita dagli adulti                                |
| Fuori dalla categoria Kids non si possono usare nel nome, nelle immagini o nella descrizione parole come «per bambini» che fanno pensare che il pubblico principale siano i bambini                                | Apple, 2.3.8 e 5.1.4             | Nella scheda dello store: «per la famiglia», mai «per bambini»                                                           |
| App che raccolgono dati di minori: informativa obbligatoria e rispetto delle leggi sui minori; il «parental gate» non equivale al consenso del genitore                                                            | Apple, 5.1.4                     | Il consenso lo raccogliamo noi, dentro FamilyNest, dall'account del genitore                                             |
| Chi permette di creare un account deve permettere di cancellarlo dall'app                                                                                                                                          | Apple, 5.1.1(v)                  | Vale anche per gli account dei figli: li cancella il genitore, e il ragazzo può chiederlo                                |
| Classificazione per età con risposte sincere                                                                                                                                                                       | Apple, 2.3.6                     | Se arriva il «trillo» (messaggi tra utenti), il questionario cambia: rispondere in modo esatto                           |
| Se tra il pubblico dichiarato ci sono bambini, si applica la Families Policy: niente identificativo pubblicitario, niente posizione precisa, solo SDK approvati, divulgazione di tutti i dati raccolti dai bambini | Google Play, Families Policy     | Al lancio: pubblico **solo adulti**. Con gli account 10-13 anni diventiamo app per pubblico misto e la policy si applica |
| App per pubblico misto: schermata dell'età neutra (senza età già impostata) e nessun SDK non approvato per i bambini                                                                                               | Google Play, Families Policy     | Nel nostro caso l'età la inserisce il genitore nel profilo del figlio, non il bambino                                    |
| Le app che nella scheda promuovono il gioco dei bambini ma hanno contenuti per adulti sono vietate; le fasce d'età dichiarate devono essere vere                                                                   | Google Play, Families Policy     | Dichiarare le fasce d'età che corrispondono agli account che esistono davvero                                            |

Nota pratica: un bambino di 10-13 anni con un telefono ha di solito un account gestito dai genitori (Condivisione in famiglia di Apple, Family Link di Google), e i genitori approvano i download. È un controllo in più, ma è degli store: non sostituisce il nostro.

## 4. Cosa vede e cosa fa il figlio

Principio: il figlio vede **ciò che riguarda lui** e il minimo del resto della famiglia. Gli impegni «Solo io» degli adulti non arrivano mai al suo dispositivo, come già oggi per gli altri adulti (`event_visibility`: `private`, `busy`, `household`).

| Cosa                                                       | Sotto i 10 | 10-13 (account gestito)                                                 | 14-17 (account ragazzo)                               |
| ---------------------------------------------------------- | ---------- | ----------------------------------------------------------------------- | ----------------------------------------------------- |
| Impegni in cui è assegnatario, accompagnato o partecipante | —          | Vede                                                                    | Vede, può proporne o crearne di suoi                  |
| Impegni «Tutto il Nest» degli adulti che non lo riguardano | —          | Solo «Occupato» con l'orario (da decidere, domanda 2)                   | Vede (da decidere, domanda 2)                         |
| Impegni «Occupato» degli adulti                            | —          | Solo l'orario                                                           | Solo l'orario                                         |
| Impegni «Solo io» degli adulti                             | —          | **Mai**                                                                 | **Mai**                                               |
| Impegni «Solo io» suoi                                     | —          | No                                                                      | Da decidere (domanda 3)                               |
| Da fare in casa assegnati a lui                            | —          | Vede e spunta                                                           | Vede, spunta, aggiunge                                |
| Spesa                                                      | —          | Aggiunge e spunta                                                       | Aggiunge e spunta                                     |
| Il suo profilo (scuola, maestra, taglie)                   | —          | Vede, non modifica                                                      | Vede, modifica taglie                                 |
| Profili di fratelli e sorelle                              | —          | Solo nome e colore                                                      | Solo nome e colore                                    |
| Profili degli adulti                                       | —          | Solo nome e colore                                                      | Solo nome e colore                                    |
| La sua lista desideri                                      | —          | Vede le idee, **non vede chi ha preso cosa** (sorpresa e D2)            | Come 10-13; può aggiungere idee                       |
| Link pubblico della lista desideri                         | —          | No                                                                      | No (lo gestiscono i genitori, D2)                     |
| Invitare persone, gestire il Nest, ruoli                   | —          | No                                                                      | No                                                    |
| Calendari collegati (Google, Outlook)                      | —          | No                                                                      | Da decidere (domanda 4)                               |
| Assistente AI                                              | —          | **No** (L. 132/2025 e prudenza)                                         | Spento, attivabile con informativa chiara (domanda 5) |
| «Trillo» ad altri membri                                   | —          | Solo verso gli adulti del suo Nest                                      | Verso i membri del suo Nest                           |
| Proposte e voti della community                            | —          | No                                                                      | No                                                    |
| Acquisti, piano Plus                                       | —          | **Mai**                                                                 | **Mai** (contratto solo con adulti)                   |
| Esportazione «I tuoi dati»                                 | —          | La chiede il genitore                                                   | Può chiederla lui                                     |
| Notifiche                                                  | —          | Solo dei suoi impegni e da fare, senza dati di altri a schermo bloccato | Come 10-13                                            |

Cose da non fare mai negli account dei figli: geolocalizzazione, pubblicità, analytics di terzi, profilazione, foto del volto come avatar predefinito, contatori o premi che spingono a tornare nell'app (serie di giorni, badge), chat con persone fuori dal Nest.

**Trasparenza verso il ragazzo** (AADC standard 11, consiglio): una pagina «Chi vede cosa» scritta per lui, che dice cosa vedono i genitori del suo account.

## 5. Consenso e verifica del genitore

1. **Chi può creare l'account:** solo un adulto con account, amministratore del Nest, che dichiara di essere genitore o tutore del figlio. Un nonno o un coinquilino non può. La verifica è l'accesso già fatto dal genitore al suo account: per un servizio a basso rischio come un calendario di famiglia, con funzioni limitate, mi sembra uno «sforzo ragionevole» ai sensi dell'art. 8, par. 2, GDPR e delle Linee guida EDPB 05/2020. Non servono documenti d'identità o carte di credito (che sarebbero dati in più).
2. **Come entra il figlio:** con un codice o un QR generato dall'account del genitore, valido per poco tempo e una sola volta. **Niente mail e niente password del figlio** (minimizzazione, art. 5, par. 1, lett. c, GDPR). Per i 14-17 anni il ragazzo può aggiungere una sua mail per recuperare l'accesso.
3. **Cosa vede il genitore prima di confermare:** l'elenco di cosa vedrà e farà il figlio, l'informativa in versione per genitori, e un'opzione «Leggi con tuo figlio» con l'informativa per ragazzi.
4. **Revoca:** il genitore disattiva o cancella l'account del figlio in ogni momento; la cancellazione toglie anche le sessioni sui dispositivi del figlio.
5. **Due genitori:** in Italia la responsabilità genitoriale è di entrambi (art. 316 Codice civile) e le scelte di ordinaria amministrazione le può fare uno dei due. Creare un account di un'app di famiglia è probabilmente ordinaria amministrazione. Consiglio: avvisare l'altro genitore del Nest quando viene creato l'account. **Verifica professionale:** cosa fare se l'altro genitore si oppone (per esempio genitori separati) va chiarito con un avvocato prima del rilascio.
6. **Età:** la data di nascita del figlio la inserisce il genitore nel profilo (oggi `birth_date`, obbligatoria per i figli). È la fonte dell'età. Non chiediamo al bambino la sua età.
7. **Al compimento dei 14 anni** (o della soglia del paese): l'app avvisa il ragazzo, gli mostra l'informativa per ragazzi e gli fa confermare le scelte facoltative. **Ai 18 anni:** l'account diventa adulto solo se il ragazzo lo conferma; altrimenti si disattiva dopo un periodo da decidere.

## 6. Conservazione

- Account del figlio disattivato dal genitore: dati di accesso cancellati subito; il profilo del figlio resta perché fa parte del Nest.
- Account del figlio mai usato: cancellato dopo un periodo da decidere (proposta: 6 mesi di inattività, con avviso al genitore).
- Figlio rimosso dal Nest o Nest cancellato: tutto cancellato a cascata, come oggi.
- Mai «soft delete» senza scadenza (skill `privacy-e-dati-minori`).

## 7. Documenti da aggiornare quando arriveranno gli account dei figli

| Documento                 | Cosa cambia                                                                                                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `informativa-privacy.md`  | Sezione sugli account dei figli; **seconda informativa breve scritta per ragazzi** (art. 2-quinquies, comma 2, Codice privacy)                                                                              |
| `termini.md`              | Età minima per registrarsi da soli: 18 anni; account dei figli solo creati dal genitore; il genitore risponde dell'uso                                                                                      |
| `dpia.md`                 | Da aggiornare **prima** del rilascio: minori come interessati diretti è uno dei criteri delle linee guida WP248 (interessati vulnerabili); controllare l'elenco del Garante (provv. n. 467 dell'11/10/2018) |
| `registro-trattamenti.md` | Nuovo trattamento «account dei figli»                                                                                                                                                                       |
| Schede degli store        | Fasce d'età dichiarate, etichette privacy, questionario di classificazione                                                                                                                                  |

## 8. Criteri di accettazione da riportare nella futura specifica

1. Un account di un minore si crea solo dall'account di un adulto amministratore del Nest che ha dichiarato di essere genitore o tutore; ogni altro percorso (store, sito, link d'invito) rifiuta un minore.
2. Un figlio sotto i 10 anni (dalla `birth_date`) non può avere un account: il pulsante non compare e il database rifiuta la creazione.
3. L'accesso del figlio avviene con un codice monouso di breve durata generato dal genitore; nessuna mail o password è richiesta sotto i 14 anni.
4. Gli impegni «Solo io» degli adulti non arrivano mai nelle risposte di rete dell'account del figlio (test sulle risposte, non solo sul DOM).
5. L'account del figlio non vede chi ha prenotato i regali della sua lista desideri.
6. Negli account sotto i 14 anni l'assistente AI non è disponibile, né nell'interfaccia né lato server.
7. Gli account dei figli non possono acquistare, invitare, gestire il Nest, collegare calendari (fino a decisione), proporre o votare nella community.
8. Nessun SDK di analytics o pubblicità di terzi, nessuna posizione, nessun identificativo pubblicitario negli account dei figli.
9. Il genitore cancella l'account del figlio dall'app; la cancellazione chiude le sessioni attive del figlio.
10. Il ragazzo ha una pagina «Chi vede cosa» in linguaggio semplice.
11. Al compimento della soglia del consenso e dei 18 anni l'app mostra un avviso al ragazzo e chiede conferma delle scelte.

## 9. Domande per Francesco

1. **Età minima dell'account gestito:** 10 anni come proposto, oppure 8 o 12? (Più è bassa, più dati di bambini piccoli trattiamo.)
2. **Impegni «Tutto il Nest» degli adulti** che non riguardano il figlio: il figlio li vede come «Occupato» (solo l'orario) o per intero? Proposta: «Occupato» sotto i 14, per intero dai 14.
3. **Impegni privati del ragazzo** (14-17): può creare impegni «Solo io» che i genitori vedono solo come «Occupato»? È una scelta di equilibrio tra autonomia del ragazzo e controllo dei genitori.
4. **Calendari collegati** per i 14-17: sì o no?
5. **Assistente AI** per i 14-17: spento con possibilità di attivarlo da parte del ragazzo, oppure solo se il genitore lo permette?
6. **Paesi:** in quali paesi UE apriremo per primi? Serve per controllare le soglie nazionali prima del rilascio.
7. Confermi che **solo un genitore o tutore** (e non nonni, babysitter o coinquilini) può creare l'account di un figlio?

## Fonti

- Regolamento UE 2016/679 (GDPR), artt. 5, 6, 8, 12, 17, 25, 35; considerando 38 e 75.
- D.lgs. 196/2003 (Codice privacy), art. 2-quinquies.
- Legge 23 settembre 2025, n. 132, art. 4, comma 4 (GU n. 223 del 25/09/2025).
- Regolamento UE 2024/1689 (AI Act), art. 50.
- Regolamento UE 2022/2065 (DSA), artt. 14, 16, 19, 28; [Linee guida della Commissione sull'art. 28, 14/07/2025](https://digital-strategy.ec.europa.eu/en/library/commission-publishes-guidelines-protection-minors).
- EDPB, Linee guida 05/2020 sul consenso, sez. 7.1; [EDPB, Statement 1/2025 on Age Assurance](https://www.edpb.europa.eu/system/files/2025-04/edpb_statement_20250211ageassurance_v1-2_en.pdf).
- WP29, Linee guida WP248 sulla DPIA; Garante, provvedimento n. 467 dell'11/10/2018.
- Codice civile, artt. 2 e 316.
- [Apple, App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) 1.3, 2.3.6, 2.3.8, 5.1.1(v), 5.1.4 (lette il 18/11/2026).
- [Google Play, Families Policy](https://support.google.com/googleplay/android-developer/answer/9893335) (letta il 18/11/2026).
- ICO, Age appropriate design: a code of practice for online services (Regno Unito), solo come riferimento.
- Soglie nazionali dell'art. 8: fonti secondarie, per esempio [Privacy Design, Privacy Ages](https://privacydesign.ch/kb/ages/); progetto di legge spagnolo: [Osborne Clarke](https://www.osborneclarke.com/es/insights/espana-busca-proteger-los-menores-en-el-entorno-digital-claves-del-proyecto-de-ley). Da ricontrollare sulle leggi nazionali.
- Legge 132/2025, commenti: [Orizzonte Scuola](https://www.orizzontescuola.it/intelligenza-artificiale-il-consenso-dei-minore-e-valido-dai-14-anni-in-su-prima-spetta-ai-genitori/).
