<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Checkliste Vollständigkeit

1. ✓ **Alle 12 Pflichtdateien + Bericht vorhanden, Tabellen mit exakten Kopfzeilen.** Dateien `00` bis `11` und `BERICHT_2026-09-26.md` sind angelegt; die vorgeschriebenen Tabellenköpfe wurden übernommen.
2. ✓ **Steckbrief vollständig inkl. Anbindung, Gate, Ausgrau-Element + Text, Übertragbarkeit, Rate-Stellen-Nummern.** Alle Felder stehen in `00_STECKBRIEF.md`; M04/M06 sind mit nicht klickbarem Wortlaut abgegrenzt.
3. ✓ **Jede Anforderung: Quelle + Abnahmekriterium + Stand.** `01_ANFORDERUNGSKATALOG.md` enthält pro ID Quelle, messbares Kriterium und erlaubten Inhaltsstatus.
4. ✓ **Jede Funktion: alle 7 Zustände mit wörtlichem Text oder begründetem `FEHLT → Q-…`.** Acht Funktionen enthalten jeweils Daten, lädt, leer, Fehler, gesperrt, In Klärung und In Aufbau.
5. ✓ **Optikvorlage: Quelle + SHA; drei Geräte je Screen oder „fehlt → Designphase“; M-Module: vollständige Inhaltsliste je Screen.** V5 und Vollhash sind genannt; Tablet-/Zustandslücken sind Designphase 1 zugeordnet; G03 ist kein M-Modul.
6. ✓ **Schnittstellen: Host-Ports, Feldliste mit Soll-Ist, Datenbesitz, Provider + Secret-Namen + Stand.** `04_SCHNITTSTELLEN_DATEN.md` trennt Ports, Events, Felder, Manifest, Provider und Owner-Grenzen; es enthält nur Secret-Namen, keine Werte.
7. ✓ **Jeder Konflikt: Zuständigkeit + Anzeigeort.** `05_REGELN_SPERREN_KONFLIKTE.md` weist jeden Konflikt Rolf/Phillip/Gregor und einem Startseiten-/Inline-Ort zu.
8. ✓ **Entscheidungen nur als Verweise mit Datum.** `06_ENTSCHEIDUNGEN.md` enthält ausschließlich Kurzreferenzen auf IDs/Fundstellen.
9. ✓ **Quellen: Datum + SHA + Status; Duplikate/Widersprüche markiert.** `09_QUELLEN_AKTUALITAET.md` markiert die Registerabweichung, V6, Altmanifest und Chat-Digests; die Remote-Snapshot-Grenze ist offengelegt.
10. ✓ **Offene Fragen: Empfehlung + „bis dahin in der App“.** Jede Frage in `08_OFFENE_FRAGEN.md` nennt durchsuchte Quellen, Optionen, genau eine Empfehlung, Zuständigkeit und einen sicheren Zwischenzustand.
11. ✓ **IST-Code/Umbau für jeden vorhandenen Code-Bestandteil entschieden.** `11_IST_CODE_UMBAU.md` ordnet den kanonischen Flow, Altmodal, OCR-/Providerreste, Commands, Module, APIs, Migrationen und Tests ein.
12. ✓ **Keine Secrets, keine Mojibake, nur eigener Ordner beschrieben, Datum `JJJJ-MM-TT`.** Es stehen ausschließlich Secret-Namen im Dossier; geschrieben wurde nur in diesem Dossierordner; Datumsformat ist ISO. `_codex_lauf.log` und `02_app` blieben unangetastet.
13. ✓ **Build-Frage: „Könnte ein fremder Builder dieses Modul allein mit diesem Ordner bauen, ohne zu raten?“** Ja: Soll/Ist, Feldabbildung, Portgrenzen, Bestandsumbau, Testgates und sichere Zwischenzustände sind festgelegt. Offene Design-/Schreibweg-/Konfliktfragen sind ausdrücklich `In Klärung`/`In Aufbau` und dürfen vor ihrem Gate nicht als gebaut ausgegeben werden.

