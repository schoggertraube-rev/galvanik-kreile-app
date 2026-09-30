<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# M07 KI-Suche — Optikvorlage

**Status:** FEHLT → Designphase 1b

**Kanonische UI-Quelle:** `02_app/docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html` · SHA-256 `75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA` · Anker/Funktion `#searchModal` / `openSearch()` als räumliche Basis des bestehenden Such-Overlays. Das V5-Mock enthält **keinen** M07-Screen und ist deshalb keine Vorlage für eine erfundene KI-Fläche.

**Kanonhinweis:** `docs/project/linie/ui/00_UI_REFERENZ_KANONISCH.md`, `CURRENT_DESIGN_REFERENCE.json` und D-UI-V5-003 bestimmen V5 als einziges Zielbild; V6 ist verworfen. Einzelmocks dienen nur zur Kontrolle. Kein Mock-CSS, keine eigenen Farbwerte und keine neue Route werden aus diesem Dossier abgeleitet.

## Geräteabdeckung

| Screen | Desktop ≥1300 px | Tablet | Handy | Zustände belegt | Quelle/Anker |
|---|---|---|---|---|---|
| KI-Antwort im bestehenden Such-Overlay | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 0/7 | V5 `#searchModal` belegt nur G08-Raum, nicht M07 |
| Quellen- und Datenstand-Ansicht | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 0/7 | D-AI-001; kein Mock |
| Aktionsvorschau und Bestätigung | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 0/7 | D-AI-002; kein Mock |
| M07-Statuskarte in Einstellungen | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 0/7 | G10-Hostintegration; kein Mock |

## Vollständige Inhaltsliste für Designphase 1b

| Screen | Person | Daten (Felder) | Aktionen | Zustände | Quelle |
|---|---|---|---|---|---|
| KI-Antwort im bestehenden Such-Overlay | alle berechtigten Personen | Frage; Modus deterministisch/KI; G08-Treffer; Antwort; Fakten; Schlussfolgerungen; Unsicherheiten; fehlende Daten; Coverage; Quellenanzahl; Datenstand; Korrelations-ID nur im Fehlerfall | Frage absenden; Treffer öffnen; Quelle öffnen; Frage präzisieren; Overlay schließen; zulässigen Aktionsvorschlag ansehen | Daten; lädt; leer; Fehler; gesperrt; In Klärung; In Aufbau | D-AI-001; `SearchTenantResult`; F-M07-001/002; Texte Q-M07-001 |
| Quellen- und Datenstand-Ansicht | alle berechtigten Personen | Citation-ID; Quellentyp; lesbarer Titel; Besitzer-Modul; Objekt-ID nicht als Roh-ID wenn unnötig; Match-Kontext; beobachtet am; Link; Berechtigungs-/Verfügbarkeitsstatus | Originalkarte öffnen; zur Antwort zurück; veraltete/fehlende Quelle melden | Daten; lädt; leer; Fehler; gesperrt; In Klärung; In Aufbau | D-AI-001; F-M07-003; Texte Q-M07-001 |
| Aktionsvorschau und Bestätigung | Person mit konkreter Command-Berechtigung | `actionKey`; menschenlesbare Aktion; Quellfakten; erwartete Wirkung; Vorbedingungen; Berechtigungsstatus; Warnungen; nach Ausführung Receipt und Readback | bestätigen; abbrechen; Originalquelle öffnen; nach Konflikt neu laden | Daten; lädt; leer; Fehler; gesperrt; In Klärung; In Aufbau | D-AI-002; F-M07-004; Texte Q-M07-001 |
| M07-Statuskarte in Einstellungen | Admin/Developer; andere Personen nur eigener Verfügbarkeitsstatus | Modulschalter; Host; Providerstatus ohne Secret; Region; Capability-Gate; Budgetstatus; letzter Health-Check; letzte E2E-Freigabe; Konfigurationsstand | Modul nach Gate ein-/ausschalten; Health prüfen; Audit öffnen; keine Secretanzeige und keine Provideranlage | Daten; lädt; leer; Fehler; gesperrt; In Klärung; In Aufbau | Anleitung §6 Modulschalter; D-ARCH-012; G10; Texte Q-M07-001 |

## Layout- und Interaktionsvorgaben

- M07 erweitert das vorhandene Such-Overlay; es eröffnet im MVP weder `/assistant` noch eine andere eigene Route.
- Deterministische Treffer bleiben beim KI-Laden sichtbar und bedienbar. Ein KI-Fehler darf sie nicht ersetzen.
- Quellen stehen unmittelbar an der zugehörigen Aussage; eine bloße Quellenliste am Ende genügt nicht.
- Fakt, Schlussfolgerung und Unsicherheit müssen auch ohne Farbe unterscheidbar sein.
- Ein Aktionsvorschlag ist nie die primäre Antwort und nie vorbestätigt.
- Touchziele, Fokusführung, Tastatur, Screenreader und Rückweg folgen dem Kreile-Designsystem und dem bestehenden G08-Dialog.
- Persistente Threadliste, Chatarchiv, Webrecherche und Unternehmensmeeting sind absichtlich nicht in der Screenliste.

## Designsystem-Bausteine

`kr-`-Bausteine: wird nach Phase 1 ergänzt. Erwartete Rollen, keine neuen Komponentenfestlegungen: Dialog/Sheet, Eingabe, Status, Citation, Disclosure, Warnung, Bestätigungsfläche, Receipt und Empty/Error-State. Die konkrete Auswahl, Benennung und visuelle Ausprägung entscheidet Designphase 1b.
