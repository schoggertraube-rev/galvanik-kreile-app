# Review ABGABE_REPARATUR_ABSCHLUSS (H10, K25) — PASS

Geprüft: 28.10.2026 16:27 UTC · Kopf origin/kreile/s1-p2-eingang `70c93ef6` · Produktkopf K25 `d3bf7225`

## Ergebnis: PASS (keine Blocker)

- K25: Weitergabe an Phillip zeigt „bei Phillip · Frist …/bis erledigt“ + „Rückgängig“; Eintrag zählt nicht mehr in der Lage. Server liest aktive Zuweisungen aus `private.v_order_task_assignment_v1` (existiert seit Migration 20260820121500, remote vorhanden).
- Rückgabe: `handBackOrderTask` erlaubt jetzt zugewiesene **oder zuweisende** Person (orderTaskAssignmentCommand.ts:472, 524). Fachlich gewollt (Rückgängig durch Rolf), Versionsprüfung und Event bleiben; keine Rechteausweitung auf Dritte.
- Port `handBackOrder` in RolfHome.tsx verdrahtet. Keine Hex-Farben in neuen src-Zeilen, kein verbotener Pfad, keine neue Migration.
- K1–K25 laut Abgabe vollständig (K16 begründet zurückgestellt U-212).

## Hinweis (kein neuer Blocker dieses Pakets)

- DB: Remote 57 vs. Repo 58 — `20261028115141_f2_today_layout.sql` weiter nicht remote (offen aus TAG_07, Owner-Entscheid: anwenden oder herausnehmen). Vor Merge PR #154 zu klären.
- Owner-Klickweg (7 Schritte, Rolle Rolf) laut Abgabe offen.
