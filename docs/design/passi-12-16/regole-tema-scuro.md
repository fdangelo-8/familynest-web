# Regole del tema scuro (telefono, web da telefono, computer)

> Archiviato il 26/11/2026. `tavolozza.md` è `docs/design/tavolozza.md`; le cartelle citate sono le aree, in `docs/design/computer/<area>-p12-16/` e `docs/design/telefono/<area>-p12-16/`. Le tavole scure in `scuro-derivato/` non le ha disegnate Fable: vedi `LEGGIMI.md`. Traduzione per l'app: skill `design-system`, `riferimento/token.md`.

Dai Passi 14–16 del secondo canvas di Fable e dalle risposte di Francesco (196–205). **Decisione di Francesco: il tema scuro esce al lancio.** I valori sono in `tavolozza.md`; le tavole scure sono nelle cartelle per area (file `…-scuro.png`).

## 1 · Come si accende

- Segue l'impostazione del sistema (`prefers-color-scheme`).
- In Impostazioni › Aspetto c'è la scelta «Chiaro / Scuro / Come il sistema» (tavole «Aspetto» e «Impostazioni · Aspetto», cartella `accesso-profilo-impostazioni/`). La scelta vince sul sistema.
- Nessuna pagina è ridisegnata: sono le tavole approvate con i valori scuri della tavolozza. Si cambia in un punto solo: un blocco di variabili per il chiaro e uno per lo scuro, con gli stessi nomi di ruolo. Nessun colore scritto a mano nei componenti.

## 2 · La scena: al buio è sempre la notte

- Al buio la scena di Oggi è **sempre la notte**, anche di giorno: mai un rettangolo luminoso in mezzo alla pagina scura (risposte 198 e 204). Niente scena della sera al buio: ha l'orizzonte arancione, ancora luminoso.
- Cielo #081A33 → #1E3A5C, stelle, falce di luna, colline #1F3F50 e #16303E, casa #C9D3DA con la finestra accesa #FFDFA8 (tabella completa in `tavolozza.md` §4).
- La scena è un'immagine: i suoi colori non passano dai ruoli e non si invertono. Si scambia l'immagine (giorno/notte), non si filtra.
- Il fondo dietro la scena e l'anteprima dello sfondo «Semplice» usano `--c-scena` (#1D3536 al buio).
- Lo splash scuro e Oggi usano la stessa scena.

## 3 · Le foto non si invertono

- Foto delle ricette, degli animali, delle persone, i campioni degli sfondi: restano come sono, nessun filtro, nessuna inversione.
- I veli e i testi bianchi sopra le foto restano scritti a mano (sono sopra un'immagine).
- Le ricette e i Pasti senza foto usano un solo segnaposto color sabbia con l'icona del piatto: `--c-segnaposto` #F1E9DD / #2E2A22, icona e testo `--c-segnaposto-testo` #5B5145 / #D9CDB8 (risposta 205). Il piatto ovunque arriva con il Passo 17 (risposta 210): chi sviluppa lo usa già.
- Le miniature delle idee hanno i loro ruoli scuri (`--c-idea-1/2/3`).

## 4 · Le email restano chiare

Le mail di servizio non hanno il tema scuro: restano chiare anche quando il telefono è al buio (messaggio del Passo 14). Non si aggiunge `prefers-color-scheme` alle mail; i file sono quelli di `docs/mockup/mail/`. Se un programma di posta le scurisce da sé, è un suo comportamento: va solo controllato che restino leggibili.

## 5 · Lo splash scuro

- Stessa dissolvenza e stessi tempi dello splash chiaro (breve 1,4 s; lungo 2,9 s con il respiro di 100 ms; verso lo sblocco), tavole in `splash-scuro/`.
- Il fondo parte dal colore di marca `--c-notte` #0B2A31 (uguale nei due temi), passa per `--c-cielo-mezzo` **#0D2238** e arriva a `--c-cielo` **#12294A**, il cielo della scena della notte. **Niente azzurro chiaro** a metà dissolvenza: prima diventava #BBE1F4 su tutto lo schermo e sembrava un lampo (corretto nel Passo 15).
- Poi emerge Oggi con la scena della notte.
- Il logo sul fondo di marca usa `--c-logo-a-notte` #F2F6F3 e `--c-logo-b-notte` #8FD0CB.
- In attesa del Passo 17: la nota «solo azzurro» sotto lo splash scuro va pulita, e lo splash non deve coprire l'accesso. Valgono i valori qui sopra, non quella nota.

## 6 · Il pallino delle persone

Una regola sola, uguale in chiaro e al buio (Passo 16):

- **Scelto**: colore pieno della persona (non cambia al buio), iniziale scura #10262A; bianca solo sul blu di Tommaso.
- **Non scelto**: il colore della persona al 30% sopra il fondo della pagina, iniziale nel colore del testo (scura in chiaro, chiara al buio).
- Iniziale sempre almeno a 4,5 a 1 (valori per persona in `tavolozza.md` §3). Chi è scelto ha anche la spunta o l'anello.
- Vale in ogni fila di volti e in ogni selettore di persone.

Al buio cambiano invece la barretta dell'impegno (torna al colore pieno della persona) e il fondo dell'impegno (una tinta scura del colore). Ora di «adesso»: testo scuro #10262A sul giallo #F6C945 nei due temi (10 a 1).

## 7 · Il verde petrolio #1F7D8A, con il bianco sopra

- Al buio il pulsante principale, le scelte fatte, l'interruttore acceso e l'accento sono **verde petrolio #1F7D8A** (`--c-pieno`, `--c-accento`) con il testo **bianco** (`--c-su`) sopra: 4,8 : 1 (risposta 196). Non si usano pulsanti chiari con il testo scuro.
- Contrasti del verde: 3,7 sul fondo, 3,2 su finestre e pannelli, 3,4 sulla barra laterale.
- Sul fondo «premuto» di una riga scelta scende a 2,6: lì il verde **non è mai l'unico segnale**, c'è sempre anche la spunta o il testo (risposta 202).
- In chiaro il fondo pieno resta #10262A e l'accento #0F3D44.

## 8 · Il bordo dei campi #869390

- In chiaro il bordo dei campi e il tratteggio delle tessere «aggiungi» sono **#869390** (3,2 : 1 sul bianco), su telefono e computer (risposta 197; prima il telefono aveva #AEB9B7, 1,9 : 1). Anche il campo di ricerca in alto ha questo filo.
- Al buio il ruolo `--c-campo` vale #7E9496 (5,6 sul fondo, 4,8 sulla superficie alzata).
- Il campo con il fuoco ha il filo scuro da 2 px; l'anello del fuoco al buio è #F2F7F5 (16,7 : 1).

## 9 · Soglie e controlli

- Testo almeno 4,5 a 1, elementi, bordi e barrette almeno 3 a 1, in chiaro e al buio (contrasti scuri in `tavolozza.md` §5).
- Un solo fuoco, sempre visibile, anche al buio.
- Errore al buio: testo #FF9D90 (9,0 sul fondo), fondo dell'avviso #3A1E1B, punto e pulsante pieno #C4483A. «1 viaggio scoperto» usa il ruolo dell'errore.
- In attesa del Passo 17: nella pagina «Piani» il colore #BFE5E1 va portato nella tavolozza e al buio le due icone devono stare almeno a 3 a 1.

## 10 · Che cosa resta da controllare

- Le tavole scure del canvas coprono le pagine principali (Passo 14), una prova per ogni altra pagina (Passi 14 e 15) e le correzioni (Passi 15 e 16). Per le altre tavole dei Passi 12–16 lo scuro di questo passaggio è stato **ottenuto applicando la tavolozza scura** alla tavola chiara (la stessa cosa che ha fatto Fable: «nessuna pagina è ridisegnata»), con la scena della notte al posto di quella del giorno. È segnato nel `note.md` di ogni area.
- Fable ha controllato il pallino in «Per chi», nel giorno e nelle corsie, non in ogni selettore: chi sviluppa lo verifica con i test di accessibilità.
- Barretta di Tommaso al buio: usare `--c-tommaso-barra` #4E7BE2 (vedi `tavolozza.md`, «Da chiarire»).
