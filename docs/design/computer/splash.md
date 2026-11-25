# Lo splash finale (telefono, Passo 10)

Fonte: pagina «Passo 10 · Splash» del secondo canvas (`project/Q-SP1.dc.html`; animazioni in `project/v2.css`, righe 1293–1323). È lo splash dell'app su telefono, ritoccato nel Passo 10; sta nel secondo canvas perché il primo è al tetto dei file. Le stesse due righe sono aggiornate anche nel primo canvas (pagine «Passo 8 · Decisioni applicate» e «Passo 9 · Splash in dissolvenza»): la versione è una sola, e questa sostituisce i tempi della cartella `splash-p9/` del telefono dove sono diversi.

Le immagini sono in `splash/` (11 fotogrammi fermi; le tre tavole «in movimento» del canvas sono animazioni e non sono state salvate come immagine: i loro tempi sono qui sotto). Nel browser del telefono lo splash non c'è: la pagina si apre con lo scheletro di Oggi (vedi `web-da-telefono/`).

## Che cosa cambia rispetto al Passo 9

- La dissolvenza è in tre tempi: il marchio sfuma, il fondo scuro si schiarisce fino al colore del cielo di Oggi, Oggi emerge. Così a metà non c'è più il velo grigio.
- La versione lunga ha 900 ms di dissolvenza con un respiro prima di Oggi: 2,9 secondi in tutto (risposta 170: va bene).
- La breve resta a 1,4 secondi e finisce sempre in dissolvenza.

## Quando parte

| Caso                                               | Versione                                             | Durata                         |
| -------------------------------------------------- | ---------------------------------------------------- | ------------------------------ |
| Riapertura (l'app era chiusa)                      | breve                                                | 1,4 s                          |
| Prima apertura del giorno, o dopo un aggiornamento | lunga, con la frase «La casa, in un posto solo.»     | 2,9 s                          |
| Si torna entro un minuto                           | niente splash                                        | —                              |
| Movimento ridotto                                  | marchio fermo, poi il fondo si schiarisce e svanisce | 1,1 s (breve) · 1,75 s (lunga) |

Un tocco lo salta (uscita in dissolvenza di 150 ms). Lo splash non aspetta i dati e non si allunga: se i dati mancano emerge Oggi con lo scheletro, che si riempie in 180–200 ms senza spostare niente (con movimento ridotto lo scheletro non pulsa). Nessuna vibrazione e nessun suono, tranne la vibrazione leggera dello sblocco riuscito.

## Colori

| Momento                         | Colore                                                          |
| ------------------------------- | --------------------------------------------------------------- |
| Fondo dello splash              | #0B2A31                                                         |
| A metà dello schiarimento       | #2A7F8E (verde acqua pieno)                                     |
| Arrivo: cielo di Oggi di giorno | #BBE1F4                                                         |
| Marchio sul fondo scuro         | `--lg-a` #F2F6F3, `--lg-b` #8FD0CB; nome 26/32, -0,5 px, bianco |
| Frase della versione lunga      | 700 · 22/29, -0,3 px, bianca, centrata, sotto il nome           |

Il colore d'arrivo è quello del cielo di quel momento: azzurro di giorno, più caldo la sera, scuro di notte (lì il fondo quasi non cambia). Il CSS del canvas disegna il caso di giorno.

## Tempi esatti (dal CSS)

Curva `ez` = cubic-bezier(.32,.72,0,1). Gli istanti sono dall'avvio.

### Breve, 1,4 s (`.go.sp8s`, v2.css 1306–1311)

| Da     | Durata | Che cosa                                         | Keyframe e curva                  |
| ------ | ------ | ------------------------------------------------ | --------------------------------- |
| 0,10 s | 500 ms | il marchio si disegna (secondo tratto da 0,30 s) | `w5dr`, cubic-bezier(.45,0,.2,1)  |
| 0,45 s | 250 ms | compare il nome                                  | `w5fd`, lineare                   |
| 0,80 s | 220 ms | marchio e nome sfumano e crescono fino al 108%   | `sp9mk`, cubic-bezier(.4,0,.6,1)  |
| 0,86 s | 280 ms | il fondo passa #0B2A31 → #2A7F8E → #BBE1F4       | `sp10bg`, cubic-bezier(.4,0,.2,1) |
| 1,10 s | 300 ms | il velo azzurro svanisce                         | `sp9out`, cubic-bezier(.4,0,.2,1) |
| 1,10 s | 300 ms | Oggi emerge, dal 98,5% al 100%                   | `sp9in`, cubic-bezier(.2,0,0,1)   |

Fine a 1,40 s.

### Lunga, 2,9 s (`.go.sp8l`, v2.css 1312–1319)

| Da     | Durata | Che cosa                                              | Keyframe e curva                  |
| ------ | ------ | ----------------------------------------------------- | --------------------------------- |
| 0,10 s | 800 ms | il marchio si disegna (secondo tratto da 0,40 s)      | `w5dr`, cubic-bezier(.45,0,.2,1)  |
| 0,70 s | 400 ms | compare il nome                                       | `w5fd`, lineare                   |
| 1,10 s | 450 ms | prima riga della frase sale ed entra (14 px)          | `w5up`, `ez`                      |
| 1,25 s | 450 ms | seconda riga della frase                              | `w5up`, `ez`                      |
| 1,90 s | 300 ms | marchio, nome e frase sfumano e crescono fino al 108% | `sp9mk`, cubic-bezier(.4,0,.6,1)  |
| 2,00 s | 450 ms | il fondo passa #0B2A31 → #2A7F8E → #BBE1F4            | `sp10bg`, cubic-bezier(.4,0,.2,1) |
| 2,45 s | ~50 ms | il respiro: solo il colore del cielo                  | —                                 |
| 2,50 s | 400 ms | il velo azzurro svanisce                              | `sp9out`, cubic-bezier(.3,0,.2,1) |
| 2,50 s | 400 ms | Oggi emerge, dal 98,5% al 100%                        | `sp9in`, cubic-bezier(.2,0,0,1)   |

Fine a 2,90 s. La nota di Fable descrive la dissolvenza lunga come 300 + 450 ms, «un respiro di un decimo di secondo» e 400 ms di Oggi; nel CSS il respiro tra la fine dello schiarimento (2,45 s) e l'inizio dell'uscita (2,50 s) è di 50 ms. Da chiarire con Fable quale dei due valori vale, se conta.

### Movimento ridotto (v2.css 1320–1323)

Niente disegno del marchio e niente cambio di scala: tutte le animazioni sopra sono spente tranne il fondo.

| Versione | Fondo che si schiarisce    | Uscita            | Fine                 |
| -------- | -------------------------- | ----------------- | -------------------- |
| Breve    | 0,80 s per 120 ms, lineare | 0,92 s per 160 ms | 1,08 s (circa 1,1 s) |
| Lunga    | 1,40 s per 150 ms, lineare | 1,55 s per 200 ms | 1,75 s               |

### Keyframe

```css
@keyframes sp10bg {
  0% {
    background-color: #0b2a31;
  }
  50% {
    background-color: #2a7f8e;
  }
  100% {
    background-color: #bbe1f4;
  }
}
@keyframes sp9out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
    visibility: hidden;
  }
}
@keyframes sp9mk {
  from {
    opacity: 1;
    transform: none;
  }
  to {
    opacity: 0;
    transform: scale(1.08);
  }
}
@keyframes sp9in {
  from {
    opacity: 0;
    transform: scale(0.985);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes w5dr {
  from {
    stroke-dashoffset: 101;
  }
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes w5up {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes w5fd {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

## Verso lo sblocco (blocco acceso)

- La stessa dissolvenza in tre tempi, ma quello che emerge è la pagina dello sblocco. Face ID parte quando la dissolvenza è finita, non prima. Movimento ridotto: il fondo si schiarisce e svanisce in meno di 300 ms.
- Nella pagina dello sblocco tutto il resto è coperto: niente conti, niente barra in basso. Gli altri momenti (non riuscito, «Usa il codice») sono nel Passo 7 · Scelte applicate del primo canvas.
- Sblocco riuscito: la spunta per 300 ms, poi Oggi emerge in dissolvenza (200 ms), con una vibrazione leggera di conferma, l'unica della sequenza.
- Niente nome della persona e niente dati nello splash: viene prima dello sblocco.

## Dopo un aggiornamento

La stessa versione lunga, con una riga piccola in basso che dice la versione («Aggiornata alla versione 1.4»). Le novità stanno nel punto rosso su «Spazi», non qui.

## Immagini

| File                                                   | Che cosa                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------- |
| `splash/01-1-il-marchio.png`                           | breve, il fotogramma: fondo scuro, marchio e nome dal componente unico |
| `splash/02-2-il-fondo-prende-il-colore-del-cielo.png`  | il marchio è sfumato, il fondo arriva all'azzurro del cielo            |
| `splash/03-3-oggi-emerge.png`                          | il velo azzurro perde opacità, Oggi arriva al 100%                     |
| `splash/04-4-oggi-pronto.png`                          | Oggi completo                                                          |
| `splash/05-se-i-dati-non-sono-pronti-lo-scheletro.png` | Oggi con lo scheletro                                                  |
| `splash/06-i-tempi-e-il-movimento-ridotto.png`         | lo schema dei tempi dei tre casi                                       |
| `splash/07-il-fotogramma-con-la-frase.png`             | lunga, con la frase                                                    |
| `splash/08-il-respiro-solo-il-colore-del-cielo.png`    | il respiro                                                             |
| `splash/09-dopo-un-aggiornamento.png`                  | con la riga della versione                                             |
| `splash/10-lo-sblocco-fermo.png`                       | la pagina dello sblocco                                                |
| `splash/11-sblocco-riuscito-oggi.png`                  | Oggi dopo lo sblocco                                                   |

Le note complete di Fable per ogni fotogramma sono in `splash/note.md`.
