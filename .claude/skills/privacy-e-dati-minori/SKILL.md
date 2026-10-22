---
name: privacy-e-dati-minori
description: Regole di privacy FamilyNest per dati di famiglie e bambini (GDPR, minori). Usala quando scrivi requisiti, schema dati, codice o revisioni che riguardano dati personali, profili dei figli, condivisione, log, analytics o cancellazione account.
---

# Privacy e dati dei minori

FamilyNest tratta dati di famiglie con bambini piccoli. Un errore qui non è un bug estetico: è un danno reale e un problema legale (GDPR, dati di minori). Nel dubbio si sceglie l'opzione più protettiva e si segnala a Francesco.

## Principi

1. **Minimizzazione:** si raccoglie solo ciò che serve a una funzione visibile all'utente. Ogni nuovo campo personale va giustificato nel requisito.
2. **Isolamento per nucleo:** un dato familiare è visibile solo ai membri di quel nucleo. Nessuna eccezione senza decisione esplicita di Francesco.
3. **I bambini non sono utenti:** i profili dei figli sono dati gestiti dagli adulti del nucleo. Nessun account, email o login per i minori.
4. **Trasparenza:** l'utente sa cosa condivide e con chi prima di farlo.
5. **Diritto all'oblio:** cancellare l'account deve cancellare davvero.

## Profili dei figli: campi ammessi

- Nome o soprannome, data di nascita (o solo anno), colore/avatar, note libere brevi.
- **Non** si raccolgono: codice fiscale, documenti, indirizzo della scuola, dati sanitari (allergie, diagnosi, farmaci), foto del volto per impostazione predefinita, posizione.
- Se un requisito chiede uno di questi dati, l'analista lo segnala come domanda bloccante a Francesco.

## Condivisione

- Invitare qualcuno nel nucleo è un'azione esplicita, con conferma e chiara indicazione di cosa vedrà.
- Gli inviti scadono e si possono revocare.
- Nessun contenuto del nucleo è pubblico o accessibile tramite link senza login.

## Log, errori e analytics

- Mai scrivere nei log, nei messaggi di errore o negli eventi analytics: nomi dei figli, date di nascita, email, testi liberi inseriti dall'utente, token.
- Negli analytics si usano solo identificativi anonimi ed eventi generici (es. `event_created`), mai contenuti.
- I messaggi di errore all'utente non mostrano dettagli tecnici o dati di altri.

## Cancellazione

- La cancellazione dell'account rimuove l'utente da tutti i nuclei; un nucleo senza più membri viene cancellato con tutti i suoi dati (`on delete cascade`).
- Nessun "soft delete" di dati personali senza scadenza documentata.

## Checklist per il revisore

- [ ] Nessun nuovo dato personale non previsto dal requisito
- [ ] Ogni nuova tabella ha `household_id` e RLS con test di isolamento
- [ ] Nessun dato personale in log, errori, analytics, URL o query string
- [ ] Nessun dato di minori oltre ai campi ammessi
- [ ] Azioni di condivisione esplicite e reversibili
