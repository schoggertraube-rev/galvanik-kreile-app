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
| 02.11. | Einheit: Bauplan speichert Schlüssel stueck/kg/dm2/satz/stunde, Bestand und Code speichern Anzeigewerte (Stück …) | AP-R-Lauf | Paket AP-U (Einheit-Schlüssel für Position, Katalog, Rechnung) nach AP-K1 |
| 02.11. | Codex stasht Planungsdateien beim Branchwechsel (AP-K1 F2 war im Stash) | Planungschat | jetzt (Prozess: Planungsdateien nie stashen, P25) |
