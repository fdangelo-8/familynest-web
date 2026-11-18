# #460 · Animali nel Nest, prima uscita · specifica grafica

Designer, 18/11/2026. Requisito e CA: commento dell'analista nella #460 (18/11). Fonti grafiche: mockup `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno` (campo «Si ripete»), `16-casa-da-fare`, `17-casa-scadenze`, `18-nest`, `21-profilo-figlio`, `29-membro`; skill `design-system`; specifica `333-aggiungi-grafica.md` (campi per tipo del foglio Aggiungi).

**Il mockup non disegna gli animali.** Tutto qui è ricavato dai pattern esistenti, soprattutto dal profilo del figlio (21). Il brief per Fable (`docs/agenti/proposte/brief-fable-animali.md`) descrive le stesse schermate nella direzione grafica nuova (C): **per lo sviluppo vale questa specifica**, non il brief, finché Francesco non approva un disegno diverso. Dove il brief ha testi buoni li ho ripresi, così le due versioni dicono le stesse cose.

**Componenti nuovi (5), tutti da costruire con una `richiesta-condivisa`:** `Avatar` con foto, `PhotoField` (`.campo-foto`), `WeekdayPicker` (`.scelta-giorni`), `TurnPeople` (`.riga-lista__azioni`), `RepeatField` (solo React, nessuna classe). Più l'icona `chevron-up` nello sprite. Definizioni in `.claude/skills/design-system/riferimento/componenti.md`, «Animali (#460)». Nessun token nuovo, nessun colore nuovo.

Dati negli esempi: Nest D'Angelo (Marco, Laura, Sofia, Tommaso, Biscotto cane zafferano, Miele gatto cannella), oggi mercoledì 18/11/2026.

---

## A. Scadenze che si ripetono

### A.1 Campo «Si ripete» nel foglio della scadenza

Vale nel foglio Aggiungi (tipo Scadenza), nel foglio di modifica di Casa · Scadenze e nel foglio aperto da «Nuova scadenza» del profilo.

| Elemento                                     | Come                                                                                                                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Posizione                                    | subito dopo «Scade il», prima di «Avvisami» (la ripetizione dipende dalla data, come gli avvisi)                                                                                              |
| Controllo                                    | `RepeatField` = `SelectField` del mockup 11 (`.campo__select-box`, `chevron-down` 16 px), etichetta «Si ripete»                                                                               |
| Voci                                         | «Mai» (predefinita) · «Ogni mese» · «Ogni 3 mesi» · «Ogni 6 mesi» · «Ogni anno» · «Ogni … giorni»                                                                                             |
| Con «Ogni … giorni»                          | sotto, un secondo campo `TextField` `inputMode="numeric"`, etichetta «Quanti giorni», aiuto «Da 1 a 365.»; vuoto all'apertura. Sparisce scegliendo un'altra voce (il numero scritto si perde) |
| Dalle scadenze pronte                        | sotto «Si ripete», `p.campo__aiuto` «L'intervallo lo decide il vostro veterinario.», collegato con `aria-describedby`. Resta finché il foglio è aperto, anche se si cambia la voce            |
| Anteprima `.riga-scadenza` in cima al foglio | l'informazione aggiunge la ripetizione: «24 novembre, ogni mese»                                                                                                                              |

Perché un `select` e non una lista nel foglio (come chiede il brief di Fable): è il controllo che il mockup 11 usa per lo stesso campo degli impegni. Una lista su misura è una proposta della direzione C.

### A.2 «Fatta»

Solo sulle scadenze che si ripetono e solo per chi può modificarle (scadenza «Solo io» di un altro: niente bottone, niente riga).

**Dove:**

- Foglio di modifica: sotto l'anteprima `.riga-scadenza`, `Button` `.btn-secondary.btn--pieno` con icona `check`, testo «Fatta», nome accessibile «Fatta: <titolo>».
- Profilo dell'animale, riga della scadenza: a destra `Button` `.btn-tenue.btn--piccolo` «Fatta» (40 px, area 44), nome «Fatta: Antiparassitario di Biscotto». La riga non è un link: il titolo è un `button.riga-lista__titolo` che apre il foglio di modifica (`.riga-lista--modificabile`, #204). Due controlli affiancati, mai annidati.

**Passo «Fatta»** (stesso foglio, contenuto che cambia, `Sheet onBack` della #258): dal foglio di modifica X, Esc e velo tornano alla modifica; aperto dal profilo chiudono il foglio.

| Parte           | Contenuto                                                                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Titolo `h2`     | «Fatta: Antiparassitario di Biscotto»                                                                                                                                         |
| Sotto il titolo | `.foglio__info` «Si ripete ogni mese.»                                                                                                                                        |
| Data proposta   | `.campo__etichetta` «La prossima», poi `.t-titolo-scheda` «Venerdì 18 dicembre», poi `.campo__aiuto` «Contata da oggi.»                                                       |
| Cambia data     | `btn-link` «Cambia data»: al tocco la data e il link spariscono e al loro posto c'è `DateField` «La prossima» già compilato, `min` = domani, `max` = 31/12/2100, con il fuoco |
| Bottone         | `.btn-primary.btn--pieno` «Sposta al 18 dicembre» (segue la data scelta; data non valida: «Sposta la scadenza»)                                                               |

Conferma: foglio chiuso, toast «Fatta. La prossima è il 18 dicembre.» + «Annulla» (icona `check`). Dopo «Annulla» nessun secondo messaggio. Una scaduta esce da «Scadute» e va al suo posto in «Prossime».

| Stato                      | Cosa si vede                                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Data non valida            | sotto il `DateField`: «Scegli un giorno dopo oggi.» o «Scegli una data entro il 2100.»                                      |
| In corso                   | bottone `.is-caricamento`, campo `readOnly`, X e velo bloccati (`locked`)                                                   |
| Non riuscito               | `Alert variant="errore"` sopra il bottone: «Non siamo riusciti a spostare la scadenza. Controlla la connessione e riprova.» |
| Non più permesso o sparita | `Alert variant="errore"`: «Questa scadenza non c'è più o non puoi più cambiarla.», bottone spento                           |

### A.3 Righe che dicono la ripetizione

Solo testo, nessuna icona (il mockup non ne ha). Forme: «ogni mese», «ogni 3 mesi», «ogni 6 mesi», «ogni anno», «ogni giorno» (N = 1), «ogni 10 giorni».

| Dove                              | Informazione                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Casa · Scadenze, `.riga-scadenza` | «7 dicembre, ogni anno» · «20 novembre, ogni anno, se ne occupa Laura»                                        |
| Oggi, riga della scadenza         | «Scade tra 6 giorni, ogni mese»                                                                               |
| Profilo dell'animale              | «24 novembre, tra 6 giorni, ogni mese» · scaduta, in `--color-allerta`: «Scaduta il 10 novembre, ogni 3 mesi» |

### A.4 Filtro per persona in Casa · Scadenze

- I chip degli animali (`.chip--persona` con avatar) vengono dopo i figli, nell'ordine del Nest. Su telefono i chip compaiono anche sotto il selettore quando è aperta Scadenze (oggi solo in Da fare); su computer stanno già nell'intestazione.
- Filtro su un animale, nessuna scadenza: `EmptyState` normale (icona `file-clock`), titolo «Niente in scadenza per Biscotto», testo «Le scadenze che riguardano Biscotto compaiono qui.» con il bottone nel testo «Mostra tutte» (torna a «Tutti»).
- Domanda per il coordinatore (default proposto): su computer il filtro è uno solo per Da fare e Scadenze. Con un animale scelto, Da fare mostra le cose «Per chi è» quell'animale.

---

## B. Cose di ogni giorno a turno

### B.1 Foglio Da fare con «Si ripete»

Ordine dei campi quando la ripetizione non è «Mai» (con «Mai» il foglio è quello di oggi, `333-aggiungi-grafica.md` §2):

1. Frase (titolo) e selettore del tipo, come oggi. Chip statico «Per Biscotto» se c'è.
2. Solo se aperto dal profilo: «Le più comuni per Biscotto», `.gruppo-chip` di `.chip` non premuti (Cane «Passeggiata», «Cibo»; Gatto «Cibo», «Lettiera»; Altro e senza specie «Cibo»). Il tocco scrive «Passeggiata di Biscotto» nella frase e mette «Ogni giorno».
3. **«Si ripete»** (`RepeatField`): «Mai» · «Ogni giorno» · «Giorni scelti». Primo campo del tipo: decide quali campi seguono.
4. **«Giorni»** (`WeekdayPicker`), solo con «Giorni scelti».
5. **«Quando»**: `SelectField` «In qualsiasi momento» (predefinita) · «Mattina» · «Sera» · «A un orario». Con «A un orario», sotto, `TimeField` «Alle» con `step="300"`.
6. **«Come si alterna»**: `.gruppo-scelte` con tre `.scelta` (`role="radio"`, gruppo `role="radiogroup"` con `aria-labelledby`):
   - «A turno» · «Un giorno a testa, nell'ordine qui sotto.» (predefinita)
   - «Per giorno della settimana» · «Ogni giorno ha la sua persona.»
   - «Chi è libero» · «Lo fa chi ha tempo. Nessun nome.»
7. **«Chi»**:
   - «A turno»: `TurnPeople` (B.2).
   - «Per giorno della settimana»: un `SelectField` per ogni giorno della ripetizione (con «Ogni giorno», sette), etichetta col giorno intero («Lunedì»), prima voce «Scegli chi» poi adulti e figli.
   - «Chi è libero»: nessun campo.
8. **«Avvisa chi è di turno»**: `.riga-lista` con `Toggle` come nelle Impostazioni, aiuto «Arriva a chi tocca, all'orario scelto.». Con «In qualsiasi momento»: spento e disabilitato, aiuto «Per avvisare serve un orario.» Con «Chi è libero»: spento e disabilitato, aiuto «Con «Chi è libero» non avvisiamo nessuno.» Con «Mattina» e «Sera» l'avviso parte alle 8:00 e alle 19:00 (aiuto: «Arriva a chi tocca, alle 19:00.»).
9. **«I prossimi 7 giorni»**: `.tabella-dati` dentro una `.scheda`, una riga per ogni giorno dei prossimi 7 in cui la cosa si ripete. `dt` «Oggi», «Gio 19»…; `dd` avatar `xs` + nome, oppure «Chi è libero», oppure «Manca chi» (`.t-secondario`) per un giorno senza persona. Si aggiorna mentre si sceglie, senza `aria-live`.
10. Errori di salvataggio e piede come oggi; bottone «Aggiungi ai da fare» (in modifica «Salva le modifiche»).

Con una ripetizione **spariscono** «Entro», «Chi se ne occupa» e «Chi lo vede». Sotto «Si ripete» compare l'aiuto «Le cose di ogni giorno le vede tutto il Nest.»

In modifica di una cosa salvata, se cambiano persone, ordine, giorni o modo, sopra l'anteprima compare `p.campo__aiuto` «Il turno riparte da oggi con Sofia.» (prima persona del nuovo turno). In fondo al foglio `btn-pericolo` «Elimina», con `ConfirmDialog`: «Eliminare «Cibo di Biscotto»?» · «Non comparirà più nei prossimi giorni. Le spunte di questa settimana spariscono.» · «Elimina» (rosso pieno) · «Annulla».

### B.2 «Chi» a turno (`TurnPeople`)

- Etichetta `.campo__etichetta` «Chi, in ordine». Sotto, `ol.lista` dentro `.scheda`: per ogni persona una `li.riga-lista` con avatar (24), nome (`.riga-lista__titolo`), e a destra `.riga-lista__azioni` con tre `IconButton` `piccolo`: `chevron-up` «Sposta su: Laura», `chevron-down` «Sposta giù: Laura», `x` «Togli Laura». Sulla prima riga «Sposta su» è `aria-disabled`, sull'ultima «Sposta giù»: restano visibili, così i bottoni non cambiano posto da una riga all'altra.
- Sotto l'elenco, «Aggiungi al turno»: `.gruppo-chip` di `.chip--persona` con gli adulti e i figli non ancora scelti, nell'ordine del Nest. Il tocco aggiunge in fondo. Mai animali.
- Vuoto: niente elenco; sotto i chip l'aiuto «Tocca chi fa il turno, nell'ordine.»
- A 6 persone: i chip restano visibili e disabilitati, aiuto «Al massimo 6 persone.»
- Fuoco: dopo «Sposta su/giù» resta sullo stesso bottone nella nuova riga (al bordo passa all'altro bottone della riga); dopo «Togli» va al «Togli» della riga che prende il posto, altrimenti al primo chip. Un `VisuallyHidden` con `aria-live="polite"` dice «Laura ora è al posto 2.» o «Laura tolta dal turno.»
- Niente trascinamento in questa uscita: i bottoni bastano a tastiera, al tocco e con lo screen reader.

### B.3 Errori del foglio

| Caso                             | Dove e testo                                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Titolo vuoto                     | sotto la frase, il testo di oggi del foglio Da fare                                                                  |
| «Giorni scelti» senza giorni     | sotto «Giorni»: «Scegli almeno un giorno.»                                                                           |
| «A un orario» senza ora          | sotto «Alle»: «Scegli l'ora.»                                                                                        |
| «A turno» senza persone          | sotto «Chi, in ordine»: «Scegli chi fa il turno.»                                                                    |
| Giorno senza persona             | sotto quel `SelectField`: «Scegli chi c'è il venerdì.»                                                               |
| 31ª cosa (risposta del database) | `Alert variant="errore"` sopra il piede: «Avete già 30 cose di ogni giorno: eliminane una per aggiungerne un'altra.» |

Il fuoco va al primo campo sbagliato nell'ordine di B.1. Per i gruppi (giorni, chi) il fuoco va al primo controllo del gruppo.

Conferma: toast «Aggiunta. Cibo di Biscotto, ogni sera.» (ripetizione e momento in minuscolo: «ogni giorno», «lun, mer e ven», «alle 21:00»). Modifica: «Salvato.» come oggi.

### B.4 La riga del turno

Stessa riga in Oggi, Casa · Da fare e profilo dell'animale: `.riga-lista.riga-lista--modificabile` con `Checkbox` (`.casella`, come le righe di Oggi e Da fare del mockup), titolo-bottone che apre il foglio di modifica, informazione, avatar a destra (`aria-hidden`).

| Stato                          | Informazione (`.riga-lista__info`)                        | Avatar            | Titolo                                                     |
| ------------------------------ | --------------------------------------------------------- | ----------------- | ---------------------------------------------------------- |
| Da fare, tocca a me            | «Sera · tocca a te» · «21:00 · tocca a te» · «Tocca a te» | il mio            | normale                                                    |
| Da fare, tocca a un altro      | «Sera · tocca a Laura»                                    | di chi tocca      | normale                                                    |
| Da fare, chi è libero          | «21:00 · chi è libero» · «Chi è libero»                   | nessuno           | normale                                                    |
| Fatta                          | «Fatto da Laura alle 19:10» · «Fatto da te alle 7:42»     | di chi l'ha fatta | `.riga-lista--fatto` (barrato, come «Fatti» del mockup 16) |
| Fatta da chi è uscito dal Nest | «Fatto alle 19:10»                                        | nessuno           | `.riga-lista--fatto`                                       |

- Casella: `aria-label` «Segna come fatto: Cibo di Biscotto» (stesso testo spuntata, con `aria-checked`); l'informazione è collegata con `aria-describedby`.
- Spunta: casella piena subito; toast «Fatto: **Cibo di Biscotto**» + «Annulla». Ritoccare la casella toglie la spunta, senza toast.
- Spunta non salvata: la casella torna vuota e toast senza icona «Non siamo riusciti a segnarlo. Controlla la connessione e riprova.»
- In Oggi e in Casa la riga fatta resta ferma `--durata-ampia`, poi scende in fondo al suo gruppo (regola del sistema). Nel profilo non si sposta: resta in ordine di orario. Il fuoco resta sulla casella. Con movimento ridotto solo dissolvenza.
- Il giorno dopo la riga torna da fare con il nuovo turno: nessun «ieri», nessun arretrato.

### B.5 Dove compare

| Dove             | Come                                                                                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Oggi, lente Io   | in «Le mie cose» se tocca a me o è «Chi è libero»; nel conteggio «2 da fare»                                                                                                  |
| Oggi, lente Nest | in «Da fare in casa», con «tocca a Laura»                                                                                                                                     |
| Casa · Da fare   | nuova `.sezione` in cima, titolo «Oggi», info «2 su 3 fatte», righe in ordine di orario; sopra «Questa settimana». Filtro «Miei»: quelle che toccano a me e le «Chi è libero» |
| Notifiche        | `.riga-notifica` «**Cibo di Biscotto**: tocca a te, alle 19:00.», porta a `/oggi`                                                                                             |

Ordine: per orario (Mattina = 8:00, Sera = 19:00), senza orario in fondo, poi per titolo. «Fatto da…» non è mai un conteggio per persona: niente serie, punti, classifiche.

---

## C. Profilo dell'animale (`/animali/<id>`)

Stessa struttura del profilo del figlio (mockup 21), stesse classi: `.profilo-testa` (telefono, centrata) e `.profilo-testa--riga` (computer), `.griglia-contatori--tre` con `.contatore--piccolo`, `.sezione` con `.sezione__testa`, `.scheda` con `.riga-lista`.

### C.1 Disposizione

| Telefono (390), dall'alto                                                                             | Computer (1280)                                                                 |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Barra di dettaglio: «Indietro» (ripiego `/nest`), a destra `pencil` «Modifica il profilo di Biscotto» | Navigazione in alto; «Modifica il profilo» `.profilo-testa__azione` nella testa |
| Testa: avatar `xl` (o foto), `h1` «Biscotto», sotto «Cane · 4 anni»                                   | Colonna sinistra: testa a riga, contatori, Oggi, Scadenze, Prossimi impegni     |
| Tre contatori                                                                                         | Colonna destra: Cosa mangia, Veterinario, Nota, «Togli Biscotto dal Nest»       |
| Oggi · Scadenze · Prossimi impegni · Cosa mangia · Veterinario · Nota · «Togli Biscotto dal Nest»     | Stesso ordine nel DOM: prima la colonna sinistra, poi la destra                 |

«Prossimi impegni» sale prima di «Cosa mangia» rispetto all'elenco del requisito: così su telefono e computer l'ordine di lettura e del fuoco è lo stesso (prima le cose che cambiano, poi quelle fisse).

Riga sotto il nome: specie ed età separate da « · ». «Cane · 4 anni», «Cane · 6 mesi», «Cane · meno di un mese», «Gatto · con voi da 4 anni», «Gatto · con voi da quest'anno» (adozione, solo l'anno corrente). Con «Altro» o senza specie solo l'età; senza nulla la riga non c'è. In «Il tuo Nest» la stessa riga, ma l'età solo con la nascita: «Gatto».

### C.2 Contatori

Sempre tre, come nel figlio; quando manca il dato il numero è «—».

| Contatore         | Numero e informazione                                                                                                                                                                | Porta a                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Prossima scadenza | testi del figlio (`deadlineCounter`): «6» «giorni alla scadenza»; «Oggi» «la scadenza»; scaduta «8» «giorni di ritardo»; pallino rosso con la regola di Casa; «—» «nessuna scadenza» | foglio di modifica della scadenza          |
| Cose di oggi      | «2» «su 3 fatte oggi»; «—» «niente da fare oggi»                                                                                                                                     | sezione Oggi (`#oggi`, `.sezione--ancora`) |
| Prossimo impegno  | «Oggi» «impegno alle 17:30»; «1» «giorno al prossimo impegno»; «6» «giorni al prossimo impegno»; «—» «nessun impegno in programma»                                                   | dettaglio dell'impegno                     |

Contatore cliccabile: `a` (o `button` per il foglio) con nome accessibile completo, come il figlio: «6 giorni alla scadenza: «Antiparassitario di Biscotto»».

### C.3 Sezioni

Ogni sezione con un'azione di creazione ha in fondo un `Button` `.btn-tratteggiato.btn--pieno` con icona `plus` e testo: «Nuova cosa di ogni giorno», «Nuova scadenza», «Nuovo impegno». Il vuoto di sezione è un `EmptyState` normale sopra il bottone.

| Sezione            | Testa (info a destra)                  | Contenuto                                                                                                                                                                                                                                                                                              | Vuoto                                                                                                                                                                                 |
| ------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Oggi (`id="oggi"`) | «2 su 3 fatte»                         | righe del turno (B.4) in ordine di orario                                                                                                                                                                                                                                                              | icona `square-check` · «Niente da fare ogni giorno» · «Passeggiata, cibo, lettiera: decidete chi fa cosa, a turno.»                                                                   |
| Scadenze           | numero delle scadenze                  | righe `.riga-lista--modificabile` con `icona-riquadro` `file-clock`, info di A.3, a destra «Fatta» (A.2) solo se si ripete                                                                                                                                                                             | Cane e Gatto: «Nessuna scadenza per Biscotto» · «Antiparassitario, vaccino, visita: ve li ricordiamo noi.» Altro: «Nessuna scadenza per Biscotto» · «Aggiungi quelle che vi servono.» |
| Prossimi impegni   | `.sezione__link` «Vedi nel calendario» | fino a 5 righe come «Questa settimana» del figlio: `riga-lista__ora` «Gio 19», titolo, info «17:30, la porta Laura», link al dettaglio                                                                                                                                                                 | icona `calendar` · «Niente in programma con Biscotto» · «Visite, toelettatura, pensione: mettetele qui.»                                                                              |
| Cosa mangia        | —                                      | `.riga-lista` con `icona-riquadro` `utensils`, titolo «Crocchette Monge 12 kg», a destra `.btn-secondary.btn--piccolo` con icona `shopping-basket` «Metti in spesa» (nome «Metti in spesa: Crocchette Monge 12 kg»)                                                                                    | icona `utensils` · «Cosa mangia Biscotto?» · testo con bottone nel testo «Scrivilo qui», che apre il foglio con il fuoco su «Cosa mangia»                                             |
| Veterinario        | —                                      | `.riga-lista` con `icona-riquadro` `phone`, titolo il nome (o lo studio se manca il nome), info «Studio · 02 4851 2290», a destra `a.btn-secondary.btn--piccolo` `href="tel:…"` icona `phone` «Chiama» (nome «Chiama Dott.ssa Elena Ferri», o «Chiama il veterinario»). Senza telefono, niente bottone | icona `phone` · «Il veterinario non c'è ancora» · «Il numero lo avrete tutti.» con il bottone nel testo «Aggiungilo», che apre il foglio con il fuoco sul nome del veterinario        |
| Nota               | —                                      | `.scheda.scheda--imbottita` con `p.t-corpo`                                                                                                                                                                                                                                                            | la sezione non c'è                                                                                                                                                                    |

«Metti in spesa»: toast «Aggiunto alla spesa: **Crocchette Monge 12 kg**» + «Annulla» (icona `shopping-basket`); già da prendere: toast senza icona «**Crocchette Monge 12 kg** è già in lista.» In corso: bottone `.is-caricamento`. Non riuscito: toast senza icona «Non siamo riusciti a metterlo in spesa. Controlla la connessione e riprova.»

«Togli Biscotto dal Nest» (solo amministratore, `btn-pericolo` come in `29-membro`): `ConfirmDialog` «Togliere Biscotto dal Nest?» · «Spariscono il suo profilo e la foto. Impegni, cose da fare e scadenze restano, senza il suo nome.» · «Togli Biscotto» · «Annulla». Dopo: torna a `/nest`.

### C.4 Stati della pagina

| Stato           | Cosa si vede                                                                                                                                                                                                                                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Normale         | come sopra                                                                                                                                                                                                                                                                                                                                                                     |
| Vuoto (CA-34)   | testa con solo nome e avatar; al posto di contatori, Cosa mangia, Veterinario e Nota: `.stato-vuoto--grande` come il figlio, titolo «Completa il profilo di Biscotto», testo «Specie, cibo, veterinario: li vedrete tutti nel Nest.», bottone `btn-primary` «Completa il profilo» (apre il foglio). Sotto restano Oggi, Scadenze e Prossimi impegni con i loro vuoti e bottoni |
| Caricamento     | la forma di `ChildSkeleton`: cerchio grande, titolo, testo corto, tre schede contatore, tre righe; `aria-busy` e «Caricamento in corso»                                                                                                                                                                                                                                        |
| Errore (CA-47)  | `PageError` con «Riprova» e «Torna a Oggi»; nessun dato a metà                                                                                                                                                                                                                                                                                                                 |
| Non c'è (CA-49) | testi standard «Questa pagina non c'è» · «Il link potrebbe essere vecchio o scritto male.» · «Torna a Oggi»                                                                                                                                                                                                                                                                    |
| Offline         | `Alert variant="info"` con icona `wifi-off` in cima: «Sei offline: vedi le cose aggiornate alle 19:05. Per segnare o cambiare qualcosa serve la connessione.» Caselle, «Fatta», «Metti in spesa», «Modifica» e i bottoni di creazione `aria-disabled`                                                                                                                          |

### C.5 Foglio «Modifica il profilo di Biscotto»

`Sheet` `tall`, piede come `ChildSheet` (computer: «Annulla» link a sinistra, «Salva le modifiche» a destra). Campi, in ordine:

1. **Foto** (`PhotoField`): avatar `xl` o foto; a destra etichetta «Foto», aiuto sempre visibile «Solo l'animale, senza persone.», bottone `.btn-secondary.btn--piccolo` «Scegli una foto» (con foto: «Cambia la foto») e `btn-link btn-link--secondario` «Togli la foto». Il file si sceglie con un `input type="file"` nascosto, `accept="image/jpeg,image/png,image/webp"`.
2. **Nome**: testi di oggi (`MEMBER_NAME_*`).
3. **Specie**: `SelectField` «Specie», voci «Non indicata», «Cane», «Gatto», «Altro».
4. **Data**: `.campo` con etichetta «Data» e `SegmentedControl` `paper` «Nascita» · «Adozione» (dentro `.contenitore-selettore`); poi `SegmentedControl` `paper` «Il giorno» · «Solo l'anno» (`aria-label` «Quanto la sapete»); poi il campo: `DateField` «Giorno di nascita» / «Giorno di adozione» (`max` oggi), oppure `TextField` `inputMode="numeric"` «Anno di nascita» / «Anno di adozione». Aiuto sotto il campo: «Lasciala vuota se non la sapete.»
5. **Colore**: `ColorChoice` con i testi di oggi.
6. **Cosa mangia**: `TextField`, `maxLength` 80, segnaposto «Es. Crocchette Monge 12 kg».
7. **Veterinario**: `.modulo-gruppo--sezione` con `h3` «Veterinario»: «Nome» (40, segnaposto «Es. Dott.ssa Ferri»), «Studio» (60, «Es. Clinica San Rocco»), «Telefono» (`type="tel"`).
8. **Nota**: area di testo, `maxLength` 200, aiuto fisso «Niente dati di salute delle persone.»

| Errore                                   | Testo sotto il campo                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| Nome vuoto                               | «Scrivi il nome per continuare.» (`MEMBER_NAME_ERROR`)                    |
| Data o anno dopo oggi                    | «La data non può essere dopo oggi.»                                       |
| Data o anno di più di 40 anni fa         | «Scegli una data degli ultimi 40 anni.»                                   |
| Anno non di 4 cifre                      | «Scrivi l'anno con quattro cifre, per esempio 2022.»                      |
| Telefono con lettere o segni non ammessi | «Scrivi solo cifre: vanno bene spazi, punti, trattini e il + all'inizio.» |
| Telefono sotto 6 cifre                   | «Il numero è troppo corto: controlla le cifre.»                           |
| Telefono oltre 15 cifre                  | «Il numero è troppo lungo: controlla le cifre.»                           |
| Foto di un formato non ammesso           | «Questo file non si apre: scegli una foto JPEG, PNG o WebP.»              |
| Foto che non si riesce a ridurre         | «Non riusciamo a usare questa foto: provane un'altra.»                    |
| Salvataggio non riuscito                 | `Alert variant="errore"` sopra il piede, testi di `MEMBER_FAILURE_TEXT`   |

Stati della foto: in riduzione, al posto dell'avatar uno scheletro tondo da 72 px e il bottone `.is-caricamento` (nessun altro campo bloccato); scelta, la foto sostituisce l'avatar subito, nel foglio; tolta, torna l'avatar. Si salva tutto insieme con «Salva le modifiche». Conferma: foglio chiuso e toast «Salvato.»

### C.6 Avatar con foto

La foto compare **solo nella testa del profilo e nel foglio** (72 px). Righe, chip, punti del Mese, «Il tuo Nest» e anteprime restano con l'iniziale sul colore: a 18-32 px una foto non si riconosce, e il colore è ciò che lega l'animale ai suoi impegni. Nella testa la foto è decorativa (`alt=""`, il nome è scritto accanto); nel foglio ha `alt` «Foto di Biscotto».

---

## D, E, F

- **D. Spesa:** C.3 («Metti in spesa»). «Le più comuni» con la voce dell'animale è la correzione a parte (risposta 12): nessun disegno nuovo, è nel mockup 15.
- **E. Veterinario:** C.3 e C.5. Con la #385 la riga diventerà il contatto: stessa riga.
- **F. Impegni:** «Nuovo impegno» apre il modulo «Nuovo impegno» di oggi (`evento-modulo`) con Biscotto già scelto in «Chi»; «La porta» senza animali (regola di oggi). Nel Mese il punto è quello dei membri (`.avatar--punto`): nessun disegno nuovo.

---

## Accessibilità

- **Contrasti:** solo coppie già misurate. Informazioni e aiuti `--color-inchiostro-2` 6,59:1 sul bianco, 5,86:1 sulla carta; «scaduta» `--color-allerta` 4,72:1 sulla carta, 5,31:1 sul bianco; chip scelto latte su inchiostro 15,85:1; iniziale sull'avatar zafferano e cannella ≥ 4,72:1 (#74). Il bordo di `.chip` non scelto (`--color-filo`) è quello del mockup.
- **Aree di tocco:** casella, chip, voci del selettore, `.btn-icona--piccolo`, `.btn--piccolo`, `.btn-link`: regole esistenti. `.scelta-giorni`: passo orizzontale ≥ 46 px a 390 px, righe con `--space-2` di distanza (aree da 44 non sovrapposte). `.riga-lista__azioni`: passo 44 px (32 + `--space-3`).
- **Fuoco, profilo:** «Indietro» → «Modifica» → contatori → per ogni sezione: righe (casella, poi titolo, poi «Fatta»), poi il bottone tratteggiato → «Togli dal Nest». Chiudendo un foglio il fuoco torna al controllo che l'ha aperto.
- **Fuoco, foglio Da fare:** X → frase → tipo → voci rapide → «Si ripete» → «Giorni» → «Quando» → «Alle» → «Come si alterna» → «Chi» → «Avvisa» → bottone.
- **Testo al 200%:** `.scelta-giorni` passa a 4 colonne (query `selettore`); «Fatto da Laura alle 19:10» va a capo; contatori a una colonna con la regola esistente; le `.scelta` vanno a capo. Nessuna altezza fissa su elementi con testo.
- **Nomi accessibili:** cominciano col testo visibile («Fatta: …», «Chiama …», «Metti in spesa: …»), regola di `label-content-name-mismatch`.
- **Movimento ridotto:** niente discesa della riga fatta, niente scorrimento dei fogli; solo dissolvenze brevi.
