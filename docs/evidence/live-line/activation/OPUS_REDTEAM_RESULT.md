# Claude Opus Red-Team — Ergebnis

- Modell: `opus`
- Effort: `xhigh`
- Modus: read-only/restricted
- Ergebnis: `FAIL`
- Datum: 2026-10-11
- Hinweis: Der erste Max-Effort-Lauf endete nach 15 Minuten ohne Output im Tool-Timeout.
  Der verwaiste Prozess wurde beendet. Der kontrollierte kompakte Wiederanlauf lieferte
  dieses Ergebnis nach Exit 0.

## P0/P1-Findings

1. **P0 — SCOPE-SELFTEST-ROOT-MISSION:** Scope- und Advance-Selftests waren vom realen
   Laufzeiger abhaengig und waeren ab KR-L02 dauerhaft rot geworden.
2. **P0 — KEINE-REPARATUR-ODER-AMENDMENT-LANE:** `FAIL_FINAL` hatte keinen legalen
   Rueckweg; zugleich war der Aktivierungsbranch unbegrenzt wiederverwendbar.
3. **P1 — L17–L20-GATES-ALS-WRITERPAKETE:** Schlusspruefungen waren widerspruechlich als
   Writer-/Produktpakete modelliert.
4. **P1 — PRODUKTION-GLEICH-MAIN-MERGE:** Laufende Main-Deployments und finaler Livegang
   waren nicht eindeutig getrennt; der finale Deployment-SHA war nicht abschliessbar.
5. **P1 — SELBSTBESCHEINIGTE-EVIDENZ:** Paket-Specs liefen nicht als CI-Regression;
   Reviewer- und Owner-Receipts waren nur Freitextmarker.
6. **P1 — ZUSTANDSAUTOMAT-LUECKEN:** Blockzustaende waren aus laufenden Phasen nicht
   erreichbar; L20 hatte keinen legalen `DONE/LIVE_COMPLETE`-Pfad.
7. **P1 — FESTE-PFADE-VOR-MESSUNG:** Performancepakete konnten nach einer Messung auf
   einen Engpass ausserhalb ihrer vorab festen Schreibpfade treffen und in `FAIL_FINAL`
   enden, obwohl vor Writer-Start eine Scopeentscheidung noetig waere.
8. **P1 — ALTMATERIAL-NUR-PER-CLAUDE-TOOLSPERRE:** Altmaterial blieb fuer andere
   Ausfuehrende physisch erreichbar; die Root-`CLAUDE.md` war nicht maschinell gebunden.

## Verbindliche Korrekturrichtung

- Selftests vollstaendig synthetisch und zustandsunabhaengig machen.
- Aktivierung einmalig an den initialen Main-SHA binden und genau eine Owner-Amendment-
  Lane fuer dasselbe aktive Paket schaffen.
- KR-L17 bis KR-L20 als PL-/Owner-Gates ohne Produktwriter modellieren.
- Paket-Specs in CI als fortlaufende Regression ausfuehren und Review-Outputs mit Lauf-
  Metadaten und Hash binden.
- Blockzustaende mit Rueckkehrphase und Kandidatenbindung ergaenzen; L20 ueber einen
  eigenen Abschlussbranch schliessen.
- Performance-Scope erst nach Messung binden; ausserhalb des freigegebenen Scopes vor
  Writer-Start als Produktentscheidung stoppen.
- Historisches Material physisch archivieren; `CLAUDE.md` exakt an `AGENTS.md` binden.

## Einmalige Korrekturrunde

| Finding | Systemische Behebung | Maschineller Nachweis |
|---|---|---|
| SCOPE-SELFTEST-ROOT-MISSION | Scope-, Advance- und Close-Selftests erzeugen eigene synthetische Repositories und lesen keinen realen Laufzeiger. | `quality:package-scope:selftest`, `live:advance:selftest`, `live:close:selftest` |
| KEINE-REPARATUR-ODER-AMENDMENT-LANE | Aktivierung ist einmalig an den initialen Main-SHA gebunden. Nach `FAIL_FINAL` ist genau eine ownerautorisierte Scope-Amendierung desselben Pakets erlaubt. | Delivery- und Scope-Selftest enthalten positive und negative Amendment-Faelle. |
| L17-L20-GATES-ALS-WRITERPAKETE | KR-L17 bis KR-L20 sind `kind: GATE`, haben keinen Writer, keinen editierbaren Produktpfad und kein Produktdelta. | `quality:delivery-contracts` und `quality:package-scope` |
| PRODUKTION-GLEICH-MAIN-MERGE | Jeder Main-/Production-Effekt wird einzeln freigegeben; nur KR-L20 darf nach Smoke, Monitoring und Rollback-Nachweis `LIVE_COMPLETE` setzen. | `scripts/close-live-line.mjs` plus Close-Selftest |
| SELBSTBESCHEINIGTE-EVIDENZ | CI fuehrt alle Paket-Specs aus. Review-, Output- und Owner-View-Nachweise sind an Run-ID, Modell, Zeit, Exit, SHA256, Kandidaten-SHA und reale Screenshot-Dateien gebunden. | Workflow und Scope-Selftest |
| ZUSTANDSAUTOMAT-LUECKEN | Laufphasen koennen kontrolliert blockieren und ueber `resume_phase` zurueckkehren; KR-L20 hat einen eigenen, produktcodefreien Abschlussweg. | Delivery-Selftest und Close-Selftest |
| FESTE-PFADE-VOR-MESSUNG | Performancepakete binden ihren Schreibscope erst nach verpflichtender Preflight-Messung; Scope-Ausweitung stoppt vor Writer-Start als Produktentscheidung. | Planvertrag und Delivery-Gate |
| ALTMATERIAL-NUR-PER-CLAUDE-TOOLSPERRE | 276 konkurrierende aktive Altquellen wurden unveraendert in ein nicht ausfuehrbares Historienarchiv verschoben. `CLAUDE.md` ist exakt `@AGENTS.md`. | Authority-, Module- und Scope-Gates |

Die Tabelle ersetzt das historische `FAIL` nicht durch eine Selbsterklaerung. Ob die
Korrekturrunde akzeptabel ist, entscheidet das noch ausstehende unabhaengige Review des
exakten Aktivierungs-Commits.
