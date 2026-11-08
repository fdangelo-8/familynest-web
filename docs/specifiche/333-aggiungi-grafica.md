# #333 · Aggiungi: campi per tipo · specifica grafica completa

Designer, 06/11/2026. Ricostruisce la sezione «Specifica grafica» della issue #333, sovrascritta per errore nel corpo della issue, e la confronta con l'implementazione della PR #357 (`feat/aggiungi-nuovo`). Il requisito resta quello dell'analista (issue #333 e `docs/specifiche/333-aggiungi.md`): qui solo aspetto, testi, stati e accessibilità.

**Fonti:** decisioni di Francesco del 06/11 (corpo e commenti della #333: niente «Esempi», campi visibili per tipo, via «chi la porta», visibilità con voci sempre visibili, «Chi se ne occupa» multiplo; tre voci per Impegno, due per gli altri; anteprima della giornata tolta con la colonna degli esempi), mockup `docs/mockup/10-aggiungi.html` per tutto ciò che non cambia, skill `design-system`.

**Nessun componente o classe nuova.** Tutto si fa con `DateField`, `TimeField`, `FieldPair`, `SegmentedControl`, `Chip`, `PeopleChips`, `Alert` e le classi `.campo`, `.campo__aiuto`, `.campo__errore`, `.gruppo-chip`, `.contenitore-selettore`, `.modale--singola`. Nessuna `richiesta-condivisa` per lo stile.

## 1. Disposizione

**Una sola colonna a 390 e a 1280 px.** Su computer la modale è `.modale--singola` (larghezza `--size-palette`, 680 px), senza `.modale__lato`: niente «Esempi», niente anteprima della giornata. Il contenuto è lo stesso del foglio; cambia solo il contenitore (pattern «Foglio o modale»).

Ordine dall'alto, uguale nei due formati:

1. Testa del foglio («Aggiungi», «scrivi come parli», `esc` solo da 1024 px, X «Chiudi»).
2. Campo frase (`.campo-frase`), con il suo errore sotto.
3. Selettore del tipo dentro `.contenitore-selettore` (solo per le cose nuove).
4. Campi del tipo (§2), uno sotto l'altro, distanza `--space-4` (gap del corpo).
5. Solo Impegno: avviso «… chi accompagna Sofia?» (`Alert variant="avviso"`).
6. Solo Impegno, telefono: `btn-link btn-link--secondario` «Più dettagli» con icona `sliders-horizontal`.
7. Avvisi di salvataggio (`Alert variant="errore"`).
8. Piede: telefono, bottone principale a tutta larghezza; computer, `.modale__piede` con «Tutti i dettagli» a sinistra (solo Impegno) e il bottone principale a destra.

Su 1280 × 800 la Scadenza supera di poco l'altezza della modale (`max-height: calc(100dvh - 2 * var(--space-12))`) e il bottone si raggiunge scorrendo: è voluto e coerente con il mockup, dove il bottone sta in fondo al contenuto. Un piede sempre visibile cambierebbe `.modale` per tutte le pagine: se servirà, sarà una `proposta-design` a parte.

## 2. Campi per tipo

| Tipo     | Campi, in quest'ordine                                                                                                                                                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Impegno  | «Giorno» (`DateField`) · «Dalle» e «Alle» affiancati (`FieldPair`, due `TimeField`) · «Chi» (`PeopleChips`, più scelte) · «Chi lo vede» (`SegmentedControl` a 3 voci: «Solo io», «Occupato», «Tutti», con la frase di aiuto di oggi sotto)         |
| Da fare  | chip statico «Per Sofia» (solo se la frase lo dice; in Modifica con la X «Togli Per Sofia») · «Entro» (`DateField`, facoltativo) · «Chi se ne occupa» (chip persona, più scelte) · «Chi lo vede» (`SegmentedControl` a 2 voci)                     |
| Scadenza | scheda di anteprima `.riga-scadenza` (mockup) · chip statico con il nome di chi riguarda (solo dalla frase, come oggi) · «Scade il» (`DateField`, obbligatorio) · «Avvisami» (chip, come nel mockup) · «Chi se ne occupa» · «Chi lo vede» (2 voci) |
| Spesa    | anteprima delle righe (mockup) · «Chi se ne occupa» (decisione 5 di Francesco, CA-30). Nessun campo data, nessuna visibilità: la spesa è sempre di tutto il Nest                                                                                   |

Etichette visibili `.campo__etichetta` (Host Grotesk, `--text-etichetta-*`, `--color-inchiostro-2`), nome accessibile uguale all'etichetta.

- **«Entro»** e **«Scade il»** al posto di «Data»: sono le parole che il mockup usa per la stessa informazione («Entro venerdì 23» nel foglio, «Entro domani» in Casa · Da fare, «scade il 7 dicembre»), e il tipo si capisce dal nome del campo. Il coordinatore allinea i CA che citano «Data» (CA-8 … CA-14, CA-22, CA-26, CA-27, CA-29).
- **«Avvisami» subito dopo «Scade il»**: gli avvisi dipendono dalla data, quindi stanno vicini; persone e visibilità vengono dopo, nello stesso ordine di Da fare.
- «Chi se ne occupa»: «Tu» per primo, poi adulti e figli nell'ordine del Nest, niente animali; chip `.chip--persona` con avatar `s`, scelto con `aria-pressed="true"` (bordo `--border-medio` `--color-inchiostro`). «Chi» dell'impegno: come il modulo #19, animali compresi.
- «Chi lo vede»: le voci sono `button[aria-pressed]` di `.selettore.selettore--carta`, con icone `users` / `lock` (Impegno: `lock`, `eye-off`, `users`). Le icone si nascondono sotto 1024 px come nel selettore del tipo (regola esistente). Il gruppo ha `aria-label` «Chi lo vede» e l'etichetta visibile `aria-hidden`.

Stato accessibile «scelto» per i CA: sempre `aria-pressed="true"` (chip e voci del selettore).

### Contenitore del selettore (#313)

Ogni `SegmentedControl` di «Chi lo vede» sta dentro `<div className="contenitore-selettore">`, come il selettore del tipo. Al 100% non cambia nulla (342 px di larghezza contro la soglia di 17rem = 272 px); al 200% le voci si impilano e «Lo vede tutto il Nest» va a capo invece di essere tagliata da `overflow: hidden`.

## 3. «Preso dalla frase»

Sotto ogni campo il cui valore viene **dalla frase** (R1: il campo segue la frase e la frase riconosce un valore per quel campo) compare la riga di aiuto **«Preso dalla frase»**, classe `.campo__aiuto` (`--text-nota-*`, `--color-inchiostro-2`, 6,59:1 sul bianco del foglio). Sostituisce le etichette statiche che il mockup mostrava sotto la frase («Giovedì 22», «17:00», «Sofia»): dice la stessa cosa, ma dove sta il valore.

| Campo                            | Quando compare                                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------------------- |
| «Giorno»                         | la frase riconosce un giorno, oppure solo un'ora (giorno = oggi)                                    |
| «Dalle»                          | la frase riconosce l'ora                                                                            |
| «Alle»                           | solo se la frase dice anche la fine («dalle 17 alle 19»); se c'è «Finisce sabato 24.», vince quella |
| «Chi»                            | la frase riconosce almeno un nome (non con il solo «Tu» di partenza)                                |
| «Entro», «Scade il»              | la frase riconosce una data                                                                         |
| «Chi se ne occupa»               | la frase riconosce «<Nome> deve» o «Devo» (non con il «Tu» di partenza della Scadenza)              |
| «Chi lo vede», «Avvisami», Spesa | mai: non vengono dalla frase                                                                        |

- Sparisce appena il campo si cambia a mano (R2); ricompare quando il campo torna a seguire la frase (R3).
- In Modifica compare solo dopo che la frase è cambiata (R6): i valori salvati non sono «presi dalla frase».
- È collegata al campo con `aria-describedby` (`DateField`/`TimeField`: prop `help`; `PeopleChips`: prop `help`; «Chi se ne occupa»: §7). Niente `aria-live`: il valore cambia mentre si scrive e un annuncio a ogni lettera sarebbe rumore.
- Con un errore sotto lo stesso campo restano tutte e due: prima l'aiuto, poi l'errore (ordine di `FieldShell`).

## 4. «La porta»

Via dal foglio (niente riga, niente chip, niente campo). **Resta dietro «Più dettagli» / «Tutti i dettagli»**: il modulo «Nuovo impegno» aperto da lì ha il gruppo «La porta» come in «Modifica impegno», con nessuno scelto all'apertura. Così il foglio resta corto e chi deve organizzare un accompagnamento lo trova dove ci sono tutti i dettagli; l'avviso «… chi accompagna Sofia?» resta nel foglio come informazione (D3).

Il coordinatore sostituisce CA-2 (la issue lo prevede: «Se il designer sceglie “Altro”»). Testo proposto:

> CA-2: [UT][OR] Dato Marco su desktop che scrive «Nuoto Sofia giovedì alle 17», allora nel foglio nessun elemento ha testo o nome accessibile «La porta»; quando apre «Tutti i dettagli», allora il modulo «Nuovo impegno» ha il gruppo «La porta» senza nessuno scelto e, salvando così, l'impegno ha `escort_member_id` nullo; scegliendo «Laura» e salvando, ha Laura. Lo stesso su mobile con «Più dettagli».

## 5. Stati

| Stato                                      | Cosa si vede                                                                                                                                                                                                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vuoto (appena aperto)                      | Impegno scelto, campi del tipo già visibili e vuoti (in «Chi» «Tu»), bottone «Aggiungi» disabilitato (`--opacity-disabilitato`). Nessun «Preso dalla frase», nessun esempio.                                                                               |
| Normale                                    | Campi compilati dalla frase con «Preso dalla frase»; bottone con il testo che dice cosa succede (mockup).                                                                                                                                                  |
| Errore di un campo                         | Dopo il tocco sul bottone: `.campo--errore` + `.campo__errore` con `circle-alert` 16 px sotto il campo, fuoco sul primo campo sbagliato nell'ordine del §1 (frase, poi i campi). Testi al §6.                                                              |
| Salvataggio in corso                       | Bottone `.is-caricamento` (spinner, testo a `--opacity-passato`, `aria-busy`), campi `readOnly`, chip e voci senza effetto; «Più dettagli» / «Tutti i dettagli» `aria-disabled`.                                                                           |
| Salvataggio non riuscito                   | `Alert variant="errore"` in fondo al corpo, sopra il piede: «Non siamo riusciti a salvare. Controlla la connessione e riprova.» (Impegno: «Non siamo riusciti a salvare l'impegno. Controlla la connessione e riprova.»). Foglio aperto, valori invariati. |
| Persone del Nest non lette                 | `Alert variant="errore"` sotto il selettore del tipo con «Riprova» (testo di oggi). «Chi» e «Chi se ne occupa» non compaiono finché le persone non arrivano.                                                                                               |
| Conferma                                   | Foglio chiuso e toast con «Annulla» (testi di oggi; Da fare con altre persone: «Dato a Laura e Sofia: Chiamare la nonna.»).                                                                                                                                |
| Modifica, lettura                          | Scheletri (`riga`, `testo-corto`, `riga`), errore con «Riprova», «Questa cosa non c'è più»: come oggi.                                                                                                                                                     |
| Visibilità bloccata (Modifica, non autore) | Voci visibili e disabilitate, e sotto la frase che spiega perché (§6), collegata al gruppo con `aria-describedby`.                                                                                                                                         |

## 6. Testi

| Dove                                        | Testo                                                                                                |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Aiuto sotto un campo riempito dalla frase   | «Preso dalla frase»                                                                                  |
| Etichetta della data, Da fare               | «Entro»                                                                                              |
| Etichetta della data, Scadenza              | «Scade il»                                                                                           |
| Scadenza senza data (sotto «Scade il»)      | «Manca la data: sceglila o scrivila nella frase.» (via «qui sotto»: l'errore sta già sotto il campo) |
| Data passata                                | «Questa data è già passata: scegli una data da oggi in poi.»                                         |
| Data oltre il 2100                          | «Scegli una data entro il 2100.»                                                                     |
| Impegno senza giorno (sotto «Giorno»)       | «Scegli il giorno.»                                                                                  |
| Impegno senza ora d'inizio (sotto «Dalle»)  | «Scegli l'ora d'inizio.»                                                                             |
| Impegno senza ora di fine (sotto «Alle»)    | «Scegli l'ora di fine.»                                                                              |
| Impegno senza persone (sotto «Chi»)         | «Scegli almeno una persona.»                                                                         |
| Visibilità bloccata, autore nel Nest        | «Lo decide Paolo, che l'ha creata.»                                                                  |
| Visibilità bloccata, autore uscito dal Nest | «Chi l'ha creata non è più nel Nest: resta così.»                                                    |
| Voci della visibilità, Da fare e Scadenza   | «Lo vede tutto il Nest» · «Lo vedo solo io»                                                          |
| Voci della visibilità, Impegno              | «Solo io» · «Occupato» · «Tutti», con la frase di aiuto di oggi                                      |

Gli errori dell'Impegno sono **gli stessi del modulo «Nuovo impegno»** (`ERROR_TEXTS.day`, `.from`, `.to`, `.people`): stesso campo, stesso testo, nel foglio e nel modulo. «Manca il giorno.» e «Manca l'ora.» della specifica §5 dell'analista non si usano. Gli errori del titolo sotto la frase restano quelli di oggi.

Bottoni e toast: invariati rispetto al requisito («Metti in giovedì 22», «Dai a Laura e Sofia», «Aggiungi ai da fare», «Aggiungi alle scadenze», «Aggiungi 2 cose»).

## 7. «Chi se ne occupa» con l'aiuto

Il gruppo segue lo stesso schema di `PeopleChips`, così può avere l'aiuto e l'errore collegati:

```tsx
<div className="campo">
  <span className="campo__etichetta" id={`${id}-etichetta`}>
    Chi se ne occupa
  </span>
  <div
    id={id}
    role="group"
    aria-labelledby={`${id}-etichetta`}
    aria-describedby={fromPhrase ? `${id}-aiuto` : undefined}
    className="gruppo-chip"
  >
    {/* chip persona come oggi */}
  </div>
  {fromPhrase ? (
    <p className="campo__aiuto" id={`${id}-aiuto`}>
      Preso dalla frase
    </p>
  ) : null}
</div>
```

## 8. Accessibilità

- **Contrasti:** etichette e aiuti `--color-inchiostro-2` su `--color-superficie` 6,59:1; errori `--color-allerta` su bianco ≥ 4,72:1; voce scelta del selettore `--color-inchiostro` su `--color-superficie` 15+:1; bordo dei campi `--color-filo-campo` 3,70:1. Le voci disabilitate sono escluse dal minimo (WCAG 1.4.3, controlli inattivi), ma la frase sotto spiega perché.
- **Ordine del focus:** X «Chiudi» → frase → voci del tipo → campi nell'ordine del §2 → avviso (non focalizzabile) → «Più dettagli» (telefono) → bottone principale. Computer: … → «Tutti i dettagli» → bottone principale. Chiudendo il modulo «Nuovo impegno» il fuoco torna su «Più dettagli» / «Tutti i dettagli».
- **Aree di tocco:** chip 36 px e voci del selettore 32 px arrivano a 44 px con le regole esistenti (`::before`, `clip-path`); campi 52 px; «Più dettagli» `.btn-link` con l'area di #67.
- **Testo al 200%:** `.contenitore-selettore` attorno a ogni selettore (§2); i chip vanno a capo; nessun `height` su elementi con testo.
- **Nomi accessibili:** ogni campo prende il nome dall'etichetta visibile; i gruppi di chip da `aria-labelledby`; i selettori da `aria-label` «Tipo» / «Chi lo vede».

## 9. Confronto con la PR #357

### Va bene

- Modale singola su computer, senza esempi né anteprima della giornata; foglio a una colonna su telefono.
- Campi dell'Impegno nell'ordine giusto («Giorno», «Dalle»/«Alle» affiancati, «Chi», «Chi lo vede» a tre voci con la frase sotto); avviso «chi accompagna» al suo posto.
- Visibilità di Da fare e Scadenza con `SegmentedControl` a due voci sempre visibile, testi di Francesco, icone nascoste sotto 1024 px, «Lo vede tutto il Nest» intera a 390 px.
- «Chi se ne occupa» multiplo con i chip persona, «Tu» per primo, niente animali; Spesa con «Chi se ne occupa» e senza altri campi.
- Errori sotto il campo con `.campo__errore` e fuoco sul campo; stati di caricamento, errore di salvataggio, persone non lette, Modifica: come prima.
- Riepilogo a righe da 1024 px tolto; un solo ingresso «Tutti i dettagli» / «Più dettagli».
- Nessuna classe nuova, nessuno stile in linea.

### Correzioni necessarie

1. **Etichette delle date:** in Da fare `label="Entro"`, in Scadenza `label="Scade il"` (oggi «Data» per tutti e due).
2. **Ordine della Scadenza:** `ReminderGroup` subito dopo il campo «Scade il», poi «Chi se ne occupa», poi «Chi lo vede».
3. **«Preso dalla frase»** sotto i campi riempiti dalla frase, con le regole del §3: prop `help` di `DateField`/`TimeField`/`PeopleChips`, gruppo del §7 per «Chi se ne occupa».
4. **«La porta» nel modulo aperto da «Più dettagli» / «Tutti i dettagli»:** `NewEventForm` non passa più `hideEscort`; il valore scelto va in `escort_member_id` (il salvataggio legge già `values.escortId`). Prima il coordinatore sostituisce CA-2 (§4).
5. **Contenitore dei selettori:** `VisibilityGroup` ed `EventVisibilityGroup` avvolgono il `SegmentedControl` in `<div className="contenitore-selettore">`.
6. **Visibilità bloccata:** con `locked`, sotto le due voci `<p className="campo__aiuto" id=…>` con «Lo decide <Nome>, che l'ha creata.» (o «Chi l'ha creata non è più nel Nest: resta così.»), collegata con `describedBy` del `SegmentedControl`.
7. **Testi degli errori dell'Impegno:** sotto «Giorno», «Dalle», «Alle» si usano `ERROR_TEXTS.day`, `ERROR_TEXTS.from`, `ERROR_TEXTS.to` al posto di `MISSING_DAY_TEXT` / `MISSING_TIME_TEXT` (da togliere da `labels.ts`).
8. **Scadenza senza data:** `DATE_MISSING_TEXT` = «Manca la data: sceglila o scrivila nella frase.» (il coordinatore aggiorna CA-13).

### Facoltative

- A. Se la PR #356 non è ancora unita, togliere da lì la prop `hideEscort` di `EventFormFields`, che con la correzione 4 non serve più.
- B. Piede sempre visibile nella modale: non in questa PR (§1); eventualmente `proposta-design`.
