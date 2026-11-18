18/11/2026

Documento vivo: si aggiorna quando Francesco decide le domande aperte e dopo il rilascio.

# Animali domestici nel Nest

Preparato dallo stratega per Francesco (issue #460). È il primo passo: dopo questo documento l'analista scrive il requisito e il designer prepara il brief per Fable. Riparte da `mappa-funzionalita.md`, `concorrenti.md`, `contesto-prodotto.md`, `strategia-crescita.md` e `business-case-mercato.md`, e dal codice dell'app (sola lettura).

**Come leggere i numeri.** Ogni numero ha la fonte accanto o nell'elenco in fondo. Le etichette sono: **dato** (pubblicato da chi lo misura), **stima di Ubersuggest** (volume calcolato dallo strumento, non misurato) e **stima mia** (un mio calcolo, con il metodo accanto: è un'ipotesi da verificare).

## Riassunto per Francesco

1. **La domanda c'è.** In Italia il 54,5% delle famiglie ha un animale, il 66,7% tra quelle con bambini piccoli; il 40,8% delle famiglie con bambini piccoli ha un cane (Assalco-Zoomark 2026). In Europa le case con animali sono il 49% (FEDIAF 2026).
2. **Nessun concorrente di famiglia lo fa bene.** Cozi e Hearth lasciano mettere l'animale tra i membri, ma senza funzioni dedicate. Mimko ha vaccini e veterinario, con i promemoria a pagamento. Le app per animali (Joppys, 11pets) sono diari per una persona sola e non dividono i compiti tra chi vive in casa.
3. **Il nostro spazio:** l'animale come membro del Nest, con le sue scadenze, i suoi compiti a turno, la sua spesa e il suo veterinario, visti da tutti gli adulti. Il problema quotidiano che risolve: «hai dato da mangiare al gatto?».
4. **Le ricerche su Google sono stagionali:** «antiparassitario cane» passa da 4.400 ricerche a novembre a 22.200 ad aprile, e «filaria cane» ha il picco in primavera (Ubersuggest). L'uscita va agganciata a febbraio-aprile.
5. **Cosa entra nella prima uscita:** profilo dell'animale, scadenze che si ripetono, cose di ogni giorno a turno con «Fatto» visibile a tutti, spesa dell'animale, veterinario nel profilo, animale negli impegni. Il pet sitter come aiutante e la lettura del libretto con l'AI vengono dopo.
6. **Piano:** tutto il nucleo nel base. In Plus solo la lettura del libretto con l'AI e gli allegati, insieme a #386 e #380. I promemoria dei vaccini gratis ci distinguono da Mimko, che li fa pagare.
7. **Fase:** uscita grande al mese 2 del calendario dei rilasci. Le altre uscite slittano di un mese.
8. **Privacy:** per il GDPR i dati sanitari sono quelli sulla salute di una persona fisica, quindi vaccini e visite di un animale non lo sono. Restano però dati personali degli adulti del Nest. Tre eccezioni da bloccare: cane guida o d'assistenza, allergie dei figli all'animale, numero di microchip. Il parere finale spetta all'agente legale-privacy.
9. **Da decidere subito:** 12 domande chiuse, con il mio consiglio, nella sezione 7.3.

---

## 1. Cosa c'è già nell'app

L'animale esiste già nel Nest, ma oggi è quasi solo un nome. Verificato nel codice e nel database il 18/11/2026.

| Dove                            | Cosa fa oggi con un animale                                                                                                                                                                                                        | Fonte                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Onboarding, «Chi c'è nel Nest?» | si aggiunge con nome, colore e data di nascita; non ha account                                                                                                                                                                     | `APP.md` `/onboarding/persone`; migrazione `enum_types` (`member_kind`: `adult`, `child`, `pet`) |
| Il tuo Nest                     | compare con colore ed età; la riga porta a `/membri/<id>`                                                                                                                                                                          | `src/app/(app)/nest/page.tsx`                                                                    |
| Pagina del membro               | nome, colore, data di nascita, «Togli dal Nest». Il mockup 29 dice: «Per un animale restano solo nome, colore e veterinario (decisione aperta)». Il veterinario non è stato costruito                                              | `src/components/membri/MemberView.tsx`; `docs/mockup/29-membro.html`                             |
| Profilo del figlio              | **non vale per gli animali**: il database vieta il profilo di scuola e taglie a un adulto o a un animale. `APP.md` dice il contrario: va corretto dal documentalista                                                               | migrazione `child_profiles_tables`; `APP.md` `/figli/<id>`                                       |
| Impegni                         | l'animale può essere tra le persone dell'impegno (`event_members`); non può accompagnare                                                                                                                                           | migrazione `events_tables`                                                                       |
| Da fare                         | l'animale può essere «per chi è»; non può essere «chi se ne occupa». **Niente ripetizioni e niente turni**                                                                                                                         | migrazione `todos_table`                                                                         |
| Scadenze                        | l'animale può essere «riguarda»; avvisi a 30, 7 e 1 giorno. **Niente ripetizioni**: il vaccino annuale va riscritto ogni anno                                                                                                      | migrazione `deadlines_table`; `APP.md` (database scadenze)                                       |
| Spesa                           | il mockup 15, stato vuoto, mostra «Crocchette per Biscotto» tra «Le più comuni» perché c'è un cane. Il codice ha sei voci fisse (latte, pane, uova, frutta, caffè, carta igienica): **la voce dell'animale non è stata costruita** | `docs/mockup/15-casa-spesa.html`; `src/components/casa-spesa/model.ts`                           |
| Esplora                         | lo spazio «Zampe» («Per i vostri animali e per chi ha quattro zampe.») compare solo se c'è un animale, con «Avvisami quando è pronto»                                                                                              | `src/lib/spaces.ts`; `APP.md` `/esplora`                                                         |
| Limite                          | gli animali contano nei 10 membri del Nest e prendono uno dei 10 colori                                                                                                                                                            | `APP.md` (database colori e limite dei membri)                                                   |

**Lettura.** Metà del lavoro di base c'è: l'animale è un membro con colore, entra negli impegni, nelle cose da fare e nelle scadenze. Mancano tre pezzi che servono anche al resto della casa: le scadenze che si ripetono, le cose da fare che si ripetono a turno, una pagina dell'animale con i suoi dati.

**Due cose da sistemare già adesso**, senza aspettare la funzione: la voce dell'animale in «Le più comuni» che il mockup approvato prevede, e la riga di `APP.md` che manda gli animali a `/figli/<id>`.

---

## 2. Mercato

### 2.1 Quante famiglie

| Dato                                                           | Valore                                                         | Fonte                                                    |
| -------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------- |
| Famiglie italiane con almeno un animale                        | 54,5%                                                          | Rapporto Assalco-Zoomark 2026, via Open (09/06/2026) [1] |
| Famiglie con bambini piccoli che hanno un animale              | 66,7%                                                          | stesso [1]                                               |
| Famiglie con figli adulti in casa che hanno un animale         | oltre il 60%                                                   | stesso [1]                                               |
| Famiglie con un cane                                           | 28,7% di tutte; 40,8% di quelle con bambini piccoli            | stesso [1]                                               |
| Famiglie con figli più grandi che hanno un gatto               | 33,7%                                                          | stesso [1]                                               |
| Cani e gatti in Italia (2025)                                  | 9,1 milioni di cani, 11 milioni di gatti                       | stesso [1]; LaPresse, 24/08/2026 [2]                     |
| Famiglie senza animali che pensano di prenderne uno in 12 mesi | circa 20%                                                      | stesso [1]                                               |
| Case europee con almeno un animale                             | 49%: 306 milioni di animali in 140 milioni di case (dati 2024) | FEDIAF, Facts & Figures 2026 [3], [4]                    |

**Stime mie, per dare l'ordine di grandezza:**

- famiglie italiane con un animale: 26,6 milioni di famiglie ISTAT (da `business-case-mercato.md` 1.1) × 54,5% = **circa 14,5 milioni**;
- case con figli a carico e un animale: 5,8 milioni (Eurostat, da `business-case-mercato.md`) × 66,7% = **circa 3,9 milioni**. È un'approssimazione: il 66,7% di Assalco è sulle famiglie con bambini piccoli, il dato Eurostat su tutti i figli sotto i 25 anni.

**Lettura.** Nel nostro pubblico principale, le famiglie con figli, l'animale è la regola: due su tre. Non è un segmento a parte, è una cosa in più per le case che vogliamo già prendere. Il profilo per paese in Europa è nel PDF FEDIAF [3]: non l'ho estratto, va letto prima di aprire Spagna o Francia.

### 2.2 Cosa fanno i concorrenti di famiglia per gli animali

| App                                               | Animale come membro                                                                                     | Promemoria (vaccini, antiparassitari)                                                                        | Compiti a turno (passeggiata, cibo)                                                                      | Spesa dell'animale             | Veterinario                                      | Fonte                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------ | --------------------------------------------- |
| **Cozi** (USA)                                    | sì, con un colore, come qualsiasi membro; filtro per vedere solo i suoi impegni                         | impegni ripetuti con promemoria; tre promemoria per impegno solo in Gold; compleanno e adozione solo in Gold | impegni ripetuti «a rotazione» e lista di cose da fare dell'animale                                      | una lista della spesa dedicata | come impegno                                     | blog Cozi, 03/05/2023 [5]                     |
| **Hearth** (USA)                                  | sì: «profili illimitati per i membri della famiglia, compresi gli animali» (lo dice solo il produttore) | non verificato                                                                                               | routine e incarichi (con serie e punti nell'abbonamento)                                                 | liste                          | non verificato                                   | hearthdisplay.com [6]                         |
| **Skylight** (USA)                                | profili per chiunque abbia impegni o incarichi; gli animali non sono citati nella guida ufficiale       | non verificato                                                                                               | incarichi per orario («dare da mangiare al cane alle 7») secondo un blog esterno, non la guida ufficiale | liste                          | —                                                | guida Skylight [7], blog esterno [8]          |
| **Mimko** (Italia)                                | sì, profili di figli e animali                                                                          | **promemoria dei vaccini solo in Mimko+** (4,99 €/mese o 39,99 €/anno)                                       | non risulta                                                                                              | liste condivise                | sì, nel profilo, con allergie e gruppo sanguigno | `concorrenti.md` 4.2 [9]                      |
| **FamilyWall** (Francia)                          | nessuna funzione per animali trovata                                                                    | —                                                                                                            | —                                                                                                        | liste                          | —                                                | ricerca web, 18/11/2026; `concorrenti.md` 3.1 |
| **TimeTree** (Giappone)                           | nessuna funzione per animali trovata                                                                    | —                                                                                                            | —                                                                                                        | —                              | —                                                | ricerca web, 18/11/2026                       |
| **Maple** (USA)                                   | non verificato; l'app chiude entro fine 2026                                                            | —                                                                                                            | —                                                                                                        | —                              | —                                                | `concorrenti.md` 2                            |
| **Famigliario, Nido, MyFamily, FamSync** (Italia) | nessuna funzione per animali nelle schede di `concorrenti.md`                                           | —                                                                                                            | —                                                                                                        | —                              | —                                                | `concorrenti.md` 4.2                          |

**Lettura.** Cozi è l'unico che spiega alle famiglie come usare l'app per l'animale, e lo fa con un articolo, non con una funzione: l'animale è un membro qualsiasi e tutto si fa a mano con impegni e liste. Mimko è l'unico con dati veterinari, ma li tratta come una cartella clinica e fa pagare i promemoria. Nessuno ha il gesto più semplice e più chiesto nelle app dedicate: segnare «fatto» e far vedere agli altri chi l'ha fatto e quando.

### 2.3 Le app dedicate agli animali

Le app più presenti nelle ricerche in Italia e in Europa, per tipo. Download e quote di mercato: **non disponibili** per quasi tutte. Le pagine pubbliche degli store mostrano solo voti e prezzi; per i download servono Sensor Tower o AppMagic, a pagamento, oppure la lettura a mano della scheda di Google Play da un telefono.

| App                                            | Da dove                    | Cosa fa                                                                                                                                                              | Prezzo                                                                                                          | Voti                                                                  | Più persone della casa?           | Fonte      |
| ---------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------- | ---------- |
| **Joppys**                                     | Italia (Capannori, Lucca)  | visite, vaccini, peso, documenti sanitari, calendario, promemoria per cure e farmaci, diario, ricerca di veterinari e toelettatori, volantino per l'animale smarrito | gratis; 1,49 € per ogni animale in più; donazioni da 1,99 a 9,99 €                                              | 4,5 su 18 voti (App Store Italia)                                     | non dichiarato                    | [10]       |
| **11pets**                                     | Cipro                      | promemoria di farmaci e appuntamenti, vaccini e documenti, peso; versione per veterinari e pet sitter                                                                | gratis con acquisti da 1,99 € e 19,99 € (la scheda non dice cosa sblocca ciascuno)                              | 2,8 su 49 voti (App Store Italia); 2,1 su 295 su Android (sito terzo) | non dichiarato                    | [11], [12] |
| **MyLav for Pets**                             | Italia (laboratorio MyLav) | scheda dell'animale, referti del laboratorio nell'app, diario di salute da mandare al veterinario, consulto a pagamento                                              | gratis, senza pubblicità né abbonamento (recensione di settore)                                                 | non letti                                                             | non dichiarato                    | [13], [14] |
| **MyVet, Zampavet, Pelo, PetDiary, Friendly**  | vari                       | libretto elettronico e promemoria di vaccini e visite; Zampavet anche prenotazione dal veterinario                                                                   | non verificato                                                                                                  | non letti                                                             | non verificato                    | [15]       |
| **Fed?, I Fed the Pet, Petly, Pet Feeder App** | vari (inglese)             | registro condiviso di chi ha dato da mangiare e quando; Petly «per coppie, famiglie, coinquilini» anche passeggiate e farmaci                                        | Fed? gratis con 2 animali, 1 membro della famiglia, 7 giorni di storico; altri non verificati                   | quasi nessun voto (Meal Time For Pets: 4,4 su 43)                     | **sì, è lo scopo**                | [16]       |
| **Tractive**                                   | Austria                    | GPS al collare, storico dei percorsi                                                                                                                                 | dispositivo più abbonamento; sul sito italiano prezzi in dollari, da 5 a 9 $ al mese secondo la durata          | non letti                                                             | sì (condivisione del dispositivo) | [17]       |
| **Rover, Pawshake**                            | USA, Paesi Bassi           | trovare e pagare pet sitter e dog sitter                                                                                                                             | gratis per chi cerca; Rover: 35 € di revisione del profilo e 20% di commissione al sitter (articolo senza data) | non letti                                                             | —                                 | [18], [19] |

**Cosa amano gli utenti, dalle recensioni visibili sull'App Store italiano** (poche: sono indizi, non un campione):

- avere tutto dell'animale in un posto solo: «Indispensabile per chi come me ha più animali» (Joppys);
- più animali nella stessa app: «è possibile inserire più animali domestici! Perfetta» (11pets);
- app tenuta aggiornata e semplice: «semplice da usare» (Joppys).

**Cosa manca o fa arrabbiare:**

- registrazione imposta dopo un aggiornamento: «ora mi chiede di registrarmi per poter continuare ad utilizzarla» (11pets). È la stessa paura di perdere i dati che troviamo nelle recensioni delle app di famiglia (`recensioni-concorrenti.md`);
- notifiche che non arrivano (Joppys, risolto dall'assistenza);
- **nessuna delle app italiane lette dichiara la condivisione tra più persone della casa.** Le uniche che la mettono al centro sono le piccole app di registro del cibo, in inglese e con pochissimi voti.

**Lettura.** Il mercato delle app per animali è affollato e frammentato. In Italia nessuna app ha molti voti, e le ricerche del nome sono minime («11pets»: 20 al mese, Ubersuggest). Le app dedicate puntano sulla salute dell'animale; nessuna sulla casa che se ne occupa insieme. Non dobbiamo competere con Joppys sulla cartella clinica: dobbiamo far sì che chi ha già FamilyNest non abbia bisogno di un'altra app per l'animale.

---

## 3. Domanda in Italia (Ubersuggest)

Google, località Italia, lingua italiana. Ubersuggest, strumenti «keyword overview», «keyword suggestions» e «serp analysis», consultato il 18/11/2026, 19 richieste su un limite giornaliero di 100 (sola lettura, nessun progetto creato). Volumi medi mensili; l'andamento copre i 12-13 mesi più recenti disponibili per ciascuna parola (di solito da settembre 2025 a settembre 2026). Sono **stime di Ubersuggest**.

| Parola chiave                  | Ricerche al mese | Andamento                                                                                                     | Difficoltà SEO (0-100) | Intento      |
| ------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------ |
| antiparassitario cane          | 9.900            | 4.400 a novembre 2025, 18.100 a marzo e **22.200 ad aprile 2026**, 6.600 ad agosto                            | 14                     | acquisto     |
| antiparassitario gatto         | 8.100            | 4.400 a dicembre 2025, **12.100 da marzo a maggio 2026**                                                      | 18                     | acquisto     |
| filaria cane                   | 3.600            | 1.300 a dicembre 2025, **6.600 ad aprile 2026**, 5.400 a settembre 2025                                       | 11                     | informazione |
| vaccini gatto                  | 2.400            | da 1.600 (febbraio-aprile 2026) a 3.600 (giugno 2025)                                                         | 13                     | informazione |
| vaccini cane                   | 1.900            | stabile, da 1.300 a 2.900 (maggio 2026)                                                                       | 11                     | informazione |
| libretto sanitario cane        | 390              | —                                                                                                             | 12                     | informazione |
| libretto sanitario cane online | 140              | —                                                                                                             | 12                     | —            |
| richiamo vaccino cane          | 90               | stabile                                                                                                       | 14                     | informazione |
| app per cani                   | 110              | —                                                                                                             | 27                     | —            |
| app per gatti                  | 110              | stabile, da 70 a 140                                                                                          | 35                     | acquisto     |
| app per cani gratis            | 50               | —                                                                                                             | 10                     | —            |
| libretto sanitario cane app    | 10               | —                                                                                                             | 11                     | —            |
| promemoria vaccino cane        | nessun dato      | —                                                                                                             | —                      | —            |
| antiparassitario gatto quando  | 0                | —                                                                                                             | —                      | —            |
| crocchette cane                | 8.100            | stabile, da 6.600 (estate) a 9.900                                                                            | 51                     | —            |
| sabbia gatto                   | 2.400            | stabile, da 1.900 a 2.900                                                                                     | 14                     | informazione |
| anagrafe canina                | 6.600            | stabile                                                                                                       | 35                     | informazione |
| pensione per cani              | 9.900            | **14.800 a luglio 2026**, 12.100 a giugno e agosto                                                            | 12                     | informazione |
| dog sitter                     | 12.100           | 5.400-6.600 quasi tutto l'anno; 74.000 ad aprile 2026 (salto isolato, lo considero un errore dello strumento) | 16                     | commerciale  |
| pet sitter                     | 5.400            | 1.900-4.400 quasi tutto l'anno; 9.900-14.800 da gennaio a marzo 2026 (picco non spiegato)                     | 17                     | commerciale  |
| 11pets (nome di un'app)        | 20               | stabile                                                                                                       | 32                     | —            |

**Chi esce su Google per «app per cani»** (Ubersuggest, raccolta del 06/10/2026): in cima una risposta dell'AI di Google, poi un articolo di Wired del 2019, una pagina di GoodBarber per prenotare passeggiate, Kodami, Reddit, il profilo Instagram di Helpet, schede degli store. Nessuna app di famiglia e nessuna guida pratica italiana forte.

**Lettura.**

- **Nessuno cerca «un'app per l'animale»** (110 ricerche al mese). Si cercano le cose da fare: l'antiparassitario, il vaccino, la filaria, la pensione d'estate. È la stessa regola già vista per i compleanni in `mappa-funzionalita.md` 5.3: la funzione si promuove con il problema, non con il nome della funzione.
- **Stagionalità chiara:** gli antiparassitari e la filaria esplodono tra marzo e maggio (da 4 a 5 volte i mesi d'inverno); la pensione e il dog sitter salgono d'estate; vaccini, crocchette e sabbia sono tutto l'anno.
- **Difficoltà bassa** (11-18) sulle parole informative: guide come «quando fare l'antiparassitario al cane» o «calendario dei vaccini del gatto» possono posizionarsi in fretta. Però i contenuti sulla salute dell'animale vanno rivisti da un veterinario: un consiglio sbagliato su farmaci e dosi fa danni veri e toglie fiducia.
- Le parole d'acquisto («antiparassitario cane», «crocchette cane») hanno difficoltà pubblicitaria 100: lì comprano i negozi online di prodotti per animali. Non sono parole per noi.

---

## 4. Cosa serve a una famiglia

### 4.1 I lavori da fare

Dalle funzioni dei concorrenti, dalle app dedicate e dalle ricerche (sono ipotesi da verificare con le chiacchierate di `traccia-interviste.md`, che chiede già «animali: sì/no»):

1. **Non dimenticare le cose periodiche:** antiparassitario ogni mese o ogni tre, vaccino ogni anno, visita di controllo, filaria in stagione.
2. **Sapere chi fa cosa oggi**, ed evitare il cibo dato due volte o la passeggiata saltata: «l'hai già portato fuori?».
3. **Non restare senza crocchette o sabbia.**
4. **Avere sotto mano il veterinario**, anche per chi non lo chiama mai.
5. **Lasciare l'animale a qualcuno** (nonni, vicini, pet sitter) con le istruzioni giuste.
6. **Mettere in calendario** visite, toelettatura, pensione d'estate.

I lavori 1, 2 e 5 sono quelli dove le app dedicate falliscono, perché sono pensate per una persona sola. È qui che una casa condivisa vale di più.

### 4.2 Come si incastra nell'app che c'è

| Pezzo                                                                                           | Dove vive                                                                                                        | Cosa serve di nuovo                                                                                                                                                                                     | Quando                                                                                                              |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Profilo dell'animale**: nome, specie, foto facoltativa, colore, data di nascita o di adozione | nuova pagina dell'animale, aperta da «Il tuo Nest» al posto della pagina del membro                              | specie (cane, gatto, altro); foto; «cosa mangia»; veterinario; nota breve                                                                                                                               | **subito**                                                                                                          |
| **Scadenze che si ripetono**: vaccino, antiparassitario, visita annuale                         | **Scadenze**, con «Riguarda: Biscotto» (c'è già)                                                                 | la ripetizione (ogni mese, ogni 3 mesi, ogni anno, ogni N giorni); quando si segna fatta, nasce la prossima a partire dal giorno in cui è stata fatta. Serve anche alla casa: bollo, revisione, caldaia | **subito**                                                                                                          |
| **Cose di ogni giorno a turno**: passeggiata, cibo, lettiera                                    | **Da fare**, con «Per chi è: Biscotto» (c'è già)                                                                 | ripetizione giornaliera o per giorni della settimana, con un orario facoltativo; turno tra le persone scelte (adulti e figli); «Fatto da Laura alle 19:10» visibile a tutti                             | **subito**, con lo stesso motore dei turni di #388                                                                  |
| **Spesa dell'animale**: crocchette, sabbia                                                      | **Spesa** (c'è già)                                                                                              | la voce dell'animale in «Le più comuni», già nel mockup 15; «Metti in spesa» dal profilo, con la marca scritta in «cosa mangia»                                                                         | **subito** (la voce in «Le più comuni» anche prima, come correzione)                                                |
| **Veterinario**                                                                                 | nel profilo dell'animale; poi in **Contatti utili** (#385) con la categoria «Veterinario», collegato all'animale | nome, studio, telefono, chiamata con un tocco                                                                                                                                                           | **subito** nel profilo; in Contatti quando esce #385 (mese 2,5)                                                     |
| **Impegni**: visita dal veterinario, toelettatura, pensione                                     | **Calendario** (c'è già: l'animale può essere tra le persone)                                                    | punto del colore dell'animale nel Mese; dal profilo «Prossimi impegni di Biscotto»                                                                                                                      | **subito** (quasi tutto c'è)                                                                                        |
| **Pet sitter**                                                                                  | prima **Contatti utili** con la categoria «Pet sitter»; poi **aiutante** (#392)                                  | da contatto: niente di nuovo. Da aiutante: vede solo i compiti dell'animale nei giorni scelti e il numero del veterinario                                                                               | contatto con #385; aiutante con #392 (mese 9)                                                                       |
| **Istruzioni per chi lo tiene**                                                                 | profilo dell'animale                                                                                             | «Copia le istruzioni»: un testo con cibo, orari, veterinario, da incollare su WhatsApp. Lo manda l'adulto, che vede cosa contiene (come M4 della mappa)                                                 | **più avanti**, piccola novità dopo la prima uscita                                                                 |
| **Lettura del libretto o della ricevuta con l'AI**                                              | Agente AI (#386)                                                                                                 | foto del libretto → scadenze proposte, «da verificare», conferma                                                                                                                                        | **più avanti**, Plus, dopo il mese 3                                                                                |
| **Libretto e documenti allegati**                                                               | Documenti (#380)                                                                                                 | argomento «Animali»                                                                                                                                                                                     | **più avanti**, con #380                                                                                            |
| **Scorte che finiscono** («le crocchette finiscono tra 5 giorni»)                               | Spesa                                                                                                            | quantità del sacco e consumo giornaliero                                                                                                                                                                | **più avanti**: pochi lo terrebbero aggiornato (vedi la Dispensa, C9 della mappa)                                   |
| **Compleanno o giorno dell'adozione**                                                           | Compleanni (#387)                                                                                                | l'animale tra le ricorrenze                                                                                                                                                                             | **con #387**                                                                                                        |
| **Valigia dell'animale e passaporto per l'estero**                                              | Liste multiple (#378)                                                                                            | una lista pronta «In viaggio con Biscotto»                                                                                                                                                              | **con #378**                                                                                                        |
| **Peso, diario della salute, farmaci, referti**                                                 | —                                                                                                                | —                                                                                                                                                                                                       | **non lo consiglio**: è il terreno di Joppys e MyLav, apre la porta a dati delicati e non serve alla casa condivisa |
| **GPS e posizione dell'animale**                                                                | —                                                                                                                | —                                                                                                                                                                                                       | **no**: serve un dispositivo (Tractive) e la posizione dell'animale dice dove sono le persone che lo portano fuori  |

### 4.3 Due scelte di prodotto

**Scadenze e cose di ogni giorno restano in Scadenze e in Da fare, non in una sezione «Animali» a parte.** Così l'animale compare in Oggi, nelle notifiche, nella ricerca e nei filtri per persona senza nuove pagine. Il profilo dell'animale le raccoglie e permette di crearle già collegate a lui. È lo stesso schema del profilo del figlio: i contatori in cima leggono impegni e scadenze che stanno altrove.

**Il turno è lo stesso di #388.** Turni «chi porta chi» (mese 1) e «chi porta fuori il cane» sono lo stesso problema: chi tocca oggi. Conviene che l'analista scriva un solo motore di turni, usato prima per gli impegni dei figli e poi per le cose di ogni giorno. Per questo la funzione Animali viene dopo i Turni.

**Niente consigli veterinari dall'app.** Le scadenze pronte («Antiparassitario», «Vaccino annuale», «Visita di controllo») hanno una ripetizione proposta, ma il testo dice che l'intervallo lo decide il veterinario. L'app non suggerisce farmaci né dosi.

---

## 5. Piano, fase e leva di marketing

### 5.1 Base o Plus

**Fatti sui prezzi.** Mimko fa pagare i promemoria dei vaccini (Mimko+ a 4,99 €/mese o 39,99 €/anno [9]). Cozi mette in Gold i tre promemoria per impegno e i compleanni, anche quelli degli animali [5]. Hearth include i profili nell'abbonamento da 9 $ al mese [6]. Joppys è gratis e fa pagare 1,49 € ogni animale in più [10]. 11pets ha acquisti da 1,99 € e 19,99 € [11].

| Pezzo                                                                                | Piano consigliato                                                           | Perché                                                                                                                              |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Profilo, scadenze ripetute, cose di ogni giorno a turno, spesa, veterinario, impegni | **base**                                                                    | è la comodità di avere tutto insieme, la promessa del gratuito; i promemoria dei vaccini gratis sono una differenza chiara da Mimko |
| Numero di animali                                                                    | **base, nessun limite oltre i 10 membri del Nest**                          | far pagare ogni animale (come Joppys) punisce proprio le famiglie che usano di più la funzione                                      |
| Istruzioni per chi lo tiene, pet sitter tra i contatti                               | **base**                                                                    | portano FamilyNest fuori dalla casa (strategia-crescita 5.5)                                                                        |
| Pet sitter come aiutante                                                             | **segue la scelta di #392** (1 aiutante gratis, di più in Plus)             | stessa regola per tutti gli aiutanti                                                                                                |
| Lettura del libretto con l'AI                                                        | **Plus**, con l'Agente AI (#386)                                            | è uno strumento che fa risparmiare tempo; ha un costo per ogni uso                                                                  |
| Libretto allegato                                                                    | **base entro i 100 MB, Plus oltre**, con Documenti (#380)                   | stessa regola dei documenti                                                                                                         |
| Avvisi delle scadenze a più persone, più avvisi                                      | **Plus** solo se Francesco conferma le «scadenze avanzate» (C7 della mappa) | da non decidere qui: vale per tutte le scadenze                                                                                     |

**Lettura.** La funzione Animali non è un motivo per pagare: è un motivo per scegliere FamilyNest e restarci, perché tocca la casa ogni giorno, due volte al giorno per chi ha un cane. Vale la regola delle recensioni: un gratuito che si blocca sulle cose di base è la lamentela più forte contro Cozi (`business-case-mercato.md` 2.3).

### 5.2 Fase nel calendario dei rilasci

**Proposta: uscita grande al mese 2** della tabella 5.2 di `mappa-funzionalita.md`, subito dopo i Turni «chi porta chi».

Perché:

- **dipende dai Turni** (mese 1), che portano il motore dei turni; e porta con sé le scadenze che si ripetono, utili a tutta la casa;
- **Francesco la considera fondamentale**, e due famiglie con figli su tre hanno un animale: conviene darla presto;
- **non dipende da Plus**: esce prima del mese 3;
- il veterinario sta nel profilo, quindi non deve aspettare Contatti utili (mese 2,5). Quando Contatti esce, il veterinario compare anche lì.

**Effetto sul resto:** Liste multiple passa dal mese 2 al mese 4, Compleanni dal 4 al 5 e così via; ogni uscita grande dopo il mese 2 slitta di un mese e Conti chiari esce dai primi 12 mesi. In alternativa, Liste multiple diventa un'uscita piccola a metà mese, ma perderebbe la campagna dell'estate.

**Stagione (regola come in `mappa-funzionalita.md` 5.3).** Il momento migliore è da febbraio ad aprile, quando partono antiparassitari e filaria. Se il mese 1 cade tra febbraio e aprile, conviene scambiare Animali e Turni: gli Animali al mese 1, con il motore dei turni scritto per primo su di loro. Se il lancio cade a fine primavera o d'estate, l'uscita resta al mese 2 e la pensione d'estate diventa il tema della campagna. Con il lancio ipotetico di marzo 2027 (data non decisa), il mese 2 cade a maggio, ancora dentro il picco (14.800 ricerche per «antiparassitario cane» a maggio 2026).

**Prima dell'uscita, come correzione:** la voce dell'animale in «Le più comuni» del mockup 15.

**Dopo l'uscita:** a metà mese successivo le istruzioni per chi lo tiene (piccola novità); il veterinario in Contatti con #385; la lettura del libretto con l'Agente; il pet sitter come aiutante con #392.

### 5.3 Leva di marketing

Qui solo angoli e canali. I testi li scrivono gli agenti dei canali, con la skill `testi-naturali`.

**Fatti.**

- Due famiglie con bambini piccoli su tre hanno un animale [1]: chi parla agli animali parla al nostro pubblico principale.
- Le ricerche sono di problemi pratici e stagionali, con difficoltà SEO bassa (sezione 3).
- Nessuna app di famiglia fa contenuti sugli animali in italiano (`concorrenti.md` 7.1 non ne trova); Cozi ci ha scritto un articolo [5].
- Che i contenuti con animali rendano più degli altri sui social italiani **non ho un dato verificato**: si misura con il test di 30 giorni già previsto in `strategia-crescita.md` 4.5, mettendo a confronto i video con l'animale e quelli senza.

**Angoli, in ordine di forza (mia lettura).**

1. **La scena di casa**: due persone che danno da mangiare al gatto nella stessa sera, il cane che chiede di uscire e nessuno sa se è già uscito. È il problema che le app dedicate non risolvono e che un video di 15 secondi mostra senza spiegare. Instagram e TikTok.
2. **Il promemoria che arriva al momento giusto**: l'antiparassitario di marzo, la filaria di aprile. Si aggancia alla stagione delle ricerche. Instagram, Facebook (i nonni che tengono il cane sono lì) e SEO.
3. **Chi lo tiene quando partite**: la pensione e il pet sitter d'estate (picco di luglio). Facebook e SEO.
4. **L'animale come membro del Nest**, con il suo colore: è un'immagine affettuosa che spiega in un colpo il Nest «per chi vive insieme». Va bene nelle schermate degli store e nella pagina del sito.

**Canali.**

| Canale                  | Cosa fare                                                                                                                                                                                 | Costo                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Google (SEO)            | guide su antiparassitari, filaria e vaccini di cane e gatto, con il calendario da segnare; una pagina della funzione. **Ogni guida rivista da un veterinario**, con il suo nome in pagina | lavoro dei contenuti, più la revisione del veterinario (costo non disponibile: si chiede un preventivo) |
| Instagram, TikTok       | la scena di casa; l'animale del Nest con il suo colore                                                                                                                                    | come in `strategia-crescita.md` 4.5                                                                     |
| Facebook                | i promemoria di stagione; chi tiene l'animale d'estate                                                                                                                                    | idem                                                                                                    |
| Pinterest               | un calendario dei promemoria da stampare, che rimanda alla funzione                                                                                                                       | un modello                                                                                              |
| Studi veterinari        | un cartello in sala d'attesa con il QR verso la pagina della funzione, offerto agli studi. È rivolto ad adulti in un luogo di adulti                                                      | stampa; da provare in 5-10 studi prima di allargare (stima mia)                                         |
| Negozi per animali      | collaborazioni più avanti, dopo i primi 1.000 Nest attivi a due, come le partnership di `strategia-crescita.md` 4.9                                                                       | da trattare                                                                                             |
| Creator                 | creator di animali e di famiglia; tariffe italiane **non disponibili** (strategia-crescita 4.7)                                                                                           | da preventivo                                                                                           |
| Leva dentro il prodotto | le istruzioni per chi tiene l'animale e il pet sitter come aiutante portano il nome FamilyNest a nonni, vicini e pet sitter                                                               | zero                                                                                                    |

**Regole per i contenuti con gli animali.**

- Niente volti di bambini nelle foto e nei video degli utenti che ripubblichiamo; se ci sono, non si usano. Nessun pubblico pubblicitario sotto i 18 anni e nessun interesse legato ai bambini.
- Un concorso «la foto del vostro animale» con premi in Italia è regolato dal DPR 430/2001 sui concorsi a premi: va verificato prima di proporlo. Senza premi resta una semplice raccolta di contenuti, con il consenso di chi li manda.
- Niente classifiche di animali o di chi se ne occupa di più, niente «serie» di passeggiate.

---

## 6. Privacy

### 6.1 I dati veterinari non sono dati sanitari delle persone

**Cosa dice la legge.** Il GDPR (Regolamento UE 2016/679) [20]:

- articolo 4, punto 1: un dato personale è un'informazione su una **persona fisica** identificata o identificabile;
- articolo 4, punto 15: i dati relativi alla salute sono quelli sulla salute fisica o mentale **di una persona fisica**;
- articolo 9: le categorie particolari, tra cui la salute, hanno regole più strette.

Una guida italiana di settore lo dice in chiaro: il GDPR e il Codice privacy, trattando di dati personali, non si applicano agli animali in quanto tali; la tutela riguarda le persone collegate all'animale [21].

**Cosa vuol dire per noi (mia lettura, da confermare con l'agente legale-privacy prima del requisito).**

1. **Vaccini, antiparassitari e visite dell'animale non sono dati sanitari** ai sensi dell'articolo 9. La decisione D1 («niente dati sanitari dei figli») non si applica all'animale: «Vaccino di Biscotto» è una scadenza ammessa.
2. **Sono però dati personali comuni** degli adulti del Nest, perché stanno nel loro account e dicono qualcosa della loro casa. Valgono tutte le regole della skill `privacy-e-dati-minori`: minimizzazione, isolamento per Nest, niente nei log e negli eventi di misura, cancellazione vera con l'account e con il Nest.
3. Va aggiornata la regola degli esempi di D1 («negli esempi e nei test non si usano scadenze sanitarie»): per gli animali le scadenze veterinarie sono ammesse negli esempi, per le persone no.

### 6.2 Tre eccezioni da bloccare

| Rischio                                                                     | Perché                                                                                                                                                                                                                                    | Cosa propongo                                                                                                                                                                |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cane guida, cane d'assistenza, pet therapy**                              | dice che una persona della casa ha una disabilità o una malattia: è un dato sanitario di una persona (articolo 9), e può essere di un figlio                                                                                              | nessun campo o tipo per questo; nelle specie solo cane, gatto, altro                                                                                                         |
| **Allergie dei figli all'animale**, e note come «Sofia è allergica al pelo» | è un dato sanitario di un minore: vietato da D1 e dalla skill privacy                                                                                                                                                                     | nota breve (fino a 200 caratteri) con l'avviso «niente dati di salute delle persone»; nessun campo «allergie» nel profilo dell'animale. Gli esempi e i test non lo usano mai |
| **Numero di microchip**                                                     | nell'anagrafe canina il microchip è collegato al nome e ai dati del proprietario [21], [22]: è un identificativo della persona. Il nuovo regolamento UE rende il microchip e la registrazione obbligatori per tutti i cani e i gatti [23] | **non raccoglierlo nella prima uscita**: non serve a nessuna funzione della casa. Se in futuro serve (animale smarrito), facoltativo e visibile solo agli adulti             |

### 6.3 Altre regole

- **Nessun dato dei figli nel profilo dell'animale.** Il profilo ha solo dati dell'animale: nome, specie, data, colore, foto, cosa mangia, veterinario, nota. I figli possono essere tra le persone dei turni (come oggi in Da fare), ma il profilo non mostra nulla di loro oltre al nome e al colore dove serve il turno.
- **Foto facoltativa, solo dell'animale.** Il foglio di caricamento dice di scegliere una foto dell'animale da solo, senza persone. Nessuna foto per impostazione: c'è l'avatar con il colore. La foto resta nel Nest, come quelle della lista desideri.
- **Veterinario e pet sitter sono dati di terzi:** solo nome, studio, telefono e una nota breve, come i Contatti utili (#385). Niente indirizzo di casa del pet sitter.
- **Notifiche calme.** Le scadenze avvisano come oggi (30, 7 e 1 giorno e il giorno stesso, spegnibili). Le cose di ogni giorno avvisano solo chi è di turno, una volta, all'orario scelto, e solo se l'adulto lo accende. Niente solleciti ripetuti.
- **Niente meccaniche che creano dipendenza.** Niente serie di giorni («12 giorni di passeggiate di fila»), punti, stelline o classifiche tra chi si occupa dell'animale. Il conteggio della settimana, se serve, si mostra come fatto («Laura 6, Marco 5»), come proposto per i Turni.
- **Storico breve.** «Fatto da Laura alle 19:10» resta 7 giorni, come i «Fatti» di Da fare. Non è un registro delle abitudini di una persona.
- **Misura senza contenuti.** Eventi anonimi come «profilo animale completato» o «scadenza ripetuta creata», per Nest, mai il nome dell'animale né le note. Gli eventi vanno proposti a Francesco in una issue (regola della skill privacy).
- **Pet sitter come aiutante:** solo dopo il controllo di #392 con le skill privacy e sicurezza. Vede i compiti dell'animale nei giorni scelti e il numero del veterinario; non vede gli impegni dei figli né le altre parti del Nest.

---

## 7. Proposta di requisito

### 7.1 Funzioni in ordine di priorità

**Prima uscita (mese 2):**

1. **Profilo dell'animale**: nome, specie (cane, gatto, altro), data di nascita o di adozione (anche solo l'anno), colore, foto facoltativa, «cosa mangia» (marca e note, fino a 80 caratteri), veterinario (nome, studio, telefono), nota breve (fino a 200 caratteri). Si apre da «Il tuo Nest» al posto della pagina del membro; «Togli dal Nest» resta.
2. **Scadenze che si ripetono**, per tutta la casa: ogni mese, ogni 3 mesi, ogni 6 mesi, ogni anno, ogni N giorni. Quando si segna fatta, l'app propone la prossima a partire da oggi, modificabile. Per l'animale tre scadenze pronte (Antiparassitario, Vaccino, Visita di controllo), con l'intervallo da confermare.
3. **Cose di ogni giorno a turno**, in Da fare: ripetizione ogni giorno o in giorni scelti, orario facoltativo (mattina, sera o un'ora), persone del turno (adulti e figli), turno a giorni alterni o per giorno della settimana, oppure «chi è libero». «Fatto» con nome e ora visibili a tutti per quel giorno.
4. **Oggi**: le cose di ogni giorno dell'animale in «Le mie cose» per chi è di turno e in «Da fare in casa» per gli altri; la prossima scadenza dell'animale tra le scadenze.
5. **Spesa**: la voce dell'animale in «Le più comuni» (mockup 15) e «Metti in spesa» dal profilo, con il testo di «cosa mangia».
6. **Impegni**: dal profilo «Nuovo impegno» già con l'animale tra le persone; punto del suo colore nel Mese; «Prossimi impegni».
7. **Esplora, «Zampe»**: lo spazio passa da «in arrivo» a pronto e porta al profilo dell'animale; chi aveva chiesto «Avvisami» lo trova in «Novità».

**Subito dopo (piccole novità):**

8. **Istruzioni per chi lo tiene**: testo pronto da copiare, con anteprima e avviso.
9. **Veterinario e pet sitter in Contatti utili** (con #385), collegati all'animale; il veterinario del profilo diventa lo stesso contatto.

**Più avanti:**

10. **Lettura del libretto con l'AI** (Plus, con #386).
11. **Pet sitter come aiutante** (con #392).
12. **Compleanno o adozione** tra le ricorrenze (con #387); **lista per il viaggio** (con #378); **libretto allegato** (con #380).

**Fuori:** diario della salute, peso, farmaci, referti, GPS, microchip, cane d'assistenza.

### 7.2 Schermate per il designer e per Fable

Dati di esempio della famiglia D'Angelo con Biscotto, cane. Per gli esempi con un gatto propongo «Micia, gatta», da confermare.

1. **Profilo dell'animale** (telefono e computer). Testa con foto o avatar del colore, nome, specie ed età. Tre contatori: prossima scadenza («Antiparassitario tra 6 giorni»), cose di oggi («2 su 3 fatte»), prossimo impegno. Sezioni: «Oggi» (le cose di ogni giorno con chi è di turno e «Fatto»), «Scadenze» (con «Si ripete ogni mese»), «Cosa mangia» con «Metti in spesa», «Veterinario» con «Chiama», «Prossimi impegni», nota. Stati: normale, vuoto («Completa il profilo di Biscotto»), caricamento, errore con «Riprova», offline.
2. **Modifica del profilo** (foglio): nome, specie, data, colore (i 10 colori, quelli presi spenti), foto con l'avviso «solo l'animale, senza persone», cosa mangia, veterinario, nota con l'avviso «niente dati di salute delle persone». Errori sotto i campi.
3. **Nuova scadenza con ripetizione** (nel foglio Aggiungi e dal profilo): campo «Si ripete» con le scelte; per l'animale le tre scadenze pronte con la riga «l'intervallo lo decide il vostro veterinario». Dopo «Fatto»: «La prossima: 18 dicembre», con «Cambia data».
4. **Nuova cosa di ogni giorno a turno**: cosa (passeggiata, cibo, lettiera o testo libero), quando (ogni giorno o giorni scelti; mattina, sera o ora), chi (persone del turno), come si alterna (a giorni, per giorno della settimana, chi è libero), avviso a chi è di turno acceso o spento. Anteprima della settimana con i nomi.
5. **Riga in Oggi** per chi è di turno e per gli altri, con il «Fatto» e lo stato «Fatto da Laura alle 19:10»; «Annulla» di 5 secondi come oggi.
6. **Scadenze di Casa** con le ripetute: l'icona o la riga «ogni mese», il filtro per persona che include l'animale.
7. **Spesa**: «Le più comuni» con «Crocchette per Biscotto» e, con un gatto, la sabbia; il toast dopo «Metti in spesa» dal profilo.
8. **Calendario**: un impegno con l'animale (visita dal veterinario con chi accompagna); il punto del colore dell'animale nel Mese.
9. **Il tuo Nest**: la riga dell'animale che porta al suo profilo.
10. **Esplora, «Zampe»**: lo spazio pronto, con cosa si può fare e il passaggio al profilo.
11. **Istruzioni per chi lo tiene** (dopo): anteprima del testo, cosa contiene, «Copia», avviso che lo manda l'adulto.

Non serve un passo nuovo in onboarding: la strategia di crescita chiede di accorciare il percorso verso l'invito del secondo adulto (`strategia-crescita.md`, sintesi punto 3). Basta una scheda in Oggi, una volta, «Completa il profilo di Biscotto», che si chiude.

### 7.3 Domande per Francesco

Ognuna ha una risposta proposta. Se va bene, basta un «sì» nella issue #460.

| #   | Domanda                                                                                                                    | Consiglio                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Tutta la funzione Animali, compresi i promemoria dei vaccini, va nel piano base?                                           | **Sì.** In Plus solo la lettura del libretto con l'AI e lo spazio oltre i 100 MB                                                      |
| 2   | Le scadenze che si ripetono valgono per tutta la casa (bollo, revisione, caldaia), non solo per gli animali?               | **Sì.** È lo stesso lavoro e serve a tutti                                                                                            |
| 3   | Confermi che D1 non vale per gli animali: vaccini, antiparassitari e visite dell'animale sono ammessi, anche negli esempi? | **Sì**, dopo il parere dell'agente legale-privacy, con le tre eccezioni della sezione 6.2                                             |
| 4   | Il numero di microchip si raccoglie?                                                                                       | **No** nella prima uscita                                                                                                             |
| 5   | Foto dell'animale facoltativa?                                                                                             | **Sì**, con l'avviso «solo l'animale» e l'avatar del colore come scelta predefinita                                                   |
| 6   | I figli possono essere nel turno delle cose di ogni giorno (Sofia dà da mangiare a Biscotto)?                              | **Sì**, come oggi in Da fare, senza punti, stelline né serie                                                                          |
| 7   | Il veterinario sta nel profilo dell'animale e poi anche in Contatti utili con la categoria «Veterinario»?                  | **Sì.** Non è un contatto sanitario di una persona, quindi non va contro la regola di #385                                            |
| 8   | Gli animali continuano a contare nel limite di 10 membri e a prendere uno dei 10 colori?                                   | **Sì, per ora.** Toglierli dal limite vuol dire rivedere i colori unici; si riguarda quando avremo il numero medio di membri per Nest |
| 9   | Specie: solo cane, gatto e altro?                                                                                          | **Sì.** Le scadenze pronte solo per cane e gatto; per gli altri si scrivono a mano                                                    |
| 10  | Uscita grande al mese 2, con lo scambio con i Turni se il mese 1 cade tra febbraio e aprile?                               | **Sì.** Liste multiple passa al mese 4, il resto slitta di un mese                                                                    |
| 11  | Lo spazio di Esplora resta «Zampe» e le pagine dicono «Animali»?                                                           | **Sì.** «Zampe» è nel mockup approvato; nei titoli «Animali» si capisce anche con un pesce                                            |
| 12  | Prima della funzione, si sistema la voce dell'animale in «Le più comuni» che il mockup 15 già prevede?                     | **Sì**, come correzione piccola, in una issue a parte                                                                                 |

Un dato in più che aiuterebbe la decisione: quante case hanno chiesto «Avvisami quando è pronto» per «Zampe». Il conteggio lo legge solo la chiave amministrativa (`space_interest_counts`); può chiederlo Francesco al team.

---

## Fonti

Documenti e codice interni, letti il 18/11/2026: `docs/agenti/APP.md`; `docs/mockup/DECISIONI.md` (D1, D2), `03-onboarding-persone.html`, `15-casa-spesa.html`, `19-esplora.html`, `29-membro.html`; `src/app/(app)/nest/page.tsx`, `src/components/membri/MemberView.tsx`, `src/components/casa-spesa/model.ts`, `src/lib/spaces.ts`; migrazioni `enum_types`, `core_tables`, `events_tables`, `todos_table`, `deadlines_table`, `child_profiles_tables`, `household_members_limit`; `docs/strategia/mappa-funzionalita.md`, `concorrenti.md`, `contesto-prodotto.md`, `strategia-crescita.md`, `business-case-mercato.md`, `recensioni-concorrenti.md`, `traccia-interviste.md`; issue #385, #392, #393, #460; skill `privacy-e-dati-minori`, `pricing`, `testi-naturali`.

Ubersuggest, località Italia, lingua italiana, consultato il 18/11/2026: «keyword suggestions» per «app per cani», «promemoria vaccino cane», «libretto sanitario cane»; «keyword overview» per «antiparassitario cane», «antiparassitario gatto», «antiparassitario gatto quando», «vaccini cane», «vaccini gatto», «filaria cane», «app per gatti», «dog sitter», «pet sitter», «microchip cane», «crocchette cane», «sabbia gatto», «richiamo vaccino cane», «anagrafe canina», «pensione per cani», «11pets»; «serp analysis» per «app per cani» (raccolta del 06/10/2026, non aggiornata).

Esterne, consultate il 18/11/2026:

1. Open, «Rapporto Assalco-Zoomark 2026», 09/06/2026: https://www.open.online/2026/06/09/rapporto-assalco-zoomark-2026-animali-domestici/
2. LaPresse, «Giornata mondiale del cane: in Italia sono 9,1 milioni», 24/08/2026: https://www.lapresse.it/salute/2026/08/24/giornata-mondiale-del-cane-in-italia-sono-91-milioni-ma-torna-lallarme-abbandono/
3. FEDIAF, Facts & Figures 2026 (PDF): https://www.zzf.de/fileadmin/ZZF/Dokumente/Heimtiermarkt/FEDIAF_Facts_Figures_2026.pdf
4. Pet Worldwide, «Updated Fediaf Facts and Figures: 306 million pets», 16/06/2026: https://www.petworldwide.net/content-1/news/2026/06/16/free/european-pet-food-industry-worth-eur29-4-billion.html
5. Cozi, «8 Reasons to Add Your Pet to Cozi», 03/05/2023: https://www.cozi.com/blog/8-reasons-to-add-your-pet-to-cozi/
6. Hearth Display, funzioni e abbonamento: https://www.hearthdisplay.com/pages/features ; https://hearthdisplay.com/products/family-membership
7. Skylight, «What are Skylight Calendar Profiles?»: https://skylight.zendesk.com/hc/en-us/articles/31522050025627
8. BSIMB, «Skylight calendar family chore management» (blog esterno): https://bsimbframes.com/blogs/bsimb-blogs/skylight-calendar-family-chore-management
9. Mimko, App Store Italia e sito, da `concorrenti.md` 4.2: https://apps.apple.com/it/app/id6755377529 ; https://mimko.app
10. Joppys, App Store Italia: https://apps.apple.com/it/app/joppys/id1543777185
11. 11pets, App Store Italia: https://apps.apple.com/it/app/11pets-pet-care/id1232470530
12. 11pets, scheda Android su AppFollow: https://apps.appfollow.io/android/11pets-pet-care/com.m11pets.elevenpets?country=hu
13. MyLav for Pets, App Store Italia: https://apps.apple.com/it/app/mylav-for-pets/id6468529251
14. Tech Princess, «MyLav for Pets»: https://techprincess.it/mylav-for-pets-app/
15. Schede degli store: MyVet https://apps.apple.com/py/app/myvet/id6463804287 ; Zampavet https://apps.apple.com/ca/app/zampavet/id6469046472 ; Pelo https://play.google.com/store/apps/details?id=tomlab.pelo ; PetDiary https://apps.apple.com/ar/app/petdiary/id6751150529 ; Friendly https://apps.apple.com/py/app/friendly/id1537759623
16. Schede degli store: Fed? https://mwm.ai/apps/fed-pet-feeding-tracker-log/6760776848 ; I Fed the Pet https://apps.apple.com/us/app/-/id6762333960 ; Petly https://apps.apple.com/app/id6761326672 ; Pet Feeder App https://apps.apple.com/us/app/id6758022385 ; Meal Time For Pets https://apps.appfollow.io/ios/meal-time-for-pets/1523239569?country=us
17. Tractive, piani: https://tractive.com/it/c/plans
18. Aranzulla, «Siti per dogsitter» (senza data): https://www.aranzulla.it/siti-per-dogsitter-1389576.html
19. Pawshake Italia, pet sitter: https://en.pawshake.it/petsitters
20. Regolamento UE 2016/679 (GDPR), articoli 4 e 9: https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32016R0679
21. Cybersecurity360, guida su privacy e animali: https://www.cybersecurity360.it/?p=80820
22. ANMVI, «Procedure di anagrafe canina» (allegato B): https://anmvioggi.it/media/files/ALLEGATO%20B%20PROCEDURE%20DI%20ANAGRAFE%20CANINA.pdf
23. Eunews, «Microchip obbligatorio e divieti per la riproduzione: Strasburgo approva le norme per il benessere di cani e gatti», 28/04/2026: https://www.eunews.it/2026/04/28/microchip-obbligatorio-e-divieti-per-riproduzione-strasburgo-approva-le-norme-per-il-benessere-di-cani-e-gatti/
