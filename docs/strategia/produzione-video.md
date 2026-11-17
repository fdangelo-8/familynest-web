17/11/2026

# FamilyNest: come produrre i video social

Studio dello stratega per Francesco. Riguarda solo i video brevi (TikTok, Instagram Reels, YouTube Shorts, più Facebook e Pinterest): cosa funziona nella nicchia «genitori e organizzazione», come produrli, con quali strumenti, quanto costano e come misurarli. L'analisi dei concorrenti la sta facendo un altro stratega: qui riprendo solo quello che serve ai video, da `concorrenti.md` e `business-case-mercato.md`.

Si appoggia a `contesto-prodotto.md` (voce del marchio, parole da usare) e a `mappa-funzionalita.md` (branch `docs/strategia-mappa-funzionalita`, non ancora su main) per le funzioni da mostrare.

**Come leggere i numeri.** Ogni dato ha una fonte numerata (elenco in fondo, tutte consultate il 17/11/2026). I prezzi sono quelli delle pagine ufficiali alla stessa data, in dollari e IVA esclusa, con pagamento mensile salvo dove scritto. Quando una pagina ufficiale non si leggeva, lo scrivo e indico da dove viene il numero. Le mie stime hanno scritto «stima» e il calcolo.

## Riassunto per Francesco

1. **Filiera consigliata: ibrida.** Circa due video su tre li produce Claude quasi da solo: registrazione dello schermo di un Nest di prova con dati inventati, animazioni fatte con i nostri colori, voce fuori campo e sottotitoli. Il terzo video lo gira una persona vera col telefono (Francesco o un adulto di casa, mai bambini), seguendo un copione scritto da Claude. Il video generato con l'AI serve solo per qualche scena di riempimento senza persone. Con il modello Soldoni (punto 6) la parte automatica sale a un video al giorno.
2. **Strumenti:** ElevenLabs per la voce (piano Creator, 22 $/mese, con la clonazione della voce di Francesco), Remotion per animazioni e montaggio scritti in codice (gratis per un'azienda fino a 3 persone), Canva (già collegata) per caroselli e copertine, Postiz per programmare i post (29 $/mese, 5 canali, con API e MCP). Opzionali: Submagic per i sottotitoli dei video girati (19 $/mese) e Veo per le scene generate (circa 0,10–0,12 $ al secondo, prezzo da fonte secondaria).
3. **Costo degli strumenti:** circa 51 $/mese con il minimo indispensabile, uguale a 3, 5 o 10 video a settimana; da circa 76 a 111 $/mese con gli strumenti opzionali. Il costo vero è il tempo di Francesco: circa 1,5 ore a settimana con 3 video, 4,5 ore con 10 (stima, capitolo 6.4).
4. **Formati da provare per primi:** «Il gruppo WhatsApp di famiglia» (ironia), «POV: sei l'unico che si ricorda tutto» (carico mentale, alla pari tra adulti), «Domenica sera, 5 minuti» (prima e dopo), «Un trucco in 20 secondi» (consiglio rapido con lo schermo dell'app).
5. **Regole fisse:** nessun bambino vero riconoscibile, nei nostri video e in quelli dei creator; dati di prova inventati e senza dati sanitari; etichetta «contenuto AI» quando la voce o la scena sono generate; solo musica con licenza commerciale; #adv in apertura per ogni collaborazione pagata.
6. **Il modello Soldoni (capitolo 10).** Soldoni, app di finanza per iPhone fatta da una sola persona e uscita a inizio novembre 2026, pubblica un video al giorno su TikTok dall'8 novembre. I video e il profilo Instagram non si leggono in automatico: formati, voce e musica sono da annotare con la scheda del capitolo 10.3. Su TikTok i numeri sono quelli di un account appena nato (3 follower, 244–920 visualizzazioni a video). Da copiare è il metodo: un video automatico al giorno con schermo dell'app, voce sintetica e modello fisso. Per noi diventa la base della filiera, con gli stessi strumenti e gli stessi 51 $ al mese, più l'approvazione di Francesco e le nostre regole su bambini, etichetta AI e musica.
7. **Primo passo concreto:** un'ora con Claude per preparare il Nest di prova «famiglia Esposito» e i primi 10 copioni; poi Francesco registra 30–60 minuti di lettura per la clonazione della voce e apre gli account aziendali su TikTok, Instagram e YouTube. Il piano dei primi 30 giorni è al capitolo 7.

---

## 1. Cosa diventa virale nella nicchia «genitori e organizzazione»

### 1.1 I dati disponibili

Non esiste una classifica pubblica e verificata dei video più visti della nicchia nel 2026. TikTok e Instagram non mostrano visualizzazioni e follower a uno strumento automatico (lo stesso limite è segnato in `concorrenti.md`). I numeri qui sotto vengono da articoli che hanno raccontato i video: sono indicativi, non misure.

**Estero (soprattutto Stati Uniti)**

| Account o caso                                                                | Cosa fa                                                                                                                                                                                                                 | Numeri riportati                                                                                                                    | Perché ha funzionato (mia lettura)                                                                                    | Fonte |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----- |
| Laura Danger, TikTok @thatdarnchat                                            | educatrice e facilitatrice del metodo Fair Play; reazioni a video di altri sul lavoro di casa non diviso, slogan «Domestic labour is labour»                                                                            | oltre 350.000 follower su TikTok (dato vecchio); un video tra 2,9 e 7 milioni di visualizzazioni                                    | reagisce a una scena che tutti hanno vissuto e dà un nome al problema; i commenti diventano un dibattito tra genitori | [39]  |
| Libby Ward, TikTok @diaryofanhonestmom                                        | sketch comico (il «ballo del pollo robotico») su quanto la maternità tolga tempo per divertirsi                                                                                                                         | virale, numeri non riportati                                                                                                        | esagerazione fisica e riconoscibile, nessuna spiegazione                                                              | [36]  |
| @theearlybirdhasanxiety                                                       | il dispenser del sapone vuoto che nessuno riempie, come metafora del lavoro invisibile                                                                                                                                  | oltre 166.000 visualizzazioni                                                                                                       | un oggetto banale che riassume un problema enorme                                                                     | [37]  |
| Lilian Schmidt, @heylilianschmidt                                             | mostra come usa ChatGPT per pianificare (pasti, liste per l'asilo)                                                                                                                                                      | oltre 710.000 visualizzazioni                                                                                                       | dimostrazione pratica e copiabile; nei commenti l'AI diventa «un co-genitore»                                         | [38]  |
| Papà che spiega come alleggerire il carico della compagna mentre è in viaggio | consigli concreti detti da un uomo                                                                                                                                                                                      | 2,9 milioni di visualizzazioni e oltre 400.000 like (aprile 2023)                                                                   | ribalta il punto di vista: è l'altro adulto a prendersi il carico. Rientra nella nostra voce «alla pari»              | [40]  |
| Skylight (calendario da parete)                                               | «Parent Confessions», confessioni dei genitori raccolte sui social; un calcolatore gratuito del carico mentale; 42 creator in una campagna di Natale; post #skylightpartner con «commenta la parola e ricevi lo sconto» | 4.200 storie e 618 milioni di impressioni; un post sponsorizzato da 228.400 visualizzazioni                                         | contenuti fatti dagli utenti e dai creator invece che dal marchio; uno strumento gratuito da condividere              | [44]  |
| App che crescono con caroselli e slideshow senza volto                        | sequenze di 3–6 immagini con testo grande, pubblicate più volte al giorno in automatico                                                                                                                                 | esempi di 100+ download senza pubblicità e di 7,1 milioni di visualizzazioni in una settimana, dichiarati da chi vende lo strumento | costano quasi zero e si producono in serie; i numeri sono autodichiarati da un fornitore                              | [45]  |

**Italia**

| Account                                      | Cosa fa                                                                                                             | Numeri riportati                                                                                                             | Perché funziona (mia lettura)                                                                                                      | Fonte                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Cammela (Chiara Anicito)                     | personaggio comico della mamma, nato in lockdown; uno spettacolo su «il gruppo delle mamme» WhatsApp                | circa 1,3 milioni di follower su TikTok, oltre un milione su YouTube, quasi 500.000 su Instagram (articolo di circa il 2023) | il gruppo WhatsApp delle mamme è un nemico comune: è il nostro stesso problema raccontato con ironia                               | [41]                                 |
| Julia Elle (Disperatamente Mamma)            | ironia sulle situazioni di ogni giorno con i figli, libri con Mondadori                                             | circa 634.000 follower su Instagram (dato non datato)                                                                        | autoironia e un tono da amica                                                                                                      | [42]                                 |
| Giada Sundas, Angelica Massera               | autoironia sulla maternità (Sundas, partita da Facebook) e sulle contraddizioni delle madri (Massera, #vitadamamma) | non riportati                                                                                                                | stessa leva: la scena di casa esagerata                                                                                            | [42], [43]                           |
| Benedetta Rossi (Fatto in casa da Benedetta) | ricette di casa                                                                                                     | «menu settimanale fatto in casa da benedetta»: 1.000 ricerche al mese su Google in Italia                                    | il «menu settimanale» è un bisogno italiano forte: «menu settimanale» 3.600 ricerche al mese, «menu settimanale da stampare» 1.300 | Ubersuggest, Italia, 17/11/2026 [48] |

Da Ubersuggest (Italia, 17/11/2026) [48]: «lista della spesa» 6.600 ricerche al mese, «lista della spesa app» 1.300, «carico mentale» 210, «carico mentale donne» 140. Conferma quello che dicono le recensioni in `contesto-prodotto.md`: in Italia si cerca la cosa pratica (spesa, menu, calendario) molto più del concetto di «carico mentale».

**Nota sui dati per la salute.** Molte ricerche sul menu settimanale sono legate a diete per malattie («per diabetici», «per colecisti»). Non le usiamo: i video non parlano di diete mediche, come i dati dell'app (decisione D1, skill `privacy-e-dati-minori`).

### 1.2 I formati che ricorrono

La mia lettura degli esempi sopra, adattata a FamilyNest. Per ogni formato c'è un'idea di gancio in italiano.

| Formato                        | Com'è fatto                                                                                    | Esempio per FamilyNest                                                                                                        | Filiera adatta (cap. 2)           |
| ------------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **POV**                        | testo a schermo «POV: …» e una scena recitata o una sequenza di schermate                      | «POV: sei l'unico in casa che sa che giovedì c'è il calcetto di Tommaso» e poi la notifica che arriva a tutti                 | (c) persona, (b) schermo          |
| **Ironia sul gruppo WhatsApp** | la chat che scorre all'infinito con 47 messaggi per sapere chi prende chi                      | chat finta che scorre, poi la stessa informazione in una riga del calendario «Chi accompagna»                                 | (d) animazione                    |
| **Prima e dopo**               | frigorifero pieno di fogli e post-it, poi il telefono                                          | «Domenica sera, 5 minuti»: prima la lavagna sul frigo, poi la settimana nel calendario condiviso                              | (c) + (b)                         |
| **Giornata tipo**              | una giornata in 20–40 secondi, a tagli rapidi                                                  | «Il martedì di una famiglia con due lavori e due figli»: sintesi del mattino, spesa che si aggiorna, «Liberi insieme» la sera | (b) + (c), senza bambini in video |
| **Consiglio rapido**           | un trucco in 15–25 secondi, dimostrato                                                         | «Scrivi una frase e diventa un impegno»: «Calcetto di Tommaso giovedì alle 17» digitato in Aggiungi                           | (b) schermo                       |
| **Lista**                      | «3 cose che…», una per taglio                                                                  | «3 scadenze di casa che dimentichiamo tutti: bollo, revisione, assicurazione»                                                 | (d) o carosello Canva             |
| **Carico mentale, alla pari**  | uno dei due adulti elenca quello che ha in testa; oppure l'altro adulto se ne prende una parte | «Cose che ho in testa alle 23:» con l'elenco che scorre, poi «adesso le vede anche lui»                                       | (c) persona                       |
| **Storie a puntate**           | serie con lo stesso titolo e un numero, che riporta la gente sul profilo                       | «La settimana della famiglia Esposito, puntata 3»: una famiglia inventata che usa l'app                                       | (d) + (b)                         |
| **Confessioni**                | domande al pubblico e risposte lette in video (come «Parent Confessions» di Skylight)          | «La cosa più assurda che vi siete dimenticati»: si raccolgono le risposte nei commenti e diventano video                      | (d), poi (c)                      |

**Da evitare** (mia valutazione, coerente con la voce del marchio): video che danno la colpa a «lui» o «lei», paura e conti alla rovescia, «mamma supereroina», bambini usati come sfondo emotivo. La voce è «calmo» e «alla pari» (`contesto-prodotto.md`). L'ironia funziona quando ride della situazione, non di una persona.

### 1.3 Gancio, durata, ritmo, testo, audio

**Fatti (con fonte):**

- **Gancio.** Le guide di TikTok per gli inserzionisti chiedono video verticali 9:16, girati almeno a 720p, con i contenuti fuori dalla «zona di sicurezza» dei pulsanti dell'app, e un'aria nativa da «Per te» [32]. Secondo guide di terzi, TikTok consiglia di presentare la proposta nei primi 3 secondi e il gancio entro i primi 6 [32]; non l'ho trovato sulla pagina ufficiale.
- **Segnali di Instagram.** Il tempo di visione, gli invii in privato rispetto alla copertura e i like rispetto alla copertura sono i tre segnali attribuiti ad Adam Mosseri (capo di Instagram) nelle sue dichiarazioni di gennaio 2025, ripresi da blog di settore; per Instagram contano più gli invii che i like quando si vuole raggiungere chi non ti segue [35]. Per il 2026 Mosseri ha indicato tra le priorità premiare i contenuti originali [35]. La penalità per video ripubblicati con il logo di un'altra app è riportata da blog ma non da una fonte ufficiale.
- **Durata.** Shorts e Reels arrivano a 3 minuti (YouTube da ottobre 2024, Instagram da gennaio 2025, fonti secondarie). Un'analisi di Buffer su 2,7 milioni di Reels ha trovato la copertura più alta tra 90 secondi e 3 minuti [33]. I benchmark di chi vende strumenti di analisi indicano come buono un tempo di visione medio sopra il 60% per video sotto i 15 secondi, sopra il 50% tra 15 e 30 secondi, sopra il 40% tra 30 e 60 [34]: sono stime di un fornitore, non dati delle piattaforme.
- **Senza audio.** Un blog cita un dato interno di Meta del 2025 per cui l'85% dei video brevi si guarda senza audio [34]; non ho trovato la fonte originale.

**La mia raccomandazione (deduzione, da verificare con il test del capitolo 7):**

| Elemento          | Regola per FamilyNest                                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primi 2 secondi   | una scena riconoscibile già nel primo fotogramma (chat che scorre, frigo pieno, notifica) **e** il testo del gancio scritto grande; niente logo né «Ciao a tutti»                                 |
| Durata            | 15–30 secondi per consigli e POV; 30–60 per prima e dopo e giornata tipo; 60–90 solo per le puntate che funzionano. Si allunga solo dopo aver visto il tempo di visione                           |
| Ritmo             | un taglio o un cambio di schermata ogni 1,5–3 secondi; mai più di 3 secondi fermi sulla stessa schermata                                                                                          |
| Testo a schermo   | sottotitoli sempre (si guarda senza audio); gancio in alto nel terzo superiore, sottotitoli al centro, niente in basso a destra (lì ci sono i pulsanti)                                           |
| Voce              | ritmo un po' più veloce di una conversazione, frasi brevi, parole di casa («impegni», «spesa», «chi accompagna»), mai «organizer» o «soluzione»                                                   |
| Audio di tendenza | solo dalle librerie commerciali delle piattaforme (capitolo 5.3); una tendenza si usa solo se sta salendo e se si adatta alla scena                                                               |
| Chiusura          | una frase che invita a commentare o a mandare il video al partner («Mandalo a chi deve sapere del calcetto»). L'invio in privato è il segnale che Instagram premia [35] e porta il secondo adulto |

L'ultima riga conta più delle altre: il prodotto cresce quando entra il secondo adulto (`contesto-prodotto.md`, «Obiettivi»). Un video che chiede «mandalo al tuo partner» lavora sia per l'algoritmo sia per l'invito nel Nest.

---

## 2. Le quattro filiere possibili

Dalla più automatica alla più umana. Le valutazioni di qualità e viralità sono mie (alta, media, bassa), basate sugli esempi del capitolo 1 e sulle regole del capitolo 5. Costi e tempi sono stime spiegate nel capitolo 6.

| Filiera                                                            | Qualità attesa                                                          | Viralità potenziale                                                                               | Costo strumenti                                                | Tempo per video (stima)                                                    | Rischi principali                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **(a) Tutto AI**: scene o avatar generati e voce sintetica         | buona sulle scene brevi, debole su persone e mani; avatar riconoscibili | bassa per un'app di famiglia: il pubblico cerca la vita vera, e le etichette AI sono obbligatorie | da 29 $/mese (HeyGen) a 0,10–0,40 $ al secondo (Veo)           | 30–60 minuti di Claude, 10 di Francesco; molte prove scartate              | etichetta obbligatoria su TikTok, Instagram e YouTube per persone e scene realistiche [21][23][24]; il 45% degli australiani dice che si fiderebbe meno di un marchio con pubblicità fatte quasi tutte con l'AI [46]; in un'app per famiglie, bambini generati che sembrano veri sarebbero un problema |
| **(b) Schermo dell'app** + voce fuori campo + montaggio automatico | alta e coerente: mostra il prodotto vero                                | media: funziona per consigli e «prima e dopo», meno per l'intrattenimento puro                    | da 0 a 22 $/mese (voce)                                        | 15–20 minuti di Claude, 5 di Francesco per approvare                       | serve un Nest di prova con dati inventati (mai dati veri); con voce clonata, etichetta AI su Instagram                                                                                                                                                                                                 |
| **(c) Persona vera col telefono** + montaggio assistito            | variabile, ma credibile                                                 | la più alta: tutti i casi virali del capitolo 1 hanno una persona vera                            | da 0 a 19 $/mese (sottotitoli)                                 | 20–30 minuti di ripresa per video, meno se si gira in blocco; 10 di Claude | volti e voci dei familiari; bambini che entrano nell'inquadratura; liberatorie per chi appare                                                                                                                                                                                                          |
| **(d) Animazioni dai nostri design** (Remotion, Canva)             | alta e riconoscibile: colori e componenti del mockup                    | media: ottima per liste, chat finte e serie; meno «umana»                                         | 0 (Remotion gratis fino a 3 persone [16]; Canva già collegata) | 10–15 minuti di Claude dopo i primi modelli; 5 di Francesco                | bassa; un'animazione non realistica non richiede l'etichetta AI su YouTube [24] e Instagram [23]                                                                                                                                                                                                       |

### 2.1 (a) Tutto generato con l'AI

- **Come funziona:** Claude scrive il copione, uno strumento genera le scene (Veo, Runway, Kling) o un avatar che parla (HeyGen, Synthesia), ElevenLabs fa la voce.
- **Cosa c'è di buono:** è la filiera più automatica, con API per quasi ogni passo.
- **Cosa non va per noi:** il pubblico della nicchia premia la vita vera (capitolo 1). Le piattaforme chiedono l'etichetta per scene e persone realistiche e TikTok la mette da solo quando legge i metadati C2PA dei file generati [21][22]. Il sondaggio YouGov (Australia, maggio 2026, 1.046 adulti) e lo studio IAB e Sonata (Stati Uniti, 505 persone della Gen Z e millennial) indicano un calo di fiducia verso le pubblicità fatte con l'AI [46][47]: non sono dati italiani, ma vanno nella stessa direzione.
- **Uso consigliato:** solo scene di riempimento senza persone (una cucina vuota, un frigorifero con i post-it, la pioggia sulla finestra la domenica sera) e solo se mancano riprese vere. Mai bambini generati.

### 2.2 (b) Registrazione dello schermo dell'app

- **Come funziona:** un Nest di prova («famiglia Esposito», tutta inventata) con impegni, spesa e scadenze già pronti. Claude scrive i passaggi da mostrare; la registrazione si fa con Playwright, che il progetto usa già per i test e che sa registrare video della pagina in formato telefono. Poi Remotion aggiunge zoom, testo e sottotitoli, ElevenLabs la voce.
- **Cosa c'è di buono:** mostra l'app vera, si rifà quando l'interfaccia cambia, costa quasi zero. È la filiera più vicina all'automazione completa.
- **Cosa serve:** uno script di registrazione che oggi non esiste. Non lo creo io (non tocco `src/` né `tests/`): lo propongo come issue per il team di sviluppo (capitolo 8). In attesa dello script, Francesco registra lo schermo del telefono con la funzione del sistema operativo, 1–2 minuti per video.
- **Rischi:** mostrare per errore dati veri; mostrare dati che la skill `privacy-e-dati-minori` esclude (pediatra, allergie, scuole vere). Il Nest di prova usa solo nomi inventati, scuole inventate e nessun dato sanitario.

### 2.3 (c) Una persona vera col telefono

- **Come funziona:** Claude scrive copione e inquadrature; una persona gira 5–10 clip brevi in una sessione unica (luce da finestra, telefono verticale); Claude monta il video con Remotion o lo passa a un montaggio automatico (Submagic, CapCut, Descript), aggiunge sottotitoli e testo.
- **Chi può essere:** Francesco, un adulto di casa o un amico che accetta; più avanti micro creator genitori pagati (capitolo 5.4). Il business case prevede già 5–10 micro creator da 10.000–50.000 follower (`business-case-mercato.md`, 4.4).
- **Cosa si inquadra:** adulti, mani, telefono, frigorifero, auto, zaini. **Mai bambini riconoscibili**, nemmeno di spalle con la divisa della scuola o la voce in sottofondo.
- **Rischi:** è la filiera che dipende di più dal tempo di una persona; chi appare firma una liberatoria per l'uso dell'immagine.

### 2.4 (d) Animazioni e grafica in movimento dai nostri design

- **Come funziona:** Remotion fa video scritti in React, lo stesso linguaggio dell'app. Claude può usare i colori, i caratteri e i componenti del mockup (`docs/mockup/`, design system) e generare una chat WhatsApp finta che scorre, una lista che si spunta, una settimana che si riempie. Canva serve per caroselli, copertine e video semplici a modello.
- **Cosa c'è di buono:** riconoscibile, coerente con il marchio, automatizzabile al 100%, nessun rischio di privacy.
- **Licenza:** Remotion è gratis per persone e aziende fino a 3 persone, uso commerciale compreso [16]. Sopra, 25 $ al mese per postazione o 0,01 $ a video con un minimo di 100 $ al mese [16].
- **Dove metterlo:** il codice dei video non va in `src/`. Propongo una cartella o un repository separato, da decidere con Francesco e l'architetto (capitolo 8).

---

## 3. Strumenti, prezzi e API

Prezzi letti sulle pagine ufficiali il 17/11/2026, mensili, in dollari, IVA esclusa, salvo dove indicato.

### 3.1 Voce

| Strumento               | Piano e prezzo                                                                                                                                                                                                                                                                                               | Cosa include                                                                                                   | Italiano                                                                                                                                                                                  | API per Claude                                                                                                 | Fonte     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------- |
| **ElevenLabs**          | Free 0 $ (10.000 crediti, circa 10 minuti, licenza commerciale non indicata); Starter 6 $ (circa 30 minuti, licenza commerciale, clonazione istantanea); **Creator 22 $** (circa 121 minuti, licenza commerciale, 1 clonazione professionale); Pro 99 $ (circa 600 minuti). Annuale: 12 mesi al prezzo di 10 | voci pronte, clonazione istantanea da un breve campione, clonazione professionale da almeno 30 minuti di audio | la pagina prezzi parla di 74 lingue senza elencarle; la pagina italiana dell'API indica Multilingual v2 come modello più stabile e v3 più espressivo (limite 3.000 caratteri a richiesta) | sì; la pagina prezzi la cita in modo esplicito solo per il piano Pro (da verificare nel pannello dell'account) | [1][2][4] |
| **Gemini TTS** (Google) | a consumo: per 10 secondi di audio circa 0,002 $ (Gemini 3.8 Flash TTS, fino al 31/12/2026; il doppio dal 2027); livello gratuito disponibile                                                                                                                                                                | voci sintetiche, niente clonazione                                                                             | non verificato sulla pagina                                                                                                                                                               | sì                                                                                                             | [9]       |
| **Descript**            | Hobbyist 16/24 $, Creator 24/35 $, Business 50/65 $ (la pagina non dice quale dei due prezzi sia annuale)                                                                                                                                                                                                    | voci pronte e clonazione della propria voce; Business con voci italiane «native»                               | trascrizione italiana su tutti i piani                                                                                                                                                    | pagina «API + MCP» esistente, piani non chiari                                                                 | [14]      |

**La clonazione della voce di Francesco con ElevenLabs** (dalla documentazione ufficiale [2]):

- la clonazione professionale chiede almeno 30 minuti di audio (consigliate 2–3 ore) e una **verifica**: si legge un testo a voce per dimostrare che la voce è la propria; poi il modello si prepara in 3–6 ore;
- **si può clonare solo la propria voce**, anche con il consenso dell'altra persona. Se un'altra persona vuole prestare la voce, crea la clonazione sul suo account e la condivide con un link;
- quindi Francesco può clonare la sua voce dal suo account; per una seconda voce (per esempio una voce femminile, per il tono «alla pari») serve una voce pronta della libreria o un'altra persona che faccia la sua clonazione;
- la clonazione professionale c'è dal piano Creator (22 $) in su; se si scende di piano la voce resta salvata ma non si può usare [2].

**Consenso di Francesco.** La legge sulla protezione dei dati tratta la voce come un dato personale. Consiglio una nota scritta di Francesco (anche una riga nella issue) che autorizza l'uso della sua voce clonata solo per i video di FamilyNest e PartyNest, con il diritto di ritirarla. L'etichetta AI resta comunque (capitolo 5.2).

**Raccomandazione:** ElevenLabs Creator. Con 121 minuti al mese bastano anche 10 video a settimana: 43 video al mese × 30 secondi di voce × 3 tentativi fanno circa 65 minuti (stima). Restano crediti per la musica (3.4).

### 3.2 Video generativo e avatar

| Strumento            | Prezzi                                                                                                                 | Cosa si ottiene                                                                                    | API                                                    | Note                                                                                                                        | Fonte |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ----- |
| **Veo 3.1** (Google) | Fast: 0,10 $/secondo a 720p, 0,12 $ a 1080p; Standard: 0,40 $/secondo; Lite 0,05–0,08 $                                | clip di 4–8 secondi con audio                                                                      | sì (Gemini API)                                        | prezzi da benchlm.ai, che cita la pagina di Google letta l'11/09/2026; sulla pagina di Google non ho trovato la sezione Veo | [8]   |
| **Sora 2** (OpenAI)  | —                                                                                                                      | —                                                                                                  | **API chiusa il 24/09/2026**, senza sostituto indicato | da escludere per l'automazione                                                                                              | [10]  |
| **Runway**           | Standard 15 $ (625 crediti, 52 secondi di Gen-4.5); Pro 35 $ (187 secondi); Max 95 $ (791 secondi); annuale 12/28/76 $ | clip generate, «senza watermark» dallo Standard                                                    | pagina sviluppatori citata, prezzi non mostrati        | uso commerciale non scritto sulla pagina prezzi                                                                             | [7]   |
| **Kling**            | Standard 6,99 $, Pro 25,99 $, Premier 64,99 $ (fonte non ufficiale); API a parte                                       | clip generate                                                                                      | sì, a pacchetti                                        | la pagina ufficiale non si legge in automatico: numeri da verificare                                                        | [11]  |
| **HeyGen**           | Free (3 video al mese con watermark); Creator 29 $; Pro 49 $; Business 149 $ + 20 $ a postazione                       | avatar che parlano, anche un avatar con il proprio volto e la propria voce; 175 lingue dal Creator | sì, prezzi su una pagina separata non leggibile        | uso commerciale non scritto sulla pagina                                                                                    | [5]   |
| **Synthesia**        | Basic 0 $; Starter 19 $ (circa 12 minuti al mese); Pro 89 $ (circa 60 minuti); annuale 14 e 59 $                       | avatar presentatori, 140 lingue                                                                    | sì, prezzi su pagina separata                          | pensato per formazione aziendale: poco adatto ai social di famiglia                                                         | [6]   |

**Raccomandazione:** nessun abbonamento all'inizio. Se servono scene di riempimento, Veo a consumo: 20 clip da 8 secondi a 1080p costano circa 19 $ (stima: 20 × 8 × 0,12 $). Gli avatar (HeyGen, Synthesia) sono da escludere per ora, per i motivi del capitolo 2.1.

### 3.3 Montaggio automatico e sottotitoli

| Strumento      | Prezzi                                                                                                                       | Cosa fa                                                                  | API                                                                                           | Note                                                                                                                                                                                      | Fonte |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| **Remotion**   | gratis fino a 3 persone; poi 25 $ a postazione o 0,01 $ a video (minimo 100 $)                                               | video scritti in codice React: montaggio, testo, sottotitoli, animazioni | è codice: Claude lo scrive e lo esegue                                                        | sottotitoli sincronizzati usando i tempi parola per parola che ElevenLabs restituisce con l'audio (funzione dell'API da verificare in prova)                                              | [16]  |
| **Submagic**   | Starter 19 $ (15 video sottotitolati al mese); Pro 39 $ (40); Business 69 $ (100, con 100 minuti di API); annuale 12/23/41 $ | sottotitoli animati, tagli dei silenzi, zoom                             | 10 minuti al mese su Starter e Pro, 100 su Business; pacchetti extra da 0,10–0,23 $ al minuto | l'italiano è tra le lingue dei sottotitoli                                                                                                                                                | [12]  |
| **Opus Clip**  | Free; Starter 15 $; Pro 29 $                                                                                                 | taglia video lunghi in clip brevi, con programmazione dei post sul Pro   | API di montaggio, API di programmazione e MCP sul Pro                                         | utile solo se un giorno avremo video lunghi (dirette, interviste)                                                                                                                         | [13]  |
| **Descript**   | da 16/24 $ (capitolo 3.1)                                                                                                    | montaggio modificando il testo trascritto, voci, doppiaggio              | API e MCP citati, piani non chiari                                                            | buono per chi monta a mano                                                                                                                                                                | [14]  |
| **CapCut**     | Free; Pro 19,99 $; Ultra 79 $; Teams 12,49 $ a postazione                                                                    | montaggio da telefono e computer, modelli, sottotitoli automatici        | nessuna API pubblica trovata                                                                  | musica e modelli si possono usare in modo commerciale solo se segnati per uso commerciale; un video che mescola materiali commerciali e non commerciali resta solo per uso personale [15] | [15]  |
| **Creatomate** | Essential 45 $ (circa 289 video da 30 secondi)                                                                               | modelli video riempiti da API                                            | sì                                                                                            | alternativa a Remotion se non vogliamo tenere codice                                                                                                                                      | [17]  |

**Raccomandazione:** Remotion come motore principale (gratis, tutto in mano a Claude). Submagic Starter solo per i video girati da una persona, dove i sottotitoli automatici fanno risparmiare tempo. CapCut va bene per Francesco se vuole montare a mano dal telefono, usando solo materiali segnati «uso commerciale».

### 3.4 Musica

| Fonte                                            | Uso commerciale                                                                                                    | Limiti                                                                                     | Fonte |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ----- |
| **TikTok Commercial Music Library**              | sì: è l'unica libreria che un account aziendale vede nell'editor di TikTok                                         | solo su TikTok; la maggior parte dei suoni di tendenza non c'è                             | [30]  |
| **Meta Sound Collection** (Instagram e Facebook) | sì, oltre 14.000 brani e suoni senza diritti, anche per gli annunci                                                | solo dentro le app di Meta                                                                 | [31]  |
| **ElevenLabs Music**                             | sì dai piani Starter, Creator e Pro (escluso l'uso «enterprise»); Free solo uso personale; Starter senza streaming | i termini precisi sono nei «Music Terms»                                                   | [3]   |
| **Epidemic Sound**                               | piani Personal, Pro e Business; il Business copre marketing e social                                               | prezzi non verificati sulla pagina ufficiale (le fonti secondarie vanno da 9,99 a 49,99 $) | —     |

**Regola pratica:** se lo stesso file video va su più piattaforme, la musica deve avere una licenza valida ovunque: musica di ElevenLabs (già nel piano Creator) oppure nessuna musica nel file e il brano aggiunto a mano dall'app di ciascuna piattaforma. Mai brani famosi, nemmeno «pochi secondi».

### 3.5 Grafica

**Canva** è già collegata come server MCP: Claude può creare caroselli, copertine dei video e video semplici a modello. Il prezzo non l'ho potuto verificare (la pagina prezzi di Canva rifiuta la lettura automatica, 17/11/2026); non lo conto nel budget perché è già in uso.

### 3.6 Programmazione dei post

| Strumento         | Prezzi                                                                                                                                     | Canali                                                                   | API e MCP                                                                | Fonte |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ----- |
| **Postiz**        | Standard 29 $ (5 canali); Team 39 $ (10); Pro 49 $ (30); annuale 23/31/39 $; prova di 7 giorni; si può anche installare sul proprio server | TikTok, Instagram, YouTube, Facebook, Pinterest e altri                  | API pubblica, server MCP ospitato, CLI e webhook su tutti i piani        | [18]  |
| **Metricool**     | Free (1 marchio); Starter 20 €/mese (fino a 5 marchi; 16 € con pagamento annuale); Advanced da 54 €                                        | TikTok, Instagram, YouTube, Pinterest e Facebook anche nel Free          | MCP su tutti i piani, Free compreso; API con Zapier e Make dall'Advanced | [19]  |
| **Buffer**        | Free (3 canali, 10 post programmati per canale); Essentials 5 $ a canale; Team 10 $ a canale                                               | TikTok (profili Business), Instagram, Shorts, Pinterest, pagine Facebook | API su tutti i piani                                                     | [20]  |
| **Opus Clip Pro** | 29 $                                                                                                                                       | Shorts, TikTok, Instagram, Facebook, Pinterest e altri                   | API di programmazione e MCP                                              | [13]  |

**Raccomandazione:** Postiz Standard. I 5 canali sono esattamente quelli che servono (TikTok, Instagram, YouTube, Facebook, Pinterest) e il server MCP permette a Claude di preparare i post e metterli in coda. Alternativa a costo zero da provare: Metricool Free, che ha già il MCP e i 5 canali; non ho verificato quanti post programmati permette.

**Attenzione:** Claude non pubblica nulla da solo. Prepara i post in bozza su Postiz e Francesco li approva prima della pubblicazione.

### 3.7 Quali strumenti Claude può guidare da solo

| Passo                        | Strumento                     | Claude lo guida?                          |
| ---------------------------- | ----------------------------- | ----------------------------------------- |
| copione, storyboard, testi   | Claude                        | sì                                        |
| voce                         | ElevenLabs API                | sì                                        |
| registrazione schermo        | Playwright (già nel progetto) | sì, dopo lo script proposto al capitolo 8 |
| animazioni e montaggio       | Remotion                      | sì                                        |
| caroselli e copertine        | Canva (MCP già collegato)     | sì                                        |
| scene generate               | Veo (Gemini API)              | sì                                        |
| sottotitoli dei video girati | Submagic API                  | sì, entro i minuti del piano              |
| programmazione               | Postiz (API e MCP)            | sì, in bozza; pubblica Francesco          |
| ripresa con persone          | telefono                      | no                                        |
| montaggio a mano             | CapCut                        | no (nessuna API pubblica)                 |

---

## 4. La filiera consigliata per FamilyNest

### 4.1 Il mix

| Tipo di video                                     | Quota | Filiera   | Esempi                                                           |
| ------------------------------------------------- | ----- | --------- | ---------------------------------------------------------------- |
| Consiglio rapido, «come si fa»                    | 35%   | (b) + (d) | «Scrivi una frase e diventa un impegno», «Chi lo vede: Occupato» |
| Ironia e serie (chat WhatsApp, Esposito)          | 30%   | (d) + (b) | «Il gruppo WhatsApp di famiglia, puntata 4»                      |
| Persona vera (POV, carico mentale, domenica sera) | 35%   | (c) + (b) | «Domenica sera, 5 minuti», «Cose che ho in testa alle 23»        |

È una mia proposta di partenza: il test di 30 giorni (capitolo 7) sposta le quote verso quello che funziona.

**Variante «modello Soldoni»** (capitolo 10): le prime due righe diventano un binario automatico con un video al giorno, 7 a settimana, e i video con persona restano 1–2 a settimana. Il costo degli strumenti non cambia (51 $ al mese); il tempo di Francesco sale a circa 30 minuti di approvazioni a settimana più le riprese. La consiglio come punto di partenza, perché ci dà presto abbastanza video per capire quali formati funzionano.

### 4.2 Da «idea» a «video pubblicato»

| Passo | Chi                | Cosa                                                                                                                                                                                                                              | Tempo (stima)              |
| ----- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 1     | Claude             | **Idee:** 10–20 idee a settimana, da tre fonti: il calendario (scuola, festività, scadenze come il bollo), le funzioni dell'app (`mappa-funzionalita.md`) e i commenti ricevuti. Ogni idea ha formato, gancio e funzione mostrata | 15 min                     |
| 2     | Francesco          | sceglie le idee della settimana in una issue o in un documento condiviso                                                                                                                                                          | 10 min a settimana         |
| 3     | Claude             | **Copione:** gancio (testo a schermo e prima frase), testo della voce (60–80 parole per 30 secondi), inquadrature o schermate, chiusura. Passa dalla skill `testi-naturali`                                                       | 5 min a video              |
| 4     | Claude             | **Storyboard:** una riga per ogni taglio, con secondi, cosa si vede, testo a schermo e voce                                                                                                                                       | inclusa                    |
| 5     | Claude + strumenti | **Materiale:** voce con ElevenLabs; registrazione dello schermo del Nest di prova (Playwright o Francesco); animazioni Remotion; copertina Canva; scene Veo solo se servono                                                       | 5–10 min                   |
| 5bis  | persona            | **Ripresa** (solo per i video (c)): una sessione ogni due settimane, 6–10 video girati in blocco con la lista delle inquadrature preparata da Claude                                                                              | 1,5–2 ore ogni 2 settimane |
| 6     | Claude + strumenti | **Montaggio:** Remotion monta tutto in 9:16, aggiunge sottotitoli (dai tempi della voce o da Submagic), testo, musica con licenza                                                                                                 | 5 min                      |
| 7     | Claude             | **Testi del post:** descrizione per ogni piattaforma, 3–5 hashtag, testo alternativo, etichetta AI da attivare sì o no, link con UTM                                                                                              | 3 min                      |
| 8     | Francesco          | **Approvazione:** guarda il video e lo approva, lo corregge o lo scarta. Controlla in particolare: nessun dato vero, nessun bambino, etichetta AI corretta                                                                        | 3–5 min a video            |
| 9     | Claude             | mette il post in coda su Postiz in bozza, con orario                                                                                                                                                                              | 1 min                      |
| 10    | Francesco          | conferma la pubblicazione (o la affida a Postiz dopo il primo mese, se si fida)                                                                                                                                                   | 1 min                      |
| 11    | Claude             | **Misura:** a 48 ore e a 7 giorni legge i numeri e aggiorna il registro dei test (capitolo 7.3)                                                                                                                                   | 10 min a settimana         |

**Esempio di copione** (formato «Consiglio rapido», 22 secondi):

| Secondi | Si vede                                                             | Testo a schermo                         | Voce                                                                  |
| ------- | ------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------- |
| 0–2     | chat WhatsApp con 31 messaggi non letti                             | «Chi porta Tommaso a calcetto giovedì?» | «Trentuno messaggi per sapere chi porta Tommaso a calcetto.»          |
| 2–8     | si apre FamilyNest, si scrive «Calcetto di Tommaso giovedì alle 17» | «Scrivilo come lo diresti»              | «Scrivilo come lo diresti a voce. FamilyNest lo mette in calendario.» |
| 8–15    | l'impegno appare nella settimana; tocco su «Chi accompagna»         | «Chi accompagna? Lo decidi qui»         | «Scegli chi accompagna. Lo vede tutto il Nest, subito.»               |
| 15–22   | arriva la notifica sul telefono dell'altro adulto                   | «Mandalo a chi deve saperlo»            | «Mandalo a chi giovedì deve ricordarsene.»                            |

I nomi sono di fantasia, come tutti i dati del Nest di prova.

### 4.3 Canali e adattamenti

| Canale          | Ruolo                                                                                                          | Adattamento                                                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instagram Reels | canale principale per il pubblico 25–45 anni (deduzione dal business case, che prevede il test pagato su Meta) | chiusura che invita a mandare il video in privato; caroselli Canva dalle stesse idee                                                                                                           |
| TikTok          | scoperta, ironia                                                                                               | account aziendale: solo musica della Commercial Music Library [30]                                                                                                                             |
| YouTube Shorts  | lunga durata dei video nel tempo, ricerca                                                                      | titolo con le parole cercate («lista della spesa condivisa», «calendario condiviso famiglia»)                                                                                                  |
| Facebook        | genitori sopra i 35 anni, gruppi                                                                               | gli stessi Reels; nei gruppi di genitori solo se l'amministratore lo permette, mai spam                                                                                                        |
| Pinterest       | contenuti da salvare                                                                                           | video e immagini «menu settimanale da stampare» e «lista della spesa da stampare» (1.300 e 210 ricerche al mese su Google, Ubersuggest Italia, 17/11/2026 [48]), con link alla pagina del sito |

Facebook e Pinterest sono il secondo passo: si aggiungono dopo i primi 30 giorni, con gli stessi video, se il tempo di Francesco lo permette.

---

## 5. Regole

### 5.1 Bambini e privacy

- **Nessun bambino vero riconoscibile** nei nostri video: niente volti, niente voci, niente nomi veri, niente divise o zaini con il nome della scuola, niente case riconoscibili. Vale anche per i figli di Francesco e dei creator. In Italia c'è un disegno di legge sulla tutela dei minori nella dimensione digitale (era in esame al Senato a ottobre 2025) e oggi mancano tutele specifiche per i «baby influencer» [29]: per un'app per famiglie la scelta prudente è non mostrarli affatto.
- **Niente bambini generati con l'AI** che sembrino veri: sarebbero contenuti realistici con etichetta obbligatoria [21] e un pessimo messaggio per il marchio.
- **I bambini nei video esistono solo come nomi inventati** nel Nest di prova («Tommaso, calcetto giovedì»).
- **Dati di prova:** famiglia inventata, indirizzi e scuole inventati, nessun dato sanitario (pediatra, allergie, farmaci), come prevede la skill `privacy-e-dati-minori`.
- **Pubblico:** i video parlano agli adulti di casa; negli annunci nessun targeting di minori (già nel business case).
- **Liberatoria** firmata da ogni adulto che appare in video, con l'uso previsto (social organici, annunci, durata).
- **Misura dei risultati senza tracciamento invasivo:** link con UTM e la domanda «come ci hai conosciuto?» alla registrazione. I pixel pubblicitari di Meta o TikTok sul sito richiedono il consenso ai cookie: decisione da prendere con il team legale (skill `legale-privacy`), non in questo documento.

### 5.2 Etichette per i contenuti generati con l'AI

| Dove                                 | Regola                                                                                                                                                                                                                                                                                                                                      | Cosa vuol dire per noi                                                                                               | Fonte                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **TikTok**                           | chi pubblica deve etichettare i contenuti generati o molto modificati con l'AI che mostrano scene o persone realistiche; quelli non etichettati possono essere rimossi, limitati o etichettati da TikTok. TikTok mette l'etichetta da solo quando legge i metadati C2PA (Content Credentials), e l'etichetta automatica non si può togliere | etichetta su video con scene Veo realistiche o voce clonata; non serve su animazioni e registrazioni dello schermo   | [21][22]                                                                      |
| **Instagram e Facebook**             | Meta può chiedere l'etichetta «Informazioni sull'AI» per video fotorealistici o audio realistico creati o modificati digitalmente; tra gli esempi c'è una voce fuori campo AI realistica in un Reel. Possono esserci penalità se non si etichetta                                                                                           | **etichetta su ogni video con voce ElevenLabs**, anche se è la voce clonata di Francesco                             | [23] (letta tramite sintesi di ricerca: la pagina non si legge in automatico) |
| **YouTube**                          | va dichiarato il contenuto realistico alterato o sintetico («Uso dell'AI» in YouTube Studio). Esenti: animazioni non realistiche, aiuto per copioni e sottotitoli, ritocchi estetici e **la clonazione della propria voce per le voci fuori campo**                                                                                         | voce clonata di Francesco: esente su YouTube; scene Veo realistiche: da dichiarare                                   | [24]                                                                          |
| **Unione europea (AI Act, art. 50)** | dal 2 agosto 2026 chi usa l'AI deve dichiarare i deepfake, cioè immagini, audio o video generati o manipolati che sembrano autentici. Sanzioni fino a 15 milioni di euro o al 3% del fatturato mondiale, con proporzionalità per le PMI. Un Codice di buone pratiche (volontario) è uscito il 10 giugno 2026                                | una voce clonata che dice cose mai dette o una scena finta che sembra vera rientrano nel rischio: dichiararle sempre | [25][26][50]                                                                  |
| **AGCOM**                            | gli influencer virtuali, creati con grafica o AI, hanno gli stessi obblighi degli altri                                                                                                                                                                                                                                                     | se un giorno usassimo un avatar, le regole sulla pubblicità valgono anche per lui                                    | [27]                                                                          |

**Regola unica per FamilyNest** (mia proposta, più prudente delle singole piattaforme): ogni video con voce sintetica o scena generata realistica porta l'etichetta della piattaforma e una riga nella descrizione, per esempio «Voce generata con l'AI a partire dalla voce di Francesco». Animazioni e registrazioni dello schermo non ne hanno bisogno. Il test del capitolo 7 misura se l'etichetta abbassa i risultati rispetto alla voce registrata dal vivo.

### 5.3 Musica e diritti

- Gli account aziendali di TikTok vedono solo la Commercial Music Library; usare musica famosa su un account aziendale può portare all'audio silenziato, al post bloccato o a una copertura ridotta [30]. Tornare a un account personale non risolve: un post che promuove un prodotto resta commerciale [30].
- Su Instagram e Facebook, la Sound Collection di Meta è senza diritti e utilizzabile anche negli annunci [31].
- Musica di CapCut: solo i materiali segnati «uso commerciale» [15].
- Musica di ElevenLabs: uso commerciale dai piani a pagamento [3].
- Immagini e video di repertorio: solo da fonti con licenza commerciale (Canva, con i limiti della sua licenza).
- Mai riusare video o copioni di altri creator: si rifà il formato, con idea, riprese e parole nostre (skill `social`).

### 5.4 Pubblicità e creator

- **Riconoscibilità della pubblicità, per tutti:** il Regolamento Digital Chart dell'IAP (parte del Codice di autodisciplina dal 2019) chiede una dicitura ben visibile all'inizio del post, come «Pubblicità», «#adv» o «in collaborazione con»; per i prodotti regalati senza contratto servono diciture come «prodotto inviato da» [28].
- **Influencer rilevanti:** la delibera AGCOM 197/25/CONS (linee guida e codice di condotta, luglio 2025) vale per chi ha almeno 500.000 follower o un milione di visualizzazioni medie al mese su una piattaforma; c'è un elenco pubblico; le sanzioni riportate dalla stampa arrivano a 250.000 € (altre fonti dicono 600.000 €: da verificare sul testo) [27]. I micro creator che pensiamo di coinvolgere sono sotto la soglia, ma devono comunque rispettare il Codice del consumo e la Digital Chart.
- **Contratto con ogni creator** (proposta): #adv in apertura e funzione «partnership pagata» della piattaforma; niente bambini riconoscibili nel video; nessuna promessa che l'app non mantiene (per esempio i calendari collegati prima che siano pronti); dichiarazione di eventuale uso di AI; diritti d'uso del video per gli annunci con durata scritta; approvazione di Francesco prima della pubblicazione.
- **Il prodotto gratis e il premium a vita** dati ai creator (previsti dal business case) sono un vantaggio economico: vanno dichiarati anche quelli.

---

## 6. Costi

### 6.1 Costo mensile degli strumenti

Stima a partire dai prezzi del capitolo 3, mensili, in dollari, IVA esclusa. Mese = 4,3 settimane. Non comprende l'abbonamento a Claude, Canva (già in uso) e i compensi dei creator.

| Voce                                                       | 3 video/settimana (13 al mese) | 5 video/settimana (22 al mese) | 10 video/settimana (43 al mese) | Calcolo                                                                                                    |
| ---------------------------------------------------------- | ------------------------------ | ------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| ElevenLabs Creator (voce, clonazione, musica)              | 22 $                           | 22 $                           | 22 $                            | 121 minuti bastano fino a 43 video (circa 65 minuti, cap. 3.1)                                             |
| Postiz Standard (5 canali)                                 | 29 $                           | 29 $                           | 29 $                            | prezzo fisso                                                                                               |
| Remotion                                                   | 0 $                            | 0 $                            | 0 $                             | gratis fino a 3 persone                                                                                    |
| **Minimo indispensabile**                                  | **51 $**                       | **51 $**                       | **51 $**                        |                                                                                                            |
| Submagic Starter (sottotitoli dei video girati, opzionale) | 19 $                           | 19 $                           | 19 $                            | video girati = 35% del totale: 5, 8 e 15 al mese, entro i 15 del piano                                     |
| Veo 3.1 Fast a 1080p (scene di riempimento, opzionale)     | 6 $                            | 11 $                           | 41 $                            | stima: 1 clip da 8 secondi ogni 2 video a 3 e 5 a settimana, 1 per video a 10 (8 × 0,12 $ = 0,96 $ a clip) |
| **Con gli opzionali**                                      | **circa 76 $**                 | **circa 81 $**                 | **circa 111 $**                 |                                                                                                            |

Con pagamento annuale il minimo scende a circa 41 $ al mese (ElevenLabs: 12 mesi al prezzo di 10, cioè circa 18 $; Postiz 23 $) [1][18].

**Alternativa più economica:** Metricool Free al posto di Postiz (0 €, con il MCP) [19] e la voce registrata da Francesco al posto di ElevenLabs. Il minimo diventa 0 $, ma senza voce clonata ogni video chiede a Francesco qualche minuto di registrazione.

### 6.2 Cosa costerebbe la filiera «tutto AI», per confronto

Stima per 22 video al mese da 30 secondi:

- con Veo 3.1 Fast a 1080p, scene per tutta la durata e il doppio di prove: 22 × 30 × 2 × 0,12 $ = **circa 158 $**, più ElevenLabs;
- con HeyGen: il piano Creator costa 29 $ (600 crediti) [5]; quanti video da 30 secondi coprano i crediti non è scritto sulla pagina.

Costa di più e, per i motivi del capitolo 2.1, rende meno.

### 6.3 Creator

I compensi dei micro creator non li stimo: dipendono dal preventivo di ciascuno. Il business case mette 0–3.000 € l'anno per il social organico, creator compresi, e 1.000 € di TikTok con video di creator nel test a pagamento (`business-case-mercato.md`, 4.4). Per avere un numero vero bastano 5 richieste di preventivo a micro creator italiani di genitorialità.

### 6.4 Tempo delle persone

Stima dai tempi del capitolo 4.2: approvazione 5 minuti a video, scelta delle idee 10 minuti a settimana, una sessione di ripresa ogni due settimane.

| Volume             | Approvazione | Riprese (in media a settimana) | Totale di Francesco a settimana |
| ------------------ | ------------ | ------------------------------ | ------------------------------- |
| 3 video/settimana  | 15 min       | 1 ora                          | circa 1,5 ore                   |
| 5 video/settimana  | 25 min       | 1,5 ore                        | circa 2,5 ore                   |
| 10 video/settimana | 50 min       | 3 ore                          | circa 4,5 ore                   |

A 10 video a settimana le riprese pesano troppo su una persona sola: è il momento di passare parte dei video (c) ai creator.

---

## 7. Piano di prova di 30 giorni

### 7.1 Prima di partire (giorni 1–7)

| Giorno | Cosa                                                                                                                                                                                                                                                     | Chi                                                            |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1      | Account aziendali su TikTok, Instagram (collegato a una pagina Facebook) e YouTube, a nome FamilyNest, con la stessa foto e la stessa riga di presentazione; link al sito con UTM                                                                        | Francesco                                                      |
| 1–7    | **Riscaldamento degli account:** 15 minuti al giorno a guardare, mettere like e commentare video della nicchia, senza pubblicare, finché il feed mostra soprattutto quella nicchia (skill `social`). Si salvano i video da rifare con il nostro prodotto | Francesco                                                      |
| 2      | Nest di prova «famiglia Esposito»: 2 adulti, 2 figli con nomi inventati, una settimana di impegni, spesa, 3 scadenze                                                                                                                                     | Claude prepara i dati, Francesco li inserisce o li fa inserire |
| 2–3    | Francesco registra 30–60 minuti di lettura (testi preparati da Claude) e crea la clonazione professionale su ElevenLabs Creator; scrive la nota di consenso                                                                                              | Francesco                                                      |
| 3–5    | Claude prepara 3 modelli Remotion (consiglio rapido, chat WhatsApp, lista) con i colori del design system, 2 modelli Canva per caroselli, e i primi 10 copioni                                                                                           | Claude                                                         |
| 5      | Postiz in prova gratuita di 7 giorni, con i canali collegati                                                                                                                                                                                             | Francesco                                                      |
| 6–7    | Prima sessione di ripresa: 6 clip per i video (c)                                                                                                                                                                                                        | Francesco o un adulto di casa                                  |

### 7.2 Il test (giorni 8–30)

**Volume:** 5 video a settimana, gli stessi su TikTok, Reels e Shorts, per circa 16 video in totale.

**Cosa si confronta** (una variabile alla volta):

| Settimana | Domanda                                      | Come                                                                                                                       |
| --------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1         | Quale formato funziona?                      | 4 formati diversi: consiglio rapido, chat WhatsApp, POV con persona, prima e dopo della domenica sera                      |
| 2         | Voce vera o voce clonata (con etichetta AI)? | lo stesso copione in due video: uno con la voce registrata di Francesco, uno con la voce clonata, a due giorni di distanza |
| 3         | Quale gancio?                                | i due formati migliori, ciascuno con due ganci diversi                                                                     |
| 4         | Durata                                       | il formato migliore a 15–20 e a 35–45 secondi                                                                              |

Sono pochi video per conclusioni sicure: il risultato è una direzione, non una prova. Si conferma nel mese dopo.

### 7.3 Le metriche

Claude tiene un registro, una riga per video: data, piattaforma, formato, gancio, durata, voce, etichetta AI sì o no, e i numeri qui sotto a 48 ore e a 7 giorni.

| Metrica                                         | Dove si legge                                                               | A cosa serve                                                         |
| ----------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Visualizzazioni a 48 ore                        | statistiche di ogni app                                                     | se il video supera la «soglia» di distribuzione                      |
| Persone che restano dopo i primi 3 secondi      | TikTok e YouTube (grafico di permanenza); statistiche del Reel su Instagram | qualità del gancio                                                   |
| Tempo di visione medio e % di visione completa  | statistiche di ogni app                                                     | qualità del video; confronto con i riferimenti del capitolo 1.3 [34] |
| Invii e condivisioni ogni 1.000 visualizzazioni | statistiche di ogni app                                                     | il segnale più vicino all'invito del secondo adulto                  |
| Salvataggi ogni 1.000 visualizzazioni           | statistiche di ogni app                                                     | utilità del consiglio                                                |
| Nuovi follower ogni 1.000 visualizzazioni       | statistiche di ogni app                                                     | voglia di vedere altro                                               |
| Clic sul link (UTM)                             | analytics del sito                                                          | interesse per il prodotto                                            |
| Nest creati con origine social                  | UTM e domanda «come ci hai conosciuto?» alla registrazione                  | il risultato che conta                                               |
| Nest con il secondo adulto entro 7 giorni       | dati dell'app (aggregati, anonimi)                                          | qualità degli utenti che arrivano dai video                          |

**Soglie di partenza** (dalla skill `social`, che le presenta come regola pratica di chi ha fatto crescere app con i video brevi, non come regole delle piattaforme): un formato «funziona» se la maggior parte dei video supera le 1.000 visualizzazioni a 48 ore e porta clic o registrazioni. Se per una settimana nessun video supera qualche centinaio di visualizzazioni, ci si ferma 2–3 giorni e si cambia formato.

**Decisione al giorno 30:** il formato vincente diventa la maggior parte dei video, uno su cinque resta di prova, si decide il volume (3, 5 o 10 a settimana) e se aggiungere Facebook e Pinterest. Il formato che porta visualizzazioni ma nessun Nest resta per farsi conoscere, ma non è il vincente.

Le cose imparate vanno nella tabella «Cose imparate» di `contesto-prodotto.md`, con stato «da osservare» finché non si ripetono.

---

## 8. Proposte per Francesco e per il team

Non le creo io: le propongo, da trasformare in issue se Francesco è d'accordo.

1. **Script di registrazione dello schermo** con Playwright, per il formato telefono (9:16), sul Nest di prova; da decidere dove vive (`scripts/` o un repository dei contenuti). Lo farebbe il team di sviluppo.
2. **Repository o cartella per i modelli video Remotion**, fuori da `src/`, con i colori e i caratteri del design system.
3. **Domanda «come ci hai conosciuto?»** alla creazione del Nest e lettura dei parametri UTM: va vista con la skill `privacy-e-dati-minori` (solo valori anonimi e aggregati, nessun contenuto).
4. **Nest di prova permanente** per demo e video, separato dai dati veri.
5. **Decisione sul consenso** per la voce clonata di Francesco e sulla liberatoria per chi appare nei video (skill `legale-privacy`).

---

## 9. Video in comune con PartyNest

PartyNest (partynest.it) aiuta i genitori a trovare, confrontare e prenotare sale e servizi per le feste dei bambini in Italia: ricerca per città e numero di bambini, animatori, fotografi, torte, preventivi gratuiti, una guida per organizzare la festa [49]. Il pubblico è lo stesso di FamilyNest (genitori con figli piccoli) e il momento è collegato: la festa è un impegno in calendario, con una lista di cose da fare, una lista della spesa e una lista desideri.

Funzioni di FamilyNest che si legano alle feste (da `mappa-funzionalita.md`): Compleanni e ricorrenze con «Prepara la lista desideri» (G16, idea #387), lista desideri pubblica (decisione D2), Liste multiple e lista «cosa portare» legata a un impegno (C5, C6, idea #378).

| Serie                                          | Idea                                                                                                                     | Cosa mostra FamilyNest                                                                           | Cosa mostra PartyNest                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| **«Il gruppo WhatsApp della festa di classe»** | ironia (sul modello di Cammela [41]): 84 messaggi per decidere regalo, orario e chi porta cosa                           | la lista «cosa portare» con le voci assegnate                                                    | la sala trovata e prenotata in una richiesta |
| **«Conto alla rovescia per la festa»**         | serie a puntate: 4 settimane prima, 2 settimane, 3 giorni, il giorno dopo                                                | compleanno in calendario, cose da fare, spesa                                                    | scelta della sala, preventivi, animatore     |
| **«Quanto costa una festa di compleanno a…»**  | Milano, Roma, Napoli: fasce di prezzo vere prese dalle schede di PartyNest (per esempio una sala a Milano da 280 € [49]) | la scadenza «acconto della sala» con i tre avvisi                                                | prezzi e confronto                           |
| **«Checklist della festa in 60 secondi»**      | lista rapida, in carosello e in video                                                                                    | la lista che si spunta, condivisa tra i due adulti                                               | il link alla guida per organizzare la festa  |
| **«La lista desideri senza doppioni»**         | i nonni regalano due volte lo stesso gioco                                                                               | la lista desideri pubblica (solo nome del figlio, occasione e idee regalo, come da decisione D2) | —                                            |
| **«Un fondatore, due progetti»**               | dietro le quinte: Francesco racconta perché fa entrambe                                                                  | —                                                                                                | —                                            |

**Regole per le feste:** una festa di bambini è il posto dove è più facile riprendere un bambino per sbaglio. Per questa serie si girano solo sale vuote, decorazioni, torte, mani e adulti, oppure si usano animazioni. Le sale partner che forniscono foto devono garantire che non ci siano bambini riconoscibili.

**Come pubblicarli:** account separati per i due marchi e post in collaborazione (su Instagram un post può comparire su due profili). In ogni video un solo invito all'azione, per non dividere l'attenzione.

---

## 10. Il modello Soldoni

Francesco ha indicato come riferimento i video del profilo Instagram di Soldoni (instagram.com/soldoni.app), che descrive come generati in automatico. Questo capitolo raccoglie quello che si può leggere, come probabilmente li producono e come rifare lo stesso metodo per FamilyNest. Non contiene copioni.

### 10.1 Cosa si è potuto leggere e cosa no

| Fonte                                     | Esito (17/11/2026)                                                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profilo Instagram, pagina e sezione Reels | **non leggibile**: risposta «troppe richieste» (429) o pagina di accesso; anche la versione da incorporare non mostra follower, post o didascalie [53]        |
| Visualizzatori esterni di Instagram       | bloccati (403) o senza dati sul profilo                                                                                                                       |
| Profilo TikTok @soldoni.app               | **leggibile** tramite la versione da incorporare: follower, like, elenco dei 10 video con le visualizzazioni [54]. Didascalie, musica e durata non si leggono |
| Singoli video TikTok                      | non leggibili in automatico (la pagina mostra solo il titolo «TikTok»)                                                                                        |
| YouTube e Facebook                        | nessun canale YouTube trovato a nome soldoni.app; la pagina Facebook chiede l'accesso                                                                         |
| Sito soldoni.app e App Store              | leggibili [51][52][55]; il sito non ha link ai social                                                                                                         |
| Articoli o interviste sui video           | nessuno trovato                                                                                                                                               |
| Ubersuggest, dominio soldoni.app, Italia  | nessun dato (dominio troppo nuovo) [56]                                                                                                                       |
| Libreria inserzioni di Meta               | non leggibile in automatico (403)                                                                                                                             |

**Non ho potuto guardare nessun video.** Formati, durata, struttura, voce, musica e stile visivo **non sono leggibili** con gli strumenti a mia disposizione, e non li descrivo per non inventare. Al punto 10.3 c'è una scheda di 20 minuti con cui Francesco, guardando i video dal telefono, raccoglie questi dati; con la scheda compilata il capitolo si completa.

### 10.2 I fatti

**Il prodotto** [51][52][55]

| Voce            | Dato                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Cosa fa         | app di finanza personale: conti, carte, investimenti e contanti in un solo numero, il patrimonio; spese per categoria, avvisi |
| Messaggio       | «Tutto quello che hai, in un'app sola.»                                                                                       |
| Piattaforma     | solo iPhone (App Store, categoria Finanza); il sito non cita Android né il browser                                            |
| Prezzo          | gratis; Premium 5,99 € al mese o 59,99 € all'anno, prova di 7 o 14 giorni                                                     |
| Lingue          | italiano, più inglese, spagnolo, francese e tedesco                                                                           |
| Chi la fa       | uno sviluppatore indipendente (ditta individuale con sede a Benevento)                                                        |
| Età             | versione 0.3.0 del 3 novembre, 0.5.1 di metà novembre 2026: l'app ha circa due settimane                                      |
| Valutazioni     | 5,0 su 5 con 5 valutazioni sull'App Store italiano                                                                            |
| Funzione per AI | un collegamento in sola lettura per Claude, ChatGPT, Grok e Le Chat (pagina /ai)                                              |

Il sito personale dello sviluppatore (in inglese) descrive Soldoni come un'app di finanza personale per i giovani italiani, costruita con React Native, Expo e Supabase, e tra le sue competenze elenca Claude Code, Codex, Playwright, Selenium, scraping e automazione [57].

**Il profilo TikTok** [54], letto la sera del 17/11/2026

- 3 follower, 44 like in totale; presentazione: «Gestisci tutti i tuoi soldi in un'app sola. Scarica gratis Soldoni sullo store» (nell'originale c'è anche un'emoji).
- 10 video, uno al giorno dall'8 al 17 novembre 2026. La data viene dal numero del video: le prime cifre del codice di un video TikTok contengono il momento della pubblicazione (metodo usato da chi studia TikTok, non documentato da TikTok).

| Data (ora italiana) | Visualizzazioni |
| ------------------- | --------------- |
| 8/11, 23:20         | 5               |
| 9/11, 14:56         | 4               |
| 10/11, 19:20        | 920             |
| 11/11, 19:30        | 896             |
| 12/11, 20:18        | 257             |
| 13/11, 18:43        | 288             |
| 14/11, 20:41        | 264             |
| 15/11, 19:58        | 264             |
| 16/11, 19:36        | 251             |
| 17/11, 19:01        | 244             |

Totale: 3.393 visualizzazioni in 10 giorni, 44 like (circa 1,3 like ogni 100 visualizzazioni), 3 follower.

**Su Instagram:** numero di follower, di post e visualizzazioni non disponibili. Si leggono aprendo il profilo da un account qualsiasi; per seguirli nel tempo servirebbe uno strumento di analisi dei concorrenti a pagamento (per esempio quelli di Metricool o di Socialinsider), che non uso.

### 10.3 La lettura dei numeri e cosa manca

**La mia lettura** (deduzioni, non fatti):

- **Il loro vantaggio è la costanza; i risultati non ci sono ancora.** Un video al giorno, ogni giorno, dalla prima settimana di vita dell'app, quasi sempre tra le 19 e le 21. Per uno sviluppatore da solo vuol dire che il costo di un video in più è vicino a zero.
- **Su TikTok non è ancora esploso nulla.** Dopo i primi due video quasi invisibili (pubblicati a orari diversi, forse con l'account appena aperto), due video arrivano a circa 900 visualizzazioni e gli altri sei si fermano tra 244 e 288. Un valore così stabile fa pensare alla distribuzione minima che TikTok dà a ogni video di un account nuovo, senza che nessuno abbia «sfondato». 3 follower su 3.393 visualizzazioni dicono che chi guarda non ha motivo di tornare.
- **Quali video funzionano meglio:** su TikTok i video del 10 e dell'11 novembre, con più del triplo delle visualizzazioni degli altri. Il perché non si può dire senza guardarli: può essere il formato, il gancio, l'argomento o il fatto che fossero i primi distribuiti. È la prima domanda della scheda qui sotto.
- **Instagram può andare meglio di TikTok**, ed è possibile che Francesco abbia scelto Soldoni per questo. Non lo posso verificare.

Il modello da copiare oggi è quindi il **metodo di produzione**, non un risultato provato. Dopo 10 video i numeri di TikTok sono quelli di un account che parte da zero.

**Scheda di osservazione per Francesco** (circa 20 minuti dal telefono, sui 10 video più recenti di Instagram e sui due video TikTok del 10 e 11 novembre). Una riga per video:

| Cosa annotare      | Opzioni                                                                                           | Perché serve                 |
| ------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------- |
| Durata             | secondi                                                                                           | durata dei nostri modelli    |
| Primi 2 secondi    | testo scritto a schermo, parola per parola; cosa si vede                                          | il tipo di gancio            |
| Immagini           | schermate dell'app / grafica animata / video di repertorio / avatar che parla / immagini generate | quale filiera usano (10.4)   |
| Voce               | nessuna / sintetica / umana; maschile o femminile; sempre la stessa?                              | se usano una sintesi vocale  |
| Musica             | nome del suono in basso; «suono originale» o brano noto                                           | licenza e tipo di audio      |
| Testo a schermo    | sottotitoli parola per parola o frasi intere; stesso carattere e stessi colori in tutti i video?  | se usano un modello fisso    |
| Chiusura           | invito («scarica», «commenta», «salva») o nessuno                                                 | il funnel                    |
| Etichette visibili | «Contenuto generato con l'AI», «Informazioni sull'AI», link «CapCut · Prova questo modello»       | indizi certi sugli strumenti |
| Numeri             | visualizzazioni, like, commenti, condivisioni; follower del profilo e numero di post              | quali formati funzionano     |
| Didascalia         | lunghezza, hashtag, domanda al pubblico                                                           | come scrivono il post        |

Con la scheda compilata (anche una foto degli appunti) aggiorno questo capitolo e chiudo i punti «non leggibile».

### 10.4 Come probabilmente li producono

**Indizi certi**

| Indizio                                                                                                       | Fonte     |
| ------------------------------------------------------------------------------------------------------------- | --------- |
| Francesco li descrive come generati in automatico                                                             | Francesco |
| Un video al giorno per 10 giorni, dalla prima settimana dell'app                                              | [54]      |
| Una sola persona dietro il prodotto                                                                           | [51]      |
| Lo sviluppatore usa Claude Code e Codex, sa automatizzare il browser (Playwright, Selenium) e scrive in React | [57]      |
| L'app è fatta con React Native ed Expo, quindi gira anche nel simulatore iPhone sul computer                  | [57]      |
| Orari di pubblicazione variabili di circa due ore (18:43–20:41)                                               | [54]      |

**Deduzioni** (da verificare con la scheda del punto 10.3)

| Passo                 | Ipotesi più probabile                                                                                                                                                                                                   | Perché                                                                                            | Alternativa                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Idee e copione        | un modello linguistico (Claude o ChatGPT) che scrive gancio, testo e didascalia da un elenco di temi                                                                                                                    | usa già questi strumenti; è il passo più facile da automatizzare                                  | idee scritte a mano, il resto automatico                |
| Immagini              | schermate o registrazioni dell'app dal simulatore, con dati inventati, oppure grafica generata da un modello                                                                                                            | un'app di numeri si mostra bene con schermate e cifre; lo sviluppatore automatizza già il browser | video di repertorio o immagini generate                 |
| Voce                  | sintesi vocale (ElevenLabs, OpenAI o simili) oppure nessuna voce, solo testo e musica                                                                                                                                   | un solo autore che pubblica ogni giorno difficilmente registra la voce ogni volta                 | voce registrata una volta e riusata                     |
| Montaggio             | un modello fisso riempito in automatico: Remotion (scritto in React, come la sua app), ffmpeg, Creatomate, oppure un modello CapCut                                                                                     | stesso orario e stessa cadenza fanno pensare a un processo ripetuto, non a un montaggio a mano    | montaggio rapido a mano su CapCut                       |
| Pubblicazione         | video preparati in blocco e caricati ogni sera, a mano o con un programmatore che varia l'orario                                                                                                                        | un programmatore senza variazione pubblica allo stesso minuto; qui l'orario cambia fino a due ore | programmatore con orario casuale (alcuni lo permettono) |
| Archetipo del formato | uno di questi tre, comuni tra le app che pubblicano video automatici: (1) testo grande su sfondo e musica, a slide; (2) gancio di 2–3 secondi poi demo dell'app; (3) voce che racconta un numero o un caso, con grafica | sono i formati che si producono in serie senza persone (cap. 1.1, fonte [45])                     | una persona generata (avatar) che presenta l'app        |

Un indizio certo che Francesco può trovare in un minuto: su TikTok, i video fatti con un modello CapCut mostrano in basso il link «CapCut · Prova questo modello»; i video con l'etichetta «Contenuto generato con l'AI» messa da TikTok sono stati fatti con strumenti che scrivono i metadati C2PA nel file [22].

### 10.5 Come replicarlo per FamilyNest

Il livello di automazione di Soldoni si raggiunge con la filiera (b) + (d) del capitolo 2, cioè schermo dell'app più animazioni, che è già nella filiera consigliata. Cambia il ritmo: un video automatico **ogni giorno**, come Soldoni, invece di due su tre.

**La filiera**

| Passo                | Soldoni (deduzione)         | FamilyNest                                                                                                                    | Strumento e costo                     |
| -------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Temi                 | elenco di temi sui soldi    | elenco di temi di casa preparato una volta al mese: calendario scolastico, scadenze (bollo, revisione), spesa, chi accompagna | Claude, 0 $                           |
| Copione e didascalia | modello linguistico         | Claude, 7 copioni a settimana in un colpo; passano da `testi-naturali`                                                        | Claude, 0 $ in più                    |
| Immagini             | schermate dal simulatore    | registrazione del Nest di prova «famiglia Esposito» con Playwright in formato telefono (script da chiedere al team, cap. 8)   | Playwright, 0 $                       |
| Voce                 | sintesi vocale o nessuna    | voce clonata di Francesco o voce pronta della libreria                                                                        | ElevenLabs Creator, 22 $              |
| Montaggio            | modello fisso               | 3–4 modelli Remotion con i colori del design system, a rotazione; sottotitoli dai tempi della voce                            | Remotion, 0 $ (fino a 3 persone [16]) |
| Musica               | non leggibile               | musica di ElevenLabs già nel file, oppure nessuna musica (cap. 3.4)                                                           | inclusa in ElevenLabs                 |
| Pubblicazione        | ogni sera tra le 19 e le 21 | Postiz in bozza; Francesco approva il blocco della settimana in una volta sola                                                | Postiz Standard, 29 $                 |
| Misura               | non leggibile               | registro del capitolo 7.3, letto a 48 ore e a 7 giorni                                                                        | Claude, 0 $                           |

**Costo mensile** (stima, 30 video automatici al mese, prezzi del capitolo 3):

| Voce                                                                    | Costo      | Calcolo                                                            |
| ----------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------ |
| ElevenLabs Creator                                                      | 22 $       | 30 video × 30 secondi × 3 tentativi = circa 45 minuti, entro i 121 |
| Postiz Standard                                                         | 29 $       | prezzo fisso                                                       |
| Remotion, Playwright, Canva                                             | 0 $        | gratis o già in uso                                                |
| **Totale**                                                              | **51 $**   | **circa 41 $ con pagamento annuale** [1][18]                       |
| Veo, solo per qualche scena senza persone (opzionale)                   | circa 15 $ | stima: 15 clip da 8 secondi a 0,12 $ al secondo                    |
| Submagic, solo se si aggiungono video girati da una persona (opzionale) | 19 $       | capitolo 3.3                                                       |

Il tempo di Francesco: 10 minuti a settimana per scegliere i temi e circa 3 minuti a video per approvare, cioè circa 30 minuti a settimana (stima). Prima della partenza servono il Nest di prova, la clonazione della voce e lo script di registrazione (capitolo 7.1 e 8).

**Cosa adattiamo rispetto a Soldoni**

| Tema              | Soldoni                       | FamilyNest                                                                                                                                                                    |
| ----------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pubblico          | giovani italiani [57], TikTok | genitori e coppie tra 30 e 45 anni: Instagram e Facebook prima di TikTok (cap. 4.3)                                                                                           |
| Orario            | 19–21                         | ipotesi da provare: pausa pranzo (13) e dopo che i figli sono a letto (21:30). Nessun dato per ora                                                                            |
| Approvazione      | non nota, forse nessuna       | Francesco approva ogni video prima della pubblicazione: per un'app di famiglia un errore (un dato vero, un bambino in un'immagine generata) costa più di un giorno senza post |
| Bambini           | non pertinente                | mai bambini veri o generati che sembrino veri; i figli esistono solo come nomi inventati nel Nest di prova (cap. 5.1)                                                         |
| Etichetta AI      | non leggibile                 | ogni video con voce sintetica porta l'etichetta su Instagram e Facebook e una riga nella descrizione; su YouTube la propria voce clonata è esente (cap. 5.2)                  |
| Musica            | non leggibile                 | con la pubblicazione automatica non si scelgono i suoni dentro le app: la musica va nel file con licenza commerciale (ElevenLabs) oppure il video esce senza musica           |
| Varietà           | non leggibile                 | almeno 3 modelli a rotazione: Instagram dichiara di premiare i contenuti originali [35] e un modello sempre uguale rischia di sembrare ripetitivo (deduzione)                 |
| Insistenza        | un video al giorno            | il ritmo vale per i nostri post, non per le notifiche dell'app: nessuna serie di giorni o promemoria insistenti per chi guarda (skill `privacy-e-dati-minori`)                |
| Prodotto mostrato | un numero (il patrimonio)     | una funzione vera per video, mostrata su una scena di casa riconoscibile, con l'invito a mandare il video all'altro adulto (cap. 1.3)                                         |

**Il test** (si aggiunge al capitolo 7): per 14 giorni un video automatico al giorno, più i video con persona già previsti. Il riferimento è Soldoni: se i video automatici restano sotto le 300 visualizzazioni a 48 ore per due settimane, come i suoi su TikTok, si cambia modello o gancio prima di aumentare il volume.

---

## Fonti

Tutte consultate il 17/11/2026. Le fonti segnate «secondaria» non sono la pagina ufficiale dello strumento o dell'ente.

1. ElevenLabs, prezzi: https://elevenlabs.io/pricing
2. ElevenLabs, clonazione professionale della voce: https://elevenlabs.io/docs/product-guides/voices/voice-cloning/professional-voice-cloning
3. ElevenLabs Music, licenze: https://elevenlabs.io/music
4. ElevenLabs, API di sintesi vocale (pagina italiana): https://elevenlabs.io/it/text-to-speech-api
5. HeyGen, prezzi: https://www.heygen.com/pricing
6. Synthesia, prezzi: https://www.synthesia.io/pricing
7. Runway, prezzi: https://runway.com/pricing
8. Veo 3.1, prezzi dell'API (secondaria, cita la pagina di Google letta l'11/09/2026): https://benchlm.ai/media-pricing/veo ; pagina di Google (sezione Veo non trovata nel testo letto): https://aistudio.google.com/docs/pricing
9. Google, prezzi di Gemini TTS: https://aistudio.google.com/docs/pricing
10. OpenAI, modelli e API dismessi (Sora 2, 24/09/2026): https://developers.openai.com/api/docs/deprecations
11. Kling, prezzi (secondaria): https://www.eesel.ai/en/blog/kling-ai-pricing
12. Submagic, prezzi: https://www.submagic.co/pricing
13. Opus Clip, prezzi: https://www.opus.pro/pricing
14. Descript, prezzi: https://www.descript.com/pricing
15. CapCut, prezzi: https://www.capcut.com/pricing ; licenza dei materiali: https://www.capcut.com/clause/material-license-agreement
16. Remotion, licenza e prezzi: https://www.remotion.dev/docs/license/pricing.md
17. Creatomate, prezzi: https://creatomate.com/pricing
18. Postiz, prezzi: https://postiz.com/pricing
19. Metricool, prezzi: https://metricool.com/it/prezzi/
20. Buffer, prezzi: https://buffer.com/pricing
21. TikTok, linee guida della community, integrità e autenticità: https://www.tiktok.com/community-guidelines/en/integrity-authenticity
22. Etichette automatiche di TikTok con C2PA (secondarie): https://www.mediapost.com/publications/article/395950/tiktok-to-label-ai-content-using-external-metadata.html ; https://fortune.com/2024/05/09/tiktok-deepfakes-ai-labels-content-credentials-adobe/
23. Meta, come riconoscere i contenuti AI (letta tramite sintesi di ricerca): https://www.meta.com/help/artificial-intelligence/1783222608822690/
24. YouTube, dichiarazione dei contenuti alterati o sintetici: https://support.google.com/youtube/answer/14328491
25. Commissione europea, regole di trasparenza dell'AI Act: https://digital-strategy.ec.europa.eu/it/factpages/quick-facts-transparency-rules-ai-systems
26. Commissione europea, Codice di buone pratiche sulla trasparenza: https://digital-strategy.ec.europa.eu/it/faqs/signing-code-practice-transparency-ai-generated-content
27. AGCOM, delibera 197/25/CONS sugli influencer (secondarie): https://www.agendadigitale.eu/mercati-digitali/nasce-lelenco-influencer-i-motivi-di-una-svolta-per-la-categoria/ ; https://www.altroconsumo.it/hi-tech/internet-telefono/news/influencer-agcom ; https://www.corrierecomunicazioni.it/digital-economy/regolamento-influencer-agcom-cosa-cambia-per-influencer-e-brand/ ; allegato operativo AGCOM: https://www.agcom.it/sites/default/files/media/allegato/2026/Allegato_B_operativo_influencer.pdf
28. IAP, Regolamento Digital Chart: https://www.iap.it/wp-content/uploads/2020/06/Regolamento-Digital-Chart.pdf
29. Il Post, regole sui baby influencer (17/10/2025): https://www.ilpost.it/2025/10/17/regolamentazione-baby-influencer/
30. Commercial Music Library di TikTok (secondaria, venditore di musica): https://www.soundstripe.com/blogs/why-can-i-only-use-commercial-sounds-on-tiktok
31. Sound Collection di Meta (secondaria): https://musicbusinessworldwide.com/meta-offers-royalty-free-music-library-to-instagram-reels-advertisers
32. TikTok for Business, Creative Codes: https://ads.tiktok.com/business/library/Creative_Codes_ENG.pdf ; guida agli annunci video: https://ads.tiktok.com/business/en/guides/video-advertising-guide
33. Buffer, analisi di 2,7 milioni di Reels: https://buffer.com/resources/instagram-reels-length
34. Retensis, riferimenti di permanenza 2026 (fornitore di analisi): https://retensis.com/blog/audience-retention-benchmarks-2026
35. SocialPilot, algoritmo dei Reels (secondaria): https://www.socialpilot.co/blog/instagram-reels-algorithm ; https://creatorflow.so/blog/instagram-algorithm/
36. Motherly, Libby Ward: https://mother.ly/news/viral-trending/motherhood-makes-you-less-fun/
37. Motherly, il carico mentale delle madri su TikTok: https://www.mother.ly/news/tiktok-mom-mental-load-of-motherhood/
38. Motherly, ChatGPT per i genitori: https://mother.ly/news/viral-tiktok-chatgpt-for-parents/
39. Laura Danger: https://dailydot.com/new-mom-laundry-red-flag ; https://www.today.com/parents/moms/end-supermom-stereotype-laura-danger-rcna96468 ; https://www.buzzsprout.com/1997303/episodes/12400310-sharing-the-mental-load-with-laura-danger
40. The Bump, consigli di un papà (aprile 2023): https://www.thebump.com/news/dad-tips-solo-parenting
41. Avvenire, Cammela e il gruppo delle mamme WhatsApp: https://www.avvenire.it/famiglia/battute-e-ironia-cammela-e-il-gruppo-delle-mamme-whatsapp_80139
42. Influenxer, mamme famose sui social: https://www.influenxer.it/influencer/chi-sono-le-mamme-diventate-famose-sui-social/
43. ilLibraio, madri che raccontano con ironia: https://www.illibraio.it/news/ebook-e-digitale/madri-ironia-social-libri-1292153/
44. Skylight: `concorrenti.md`, fonti 36–39 (MediaPost, DesignRush, Shorty Awards, Modash)
45. Postiz, slideshow automatici per TikTok (fornitore dello strumento): https://postiz.com/blog/automate-tiktok-slideshow-marketing-ai-agents-postiz
46. YouGov, fiducia nelle pubblicità fatte con l'AI (Australia, maggio 2026): https://yougov.com/articles/54818-45-of-australians-say-ai-generated-ads-would-make-them-trust-a-brand-less
47. IAB e Sonata, studio sui consumatori e l'AI generativa (gennaio 2026): https://www.tubefilter.com/2026/01/15/iab-generative-ai-protocol-consumer-study
48. Ubersuggest (account di Francesco), Italia, lingua italiana, 17/11/2026: suggerimenti per «carico mentale», «menu settimanale», «lista della spesa»
49. PartyNest: https://partynest.it
50. Agenda Digitale, deepfake e articolo 50 dell'AI Act: https://www.agendadigitale.eu/sicurezza/deepfake-lue-chiude-i-giochi-dichiarare-lai-o-sparire/
51. Soldoni, sito: https://soldoni.app
52. Soldoni su App Store Italia (valutazioni, prezzi, cronologia delle versioni): https://apps.apple.com/it/app/id6822234055
53. Instagram, profilo soldoni.app (risposta 429 e pagina di accesso; versione da incorporare senza dati): https://www.instagram.com/soldoni.app
54. TikTok, profilo @soldoni.app nella versione da incorporare (follower, like, visualizzazioni dei 10 video), letto la sera del 17/11/2026: https://www.tiktok.com/embed/@soldoni.app ; profilo: https://www.tiktok.com/@soldoni.app
55. Soldoni, pagina del collegamento con gli assistenti AI: https://soldoni.app/ai
56. Ubersuggest (account di Francesco), panoramica del dominio soldoni.app, Italia, lingua italiana, 17/11/2026: nessun dato
57. Sito personale dello sviluppatore di Soldoni (progetti e competenze): https://www.stefanozarro.com/en
