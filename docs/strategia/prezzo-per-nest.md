14/11/2026

Documento vivo: si aggiorna quando un concorrente cambia prezzi o piani.

# FamilyNest Plus: un prezzo per tutto il Nest o per persona?

Versione 1, 14/11/2026. Preparato dallo stratega per Francesco, che propende per un Plus valido per tutto il Nest. Riparte da `business-case-mercato.md` (capitolo 4.5) e da `concorrenti.md` (capitolo 8.4). Prezzi e regole consultati il 14/11/2026 sulle schede dell'App Store e sui siti ufficiali; dove la fonte ufficiale non dice nulla lo scrivo. Fonti numerate in fondo.

## Riassunto per Francesco

1. **Quasi tutti fanno pagare la famiglia, non la persona.** Su 14 app con un piano a pagamento, 9 dichiarano per iscritto che un abbonamento vale per tutta la famiglia (Cozi, FamilyWall, Jam, Skylight, Shared, Mimko, Hearth, Life360, AnyList con il piano «Household»).
2. **Solo TimeTree sembra legato alla persona** (si compra dal proprio profilo, toglie la pubblicità a chi paga), ma non lo dice in modo esplicito. Todoist e Notion, strumenti generici, fanno pagare ogni persona.
3. **Il numero di persone incluse quasi nessuno lo scrive.** Lo dicono solo Mimko (gratis 2 adulti, Plus fino a 10, figli e animali sempre gratis) e Hearth (profili illimitati). FamilyWall limita i cerchi (Premium sui primi 5), non le persone.
4. **In Italia i prezzi annuali per famiglia vanno da 24,99 € (Famigliario) a 39,99 € (FamilyWall, Shared, Mimko).** Negli USA da 39 $ (Cozi Gold) a 119,99 $ (Jam).
5. **Raccomandazione: Plus per tutto il Nest, fino a 10 persone, pagato da un adulto, a 3,99 €/mese o 34,99 €/anno.** È la regola del mercato, è più facile da spiegare e fa entrare il partner senza chiedergli soldi. Il rischio principale (Nest «gonfiati» con persone che non vivono insieme) si tiene sotto controllo con il limite di 10 persone e con un solo Nest per account, che c'è già.
6. **Restano in attesa, per scelta di Francesco:** come si gestisce l'IVA (Stripe con Stripe Tax o Paddle) e il passaggio di Vercel al piano Pro.

---

## 1. Cosa fanno gli altri

Legenda della colonna «Vale per»: **famiglia** = la fonte ufficiale dice che un abbonamento vale per tutti; **persona** = vale solo per chi paga; **non dichiarato** = la fonte non lo dice e riporto l'indizio più forte.

| App                                  | Vale per                                                                                                                                                                                                     | Persone incluse                                                              | Mensile                                                                                                  | Annuale                                                                                   | Paese del prezzo                                  | Fonte                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------- |
| **TimeTree** Premium                 | **persona (probabile, non dichiarato)**: si attiva dal proprio profilo e si paga con il proprio account Apple o Google; i vantaggi (niente pubblicità, assistenza dedicata) sono descritti per chi si abbona | — (il calendario si condivide gratis con chiunque)                           | 2,99 €                                                                                                   | 29,99 €                                                                                   | Italia                                            | [1], [2], [3]                                   |
| **FamilyWall** Premium               | **famiglia**: alcune funzioni sono «available with FamilyWall Premium for the whole family»                                                                                                                  | nessun limite di persone scritto; Premium vale sui **primi 5 cerchi** creati | 4,99 €                                                                                                   | 39,99 €                                                                                   | Italia (c'è anche una voce a 8,99 € non spiegata) | [4], [5]                                        |
| **Cozi** Gold                        | **famiglia**: «One upgrade covers everyone in the family»                                                                                                                                                    | tutti i membri dell'account di famiglia, su ogni dispositivo                 | —                                                                                                        | 39 $ (USA); nello store italiano diverse voci da 34,99 € a 69,99 €, la più frequente 39 € | USA e Italia                                      | [6], [7]                                        |
| **Cozi** Max                         | famiglia (include Gold)                                                                                                                                                                                      | come Gold                                                                    | —                                                                                                        | 79 $ (USA); 89,99 € (Italia)                                                              | USA e Italia                                      | [6], [7]                                        |
| **Jam**                              | **famiglia**: «covers the entire family (partner, kids and caregivers too!)»                                                                                                                                 | nessun numero; anche babysitter e nonni                                      | 15,99 $                                                                                                  | 119,99 $                                                                                  | USA (non distribuita in Italia)                   | [8], [9]                                        |
| **Skylight** Calendar Plus           | **famiglia** secondo la FAQ di Skylight Plus («everyone in the family») e Digital Trends; la pagina di Calendar Plus non lo dice                                                                             | tutti quelli collegati agli schermi della casa                               | —                                                                                                        | 79 $                                                                                      | USA                                               | [10], [11], [12]                                |
| **FamCal** Gold                      | **non dichiarato**: la descrizione dice che la famiglia condivide un solo account; una recensione italiana si lamenta di non poter aggiungere persone senza pagare                                           | —                                                                            | 3,99 €                                                                                                   | diverse voci: 22,99 €, 29,99 €, 44,99 €                                                   | Italia                                            | [13], recensioni in `recensioni-concorrenti.md` |
| **Shared** Premium                   | **famiglia**: «tutti i membri del tuo Circolo beneficiano delle funzioni Premium»                                                                                                                            | non dichiarato                                                               | 4,99 €                                                                                                   | 39,99 €                                                                                   | Italia                                            | [14]                                            |
| **Famigliario** Plus                 | **non dichiarato**: la scheda dice solo «la Family Challenge per tutta la famiglia»                                                                                                                          | non dichiarato                                                               | 2,99 €                                                                                                   | 24,99 € (7 giorni di prova sull'annuale)                                                  | Italia                                            | [15]                                            |
| **Mimko+**                           | **famiglia**: «Per family, not per seat»                                                                                                                                                                     | gratis 2 adulti; Plus fino a **10 adulti**; figli e animali sempre gratis    | 4,99 €                                                                                                   | 39,99 €                                                                                   | Italia                                            | [16], [17]                                      |
| **Nido**                             | nessun piano a pagamento                                                                                                                                                                                     | —                                                                            | gratis                                                                                                   | gratis                                                                                    | Italia                                            | [18]                                            |
| **Hearth** (schermo più abbonamento) | **famiglia**: profili illimitati, anche nonni e babysitter                                                                                                                                                   | illimitate                                                                   | 9 $                                                                                                      | 86,40 $                                                                                   | USA                                               | [19]                                            |
| **Life360**                          | **famiglia**: le funzioni «cover all the family members in your Circle»                                                                                                                                      | tutta la cerchia                                                             | Silver 7,99 $, Gold 14,99 $, Platinum 24,99 $ (pagina ufficiale USA; fonti di terzi danno cifre diverse) | non verificato                                                                            | USA                                               | [20]                                            |
| **AnyList** Complete                 | **due piani**: persona o casa                                                                                                                                                                                | il piano casa non dice quante persone                                        | —                                                                                                        | 9,99 $ persona, 14,99 $ casa                                                              | USA                                               | [21]                                            |
| Todoist Pro (generico)               | persona                                                                                                                                                                                                      | 1                                                                            | —                                                                                                        | 60 $ a persona                                                                            | USA                                               | `concorrenti.md` [16]                           |
| Notion Plus (generico)               | persona                                                                                                                                                                                                      | 1                                                                            | circa 12 $ a persona                                                                                     | circa 10 $ a persona al mese                                                              | USA                                               | `concorrenti.md` [16]                           |

**Lettura dei fatti.**

- **La regola del settore è «una famiglia, un abbonamento».** La seguono tutte le app nate per la famiglia, italiane e americane. Fanno pagare la persona solo TimeTree (calendario per ogni tipo di gruppo, anche amici e lavoro) e gli strumenti generici.
- **Il limite di persone quasi nessuno lo scrive.** Chi lo scrive (Mimko) lo usa come leva: gratis per la coppia, a pagamento per la famiglia allargata.
- **AnyList è l'unico con due piani:** il piano casa costa il 50% in più di quello personale (14,99 $ contro 9,99 $). È un'idea da tenere per dopo, non per il lancio.
- **FamCal mostra il caso da evitare:** far pagare per aggiungere persone produce recensioni arrabbiate.

---

## 2. Raccomandazione per FamilyNest

**Plus vale per tutto il Nest.** Lo paga un adulto del Nest; ne godono tutte le persone del Nest, fino a 10. Prezzo come da business case: 3,99 €/mese o 34,99 €/anno, prova di 30 giorni senza carta.

### Come funziona, in pratica

| Domanda                                        | Proposta                                                                                                                                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chi può comprare Plus                          | qualsiasi adulto del Nest con account (non solo l'amministratore: chi organizza non è sempre chi gestisce le impostazioni)                                                                           |
| Chi ne gode                                    | tutte le persone del Nest, adulti con account, figli e animali; i figli non hanno account (regola della skill `privacy-e-dati-minori`)                                                               |
| Quante persone                                 | fino a 10, come nel gratuito: Plus non si compra per far entrare più persone, si compra per gli strumenti                                                                                            |
| Quanti Nest                                    | uno: oggi un account sta in un solo Nest («Sei già in un altro Nest», `APP.md`)                                                                                                                      |
| Se chi paga esce dal Nest o cancella l'account | Plus resta fino alla fine del periodo pagato, poi il Nest torna gratuito; i dati restano, si spengono solo gli strumenti Plus. Gli altri adulti ricevono un avviso e possono abbonarsi loro          |
| Dove si registra                               | il diritto a Plus sta sul Nest nel nostro database, chiunque sia il fornitore del pagamento (web oggi, store domani con #397). È il punto già segnato nella valutazione sugli strumenti di pagamento |
| Cosa vede chi non ha pagato                    | «Plus attivo, grazie a <nome>»: nessun invito all'acquisto per chi è già coperto                                                                                                                     |

### Pro

1. **È quello che il mercato si aspetta.** 9 app su 14 lo dichiarano, tra cui Mimko, l'app italiana più vicina a noi. Nessuna app nata per la famiglia dichiara un prezzo a persona.
2. **Si spiega in una riga:** «Un abbonamento per tutta la casa». Per persona servirebbe spiegare chi paga cosa.
3. **Aiuta l'invito del partner,** che è il nostro motore di crescita (business case, capitolo 5.3): il secondo adulto entra senza che gli si chieda di pagare.
4. **Coerente con il valore:** quello che Plus fa risparmiare (calendari collegati, riepilogo settimanale, Agente) vale per la casa, non per la singola persona. Nella skill `pricing` la metrica di prezzo deve crescere con il valore: qui il valore cresce con la casa, non con il numero di account.
5. **Evita il caso FamCal:** nessuno paga per aggiungere una persona.

### Contro e come li gestiamo

| Contro                                                                                       | Quanto pesa             | Come lo gestiamo                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ricavo per casa più basso di un prezzo a persona (una coppia a persona pagherebbe il doppio) | medio                   | stima: perché una coppia non paghi più dei concorrenti (24,99–39,99 € per tutta la famiglia), il prezzo a persona dovrebbe stare intorno a 17,50 €/anno (34,99 € diviso 2). Il ricavo per casa sarebbe simile, ma con più attrito. Il ricavo in più si cerca con un «Plus Famiglia» con più Agente (business case 5.3), non con il prezzo a persona |
| Nest «gonfiati» con amici o parenti che non vivono insieme                                   | basso                   | limite di 10 persone e un solo Nest per account; FamilyNest è per chi vive insieme                                                                                                                                                                                                                                                                  |
| Genitori separati con due Nest pagano due volte                                              | basso (caso secondario) | da rivedere quando ci sarà una funzione «due case»; una possibilità è uno sconto sul secondo Nest                                                                                                                                                                                                                                                   |
| Chi paga esce dal Nest (separazione, figlio grande che va via)                               | basso                   | regola della tabella sopra: Plus fino a fine periodo, poi avviso agli altri                                                                                                                                                                                                                                                                         |
| Negli store, l'acquisto di un adulto deve valere per gli altri                               | medio, solo con #397    | il diritto sta sul Nest nel nostro database; la «Condivisione in famiglia» di Apple non serve                                                                                                                                                                                                                                                       |

### Cosa non consiglio al lancio

- **Due piani persona e Nest** (come AnyList): due prezzi da spiegare per un vantaggio piccolo.
- **Gratuito limitato a 2 adulti** (come Mimko): spinge a pagare, ma contraddice il nostro gratuito «fino a 10 persone», che è il nostro argomento più forte contro Mimko (`concorrenti.md`, 3.5).
- **Prezzo a persona** (come TimeTree): va contro la regola del settore e contro la crescita per inviti.

### Come verificarlo

Nelle chiacchierate con le famiglie (`traccia-interviste.md`) la domanda di prezzo è posta «per tutta la casa, all'anno». Se più di metà delle persone, sentita la proposta, chiede «e il mio partner deve pagare?», vuol dire che il messaggio «per tutta la casa» va messo in prima riga.

### Decisioni in attesa

- **IVA:** Stripe con Stripe Tax oppure Paddle. In attesa, per scelta di Francesco.
- **Vercel Pro:** necessario con Plus in vendita. In attesa, per scelta di Francesco.

---

## Fonti

Consultate il 14/11/2026.

1. TimeTree, App Store Italia, acquisti in-app: https://apps.apple.com/it/app/id952578473
2. TimeTree, annuncio del Premium (19/04/2022): https://timetreeapp.com/intl/en/newsroom/2022-04-19/premium ; come si acquista: https://support.timetreeapp.com/hc/en-us/articles/4648121703193-How-to-purchase-TimeTree-Premium
3. Appllio, «TimeTree introduce il piano in abbonamento» (19/04/2022, in giapponese; assistenza dedicata a chi si abbona): https://appllio.com/news/2022-04-19-26131-timetree-subscription-plan
4. FamilyWall, App Store Italia (acquisti in-app; «applicate ai primi 5 cerchi creati»): https://apps.apple.com/it/app/id496889629
5. FamilyWall, «What is included in FamilyWall Premium»: https://support.familywall.com/en/support/solutions/articles/47001239196-what-is-included-in-familywall-premium-
6. Cozi, confronto dei piani: https://www.cozi.com/compare-plans/
7. Cozi, App Store Italia: https://apps.apple.com/it/app/id407108860
8. Jam, FAQ: https://jamfamilycalendar.com/faq
9. Jam, App Store USA: https://apps.apple.com/us/app/jam-family-calendar/id6449090626
10. Skylight, Calendar Plus: https://myskylight.com/products/calendar-skylight-plus/
11. Skylight, Plus (FAQ: «can be used by everyone in the family»): https://myskylight.com/plus/
12. Digital Trends, «Is Skylight Plus membership required?»: https://digitaltrends.com/home/is-skylight-plus-membership-required-skylight-cal-max
13. FamCal, App Store Italia: https://apps.apple.com/it/app/id1098999871
14. Shared, App Store Italia: https://apps.apple.com/it/app/id1345299534
15. Famigliario, App Store Italia: https://apps.apple.com/it/app/id6832292146
16. Mimko, sito («Per family, not per seat»): https://mimko.app
17. Mimko, App Store Italia: https://apps.apple.com/it/app/id6755377529
18. Nido, App Store Italia: https://apps.apple.com/it/app/id6783260939
19. Hearth, Family Membership: https://hearthdisplay.com/products/family-membership
20. Life360, piani (Canada, copertura della cerchia): https://i.life360.com/ca/plans-pricing/ ; piani USA: https://www.life360.com/?p=36520
21. AnyList Complete: https://www.anylist.com/complete

**Dati non disponibili e come ottenerli:** per TimeTree, FamCal e Famigliario la regola «persona o famiglia» non è scritta in nessuna fonte pubblica: si verifica con una domanda all'assistenza o provando l'acquisto con due account (non l'ho fatto: servirebbe registrarsi). Il numero massimo di persone per FamilyWall, Cozi, Jam e Shared non è pubblicato. Il prezzo di Life360 in Italia si legge nella scheda dell'App Store italiano, alla voce «Acquisti in-app».
