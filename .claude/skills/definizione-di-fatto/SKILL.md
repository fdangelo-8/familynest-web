---
name: definizione-di-fatto
description: Checklist FamilyNest per decidere se una pagina o un lavoro è finito e può arrivare a Francesco, più il formato degli esiti e delle escalation. Usala prima di dichiarare un lavoro finito, prima di passare una pagina allo stato successivo e quando qualcosa si blocca.
---

# Definizione di fatto

## Una pagina è `pronta-per-francesco` solo se

- [ ] Ogni criterio di accettazione (CA) della issue ha un test e ogni test passa
- [ ] Revisione `APPROVATA` senza problemi di sicurezza o privacy aperti
- [ ] Test visivo `SUPERATO` su desktop (1280) e mobile (390), screenshot nella PR
- [ ] Nessuna violazione di accessibilità serious o critical
- [ ] CI tutta verde, inclusa la suite delle pagine già chiuse
- [ ] Branch allineato all'ultimo `main`
- [ ] Stati vuoto, caricamento, errore e successo implementati come da specifica del designer
- [ ] Nessuna proposta del designer applicata senza approvazione
- [ ] Issue "Stato del lavoro" aggiornata dal coordinatore

Se anche una sola voce manca, la pagina non è pronta.

## Formato dell'esito di ogni agente

Ogni agente chiude il suo lavoro con un messaggio che inizia con una di queste parole, seguita da un riepilogo di massimo 10 righe:

- `FATTO` — consegna completa, con link a PR/commit/commento
- `DA CORREGGERE` — lista numerata di problemi, ognuno con file, riga e cosa ci si aspetta
- `BLOCCATO` — cosa manca e la domanda esatta da porre

## Formato di una escalation a Francesco (etichetta `bloccata`)

Commento nella issue:

```
### Serve una tua decisione

**Cosa succede:** <una frase>
**Cosa abbiamo provato:** <massimo 3 punti>
**Domanda:** <una domanda chiusa, a cui si risponde in una riga>
**Opzioni:** A) ... B) ...   (indica quella consigliata)
```

Scritto in italiano semplice, senza gergo tecnico: Francesco non legge codice.

## Lavori di fondamenta e database

- Fondamenta: stessa checklist; i criteri vengono dalla issue `fondamenta`.
- Database: migrazione applicata da zero in CI, test pgTAP verdi, tipi aggiornati, checklist privacy superata.
