<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G01_FUNDAMENT_RECHTE — Optikvorlage

## Verbindliche Quelle

**Quelle:** `docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html`  
**SHA-256:** `75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA`  
**Anker:** `renderLogin`, `.login-page`, `.login-card`, `.login-pin`, `.keypad`, `settingsPage`, `moreModal`  
**Seitenwahrheit:** `docs/project/linie/00_UI_REFERENZEN_PFADE.md`; V2/V3/V4-Gesamtmocks und V6 sind kein Bauinput.

Der V5-Login ist Ablauf-/Optikreferenz, seine PINs und alle Demodaten sind ausschließlich synthetisch. Die neue Personenrechteverwaltung besitzt noch keinen freigegebenen Mock und geht deshalb zwingend durch Designphase 1b; vorhandene Alt-Admin-Komponenten sind keine Optikvorlage.

| Screen | Desktop ≥1300 px | Tablet | Handy | Zustände belegt | Quelle/Anker |
|---|---|---|---|---|---|
| Persönlicher Einstieg | ✓ | ✓ | ✓ | 5/7; Rest → Q-G01-001/Q-G01-002 | V5 `renderLogin`, `.login-card`; Einzelquelle Start-/Rollen-Vertrag D-UI-V5-002 |
| PIN-Dialog Rolf/Phillip | ✓ | ✓ | ✓ | 5/7; Rest → Q-G01-002 | V5 `.login-pin`, `.pin-dots`, `.keypad` |
| Gregor E-Mail-Einstieg | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 5/7 aus Ist-Code, finale Optik 0/7 | D-UI-V5-002; Ist `EmailLoginDialog.tsx` ist keine Zielvorlage |
| Gregor Systemadministration | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 2/7 | Ist `SystemAdminView.tsx`; nicht im V5-Mock |
| Personen & Rechte | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 4/7 Alttexte, Ziel 2/7 | Plan Phase 1b/T-05; Q-G01-001 |
| Rechteänderung bestätigen + Receipt | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 2/7 | OE-2609-09; D-RES-001; Q-G01-001 |
| Zugang/PIN verwalten | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 4/7 Alttexte, Ziel 2/7 | `UserManagement.tsx` nur Inhaltsquelle; Q-G01-001 |

## Inhaltsliste für Designphase 1b

| Screen | Person | Daten (Felder) | Aktionen | Zustände | Quelle |
|---|---|---|---|---|---|
| Gregor E-Mail-Einstieg | Gregor | E-Mail, Passwort ausschließlich als Eingabefelder; kein Credential-Readback | Einloggen, Schließen | Daten, lädt, leer, Fehler, gesperrt, In Klärung, In Aufbau | D-UI-V5-002; `EmailLoginDialog.tsx` |
| Systemadministration | Gregor | Produktname, Verantwortung, Sitzungsstatus, sichere Systemziele | Personen & Rechte öffnen, Aufträge/Kunden ansehen, abmelden | alle 7 | D-UI-V5-002; `SystemAdminView.tsx` |
| Personenliste | Gregor | Rolf/Phillip/Gregor, Produktrolle, Aktivstatus, letzter sicherer Login, Rechteabweichungen als Anzahl | Person öffnen, Rolf/Phillip aktivieren/deaktivieren, PIN-Rotation starten | alle 7 | OE-2609-02/-09; `UserManagement.tsx` |
| Personenrechte | Gregor | 13 PermissionKeys mit verständlichem Namen, Kategorie, Standard, expliziter Entscheidung, effektiver Wirkung, Version | Erlauben, Verweigern, Auf Standard zurücksetzen, Audit öffnen | alle 7 | OE-2609-09; Red-Team RT-05; `01_ANFORDERUNGSKATALOG.md` |
| Rechteänderung | Gregor | Zielperson, Recht, Vorher/Nachher, Pflichtgrund, Datenstand | Bestätigen, Abbrechen, bei Konflikt neu laden | alle 7 | D-RES-001; Command-Vertrag F-G01-005 |
| Rechteaudit | Gregor | Zeitpunkt, Actor, Zielperson, Recht, Vorher/Nachher, Grund, Version, Korrelation | filtern, Beleg kopieren; keine Änderung/Löschung | alle 7 | OE-2609-09; F-G01-005 |
| PIN-Rotation | Gregor für Rolf/Phillip | vierstellige neue PIN nur als verdeckte Eingabe und Bestätigung | sicher speichern, abbrechen | alle 7 | DECISION_PIN_SECURITY; F-G01-006 |

## Designsystem-Bausteine

`kr-`-Bausteine werden nach Phase 1 ergänzt. Zu liefern sind mindestens `kr-login-shell`, `kr-pin-pad`, `kr-person-card`, `kr-permission-row`, `kr-effective-state`, `kr-command-progress`, `kr-receipt`, `kr-correlation`, `kr-disabled-state` und die Zustände `In Aufbau`/`In Klärung`.

Verbindlich: Fraunces + Inter, Navy/Cream, Touchziele mindestens 48 px, keine eigenen Farbwerte und kein Mock-CSS kopieren. `SystemAdminView.module.css`, Tailwind-Altklassen und die vorhandenen Admin-Cards sind Inhaltsquellen, nicht Designsystem.

## Nicht übernehmen

- Synthetische PINs aus V5.
- Rollen×Rechte-Matrix als bearbeitbare Ziel-UI.
- `NOT_AVAILABLE`-, W3- oder Providertexte.
- Technische Rollen als sichtbare Personen.
- Hardcodierte Farbwerte oder alte Token-CSS.
