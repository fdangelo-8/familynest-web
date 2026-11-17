---
name: legale-privacy
description: Metodo legale e privacy di FamilyNest - quali documenti servono (informativa, termini, registro dei trattamenti, DPIA, procedura violazioni, fornitori), come si scrivono, come si controlla una funzione dal punto di vista GDPR e dei minori, e la checklist prima del lancio. Usala per scrivere o aggiornare documenti legali e per il controllo legale di specifiche e funzioni.
---

# Legale e privacy

FamilyNest tratta dati di famiglie e di bambini. Il titolare del trattamento è Francesco, o la sua futura società: è lui che approva i documenti e ne risponde. Questa skill serve a preparargli documenti completi e corretti, e a far emergere presto i problemi legali delle funzioni.

## Principi

1. **Prima i fatti.** Un documento descrive ciò che l'app fa davvero: dati raccolti, fornitori, tempi di conservazione. Verificalo nel codice e nelle migrazioni, non nel mockup.
2. **Obbligatorio o consigliato.** Per ogni punto indica se è un obbligo, con la fonte, o una buona pratica. Non gonfiare gli obblighi.
3. **Bambini: la scelta più protettiva.** Nel dubbio si raccoglie meno, si conserva meno, si mostra meno.
4. **Testi per persone.** Informativa e termini in italiano semplice, con frasi brevi ed esempi concreti; la sostanza giuridica resta completa.
5. **Coerenza.** Informativa, registro, DPIA e app devono dire la stessa cosa. Se cambia una funzione, cambiano i documenti.

## Documenti (cartella `docs/legale/`)

| File                      | Cosa contiene                                                                                                                                                                                                                                     | Obbligo                                                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `informativa-privacy.md`  | Informativa agli utenti (art. 13 GDPR): titolare, dati, finalità, basi giuridiche, conservazione, destinatari e fornitori, trasferimenti fuori UE, diritti, reclamo al Garante. Sezione dedicata ai dati dei figli                                | Obbligatoria                                                                                                                                                                               |
| `termini.md`              | Termini e condizioni: chi offre il servizio (dati identificativi del fornitore), cosa fa l'app, età minima e ruolo dei genitori, regole d'uso, abbonamenti e recesso quando arriveranno, limitazioni di responsabilità ammesse, legge applicabile | Necessari per un servizio al pubblico; per gli abbonamenti si applica il Codice del consumo                                                                                                |
| `registro-trattamenti.md` | Registro delle attività di trattamento (art. 30 GDPR)                                                                                                                                                                                             | Obbligatorio: l'esenzione per chi ha meno di 250 dipendenti non vale per trattamenti non occasionali                                                                                       |
| `dpia.md`                 | Valutazione d'impatto (art. 35 GDPR): descrizione, necessità e proporzionalità, rischi per gli interessati, misure                                                                                                                                | Da fare: dati di minori, cioè soggetti vulnerabili, trattati in modo sistematico. Verifica l'elenco del Garante (provvedimento n. 467 dell'11/10/2018) e i criteri delle linee guida WP248 |
| `fornitori.md`            | Responsabili del trattamento (art. 28): Supabase, Vercel, Google, provider email e altri. Per ognuno: cosa tratta, dove sono i dati, accordo DPA accettato, base del trasferimento (decisione di adeguatezza UE-USA o clausole tipo)              | Obbligatorio                                                                                                                                                                               |
| `violazioni.md`           | Procedura per le violazioni di dati: come si riconosce, chi decide, notifica al Garante entro 72 ore (art. 33) e agli utenti se il rischio è alto (art. 34), registro delle violazioni                                                            | Obbligatoria                                                                                                                                                                               |
| `valutazione-dpo.md`      | Perché il DPO è o non è obbligatorio (art. 37): servono un monitoraggio regolare e sistematico su larga scala o categorie particolari su larga scala                                                                                              | Va documentata la valutazione                                                                                                                                                              |
| `cookie.md`               | Cookie e strumenti simili usati: se solo tecnici, niente banner (linee guida del Garante del 10/06/2021)                                                                                                                                          | Obbligo di informare                                                                                                                                                                       |

## Punti fermi per FamilyNest

- **Età:** in Italia il consenso digitale vale da 14 anni (art. 2-quinquies del Codice privacy). L'app è per adulti; i figli non hanno account (skill `privacy-e-dati-minori`). Indica nei termini l'età minima per registrarsi.
- **Dati dei figli:** li inseriscono i genitori per organizzare la famiglia. Indica la base giuridica (di norma l'esecuzione del servizio richiesto dal genitore) e motivala nella DPIA. Niente dati sanitari (decisione di Francesco).
- **Condivisione con esterni:** nonni, babysitter, link pubblici come la lista dei desideri. Spiega chi vede cosa e per quanto tempo.
- **AI e funzioni future:** una funzione che manda dati a un fornitore AI richiede di aggiornare informativa, fornitori, DPIA e spesso una nuova decisione di Francesco.
- **Pagamenti:** quando arriva Plus servono informazioni precontrattuali, recesso di 14 giorni per i servizi digitali e le sue eccezioni, rinnovo e disdetta chiari, dati fiscali del fornitore.

## Controllo legale di una funzione

Per ogni specifica sensibile rispondi a sette domande:

1. Quali dati personali nuovi? Di chi, minori compresi?
2. Con quale base giuridica?
3. Chi li vede, dentro e fuori dal Nest?
4. Quanto si conservano, e come si cancellano?
5. Passano da fornitori nuovi o fuori dall'UE?
6. Cosa va detto all'utente, e dove: informativa o testo nella pagina?
7. Serve un consenso o una scelta esplicita?

Trasforma le risposte in criteri di accettazione verificabili e in aggiornamenti ai documenti.

## Formato dell'esito

Per Francesco, in italiano semplice:

- cosa è pronto;
- cosa deve decidere o compilare lui (dati del titolare, indirizzo, email di contatto);
- cosa consiglieresti di far verificare a un professionista, e perché;
- prossimi passi.
