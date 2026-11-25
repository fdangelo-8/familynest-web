# Token per computer e web da telefono: solo quelli nuovi o diversi

Confronto con `docs/design/telefono/tokens.md` (canvas del telefono, versione 1795357421-5c16). Qui c'è solo quello che il secondo canvas aggiunge o cambia; tutto il resto (colori principali, colori delle persone nei pallini, tipografia dei Componenti 2.0, raggi, ombre, movimenti) vale come sul telefono.

Fonte: canvas «FamilyNest: computer e web da telefono» (https://claude.ai/artifact/PVgH6JrYhzhkPXu6js4Ktc, versione 1795605754-95ff). Gli stili per computer non stanno in un file condiviso: ogni tavola li ripete nel proprio `<style>`; il riferimento di riga è `project/D-AC1.dc.html` (le altre tavole hanno lo stesso blocco). I file condivisi (`v2.css`, `palette.css`, `giro2.css`, `giro3.css`, `app.css`) hanno le stesse variabili del telefono; l'unica aggiunta che riguarda le tavole finali è la dissolvenza dello splash (vedi `splash.md`).

## Misure del guscio

| Elemento                                                           | Valore                                                                                                                              | Riga                     |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Barra laterale                                                     | 248 px, fondo #F5F7F5, filo a destra `--hr` (#E4E8E5), padding 18/12/14                                                             | D-AC1:25                 |
| Barra laterale a icone (finestra sotto 1100 px, o pannello aperto) | 72 px, voci quadrate di 48 px                                                                                                       | D-AC1:47                 |
| Voce della barra                                                   | alta 44, raggio 12, 600 · 15/20, colore #33474B; icona 22                                                                           | D-AC1:31                 |
| Lente «Io · Nest» nella barra                                      | capsula #E6EAE7, segmenti alti 32, scelto #10262A con testo bianco                                                                  | D-AC1:28–30              |
| «Chiedi a Nest» in fondo alla barra                                | alto 48, raggio 14, fondo #FCE7E0, icona #C2452D, `kbd` con filo #E7B9AB; scelto: filo interno 1,5 px #C2452D                       | D-AC1:40–42, 376         |
| Titoletto «Di casa»                                                | 600 · 12,5/16, #6B7C7F                                                                                                              | D-AC1:38                 |
| Barra in alto                                                      | alta 72, padding orizzontale 32; titolo 700 · 26/32, -0,4 px                                                                        | D-AC1:50–51              |
| Campo di ricerca                                                   | 280 px (min 120), alto 40, raggio 12, fondo #F1F3F1; con il fuoco 400 px, fondo bianco, anello 2 px #0F3D44                         | D-AC1:54, 57, 247        |
| Pulsante da computer `.dk-bt`                                      | alto 40, raggio 12, 700 · 15/20; piccolo alto 32, raggio 10, 14 px                                                                  | D-AC1:61, 68             |
| Contenuto                                                          | padding 4/32/0, distanza fra colonne 32 px                                                                                          | D-AC1:70                 |
| Pannello a destra                                                  | 420 px, filo a sinistra, testata alta 64, piede con filo in alto                                                                    | D-AC1:91–97              |
| Finestra al centro                                                 | 560 px (stretta 420, media 480, larga 760), raggio 20, ombra `0 24px 64px rgba(16,38,42,.26)`, alta al massimo la pagina meno 80 px | D-AC1:100, 101, 302, 353 |
| Velo dietro la finestra                                            | rgba(16,38,42,.36)                                                                                                                  | D-AC1:99                 |
| Fumetto                                                            | 300 px, padding 8, raggio 14, ombra `0 0 0 1px var(--hr), 0 12px 32px rgba(16,38,42,.18)`; righe alte 38, raggio 9                  | D-AC1:102–103            |
| Avviso in basso (toast)                                            | alto almeno 48, raggio 14, fondo #10262A, 600 · 15/20, a 28 px dal fondo                                                            | D-AC1:291                |
| Tasto disegnato `kbd`                                              | 20 × 20 minimo, raggio 5, filo #CBD3CF, 600 · 11,5, #55686C                                                                         | D-AC1:24                 |
| Cornice della tavola                                               | raggio 14, filo `0 0 0 1px #D9DEDB` (solo presentazione nel canvas)                                                                 | D-AC1:22                 |

## Pagine

| Elemento                             | Valore                                                                                                                                      | Riga                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Cima di Oggi (fascia)                | saluto 500 · 34/40, -0,6 px (nome 700); data 15/20; conti 700 · 24/28 con etichetta 13,5/18; scena 400 × 172, raggio 20 (piccola 300 × 156) | D-AC1:80–88              |
| Accesso a due metà                   | scena a sinistra con fondo #0B2A31, titolo 700 · 40/46, testo #C9D8D6; modulo a destra largo 560 con padding 88                             | D-AC1:111–116            |
| Settimana con le ore                 | colonna delle ore 52 px; righe d'ora di 40 px con filo #EEF1EF; giorno senza scuola #F6F8F6                                                 | D-AC1:130–139            |
| Settimana a corsie                   | colonna dei nomi 132 px; celle alte almeno 64                                                                                               | D-AC1:207                |
| Mese                                 | intestazioni alte 28; giorno fuori mese #F8F9F8 con testo #93A0A2; senza scuola #EEF1EF; «liberi insieme» #FEF8E3                           | D-AC1:149–154            |
| Segmenti (Giorno · Settimana · Mese) | fondo #EEF1EF, raggio 11, segmento alto 32                                                                                                  | D-AC1:127–129            |
| Riga di elenco a sinistra `.dk-li`   | alta almeno 56, raggio 14; scelta #F1F3F1, mouse sopra #F7F8F7                                                                              | D-AC1:165–175            |
| Tessere `.dk-tl`                     | larghe almeno 220 px, alte almeno 112, raggio 18, distanza 16; scelta: filo 2 px #10262A; nuova: tratteggio 1,5 px #B9C4C0                  | D-AC1:221–228            |
| Campo da computer `.dk-fd`           | alto 48, raggio 14, filo 1,5 px #B9C4C0; con il fuoco 2 px #0F3D44                                                                          | D-AC1:229–230            |
| Colonne di lettura                   | «Chiedi a …» 680 px; Impostazioni 600 px; pagine senza account 680 px (960 su due colonne); pagamento 1000 px                               | D-AC1:381, 392, 423, 400 |
| Titoli delle ricette (Fraunces)      | 36/40 nella copertina, 34/38 nella scheda, 20/24 nelle tessere                                                                              | D-AC1:309 e seguenti     |

## Stati del mouse e del fuoco (nuovi: sul telefono non ci sono)

| Stato                                            | Valore                                                                     | Riga          |
| ------------------------------------------------ | -------------------------------------------------------------------------- | ------------- |
| Fuoco                                            | `outline: 2px solid #0F3D44; outline-offset: 2px` (bianco sui fondi scuri) | D-AC1:69      |
| Mouse sopra, voce della barra                    | #E9EDEA                                                                    | D-AC1:35      |
| Mouse sopra, pulsante pieno                      | #0A2E34                                                                    | D-AC1:66      |
| Mouse sopra, pulsante quieto e righe del fumetto | #E4E8E5 (pulsante) · #F1F3F1 (riga)                                        | D-AC1:67, 105 |
| Impegno scelto nel calendario                    | filo 2 px #0F3D44 attorno                                                  | D-AC1:144     |
| Impegni sovrapposti                              | filo 1,5 px `--rd` (#B3261E)                                               | D-AC1:145     |

## Colori nuovi o diversi

### Impegni nel calendario da computer (barretta `--cl` e fondo `--bg`)

| Persona                           | Barretta                                      | Fondo   | Sul telefono                                          |
| --------------------------------- | --------------------------------------------- | ------- | ----------------------------------------------------- |
| Marco (pM)                        | #F2765C                                       | #FDEBE6 | uguale la barretta; tinta #FDEAE5                     |
| Laura (pL)                        | #B9A2EC                                       | #F1ECFB | uguale la barretta; tinta #F2ECFC                     |
| Sofia (pS)                        | #8FD0A8                                       | #E6F4EC | uguale la barretta; tinta #E7F5EC                     |
| Tommaso (pT)                      | #3F6FE0                                       | #E4ECFB | uguale la barretta; tinta #E5ECFC                     |
| Biscotto (pB)                     | **#D9972F**                                   | #F9EEDB | diverso: sul telefono ambra #E8A15C, tinta #FCEEDD    |
| Miele (pC, solo nelle corsie)     | **#B8663A**                                   | #F6E7DC | diverso: sul telefono cannella #AF8273, tinta #F5ECE8 |
| Liberi insieme (pY)               | #E2B93B                                       | #FCEFC0 | sul telefono #F6C945                                  |
| Senza persona (pK)                | #55686C                                       | #EEF1EF | nuovo                                                 |
| Occupato, senza titolo (`.lc.oc`) | righe a 135° #F1F3F1 / #E6EAE7, testo #55686C |         | nuovo                                                 |

Righe D-AC1:143 (settimana), 218 (occupato), 161 (mese), 216 (corsie). La barretta è un'ombra interna di 3 px a sinistra (`inset 3px 0 0 var(--cl)`). Attenzione: nella sezione 1 del messaggio del Passo 12 Francesco ha chiesto barrette più scure (contrasto almeno 3:1 sul fondo), con valori nuovi per ogni persona: questi valori cambieranno.

### Linea di «adesso» nel calendario

#E2B93B, alta 2 px, con il pallino di 8 px (D-AC1:147). Sul telefono «adesso» è #F6C945.

### Grigi e superfici nuovi

| Valore                             | Uso                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| #F5F7F5                            | fondo della barra laterale e dei riquadri pieni `.dk-card.fl`                                                 |
| #F1F3F1                            | campo di ricerca, pulsante quieto, riga scelta, barra del browser disegnata (`.wbb`)                          |
| #EEF1EF                            | segmenti, righe d'ora, giorni senza scuola, fondo degli impegni senza persona                                 |
| #E6EAE7                            | lente «Io · Nest» nella barra laterale                                                                        |
| #E9EDEA                            | voce della barra con il mouse sopra                                                                           |
| #E1E5E2                            | trattini dei passi non ancora fatti (primo avvio)                                                             |
| #DCE2DF                            | trattini dei passi nella cucina; filo della barra del browser                                                 |
| #D9DEDB                            | cornice delle tavole nel canvas                                                                               |
| #CBD3CF                            | filo dei tasti disegnati                                                                                      |
| #B9C4C0                            | filo dei campi da computer e tratteggio delle tessere «nuovo»                                                 |
| #FAFBFA, #F8F9F8, #F7F8F7, #F6F8F6 | colonna di oggi nelle corsie, giorni fuori mese, riga con il mouse sopra, giorni senza scuola nella settimana |
| #33474B                            | testo delle voci della barra e dei segmenti                                                                   |
| #6B7C7F                            | titoletto «Di casa»                                                                                           |
| #93A0A2                            | numeri dei giorni fuori mese                                                                                  |
| #0A2E34                            | pulsante pieno con il mouse sopra                                                                             |
| #0B2A31                            | fondo della scena dell'accesso (lo stesso del fondo dello splash)                                             |
| #C9D8D6                            | testo sulla scena dell'accesso                                                                                |
| #FCE7E0, #C2452D, #E7B9AB          | «Chiedi a Nest» nella barra laterale                                                                          |
| #FEF8E3                            | giorno «liberi insieme» nel mese                                                                              |
| #F1E9DD, #5B5145                   | segnaposto delle ricette senza foto                                                                           |
| #E8EFED                            | testo secondario sulle foto delle ricette                                                                     |
| #0E5A66                            | pulsanti della finestra di sistema del browser (web da telefono, `.sy10`)                                     |

## Tipografia nuova

| Uso                                   | Valore                            |
| ------------------------------------- | --------------------------------- |
| Titolo della barra in alto            | 700 · 26/32, -0,4 px              |
| Saluto di Oggi                        | 500 · 34/40, -0,6 px              |
| Titolo dell'accesso                   | 700 · 40/46, -0,8 px              |
| Voce della barra laterale             | 600 · 15/20                       |
| Pulsante da computer                  | 700 · 15/20 (piccolo 14)          |
| Impegno nella settimana               | 12/15 (stretto 11/13), titolo 700 |
| Impegno nel mese                      | 11/18                             |
| Testata del pannello e della finestra | 700 · 18/24                       |
| Tasto disegnato                       | 600 · 11,5                        |

## Movimento (computer)

| Che cosa                                               | Tempo                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| Barra laterale che si stringe mentre entra il pannello | 200 ms; movimento ridotto: cambio immediato                              |
| Finestra al centro                                     | 180 ms, dissolvenza e scala dal 97%; movimento ridotto: solo dissolvenza |
| Passi del primo avvio                                  | dissolvenza 200 ms; la scena sfuma tra sera e giorno in 400 ms           |
| Spunta della spesa con Spazio                          | si riempie in 150 ms                                                     |
| Cucina, da un passo all'altro                          | dissolvenza 200 ms                                                       |

Il mouse non aggiunge movimenti: niente ombre che compaiono, solo il cambio di fondo.

## Web da telefono

Nessun token nuovo per le pagine: sono quelle dell'app. Nuovi solo gli elementi disegnati del browser (barra dell'indirizzo `.wbb`: alta 50, fondo #F1F3F1, campo bianco alto 36 raggio 10; finestra di sistema `.sy10`: raggio 16, ombra `0 18px 48px rgba(16,38,42,.3)`, velo rgba(16,38,42,.36)). Il dominio è il segnaposto «[DOMINIO]».
