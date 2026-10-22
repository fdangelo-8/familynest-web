---
name: design-system
description: Design system di FamilyNest Web - token di colore, tipografia, spaziature, componenti e tono di voce. Usala prima di scrivere o rivedere qualsiasi interfaccia, CSS o testo visibile all'utente.
---

# Design system di FamilyNest

> **Stato: DA COMPLETARE.** Questa skill viene compilata dal designer durante la fase fondamenta, a partire dal mockup approvato in `docs/mockup/`. Finché la sezione "Token" è vuota, nessuna pagina può essere sviluppata: l'unico lavoro ammesso è la issue `fondamenta` del design system.

## Regole sempre valide

- Solo CSS proprio. I valori vivono come variabili in `:root` dentro `src/app/globals.css`; i componenti usano **solo variabili**, mai colori, font o misure scritti a mano.
- Niente Tailwind, niente librerie di componenti, niente CSS-in-JS.
- Mobile first: si scrive prima il layout a 390 px, poi si adatta a 1280 px con media query.
- Un componente condiviso vive in `src/components/ui/<Nome>/` con il suo file CSS module; se una pagina ha bisogno di una variante nuova, la definisce il designer qui, non lo sviluppatore.
- Niente estetica "generata dall'AI": niente gradienti viola, card inclinate, ombre pesanti decorative, CTA generiche ("Clicca qui", "Invia"), icone `+` senza testo dove il mockup ha un'etichetta.
- Tema scuro: solo se previsto dal mockup.

## Token

<!-- Il designer compila queste tabelle dal mockup. Nome variabile → valore → uso. -->

### Colori

| Variabile | Valore | Uso |
|---|---|---|

### Tipografia

| Variabile | Valore | Uso |
|---|---|---|

### Spaziature, raggi, ombre

| Variabile | Valore | Uso |
|---|---|---|

### Breakpoint

| Nome | Larghezza |
|---|---|
| mobile | fino a 767 px |
| desktop | da 1024 px |

## Componenti

<!-- Per ogni componente: nome, varianti, stati (default, hover, focus, disabilitato, errore), note di accessibilità. -->

## Tono di voce

<!-- Dal mockup: come si parla all'utente, esempi di testi per bottoni, stati vuoti, errori, conferme. -->

## Registro delle modifiche

| Data | Modifica | Issue |
|---|---|---|
