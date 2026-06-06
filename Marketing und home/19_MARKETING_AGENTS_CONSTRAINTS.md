# 19 — AGENTS-Constraints: Modul Marketing

**Zweck:** Ergänzung zur AGENTS.md im Projektroot, nur für das Modul „Marketing". Bindet `00_PRIORITY_RULES_KREILE.md` und `SPEC_LICENSE_FEATURE_TOGGLES_v1.md` ein. Liegt in derselben Logik wie das Buchhaltungspaket (12–18).

---

## 1. Geltungsbereich & Ziel

Antigravity baut das Marketing-Modul **strikt nach Dateien 19–25**. Ziel: ein **vollintegriertes, lernendes** System — keine isolierte Insel. Marketingkosten fließen automatisch in die Buchhaltung (Ausgabe), attribuierter Umsatz in Performance/Buchhaltung (Einnahme). Komplett über Feature-Toggle abschaltbar.

## 2. STOPP-Bedingungen (anhalten, Rückfrage)

- Eine Aktion würde **real auf einem Kanal posten / eine E-Mail an echte Kunden senden**, ohne dass (a) der Kanal verbunden, (b) die Aktion vom Inhaber freigegeben und (c) der Feature-Toggle aktiv ist.
- E-Mail-Versand an Kontakte **ohne dokumentierte Einwilligung** (Datei 24).
- Tracking, das **personenbezogene Daten ohne Rechtsgrundlage** an Dritte gibt.
- Migration würde bestehende Marketing-/Kundendaten löschen statt ergänzen.
- Unklarheit, ob die bestehende „Marketing & Kundenreaktivierung"-Seite ersetzt oder ergänzt wird (Regel 4).
- Git-Status nicht sauber vor struktureller Migration.

## 3. Anti-Drift-Regeln

- Nur Funktionen aus 19–25. Eigene Idee → `// VORSCHLAG (nicht bauen):`.
- Keine toten Buttons, keine Karte ohne echte Funktion oder klaren „in Vorbereitung"-Status mit Zielinhalt.
- Lernen ist Pflicht, aber als **nachvollziehbares Scoring/Regelwerk** (Datei 21), nicht als Blackbox. Kein Auto-Posten ohne Freigabe.
- Keine Tabellenoptik als Hauptdesign. Eine empfohlene Aktion im Vordergrund, Rest sortierbar.
- Kein direkter Channel-SDK-Call in UI-Komponenten — alles über Adapter (Datei 22).

## 4. Bestehende rudimentäre Marketing-Seite: ersetzen vs. ergänzen

| Bestand (Screenshot) | Aktion |
|---|---|
| Kundenreaktivierung, Kundensegmente, Mailentwürfe, Versandfenster, Wirkung & ROI | **erhalten + echt anbinden** (nicht wegwerfen) |
| KPI-Karten „Umsatz-Chancen / Folgepotenzial / Ausgeschlossen" | in neuen Funnel/Übersicht **überführen**, keine Dopplung |
| Datenstatus-Banner (Demo) | durch echten Reifegrad-Status je Funktion ersetzen |
| Neu: Lern-Hero, Attributions-Funnel, Sortier-/Filterleiste, Multi-Channel, Ideengebung, Dev-Telemetrie | **ergänzen** |

Vor dem Bauen: bestehende Marketing-Komponenten/Routen auflisten und gegen Funktionsliste (Datei 20 §3) abgleichen.

## 5. Tabuzonen

- Rahmen (linke Leiste, obere Suchzeile) unverändert; „Marketing" bleibt fixer Menüpunkt (bereits vorhanden), „Performance" ebenfalls.
- Andere Module nur lesend referenzieren (Kunden, Aufträge, Umsatz).
- Lizenz-/Feature-Toggle-Logik aus `SPEC_LICENSE_FEATURE_TOGGLES_v1.md` nutzen, nicht neu erfinden.

## 6. Sicherheits-Workflow vor strukturellen Änderungen

1. `git status` prüfen. 2. Snapshot-Commit `F-MK-00`. 3. Betroffene Dateien auflisten. 4. Migration schreiben → review → anwenden. 5. Nach Supabase-Migration Pflicht-Workflow + Verifikation auf Supabase (nicht nur lokal).

## 7. Commit-Konvention

`F-MK-XX kurze Beschreibung` (MK = Marketing). Ein Commit pro lauffähigem Schritt.
