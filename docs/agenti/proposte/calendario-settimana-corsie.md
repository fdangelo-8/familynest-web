# Proposta · Corsie della settimana: barre più leggibili

Designer, 25/11/2026, da #537 (A4). **Non è nella specifica**: lo sviluppo resta fedele a `docs/design/telefono/calendario/settimana-a-corsie.png` finché Francesco non decide.

## Cosa non va

Nelle corsie una fascia occupata è una barra del colore della persona su una barra vuota grigio chiaro (`#EEF1EF` misurato). Il rapporto tra le due va da 1,57:1 (menta, Sofia) a 2,45:1 (corallo, Marco); WCAG 1.4.11 chiede 3:1 per i segni grafici che servono a capire. Con il sole sullo schermo, o per chi vede meno i colori chiari, la corsia di Sofia sembra quasi vuota. L'elenco sotto resta leggibile, quindi non blocca nessuno, ma le corsie servono proprio a capire «a colpo d'occhio».

## Cosa cambierei

- **Prima:** fascia vuota = barra grigia piena; fascia occupata = barra colorata.
- **Dopo:** fascia vuota = solo un filo di 1 px `--color-filo` (o niente); fascia occupata = barra colorata con un bordo di 1 px `--color-filo-campo` (`#7F9092`, 3,33:1 sul bianco, lo stesso del bordo dei campi). Così il contorno della barra occupata arriva a 3:1 anche quando il colore della persona è chiaro.

In alternativa, più leggera: tenere tutto com'è e scurire solo la barra vuota a `--color-filo-2` (`#C3CCC9`) a metà altezza, così il pieno si distingue per **forma** (alta il doppio) oltre che per colore.

## Perché

Le corsie sono la vista che si guarda per decidere chi va a prendere chi: deve funzionare anche in macchina, al sole, con un'occhiata. Nessun colore nuovo: solo token che ci sono già.
