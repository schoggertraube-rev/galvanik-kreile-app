# Meldungen des Planungs-/Prüferchats an Endversion-Chat und Codex

Laufendes Protokoll, neueste Meldung oben. Der Planungschat prüft den Bau gegen BAUPLAN.json und die Dev-DB, pflegt die Warteschlange in `_review/AKTUELLE_ANWEISUNG.md` und schreibt keinen App-Code. Er liest `_review/MELDUNG_ENDVERSION_CHAT.md` bei jeder Kontrolle.

## 28.10. 12:40 – OWNER-ENTSCHEID: Eingang-Freeze (H8)

- Der Eingang wurde am 27.10. vor dem Baureife-Regime gebaut und weicht deutlich von der Endversion ab. Er wird **nicht weiter korrigiert**.
- Der Eingang kommt neu als **Modul „Eingang / Staubsauger“**, siehe ORIENTIERUNG_KLAERUNG Abschnitt 6 (Klärung A, dann B1/B2).
- Bau-Codex: nur Login, F0, F2 (baureif) sowie Stabilität. Sonst nichts.
- Bitte an den Endversion-Chat: F1 erst wieder baureif melden, wenn die Klärungen A und B1 übernommen sind. Korrekturen zu F1 im BAUPLAN als „zurückgestellt“ kennzeichnen.

## 28.10. 12:00 – OWNER-ENTSCHEID: Stufe 1 neu schneiden (U-212, bitte so übernehmen)

**Leitlinie: Infos rein → Auftrag durch → Rechnung raus.** Stufe 1 enthält nur das, nicht mehr. Was rausfällt, wird nicht gelöscht, sondern auf Stufe 2 / „geplant“ umgetaggt. Es erscheint grau, kein Knopf darf ins Leere führen, der Sackgassen-Check bleibt grün.

**Bleibt in Stufe 1:**
- **Rein:** Neuer Eingang (getippt, aus Mail, aus Beleg). **OCR vollständig**, das ist der Kaufgrund: Belege, Aufträge, Kunden, Visitenkarten, Lieferscheine. Kunde anlegen und vervollständigen (Pflichtdaten). KV → Auftrag. Suche. **Mail-Eingang** mit Zuordnung.
- **Durch:** Auftragskarte mit Ortskette (angenommen → Galvanik → fertig → abgeholt). Werkstattliste schlicht. „Der Tag“ schlicht (nur, was jetzt zu tun ist).
- **Raus:** Standardrechnung als PDF, Versand per Mail. Zahlung erfassen (bar, Karte, Überweisung) inkl. Skonto (U-111). Storno von Rechnung und Zahlung.
- **Basis:** Login, Rechte (F0), Firmendaten, Leistungskatalog, **Datenkiste/Import (für den Go-live nötig)**.

**Nach Stufe 2 bzw. „geplant“:** Outlook-Kalender, Abwesenheiten, Wochenplanung, Bündeln, Werkstatt-Risiken und Kennzahlen, Terminampel-Auswertung, Diktat, „Der Tag anpassen“, Entwürfe, Ausschuss, Teil-Storno, Mail-Vorlagen-Verwaltung.

**Neue Arbeitsweise (Owner):** Themen werden in eigenen **Klärungs-Chats** (Codex, nur lesend) geklärt. Ergebnis je Thema: `_review/KLAERUNG_<Thema>.md`. Der Endversion-Chat übernimmt die Datei in spec und BAUPLAN und visualisiert sie. **Ergänzen und ändern ja, nicht alles umwerfen.** Reihenfolge und Regeln stehen in `_review/ORIENTIERUNG_KLAERUNG.md`.

## 28.10. 07:00 – Antwort Owner: Bundesland (A-13)

- Owner: „Bundesland steht in den Daten und ist an der Adresse erkennbar.“ Also keine Frage an den Owner und kein festes Bundesland in der Spec.
- Regel für Spec/BAUPLAN: Das Bundesland für Feiertage wird **aus der PLZ der Firmendaten** (`company_settings.zip`) abgeleitet. Ändern sich die Firmendaten, ändert es sich mit. Ist die PLZ leer oder ungültig, gelten die bundesweiten Feiertage und es erscheint der Hinweis „Firmenadresse ergänzen“.
- Zur Info: Die Dev-DB enthält derzeit Testdaten (PLZ 70173 Stuttgart → Baden-Württemberg).
- Merge #154 um 06:50 nicht ausgeführt: CI am PR-Kopf rot (Lauf 04:44). Codex ist angewiesen, zuerst CI zu reparieren.

## 27.10. 23:00 – Empfang bestätigt

- U-211 (Baureife-Sperre) und H5 sind übernommen. H5 hat Vorrang vor Regel 4e.2: keine Backend-Vorarbeit für Abschnitte, die nicht baureif sind.
- Codex arbeitet heute Nacht nur H4 (Mock aus Git) und den Korrekturteil nach Schwere ab. Zuerst kommen die zwei schweren F0-Punkte.
- Kontrollen des Planungschats: 28.10. um 06:35 (Nachtbilanz), um 06:50 (Merge #154 nur ohne bekannten offenen Fehler in gebauten Teilen), um 10:07 und um 17:37.
- Bitte an den Endversion-Chat:
  - Jeden Abschnitt, der `baureif: true` wird, zusätzlich hier im eigenen Protokoll oben mit Uhrzeit melden. Der Planungschat setzt ihn dann in der Warteschlange auf „dran“.
  - Rückfragen von Codex (`codex/RUECKFRAGEN_*.md`) bitte beantworten, damit Codex nicht stehen bleibt.
