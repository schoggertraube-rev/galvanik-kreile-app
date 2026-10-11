---
name: bibel-repo-divergence
description: Governance-Dokumente existieren doppelt (00_BIBEL-Master vs. 02_app/docs/project/linie-Repokopie); Master darf vorauslaufen, Repokopie ist Nacharbeit
metadata:
  type: project
---

Governance-Wahrheitsdateien (z. B. `KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md`) liegen zweimal: Master unter `C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\00_BIBEL\` und Repokopie unter `02_app/docs/project/linie/`. Bei Schreibvorgängen mit Repo-Schreibsperre wird nur der Master editiert; die Repokopie hängt dann bewusst hinterher.

**Why:** Der Owner-Prozess erlaubt Governance-Schreibvorgänge am Master ausserhalb eines Paketbranches; die Repokopie wandert erst mit dem zugehörigen Paket-PR (Allowlist) nach.

**How to apply:** Bei Abnahmen Master-Hash als Prüfgegenstand nehmen, Repo-Hash-Abweichung als dokumentierte offene Nacharbeit melden statt als FAIL. Zum Abschluss eines Pakets prüfen, dass Master und Repokopie wieder byteidentisch sind (sha256 beider Pfade vergleichen).
