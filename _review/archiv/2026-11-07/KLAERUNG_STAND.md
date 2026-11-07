# Klärungsstand

Stand: 28.10.2026
Rolle dieser Datei: Organisationsstand. Keine Bau- oder Freigabemeldung.

## 0. Quellen-Freeze

### Reproduzierbarer Bau- und Prüfstand

- Repository: `C:/Antygravityprojekte/04_Kundenprojekte/galvanik_kreile/02_app`
- gültiger Arbeitszweig: `kreile/s1-p2-eingang`
- gültiger eingecheckter Stand: `dce52ad1c774897d1ef1dd1d6aa01608577fd45f`
- offener PR: `#154`, Basis `kreile/s1-p1-daten`, Zustand beim Freeze `CLEAN`
- Die sichtbaren Prüfungen sind für genau diesen eingecheckten Stand grün. Sie belegen **nicht** die lokalen, noch nicht eingecheckten Änderungen.
- Beim Freeze lagen 16 vorgemerkte und 4 zusätzlich nicht vorgemerkte Dateiänderungen vor. Sie gehören nicht diesem Klärungsauftrag und bleiben unangetastet.

### Gültige Klärungsquellen dieses Laufs

1. Direkte Owner-Aussagen im aktuellen Klärungslauf.
2. `_review/OWNER_ENTSCHEIDUNGEN.md`
   SHA-256: `62ef7b847897499b2e54a7287e00a63823445d46a1d34dc00c30c5cd76cb043c`
3. `_review/ORIENTIERUNG_KLAERUNG.md`
   SHA-256: `e8139b08c7206be8123e94be3dea2feec2ca24def6121327d55fcce1be0454c4`
4. `docs/project/endversion/codex/BAUPLAN.json` in der lokalen Arbeitskopie
   SHA-256: `2f953ae2301947e99f4c93ca594ae055ce268561b2ca3382daceedb31bb108ce`
5. Tatsächlich vorhandener Code, Datenmodell und nachweisbare Lieferbelege; bei Widersprüchen wird nicht aus einer Planung auf eine fertige Funktion geschlossen.
6. Offizielle externe Vorgaben für Recht, Formate und Anbietergrenzen.

Der lokale Bauplan ist die aktuelle **Klärungsgrundlage**, weil er die neueren Korrekturen enthält. Er ist jedoch gegenüber dem genannten Commit verändert und bereits vorgemerkt. Bis zu einem eigenen geprüften Commit ist deshalb nur der Commit oben ein reproduzierbarer Bau- und Prüfstand.

### Was bei Mail und OCR noch keine freigegebene Produktwahrheit ist

Folgende Bauplanregeln werden im jeweiligen Themen-Chat als Arbeitsannahmen behandelt und einzeln gegen die Owner-Entscheidungen geprüft:

- Mailabruf nur für die letzten 30 Tage;
- App-Status `offen`, `zugeordnet`, `archiviert`, ohne Änderung im Outlook-Postfach;
- „Nicht zuordnen“ bedeutet appseitiges Archivieren;
- genaue Reihenfolge und Trefferlogik Absender → Kunde, Betreff/Nummer → Auftrag;
- Umgang mit unbekannten Absendern, Antworten auf eigene Mails und mehrfachen Anhängen;
- bisherige Beschränkung der Anhänge auf PDF/Bilddateien; XML-E-Rechnungen sind neu ausdrücklich Teil der Klärung;
- bei OCR: konkrete Belegarten, Pflichtfelder, Gütegrenzen, Kosten-/Seitenlimits und Fehlerweg. Bestätigt sind bereits das Sichern des Originals, Vorschläge statt stiller Übernahme und menschliche Bestätigung.

Die Kennzeichnung `A-xx` im Bauplan allein macht eine Annahme nicht zur Owner-Entscheidung. Erst das Ergebnis der Themenklärung und die spätere Übernahme durch den Endversion-Chat ändern die Produktvorgabe.

### Sicherung der Steuerdateien

Der Owner hat die dauerhafte Absicherung mit **U-214** entschieden: `OWNER_ENTSCHEIDUNGEN.md`, `AKTUELLE_ANWEISUNG.md`, `MELDUNG_*.md`, `ORIENTIERUNG_KLAERUNG.md`, `KLAERUNG_*.md` und `DEZEMBER_LISTE.md` werden versioniert; vorläufige Prüfdateien bleiben ignoriert. Die technische Umsetzung und der reine Dokumentationscommit gehören ausschließlich zum Bau-Codex gemäß H6. Der Organisations-Klärungschat ändert weder `.gitignore` noch Commitstand.

## Reihenfolge und Status

| Schritt | Status | Hinweis |
|---|---|---|
| 0 Quellen-Freeze | erledigt, vom Owner bestätigt | U-214 regelt die dauerhafte Versionierung; Commit nur durch Bau-Codex/H6 |
| **A Modul „Eingang“ – Gesamtkonzept** | **jetzt starten** | gemeinsame Begriffe, Zustände, Ampel, Zuordnung, Verlauf, Rechte und Anbindung an „Der Tag“ für alle Kanäle |
| **B1 Physischer Eingang** | wartet auf A | Paket/Wareneingang und Kunde persönlich; darf nach A parallel zu B2 laufen |
| **B2 Mail-Eingang** | wartet auf A | Anhänge sowie XML-/ZUGFeRD-E-Rechnungen; darf nach A parallel zu B1 laufen |
| B3 Papier, Foto, Scan, OCR | wartet auf B1/B2 | gemeinsame Erkennung für die Eingangskanäle |
| B4 Eingangsrechnungen | wartet auf B3 | alle Formate; Stufe 1: erfassen, ablegen, prüfen; Buchung später |
| B5 Telefon | wartet auf B4 | Anruf → Notiz → Zuordnung |
| C Ausgang und Korrespondenz | wartet auf B5 | KV → Auftrag, Bestätigungen, Rückfragen, Rechnung und Mahnwesen |
| D Datenkiste/Import | wartet auf C | benötigt das geklärte Datenmodell |
| E Go-live-Betrieb | parallel jederzeit erlaubt, noch nicht gestartet | berührt den Bau nicht; keine Produktions- oder Provideraktion durch Klärungs-Chats |

Nach Abschluss von A dürfen höchstens zwei Themen-Chats gleichzeitig laufen. B1 und B2 sind dafür das vorgesehene Paar und verwenden verbindlich die in A festgelegten Begriffe und Zustände.

## Direkte Owner-Vorgaben dieses Laufs

- Der Quellen-Freeze ist bestätigt. Die Reihenfolge aus Abschnitt 6 der Orientierung ersetzt die frühere Nummernfolge: **A → B1/B2 → B3 → B4 → B5 → C → D**, E jederzeit parallel.
- Das neue Modul „Eingang“ ist ausdrücklich erlaubt. Verbindliche Gestaltung entsteht erst durch die spätere Übernahme des Endversion-Chats.
- E darf parallel geklärt werden, weil es den Bau nicht berührt.
- U-214 erlaubt die Versionierung der dauerhaften Steuerdateien; committen und die Ignore-Regel ändern darf nur der Bau-Codex gemäß H6.
- Diese Freigabe erlaubt keine Produktionsänderung, Provideranlage, kostenpflichtige Buchung oder Änderung am laufenden Bau.
