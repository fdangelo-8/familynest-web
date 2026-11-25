# Area «ritocchi-p6»: schermate e note di Fable

31 immagini in questa cartella. Ogni sezione qui sotto corrisponde a una tavola del canvas; per ogni schermata c'è il nome del file PNG e la nota di Fable (scelte, stati, movimenti, critica).

# Passo 6 · Ritocchi: freccia indietro, riapertura dell'app, «Porta il calendario»

Fonte: `project/P6-RT1.dc.html` del canvas di Fable.

## rt1-01-passo-6-ritocchi-freccia-indietro-ri.png

(nessuna nota nella tavola)

## rt1-02-passo-6-ritocchi-freccia-indietro-ri.png

(nessuna nota nella tavola)

## rt1-03-passo-6-ritocchi-freccia-indietro-ri.png

(nessuna nota nella tavola)

## rt1-04-passo-6-ritocchi-freccia-indietro-ri.png

(nessuna nota nella tavola)

## rt1-05-passo-6-ritocchi-freccia-indietro-ri.png

(nessuna nota nella tavola)

## rt1-06-passo-6-ritocchi-freccia-indietro-ri.png

(nessuna nota nella tavola)

## rt1-07-passo-6-ritocchi-freccia-indietro-ri.png

(nessuna nota nella tavola)

## rt1-08-passo-6-ritocchi-freccia-indietro-ri.png

(nessuna nota nella tavola)

## rt1-09-passo-6-ritocchi-freccia-indietro-ri.png

(nessuna nota nella tavola)

## rt1-10-passo-6-ritocchi-freccia-indietro-ri.png

(nessuna nota nella tavola)

## rt1-11-passo-6-ritocchi-freccia-indietro-ri.png

(nessuna nota nella tavola)

## rt1-12-passo-6-ritocchi-freccia-indietro-ri.png

(nessuna nota nella tavola)

## rt1-13-passo-6-ritocchi-freccia-indietro-ri.png

(nessuna nota nella tavola)

## rt1-14-passo-6-ritocchi-freccia-indietro-ri.png

(nessuna nota nella tavola)

## rt1-15-passo-6-ritocchi-freccia-indietro-ri.png

(nessuna nota nella tavola)

## rt1-16-a-ripresa-nel-passo-8-piu-breve-in-m.png

A · ripresa nel Passo 8, più breve: in movimento

Rivedi il movimento

A · il marchio su fondo pieno, poi Oggi

0–700 ms: il marchio fermo sul fondo scuro (almeno 400 ms, anche se i dati ci sono già, perché non lampeggi).

700–1200 ms: il fondo sale e scopre Oggi (500 ms, curva che frena). Da 860 ms la giornata entra dal basso di 10 px (320 ms).

Movimento ridotto: niente salita; il fondo sfuma in 200 ms. Nessuna vibrazione: aprire l'app non è un gesto da confermare.

## rt1-17-a-1-il-marchio.png

A · 1. Il marchio

A · il primo fotogramma

Lo stesso fondo scuro del primo avvio, il marchio al centro. Marchio e nome arrivano dal componente unico: quando cambiano, cambiano qui.

Niente frase, niente rotella: se dura meno di un secondo non c'è niente da spiegare.

## rt1-18-a-2-il-passaggio.png

A · 2. Il passaggio

A · a metà (circa 950 ms)

Il fondo sale come una tenda e Oggi è già al suo posto sotto.

Critica onesta: è il momento più «di marca», ma si ripete a ogni apertura. Chi apre l'app dieci volte al giorno aspetta dieci volte un secondo abbondante per niente.

## rt1-19-b-superata-dal-passo-8-in-movimento.png

B · superata dal Passo 8: in movimento

Rivedi il movimento

B · Oggi subito, con lo scheletro

0 ms: la scena, la data e il saluto sono già giusti (li sa il telefono, non servono dati). Sotto, lo scheletro: tre numeri e quattro righe.

Quando i dati arrivano: lo scheletro sfuma e il contenuto compare, 180–200 ms, senza spostare niente.

Movimento ridotto: lo scheletro non pulsa; il cambio è una dissolvenza. Nessuna vibrazione.

## rt1-20-b-1-lo-scheletro.png

B · 1. Lo scheletro

B · il primo fotogramma

Lo scheletro ha le stesse misure del contenuto vero: quando arriva, niente salta. La barra in basso funziona già: puoi andare in Calendario senza aspettare.

Se sul telefono c'è già la giornata dell'ultima volta, lo scheletro non compare proprio: si vede quella, e si aggiorna da sola.

## rt1-21-a-e-b-oggi-pronto.png

A e B · Oggi, pronto

L'arrivo, uguale per le due strade

Critica e consiglio: scelgo B. È più veloce, è utile dal primo istante, e il «momento di marca» c'è già: è la scena con la casa. Terrei la A solo per il primissimo avvio dopo un aggiornamento.

Com'è finita: nel Passo 7 Francesco aveva scelto la B; nel Passo 8 ha deciso per lo splash con il marchio, ma breve (al massimo 1,5 secondi). Lo scheletro della B resta solo quando i dati non sono pronti alla fine dello splash. La versione da seguire è nella pagina «Passo 9 · Splash in dissolvenza e ultime correzioni»: lo splash svanisce in dissolvenza, senza tende.

## rt1-22-rete-lenta.png

Rete lenta

Se i dati non arrivano entro 2 secondi

Nelle due strade si passa a Oggi com'era l'ultima volta, con una riga che lo dice e l'ora. La rotella gira piano; appena arrivano i dati la riga sparisce (150 ms).

Tutto resta toccabile. Movimento ridotto: la rotella è ferma.

## rt1-23-senza-rete.png

Senza rete

Senza rete

Stesso Oggi, con l'avviso fermo in cima: dice da quando sono i dati e che cosa succede a quello che scrivi (decisione 93, «In attesa di connessione» sotto la riga).

Nessun blocco, nessun pulsante «Riprova»: riprova da sola quando la rete torna.

## rt1-24-senza-rete-e-niente-di-salvato.png

Senza rete e niente di salvato

Il caso raro

Telefono nuovo o dati cancellati, e niente rete: la cima c'è (scena, data, saluto), sotto lo stato d'errore con «Riprova».

Nella strada A il marchio non resta mai oltre 2 secondi: si arriva comunque qui.

## rt1-25-a-la-riga-si-tocca-tutta.png

A · la riga si tocca tutta

A · niente pulsante: la riga è il pulsante

Tutta la riga reagisce al tocco e porta al servizio; in fondo c'è la freccia sottile delle righe che si toccano (decisione 72).

Critica: è la più pulita e la più coerente con il resto dell'app. Ma in un passo del primo avvio due righe d'elenco sembrano impostazioni, non «la cosa da fare adesso»: l'invito è debole.

## rt1-26-a-dopo-il-collegamento.png

A · dopo il collegamento

A · collegato

La riga dice quanti impegni ha trovato e porta l'etichetta «Collegato». Il pulsante in basso diventa «Continua», pieno.

## rt1-27-b-il-pulsante-con-il-nome-del-servizio.png

B · il pulsante con il nome del servizio

B · due pulsanti grandi, con il nome

Il verbo e il nome stanno insieme: «Collega Google Calendar». Hanno la forma dei pulsanti «Entra con Google» dell'accesso, che chi arriva qui ha appena usato. Sono loro la cosa più evidente della pagina; «Continua senza calendario» scende a testo.

Critica: è la più chiara su che cosa succede e dove si va. Costa un po' di altezza, e con tre servizi (se un giorno torna iCloud) la pagina si riempie.

È quella che consiglio.

## rt1-28-b-dopo-il-collegamento.png

B · dopo il collegamento

B · collegato

Il pulsante usato perde il bordo scuro e prende la spunta: non invita più, conferma. L'altro resta com'era.

Movimento: la spunta entra in 200 ms con una vibrazione leggera; con movimento ridotto compare e basta.

## rt1-29-c-due-tessere.png

C · due tessere

C · due tessere affiancate

Si riconoscono dall'icona, come app sul telefono.

Critica: belle, ma «Tocca per collegare» è un'istruzione, e un'istruzione scritta è il segno che la forma da sola non parla. In due affiancate i nomi lunghi vanno a capo.

## rt1-30-c-dopo-il-collegamento.png

C · dopo il collegamento

C · collegato

Bordo scuro e spunta in alto.

Domanda 122: A, B o C? Consiglio B.

## rt1-31-b-il-collegamento-non-riesce.png

B · il collegamento non riesce

L'errore, nella forma B

L'avviso dice quale servizio e che cosa puoi fare; il pulsante cambia verbo: «Riprova con Google Calendar».

In tutte e tre le forme è sparita «In due direzioni»: al lancio leggiamo soltanto (decisione 80), e la frase sotto il titolo lo dice.
