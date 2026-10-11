# Opus-Red-Team: kompakter Wiederanlauf nach Tool-Timeout

Der erste identische Read-only-Lauf endete nach 15 Minuten ohne Output im Tool-Timeout.
Dies ist kein zweiter fachlicher Review, sondern der kontrollierte Wiederanlauf derselben
Pruefung mit begrenztem Pflichtkontext.

Arbeite nur lesend, ohne Subagenten und ohne Produktcode-Erkundung. Lies genau:

1. `AGENTS.md`
2. `.claude/settings.json`
3. `docs/delivery/KREILE_LIVE_PLAN_V1.json`
4. `missions/F1_ORDER_TO_CASH_PILOT_001.yml`
5. `docs/project/linie/00_UI_REFERENZEN_PFADE.md`
6. `scripts/quality/check-delivery-contracts.mjs`
7. `scripts/quality/check-live-package-scope.mjs`
8. `scripts/advance-live-package.mjs`
9. `.github/workflows/quality.yml`
10. `.github/workflows/eslint-ratchet.yml`

Entscheide, ob diese eine Linie vom aktuellen Zustand bis Live ohne systemische Sackgasse
aktivierbar ist. Pruefe nur:

- eine Plan-/Design-/Zustands-/Nachfolgerwahrheit,
- Paketgroesse und Reihenfolge aller 20 Pakete,
- Rollen- und Evidence-Widersprueche,
- exakten Kandidaten, Review, Owner-View, Merge und atomaren Nachfolger,
- CI-Umgehungen oder Transition-Deadlocks,
- Ausschluss von Altmaterial, V2 und Mockdaten.

Antworte kurz in exakt diesem Format:

`VERDICT: PASS` oder `VERDICT: FAIL`

Danach hoechstens acht Findings, nur P0/P1, jeweils:
`[P0|P1] ID | Beleg: Datei + konkrete Regel | Auswirkung | einfachste systemische Korrektur`

Dann:
`LIVE_PATH: <maximal 5 Saetze>`

PASS ist nur zulaessig, wenn es kein P0/P1 gibt. Keine Stilhinweise, keine P2/P3 und kein
neuer Parallelprozess.
