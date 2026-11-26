# Decisioni dei Passi 12–16 (domande 177–211)

> Archiviato il 26/11/2026. Le cartelle citate qui (per esempio `calendario/`) sono le aree del passaggio: le tavole stanno in `docs/design/computer/<area>-p12-16/` e in `docs/design/telefono/<area>-p12-16/`; `tavolozza.md` è `docs/design/tavolozza.md`. Le decisioni di Francesco sono riprese in `docs/mockup/DECISIONI.md` (D7).

Fonti:

- **Testo delle domande**: indice del primo canvas («FamilyNest: nuovo design», https://claude.ai/artifact/8VKqAujpP3P8TmqSyetXfE, `project/Indice.dc.html`, versione 1795707290-756f), dove Fable tiene tutte le domande da 1 a 211.
- **Risposte di Francesco**: i messaggi a Fable che aprono i passi successivi, approvati da Francesco: Passo 12 (177–183), Passo 13 (184–188), Passo 14 (189–195), Passo 15 (196–201), Passo 16 (202–205), Passo 17 (206–211).
- **Dove sono applicate**: le note delle tavole e l'indice del secondo canvas («FamilyNest: computer e web da telefono», https://claude.ai/artifact/PVgH6JrYhzhkPXu6js4Ktc, `project/I2-IND.dc.html`, versione 1795707258-333f).

Regola di precedenza: vale il passo più recente (16 > 15 > 14 > 13 > 12 > 11 > 10). Le decisioni di Francesco vincono sulle tavole.

## Decisioni di Francesco (fuori dalle domande)

| Decisione                                                                              | Che cosa vuol dire per il progetto                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Il tema scuro va al lancio.**                                                        | Telefono, web da telefono e computer escono con chiaro e scuro. Si segue il sistema; in Impostazioni › Aspetto la scelta «Chiaro / Scuro / Come il sistema» (Passo 14). Regole in `regole-tema-scuro.md`.                                     |
| **Barrette degli impegni almeno a 3 a 1 sul fondo** (25/11).                           | Tinta più scura dello stesso colore solo per la barretta; pallino e fondo non cambiano. Valori in `tavolozza.md`.                                                                                                                             |
| **La taglia esce dalla lista dei desideri aperta da link** (Passo 16).                 | Chi apre la lista da un link, fuori casa, non vede la taglia: «Body da danza rosa» dice solo «Maniche lunghe». Dentro l'app, per i genitori, «Taglia 134» resta. Tavola: `web-da-telefono-e-senza-account/` («La lista dal link · computer»). |
| **Anche il numero di scarpe esce dalla lista aperta da link** (Passo 17, sezione 2.4). | Togliere «N. 33» dalla lista pubblica. Dentro l'app resta. **Non è ancora nelle tavole**: arriva con il Passo 17. Chi sviluppa lo applica già ora.                                                                                            |
| Privacy: niente che lasci capire l'età dei figli fuori casa.                           | Vale per ogni pagina senza account: niente taglia, niente numero di scarpe, niente classe (risposta 191).                                                                                                                                     |

## Passo 11 → risposte nel Passo 12 (177–183)

**177.** Calendario a 1280 px con il pannello aperto: ogni giorno è largo 97 px, e due impegni affiancati hanno 45 px a testa, con il titolo che va a capo per sillabe. Va bene così, o con il pannello aperto sabato e domenica si stringono a una striscia per dare spazio ai giorni feriali?
→ **Risposta:** sì, con il pannello aperto sabato e domenica si stringono a una striscia con i segni degli impegni; un clic la riapre. Applicata nel Passo 12 («Settimana · pannello aperto, 1280 px», cartella `calendario/`).

**178.** Miele ha «Mi» nel pallino, per non confondersi con la «M» di Marco (regola: chi arriva dopo con la stessa iniziale prende due lettere). Lo porto anche nel disegno per telefono?
→ **Risposta:** sì, «Mi» per Miele anche sul telefono: la regola vale ovunque. Applicata nel primo canvas (Passo 12).

**179.** Pasti di venerdì 20: nel telefono c'è «Cena dai nonni», nel calendario «Cena fuori, tu e Laura». Qual è quella giusta?
→ **Risposta:** «Cena fuori», uguale dappertutto. Applicata nei due canvas.

**180.** Web da telefono: nel browser non c'è lo sblocco con viso o impronta, e si resta dentro 30 giorni. Va bene, o su un telefono usato da più persone preferisci chiedere la password più spesso?
→ **Risposta:** sì, nel browser si resta dentro 30 giorni. In più, nell'accesso dal browser, una casella «Questo telefono non è solo mio», spenta in partenza, che non tiene dentro. Tavola «Accesso dal browser» (`web-da-telefono-e-senza-account/`).

**181.** Lista dei desideri pubblica: la prenotazione è legata al browser di chi prenota, senza account. Chiediamo una mail facoltativa per ritrovarla?
→ **Risposta:** no, nella lista dei desideri non chiediamo la mail a chi prenota.

**182.** Pagina dell'aiutante: chi ha il link la vede. Basta il link con la scadenza, o aggiungiamo un codice di quattro cifre?
→ **Risposta:** basta il link, a due condizioni: i genitori possono spegnerlo in ogni momento e, quando lo rinnovano, il link diventa nuovo. Tavole «Rinnovare», «Spegnere il link» e «Aiutante · link spento o scaduto» (`desideri-e-aiutanti/`, `web-da-telefono-e-senza-account/`).

**183.** Spazi su computer e le pagine che mancano (Contatti, Documenti, Conti, Luoghi, Novità, Proposte, la lista dei desideri dentro l'app): le facciamo nel Passo 12?
→ **Risposta:** sì, nel Passo 12, prima del tema scuro. Fatte (cartelle `spazi/`, `contatti-documenti-conti-luoghi/`, `desideri-e-aiutanti/`, `turni-settimana-tipo-sintesi/`, `novita-proposte-sfondi/`).

## Passo 12 → risposte nel Passo 13 (184–188)

**184.** Barrette: le tinte scure di Menta (#54936E, per Sofia) e del giallo di «Liberi insieme» (#A38009) sono quelle che si allontanano di più dal pallino. Vanno bene, o scuriamo un poco anche il fondo dell'impegno?
→ **Risposta:** vanno bene così. Il fondo dell'impegno non si scurisce.

**185.** Turni su computer: ho aggiunto «Chi porta, chi riprende», la settimana dei soli viaggi. La teniamo, o bastano le corsie del calendario?
→ **Risposta:** la teniamo, come sul telefono. Si apre dal calendario, senza aggiungere una voce nella barra.

**186.** Spazi: «Conti chiari» sta tra gli «Altri spazi», come riga. Va bene lì, anche sul telefono?
→ **Risposta:** sì, resta una riga tra gli «Altri spazi», anche sul telefono, ed è visibile solo agli adulti.

**187.** Gamification su computer: mancano grazie, festa piccola, sfide, equilibrio per aree, propositi, Stare bene. Prima del tema scuro, o insieme?
→ **Risposta:** prima del tema scuro, nel Passo 13. Fatto (`gamification/`).

**188.** «La prossima» scadenza: sul telefono il foglio non ha ancora la riga «Tra un mese da oggi, il giorno in cui l'hai fatta». La aggiungo con il tema scuro?
→ **Risposta:** va aggiunta sul telefono subito, nel Passo 13. Fatto nel primo canvas.

## Passo 13 → risposte nel Passo 14 (189–195)

**189.** Calendario su computer: «Manda la settimana» e «Chi porta, chi riprende» a 1280 px, con tutti i volti, sono il limite. In vista tutti e due o sotto «Altro»?
→ **Risposta:** restano in vista tutti e due. Se a 1280 manca spazio, i volti si raccolgono in un solo pulsante «Chi vedo». Tavola «189 · «Chi vedo», a 1280 px» (`calendario/`). Precisata dalla 201.

**190.** Aiutanti: un colore dalla tavolozza di casa, o tutti lo stesso colore neutro?
→ **Risposta:** tutti gli aiutanti hanno un solo colore neutro, con l'iniziale (ruolo `--c-aiutante`, #D5DBD8). I colori della tavolozza restano a chi vive in casa.

**191.** L'avviso fotografato sul telefono mostra la classe nel titolo («Avviso n. 14 · Classe 4ª B»). La tolgo anche sul telefono?
→ **Risposta:** sì, togli la classe anche sul telefono, dall'avviso fotografato e dal titolo della mail («Colloqui di dicembre · 4ª B»). Nel profilo del figlio età e classe restano, visibili solo in casa.

**192.** Propositi di casa: su computer la pagina sta sotto «Il tuo Nest»; sul telefono ci si arriva da un riquadro in Oggi, a gennaio. Va bene?
→ **Risposta:** due strade, uguali su telefono e computer: il riquadro in Oggi a gennaio e, durante l'anno, la pagina sotto «Il tuo Nest».

**193.** Impegni da una mail su computer: «Incolla il testo di una mail», senza collegare la casella. Va bene?
→ **Risposta:** va bene «Incolla il testo di una mail», senza collegare la casella. L'indirizzo a cui inoltrare arriverà più avanti.

**194.** Messaggio della settimana su computer: «Copia» principale e «Apri WhatsApp». Teniamo tutti e due?
→ **Risposta:** tutti e due, con «Copia» come principale e «Apri WhatsApp» accanto. Il messaggio lo manda sempre la persona.

**195.** Giorno a colonne: la scuola è un riquadro lungo dalle 8:30 alle 16:30. Lo teniamo, o basta un segno in cima?
→ **Risposta:** nel giorno a colonne la scuola resta, ma leggera: una fascia chiara a righe come «Occupata», al posto del riquadro pieno. Nel mese basta un segno in cima.

## Passo 14 → risposte nel Passo 15 (196–201)

**196.** Tema scuro: pulsante principale e scelte fatte verde petrolio (#1C7480) con il testo bianco. Va bene?
→ **Risposta:** sì, ma un poco più chiaro: **#1F7D8A**, almeno 3 a 1 su pannelli e finestre. Applicata: 3,2 su finestre e pannelli, 3,4 sulla barra laterale, 3,7 sul fondo; bianco sopra a 4,8.

**197.** Bordo dei campi sul telefono, tema chiaro: è ancora #AEB9B7 (1,9 a 1). Lo porto a #869390 anche sul telefono?
→ **Risposta:** sì, **#869390** anche sul telefono (3,2 a 1 sul bianco).

**198.** La scena di Oggi nel tema scuro: resta quella dell'ora, o al buio sempre sera o notte?
→ **Risposta:** al buio la scena di Oggi è sempre quella della sera o della notte, mai un rettangolo luminoso. Lo splash scuro usa la stessa scena. Precisata dalla 204: sempre la notte.

**199.** Le pagine del telefono del Passo 14 stanno nel secondo canvas, perché il primo è al tetto di 511 file. Va bene?
→ **Risposta:** sì, le pagine del telefono restano nel secondo canvas e l'archivio non si sposta.

**200.** Propositi sul telefono: la pagina sotto «Il tuo Nest» non è ancora disegnata. La faccio nel passo del tablet?
→ **Risposta:** no, nel Passo 15. Fatta (`gamification/`, «Telefono · la pagina dei propositi»).

**201.** «Chi vedo»: a 1280 px i volti diventano un pulsante solo quando si guarda tutta la casa. O sempre, anche a 1440?
→ **Risposta:** «Chi vedo» diventa un solo pulsante solo dove manca spazio; quando c'è posto i volti restano in vista. La regola è scritta nella tavola delle regole di adattamento (aggiornata sul posto: `docs/design/computer/regole/` va riallineata).

## Passo 15 → risposte nel Passo 16 (202–205)

**202.** Verde petrolio al buio (#1F7D8A): sul fondo «premuto» di una riga scelta scende a 2,6. Lì non è mai l'unico segnale. Va bene o lo schiarisco?
→ **Risposta:** resta com'è. Su una riga scelta il verde non deve mai essere l'unico segnale: sempre anche la spunta o il testo.

**203.** «Il tuo Nest» sul telefono: manca la riga «Propositi di casa». La aggiungo nel passo del tablet?
→ **Risposta:** va fatta adesso, nel Passo 16. Fatta: «Propositi di casa · Tre per il 2027», sopra le impostazioni, uguale su computer.

**204.** Tema scuro: di giorno la scena della notte, non quella della sera. Va bene, o la sera fino al tramonto?
→ **Risposta:** va bene, al buio la scena è sempre la notte, anche di giorno. Splash e Oggi usano la stessa scena.

**205.** Ricette senza foto: quattro tinte di segnaposto (rosato, sabbia, grigio, azzurro). Tutte e quattro, o una?
→ **Risposta:** un segnaposto solo, color sabbia, con l'icona del piatto (ruoli `--c-segnaposto` e `--c-segnaposto-testo`). L'icona del piatto non è ancora ovunque: domanda 210.

## Passo 16 → risposte nel Passo 17 (206–211)

Riguardano quasi tutte il tablet, che arriva con il Passo 17. Le tavole di questo passaggio non le applicano ancora.

**206.** Tablet in orizzontale: i pulsanti piccoli del computer sono a 36 px; col tocco devono salire a 44 px. Le ridisegno, o basta la regola?
→ **Risposta:** serve almeno una tavola disegnata con i comandi a 44 px in orizzontale (barra in alto, «Giorno · Settimana · Mese», pulsanti, impegni nel calendario), non solo la regola.

**207.** Tablet in verticale: le righe del telefono si allargano a 720 px. Le tengo così, o in una colonna centrale di 640 px?
→ **Risposta:** sì, liste e moduli in una colonna centrale di circa 640 px (spesa, da fare, impostazioni, «Nuovo impegno»).

**208.** La soglia tra «come il telefono» e «come il computer» è a 900 px di larghezza. Va bene?
→ **Risposta:** va bene, con un'aggiunta: se la finestra è alta meno di 600 px si usa sempre la forma del telefono, così un telefono grande girato in orizzontale non diventa un piccolo computer. **Vale anche per il web da telefono e per il computer con la finestra bassa**: chi sviluppa il layout la applica già ora.

**209.** Il mese sul tablet in verticale: telefono allargato o griglia del computer con i titoli?
→ **Risposta:** la griglia del computer, con i titoli degli impegni.

**210.** Ricette senza foto: l'icona non è ancora il piatto in tutti gli schermi. La uniformo?
→ **Risposta:** sì, uniforma l'icona del piatto nel Passo 17, insieme ai Pasti senza foto (segnaposto sabbia con il piatto anche su computer e tablet). **Vale anche per telefono e computer**: chi sviluppa usa un solo segnaposto con l'icona del piatto.

**211.** Tablet in verticale: la scena di Oggi taglia il tetto della casa. La ridisegno o si restringe ai lati?
→ **Risposta:** ridisegna la scena di Oggi per il tablet, senza tagliare il tetto.

## Che cosa scrive il canvas e non è una domanda

- **Barrette** (Passo 12, tavola «I valori»): undici colori, la tinta scura è lo stesso colore con meno luce, fermata al primo valore sopra 3,2 a 1 sul fondo dell'impegno. Blu e Ardesia non cambiano.
- **Tre contrasti corretti** (Passo 12): «Di casa» nella barra laterale #55686C (5,4 : 1); numeri dei giorni fuori mese #5F7073 (4,9 : 1); bordo dei campi e tratteggio delle tessere «aggiungi» #869390 (3,2 : 1). Il campo di ricerca in alto ha lo stesso filo; il campo con il fuoco tiene il filo scuro da 2 px.
- **Respiro dello splash lungo** (Passo 12): vale la nota, **100 ms**. Il fondo comincia a schiarirsi a 1,95 s, arriva al colore del cielo a 2,40, resta solo il cielo per un decimo di secondo, Oggi emerge da 2,50 a 2,90. Durata 2,9 s (risposta 170). Chiude il punto «Da chiarire con Fable» di `docs/design/computer/LEGGIMI.md`.
- **Titoli lunghi negli spazi stretti** (Passo 13, «La regola»): mai una parola spezzata a metà; il titolo intero al passaggio del mouse e con il fuoco, nel fumetto.
- **«La prossima»** (Passi 13 e 14): finché non si conferma, «Annulla» e «Conferma la prossima» prendono il posto di «Elimina» e «Modifica», nel piede del pannello o del foglio; la riga dice «Tra un mese da oggi».
- **Errori** (Passo 13): l'errore dice che cosa non si è caricato e che cosa resta com'era; un pulsante, «Riprova», con il fuoco disegnato (Passo 14).
- **Dati di prova** (Passi 13 e 14): scuola 8:30–16:30 e «8:10, uscita da casa»; nuoto con l'uscita alle 16:40; gita al parco Nord domenica 22; maestra Silvia (una sola Elena, l'invitata); nonna Anna con il colore neutro degli aiutanti; date di prova future spostate (lunedì 23); una sola riunione della scuola; il viaggio del calcio scritto in un modo solo; documenti sotto i 20 MB per file.
- **Pallino delle persone** (Passi 15 e 16): regola unica in `tavolozza.md`.
- **Tavolozza per ruoli** (Passo 14): 73 ruoli, ognuno con valore chiaro e scuro; si cambiano in un punto solo. Restano scritti a mano solo i colori dentro foto e scene, i veli sopra le foto, i campioni degli sfondi.
