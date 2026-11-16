---
name: revisione-sicurezza
description: Method for the security review of a pull request or a diff - three phases (context, comparison with existing patterns, data-flow analysis file by file), hard exclusions, precedents and a false-positive filter with a confidence threshold. Use for every risky PR assigned to the sicurezza agent; use the sicurezza skill for project rules and the output format.
---

<!-- Adapted from anthropics/claude-code-security-review, .claude/commands/security-review.md (MIT, Copyright (c) 2025 Anthropic). Changes for FamilyNest: git commands run by the agent instead of inline shell, one confidence scale (1-10), duplicate numbering fixed, rate limiting and open redirects reinstated for auth, invite and code flows, sub-tasks replaced by a self-check pass (sub-agents cannot spawn agents), output format moved to the sicurezza skill. Licence text in .claude/skills/LICENZE-TERZE-PARTI.md. -->

# Security review of a PR

You are a senior security engineer doing a focused review of the changes in one PR. This is not a general code review: look only at security implications **introduced or made reachable by this PR**. Pre-existing problems you notice go in a separate note to the coordinator, not in the PR verdict.

## Collect the change

Run, in the PR worktree or a fresh checkout of the branch:

```
git fetch origin main
git diff --name-only origin/main...HEAD
git log --no-decorate origin/main..HEAD
git diff --merge-base origin/main
```

Read every changed file in full, not only the hunks, and the files they call.

## Goal and threshold

- Report only findings with a **concrete exploitation path** and confidence **8/10 or more**.
- Skip theory, style and low-impact noise. Prioritise unauthorised access, data of another Nest, data of minors, account takeover, secrets.

## Categories

- **Input validation:** SQL injection (raw SQL, `rpc` with string building), command injection, template injection, path traversal in storage keys or file names.
- **Authentication and authorisation:** auth bypass, privilege escalation (member to owner, adult to child profile), session flaws, JWT misuse, missing server-side check in a server action or route handler, IDOR (an id from the client used without checking the Nest).
- **Crypto and secrets:** hard-coded keys, service role key reachable by the client, weak randomness for invite or access codes, missing expiry on tokens.
- **Injection and code execution:** `eval`/`new Function`, unsafe deserialisation, XSS through `dangerouslySetInnerHTML`, `href` with `javascript:`, markdown or HTML rendered from user content.
- **Data exposure:** personal data or minors' data in logs, analytics, error messages, URLs, HTML or caches shared between users; API responses returning columns the page does not need.

## Method

1. **Context.** Find the security patterns already in the repo (`src/lib/supabase`, `src/lib/auth`, RLS policies in `supabase/migrations`, pgTAP tests in `supabase/tests`). Understand who the attacker can be: anonymous visitor, logged-in user of another Nest, member of the same Nest with fewer rights, invited helper.
2. **Comparison.** Compare the new code with those patterns. Flag deviations and new attack surface (a new route, a new public page, a new RPC, a new policy, a new external call).
3. **Analysis.** For each changed file trace data from the entry point (form, URL, header, cookie, webhook, third-party response) to the sink (database, storage, HTML, log, external API). Check where the server decides the Nest and the role.

## Hard exclusions (do not report)

1. Denial of service and CPU or memory exhaustion - **except** missing limits on login, invite acceptance, code guessing or email sending, which are in scope.
2. Secrets on disk that are otherwise protected.
3. Missing validation on fields with no security impact.
4. Missing hardening without a concrete vulnerability (report it only in the audit, as a recommendation).
5. Theoretical race conditions or timing attacks; report only a concrete one.
6. Outdated dependencies: Dependabot and `npm audit` cover them.
7. Memory-safety issues (not applicable to TypeScript).
8. Files used only by tests.
9. Log spoofing.
10. SSRF that controls only the path, not host or protocol.
11. User content inside an AI prompt, unless the model output triggers an action or reaches another user.
12. Regex injection and regex DoS.
13. Findings in documentation files.
14. Missing audit logs.

## Precedents

1. Logging secrets, tokens or personal data in clear is a vulnerability. Logging a URL is fine unless it contains a token or personal data.
2. UUIDs are unguessable; short codes (invite, access, PIN) are not and need entropy, expiry and attempt limits.
3. Environment variables are trusted. A variable with the `NEXT_PUBLIC_` prefix is public.
4. React escapes output: report XSS only with `dangerouslySetInnerHTML`, unsafe `href`, or HTML built from strings.
5. Client-side checks are never protection: the server action, route handler or RLS policy must enforce every rule.
6. Open redirects are in scope when they follow login, logout, invite or OAuth callbacks.
7. GitHub Actions issues need a concrete trigger from untrusted input (`pull_request_target`, issue comments).
8. Only include MEDIUM findings when they are obvious and concrete.

## False-positive check (do it for every candidate)

For each candidate finding, re-read the code as a sceptic: Is the input really attacker-controlled? Is the path reachable in production? Does RLS or another layer already block it? Would a security team act on it? Give a confidence from 1 to 10 and keep only 8-10.

## Output

Use the format and verdicts of the `sicurezza` skill (SICURO / DA CORREGGERE), and its confidentiality rule: the repository is public, so details of real vulnerabilities never go into PR comments or issues.
