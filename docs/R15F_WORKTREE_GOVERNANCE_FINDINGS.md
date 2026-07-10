# R15F Worktree Governance Findings

## 1. Zweck
Diese Datei dokumentiert die bei R15C–R15F entdeckten Pfad-, Branch-, Worktree- und Governance-Probleme. Ziel ist Fehlervermeidung vor weiterer Integration.

## 2. Aktueller Arbeitsstand
- Aktiver Integrationsordner: C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app_r15e_integration
- Branch: feature/integration-capture-r15e
- Basis: origin/feature/capture-auth-tenant
- HEAD: 5220b85b5f21b2ba7d5f32e4b36bdf0be36721c9
- Basis-Worktree vor R15F-Doku: sauber
- Aktueller Worktree nach R15F-Doku: eine neue untracked Doku-Datei
- Zweck: temporärer Integrations-Worktree, nicht finaler kanonischer Dauerpfad

## 3. Entdeckte Fehler und Risiken

| Fehler/Risiko | Befund | Auswirkung | Korrekturregel |
| :--- | :--- | :--- | :--- |
| 1. Falscher Arbeitsordner in früheren Prompts | Prompts verwiesen mehrfach auf 02_app_r14c_s1_clean, während Antigravity im Projektkontext tatsächlich in 02_app arbeitete. | R15C1 wurde im Clean-Clone erstellt und lokal committed, aber nicht im kanonischen 02_app. | Jeder Prompt muss Get-Location und git rev-parse --show-toplevel als harte STOPP-Prüfung enthalten. |
| 2. Zwei parallele lokale Wahrheiten | 02_app steht auf feature/capture-auth-tenant, 02_app_r14c_s1_clean steht auf feature/right-nav-focus, 02_app_r15e_integration steht auf feature/integration-capture-r15e. | Pfad-/Branch-Verwechslung und Doppelarbeit möglich. | Vor jeder Mission aktiven Pfad, Branch, HEAD und Worktree-Liste dokumentieren. |
| 3. Dirty kanonischer Ordner 02_app | 02_app enthält viele untracked Agentur-/Audit-/Log-Artefakte. | direkte Integration in 02_app ist riskant. | Keine Integration in dirty 02_app; zuerst isolierter Integrations-Worktree. |
| 4. Lokaler R15C1-Commit nicht remote | 0370dab docs(env): document local runtime requirements existiert nur lokal in 02_app_r14c_s1_clean. | Dokumentationsstand ist nicht automatisch in der aktuellen Integrationsbasis vorhanden. | R15C1 später gezielt als Patch übernehmen, nicht blind pushen. |
| 5. Divergente Branches | feature/capture-auth-tenant und feature/right-nav-focus divergieren seit Merge-Base c7862240f8f6087321a1a72e08e3aed1641ecb92. | Full-Merge/Blind-Cherry-Pick kann Auth-, Header-, Startseiten- und Repository-Logik beschädigen. | R15-Slices nur selektiv und mit Konfliktprüfung integrieren. |
| 6. .env.local.example Governance-Fehler | .env.local.example war durch .env* ignoriert und in 02_app anders als im R15C1-Clean-Clone. | Env-Vertrag war nicht eindeutig versionierbar. | .env.local bleibt ignoriert, .env.local.example muss versionierbar sein und keine echten Werte enthalten. |
| 7. Berichtsnachweise früher unvollständig | Frühere Reports enthielten Branch/HEAD, aber nicht konsequent Get-Location und git rev-parse --show-toplevel. | falscher lokaler Arbeitsordner wurde zu spät erkannt. | Pfadprüfung ist ab sofort Pflicht vor jeder Bau-, Commit- oder Integrationsmission. |
| 8. Temporäre Worktree-Vermehrung | git worktree list zeigt mehrere Worktrees, darunter 02_app, 02_app_r14c_s1_clean und 02_app_r15e_integration sowie weitere temporäre Worktrees. | steigendes Risiko falscher Bearbeitung, falscher Commits und späterer Aufräumfehler. | Temporäre Worktrees werden nur nach schriftlicher Freigabe entfernt; vorher Inventar und Sicherungsklassifikation. |

## 4. Aktuelle Arbeitsregel ab R15F
- 02_app bleibt kanonischer Projektpfad, ist aber aktuell nicht Integrationsarbeitsfläche.
- 02_app_r15e_integration ist die temporäre Integrationsarbeitsfläche.
- 02_app_r14c_s1_clean bleibt nur Referenz für R15C1 und right-nav-Fixes.
- Keine Arbeit ohne explizit genannten aktiven Ordner.
- Keine automatischen Löschungen von Worktrees oder Artefakten.

## 5. Nächster zulässiger Schritt
- R15G: Selektive Integration vorbereiten.
- Zuerst nur konfliktarme Artefakte prüfen:
  - src/lib/auth/localUserSession.ts
  - supabase/migrations/20260709140000_s1_clean_production_orders_view.sql
  - docs/R15C_LOCAL_ENV_RUNTIME_STATUS.md
  - .env.local.example / .gitignore-Regel
- Konfliktträchtige Dateien erst später:
  - src/app/actions/auth.ts
  - src/components/start/EmailLoginDialog.tsx
  - src/components/layout/KreileHeader.tsx
  - src/app/start/page.tsx
  - src/lib/repositories/ordersRepository.ts

## 6. STOPP-Regeln
- STOPP, wenn aktiver Ordner nicht 02_app_r15e_integration ist.
- STOPP, wenn Branch nicht feature/integration-capture-r15e ist.
- STOPP, wenn Worktree nicht sauber ist.
- STOPP, wenn ein Agent direkt in 02_app integriert.
- STOPP, wenn ein Agent Worktrees löschen will.
- STOPP, wenn ein Agent R15C1 blind pusht.
- STOPP, wenn ein Agent Full-Merge der divergenten Branches vorschlägt.
