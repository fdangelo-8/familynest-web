# Decisioni del Passo 17 (domande 212–219) e regole per chi sviluppa

Fonti:

- **Testo delle domande**: indice del primo canvas («FamilyNest: nuovo design», https://claude.ai/artifact/8VKqAujpP3P8TmqSyetXfE, `project/Indice.dc.html`, versione 1795714346-c681).
- **Risposte di Francesco**: confermate il 26/11/2026, dopo il giudizio sul Passo 17. Valgono come decisioni esplicite: vincono sulle tavole, anche su quelle di questa cartella e di `docs/design/telefono/` e `docs/design/computer/`.
- **Tavole**: secondo canvas («FamilyNest: computer e web da telefono», https://claude.ai/artifact/PVgH6JrYhzhkPXu6js4Ktc, versione 1795711570-0525), pagine «Passo 16 · Tablet · …» e «Passo 17 · …».

Regola di precedenza: vale il passo più recente (17 > 16 > … > 10). Le decisioni qui sotto vincono sulle tavole.

## Regole per chi sviluppa (sintesi)

| #   | Regola                                                                                                                                                                                                              | Formati                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 212 | Taglia e numero di scarpe stanno in un campo a parte, «Solo per noi», che la lista aperta da link non mostra mai. Il resto della nota si vede. I prezzi dal link si vedono come «circa», uguali su tutti i formati. | tutti                     |
| 213 | Il telefono girato in orizzontale (finestra alta meno di 600 px) segue la regola, senza una tavola dedicata.                                                                                                        | telefono, web da telefono |
| 214 | Un'unica serie di soglie per tutta l'app: 900 e 1280 px di larghezza; sotto i 600 px di altezza sempre la forma del telefono.                                                                                       | tutti                     |
| 215 | Sul computer, nel calendario, un'ora è alta 45 px e le righe delle ore cadono sulle ore. La tavola approvata ha le righe ogni 40 px: è un errore, non va copiato.                                                   | computer                  |
| 216 | Sul computer, in Casa · Spesa, il campo «Aggiungi alla spesa» è alto 48 px. La tavola lo mostra a 20 px per errore.                                                                                                 | computer                  |
| 217 | Nessun comando ha un'area di tocco sotto i 44 px. Si allarga l'area senza cambiare il disegno. È una regola dei test automatici.                                                                                    | tutti                     |
| 218 | Nel mese sul tablet, col dito si tocca la cella e si apre l'elenco del giorno. Con mouse o trackpad si usa come sul computer.                                                                                       | tablet                    |
| 219 | Si tiene l'icona del piatto, ridisegnata nello stile della serie (stesso tratto, stessa misura). Se non si riesce, forchetta e coltello della serie, purché l'icona sia una sola dappertutto.                       | tutti                     |
| —   | Al buio la barretta di Tommaso è **#4E7BE2** (`--c-tommaso-barra`), non #3F6FE0.                                                                                                                                    | tutti                     |
| —   | Due ruoli nuovi della tavolozza per le icone dei Piani: `--c-piano-icona-1` e `--c-piano-icona-2` (sotto).                                                                                                          | tutti                     |

## Le domande con le risposte

**212.** Lista dei desideri dal link: propongo che taglia e numero stiano in un campo a parte, «Solo per noi», che la pagina dal link non mostra mai; il resto della nota si vede. Va bene, o dal link si mostra solo il titolo dell'idea?
→ **Risposta:** sì, il campo «Solo per noi». Taglia e numero di scarpe stanno lì e la lista aperta da link non lo mostra mai, su nessun formato. Il resto della nota («Regolabili», «Quello con i gatti») si vede. **I prezzi dal link si vedono, scritti come «circa»** («circa 45 €»), uguali su telefono, web da telefono, computer e tablet.
Per chi sviluppa: il campo è separato nel dato, non un pezzo di testo da filtrare; la pagina pubblica non lo legge nemmeno (vale D2 e la lezione «si legge e si restituisce solo ciò che la pagina mostra»). La tavola del computer del Passo 11 con la nota «la taglia 134 si vede» è superata. Tavole: `docs/design/computer/web-da-telefono-e-senza-account-p12-16/p17-…` e `docs/design/telefono/web-da-telefono-e-senza-account-p12-16/p17-…`.

**213.** Telefono girato in orizzontale (finestra alta meno di 600 px): la regola è scritta, una tavola disegnata non c'è. Serve prima dello sviluppo, o basta la regola?
→ **Risposta:** basta la regola. Sono le pagine del telefono, più larghe e più basse. Chi sviluppa lo prova su un telefono vero e, se qualcosa non torna, scrive nella issue.

**214.** Soglie: nella tavola delle regole del computer la barra a icone partiva sotto i 1100 px e il disegno per telefono sotto i 760. Con il tablet le soglie sono 1280 e 900 px: ho allineato la tavola a queste. Confermi?
→ **Risposta:** sì. Un'unica serie di soglie per tutta l'app:

| Finestra                                 | Forma                                                                                                                                                      |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| alta meno di 600 px, qualunque larghezza | telefono (barra in basso, una colonna)                                                                                                                     |
| larga meno di 900 px                     | telefono; sul tablet in verticale liste e moduli in una colonna di 640 px, fogli dal basso, mese a griglia                                                 |
| da 900 a 1279 px (e alta almeno 600)     | computer con la barra laterale a sole icone, dettaglio nel pannello a destra (380 px), «Nuovo impegno» in una finestra, «Chi vedo» dove i volti non stanno |
| da 1280 px                               | computer, barra laterale intera                                                                                                                            |

I valori 1100 e 760 px di `docs/design/computer/regole.md` e della tavola `docs/design/computer/regole/01-…` sono superati: la tavola aggiornata è `docs/design/computer/regole/p17-01-…`.

**215.** Computer, calendario: le righe leggere delle ore sono disegnate ogni 40 px, mentre un'ora è alta 45: non coincidono. Lo correggo o lo sistema chi sviluppa?
→ **Risposta:** lo sistema chi sviluppa. **Sul computer un'ora è alta 45 px e le righe leggere cadono sulle ore.** La tavola approvata ha le righe ogni 40 px: è un errore del foglio, non va copiato. Sul tablet col tocco un'ora è alta 47 px (impegno di un'ora alto 44) e le righe coincidono già.

**216.** Computer, Casa · Spesa: nella tavola il campo «Aggiungi alla spesa» è schiacciato a 20 px invece di 48. Lo correggo anche sul computer?
→ **Risposta:** lo sistema chi sviluppa. **Sul computer il campo «Aggiungi alla spesa» è alto 48 px**, come sul telefono e sul tablet. La tavola lo mostra a 20 px per errore.

**217.** Telefono: alcuni comandi hanno l'area visibile sotto i 44 px («Giorno · Settimana · Mese» 38 px, «Tutti» e la lente «Io · Nest» 36, frecce del mese larghe 40, nome di una cosa nella spesa 38, pastiglie dei filtri e pulsanti piccoli 40). Sul tablet sono a 44. In sviluppo si estende l'area di tocco, o si ridisegna il telefono?
→ **Risposta:** non si ridisegna. **Su tutti i formati nessun comando ha un'area di tocco sotto i 44 × 44 px**: si allarga l'area (padding, pseudo-elemento, riga intera toccabile) senza cambiare il disegno. Vale anche per l'interruttore «Tutto il giorno» del foglio «Nuovo impegno» (50 × 30 px): si tocca tutta la riga. **Diventa una regola dei test automatici**: un test misura l'area di tocco di ogni comando con `elementFromPoint` (lezione in `LEZIONI.md`), su tutti i formati.

**218.** Mese sul tablet, col tocco: si tocca la cella del giorno e si aprono gli impegni di quel giorno; rispetto al computer serve un tocco in più. Va bene?
→ **Risposta:** sì. **Col dito si tocca la cella e si apre l'elenco del giorno** (righe da 48 px). **Con mouse o trackpad il mese si usa come sul computer** (clic sul titolo dell'impegno). Conta l'ultimo gesto, come per i 44 px.

**219.** L'icona del piatto è nuova, disegnata per questo passo: è l'unica non presa dalla serie. La teniamo, o forchetta e coltello, che nella serie ci sono già?
→ **Risposta:** si tiene il piatto, **ridisegnato nello stile della serie** (stesso spessore del tratto, stessa misura, stessa griglia). Se in sviluppo non si riesce, si usano forchetta e coltello della serie. In ogni caso **l'icona è una sola dappertutto**: Ricette, scheda della ricetta, Pasti, «Stasera», su tutti i formati. «Cena fuori» tiene l'icona del calendario.

## Altre regole del Passo 17

- **Barretta di Tommaso al buio: #4E7BE2** (`--c-tommaso-barra`, 3,5 : 1 sul fondo dell'impegno #1B2D49). Le tavole del tablet al buio usano #3F6FE0 (3,0 : 1): non si copia. Chiude il «da chiarire» di `docs/design/tavolozza.md`.
- **Ruoli nuovi della tavolozza** (dal foglio di stile del canvas, `project/v2.css`; da 73 a 75 ruoli):

| Ruolo               | Uso                                      | Chiaro                                  | Scuro                                  |
| ------------------- | ---------------------------------------- | --------------------------------------- | -------------------------------------- |
| `--c-piano-icona-1` | Icona sul disco di Plus (pagina «Piani») | `#FFFFFF` (su #2F8F99, 3,8 : 1)         | `#10262A` (sul disco #8FD0CB, 9,0 : 1) |
| `--c-piano-icona-2` | Icona sul disco di Plus Max              | `#BFE5E1` (sul disco #10262A, 11,6 : 1) | `#0E5A66` (sul disco #EAF2EE, 6,9 : 1) |

Non sono ancora in `.claude/skills/design-system/riferimento/token.md`: li aggiunge il designer (la configurazione in `.claude/` non si tocca da questo branch).

- **«Nessuno, per ora»** in «Chi porta, chi riprende» usa il testo secondario (`--c-testo2`) su tutti i formati; che il viaggio sia scoperto lo dice «1 viaggio scoperto», in alto, con il ruolo dell'errore.
- **Segnaposto delle ricette senza foto**: sabbia (`--c-segnaposto`) con l'icona del piatto (`--c-segnaposto-testo`), anche nei Pasti su computer e tablet.
- **Splash**: la nota dello splash scuro dice «resta solo il colore del cielo» (non «solo azzurro»); sul tablet in verticale lo splash non copre più l'accesso.
- **Tablet, i 44 px col tocco**: le misure del tocco valgono quando l'ultimo gesto è stato un tocco; con mouse e tastiera tornano quelle del computer. Le lettere delle scorciatoie compaiono solo con una tastiera collegata.
- **Stati del tablet** (vuoto, caricamento, errore, senza rete) e «altre pagine» al buio non hanno tavole proprie: seguono le regole (telefono in verticale, computer in orizzontale, tavolozza scura).

## Le risposte 206–211 (già date, applicate nel Passo 17)

| #   | Risposta                                                                 | Dove                                            |
| --- | ------------------------------------------------------------------------ | ----------------------------------------------- |
| 206 | Almeno una tavola disegnata con i comandi a 44 px in orizzontale         | `orizzontale-comandi-44-px/`                    |
| 207 | Liste e moduli in una colonna centrale di circa 640 px, in verticale     | `verticale/`                                    |
| 208 | Soglia di 900 px; sotto i 600 px di altezza sempre la forma del telefono | `regole/`, risposta 214                         |
| 209 | Mese in verticale con la griglia del computer e i titoli                 | `verticale/`                                    |
| 210 | Icona del piatto uniformata, anche nei Pasti                             | `correzioni/` e cartelle di telefono e computer |
| 211 | Scena di Oggi ridisegnata per il tablet, con il tetto intero (768 × 300) | `verticale/`                                    |
