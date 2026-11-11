---
name: build-work-package
description: Baut ein freigegebenes Kreile-Arbeitspaket end-to-end.
---
Prüfe zuerst Board Decision, Verträge, Konsumenten, Tests und Rollback.

Schreibe nur als ausdrücklich beauftragter, alleiniger Writer im freigegebenen Scope. Main-Writer und Build-Engineer dürfen niemals gleichzeitig schreiben.

Dann:
1. Git/Pfad/WIP
2. Root Cause
3. DB/Migration
4. Serververtrag
5. Konsumenten
6. UI-Zustände
7. Persistenz/Reload
8. Folgeprozesse
9. Analytics
10. Tests/Evidence
11. Build Handoff

Friere den Prüfstand auf einem Exact-SHA ein und übergib ihn an einen unabhängigen Reviewer. Keine Selbstabnahme und kein Merge.
