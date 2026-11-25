# Proposta · Come portare FamilyNest negli store: A (web impacchettata) o B (app nativa a parte)

Agente infrastruttura, 25/11/2026, per la #397. Solo analisi: nessun codice cambiato. Decide Francesco.

## Sintesi e raccomandazione

1. **Consiglio l'opzione A:** la stessa app web dentro un guscio Capacitor 8, con parti native vere: sblocco con Face ID e impronta, notifiche push native, vibrazione, widget «Oggi», collegamenti che aprono l'app.
2. **Perché:** le pagine A1–A23 si scrivono una volta sola. Il design di Fable è già pensato come un'app. Il guscio costa circa 20–28 giorni di lavoro degli agenti su una corsia a parte, contro le 10–14 settimane di B. Con B anche ogni pagina futura (B8–B23) si scriverebbe due volte.
3. **Store:** Apple rifiuta le app che sono «un sito ripacchettato» (linea guida 4.2). Con le funzioni native qui sopra e lo stile da app che FamilyNest ha già, il rischio è basso, ma va messo in conto un possibile rifiuto da correggere.
4. **Tempi:** se la corsia nativa parte dopo F5 (#506) e corre in parallelo alle pagine, le app sono pronte da inviare 1–2 settimane dopo la fine delle pagine di lancio (ondata 10). Google aggiunge 14 giorni di prova chiusa con 12 tester, che si possono sovrapporre allo sviluppo.
5. **Costi ricorrenti:** da 0 a circa 19 $ al mese per le build iPhone su un Mac nel cloud. Le notifiche push di Apple e Google sono gratuite.
6. **Via intermedia:** si parte con A e, solo se i dati lo chiedono, si riscrivono in nativo una o due schermate molto usate (Oggi, Aggiungi). B resta una scelta da rivalutare dopo il lancio, non da fare ora.
7. **Da Francesco servono subito tre decisioni:** nome e dominio definitivi, logo (oggi in pausa) e i testi di informativa e termini (A24). Senza questi le schede degli store non si chiudono.

## Da dove parto: lo stato reale

Ho verificato queste cose sul codice di `main` al 25/11/2026 (commit `a2c7d0b`):

- L'app è **Next.js 16 con le pagine generate dal server**: componenti server, `cacheComponents`, 17 rotte del server (`route.ts`), azioni del server in 10 file, accesso con i cookie (`@supabase/ssr`). Conta molto per la scelta: queste pagine **non si possono copiare dentro l'app** come file statici. Il guscio deve caricare le pagine da Vercel, come fa il browser.
- L'accesso con Apple e Google c'è già (`src/lib/auth/oauth.ts`), come la mail con password, che è la strada principale.
- Il design per il telefono (`docs/design/telefono/`) prevede già le funzioni da app: sblocco (`scelte-p7/sc1-03…06`), widget (`pagine-mancanti-p7/mn1-44`, `mn1-45`), notifiche push (`mn1-36…40`) e installazione (`mn1-41…43`). La tabella «Web da telefono» (`docs/design/computer/web-da-telefono/note.md`) elenca dodici differenze tra app installata e browser.
- Il piano #501 mette F7 (app installabile e offline, #148) nell'ondata 6 e F8 (push, #508) nell'ondata 8. Il suo default 3 dice già che Face ID, widget e vibrazione su iPhone arrivano con le app negli store.

## Le opzioni in una tabella

|                                   | **A · Web impacchettata (Capacitor)**                                     | **B · App nativa a parte (Expo / React Native)**                             | **Via intermedia**                        |
| --------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------- |
| Schermate                         | Quelle del web, scritte una volta                                         | Riscritte tutte in React Native                                              | Web, più 1–2 schermate native             |
| Sensazione al tocco               | Buona, se le pagine sono fatte bene; non identica al nativo               | Nativa: scorrimenti, gesti e transizioni del sistema                         | Nativa dove conta di più                  |
| Face ID, push, vibrazione, widget | Sì, con i plugin e un po' di codice nativo per il widget                  | Sì, con i moduli Expo                                                        | Sì                                        |
| Offline                           | Quello di F7, più una copia di «Oggi» salvata dal guscio                  | Pieno, ma va costruito da zero                                               | Come A                                    |
| Lavoro in più                     | 20–28 giorni-agente, su una corsia separata                               | 10–14 settimane, più il doppio per ogni pagina futura                        | A + circa 5–8 giorni per schermata nativa |
| Aggiornamenti                     | Le pagine si aggiornano subito, come il sito; il guscio passa dagli store | Ogni cambio passa dagli store, oppure dagli aggiornamenti a distanza di Expo | Come A                                    |
| Rischio con Apple (4.2)           | Basso o medio: servono le funzioni native                                 | Bassissimo                                                                   | Basso                                     |
| Costo ricorrente                  | 0–19 $ al mese                                                            | 19 $ al mese, poi 199 $ con molti utenti                                     | Come A                                    |

## Opzione A · La stessa app web dentro un guscio

### Quale strumento

Consiglio **Capacitor** (versione 8, uscita a dicembre 2025; l'ultima minore è la 8.5 di luglio 2026). È mantenuto da Ionic e ha plugin per tutto quello che ci serve: biometria, push, vibrazione e un ponte verso i widget. Le alternative pesano meno:

- **TWA (Trusted Web Activity) per Android:** è il modo più semplice per mettere una PWA su Google Play, ma non dà né widget né sblocco, e su iPhone non esiste.
- **PWABuilder per iPhone:** è un guscio minimo, esposto al rifiuto 4.2.
- **Tauri 2 mobile:** promettente, ma per noi è meno maturo.

### Come funzionerebbe

Il guscio contiene una piccola pagina locale (caricamento, «senza rete», errore). Poi apre l'indirizzo di produzione su Vercel. Le funzioni native si chiamano da un solo modulo in `src/lib/`, che sul web non fa nulla. Così le pagine restano identiche e il browser non cambia.

Nota tecnica, da verificare nel prototipo: la documentazione di Capacitor dice che caricare un indirizzo esterno con `server.url` «non è pensato per la produzione», perché nasce per lo sviluppo. Molte app lo fanno comunque. Il modo pulito è quello descritto qui sopra: una pagina locale che poi naviga verso il nostro dominio, con la navigazione chiusa al solo dominio dell'app.

### 1. Che cosa ottiene l'utente

- **Al tocco:** l'app si apre a tutto schermo, con l'icona e lo splash nativo, che passa la mano allo splash in dissolvenza di F6 senza stacchi. Le pagine sono quelle del web. Il design di Fable e la skill `mobile-native` le fanno già sembrare un'app: barra in basso, fogli, risposta immediata al tocco. Resta qualche differenza dal nativo vero, per esempio nel tornare indietro con il gesto su iPhone e nello scorrimento di liste molto lunghe.
- **Prestazioni:** le stesse del sito sul telefono. La prima apertura dipende dalla rete, perché le pagine arrivano da Vercel. Le riaperture sono rapide grazie alla cache di F7.
- **Funzioni native:** sblocco con Face ID o impronta, notifiche push affidabili anche su iPhone e senza aggiungere l'icona alla Home, vibrazione leggera su iPhone, widget «Oggi» piccolo e medio, collegamenti (invito, conferma della mail, lista desideri) che aprono l'app e non il browser, foglio di condivisione del telefono.
- **Offline:** quello previsto da F7, cioè la copia delle ultime letture e la coda «In attesa di connessione». Da verificare nel prototipo: su iPhone, dentro un'app, il service worker funziona solo se l'app dichiara i propri domini («App-Bound Domains»). Come rete di sicurezza, il guscio può salvare in locale l'ultima giornata di «Oggi»: è lo stesso dato che serve al widget.

### 2. Lavoro in più per il team e come cambia #501

Le pagine A1–A23 **non cambiano**. Si aggiunge una corsia «nativa», che lavora su file nuovi (`ios/`, `android/`, configurazione di Capacitor) e su un solo modulo in `src/lib/`. Quindi non si scontra con le pagine. Si scontra solo con i lavori `shared/*`, perché tocca `src/lib/` e il guscio, e va messa in fila con loro.

| Voce nuova                                                                                                    | Giorni-agente | Note                                                                    |
| ------------------------------------------------------------------------------------------------------------- | ------------: | ----------------------------------------------------------------------- |
| **N0** · Prototipo: guscio, accesso con Apple e Google, cookie di sessione, offline nell'app                  |           2–3 | Serve a dire sì o no prima di spendere il resto                         |
| **N1** · Guscio vero: icone, splash nativo, barra di stato, aree sicure, tasto indietro Android, collegamenti |           4–6 | Sui collegamenti servono i file di associazione sul dominio definitivo  |
| **N2** · Push native (Apple APNs, Google FCM) accanto alle push web di F8                                     |           3–4 | Costa poco se F8 e DB-2 prevedono da subito i tre tipi di apparecchio   |
| **N3** · Sblocco con viso o impronta e vibrazione                                                             |           2–3 | Le schermate ci sono già (`sc1-03…06`)                                  |
| **N4** · Widget «Oggi» per iPhone (SwiftUI) e Android                                                         |           5–8 | È l'unico pezzo scritto in Swift e Kotlin: è la voce con più incertezza |
| **N5** · Build automatiche nel cloud, schede degli store, invio e correzioni dopo la revisione                |           3–4 | Più i tempi di attesa degli store (vedi sotto)                          |
| **Totale**                                                                                                    |     **19–28** | Una sola corsia, in parallelo alle pagine                               |

Serve anche un passaggio di configurazione su `admin/*`, che fa Francesco in una sessione di manutenzione, di 1–2 giorni: un prefisso di branch per la corsia nativa (per esempio `nativo/*`), le regole degli hook e di `guard.yml` per le cartelle nuove e l'esclusione di quei branch dalle anteprime in `vercel.json`. Servono inoltre l'approvazione dei pacchetti nuovi (`@capacitor/*` e i plugin, ARCHITETTURA §2) e una skill di progetto per il codice nativo.

### 3. Tempi per arrivare negli store

Ipotesi dichiarate:

- una pagina M richiede circa 1 giorno-agente dalla specifica al merge, una L circa 2, una S mezzo giorno;
- 3 pagine in parallelo con un'efficienza intorno al 70%, un solo lavoro `shared/*` alla volta;
- gli agenti lavorano su Linux e **non possono avviare un simulatore iPhone**: le build iPhone girano su un Mac nel cloud, e le prove con Face ID e widget sul telefono vero le fa Francesco, con TestFlight;
- nessun blocco di Francesco oltre a quelli elencati più sotto.

Stima:

- **Le pagine di lancio** (A1–A25 e B1–B6), con il peso del piano #501, valgono circa 38 giorni-pagina: con 3 in parallelo, circa **3,5–4 settimane** dopo le fondamenta.
- **La corsia nativa** (19–28 giorni) corre insieme. Se parte subito dopo F5 è finita più o meno quando finiscono le pagine.
- **Google:** il tuo account personale, se è stato creato dopo il 13/11/2023, richiede una **prova chiusa con almeno 12 tester per 14 giorni di fila** prima della pubblicazione. Sono giorni di calendario, non di lavoro: si fanno partire appena N1 gira, e così si sovrappongono.
- **Apple:** la revisione di solito richiede da 1 a 3 giorni. Va messo in conto un rifiuto con correzione: 3–5 giorni in più.

Risultato: **app pronte da inviare 1–2 settimane dopo la fine dell'ondata 10**. Se invece la corsia nativa parte solo dopo la fine del web: circa 5–7 settimane dopo.

### 4. Approvazione negli store

**Apple, linea guida 4.2 (funzionalità minima).** Il testo dice che l'app deve avere «funzioni, contenuti e interfaccia che la portino oltre un sito ripacchettato», e la 4.2.2 esclude le app fatte soprattutto di «ritagli di web» o di raccolte di link. Apple non fissa un numero minimo di funzioni native: giudica l'insieme. Per essere accettati serve:

- **un'interfaccia da app**, senza barre o pulsanti da browser e senza pagine pensate per il computer: il design di Fable lo è già;
- **funzioni native che servono davvero:** push, sblocco, widget, vibrazione, condivisione, offline. Consiglio di inviare la prima versione con tutte queste, widget compreso: è il segnale più forte;
- **le note per il revisore**, con un account di prova con dati (il Nest di Marco e Laura) e l'elenco delle funzioni native e di dove trovarle;
- **la 4.8 (accesso):** chi offre l'accesso con Google deve offrire anche un accesso equivalente che protegge la privacy. Sign in with Apple c'è già: va bene;
- **la 5.1.1(v):** l'account si deve poter cancellare dall'app. È A19 (#552). In più, chi usa Sign in with Apple quando cancella un account deve revocare il collegamento con Apple: va scritto in DB-4 (#513) e A19;
- **niente pagamenti digitali fuori dagli acquisti in app**, tranne negli Stati Uniti. Oggi Plus è rimandato, quindi va bene. Quando arriva Plus, nell'app degli store bisogna usare gli acquisti di Apple e Google, oppure non vendere nell'app: è da decidere prima di Plus;
- **figli e minori:** FamilyNest non va nella categoria Kids, perché è un'app per genitori. Quindi nel nome, nel sottotitolo, nelle immagini e nella descrizione non si scrive «per bambini» (linea guida 2.3.8). Serve però un'informativa che copra i dati dei minori (5.1.4): quella di A24.

**Google Play.** Servono la prova chiusa di 14 giorni con 12 tester (se l'account è personale e recente), il modulo «Sicurezza dei dati», la classificazione dei contenuti, l'informativa e il livello Android richiesto: dal 31/08/2026 le app nuove devono puntare ad Android 16 (API 36).

**Requisiti tecnici annuali:** dal 28/04/2026 Apple accetta solo app compilate con Xcode 26 e il kit di iOS 26, e Google alza il livello ogni agosto. Sono 1–2 giorni di manutenzione all'anno per ciascuna opzione.

### 5. Costi ricorrenti (senza gli account)

| Voce                                                              |        Oggi |        Beta |      Lancio | 1.000 famiglie | 10.000 famiglie |
| ----------------------------------------------------------------- | ----------: | ----------: | ----------: | -------------: | --------------: |
| Build iPhone su Mac nel cloud (GitHub Actions o Capawesome Cloud) |         0 $ |      0–19 $ |      0–19 $ |         0–19 $ |          0–19 $ |
| Push Apple (APNs) e Google (FCM)                                  |         0 $ |         0 $ |         0 $ |            0 $ |             0 $ |
| Aggiornamenti a distanza                                          |         0 $ |         0 $ |         0 $ |            0 $ |             0 $ |
| Vercel e Supabase                                                 | come il web | come il web | come il web |    come il web |     come il web |

Note:

- **Build iPhone:** servono macOS. Con GitHub Actions i minuti macOS sono gratuiti se il repository è pubblico; su un repository privato pesano 10 volte i minuti normali e finiscono presto. In quel caso l'alternativa è Capawesome Cloud (dal sito: da 19 $ al mese con le build su Mac). Il servizio di Ionic (Appflow) non accetta più clienti nuovi dal febbraio 2025.
- **Aggiornamenti a distanza:** con A non servono. Le pagine arrivano già aggiornate da Vercel e passa dagli store solo il guscio, poche volte l'anno.
- **Plugin:** si scelgono quelli con licenza libera (MIT). Alcuni fornitori ne vendono versioni a pagamento: da evitare, se non servono.

### 6. Rischi

- **Dipendenza dalla rete e da Vercel:** se Vercel non risponde, l'app si apre solo sulla copia offline, come il web installato. Rimedio: la pagina locale del guscio e la copia di «Oggi».
- **Rifiuto 4.2:** si riduce con le funzioni native nella prima versione e con buone note per il revisore.
- **Codice nativo senza la rete di test abituale:** Playwright non prova il widget né lo sblocco. Servono prove scritte per Francesco su TestFlight e una piccola suite nativa nella CI.
- **Ponte tra pagine e funzioni native:** le pagine web possono chiamare il telefono. Quindi i plugin vanno tenuti al minimo, la navigazione chiusa al nostro dominio e le intestazioni di protezione (già presenti) severe. Va sentito l'agente `sicurezza` prima di N1.
- **Accesso con Google:** Google non permette il suo accesso dentro una vista web incorporata. Il login con Google e Apple si apre nella finestra di sistema e torna all'app con un collegamento: è da provare in N0.
- **Aggiornamenti dei sistemi:** ogni anno iOS e Android cambiano. Sono pochi giorni all'anno, e Capacitor in genere esce in tempo (la 8.5 è uscita apposta per i kit nuovi di Apple).

### 7. Cosa servirebbe da Francesco

Vale anche per B, tranne le voci segnate.

**Decisioni, prima di N1:**

1. **Nome definitivo e dominio.** L'identificativo dell'app negli store (per esempio `me.familynest.app`) non si cambia più dopo la prima pubblicazione. Può restare generico anche se il nome cambia, ma i collegamenti che aprono l'app vanno legati al dominio definitivo.
2. **Logo e icona** (oggi in pausa): servono un'icona da 1024 px e lo splash.
3. **Testi di informativa e termini** (A24, oggi bloccati): servono gli indirizzi pubblici delle pagine.
4. **iPad e tablet:** consiglio «solo telefono» al lancio, perché il tablet non è disegnato.

**Nei pannelli** (ti scriveremo i passi esatti quando servono, uno per uno):

- **Apple (App Store Connect e Certificates):**
  - creare l'identificativo dell'app con le capacità Push, Sign in with Apple, Associated Domains e App Groups (per il widget);
  - creare la chiave per le push (file `.p8`) e la chiave API di App Store Connect per le build automatiche;
  - caricarle solo come segreti di GitHub, mai in file o messaggi.
- **Apple (scheda dello store):** nome, sottotitolo, descrizione, parole chiave, categoria (consiglio Stile di vita o Produttività), schermate iPhone 6,9", indirizzi di assistenza e informativa, questionario sulla privacy («etichette nutrizionali»), questionario sull'età, account di prova per il revisore, dichiarazione di «commerciante» per l'Unione Europea (se sei commerciante, indirizzo e telefono diventano pubblici) e dichiarazione sulla cifratura (basta «solo HTTPS»).
- **Google (Play Console):**
  - creare l'app;
  - attivare la firma gestita da Google;
  - creare un account di servizio per le build automatiche;
  - creare un progetto Firebase per le push Android;
  - compilare «Sicurezza dei dati», classificazione dei contenuti e scheda;
  - **trovare 12 tester** (parenti o amici con un telefono Android) per 14 giorni di fila.
- **Verifica:** il tuo account Google sviluppatore è personale o di un'organizzazione, e quando è stato creato? Da questo dipendono i 14 giorni.

**Durante lo sviluppo:** provare sul tuo iPhone con TestFlight Face ID, widget e notifiche, con una lista di prove scritta da noi.

### 8. Dove inserirlo nel piano #501

| Voce   | Aspetta                                                                    | Ondata indicativa |
| ------ | -------------------------------------------------------------------------- | ----------------- |
| **N0** | F5 guscio e navigazione (#506)                                             | dopo l'ondata 4   |
| **N1** | F6 splash (#507), F7 offline (#148), A20 accesso (#553), A22 invito (#555) | ondate 6–7        |
| **N2** | F8 push (#508) e DB-2 (#511)                                               | ondata 8          |
| **N3** | F6 (#507)                                                                  | ondate 7–8        |
| **N4** | A1 Oggi (#534) e DB-5 (#514)                                               | ondate 8–9        |
| **N5** | A19 (#552), A24 (#147), B1–B6, logo e nome                                 | dopo l'ondata 10  |

Tre accorgimenti da chiedere **subito** al coordinatore. Costano poco ora e molto dopo:

1. **In DB-2 (#511) e F8 (#508):** l'elenco degli apparecchi che ricevono le push deve prevedere tre tipi (push web, Apple, Google), non solo la push web con le chiavi VAPID.
2. **In F7 (#148):** il formato della copia locale di «Oggi» va pensato in modo che il widget possa riusarlo. La regola di LEZIONI vale anche qui: i dati sul telefono si cancellano a ogni uscita, compresi quelli del widget.
3. **In F4a (#503) o in un lavoro condiviso:** una funzione unica per la vibrazione (per esempio «conferma» ed «errore»), che sul web non fa nulla. Così le pagine la chiamano già e il guscio la accende.

## Opzione B · App nativa scritta a parte (Expo / React Native)

### Quale strumento

**Expo** (SDK 58, ottobre 2026), con Expo Router e i servizi di build EAS. I widget sono ufficiali dall'SDK 56 (`expo-widgets`). Per iPhone sono stabili. Per Android la documentazione delle ultime versioni è meno chiara: è da verificare.

### 1. Che cosa ottiene l'utente

- **Al tocco:** il meglio possibile. Scorrimenti, gesti per tornare indietro, tastiera e transizioni sono quelli del sistema.
- **Prestazioni:** apertura più rapida e indipendente dalla rete, perché le schermate sono dentro l'app.
- **Funzioni native:** tutte, con moduli Expo già pronti: biometria, notifiche, vibrazione, widget.
- **Offline:** completo, ma tutto da costruire: copia dei dati, coda delle modifiche e riconciliazione.

### 2. Lavoro in più per il team e come cambia #501

È quasi un secondo progetto. Si riusano Supabase con le sue regole di sicurezza, i tipi generati del database e la parte di logica pura in `src/lib/` (date, testi, regole di visibilità). Il resto va rifatto:

- **Il design system per il telefono in React Native:** è l'equivalente di F2–F6, circa 10 giorni in fila. Niente CSS: componenti e stili diversi, e il designer deve rifare la guida dei componenti.
- **Uno strato di servizi:** le 17 rotte e le azioni del server lavorano con i cookie del browser. L'app nativa ha bisogno di chiamate con il proprio token, oppure di funzioni del database: 6–10 giorni tra lavoro condiviso e lavoro sul database.
- **Le pagine A1–A25 e B1–B6 riscritte:** circa 38 giorni-pagina, più un 30% perché gli agenti e i controlli sono rodati sul web. Con 3 in parallelo sono circa 5 settimane.
- **Test da rifare:** Playwright non prova le app native. Servono un altro strumento (per esempio Maestro), nuovi riferimenti visivi su simulatore e build nella CI: circa 5 giorni.
- **Hook, CI e skill:** oggi sono pensati per il web e vanno estesi in `admin/*`: 3–5 giorni.
- **Dopo:** ogni pagina del piano «dopo il lancio» (B8–B23) e ogni correzione si fanno due volte, su web e su nativo, con due revisioni e due serie di test.

### 3. Tempi per arrivare negli store

Con le stesse ipotesi di A: **10–14 settimane** di lavoro degli agenti. Una parte può correre in parallelo al web, ma contende le stesse corsie (`shared/*` e database). Più i 14 giorni di Google e la revisione di Apple. In pratica le app arrivano negli store **2–3 mesi dopo il web**, oppure il web rallenta.

### 4. Approvazione negli store

Il rischio 4.2 praticamente sparisce. Restano tutti gli altri punti descritti per A: 4.8 accesso, 5.1.1(v) cancellazione dell'account, pagamenti, minori, modulo di Google, prova chiusa e livelli annuali.

### 5. Costi ricorrenti (senza gli account)

| Voce                                             | Oggi | Beta | Lancio | 1.000 famiglie | 10.000 famiglie |
| ------------------------------------------------ | ---: | ---: | -----: | -------------: | --------------: |
| EAS (build, e aggiornamenti a distanza se usati) |  0 $ | 19 $ |   19 $ |           19 $ |           199 $ |
| Push Apple e Google                              |  0 $ |  0 $ |    0 $ |            0 $ |             0 $ |

Note:

- **Il piano gratuito di EAS** comprende 15 build Android e 15 iPhone. Agli agenti, che fanno molte prove, non bastano: serve almeno Starter (19 $ al mese più l'uso, con 45 $ di credito incluso).
- **Gli aggiornamenti a distanza** (Expo Update) sono gratuiti fino a 1.000 utenti attivi al mese, Starter arriva a 3.000 e Production (199 $ al mese) a 50.000. Con 10.000 famiglie, cioè circa 15–20.000 adulti, servirebbe Production, oppure si rinuncia agli aggiornamenti a distanza e si passa ogni volta dagli store.

### 6. Rischi

- **Manutenzione doppia:** è il rischio maggiore. Due interfacce da tenere uguali al design, e il pericolo che web e app si comportino in modo diverso.
- **Regole copiate:** LEZIONI dice già che le regole di visibilità copiate in due posti divergono. La sicurezza resta nel database (regole di accesso e funzioni `security definer`), ma la logica dell'interfaccia (cosa si mostra di un impegno «Solo io») andrebbe scritta due volte.
- **Aggiornamenti:** circa tre SDK di Expo all'anno, ciascuno con un piccolo lavoro di aggiornamento.
- **Team:** il modello attuale (pagine in worktree, Playwright, riferimenti visivi) va rifatto per una seconda piattaforma.

### 7. Cosa servirebbe da Francesco

Le stesse cose di A, in più la scelta del piano EAS e un account Expo.

### 8. Dove inserirlo nel piano #501

Avrebbe senso solo **dopo il lancio web completo** (dopo l'ondata 10), come progetto a parte con il suo piano. Partire prima toglierebbe le corsie condivise alle pagine.

## La via intermedia

Esistono due forme. Consiglio la prima, se un giorno servirà.

1. **A, con poche schermate native («ibrido a isole»):** si parte con A e, se i dati della beta mostrano che una schermata molto usata non è abbastanza fluida (per esempio Oggi o il foglio «Nuovo impegno»), solo quella si riscrive in nativo dentro il guscio. Costa circa 5–8 giorni a schermata e si decide con i numeri in mano.
2. **Guscio Expo con le pagine web dentro:** Expo permette di inserire componenti web dentro un'app nativa (`"use dom"`), con la navigazione nativa intorno, e di sostituirli uno alla volta. Il limite per noi: funziona bene con componenti React del browser, mentre le nostre pagine sono generate dal server. Andrebbero caricate come pagine web in più viste separate, con due sistemi di navigazione da tenere d'accordo. È più complesso di A e il guadagno è piccolo.

## Privacy: dati dei minori e dati sul telefono (vale per tutte le opzioni)

Da far controllare all'agente `legale-privacy` e all'agente `sicurezza` prima di N1:

- **Cosa resta sul telefono:**
  - la copia offline e il widget contengono nomi e impegni della famiglia, anche dei figli. Si salva il minimo, nello spazio protetto del sistema, e si cancella a ogni uscita e alla cancellazione dell'account;
  - nel widget gli impegni privati restano «Sei occupato» (già nel design, `mn1-45`), e sulla schermata bloccata il widget nasconde i dettagli.
- **Notifiche sulla schermata bloccata:** per impostazione predefinita senza nomi dei figli né dettagli. Il design li prevede già come «contenuti nascosti» (B2).
- **Face ID e impronta:** FamilyNest non riceve mai il dato del viso o dell'impronta, che resta nel telefono. Lo sblocco è un cancello locale: la sicurezza vera resta la sessione sul server. Da «Apparecchi» (A19) si deve poter chiudere la sessione e togliere la push di un telefono perso.
- **Fornitori nuovi:** Apple (APNs) e Google (FCM, Firebase) trattano i dati delle notifiche. Vanno nell'informativa e nel registro dei trattamenti. Su iPhone si può inviare direttamente ad Apple, senza Firebase.
- **Schede degli store:**
  - le «etichette» privacy di Apple e il modulo di Google devono dire esattamente cosa raccogliamo;
  - nessuna libreria di statistiche o di pubblicità di terzi;
  - il file della privacy che Apple chiede per l'app e per le librerie (`PrivacyInfo.xcprivacy`).

## Fonti

Consultate il 25/11/2026.

- Apple, App Store Review Guidelines (4.2, 4.8, 5.1.1, 1.3, 5.1.4, 2.5.6, 3.1.1): https://developer.apple.com/app-store/review/guidelines/
- Apple, requisiti minimi degli SDK (Xcode 26 e iOS 26 SDK da aprile 2026): https://developer.apple.com/news/upcoming-requirements/
- Google Play, requisito di test per i nuovi account personali (12 tester, 14 giorni): https://support.google.com/googleplay/android-developer/answer/14151465
- Google Play, livello di API richiesto (API 36 dal 31/08/2026): https://developer.android.com/google/play/requirements/target-sdk
- Ionic, annuncio di Capacitor 8 (dicembre 2025): https://ionic.io/blog/announcing-capacitor-8
- Ionic, Capacitor 8.5 (luglio 2026): https://ionic.io/blog/capacitor-8-5-released
- Capacitor, configurazione (`server.url` «non pensato per la produzione»): https://capacitorjs.com/docs/config
- Capawesome, plugin Biometrics per Capacitor: https://capawesome.io/docs/blog/announcing-the-capacitor-biometrics-plugin/
- Capgo, plugin WidgetKit per Capacitor: https://capgo.app/docs/plugins/widget-kit/getting-started/
- Capgo, chiusura di Ionic Appflow ai clienti nuovi: https://capgo.app/blog/appflow-shutdown-alternative/
- Capawesome, alternative ad Appflow e prezzi di Capawesome Cloud: https://capawesome.io/blog/alternative-to-appflow/
- Next.js, limiti dell'esportazione statica (niente azioni del server): https://nextjs.org/docs/app/guides/static-exports
- Expo, listino di EAS: https://expo.dev/pricing
- Expo, widget (`expo-widgets`): https://docs.expo.dev/versions/latest/sdk/widgets/
- Expo, componenti web dentro l'app (`"use dom"`): https://docs.expo.dev/guides/dom-components/
- Guide di terze parti sul 4.2 per le app con vista web (orientative, non ufficiali): https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper/ e https://capgo.app/blog/how-to-pass-app-store-review-2026/

Le stime in giorni-agente sono mie, con le ipotesi scritte sopra. Il piano #501 non registra ancora i tempi reali delle pagine: dopo le prime pagine dell'ondata 5 conviene ricalcolarle.
