---
name: insecure-defaults
description: Finds insecure defaults that make an app fail open - fallback secrets, default credentials, security switches that default to off, weak crypto, permissive access (public buckets, CORS *, broad grants) and debug output leaking to users. Use during a security audit or when a PR touches configuration, environment variables, auth setup, storage or error handling.
---

<!-- Wrapper written for FamilyNest around the reference files of trailofbits/skills (plugins/insecure-defaults/references), (c) Trail of Bits, CC BY-SA 4.0 (see LICENSE-CC-BY-SA-4.0.txt). The original plugin runs a multi-agent pipeline (workflows/audit.js) that is NOT included: only the reference files are copied, unchanged. This folder stays under CC BY-SA 4.0. -->

# Insecure defaults

An app is insecure by default when the easy path - a missing env var, a forgotten flag, a seeded account - silently turns protection off. Look for each category below, and read its reference file before deciding: every file lists **Report when** and **Skip when**, with vulnerable/secure pairs.

| Category            | Typical sign                                                                 | Reference                                                   |
| ------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Fallback secrets    | `process.env.KEY ?? 'dev'`                                                   | [fallback-secrets.md](references/fallback-secrets.md)       |
| Default credentials | seeded `admin` / `admin123`, test users reachable in production              | [default-credentials.md](references/default-credentials.md) |
| Fail-open switches  | `REQUIRE_AUTH` defaulting to false, auth skipped when a check throws         | [fail-open-security.md](references/fail-open-security.md)   |
| Weak crypto         | MD5/SHA1 for secrets, `Math.random()` for codes or tokens                    | [weak-crypto.md](references/weak-crypto.md)                 |
| Permissive access   | public storage buckets, CORS `*` with credentials, `grant all`, RLS disabled | [permissive-access.md](references/permissive-access.md)     |
| Debug leakage       | stack traces, SQL or internal errors returned to the browser                 | [debug-features.md](references/debug-features.md)           |

FamilyNest specifics to check in every category: Supabase keys (the service role key must never reach the client or a `NEXT_PUBLIC_*` variable), test users and seed data (must not exist in the production project), invite and access codes (must come from a cryptographic random source with enough length and an expiry), Vercel environment variables per environment.

A finding is reported only with the file, the line, the concrete path to exploitation and the fix, in the format of the `sicurezza` skill.
