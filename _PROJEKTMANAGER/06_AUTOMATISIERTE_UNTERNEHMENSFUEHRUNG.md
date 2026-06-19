# 06 — AUTOMATISIERTE UNTERNEHMENSFÜHRUNG
## Kreile WerkstattCockpit

---

## 1. Grundprinzip: Stufenmodell statt Blanko-Autonomie

„Nichts ist unmöglich" bedeutet hier: jede Automatisierungsidee bekommt ein Zielbild — aber keine Stufe überspringt die vorherige. Kein System trifft je Stufe 4 ohne explizite Nutzerfreigabe. Stufe 5 (kontrollierte Autonomie) ist ausschließlich für risikolose, vollständig protokollierte Aktionen reserviert (z. B. Status-Log schreiben).

| Stufe | Bedeutung |
|---|---|
| 1 — Information | System zeigt an, greift nicht ein |
| 2 — Empfehlung | System schlägt vor, Mensch entscheidet |
| 3 — Vorbereitung | System bereitet Aktion vor (z. B. Mahnschreiben-Entwurf), Mensch gibt frei |
| 4 — Freigabepflichtig | System würde ausführen, aber nur nach explizitem Klick |
| 5 — Kontrollierte Autonomie | Nur für risikolose, protokollierte Aktionen ohne Außenwirkung |

---

## 2. KI-Eskalations-Architektur (Kernprinzip, aus QS-16 übernommen)

Ziel: 90–95 % der Vorgänge intern und kostenlos lösen. KI nur, wenn das System überfordert ist.

```
1. App-Logik versucht es selbst (Regeln, SQL, Templates)   → 0 € KI-Kosten
2. Ergebnis unsicher / Sonderfall?                          → eskaliere
3. Günstiges Modell (Haiku-Klasse) versucht es              → bei Bedarf
4. Unsicher? → teureres Modell (Opus-Klasse)                → echter Notfall
```

**Konkrete Umsetzung:**
- Jede Funktion hat eine Confidence-Schwelle (Beispiel OCR: Score < 85 % → Modell-Eskalation, sonst Regelverarbeitung).
- Standard-Status-E-Mails: festes Template, 0 € KI-Kosten. Nur freie/komplexe Anfragen gehen ans Modell.
- Analyse: Kennzahlen werden ausschließlich von SQL/Views berechnet. Ein Modell schreibt höchstens den erklärenden Satz dazu, und nur auf Klick (nicht automatisch bei jedem Seitenaufruf).
- Modell-Auswahl ist eine Konfigurationszeile (`LLM_MODEL`-Config), kein Code-Umbau — vorbereitet für künftige Modellwechsel, ohne dass diese Wechsel heute Voraussetzung sind.
- System-Prompt und DB-Schema werden gecacht, um Kosten zu senken.

**Kostenrahmen (Größenordnung, regelmäßig zu verifizieren):** Einfache Funktionen (E-Mail-Entwurf, OCR-Nachbearbeitung) liegen im Bereich weniger Cent pro hundert Aufrufe. Komplexe Analysen (Chef-Zusammenfassung) liegen im Bereich weniger Cent pro Aufruf. Bei vernünftiger Eskalationssteuerung bleiben die Gesamtkosten auch bei täglicher Nutzung gering — entscheidend ist, dass nicht jeder Seitenaufruf eine teure Analyse auslöst.

---

## 3. Automatisierungsfunktionen — konsolidierte Übersicht

Quelle: QS-09 Abschnitt 5 (Stufenmodell) und QS-08 Abschnitt 5 (Nutzenbewertung), zusammengeführt.

| Funktion | Datenbasis | Auslöser | Freigabestufe | Phase |
|---|---|---|---|---|
| Tages-Prioritätsliste | `orders.dueDate`, `risk`, `currentStationId` | Täglich 06:00 Cron | 1 — Information | Phase 3 |
| Liegengebliebener Auftrag (>48h ohne Statuswechsel) | `orders.updatedAt` | Stündlich | 2 — Empfehlung | Phase 6 |
| Fertigstellungsprognose | Ø Verweildauer je Station × Auftragsstand | Neue Auftragsanlage | 1 — Information | Phase 6 |
| Mahnungs-Vorbereitung (>30 Tage offen) | `aging_bucket`, Rechnungsdaten | Täglich, SQL-View | 3 — Vorbereitung | Phase 6 |
| Abholbenachrichtigung | `currentStationId = warenausgang` | Statuswechsel-Event | 4 — Freigabepflichtig | Phase 6 |
| Nachkalkulation-Abweichung | `arbeitszeit_buchung` + Auftragswert | Auftragsabschluss | 2 — Empfehlung | Phase 6 (Voraussetzung: Arbeitszeit-UI fehlt noch) |
| Engpass-Erkennung | `currentStationId`-Zählung je Station | Stündlich | 2 — Empfehlung | Phase 5/6 |
| Rückruf-Erinnerung | `phoneNotes.status = waiting_callback` | Fälligkeitsereignis | 1 — Information | Phase 3 (VS-09) |
| Batch-Optimierung (ähnliche Teile, freie Kapazität) | Teiletyp + Kapazität | Täglich 07:00 | 3 — Vorbereitung | Phase 6, optional |
| KI-Wochenbericht | Alle KPIs, Vorwochenvergleich | Montags 07:30 | 1 — Information | Phase 6 |

**Wichtigster Sofortnutzen laut Nutzersimulation (QS-08):** Die Tages-Prioritätsliste ist die mit Abstand wirkungsvollste und am einfachsten umsetzbare Automatisierung — sie beantwortet direkt die Kernfrage des Nachfolgers („Was muss ich heute tun?"). Sie wird daher bereits in Phase 3 als UI-Block vorgezogen (VS-03), auch wenn die volle Automatisierungsschicht (Cron, Benachrichtigung) erst in Phase 6 folgt.

---

## 4. Warning Engine — Status und Lückenschluss

Die Warning-Engine-Infrastruktur (`engine.ts`, `hooks.ts`, `ruleRegistry.ts`, `store.ts`) ist laut QS-06 (F-007) bereits vollständig gebaut, aber ohne Live-Datenkopplung — ein Querschnittsmodul, das von keiner Seite aktiv konsumiert wird. Phase 6 ergänzt 3–5 Kernregeln (liegengebliebener Auftrag, Engpass, überfällige Rechnung) als ersten Wirkbetrieb, bevor das Regelwerk erweitert wird.

---

## 5. Chef-Dashboard — Anforderungen

Aus Nutzersimulation (QS-08) und Charter (Dok. 00):

- 60-Sekunden-Überblick ohne Navigation.
- Klartext statt Fachbegriff (siehe Dok. 04, VS-04).
- Jede Kennzahl löst eine Handlung aus (Button, nicht nur Anzeige).
- Vorwoche-/Vormonat-Vergleich ist Pflichtbestandteil, nicht optional — er ist der primäre Motivationsfaktor für den Nachfolger.
- „Fertig zur Abholung — Wert X €" als prominenter, klickbarer Block (VS-06).

---

## 6. Nachfolgerführung (Wissenstransfer)

Aus QS-09 Abschnitt 9, Punkt 5 — bisher nicht adressiert: Kein Prozess ist so dokumentiert, dass ein Nachfolger ohne Vorkenntnisse startet. Maßnahmen:

- Onboarding-Flow für neue Nutzer (kurz, kontextuell, kein PDF-Handbuch).
- Eingebettete Tooltips für Fachbegriffe statt externer Dokumentation.
- KI-Wochenbericht fungiert zusätzlich als impliziter Lerninhalt („3 Maßnahmen" erklären wirtschaftliche Zusammenhänge nebenbei).

Dieser Punkt wird in Phase 6/9 (kontinuierliche Weiterentwicklung) vertieft, ist aber kein Go-live-Blocker.

---

## 7. Monetäre Wirkung der Automatisierung

| Automatisierung | Erwarteter wirtschaftlicher Effekt |
|---|---|
| Tages-Prioritätsliste | Suchzeit ↓, Fokus ↑ |
| Liegengebliebener Auftrag | Durchlaufzeit ↓ |
| Fertigstellungsprognose | Anruf-Eingang ↓ (weniger Rückfragen) |
| Mahnungs-Vorbereitung | Liquidität ↑ |
| Abholbenachrichtigung | Abholquote ↑, Anrufe ↓, gebundenes Kapital ↓ |
| Kalkulationsmodul (Phase 4, kein Automatisierungs-Stufenmodell nötig, da Vorschlag immer manuell bestätigt wird) | direkte Umsatz-/Margenwirkung — höchste wirtschaftliche Priorität laut Plattformarchitektur |

---

## 8. Verantwortlichkeiten und Maßnahmenprotokoll

Jede automatisch erzeugte Empfehlung oder vorbereitete Aktion wird protokolliert: wer hat sie gesehen, wer hat freigegeben, wann, mit welchem Ergebnis. Dies ist Grundlage für das Audit-Log (siehe Dok. 05, Abschnitt 7) und verhindert „Geisterautomatisierung" ohne Nachvollziehbarkeit.

---

*Dieses Dokument definiert die Zielarchitektur für „Ziel 5: Automatisierte Unternehmensführung" aus dem Charter (Dok. 00). Es ist explizit Phase 5/6-Inhalt — keine dieser Funktionen blockiert den Go-live in Phase 1.*
