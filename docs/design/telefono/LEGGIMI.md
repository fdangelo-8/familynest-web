# Design per telefono (Fable) · fonte di verità

Approvato da Francesco il **24/11/2026** come **nuova fonte di verità per l'app su telefono**, al posto del vecchio mockup in `docs/mockup/*.html`, che resta come archivio (decisione D4 in `docs/mockup/DECISIONI.md`). Computer e web da telefono sono in [`docs/design/computer/`](../computer/LEGGIMI.md) (Passi 10 e 11, approvati il 25/11/2026; correzioni del Passo 12 in arrivo): per le pagine che lì non sono ancora disegnate si adatta il telefono con le regole di [`regole.md`](../computer/regole.md).

Estratto il 24/11/2026 dal canvas di Fable «FamilyNest: nuovo design» (versione 1795357421-5c16): **547 immagini** in 25 cartelle. Le schermate sono a 390 px di larghezza, salvate a doppia densità (780 px); in `componenti/` ci sono anche 5 tavole intere. Ogni cartella ha un `note.md` con il nome di ogni PNG e la nota di Fable (scelte, stati, movimenti, critica). Peso totale: circa 40 MB.

## Come si legge

- **Vale il passo più recente.** Le pagine del canvas sono passi successivi: quando due schermate si contraddicono vince il passo più recente (9 > 8 > 7 > 6 > 5). Le cartelle con il nome di un passo (`ritocchi-p6`, `scelte-p7`, `pagine-mancanti-p7`, `decisioni-p8`, `splash-p9`, `app-fase-b`, `funzioni-fase-c`) contengono tavole che toccano più aree.
- **Le decisioni di Francesco vincono sulle schermate.** Prima `docs/mockup/DECISIONI.md` (D1–D4), poi le risposte in [`decisioni-fable.md`](decisioni-fable.md) (domande 1–183 e tabella di copertura delle 68 funzioni). Le domande 166 e 169 sono raccomandazioni non ancora confermate; le 177–183 sono aperte.
- **Token e componenti.** I valori sono in [`tokens.md`](tokens.md) e [`tokens.json`](tokens.json) (con file e riga del canvas). Le regole d'uso, i nomi delle variabili e i Componenti 2.0 sono nella skill `design-system` (`.claude/skills/design-system/riferimento/telefono.md`).
- **Le animazioni** sono fotografate nello stato finale: tempi e versione con movimento ridotto sono scritti nelle note.
- **Mail di servizio:** i file veri (HTML e solo testo) sono in `docs/mockup/mail/` (istruzioni nel suo `LEGGIMI.md`); in `email/` c'è solo la versione fotografata sul telefono.

## Indice delle aree

L'elenco delle schermate di ogni cartella, con la nota di Fable per ciascuna, è nel `note.md` della cartella.

| Cartella                                            | PNG | Passo | Contenuto                                                                                                                                                                                                                                |
| --------------------------------------------------- | --: | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`componenti/`](componenti/note.md)                 |  39 | 5     | Componenti 2.0, tre tavole prima/dopo (`k1` navigazione ed elenchi, `k2` scelte, persone, campi, pulsanti, `k3` fogli, documenti, pagamento, stati, il nome) e componenti nuovi su Documenti, Proposte, Novità, Contatti, Luoghi (`ap1`) |
| [`ritocchi-p6/`](ritocchi-p6/note.md)               |  31 | 6     | Freccia indietro (cinque forme, scelta D: `rt1-04`–`rt1-06`), riapertura dell'app, rete lenta e senza rete, «Porta il calendario»                                                                                                        |
| [`scelte-p7/`](scelte-p7/note.md)                   |  21 | 7     | Scelte applicate: splash breve, sblocco con Face ID (proposta), «Collega» forma 1 (`sc1-08`, `sc1-09`, `sc1-14`), Spazi con le prime quattro a tessere, «Il tuo Nest»                                                                    |
| [`splash-p9/`](splash-p9/note.md)                   |  17 | 9     | Splash in dissolvenza (breve e lungo, verso Face ID), ultime correzioni, risposte 155–165                                                                                                                                                |
| [`decisioni-p8/`](decisioni-p8/note.md)             |  43 | 8     | Splash, ricette di casa e crediti foto, segni nel Mese, giorno a colonne, «Manda la settimana», primo Oggi di chi entra con invito, foglio «Nuovo impegno», sintesi del mattino                                                          |
| [`pagine-mancanti-p7/`](pagine-mancanti-p7/note.md) |  49 | 7     | Bozze delle mail, account e privacy, sintesi del mattino, impegni sovrapposti, «Da verificare», settimana tipo, impegni da mail, messaggio per WhatsApp, notifiche push, installazione, widget (proposta), pagine di sistema             |
| [`app-fase-b/`](app-fase-b/note.md)                 |  52 | 6     | Impegni e ripetizioni, Casa (spesa, da fare, scadenze), Il tuo Nest e persone, profilo del figlio, liste desideri, Spazi, compleanni, notifiche e calendari collegati, profilo e impostazioni                                            |
| [`funzioni-fase-c/`](funzioni-fase-c/note.md)       |  46 | 6     | Ricorrenze, calendario scolastico, settimana tipo, avvisi e dati di Chiedi, contatti, nonni e babysitter, documenti e conti, luoghi, novità e proposte                                                                                   |
| [`oggi/`](oggi/note.md)                             |  27 | 5, 6  | Oggi (coppia, pochi impegni), sfondi e scene; la cima unica di Oggi (Passo 6)                                                                                                                                                            |
| [`calendario/`](calendario/note.md)                 |   9 | 5     | Calendario condiviso: settimana, corsie, giorno a colonne, mese                                                                                                                                                                          |
| [`casa/`](casa/note.md)                             |   6 | 5     | Spesa «Prese» e svuota, il + delle liste                                                                                                                                                                                                 |
| [`avvio/`](avvio/note.md)                           |  27 | 5     | Accesso, creazione dell'account, password, primo avvio in 4 passi, invito, «Pronto», primo Oggi                                                                                                                                          |
| [`email/`](email/note.md)                           |  16 | 8     | Le mail viste sul telefono (i file veri sono in `docs/mockup/mail/`)                                                                                                                                                                     |
| [`notifiche/`](notifiche/note.md)                   |   4 | 5     | Notifiche A/B con riepilogo, come riceverle (scelta B con riepilogo)                                                                                                                                                                     |
| [`ricerca/`](ricerca/note.md)                       |   2 | 5     | Ricerca                                                                                                                                                                                                                                  |
| [`profilo/`](profilo/note.md)                       |   1 | 5     | Profilo semplificato                                                                                                                                                                                                                     |
| [`animali/`](animali/note.md)                       |  50 | 5     | Animali: profilo, modifica, scadenze, cose di ogni giorno a turno, Oggi, Casa, spesa, calendario, Zampe                                                                                                                                  |
| [`turni/`](turni/note.md)                           |   5 | 5     | Turni semplificati                                                                                                                                                                                                                       |
| [`liste/`](liste/note.md)                           |   6 | 5     | Liste da riusare (a, scelta) e alternativa (b)                                                                                                                                                                                           |
| [`ricette/`](ricette/note.md)                       |  32 | 5, 6  | Ricette: sfogliare, scheda, cucinare, ricette di casa scritte a mano, crediti foto (vale il Passo 6, file `rc1-*`; il Passo 5 resta come struttura)                                                                                      |
| [`pasti/`](pasti/note.md)                           |   6 | 5     | Pasti della settimana                                                                                                                                                                                                                    |
| [`riepilogo/`](riepilogo/note.md)                   |   4 | 5     | Riepilogo della domenica e «La settimana passata»                                                                                                                                                                                        |
| [`chiedi/`](chiedi/note.md)                         |   6 | 5     | «Chiedi a …» unito, energia, conversazioni recenti                                                                                                                                                                                       |
| [`gamification/`](gamification/note.md)             |  30 | 5     | Grazie, festa, traguardi, sfide, equilibrio, Tempo insieme, Stare bene                                                                                                                                                                   |
| [`piani/`](piani/note.md)                           |  18 | 5, 6  | Plus, Plus Max e pagamento sul web (vale il Passo 6)                                                                                                                                                                                     |

## Dove trovo una funzione

Perimetro deciso da Francesco il 24/11/2026: si sviluppa tutto da ora; pagamenti e Plus in un secondo momento; il calendario dei rilasci si decide dopo. La tabella completa, con il passo di ogni schermata e cosa manca, è in [`decisioni-fable.md`](decisioni-fable.md).

**Lancio**

| Funzione                                                            | Cartelle                                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Oggi, splash, sfondo della cima                                     | `oggi/`, `splash-p9/`, `decisioni-p8/`, `scelte-p7/`, `ritocchi-p6/`     |
| Aggiungi con una frase, foglio «Nuovo impegno»                      | `pagine-mancanti-p7/`, `decisioni-p8/` (`ap1-36`–`ap1-43`), `splash-p9/` |
| Impegni con ripetizioni, chi lo vede, chi accompagna e chi riprende | `app-fase-b/`, `decisioni-p8/`, `calendario/`, `pagine-mancanti-p7/`     |
| Calendario (settimana, mese, giorno) e calendario condiviso         | `calendario/`, `decisioni-p8/` (`ap1-23`–`ap1-30`), `splash-p9/`         |
| Liberi insieme                                                      | `calendario/`, `oggi/`                                                   |
| Sintesi del mattino                                                 | `pagine-mancanti-p7/`, `decisioni-p8/`                                   |
| Notifiche, notifiche push                                           | `notifiche/`, `app-fase-b/`, `pagine-mancanti-p7/`                       |
| Ricerca                                                             | `ricerca/`, `app-fase-b/`                                                |
| Calendari collegati (sola lettura), «Collega»                       | `app-fase-b/`, `avvio/`, `scelte-p7/`, `ritocchi-p6/`                    |
| Spesa, da fare, scadenze                                            | `casa/`, `app-fase-b/`                                                   |
| Benvenuto del nuovo membro, lista di partenza                       | `avvio/`, `oggi/`, `decisioni-p8/` (`ap1-31`–`ap1-35`)                   |
| Profilo dei figli                                                   | `app-fase-b/`                                                            |
| Animali                                                             | `animali/`                                                               |
| Lista desideri                                                      | `app-fase-b/` (la pagina pubblica è nel secondo canvas, non ancora qui)  |
| Accesso, primo avvio, invito                                        | `avvio/`, `pagine-mancanti-p7/`, `scelte-p7/` (sblocco, proposta)        |
| Il tuo Nest e membri, profilo, impostazioni, account e privacy      | `app-fase-b/`, `profilo/`, `scelte-p7/`, `pagine-mancanti-p7/`           |
| Esplora e Spazi, Novità, Proposte                                   | `app-fase-b/`, `scelte-p7/`, `funzioni-fase-c/`, `componenti/` (`ap1`)   |
| Privacy e termini, pagine di sistema                                | `pagine-mancanti-p7/` (privacy e termini sono disegnati solo in parte)   |
| Navigazione nuova                                                   | `oggi/`, `scelte-p7/`                                                    |
| Mail                                                                | `docs/mockup/mail/` (file veri), `email/`, `pagine-mancanti-p7/`         |

**Dopo il lancio, da sviluppare già:** turni (`turni/`), compleanni e calendario scolastico (`app-fase-b/`, `funzioni-fase-c/`, `decisioni-p8/`), riepilogo della domenica (`riepilogo/`), liste da riusare (`liste/`), ricette e crediti foto (`ricette/`, `decisioni-p8/`), pasti (`pasti/`, `ricette/`), «Chiedi a …» (`chiedi/`, `funzioni-fase-c/`), documenti e conti, contatti, nonni e babysitter (`funzioni-fase-c/`, `componenti/`), gamification e Tempo insieme (`gamification/`), sfondi (`oggi/`).

**In un secondo momento:** pagamenti e Plus (`piani/`).

**In attesa:** Routine, «trillo» (ex Citofona). **Dopo il lancio, non ancora disegnati:** tema scuro, tablet.

## Cosa è escluso

- **Computer e web da telefono:** nel secondo canvas di Fable (Passi 10–11), estratti a parte in [`docs/design/computer/`](../computer/LEGGIMI.md). Lì stanno anche la pagina pubblica della lista desideri e la pagina di invito aperta da chi non ha l'app. Le poche tavole «al computer» del Passo 5 non sono state estratte.
- **Tema scuro e tablet:** non ancora disegnati.
- **Routine** (in attesa) e **«trillo»** (ex Citofona, da ristudiare).
- **Logo:** in pausa; nelle schermate c'è il segnaposto 5A.
- Le tavole dei giri precedenti (Fasi 1–3, Passo 4): archivio, non estratte.
- Le versioni da computer delle mail: i file veri sono già in `docs/mockup/mail/`.

## Regole fisse

- **Il nome del prodotto viene da un punto solo.** Nel canvas è il componente `CNome`; nell'app un solo modulo condiviso. Oggi il segnaposto è «FamilyNest»: il nome definitivo si inserisce prima della pubblicazione cambiando quel punto. Vale anche per «Chiedi a …», «Energia di …», «Il tuo …» e per il marchio.
- **Dati di prova:** Marco (corallo), Laura (glicine), Sofia 9 anni, nata il 14 maggio 2017 (menta), Tommaso (blu), il cane Biscotto (ambra), il gatto Miele (cannella); oggi è mercoledì 18 novembre; nuoto di Sofia 17:00–18:30, calcio di Tommaso 18:00–19:00. Negli esempi e nei test si usano questi.
- **Niente dati sanitari dei figli** (D1): nessun campo, icona o esempio di salute delle persone. Vaccini e visite degli animali sono ammessi (D1, aggiunta del 24/11).
- **Niente «Importa una ricetta da un link»** (tolto il 19/11): le ricette di famiglia si scrivono a mano, con foto propria facoltativa; le foto del catalogo vengono da Pexels e Unsplash, con il credito.
- **Splash:** breve 1,4 s alle riaperture, lungo alla prima apertura del giorno o dopo un aggiornamento, sempre in dissolvenza, mai uno stacco.
- **Componenti 2.0:** freccia indietro D, righe toccabili con la freccia sottile B, «Collega» forma 1, Spazi con le prime quattro voci a tessere, Esplora dentro Spazi.

## Limiti dell'estrazione

- Schermate fotografate con il motore del canvas in una copia locale: font Figtree caricato, icone e foto del canvas. Nelle cartelle senza foto i colori sono ridotti a 256 per contenere il peso: **i valori esatti dei colori si prendono da `tokens.md`, non dalle PNG**.
- Le note sono il testo che Fable ha scritto sotto o accanto a ogni schermo; in qualche caso etichetta e nota risultano unite in una riga.
