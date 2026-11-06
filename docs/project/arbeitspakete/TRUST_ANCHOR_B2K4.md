# TA-B2k4 – CI schnell und stabil + Planungs-Sync (Planungschat, 06.11. 20:05)

Ein PR `codex/ta-b2k4` gegen main, Owner merged (Auto-Merge-Meldung). Ratchet nach P85 erwartet.

## 1. Browser ohne Download
Jeder Job, der Playwright-Browser braucht (V5-Shell-Smoke im Fresh-Replay-Job, generierte Flows im h16-Job), läuft im Container `mcr.microsoft.com/playwright:v<exakte Version aus package-lock>-jammy`; die Install-Schritte für Browser entfallen dort. Sonst keine Workflow-Änderung.

## 2. Generierte Flows: PR = eigene Seiten, main = alles
- Neue Datei `e2e/generated/_pr_scope.json` (je PR von Codex gesetzt): Liste der Seiten des Pakets. Im **PR-Lauf** führt der Generator nur die Wege dieser Seiten **plus** die Smoke-Auswahl (je Seite der erste Normalweg) aus.
- Auf **main** (push) und **nächtlich** (`schedule`, 02:30 Europe/Berlin) läuft weiterhin der **vollständige** Satz; Rot dort = Folge-PR nach Regel 27, kein Merge-Stopp für andere PRs.
- Fehlt `_pr_scope.json` oder ist sie leer: Volllauf (sicherer Standard).
- Kein Shard-/Parallelumbau in diesem Anker (DB-Isolation fehlt).

## 3. Planungs-Sync
Die im Arbeitsbaum geänderten Planungsdateien (`_review/**`, `docs/project/**` außer `ui/**`-Bündeln, die gebunden sind) werden **unverändert** mitcommittet, damit der Arbeitsbaum danach sauber ist. Vorher Kopie nach `C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\_pruefer\planbackup\<zeit>\` und Hash-Vergleich danach.

## Erlaubte Pfade
`.github/workflows/agentur-gate.yml`, `.github/workflows/quality.yml`, Generator-Skript und `e2e/generated/playwright.config.ts` (nur Auswahl-Logik), `e2e/generated/_pr_scope.json`, Checker-Selbsttest, `_review/**`, `docs/project/**`, Abgabe `docs/delivery/ABGABE_TA-B2K4.md`, Evidenz-JSON.
