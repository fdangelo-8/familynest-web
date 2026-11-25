# Regole di adattamento al computer

Fonte: tavola «Computer · Le regole di adattamento» (`project/D-RG1.dc.html`, Passo 10, aggiornata nel Passo 11 con le risposte 171–173 e con la regola del pannello), più le note delle tavole che precisano misure e comportamenti (indicate tra parentesi). Le due tavole sono in `regole/` come immagini.

Principio: il disegno per telefono dei Passi 5–9 è il riferimento. Stessi Componenti 2.0, stessi testi, stessi colori delle persone, stessi dati. Su computer cambiano solo la disposizione e il modo di arrivarci: mouse e tastiera al posto del dito.

## 1. Larghezze di riferimento

| Schermo          | Larghezza     | Che cosa succede                                                                                                                                                     |
| ---------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Telefono         | 390 px        | Una colonna, margini di 24 px, barra in basso. È l'app dei Passi 5–9.                                                                                                |
| Computer         | 1280 px       | Barra laterale di 248 px e contenuto di 1032 px: margini di 32 px, 12 colonne, canalina di 24 px. È la misura delle tavole.                                          |
| Computer largo   | 1440 px       | Stessa barra; il contenuto si ferma a 1200 px e guadagna una terza colonna dove serve. Oltre i 1440 crescono solo i margini.                                         |
| Finestra stretta | sotto 1100 px | La barra laterale diventa a icone (72 px) e il contenuto torna a una colonna (tavola «Oggi · finestra stretta», 1040 px). Sotto 760 px vale il disegno per telefono. |
| Tablet           | —             | Fuori da questo passo: arriva per ultimo.                                                                                                                            |

## 2. Griglia, colonne e misure

- Il testo non si allarga. Elenchi, moduli e pagine da leggere stanno in una colonna di 720 px al massimo, come sul telefono ma con più aria. Colonne usate nelle tavole: Impostazioni 600 px, «Chiedi a …» a tutta pagina 680 px, pagine senza account 680 px (960 su due colonne), pagamento 1000 px.
- Lo spazio in più va a una seconda colonna, non a righe più lunghe: Oggi con la settimana accanto, un elenco con il dettaglio accanto. A 1440 px Oggi passa a tre colonne (la giornata, le cose da fare con la cena, i prossimi giorni).
- Le tessere si dispongono da sole: larghe almeno 220 px, quante ne entrano. Le prime quattro di Spazi restano tessere, le altre elenco.
- Gli elenchi lunghi (scadenze, documenti) diventano tabelle leggere, con le stesse righe: titolo, sotto, valore a destra.
- Altezze: righe di 52–56 px come sul telefono; i comandi fitti (barre, pastiglie) scendono a 32–40 px, perché il puntatore è più preciso del dito.
- Tra le colonne del contenuto 32 px; barra in alto alta 72 px con margini di 32 px (vedi `tokens-computer.md`).

## 3. Barra laterale (al posto della barra in basso)

- Le stesse quattro voci, nello stesso ordine: Oggi, Calendario, Casa, Spazi. Sopra, il marchio e la lente «Io · Nest».
- Sotto le voci, il gruppo «Di casa» con tre scorciatoie fisse: Spesa, Ricette, Animali. Fisse al lancio, più avanti si potranno scegliere (risposta 172).
- In fondo «Chiedi a Nest», con il suo colore (tasto K), e il tuo profilo, che apre «Il tuo Nest».
- Il + per aggiungere non è più sulla barra: è un pulsante in alto a destra («Nuovo impegno», «Nuova ricetta», «Nuova conversazione»…), sempre nello stesso posto (tasto N).
- Scelta di Fable: barra laterale e non barra in alto, perché in verticale c'è posto per le scorciatoie di casa e per «Chiedi a Nest», e il calendario tiene tutta la larghezza (risposta 171: barra laterale a sinistra).
- Barra a icone (72 px): sotto i 1100 px e ogni volta che si apre il pannello. In cima resta la lente (il pallino di Marco dice «Io», un clic la cambia). Ogni icona ha il suo nome per gli screen reader e nel fumetto al passaggio del mouse.

## 4. Pannello a destra

- 420 px, per guardare e modificare senza perdere il contesto: il dettaglio di un impegno, i filtri, un profilo, le notifiche (campanella), «Chiedi a …».
- Regola del Passo 11: quando si apre il pannello, la barra laterale passa alle sole icone. Se il contenuto resta sotto i 900 px, la scena di Oggi si nasconde e la seconda colonna scende sotto la prima. La regola è una sola e non dipende dalla pagina: conta la larghezza che resta al contenuto.
  - A 1280 px: barra 72 + contenuto 788 + pannello 420. Oggi: saluto su una riga, tre conti affiancati, scena nascosta, «I prossimi giorni» e la cena sotto «Le mie cose». Settimana: sette colonne di 97 px.
  - A 1440 px: restano 948 px, bastano per le due colonne e per la scena, un po' più stretta. Settimana: colonne di 120 px.
- Nel pannello si passa da un elemento all'altro con le frecce senza chiudere. In fondo «Elimina» a sinistra, leggero; «Modifica» e «Fatto» a destra.
- Movimento: la barra si stringe in 200 ms mentre il pannello entra da destra; con movimento ridotto il cambio è immediato.
- In attesa del Passo 12 (risposta 177): con il pannello aperto a 1280 px sabato e domenica si stringeranno a una striscia con i segni degli impegni.

## 5. Finestre al centro

- 560 px con il velo (rgba(16,38,42,.36)), per creare e per confermare: «Nuovo impegno», «Elimina», i consensi. Varianti stretta 420 px (consensi, «Aggiungi alla spesa», regione), media 480, larga 760.
- «Nuovo impegno»: gli stessi campi del foglio a campi del Passo 8; titolo con il fuoco, giorno e ore su una riga, «Per chi» con i pallini, poi le righe con il valore a destra. In basso «Scrivilo con una frase» a sinistra; «Annulla» e «Salva» a destra. Invio salva; Esc chiude chiedendo conferma se hai scritto qualcosa.
- Il fuoco resta dentro la finestra finché non si chiude.
- Movimento: compare in 180 ms con dissolvenza e scala dal 97%; con movimento ridotto solo la dissolvenza.

## 6. Fumetto

- Accanto al comando, per le scelte brevi: ripetizione, chi lo vede, avviso, data e ora, colore di una persona, la cena di un giorno vuoto nei Pasti.
- Largo 300 px (i risultati della ricerca: largo quanto il campo). Frecce per scorrere, Invio per scegliere, Esc per chiudere.
- Usato anche come etichetta delle icone della barra a icone al passaggio del mouse.

## 7. Ricerca e avvisi

- La lente del telefono diventa un campo sempre in vista nella barra in alto (280 px); si apre con «/» da qualunque pagina.
- Con il fuoco il campo si allarga a 400 px; i risultati scendono in un fumetto largo quanto il campo, allineato ai suoi bordi (correzione del Passo 11: non esce più dal bordo), divisi per tipo come sul telefono. Ogni riga ha la stessa forma: icona, testo, tasto a destra.
- La campanella apre gli avvisi in un pannello a destra, non in una pagina. Gli avvisi del browser hanno il loro stato («Avvisi del browser spenti»).

## 8. Mouse e fuoco

Tutto si usa senza mouse. Il passaggio del mouse aggiunge un segno leggero; il fuoco da tastiera aggiunge sempre lo stesso anello scuro, mai tolto e mai sostituito dal solo colore.

| Componente          | Stati disegnati                      |
| ------------------- | ------------------------------------ |
| Pulsante principale | a riposo, mouse sopra, fuoco, spento |
| Pulsante quieto     | a riposo, mouse sopra, fuoco         |
| Riga di un elenco   | a riposo, mouse sopra, fuoco         |
| Voce della barra    | a riposo, mouse sopra, scelta, fuoco |

- Mouse sopra: un fondo grigio chiaro sulle righe, un tono più scuro sui pulsanti pieni. Nessun movimento, nessuna ombra che compare.
- Fuoco: anello di 2 px, colore #0F3D44, staccato di 2 px; bianco sui fondi scuri. Contrasto con il fondo sempre sopra 3 a 1.
- Un solo elemento con il fuoco alla volta (correzione del Passo 11 sull'errore di accesso: l'anello è sul campo della password, pronto per riscrivere).
- Scelta: resta quella del telefono (fondo pieno, o bianco con il filo nella barra); non dipende dal mouse.
- Niente azioni che compaiono solo con il mouse sopra: quello che si può fare su una riga è sempre visibile, o si apre dai tre puntini.
- Niente trascinamento come unico modo (nei Pasti trascinare una ricetta su un giorno è rimandato perché senza mouse non si usa).

## 9. Scorciatoie da tastiera

| Tasto  | Azione                                                                              |
| ------ | ----------------------------------------------------------------------------------- |
| N      | Nuovo impegno (o nuova riga, dentro una lista; nuova conversazione in «Chiedi a …») |
| /      | Cerca                                                                               |
| K      | Apri «Chiedi a Nest»                                                                |
| O      | Vai a Oggi                                                                          |
| C      | Vai al Calendario                                                                   |
| A      | Vai a Casa                                                                          |
| S      | Vai a Spazi                                                                         |
| 1      | Calendario: giorno                                                                  |
| 2      | Calendario: settimana                                                               |
| 3      | Calendario: mese                                                                    |
| T      | Torna a oggi                                                                        |
| ← →    | Periodo prima e dopo (in cucina: passo prima e dopo)                                |
| Invio  | Apri la riga, conferma                                                              |
| Spazio | Segna fatto (in cucina: ferma e fa ripartire il tempo)                              |
| Esc    | Chiudi pannello, finestra, fumetto                                                  |
| ?      | Mostra questo elenco                                                                |

- Sono lettere sole, senza Ctrl o Cmd (per non scontrarsi con il browser): non funzionano mentre si scrive in un campo.
- Seguono la lingua: cambieranno con le traduzioni (risposta 173). «?» le mostra tutte.
- In «Chiedi a …»: Invio manda, Maiusc+Invio va a capo.

## 10. Ordine di tabulazione

- «Vai al contenuto», barra laterale, barra in alto, contenuto dall'alto in basso e da sinistra a destra, poi il pannello.
- In una finestra il fuoco resta dentro finché non si chiude; Esc chiude sempre e il fuoco torna al comando da cui si era partiti.
- Frecce su e giù per muoversi tra le righe di un elenco e tra i giorni del calendario; in Impostazioni frecce nell'elenco a sinistra e Tab per entrare nel contenuto.
- Moduli: il fuoco parte dal primo campo, Invio manda il modulo; la scena dell'accesso è decorativa e non riceve il fuoco. Nel pagamento Tab segue numero, scadenza, codice, nome (campi del fornitore dei pagamenti).
- Consenso: «Accendi e continua» prende il fuoco solo dopo che la finestra è stata letta dallo screen reader; Esc vale come uscita senza consenso.

Limite dichiarato nell'indice del canvas: niente è stato provato in un browser vero; contrasti e ordine di tabulazione sono dichiarati nelle note, non misurati con uno strumento.
