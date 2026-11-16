# Skill di terze parti

Queste skill sono copie fisse (non si aggiornano da sole), controllate e in parte adattate a FamilyNest. Sono rilasciate con licenza MIT, tranne `sharp-edges` e `insecure-defaults` (CC BY-SA 4.0, vedi sotto).

| Skill                                                                                                                          | Fonte                                                                                                                       | Copyright                               | Modifiche                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `diagnosing-bugs`                                                                                                              | [mattpocock/skills](https://github.com/mattpocock/skills)                                                                   | (c) 2026 Matt Pocock                    | regole FamilyNest in testa, tolto lo script HITL                                                                                                                                                     |
| `writing-for-agents`                                                                                                           | [mattpocock/skills](https://github.com/mattpocock/skills)                                                                   | (c) 2026 Matt Pocock                    | nota d'uso in testa                                                                                                                                                                                  |
| `product-marketing`, `aso`, `ai-seo`, `pricing`, `content-strategy`, `onboarding`, `paywalls`, `referrals`, `social`, `launch` | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills)                                           | (c) 2025 Corey Haines                   | tolti 4 riferimenti con comandi e servizi esterni e la pubblicazione automatica dei post; l'adattamento all'Italia è in `.claude/agents/stratega.md`                                                 |
| `testi-naturali`                                                                                                               | [petergyang/no-ai-slop](https://github.com/petergyang/no-ai-slop) e [blader/humanizer](https://github.com/blader/humanizer) | (c) 2026 Peter Yang; (c) 2025 Siqi Chen | riscritta in italiano                                                                                                                                                                                |
| `revisione-sicurezza`                                                                                                          | [anthropics/claude-code-security-review](https://github.com/anthropics/claude-code-security-review)                         | (c) 2025 Anthropic                      | adattata da `.claude/commands/security-review.md`: comandi git eseguiti dall'agente, una sola scala di confidenza, esclusioni riviste per login e codici, formato dell'esito nella skill `sicurezza` |
| `owasp-security`                                                                                                               | [agamm/claude-code-owasp](https://github.com/agamm/claude-code-owasp)                                                       | (c) 2026 agamm                          | nota d'uso in testa, contenuto invariato                                                                                                                                                             |

## Skill con licenza CC BY-SA 4.0

| Skill               | Fonte                                                                                               | Copyright         | Modifiche                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `sharp-edges`       | [trailofbits/skills](https://github.com/trailofbits/skills), `plugins/sharp-edges`                  | (c) Trail of Bits | tenuta solo la guida JavaScript/TypeScript, sostituita la sezione sull'agente esterno                                            |
| `insecure-defaults` | [trailofbits/skills](https://github.com/trailofbits/skills), `plugins/insecure-defaults/references` | (c) Trail of Bits | copiati i 6 file di riferimento senza modifiche; `SKILL.md` scritto per FamilyNest; non inclusa la pipeline `workflows/audit.js` |

Queste due cartelle restano sotto CC BY-SA 4.0 (testo completo nel file `LICENSE-CC-BY-SA-4.0.txt` di ciascuna): chi le copia o le modifica deve citare Trail of Bits e mantenere la stessa licenza. La licenza riguarda solo queste cartelle, non il resto del progetto.

## Testo della licenza MIT

Vale per ciascuno dei titolari indicati sopra.

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
