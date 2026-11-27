# #506 · F5 Guscio e navigazione · risposte del designer

Risposte alle domande lasciate aperte da F5 (PR #656: autorevisione punti 1, 3 e 5; revisione del 27/11; tester visivo, commento «NON SUPERATO» del 27/11 22:10). Valgono per la correzione finale di F5 oppure per A1 (#534) e A4 (#537), secondo quello che decide Francesco in #506.

Il file sta qui e non in `docs/design/computer/`, perché quella cartella è l'archivio di Fable (fonte di verità) e queste sono misure e traduzioni in token del designer. Le tavole sono a 2x: ogni misura in px qui sotto è già divisa per 2. «Misurato» vuol dire che il valore viene dai pixel della tavola e non da una nota di Fable; dove la misura è una stima lo dico.

Token nuovi proposti (§8): `--grid-margine-capsula`, `--shadow-capsula`, `--blur-barra`, `--border-fuoco`, `--size-marchio-segno`. Sono in `riferimento/token.md` della skill. Li porta nel codice la PR `shared/*` (F5 o la sua correzione) in `src/app/globals.css` e in `docs/agenti/design/token.css`, nella stessa PR.

## 1. Capsula della barra in basso

Fonte: `docs/design/telefono/oggi/og1-02-dopo-la-cima-unica-aperta.png` (390 × 844, capsula con il disco dell'assistente), confermata da `og1-03` e `scelte-p7/sc1-18`. Colore del fondo da `docs/design/tavolozza.md`, ruolo `--c-barra` («Barra in basso del telefono»).

| Proprietà                     | Tavola (misurato)                                                                                                                                                                                             | Token                                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Margine a sinistra e a destra | 14 px dal bordo della finestra al bordo della capsula. Il filo è disegnato fuori: chi misura il filo trova 13 px. Il tester ha misurato «circa 14».                                                           | `--grid-margine-capsula` **nuovo**, 14px. `left: max(var(--grid-margine-capsula), var(--area-sicura-sinistra))`, così per `right`                                 |
| Margine sotto                 | 14 px nella tavola, che non disegna l'area sicura                                                                                                                                                             | `bottom: max(var(--grid-margine-capsula), var(--area-sicura-basso))`. Nel browser è uguale alla tavola, sull'iPhone la capsula resta sopra la barretta di sistema |
| Altezza                       | 64 px (filo escluso)                                                                                                                                                                                          | `--size-barra` (64), già esistente; aggiorna la nota «resta fino a F5»                                                                                            |
| Raggio                        | 28 px. Gli angoli non sono un semicerchio: a 10 e 14 px dal bordo in alto il profilo coincide con un raggio di 28, non con 32                                                                                 | `--radius-capsula` (28), **non** `--radius-tondo`                                                                                                                 |
| Fondo                         | traslucido: `rgba(255,255,255,.52)` in chiaro, `rgba(30,45,48,.9)` al buio. Si vede sotto, sfocato e quasi sparito, «Entro venerdì» della scheda                                                              | `--color-barra`, già nei tre blocchi del tema                                                                                                                     |
| Sfocatura                     | stima: il testo che passa sotto ha lo stesso contrasto della tavola con 8 px (con 0 px si legge, con 16 px sparisce)                                                                                          | `backdrop-filter: blur(var(--blur-barra))` (con `-webkit-`), `--blur-barra` **nuovo**, 8px                                                                        |
| Filo                          | 1 px `rgba(16,38,42,.1)` **fuori** dalla capsula, sopra l'ombra (scurisce l'ombra di circa 24 livelli sui quattro lati)                                                                                       | `--color-filo-barra`, dentro `--shadow-capsula`                                                                                                                   |
| Ombra                         | `0 8px 24px` con opacità .2. Ho rifatto la capsula nel browser con le ombre candidate: questa coincide con la tavola entro 3 livelli, sopra, ai lati e sotto. `--shadow-barra` (opacità .08) è troppo leggera | `--shadow-capsula` **nuovo**: `0 0 0 var(--border-sottile) var(--color-filo-barra), 0 8px 24px var(--color-ombra-forte)`                                          |
| Senza disco (oggi)            | la capsula va da margine a margine: 362 px a 390                                                                                                                                                              | griglia a 4 colonne `minmax(0, 1fr)` come adesso                                                                                                                  |
| Con il disco (B15)            | disco 52 px tondo, stesso filo e stessa ombra; tra capsula e disco 10 px (8 tra i due fili)                                                                                                                   | `--size-azione` (52); spazio `calc(var(--space-2) + 2 * var(--border-sottile))`. Non serve finché `ASSISTANT_AVAILABLE` è falso                                   |

Il resto non cambia: segnaposto di 128 px in fondo al contenuto (`telefono.md`) e voci come le ha già F5.

**Ripieghi** (non sono nella tavola, servono a leggere le etichette):

- `@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))`: fondo `--color-superficie`.
- `@media (prefers-reduced-transparency: reduce)` e `@media (prefers-contrast: more)`: fondo `--color-superficie`, niente sfocatura.

**Contrasti.** A riposo sotto la capsula c'è il bianco della pagina (128 px liberi in fondo): etichette `--color-inchiostro-medio` 9,80:1, voce scelta `--color-inchiostro` 15,76:1. Al buio, sul fondo pieno della barra, 9,46:1 e 12,51:1. Mentre si scorre può passare sotto un fondo scuro (un pulsante pieno) e lì il contrasto scende. È una scelta del design di Fable; i ripieghi qui sopra coprono chi chiede più contrasto o meno trasparenza.

## 2. Segno del marchio nella barra a icone

**Un marchio definitivo non c'è.** `docs/design/telefono/decisioni-fable.md` (tabella del perimetro, riga «Logo»): «In pausa». `docs/design/telefono/LEGGIMI.md` riga 89: «nelle schermate c'è il segnaposto 5A». Risposta 140: «si decide quando c'è il logo». Il segnaposto 5A però è approvato: è in tutte le tavole (risposta 8), e la tavolozza ha già i suoi due ruoli, nel codice come `--color-logo-a` («il tetto») e `--color-logo-b` («il secondo tratto»), con i valori chiari, scuri e su `--color-notte`.

**Cosa ci va fino al logo: il segnaposto 5A, non la «n».** Lo mostrano `computer/oggi/09` (1040, a icone), `oggi/03` (pannello aperto), `casa/01` e `oggi/02` (barra intera: segno, poi «familynest») e tutte le tavole del tablet. La «n» scritta è uno scostamento.

- **Dove:** dentro il componente unico del marchio (`Brand`, prop proposta `mark`), così quando arriva il logo si cambia un punto solo. Barra a icone: solo il segno, centrato. Barra intera: segno e poi la scritta, distanza `--space-2`.
- **Disegno:** due tratti a filo con le estremità tonde che si incastrano. Il tetto è un arco «n» in `--color-logo-a`; il secondo tratto è un «u» in `--color-logo-b`, spostato in basso a destra e disegnato sopra, con uno stacco di 1 px del colore del fondo della barra dove passa sopra il tetto.
- **Misure (ricalco dalla tavola, provvisorio):** riquadro 18 × 18 (`--size-marchio-segno` **nuovo**, 18px), tratto 3,5. In `viewBox="0 0 18 18"`: tetto `M1.75 11.25V5.75a4 4 0 0 1 8 0v5.5`; secondo tratto `M6.25 6.25v5.25a4.25 4.25 0 0 0 8.5 0V6.25`, sopra lo stesso percorso in `--color-carta-2` con tratto 5,5 per lo stacco. `fill: none`, `stroke-linecap: round`. Sono misure prese dai pixel (± 0,5 px). **Il coordinatore chiede a Fable il vettore esatto del segnaposto** (componente `CNome` del canvas): quando arriva, sostituisce questi percorsi senza cambiare nient'altro.
- **Accessibilità:** `role="img"`, `aria-label` = `BRAND.full`, non è un link e non prende il fuoco (§5 e §9 della specifica). Contrasto sul fondo della barra (`--color-carta-2`): tetto 10,92:1, secondo tratto 3,51:1; al buio 14,92:1 e 9,34:1.

## 3. Iniziale nel pallino della lente e del profilo

**Cosa disegna la tavola.**

- **Barra a icone** (`oggi/09`, `oggi/03`, tablet `orizzontale*/`): la lente sta sempre nel riquadro della voce scelta (fondo `--color-superficie`, filo interno `--color-filo`, raggio `--radius-m`, 48 come `--size-voce-icone`). Dentro, con «Io» c'è il pallino di 28 px della persona con l'iniziale; con «Nest» c'è l'icona `users` (due persone, a filo, misura delle altre icone della barra), già nello sprite. Niente punti dei quattro colori: il `quadrato-nest` della «LensDot» di F5 va tolto.
- **Profilo a icone:** il pallino di 28 px con l'iniziale, senza riquadro; con `aria-current` prende il riquadro della voce scelta.
- **Profilo nella barra intera** (`casa/01`, `oggi/02`): pallino di 24 px con l'iniziale, poi nome e «Il tuo Nest».
- **Misure del pallino:** 28 px = `--size-avatar-pila`, iniziale `--text-avatar-s-size`, la stessa regola di `.pila-avatar .avatar` (F4b); 24 px = `Avatar` `s`. Colori da `.membro-<codice>` (`--c`, `--c-iniziale`), con `initials` (`memberInitials`) quando due persone hanno la stessa lettera.

**Perché axe protesta.** `label-content-name-mismatch` controlla solo gli elementi con `aria-label` o `aria-labelledby`, e per «testo visibile» prende tutti i nodi di testo che si vedono, **anche quelli in `aria-hidden`** (axe-core 4.14, `visibleVirtual` senza il filtro dei lettori). Nella barra intera il testo visibile del link diventa «M Marco Il tuo Nest», che non è una sottosequenza di «Marco, Il tuo Nest». Mettere `aria-hidden` sull'iniziale quindi non basta.

**Soluzione: il nome viene dal contenuto, senza `aria-label`.** Il calcolo del nome salta l'iniziale in `aria-hidden`; axe non controlla l'elemento perché manca `aria-label`; per WCAG 2.5.3 il nome contiene tutto il testo visibile (l'iniziale è parte dell'immagine della persona).

Profilo (barra intera e a icone, stesso codice):

```tsx
<Link href={PROFILE_HREF} className="barra-laterale__profilo" aria-current={…}>
  <Avatar name={me.name} color={me.color} initials={…} nameShown />{/* aria-hidden */}
  <span className="barra-laterale__profilo-testi">
    <span className="barra-laterale__profilo-nome">
      {me.name}<span className="visivamente-nascosto">,</span>
    </span>{" "}
    <span className="barra-laterale__profilo-sotto">{yourNest()}</span>
  </span>
</Link>
```

Lente a icone:

```tsx
<button type="button" className="voce-barra voce-barra--lente" onClick={…}>
  {lens === "io" && me ? <Avatar … nameShown /> : <Icon name="users" />}
  <span className="visivamente-nascosto">{label}</span>{/* «Lente: Io» / «Lente: Nest» */}
</button>
```

- Nomi accessibili invariati: «Marco, Il tuo Nest», «Lente: Io», «Lente: Nest». I test per ruolo e nome non cambiano.
- Nella barra a icone i testi del profilo restano tagliati alla vista come adesso (`.barra-laterale__profilo-testi`), quindi restano nel nome. Il fumetto mostra il nome come oggi.
- Il pallino a 28 nella barra a icone: `.barra-laterale .avatar` con `--size-avatar-pila` e `--text-avatar-s-size`; nella barra intera torna a `s` (24).
- Si toglie `PersonDot` senza iniziale. Il fondo del riquadro della lente è `--color-superficie` in tutti e due gli stati: non è uno stato «scelto», è la forma della lente.

## 4. Aspetto della lente «Io | Nest» nel guscio

Variante nuova **`.lente--barra`** (classe in aggiunta a `.selettore.lente`) e prop `variant="barra"` di `Lens`. La usano la testata del telefono, la barra raccolta e la barra laterale intera. **Niente pallini delle persone e niente filo**: con `variant="barra"` `Lens` non disegna `avatar-gruppo`. Gruppo e pulsanti restano uguali: nome «Punto di vista: solo tu o tutto il Nest», «Io» e «Nest» con `aria-pressed`.

| Parte               | Telefono: testata e barra raccolta (`og1-03`; `og1-02` per la scena)                                                                      | Barra laterale intera (`casa/01`, `oggi/02`, `calendario-p12-16/01`)                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Capsula             | fondo `--color-premuto` (sulla scena di A1: `--color-superficie`), `box-shadow: none`, raggio `--radius-tondo`                            | fondo `--color-premuto` (il `--color-lente` di Fable, §13 della specifica), niente filo, raggio `--radius-tondo`          |
| Altezza e interno   | `min-height: var(--size-tocco)` (44), padding `--space-1` (4): segmenti alti 36                                                           | segmenti `min-height: var(--size-bottone-s)` (32), padding `calc(var(--space-1) - var(--border-sottile))` (3): capsula 38 |
| Larghezza           | dal contenuto: segmenti con padding in linea `--space-5`, misurati «Io» 52 e «Nest» 65; la capsula sta a sinistra (`justify-self: start`) | due metà uguali (`minmax(0, 1fr)`), larga quanto la barra meno il suo padding                                             |
| Segmento scelto     | fondo `--color-pieno`, testo `--color-latte`, raggio `--radius-tondo`                                                                     | uguale                                                                                                                    |
| Segmento non scelto | fondo trasparente, testo `--color-inchiostro`                                                                                             | fondo trasparente, testo `--color-inchiostro-medio`                                                                       |
| Testo               | 600 (`--weight-semi`), `--text-corpo-forte-size` / `-line` (15/20)                                                                        | uguale                                                                                                                    |
| Passaggio del mouse | —                                                                                                                                         | non scelto: testo `--color-inchiostro` (regola delle voci non scelte, `SKILL.md`)                                         |
| Area di tocco       | 44 (segmento 36 + `::before` di `.selettore__voce`)                                                                                       | 44 con lo stesso `::before`                                                                                               |

- Testo: «Nest» è largo 28–29 px con lettere maiuscole alte circa 9,5 px, cioè 14–15 px. Tra i token esistenti il più vicino è `--text-corpo-forte` (15/20), lo stesso delle voci della barra (`tokens-computer.md`, «Voce della barra», 600 · 15/20). Se il tester misura 14 px, scrive una domanda e non si aggiunge un token.
- Colore del testo non scelto misurato: `#10262A` sul telefono, `#33474B` sul computer.
- Contrasti: non scelto su `--color-premuto` 13,60:1 (inchiostro) e 8,45:1 (inchiostro medio); al buio 11,04:1 e 8,35:1. Scelto: 15,76:1, al buio 4,82:1. La capsula su `--color-carta-2` si distingue appena (1,07:1), come nella tavola: lo stato lo dice il segmento pieno, non il bordo.
- Fuoco: l'anello globale (§6) attorno al segmento.
- La lente **nelle pagine** (`.lente` senza variante) resta com'è finché A1 e A4 non la tolgono (§5).

## 5. Una sola lente da 900 px

**Confermato: da computer c'è solo la lente della barra laterale.** Tavole controllate:

- `computer/oggi/02` (1440) e `oggi/09` (1040): nel contenuto di Oggi ci sono titolo, saluto e conti, nessuna lente;
- `computer/casa/01` (1280);
- `computer/calendario-p12-16/01-settimana-con-le-ore-chiaro` (1280): nella fila della data ci sono frecce, «Oggi», l'intervallo, poi un pallino «M» e «Giorno · Settimana · Mese». Il pallino è «con chi vedo» di A4, non una lente.

Nella barra a icone la lente è il riquadro della §3.

Correzione in F5 (prima di A1 e A4): con la forma del computer (`(min-width: 900px) and (min-height: 600px)`) la lente dentro `main` non si mostra. Sotto i 1024 px l'intestazione da computer delle pagine è già nascosta; tra 1024 e oltre va nascosta la `.lente` di `.intestazione-desktop` di Oggi e del Calendario. A1 e A4 la tolgono dal codice. I test che usano la lente della pagina dal computer passano alla lente della barra laterale (`getByTestId("barra-laterale")`). Il test «le due lenti restano allineate» resta valido solo sul telefono, dove esiste la lente della testata, oppure si toglie.

## 6. Anello del fuoco: 2 px

**È corretto 2 px**, per tutta l'app. Fonti:

- `docs/design/computer/regole.md` riga 78: «anello di 2 px, colore #0F3D44, staccato di 2 px»;
- `tokens-computer.md`, «Fuoco»: `outline: 2px solid #0F3D44; outline-offset: 2px`;
- `riferimento/computer.md`, «Fuoco e mouse»;
- il fuoco è disegnato con lo stesso spessore nelle tavole del telefono del Passo 14 («Fuoco su Riprova»).

Fable non ha un anello diverso per il telefono.

**Il token `--border-medio` non va cambiato.** Vale 1,5 px ed è usato da circa 50 regole: il tratto delle icone Lucide, i fili dei campi, le caselle e la sottolineatura dei link. A 2 px cambierebbero tutte. Si aggiunge **`--border-fuoco: 2px`** (nuovo) e lo usa solo l'anello:

- regola globale `:focus-visible { outline: var(--border-fuoco) solid var(--color-fuoco); outline-offset: var(--space-half); }`;
- le varianti sui fondi scuri (`--color-latte`) con lo stesso spessore.

Conseguenze:

- CA-39 torna a 2 px (oggi il test verifica 1 px, perché 1,5 px su uno schermo 1x è disegnato a 1);
- i riferimenti visivi cambiano solo dove c'è il fuoco;
- è un cambio di `globals.css`, quindi va in una PR `shared/*` (la correzione di F5 va bene).

Collegato, da fare nella stessa PR: il campo con il fuoco ha nel design 2 px di inchiostro (`telefono.md`, «Campi»; `tokens-computer.md`, `.dk-fd`; `passi-12-16/decisioni.md`: «il campo con il fuoco tiene il filo scuro da 2 px»). L'anello interno di `.campo__input` e `.campo-frase` passa da `--border-medio` a `--border-fuoco`.

## 7. Classi di F5 nella skill

Scritte in questa PR in `.claude/skills/design-system/riferimento/componenti.md`, sezione «Guscio e navigazione (F5, #506)», e in `registro.md`. Comprendono `.btn-icona--pieno`, `.testa-giornata` e le classi del guscio, con le varianti nuove di queste risposte (`.lente--barra`, `.voce-barra--lente`, segno del marchio).

## 8. Token nuovi (riepilogo)

| Variabile                | Valore                                                                                     | Uso                                             |
| ------------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `--grid-margine-capsula` | `14px`                                                                                     | margini della capsula della barra in basso (§1) |
| `--shadow-capsula`       | `0 0 0 var(--border-sottile) var(--color-filo-barra), 0 8px 24px var(--color-ombra-forte)` | filo e ombra della capsula e del disco (§1)     |
| `--blur-barra`           | `8px`                                                                                      | sfocatura sotto la capsula (§1, stima)          |
| `--border-fuoco`         | `2px`                                                                                      | anello del fuoco e campo con il fuoco (§6)      |
| `--size-marchio-segno`   | `18px`                                                                                     | segno del marchio nella barra laterale (§2)     |

## Osservazione fuori dalle domande

Nelle tavole a 1280 e 1440 (`casa/01`, `oggi/02`, `calendario-p12-16/01`) la barra laterale intera misura 272 px (filo a destra a 272), non 248 come in `tokens-computer.md` (riga D-AC1:25, Passo 11). Lo segnalo e non lo cambio: F5 resta a 248 (`--size-barra-laterale`). Va chiesto a Fable quale dei due vale, prima del test visivo.
