# Review P0 · B1-Korrektur

Prüfer: Claude · 25.10.2026 22:10 · Branch `kreile/b1-shell` · Produkt-SHA `4ba0be5b`, Kopf `e3301956` · PR #152 (Draft)

## IDs / Lieferumfang

| Punkt | Urteil | Beleg |
|---|---|---|
| Label „Kunden & Kontakt“ | PASS | `src/components/layout/MockAppFrame.tsx:91` |
| Bereiche Der Tag, Werkstatt, Aufträge, Kunden & Kontakt, Geld & Rechnungen | PASS | `MockAppFrame.tsx:88-93`; Test `src/components/layout/__tests__/p0SalesStageNavigation.realRender.test.tsx` |
| Zahlen (geplant), V8 `nav planned` + „geplant“, nicht klickbar | PASS | `MockAppFrame.tsx:95-97, 187-193` (disabled, ohne `data-href`); Test s. o. |
| Weiteres: Kalender, Material & Einkauf (geplant), Einstellungen | PASS mit Hinweis | `MockAppFrame.tsx:98-101, 197-204`; nur sichtbar bei `access.settings` → Werkstatt-Rolle sieht „Weiteres“ nicht (prüfen, ob gewollt) |
| Abnahme Rollen-Login → richtiges Home | FAIL (offen) | kein Beleg; ABGABE §2 „Nicht erstellt“. Login macht laut §1a der Owner mit bestehenden Nutzern |
| Screenshots aus Fresh-Replay (3 Größen je Rolle) | FAIL | ABGABE §6: nicht erstellt. §1a verlangt Fresh-Replay, keine Testnutzer in Live-DB nötig |

## Verbote

- P0-Commits (`68d627b3..e3301956`) ändern nur `.gitignore`, `docs/delivery/*`, `MockAppFrame.tsx`, neuen Test → sauber.
- PR #152 gegen `main` enthält aber Governance-Änderungen aus B1-Commit `89c16d77` / `939b4409` (vor P0): `.github/workflows/eslint-ratchet.yml`, `AGENTS.md`, `missions/F1_ORDER_TO_CASH_PILOT_001.yml`, `quality/authoritative-sources.json`, `scripts/quality/check-*.mjs`. Ohne belegte Owner-Freigabe = FAIL für den Merge.
- Keine Migration, keine Live-DB-Schreibzugriffe belegt, keine Demo-Daten in P0-Diff.

## Deploy / CI am SHA

- Vercel Preview: Ready (`dpl_4RBmcugq6Afb2uUV8ksmS6dSkXCf`), https://galvanik-kreile-werkstatt-kcrkqavkz.vercel.app
- GitHub PR #152: `agentur-gate` fail (2×), `quality` fail, `ratchet` fail; `Fresh Supabase replay` pass.

## Gesamturteil: FAIL

Codex behebt:
1. Screenshots 1914×917, 1220×880, 390×844 je Rolle aus dem Fresh-Replay erzeugen und in ABGABE_P0 verlinken.
2. ABGABE_P0 §2/§7 an §1a anpassen (keine Testnutzer nötig; Status „BLOCKED_EXTERNAL_PERMISSION“ ist überholt).
3. CI rot (`quality`, `ratchet`, `agentur-gate`) beheben bzw. Ursache je Job mit Log-Zeile in der Abgabe belegen.
4. In der Abgabe ausweisen, welche Owner-Freigabe die Governance-Änderungen aus `89c16d77` deckt; ohne Beleg aus PR #152 herausnehmen.
5. Klären/belegen: Werkstatt-Rolle ohne „Weiteres“-Block – entspricht das der Bauumfang-HTML?
