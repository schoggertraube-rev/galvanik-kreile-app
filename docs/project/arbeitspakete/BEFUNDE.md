# Befundliste (eine Liste für alle Owner- und Prüflauf-Befunde)

Regel (U-220/U-229): Jeder Befund wird vom Planungschat **einmal** eingeordnet, nie direkt an Codex gegeben.
- **jetzt** = gehört zum laufenden Paket und verletzt dessen Vertrag oder blockiert den Ablauf (z. B. Buchen geht nicht) → Nachtrag im laufenden Paket.
- **Paket X** = wird von einem späteren Paket ohnehin neu gebaut → dort eingetragen, **nicht** reparieren.
- **Optik** = Darstellung ohne Funktionsfehler → gesammelter Design-Durchgang nach dem Funktionsbau.
- **parken** = Altbereich außerhalb Stufe 1 → nicht anfassen.

| Datum | Befund | Quelle | Einordnung |
|---|---|---|---|
| 01.11. | Buchen legt auf Dev keinen Auftrag an, keine Fehlermeldung | Prüflauf Planungschat | jetzt (AP-01 4.3) |
| 01.11. | Name aus „Schnell erfassen“ findet Kunden nicht | Owner + Prüflauf | jetzt (AP-01 4.3) |
| 01.11. | Kundenkarte „Bearbeiten“ öffnet im Hintergrund | Owner | Paket AP-K1 (5.2 als Ebene oben) |
| 01.11. | Kundenkarte: Firma/Privat nicht änderbar | Owner | Paket AP-K1 (Typwechsel) |
| 01.11. | „noch nicht schön“ (Erfassung) | Owner | Optik |
| 02.11. | Kundenkarte Schmidt zeigt Foto, das sich nicht öffnen lässt: echte Datei aus altem Scan-Eingang (28.10, Bucket scans, privat), Nachweis-Datensatz ohne Bucket-Angabe | Owner | Paket AP-F (Originale/Fotos neu über intake_file); kein Mock |
| 02.11. | Verwaiste Datei im Repo-Wurzelordner (k.includes…), Rest eines Shell-Befehls | Prüflauf | jetzt (Codex entfernt, nicht committen) |
| 02.11. | Nach Buchen „Speichern fehlgeschlagen“, Karte öffnet nicht (Beleg-SELECT ohne intake_term_status/intake_source) | Prüflauf Planungschat | jetzt (AP-01 4.3, TA-B2c3 #161, behoben in #158) |
| 02.11. | Vercel-Preview per CLI scheitert am Schrift-Abruf, Git-Build desselben SHA grün | Prüflauf Planungschat | jetzt (Prozess: Previews nur aus Git, U-234) |
| 02.11. | Plus öffnet direkt die Erfassung statt 3.0 „Neu erfassen“ (Bauplan) | AP-G-Lauf | Paket AP-R (U-233) |
| 02.11. | Prüfliste ohne Zeilen Eingangsart/Einheit, Art ohne Recht „geld“ (E45–E47) | Endversion-Chat | Paket AP-R |
| 02.11. | Kunden-Datenvertrag a887 weicht von AP-K1 F1 ab (Lieferant, Felder, Absprachen, Zahlung, Land, Grenzen) | Codex-Vorbau | Paket AP-K1 Fassung 2 |
| 02.11. | Prüfskript t14 M10 klickt „Wunsch“ außerhalb des Dialogs (Timeout) | Prüflauf | Planungschat (eigenes Skript) |
| 02.11. | Einheit: Bauplan speichert Schlüssel stueck/kg/dm2/satz/stunde, Bestand und Code speichern Anzeigewerte (Stück …) | AP-R-Lauf | AP-EIN Teil 2 (Schlüssel samt Bestand, Entscheidung 2) |
| 02.11. | Codex stasht Planungsdateien beim Branchwechsel (AP-K1 F2 war im Stash) | Planungschat | jetzt (Prozess: Planungsdateien nie stashen, P25) |
| 02.11. | Oberfläche: Bauplan speichert Schlüssel (verzinken …), Bestand Anzeigewerte; Codex stellte nur neue Zeilen um (zwei Wahrheiten) | Prüfung Planungschat | AP-EIN Teil 2 (Entscheidung 2); in AP-R zurückgenommen (P29) |
| 02.11. | Build scheitert in Vercel und CI an next/font/google (Fraunces) | CI #163 | jetzt (Schriften lokal, P29) |
| 02.11. | Codex baute über das Paket hinaus (Oberflächen-Schlüssel), meldete nicht je Commit, pushte den PR erst nach Aufforderung; Inventur widersprach dem Paket (updateCustomerCommercialAction bleibt) | Analyse Planungschat | jetzt (Prozess: Regeln 14–17, eine Auftragsquelle C, Entscheidungen 1–11 im AP-EIN-Paket) |
| 03.11. | K1-Migration 501FC772 ohne DB-Schreibweg: Beleg-Typ kennt kein lieferant, create_customer_v1/update_customer_commercial_v1 tragen die neuen Felder nicht (B06/B07) | Codex 02:37 | jetzt (AP-EIN Entscheidung 12, Folgemigration ein1) |
| 02.11. | #164 als „nur am #163-Checker rot“ gemeldet, Generated flows waren 9 rot (CI ≠ lokal) | Prüfung Planungschat | erledigt (0fe639c7/caee0cc8; Regel 18) |
| 03.11. | K1-Vertrag bricht Fixtures alter AP-01-Tests (Zahlungsbedingung ohne geld, mehrdeutiger Name); Vorrang braucht Recht entscheiden, das DB nicht kennt; K1-Regel verbot Altwert E26 | Codex 03:13–05:17 | jetzt (AP-EIN Entscheidungen 13–15, neue Test-SHAs) |
| 03.11. | vorgang_id: AP-01 speichert Auftragsnummer, Bauplan E07 verlangt orders.id | Codex 06:19 | jetzt (AP-EIN Teil 2, Entscheidung 16) |
| 03.11. | 3.0 Geräte-Liveweg: Supabase Realtime passt nicht zur PIN-App-Sitzung | Codex 06:19 | jetzt (Entscheidung 17: authentisierte Abfrage) |
| 03.11. | Dev-Altposition surface_requested=chrom wuerde ein2-Bestandsumstellung abbrechen | Dev-Datenprobe Planungschat | jetzt (AP-EIN Entscheidung 19) |
| 03.11. | Optik/Handling der gebauten Screens (3.0, 3) entsprechen nicht dem Endversion-Prototyp; Prototyp war nie Bauinput, Abnahme pruefte nur Wege/Daten | Owner-Klicktest | jetzt (U-238, Regel 19, AP-EIN Teil 0b, Optik-Abgleich je Teil) |
| 03.11. | Endversion-Look lag nur in der Vorschau (groessen_v8, ui_ergaenzung, Inline-Styles); Codex hatte ihn nie | Endversion-Chat 15:00 | erledigt in der Planung (U-239: UI-Wahrheit ui/, Sichtvertrag + pruefe_sicht als Merge-Gate, Teil 0b) |
