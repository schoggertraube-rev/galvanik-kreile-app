<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 00 — Steckbrief G09 Konflikte & Sperren

- **Zweck:** Verhindert fachlich unzulässige Änderungen und macht reale, handlungsrelevante Kreile-Konflikte der zuständigen Person sichtbar, ohne eine zweite Fachwahrheit oder ein separates Warnungs-Backlog anzulegen.
- **Stufe:** Grundstamm, Ausbau nach USP; Umsetzungsticket T-06, Kalenderanteil abhängig von T-07/Microsoft-365-Gate.
- **Dossier-Status:** BAUBEREIT. Nicht belegte Kapazitätsgrenzen, separate Abholtermine und nicht entworfene UI-Varianten bleiben ausdrücklich deaktiviert beziehungsweise „In Klärung“; sie blockieren den belegten Kern nicht.
- **Modul-Status:** TEILWEISE GEBAUT. Harte Server-/DB-Sperren sind vorhanden; rollenbezogene Konfliktaggregation, Startseiten-Anbindung, Kalenderkonflikte, belastbare Kapazität und Bündelung sind nicht geliefert.
- **zuständige Session:** Neuer Builder-Auftrag nach Dossierfreigabe; genau ein Writer und ein unabhängiger read-only Reviewer gemäß Projektsteuerung.
- **Arbeitsordner:** `C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app` auf einem von der PL freigegebenen Missions-Branch; der gegenwärtige Dirty-Worktree bleibt unverändert.
- **Code-Pfad:** Kein neues persistentes Fachmodul. Neutraler Konfliktvertrag im bestehenden `module.fundament`, Fakten und Sperren in den besitzenden Modulen (`module.orders`, `module.customers`, `module.accounting-minimal`, künftig `module.calendar`), Kreile-Zuordnung und Darstellung in den jeweiligen App-Adaptern von Startseite/Werkstatt.
- **braucht:** Fundament (Identity, Tenant, Capability, Commands, Events, Receipts), Orders/Intake, Customers, Accounting-minimal, G02 Rollen-Startseiten sowie für Kalenderkonflikte den echten `CalendarPort` aus M04/T-07.
- **wird gebraucht von:** G02 Startseiten Rolf/Phillip, Auftragsannahme mit Wunschtermin, Terminverschiebung, Werkstatt/Tagessteuerung, Warenausgang, Terminübersicht und spätere Pünktlichkeitsanalyse.
- **Anbindungszeitpunkt + Gate:** Zuerst unveränderte gebaute Sperren erhalten; danach Konfliktprojektion zusammen mit G02/T-06 anbinden. Kalenderanteile erst nach echtem M365-Konto, Consent, Least-Privilege-Port, Provider-E2E und Readback. Keine Kapazitätsampel vor ratifiziertem Kapazitätsmodell und realen Grenzwerten.
- **Bis dahin im Grundstamm:** Harte Sperren wirken weiter inline. Auf den Startseiten steht für nicht lieferbare Teile ausgegraut: **„Konflikte & Kapazität — In Klärung“**. Kalenderabhängige Prüfungen zeigen **„Kalenderabgleich — In Aufbau“**. Es werden weder erfundene Warnungen noch Kapazitätszahlen angezeigt.
- **Übertragbarkeit:** Der Kern kennt nur neutrale Begriffe wie `ConflictItem`, Quelle, Betroffenes, Fälligkeit, Verantwortlichkeit und nächste Aktion. Namen, Rollenlogik, Texte, Kreile-Routen, Zink-Hinweise und Microsoft-365-Verbindung liegen ausschließlich im Kreile-HostAdapter. Andere Zielapps implementieren ihre eigenen HostAdapter und übernehmen keine Kreile-Daten, -Konten oder -Zeitmodelle.
- **Rate-Stellen:** RT-03, RT-06, RT-07, RT-08, RT-09, RT-10, RT-11, RT-12, RT-15, RT-21, RT-22, RT-23 und RT-26. Sichere Zwischenstände stehen in `08_OFFENE_FRAGEN.md`.
- **Stand:** 2026-09-26; Codewahrheit geprüft gegen lokale Referenz `origin/main@21a23567d51e4805f065ce9ae8c59bdc5faf9fa9` (Commit 2026-09-25). `git fetch origin` war wegen schreibgeschütztem `.git/FETCH_HEAD` nicht möglich und wurde nicht wiederholt.
- **Bearbeiter:** Codex, Dossiererstellung; kein App-Code geändert.

## Nicht-Ziele

- Kein eigenes Kalenderprodukt, kein eigener Event-Speicher und keine Kalender-Engine.
- Keine generische Warning-Datenbank, kein zweites Aufgabenboard und keine lokale Browser-Wahrheit.
- Keine automatische Umplanung, Statusänderung, Terminverschiebung, Kundenfreigabe oder Bündelung.
- Keine Kapazitäts-, Auslastungs-, Wartezeit- oder Engpassbehauptung ohne ratifizierte Daten und Grenzwerte.
- Keine Anforderungen oder Zeitmodelle anderer Zielapps.
