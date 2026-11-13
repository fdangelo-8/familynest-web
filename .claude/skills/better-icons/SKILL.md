---
name: better-icons
description: "Use only to prepare alternative icon sets for Francesco to review. Searches 200+ icon libraries (Iconify) and retrieves SVGs with `npx better-icons search <query>` and `npx better-icons get <id>`. The SVGs go to docs/agenti/proposte/icone/, never into the app sprite before approval."
---

> **Nota FamilyNest:** Questa skill vale solo per ciò che il mockup approvato e `design-system` non dicono, e per scrivere proposte in `docs/agenti/proposte/`. Se suggerisce valori, ombre, vetro, font, `scale` alla pressione, librerie o pacchetti diversi dal mockup, vale il mockup. Niente librerie nuove: solo CSS, `@starting-style` e WAAPI. Le regole di `docs/agenti/ARCHITETTURA.md` e delle skill di progetto prevalgono su questa skill.
>
> **Adattamento FamilyNest (vince sul resto della skill):**
>
> - **A cosa serve.** Solo a proporre set di icone alternativi a Francesco, che vuole rivedere le icone attuali. Finché Francesco non approva, l'app resta con lo sprite Lucide descritto in `design-system`.
> - **Dove vanno gli SVG.** In `docs/agenti/proposte/icone/` (una sottocartella per set, es. `docs/agenti/proposte/icone/tabler/`), salvati con lo strumento Write. **Mai** nello sprite dell'app, in `src/` o in `public/` prima dell'approvazione.
> - **Comandi ammessi.** Solo `npx better-icons@1.0.5 search` e `npx better-icons@1.0.5 get`, che stampano a schermo. Niente installazione globale (`npm install -g`, `bun add -g`), niente `bunx`, niente `better-icons setup` né `config` (configurano un server MCP), niente opzione `-d` / `--download` né redirezioni `>`: il file si scrive con Write.
> - **Rete.** Se `npx` non è disponibile o l'host `api.iconify.design` non è raggiungibile, fermati con `BLOCCATO` e scrivi il motivo. Non cercare le icone per altre vie.
> - **Licenze.** Ogni collezione Iconify ha la sua licenza: indicala nella proposta accanto al nome del set.

# Better Icons

Search and retrieve icons from 200+ libraries via Iconify.

## CLI

Run without installing, prefixing every command with `npx`:

```bash
# Search icons
npx better-icons@1.0.5 search <query> [--prefix <prefix>] [--limit <n>] [--json]

# Get icon SVG (outputs to stdout)
npx better-icons@1.0.5 get <icon-id> [--color <color>] [--size <px>] [--json]
```

## Examples

```bash
npx better-icons@1.0.5 search arrow --limit 10
npx better-icons@1.0.5 search home --prefix tabler --json
npx better-icons@1.0.5 get lucide:home
npx better-icons@1.0.5 get mdi:home --color currentColor --json
```

Copy the SVG printed by `get` into `docs/agenti/proposte/icone/<set>/<name>.svg` with the Write tool.

## Icon ID Format

`prefix:name` - e.g., `lucide:home`, `mdi:arrow-right`, `heroicons:check`

## Popular Collections

`lucide`, `mdi`, `heroicons`, `tabler`, `ph`, `ri`, `solar`, `iconamoon`

## API

All icons from `https://api.iconify.design`
