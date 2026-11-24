# Decisioni di Francesco sul mockup

Queste decisioni prevalgono sul mockup dove lo contraddicono. Analista, designer e revisore le applicano sempre. Data: 22 ottobre 2026.

## D1 · Niente dati sanitari dei figli

- La sezione **Salute** di `21-profilo-figlio.html` (pediatra, certificato medico, ogni contatto o dato sanitario) **non si sviluppa**.
- Il campo **Pediatra** di `03-onboarding-persone.html` **non si sviluppa**.
- Nel profilo del figlio restano: settimana, **scuola** (nome, classe, orario), **maestra** (nome, materia, telefono), taglie, lista desideri, contatori in cima (impegni della settimana, prossima scadenza, giorni al compleanno).
- Le **scadenze** (`17-casa-scadenze.html`) restano scadenze generiche con titolo libero: l'app non ha campi o tipi dedicati a dati sanitari. Negli esempi e nei test non si usano scadenze sanitarie (es. "Rinnovo carta d'identità di Sofia" invece di "Certificato medico").
- Il designer, nella specifica di queste pagine, indica come si chiude lo spazio lasciato dalla sezione tolta, senza cambiare il resto.
- **Animali (aggiunta del 24/11/2026, #460):** D1 non si applica agli animali: vaccini, antiparassitari e visite di un animale sono ammessi, anche negli esempi e nei test. Resta vietato ogni dato di salute delle persone, anche se scritto nel profilo dell'animale (allergie al pelo, cane d'assistenza).

## D2 · Lista desideri pubblica: eccezione controllata

`23-lista-desideri-pubblica.html` è l'**unica** pagina con dati della famiglia visibile senza account. Condizioni obbligatorie:

- link con un codice casuale impossibile da indovinare (almeno 128 bit), mai l'id della lista o del figlio;
- il link scade (per impostazione: il giorno dopo la data della festa o del compleanno) e i genitori lo disattivano da `22-lista-desideri.html`; dopo la scadenza o la disattivazione la pagina mostra solo lo stato di errore;
- la pagina mostra solo: nome del figlio, occasione e data, idee regalo con foto e link, stato "Già preso" / "Lo regali tu"; **mai** età o data di nascita completa, cognome, taglie, scuola, altri membri, indirizzi;
- chi segna "Lo regalo io" lascia solo un nome; nessuna registrazione, nessuna email obbligatoria;
- i genitori vedono chi ha preso cosa; gli invitati no;
- la pagina non è indicizzata dai motori di ricerca (`noindex`) e non è raggiungibile se non dal link.
- La condivisione delle taglie con la lista (decisione aperta del mockup) resta **esclusa** finché Francesco non decide diversamente.

## D3 · Accesso con mail e password, poi Apple e Google (aggiornata il 18/11/2026)

- La strada principale è mail e password, direttamente nella pagina di accesso (Entra / Registrati). Sotto ci sono «Continua con Apple» e «Continua con Google». Prevale sul mockup 01 per l'ordine dei metodi (#461).
- Registrazione con conferma della mail; «Password dimenticata?» manda un link per sceglierne una nuova. I link nelle mail servono solo a questo: l'accesso con il solo link via mail non c'è (decisione del 06/11, #327).
- Prerequisiti di Apple e Google invariati (a carico di Francesco).
- Gli utenti di test entrano con mail e password come tutti, con gli account creati dallo script di seed.

### D3, testo originale del 22/10/2026 (superato dove contraddice i punti sopra)

- Si sviluppano tutti e tre gli accessi già nella fondamenta **login**.
- Il designer disegna la schermata mancante dell'accesso con link via mail (inserimento mail, "controlla la posta", link scaduto), coerente con `01-accesso.html` e il design system.
- Prerequisiti a carico di Francesco **prima** della fondamenta login: abbonamento Apple Developer e configurazione di "Accedi con Apple"; credenziali OAuth di Google; attivazione dei tre provider nel progetto Supabase. Il coordinatore, quando arriva alla fondamenta login, se non sono pronti apre una domanda `bloccata` e intanto procede con le altre fondamenta.
- Gli utenti di test usano l'accesso con mail e password creato dallo script di seed (solo per i test, non visibile nell'app).

## D4 · Il design di Fable per telefono è la fonte di verità (24/11/2026)

- Il design di Fable in `docs/design/telefono/` sostituisce il mockup come fonte di verità per il telefono; computer e web da telefono arriveranno in `docs/design/computer/`. I file `docs/mockup/*.html` restano come archivio. Le decisioni D1, D2 e D3 restano valide e vincono sul design.
- Quando due schermate si contraddicono vale il passo più recente. Le risposte di Francesco alle domande di Fable sono in `docs/design/telefono/decisioni-fable.md` (166 e 169 non ancora confermate, 177–183 aperte).
- Il nome del prodotto è un segnaposto («FamilyNest») e viene sempre da un punto solo.
- Si sviluppano da ora tutte le funzioni, del lancio e successive; pagamenti e Plus in un secondo momento; il calendario dei rilasci si decide dopo.
  - **Lancio:** Oggi, Aggiungi con una frase, impegni con ripetizioni, calendario (settimana, mese, giorno) e calendario condiviso, chi vede, chi accompagna e chi riprende, Liberi insieme, sintesi del mattino, notifiche, ricerca, calendari collegati in sola lettura, spesa, da fare, scadenze, benvenuto del nuovo membro, profilo dei figli, animali, lista desideri e pagina pubblica, accesso, primo avvio, invito, il tuo Nest e membri, profilo, impostazioni, Esplora e Spazi, Novità, Proposte, privacy e termini, navigazione nuova, mail.
  - **Dopo il lancio, da sviluppare già:** turni, compleanni, calendario scolastico, riepilogo della domenica, liste da riusare, ricette, pasti, «Chiedi a…», documenti e conti, contatti, nonni e babysitter, gamification e Tempo insieme, sfondi.
  - **In attesa:** Routine, «trillo».
  - **Dopo il lancio:** tema scuro, tablet.
- Le «Decisioni aperte del mockup» qui sotto restano valide solo per ciò che questo elenco non decide.

## Decisioni aperte del mockup

Restano aperte come scritte in `design-system.md` §14. Finché non vengono decise **non si sviluppano**: accesso premium, tema scuro completo, contenuti degli spazi di Esplora oltre a ingresso e pagina "In arrivo", "Proponi qualcosa", Citofona, sintesi della domenica, taglie nella lista pubblica, tablet dedicato. Per l'apertura del profilo figlio dal calendario e la tendina notifiche su desktop si segue il mockup così com'è.
