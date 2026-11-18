# Trillo: un promemoria che un adulto manda a un altro

Stratega, 18/11/2026. Risponde alla domanda 63 delle risposte di Francesco del 18/11/2026 (commento in #444): «Citofono per ora non c'è. Lo stratega lo ristudi come «trillo»: un promemoria manuale che un utente manda a un altro, quasi un messaggio.» Riprende l'idea «Citofona» di #384 e la riga M1 di `mappa-funzionalita.md`.

## Riassunto

1. **Ha senso, in forma piccola.** Un trillo è un tocco: «Ricordati il latte», «Sono arrivato», «Chiamami». Non è una chat e non deve diventarlo.
2. **Perché non WhatsApp:** il trillo si attacca alle cose del Nest (la voce della spesa, l'impegno, la cosa da fare) e si chiude con un tocco («Preso», «Ok»). Su WhatsApp lo stesso messaggio si perde nel gruppo e nessuno sa se è stato fatto.
3. **Concorrenti:** Google (Broadcast e Family Bell) e Amazon (Annunci) lo fanno sugli altoparlanti; Cozi con messaggi via sms o mail; Apple con «Check In» per l'arrivo, ma usa la posizione. Le app di famiglia italiane puntano sulla chat (Mimko) o sui messaggi rapidi (Famigliario). Nessuno lega il messaggio alla voce della spesa o all'impegno.
4. **Forma consigliata:** otto messaggi pronti, testo libero di 80 caratteri al massimo, tre risposte rapide, legame con spesa, cose da fare e impegni. Solo tra adulti con account, senza posizione e senza «visualizzato».
5. **Rischi principali:** troppe notifiche e testo leggibile sullo schermo bloccato. Proposta: limite di invio, rispetto delle ore di silenzio, testo libero nascosto sul blocco schermo.
6. **Piano e fase:** base (gratuito), dopo il lancio, insieme alle notifiche push (X4). Senza push il trillo non serve: arriverebbe solo quando si apre l'app.
7. **Dipendenza tecnica:** su iPhone una web app riceve notifiche solo se è stata aggiunta alla schermata Home (iOS 16.4 o successivo). Il trillo è un buon motivo per chiederlo.

## 1. Che cos'è

Un adulto del Nest tocca «Manda un trillo», sceglie a chi (una persona o tutti gli adulti) e un messaggio pronto, oppure scrive una riga. All'altro arriva una notifica; risponde con un tocco. Dopo 24 ore il trillo sparisce.

Cosa non è: una chat, un gruppo, un posto dove mandare foto o vocali, un modo per sapere dove si trova qualcuno.

## 2. Casi d'uso

Esempi costruiti sulla famiglia D'Angelo del mockup. Sono ipotesi da verificare con le chiacchierate di `traccia-interviste.md`, non dati.

| Situazione                                             | Trillo                         | Legato a                     | Risposta rapida                 |
| ------------------------------------------------------ | ------------------------------ | ---------------------------- | ------------------------------- |
| Laura è al supermercato, Marco vede che manca il latte | «Ricordati il latte»           | voce «Latte» della Spesa     | «Preso» (la voce si spunta)     |
| Marco esce dal lavoro                                  | «Sto arrivando»                | —                            | «Ok»                            |
| Laura arriva a casa della nonna con i bimbi            | «Sono arrivata»                | impegno «Pranzo dalla nonna» | «Ok»                            |
| Serve parlare, ma non è urgente                        | «Chiamami quando puoi»         | —                            | «Ti chiamo tra poco»            |
| Ritiro a scuola                                        | «Ricordati Tommaso alle 16:30» | impegno «Uscita da scuola»   | «Ci sono io»                    |
| Bolletta in scadenza                                   | «Ricordati il bollo dell'auto» | scadenza «Bollo auto»        | «Fatto» (la scadenza si chiude) |
| Cena pronta (era la «Citofona» di #384)                | «A tavola»                     | —                            | «Arrivo»                        |
| Coinquilini                                            | «Tocca a te la spazzatura»     | cosa da fare «Spazzatura»    | «Fatto»                         |

Quattro casi su otto si chiudono dentro l'app: la risposta spunta la voce o la cosa da fare. È quello che WhatsApp non può fare.

## 3. Perché dentro FamilyNest e non su WhatsApp

| Cosa                      | WhatsApp                                             | Trillo in FamilyNest                                           |
| ------------------------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| Dove finisce il messaggio | nel gruppo, tra foto, vocali e messaggi della scuola | sulla cosa a cui si riferisce (la voce della spesa, l'impegno) |
| Sapere se è fatto         | qualcuno deve rispondere a parole                    | «Preso» o «Fatto» spunta la voce, tutti lo vedono              |
| Scriverlo                 | aprire la chat, scrivere                             | un tocco dalla voce della spesa o dall'impegno                 |
| Cosa resta dopo           | tutto, per sempre                                    | niente: sparisce dopo 24 ore                                   |
| Chi lo riceve             | tutto il gruppo, anche chi non c'entra               | una persona o gli adulti del Nest                              |

**Lettura:** il trillo non deve competere con WhatsApp come mezzo per parlare. Funziona solo dove porta un vantaggio che WhatsApp non ha: il legame con le cose e la chiusura con un tocco. Il messaggio libero serve per i casi senza legame, ma è secondario. La raccomandazione di #384 resta valida: nessuna chat di famiglia.

## 4. Cosa fanno i concorrenti

Dati raccolti il 18/11/2026. Dove la fonte è vecchia, lo scrivo.

| Prodotto                       | Cosa fa                                                                                                                                              | Fonte                                                                                                                                                                                                                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Assistant (Broadcast)   | «Hey Google, di' alla famiglia…»: messaggio vocale a tutti gli altoparlanti di casa e ai telefoni del gruppo famiglia, che possono rispondere a voce | [Engadget, maggio 2021](https://www.engadget.com/google-assistant-broadcast-family-group-family-bell-171222716.html), [Neowin, 2021](https://www.neowin.net/news/google-announces-new-family-focused-assistant-features/). Non ho verificato se funziona allo stesso modo con Gemini per la casa. |
| Google Assistant (Family Bell) | promemoria a orario fisso, come una campanella, su più dispositivi; testo fino a 80 caratteri                                                        | [BGR, 2021](https://bgr.com/tech/google-assistant-new-features-family-broadcast-bell-songs/), [Digital Trends](https://digitaltrends.com/?p=2693682)                                                                                                                                              |
| Amazon Alexa (Annunci)         | «Alexa, annuncia…»: messaggio a tutti gli Echo di casa; salta i dispositivi con «Non disturbare»                                                     | [AFTVnews, 2018](https://www.aftvnews.com/?p=28308), [documentazione Amazon](https://developer.amazon.com/docs/acm/announcements-acm.html)                                                                                                                                                        |
| Cozi                           | «Cozi Messages»: messaggio breve via sms o mail a tutta la famiglia                                                                                  | [Wikipedia, Cozi Central](https://en.wikipedia.org/wiki/Cozi_Central)                                                                                                                                                                                                                             |
| Apple Messaggi (Check In)      | avvisa un contatto quando arrivi; se tardi, condivide posizione e percorso. Richiede la posizione e iOS 17                                           | [Tom's Guide](https://www.tomsguide.com/news/ios-17-check-in-explained-heres-how-the-new-safety-feature-works), [MacStories](https://www.macstories.net/stories/ios-17s-check-in-feature-simplifies-making-sure-friends-and-family-get-home-safely/)                                              |
| Life360                        | check-in con la posizione, chat del gruppo, avvisi di arrivo automatici                                                                              | [TechJunkie](https://techjunkie.com/requestcheck-in-life360), [TechCrunch, 20/08/2025](https://techcrunch.com/2025/08/20/life360-adds-a-new-no-show-notification-to-its-app)                                                                                                                      |
| TimeTree                       | chat per ogni calendario, per tutti dal 10/2022                                                                                                      | [TimeTree Newsroom, 27/10/2022](https://timetreeapp.com/intl/en/newsroom/2022-10-27/calendar-chat-update)                                                                                                                                                                                         |
| FamilyWall                     | chat privata di famiglia; avvisi di arrivo e partenza con la posizione nel premium                                                                   | [Toolguide](https://toolguide.io/en/tool/familywall/index.md), [supporto FamilyWall](https://support.familywall.com/en/support/solutions/articles/47001239196-what-is-included-in-familywall-premium-)                                                                                            |
| Mimko (Italia)                 | chat di famiglia                                                                                                                                     | `concorrenti.md`, 14/11/2026                                                                                                                                                                                                                                                                      |
| Famigliario (Italia)           | messaggi rapidi                                                                                                                                      | `concorrenti.md`, 14/11/2026                                                                                                                                                                                                                                                                      |

**Lettura:**

- Il bisogno esiste: Google e Amazon hanno costruito proprio questa funzione per le famiglie. Ma sta sugli altoparlanti, e quindi parla a chi è in casa, non a chi è fuori.
- Le app di famiglia scelgono la chat (TimeTree, FamilyWall, Mimko) o la posizione (Life360, Apple). La chat rifà WhatsApp, la posizione crea problemi di privacy.
- Nessuno dei prodotti che ho visto lega il messaggio alla voce della spesa o all'impegno e lo chiude con un tocco. Non ho provato le app una per una: la verifica si fa scaricandole.

## 5. Rischi

| Rischio                      | Cosa può succedere                                                           | Cosa proponiamo                                                                                                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Troppe notifiche             | un adulto ne riceve dieci in un'ora, spegne tutte le notifiche di FamilyNest | lo stesso trillo alla stessa persona al massimo una volta ogni 10 minuti; un interruttore «Trilli» tra le notifiche (oggi sono cinque, diventano sei); nessun sollecito automatico se non si risponde     |
| Ore di silenzio              | trillo alle 23 che sveglia                                                   | rispetta le ore di silenzio di chi riceve (proposta: 22–7, modificabili); il trillo arriva al mattino. Niente pulsante «urgente» che le scavalca: per le urgenze c'è il telefono                          |
| Testo sullo schermo bloccato | «Ricordati la visita di Sofia» letto da un collega                           | i messaggi pronti si vedono interi (sono generici); il testo libero sul blocco schermo appare come «Trillo da Laura», con un'impostazione personale per mostrarlo. Mai nomi dei figli nei messaggi pronti |
| Pressione tra adulti         | «l'hai visto e non hai risposto»                                             | niente «visualizzato» né spunte di lettura; chi manda vede solo la risposta, se arriva                                                                                                                    |
| Minori                       | un figlio riceve o manda trilli                                              | solo adulti con account. I figli non hanno account (#444, domanda 12); quando l'avranno, si rivaluta con l'agente legale-privacy                                                                          |
| Posizione                    | «Sono arrivata» diventa tracciamento                                         | «Sono arrivata» è manuale, mai automatico. Nessuna posizione, nessun geofence. Se un giorno ci sarà l'arrivo automatico, è una decisione a parte (#383)                                                   |
| Conservazione                | archivio di messaggi privati                                                 | il trillo si cancella dopo 24 ore, come proposto per Citofona in #384. Negli analytics solo l'evento anonimo (`trill_sent`, `trill_replied`), mai il testo                                                |
| Abuso tra adulti             | un adulto usa i trilli per controllare l'altro                               | il limite di invio, l'assenza di «visualizzato» e l'interruttore per spegnere i trilli in ogni momento                                                                                                    |
| La notifica non arriva       | su iPhone la web app riceve notifiche solo se aggiunta alla schermata Home   | al primo trillo spiegare come aggiungerla, in un foglio con due immagini. Senza notifiche il trillo compare comunque in Oggi                                                                              |

Verifica con la skill `privacy-e-dati-minori`: nessun dato nuovo dei figli, isolamento per Nest (un trillo va solo ad adulti dello stesso Nest), nessun contenuto nei log o negli analytics, cancellazione dopo 24 ore. Nessuna meccanica che crea dipendenza: niente serie di giorni, niente contatori, niente classifiche.

**Fonte sulle notifiche web su iPhone:** [WebKit, «Web Push for Web Apps on iOS and iPadOS»](https://webkit.org/?p=13878) e [MacRumors, 16/02/2023](https://www.macrumors.com/2023/02/16/ios-16-4-web-push-notifications/): da iOS 16.4 le notifiche web funzionano solo per le web app aggiunte alla schermata Home, e il permesso si chiede dopo un tocco dell'utente.

## 6. La forma consigliata

### Messaggi pronti

Otto, in tre gruppi. Si possono rivedere dopo un mese guardando quali si usano (conteggio anonimo per messaggio pronto, mai il testo libero).

| Gruppo    | Messaggi                                                             |
| --------- | -------------------------------------------------------------------- |
| Ricordati | «Ricordati [voce o impegno]» (si compila da solo dal legame)         |
| Dove sono | «Sto arrivando» · «Sono arrivato» / «Sono arrivata» · «Faccio tardi» |
| Parliamo  | «Chiamami quando puoi» · «Mi chiami?»                                |
| Casa      | «A tavola» · «Mi serve una mano»                                     |

«Sono arrivato» e «Sono arrivata» sono due messaggi distinti e li sceglie chi manda: così non serve chiedere il genere nel profilo, un dato in più che non ci serve.

**Testo libero:** una riga, al massimo 80 caratteri (lo stesso limite di Family Bell di Google). Basta per «Prendi anche il pane se passi», non basta per una conversazione.

### Risposte rapide

Tre, più una che dipende dal legame:

- «Ok» · «Arrivo» · «Non posso»
- con una voce della Spesa: «Preso» (spunta la voce)
- con una cosa da fare o una scadenza: «Fatto» (la chiude)
- con un impegno: «Ci sono io» (diventa «chi lo porta», se il campo è vuoto)

Niente risposta libera: chi vuole parlare usa il telefono o WhatsApp.

### Legame con le cose del Nest

| Da dove si manda        | Come                                                                |
| ----------------------- | ------------------------------------------------------------------- |
| Voce della Spesa        | tieni premuto o tocca «…» › «Ricordalo a…»                          |
| Cosa da fare / scadenza | «Ricordalo a…» nel dettaglio                                        |
| Impegno                 | «Ricordalo a…» nel dettaglio, propone chi accompagna o chi riprende |
| Oggi                    | bottone «Trillo» vicino ad «Aggiungi», per i messaggi senza legame  |

### Nome e testi

- **Nome:** «Trillo» è italiano, corto, e richiama lo squillo al telefono («fammi uno squillo»). Su Google Italia «trillo» ha 1.600 ricerche al mese, quasi tutte informative (Ubersuggest, Italia, 18/11/2026): non c'è un prodotto che lo occupa. App con nomi vicini trovate sul web: l'app di Trillo Parrucchieri (Noceto) e «Trilli» di Dylog per la fidelizzazione. Nessun marchio «Trillo» trovato, ma non ho potuto consultare UIBM ed EUIPO: va controllato con l'agente legale-privacy.
- **Verbo:** «Manda un trillo». Notifica: «Laura: Ricordati il latte» (messaggio pronto) oppure «Trillo da Laura» (testo libero nascosto).

## 7. Piano e fase

| Domanda          | Proposta                                                                    | Perché                                                                                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gratuito o Plus  | **base, gratuito**                                                          | Più trilli vuol dire più adulti attivi nello stesso Nest, che è l'obiettivo del business case. Metterlo in Plus taglierebbe proprio chi deve ancora convincersi. Costo per noi: solo le notifiche. |
| Quando           | **dopo il lancio, nella stessa uscita delle notifiche push (X4)**           | Senza push il trillo arriva solo quando si apre l'app, e allora tanto vale WhatsApp.                                                                                                               |
| Prima versione   | messaggi pronti, testo libero, tre risposte rapide, legame con la Spesa     | La Spesa è il caso più frequente e il più facile da mostrare.                                                                                                                                      |
| Seconda versione | legame con cose da fare, scadenze e impegni; «Ci sono io»                   | Dipende dagli impegni con creatore, assegnatario, chi accompagna e chi riprende (#444, domanda 11).                                                                                                |
| Fuori            | chat, foto, vocali, posizione, trilli ai figli, trilli a nonni e babysitter | Nonni e babysitter si valutano con #392.                                                                                                                                                           |

**Angolo promozionale:** il calendario dei rilasci di `mappa-funzionalita.md` aveva per Citofona «il messaggio che arriva su tre telefoni». Per il trillo propongo: «Ricordati il latte. Preso.» Un video di 10 secondi per Instagram e TikTok: Marco tocca la voce, il telefono di Laura vibra al supermercato, lei tocca «Preso», la voce si spunta su tutti i telefoni.

## 8. Ha senso?

**Sì, a tre condizioni:**

1. arriva solo insieme alle notifiche push;
2. resta piccolo: niente chat, niente posizione, niente «visualizzato»;
3. si misura e si toglie se non serve.

**Come si misura (dopo 4 settimane):**

- quota di Nest con almeno due adulti che mandano almeno un trillo a settimana;
- quota di trilli con una risposta;
- quota di trilli legati a una cosa del Nest;
- quanti adulti spengono l'interruttore «Trilli».

Le soglie per tenerlo o toglierlo non le fisso adesso: senza dati sarebbero numeri inventati. Si decidono con Francesco dopo le prime 4 settimane.

**Se non lo facessimo:** perdiamo poco al lancio. Ma il trillo legato alla spesa è una delle poche funzioni che si spiegano in un video di 10 secondi, ed è gratuito: per il marketing vale più di quanto costa.

## Domande per Francesco

1. Confermi base (gratuito) e uscita insieme alle notifiche push? Consiglio: sì.
2. Il testo libero c'è dalla prima versione, o solo i messaggi pronti? Consiglio: sì, 80 caratteri, nascosto sul blocco schermo.
3. Ore di silenzio predefinite 22–7? Consiglio: sì, modificabili da ciascuno.
