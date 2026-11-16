---
name: sicurezza
description: Regole di sicurezza di FamilyNest - quando una PR è «a rischio», come si fa la revisione di sicurezza, gravità, formato dell'esito (SICURO / DA CORREGGERE), riservatezza dei problemi in un repository pubblico e checklist Next.js, Supabase e dati dei minori. Usala per ogni revisione di sicurezza, per l'audit completo e quando una specifica tocca dati sensibili.
---

# Sicurezza di FamilyNest

FamilyNest custodisce dati di famiglie e di minori. L'obiettivo è che **un Nest non veda mai i dati di un altro**, che **nessuno ottenga più diritti di quelli che ha**, che **nessun dato personale finisca dove non deve** (log, URL, cache condivise, terze parti) e che **nessuna chiave sia esposta**.

Questa skill vince sulle skill esterne (`owasp-security`, `sharp-edges`, `insecure-defaults`, `revisione-sicurezza`) quando dicono cose diverse.

## Riservatezza: il repository è pubblico

Il codice di FamilyNest è su GitHub pubblico. Chiunque legge issue, PR e commenti.

- **Mai** descrivere un problema reale di sicurezza (cosa, dove, come sfruttarlo) in issue, PR, commenti, commit o file del repository finché non è corretto.
- L'esito dettagliato va **solo nella risposta al coordinatore**. Nella PR scrivi soltanto il verdetto: `SICURO`, oppure `DA CORREGGERE — dettagli inviati al coordinatore`.
- Le issue di correzione hanno un titolo generico (es. «Rafforzare i controlli su un'azione del server») e rimandano al coordinatore per i dettagli.
- Dopo la correzione e il merge, una sintesi senza istruzioni di sfruttamento può andare in `docs/agenti/LEZIONI.md` tramite il documentalista.
- Mai copiare chiavi, token, cookie o dati personali nell'esito, neanche parzialmente.

## Quando una PR è «a rischio»

Il coordinatore lancia l'agente `sicurezza` (in parallelo al revisore) se la PR tocca almeno uno di questi punti:

- `supabase/` (migrazioni, policy RLS, funzioni, seed, `config.toml`, template email) o `src/types/database.ts`;
- `src/lib/supabase/`, `src/lib/auth/`, `src/proxy.ts`, cookie e sessioni;
- route handler (`src/app/api/`, `route.ts`), server action (`'use server'`, `actions.ts`), webhook;
- login, registrazione, recupero password, inviti, codici di accesso, uscita o eliminazione dell'account;
- integrazioni esterne (calendari collegati, OAuth, email, pagamenti, AI, analytics);
- pagine pubbliche o senza login (es. `desideri`, `invito`, `accesso`);
- upload di file, foto, documenti, dati di salute o dei figli;
- `next.config.*`, `vercel.json`, intestazioni HTTP, variabili d'ambiente, `package.json` e lockfile (dipendenze nuove), `.github/workflows/`.

Nel dubbio la PR è a rischio.

## Come lavori

- **Solo lettura.** Non modifichi codice, test, migrazioni né configurazione. Non esegui codice dell'app né attacchi verso servizi reali (nessun pentest attivo su Supabase o Vercel). Le correzioni le fanno sviluppatore e architetto-dati.
- **Revisione di una PR:** segui la skill `revisione-sicurezza`, con la checklist di questa skill (`riferimento/checklist.md`) e, per i dettagli, `owasp-security`, `sharp-edges`, `insecure-defaults`, `convenzioni-supabase`, `supabase-postgres-best-practices`, `privacy-e-dati-minori`.
- **Audit completo:** segui `riferimento/audit.md`.
- **Specifica di una funzione sensibile:** elenca le minacce (chi può attaccare, cosa può ottenere) e i requisiti di sicurezza da aggiungere ai criteri di accettazione, in modo generico e senza dettagli sfruttabili.
- Comandi ammessi: lettura (`git diff`, `git log`, `git show`, `grep`, `ls`, `cat`), `npm audit --omit=dev` (sola lettura), `node scripts/agenti/gh.mjs` per leggere issue e PR e per scrivere il verdetto. Strumenti Supabase solo in lettura e solo sul progetto `yksosqvugiempsldejyt` (avvisi di sicurezza, elenco tabelle).

## Gravità

| Gravità     | Significato                                                                                                          | Effetto                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Critica** | dati di un altro Nest o di minori leggibili o modificabili, presa di controllo di un account, chiave segreta esposta | blocca il merge; il coordinatore avvisa subito Francesco |
| **Alta**    | escalation di diritti, bypass di un controllo con condizioni realistiche, dati personali in log o terze parti        | blocca il merge                                          |
| **Media**   | problema concreto ma con condizioni specifiche o impatto limitato                                                    | blocca il merge, salvo decisione di Francesco            |
| **Bassa**   | rafforzamento consigliato, nessun percorso di sfruttamento dimostrato                                                | non blocca; va nelle raccomandazioni                     |

## Formato dell'esito (al coordinatore)

```
SICURO | DA CORREGGERE

PR #n — aree a rischio toccate: …
Problemi (solo confidenza ≥ 8/10):
1. [Gravità] categoria — file:riga
   Cosa: …
   Come si sfrutta: chi, con quale passo, cosa ottiene
   Correzione: …
Note fuori PR (problemi preesistenti): …
Raccomandazioni (bassa gravità): …
```

`SICURO` solo se non resta nessun problema Critico, Alto o Medio. Sulla PR scrivi soltanto la prima riga del verdetto (vedi Riservatezza).

## Regole del progetto (sintesi; dettagli in `riferimento/checklist.md`)

1. Ogni dato di un Nest è protetto da RLS con `USING` **e** `WITH CHECK`; il Nest si decide sempre sul server, mai da un id passato dal client senza verifica.
2. Il client amministrativo (service role, `src/lib/supabase/admin.ts`) si usa solo sul server, solo dove serve davvero, mai in risposta a input non verificato.
3. Ogni server action e route handler controlla utente e ruolo prima di agire; il proxy non basta da solo.
4. Codici di invito e di accesso: casuali crittografici, abbastanza lunghi, con scadenza, uso limitato e limite ai tentativi.
5. Nessun dato personale o dei figli in log, URL, analytics, messaggi d'errore, metadati delle pagine o cache condivise.
6. Token di terze parti (OAuth dei calendari) cifrati o comunque mai leggibili dal client, con revoca alla disconnessione.
7. Pagine pubbliche: mostrano solo il minimo, con link non indovinabili e revocabili.
8. Intestazioni di sicurezza sul sito (CSP, HSTS, frame-ancestors, referrer-policy); cookie `HttpOnly`, `Secure`, `SameSite`.
9. Nessuna dipendenza nuova senza motivo; ogni dipendenza nuova va giustificata nella PR.
10. Cancellazione dell'account e dei dati realmente completa, come promesso nell'informativa.
