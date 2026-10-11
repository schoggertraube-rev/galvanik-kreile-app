---
name: npx-npm-permission-blocked
description: In Writer-Subagent-Laeufen koennen npx/npm (vitest, tsc, lint) permission-gesperrt sein; dann NOT_RUN melden, nicht umgehen.
metadata:
  type: feedback
---

Am 2026-10-05 (KR-22P) wurden alle `npx`/`npm run`-Aufrufe (vitest, tsc, lint:ratchet) vom Permission-System mit "requires approval" abgelehnt; `git`-Befehle liefen.

**Why:** Nur Permission-System/User duerfen freigeben; Umgehungsversuche (andere Wrapper, node direkt) waeren Selbstfreigabe.
**How to apply:** Einmal pruefen, bei Ablehnung keine Varianten durchprobieren; Pflichtchecks als NOT_RUN mit exakten Kommandos an den Conductor geben, Abschluss nicht als PASS melden (siehe [[integration-test-classification]], [[output-contract]]).
