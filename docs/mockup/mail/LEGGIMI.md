# Modelli delle mail · Passo 9

Modelli approvati da Francesco il 19/11/2026 (Passo 9 di Fable). Il nome del prodotto è sempre {{nome_prodotto}}: il nome provvisorio o definitivo si inserisce al momento dell'invio. Da provare nei programmi di posta veri (Gmail, Apple Mail, Outlook) con un servizio di anteprime prima del lancio.

Nove mail di servizio, pronte per lo sviluppo. Sono le otto del Passo 8 più la conferma a eliminazione avvenuta (risposta 159).

## Che cosa c'è

- `html/` — una mail per file. Struttura a tabelle, stili scritti dentro gli elementi, foglio largo al massimo 600 px, sola versione chiara.
- `testo/` — la stessa mail in solo testo, da spedire insieme all'HTML (messaggio in due parti). La prima riga è l'oggetto; le righe non superano 72 caratteri.
- `anteprime/` — foto dei modelli riempiti con i dati di prova, a 900 px (computer) e a 375 px (telefono).

| File | Quando parte | Pulsante | Il link vale |
|---|---|---|---|
| 01-password-dimenticata | richiesta di nuova password | Scegli una nuova password | 30 minuti, una volta |
| 02-invito-nella-casa | un adulto invita qualcuno | Entra in {{nome_casa}} | 7 giorni, una persona |
| 03-benvenuto | account appena creato, una volta sola | Apri {{nome_prodotto}} | non scade |
| 04-conferma-indirizzo | creazione dell'account | Conferma l'indirizzo | 24 ore (link e codice) |
| 05-ricevuta-pagamento | a ogni pagamento | Scarica la ricevuta | 30 giorni |
| 06-eliminazione-richiesta | richiesta di eliminare l'account | Annulla l'eliminazione | fino alla data di eliminazione |
| 07-eliminazione-avvenuta | il giorno dell'eliminazione | nessuno | – |
| 08-cambio-mail-nuovo-indirizzo | cambio di mail, al nuovo indirizzo | Conferma il nuovo indirizzo | 24 ore |
| 09-cambio-mail-vecchio-indirizzo | cambio di mail, al vecchio indirizzo | Non sono stato io: blocca il cambio | 7 giorni |

## Segnaposto

Tutti nella forma `{{nome_del_dato}}`, uguali nell'HTML e nel testo. I valori vanno inseriti già protetti per l'HTML.

Comuni a tutte: `{{nome_prodotto}}` (il nome dell'app: non è mai scritto a mano), `{{url_logo}}` (immagine del marchio, 160×32 px, meglio a doppia densità), `{{nome}}`, `{{link}}`, `{{scadenza_link}}` (a parole: «30 minuti», «7 giorni»), `{{ragione_sociale}}`, `{{indirizzo_societa}}`.

Per mail:
- invito: `{{chi_invita}}`, `{{chi_invita_nome_completo}}`, `{{nome_casa}}`
- benvenuto: `{{nome_casa}}`
- conferma dell'indirizzo: `{{codice}}`
- ricevuta: `{{piano}}`, `{{frequenza}}`, `{{mese_anno}}`, `{{periodo}}`, `{{data_pagamento}}`, `{{ultime_cifre}}`, `{{numero_ricevuta}}`, `{{iva}}`, `{{importo}}`, `{{data_rinnovo}}`, `{{partita_iva}}`, `{{nome_casa}}`
- eliminazione richiesta: `{{data_eliminazione}}` («2 dicembre»), `{{data_eliminazione_estesa}}` («mercoledì 2 dicembre»), `{{giorni_ripensamento}}`, `{{che_cosa_resta_della_casa}}`
- eliminazione avvenuta: `{{data_richiesta}}`, `{{che_cosa_resta_della_casa}}`, `{{giorni_segnalazione}}`
- cambio di mail: `{{mail_vecchia}}`, `{{mail_nuova_mascherata}}`

`{{che_cosa_resta_della_casa}}` è una frase intera, perché cambia con la casa. Con un altro adulto: «La casa resta a Laura, con gli impegni condivisi, la spesa e i profili di Sofia e Tommaso.» Se chi elimina è l'unico adulto: «Con il tuo account spariscono anche la casa e i profili dei figli.»

## Scelte di costruzione

- Una colonna sola. Su telefono il foglio va a tutta larghezza grazie a `max-width`; la regola `@media` nel blocco `<style>` serve solo a stringere i margini e a rimpicciolire il titolo. Se un programma toglie quel blocco la mail resta leggibile, con margini più larghi.
- Un solo pulsante pieno per mail: una cella con il colore di fondo e un link a blocco dentro. In Outlook per Windows la cella è colorata ma si tocca solo il testo; per questo sotto c'è sempre l'indirizzo per intero.
- Un'immagine sola, il marchio, con `alt="{{nome_prodotto}}"` e misure dichiarate: se le immagini sono bloccate si legge il nome.
- Il carattere è Figtree dove c'è, altrimenti quello di sistema. Nessun carattere viene scaricato.
- La mail dichiara di essere solo chiara (`color-scheme: light only`) e ogni colore di fondo è scritto anche come attributo `bgcolor`.
- La riga di anteprima è nel `div` nascosto in cima al corpo.
- Sono mail di servizio: non c'è «annulla l'iscrizione».

## Come le ho provate

Le prove automatiche le ha fatte Fable fuori dal repository, con i suoi script (non inclusi qui), su ogni file:
1. controllo del codice: tag chiusi in ordine, tabelle con `role="presentation"`, immagini con testo alternativo e misure, niente script, fogli esterni, `float`, `position`, `flex` o `grid`, peso sotto 102 KB (oltre, Gmail taglia la mail: la più pesante è 11 KB);
2. gli stessi segnaposto nell'HTML e nel testo; righe del testo entro 72 caratteri;
3. resa in Chromium a 900 px e a 375 px con i dati di prova: nessuno scorrimento di lato, foglio largo 600 px su computer, pulsante alto almeno 44 px;
4. resa a 375 px senza il blocco `<style>`, per simulare i programmi che lo tolgono;
5. marchio assente (il file del logo non c'è ancora): si vede il testo alternativo.

**Non provate** dentro i programmi di posta veri. Gmail, Apple Mail e Outlook hanno ciascuno il proprio motore, e Outlook per Windows usa quello di Word: prima dell'invio vanno passate da un servizio di anteprime per mail o spedite a caselle di prova. I punti da guardare sono il pulsante e gli angoli tondi in Outlook, e il tema scuro forzato di Gmail su telefono.

## Da decidere prima di spedirle

- Mittente, dominio, indirizzo di risposta, ragione sociale e partita IVA.
- Il file del marchio (il logo è in pausa).
- Il contenuto fiscale della ricevuta e della fattura: lo conferma il commercialista.
- I testi dei piedi e delle frasi su conservazione e cancellazione: li rivede il legale.
