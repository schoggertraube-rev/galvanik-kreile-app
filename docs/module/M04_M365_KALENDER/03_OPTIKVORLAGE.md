<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 03 — Screens und Responsive-Verhalten

## Optische Grundlage

- Designreferenz: `02_app/docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html`, SHA-256/12 `75258FF3BD4C`.
- Verbindlich daraus abzuleiten: Fraunces + Inter, Navy/Cream, mindestens 48 px Touchfläche und Designsystempräfix `kr-`.
- Die V5-Datei enthält **keinen** fachlich abgenommenen M04-Kalenderscreen. Deshalb gilt für alle M04-Screens: **Status: FEHLT → Designphase 1b**.
- Kein Mock-CSS und keine eigenen Farb-, Abstands- oder Komponentenwerte übernehmen. `kr-`-Komponenten werden nach Phase 1 ergänzt.
- Vor Gate gibt es keine M04-Route. In Gregors Einstellungen ist ausschließlich das nicht klickbare Element „Microsoft 365 – In Klärung“ zulässig; Auftragsannahme, Terminverschiebung, Startseite und Werkstatt zeigen keine erfundenen Outlook-Daten.

## Responsive-Matrix

| Screen | Desktop ≥1300 px | Tablet | Handy | Zustände belegt | Quelle/Anker |
|---|---|---|---|---|---|
| S-M04-001 Terminübersicht Woche/Monat (T-07, nur Nachschlagen) | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 0/7; F-M04-007 definiert | OE-2609-19; Modulkanon „Kalender“; V5 nur Designsprache |
| S-M04-002 Termindetail und Projektionsstatus | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 0/7; F-M04-001/002 definiert | candidate.3; D-ARCH-011 |
| S-M04-003 Startseite: M365-Handlungsbedarf und Tagesüberblick | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 0/7; F-M04-003/004 definiert | OE-2609-19/26; G09-Grenze |
| S-M04-004 Betriebstermin/Abwesenheit und Kreile-Verknüpfung | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 0/7; F-M04-004/005 definiert | OE-2609-19; candidate.3 |
| S-M04-005 M365-Verbindung und Health | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 0/7; F-M04-006/008 definiert | D-ARCH-011; Gregor-Einstellungen |

## Vollständige Inhaltsliste je Screen

| Screen | Person | Daten (Felder) | Aktionen | Zustände | Quelle |
|---|---|---|---|---|---|
| S-M04-001 Terminübersicht Woche/Monat | alle Personen lesend | Zeitraum, Ansicht Woche/Monat, App-Termin-ID, Terminart, Auftragsnummer, Kundenkurzname, Start/Ende, Zeitzone, erzeugendes Kreile-Objekt, Fachstatus, Projektionsstatus, read-only Betriebstermin/Abwesenheit, Konflikthinweis | Zeitraum wechseln, Woche/Monat wechseln, Filter setzen, Kreile-Objekt öffnen; keine Fachbearbeitung in M04 | Daten, lädt, leer, Fehler, gesperrt, In Klärung, In Aufbau | A-M04-013/015/019/029/030/034 |
| S-M04-002 Termindetail und Projektionsstatus | alle Personen lesend; Fachänderung im Kreile-Quellmodul | Terminart, Auftragsnummer, Kundenkurzname, Kunde, Auftrag, Teile/Verfahren, Menge, Notizen, Preise, Kreile-Links, Quelle/Revision, Domain-Receipt/Readback, Providerstatus, letzter Sync, Fehlerklasse; keine Secrets | Kreile-Objekt öffnen; Admin darf Reconcile anfordern; keine Outlook-Fachbearbeitung | Daten, lädt, leer, Fehler, gesperrt, In Klärung, In Aufbau | OE-2609-19; A-M04-009/010/015/017/018/021/036 |
| S-M04-003 Startseite: M365-Handlungsbedarf und Tagesüberblick | Rolf/Phillip nach Fachzuständigkeit; Gregor für Verbindung | oben: dringender Konflikt/Warnung mit Quelle, Grund, seit wann, Zuständigkeit, nächster Aktion und Kreile-Link; bei Gregor insbesondere ablaufende delegierte Anmeldung oder Graph-Abonnements; darunter: Aufträge, Termine, Bündelung und anstehende Abwesenheiten ohne Doppelanzeige | Konflikt prüfen, Kreile-Objekt beziehungsweise Einstellungen öffnen; keine automatische Konfliktentscheidung | Daten, lädt, leer, Fehler, gesperrt, In Klärung, In Aufbau | OE-2609-19/26; A-M04-038/043; `..\00_PROJEKT\REDTEAM_GESAMT_2026-09-26.md` R5; G09 |
| S-M04-004 Betriebstermin/Abwesenheit und Kreile-Verknüpfung | alle lesend nach Freigabe; Verknüpfen nach Fachrecht | Signal-ID, Änderungsart, Beobachtungszeit, Hauptkalenderbindung, externer Eventbezug, Version, Zeitdaten, freigegebener Inhalt oder Fingerprint, Linkstatus, Kreile-Objekt, Auditbeleg | zulässiges Kreile-Objekt öffnen/zuordnen, Klärung öffnen; niemals read-only Einträge zum Provider zurückschreiben | Daten, lädt, leer, Fehler, gesperrt, In Klärung, In Aufbau | OE-2609-19; A-M04-013/016/017; Q-M04-016 |
| S-M04-005 M365-Verbindung und Health | Gregor/Admin; reduzierte Health-Anzeige für alle | Kreile-Tenantbindung, Büropostfach-Identitätsbindung, Hauptkalenderbindung, Status, Health, letzter Sync, Ablauf der delegierten Anmeldung und des Graph-Abonnements, Delta-Stand, letzte Fehlerklasse, erforderlicher Re-Consent; keine IDs/Token/Secrets im Klartext | verbinden, Consent erneuern, Health prüfen, Reconcile anfordern; Trennen/Löschen nur separater Owner-Auftrag | Daten, lädt, leer, Fehler, gesperrt, In Klärung, In Aufbau | OE-2609-18/25; A-M04-004/021/025/026/031/032/043 |

## Responsive-Abnahmevorgaben für Designphase 1b

- Desktop darf Woche/Monat und Detail nebeneinander zeigen; Tablet und Handy müssen Detail als eigene Ebene mit erhaltenem Rückweg öffnen.
- Auf dem Handy steht die nächste fachliche Aktion vor technischen Belegen; keine horizontale Pflichtnavigation.
- Tabellenbelege werden auf Tablet/Handy zu beschrifteten Feldgruppen, ohne Receipt-/Readback-Information zu verlieren.
- Zustands- und Konfliktinformation darf nie ausschließlich über Farbe vermittelt werden.
- Jede Aktion hat mindestens 48 px Touchfläche; Dialoge dürfen keinen Secretwert anzeigen.
