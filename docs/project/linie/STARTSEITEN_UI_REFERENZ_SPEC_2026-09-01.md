# KREILE — UI-Referenz & Startseiten-Spec (Konsolidierung) · 2026-09-01
*KEIN neuer Entwurf — Zusammenstellung bestehender, ratifizierter Festlegungen + Verweise. Gültigkeit über „DIE LINIE" (2026-08-28) + die Claude-Artefakte. Quellen: DIE LINIE, arbeitsmodus-Erinnerung, KREILE_UEBERGABE_FRONTEND_UMSETZUNG_V1. Owner ratifiziert Abweichungen.*

## 1 — KANONISCHE UI-REFERENZEN (final, aktuell nur als Claude-Artefakte)
- **Rolf „Der Tag" V8** → https://claude.ai/code/artifact/3c92c2b9-387a-4fff-8e91-3e77e291e950
- **Phillip „Werkstatt" V4** → https://claude.ai/code/artifact/1dd88584-14be-4dea-b032-ba075389f875
- **Auftragskarte MACHART_V8** · **Kundenkarte MACHART_V2** — dieselbe Design-Iteration, noch NICHT als Datei eingefroren.
- Demo-Daten in den Referenzen (Mustermann/300 SL) sind reine Design-Demo — **nie** als Produktdaten (kein Mock).
- OFFEN (Owner, Linie §6): die vier Referenzen als Dateien in `Kreile app\` exportieren → Freeze auf Disk.

## 2 — DESIGNSYSTEM (auf Disk, konsolidieren statt forken)
- `..\ui oberfläche app\Kreile Designsystem (Standalone) V2.html` = Kreile-Tokens (Navy/Cream/Brand, Fraunces + Inter, Touch 48px). Bestehende `globals.css` reconcilen, KEIN zweites Designsystem.
- Hinweis: `ui oberfläche app\` ist Archiv/„nicht Quelle der Wahrheit" — nur das Designsystem-HTML + die Referenzen oben sind gültig.

## 3 — NUMMERN-STRUKTUR (stabil, nicht neu erfinden)
1 Suche · 2 (2a–2d) Tag · 3 Eingang · 4 Aufträge · 5 Kunden · 6 Kalender · 7 Rechnungen · 8 Admin · 9 Telefonnotiz [F2] · 10 Ware raus. Gleiche Nummer = gleiche Funktion, über Versionen & Geräte stabil.
