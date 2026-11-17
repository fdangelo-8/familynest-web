---
name: infrastruttura
description: Metodo di infrastruttura di FamilyNest - aree da presidiare (carichi e prestazioni, database, backup e ripristino, monitoraggio, email, dominio, costi, sicurezza dell'infrastruttura, procedure di emergenza), come si fa un controllo, come si stimano i costi e formato del rapporto. Usala per controlli dell'infrastruttura, problemi di prestazioni o disponibilità, scelte di piano o fornitore e prima di ogni lancio.
---

# Infrastruttura

FamilyNest gira su Vercel (Next.js, funzioni del server), Supabase (Postgres, Auth, Storage; progetto `yksosqvugiempsldejyt`) e GitHub Actions (CI e migrazioni). La responsabilità è che l'app regga, non perda dati, si accorga dei guasti e costi il giusto per la fase.

## Principi

1. **Misura, poi decidi.** Ogni proposta parte da un dato: log, consigli di Supabase, piani di esecuzione, utilizzo nei pannelli, limiti documentati dal fornitore. Le versioni e i limiti dei piani cambiano: verificali sulla documentazione ufficiale del momento e cita la fonte.
2. **Proporzione alla fase.** Oggi siamo in sviluppo, senza utenti veri; poi verranno la beta e il lancio. Non proporre infrastruttura da 100.000 utenti a 10 famiglie. Indica però in anticipo le soglie oltre le quali serve cambiare.
3. **Dati prima di tutto.** Backup verificati e un ripristino provato valgono più di qualsiasi ottimizzazione.
4. **Un guasto deve far rumore.** Ogni componente critico ha un avviso che arriva a una persona.
5. **Costi trasparenti.** Ogni proposta riporta il costo mensile e cosa succede se non la si fa.

## Aree

| Area                          | Domande chiave                                                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Carichi e prestazioni         | Tempi di risposta delle pagine e delle funzioni, avvii a freddo, regione delle funzioni vicina al database, cache, pagine dinamiche, dimensione dei bundle                            |
| Database                      | Indici mancanti o inutili, query lente, connessioni e pooling, crescita dello spazio, consigli `performance` di Supabase, pulizia dei dati scaduti, tabelle che crescono senza limite |
| Backup e ripristino           | Cosa copre il piano attuale, frequenza, conservazione, ripristino a un momento preciso, ripristino provato, copia dei file dello Storage                                              |
| Disponibilità e monitoraggio  | Errori del server, avvisi, controllo esterno che l'app risponda, stato dei fornitori, chi riceve l'avviso                                                                             |
| Email                         | Servizio usato per conferme, recupero password e inviti; limiti di invio; dominio mittente con SPF, DKIM e DMARC; consegna nella posta in arrivo                                      |
| Dominio e rete                | Dominio definitivo, DNS, HTTPS, redirect, firewall e limiti di richieste di Vercel                                                                                                    |
| Costi                         | Piani attuali e limiti gratuiti, uso commerciale ammesso dal piano, stima per fase, avvisi di spesa                                                                                   |
| Sicurezza dell'infrastruttura | Segreti per ambiente, rotazione delle chiavi, accessi ai pannelli con due fattori, anteprime protette, permessi dei workflow (con l'agente `sicurezza`)                               |
| Ambienti                      | Produzione, anteprime, sviluppo locale; separazione dei dati; un ambiente di prova per migrazioni rischiose                                                                           |
| Procedure                     | Ripristino, guasto di un fornitore, chiave compromessa, violazione di dati (con l'agente `legale-privacy`)                                                                            |

## Ruoli

- L'agente `infrastruttura` analizza e propone, e scrive le procedure in `docs/infrastruttura/`.
- L'architetto-dati scrive indici, query e migrazioni.
- Lo sviluppatore scrive il codice dell'app.
- Il coordinatore cambia CI e configurazione su `admin/*`.
- Francesco cambia i pannelli dei fornitori e i piani a pagamento.

## Formato del rapporto

Ordinato per priorità (Subito, Prima della beta, Prima del lancio, Più avanti). Ogni punto contiene:

- **Cosa:** il problema o il rischio, con il dato che lo dimostra.
- **Perché conta:** cosa succede se non si fa.
- **Chi lo fa:** l'agente, oppure Francesco con i passi esatti nel pannello.
- **Costo:** mensile o una tantum.

In fondo metti «Cosa va già bene» e le soglie da tenere d'occhio.
