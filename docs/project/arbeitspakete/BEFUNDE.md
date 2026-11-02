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
