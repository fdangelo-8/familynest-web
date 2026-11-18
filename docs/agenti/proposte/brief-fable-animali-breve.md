# Brief breve per Fable · Animali, solo i pezzi nuovi

Ciao Fable. Il brief completo è `brief-fable-animali.md` (dati di prova, tutte le schermate, movimento): vale ancora. Questo è la versione corta: i quattro pezzi che **non esistono** nei componenti dell'app di oggi. Tutto il resto (profilo dell'animale, scadenze in Casa, righe di Oggi, toast, fogli) lo costruiamo con i componenti che ci sono, come scritto in `docs/specifiche/460-animali-grafica.md`.

Per ogni pezzo: telefono 390 px e computer 1280 px, gli stati elencati, e una nota se cambi un testo. Dati di prova: Biscotto (cane, zafferano), Miele (gatto, cannella), Marco, Laura, Sofia, Tommaso; oggi mercoledì 18 novembre 2026.

## 1. La riga del turno con «Fatto da…»

Si vede ogni giorno, più volte al giorno: è il pezzo che conta di più.

- Da fare: «Cibo di Biscotto» · «Sera · tocca a Laura» · avatar di Laura. Con «chi è libero»: nessun avatar.
- Fatta: «Fatto da Laura alle 19:10» · avatar di chi l'ha fatta. Il nome deve leggersi bene.
- Stati: da fare, fatta, fatta da un altro, passaggio e pressione, spunta non salvata.
- Oggi nella app: casella quadrata e titolo barrato quando è fatta, come «Fatti» in Casa · Da fare. Se proponi altro (spunta tonda, niente barrato), dillo nella nota.

## 2. Il foglio «Nuova cosa di ogni giorno»

Il foglio è lungo: «Si ripete», giorni, quando, come si alterna, chi, avviso, anteprima della settimana. Oggi lo costruiamo con menu a tendina, schede di scelta e una tabella per i 7 giorni. Ci serve il tuo disegno per tre parti:

- **Giorni della settimana**: sette scelte Lun… Dom su una riga a 390 px, area di tocco di 44 px.
- **Chi, in ordine**: da 1 a 6 persone, con lo spostamento su e giù senza trascinare (deve funzionare a tastiera e con lo screen reader).
- **Anteprima dei prossimi 7 giorni** con giorno e avatar.

Stati: vuoto, «A turno» con Laura e Sofia, «Per giorno della settimana» (lettiera di Miele: lun Marco, mer Laura, ven Tommaso), «Chi è libero», errori («Scegli almeno un giorno.», «Scegli chi fa il turno.»), sei persone (pieno).

## 3. «Fatta» su una scadenza che si ripete

Un passo nel foglio della scadenza: «La prossima: venerdì 18 dicembre», «Contata da oggi.», «Cambia data», bottone «Sposta al 18 dicembre». Stati: normale, scaduta (Miele), data sbagliata («Scegli un giorno dopo oggi.»), in corso. Oggi lo facciamo con testo, un link e il campo data di sistema.

## 4. Foto dell'animale

Avatar grande con la foto nella testa del profilo, e il campo nel foglio: «Scegli una foto», «Cambia la foto», «Togli la foto», con l'avviso sempre visibile «Solo l'animale, senza persone.». Stati: senza foto, con foto, in riduzione, formato sbagliato. Foto di prova: solo animali, mai persone.

Domanda per te: il filo del colore attorno alla foto (brief lungo, 5.1) serve davvero? Nell'app la foto compare solo a 72 px nel profilo; ovunque altro resta l'iniziale sul colore.

## Cosa non serve disegnare

Profilo dell'animale nel resto, Casa · Scadenze, Spesa, Calendario, Il tuo Nest: li facciamo con i componenti di oggi. Se la direzione C li cambia, li ridisegni insieme al resto dell'app, non solo per gli animali.
