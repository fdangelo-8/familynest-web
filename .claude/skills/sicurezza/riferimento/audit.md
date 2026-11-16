# Audit di sicurezza completo

Si fa al primo avvio dell'agente, poi ogni mese e prima di ogni lancio importante (apertura al pubblico, store, pagamenti). Solo lettura: niente modifiche, niente attacchi a servizi reali.

## 1. Modello delle minacce

Scrivi chi può attaccare e cosa vuole ottenere:

- visitatore anonimo (pagine pubbliche, inviti, login, recupero password);
- utente registrato di un altro Nest (vuole leggere o modificare dati altrui);
- membro dello stesso Nest con meno diritti (vuole più diritti, o vedere ciò che è «Solo io»);
- aiutante invitato, ex membro uscito dal Nest, account eliminato;
- terze parti (provider OAuth, servizi esterni) e catena di fornitura (dipendenze, GitHub Actions).

Elenca i beni da proteggere: dati dei figli, eventi privati, posizione o indirizzi, token dei calendari, sessioni, chiavi.

## 2. Mappa della superficie

- Tutte le route e pagine (`src/app/**`), con e senza login.
- Tutte le server action e i route handler.
- Tutte le tabelle, viste, funzioni e bucket (`supabase/migrations`), con le loro policy.
- Tutte le integrazioni e le chiamate verso l'esterno.
- Configurazione: `next.config.*`, `vercel.json`, `src/proxy.ts`, `src/lib/env.ts`, `.github/workflows/`.

## 3. Verifica

Percorri per intero `checklist.md`, poi le skill `owasp-security` (checklist completa), `insecure-defaults` (tutte le categorie) e `sharp-edges` (API e configurazioni pericolose). Per Supabase leggi tutte le policy e confrontale con i test pgTAP esistenti: segnala le tabelle o le operazioni senza test di isolamento. Leggi gli avvisi di sicurezza di Supabase. Esegui `npm audit --omit=dev`.

Per ogni problema applica il filtro dei falsi positivi di `revisione-sicurezza` (confidenza ≥ 8/10 per Critica, Alta e Media).

## 4. Consegna

- **Al coordinatore** (mai nel repository finché non è corretto): il rapporto completo nel formato della skill `sicurezza`, ordinato per gravità, con una sezione «Cosa va già bene».
- **Proposte di issue** di correzione con titolo generico e il dettaglio separato, che il coordinatore passerà allo sviluppatore o all'architetto-dati.
- **Procedure per i prossimi sviluppi:** le regole nuove o corrette da aggiungere a questa skill, alle skill `convenzioni-supabase` e `privacy-e-dati-minori` o a `docs/agenti/ARCHITETTURA.md`, come testo pronto che il coordinatore inserirà con una PR amministrativa.
- **Cosa serve da Francesco:** decisioni di prodotto o impostazioni che solo lui può cambiare (impostazioni di GitHub, Vercel, Supabase), in italiano semplice.
