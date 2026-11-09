# SA-Korrektur – Prüfernachtrag 09.11. 03:20

Umfang: sämtliche sieben ursprünglichen SA-Korrekturen plus exakt acht Nachträge des unabhängigen PL-Reviews. Keine neue Funktion, keine neue Migration, kein Merge.

## Produktstand

- Historischer Anleger und letzter Akteur sind von tatsächlicher Zuweisung getrennt. Ohne lesbare belegte Zuweisung wird keine Zuständigkeit behauptet.
- Tatsächlich unzugewiesen: „Noch niemand zuständig“ und vorhandenes „Übernehmen“. Unlesbar: ausschließlich „Zuständigkeit gerade nicht lesbar - lade den Auftrag neu.“ und „Neu laden“; keine irreführende Leerzustandsanzeige.
- Validierungsablehnung: vorgeschriebener Katalogtext und „Neu laden“. Fehlgeschlagenes Übernehmen: „Du hast den Auftrag noch nicht übernommen. Tippe noch einmal auf Übernehmen.“ Keine rohe Servermeldung.
- Startseite: Dringlichkeit und Termin vor persönlicher Zuständigkeit; Aufgaben gehören dem tatsächlichen Empfänger. Der unbenutzte KV-Erstellerwert ist auch aus dem Leser entfernt.
- Defekte aktive Zuweisungen werden bei persönlichen und bei delegierten Aufgaben über denselben Diagnoseweg protokolliert und übersprungen, während der Auftrag sichtbar bleibt. NOT EXISTS je Auftrag und Berliner Kalendertag plus Transaktionssperre verhindert doppelte Diagnoseereignisse. Diagnosefehler brechen die Startseite nicht ab.
- Neutraler gemeinsamer Akteurleser, browserfähige Typen, eine Erst-Akteur-Abfrage. Personenstatistik ohne Aufrufer gemäß PL zurückgestellt; Recht und additive Migration bleiben erhalten, die Rechteauswahl blendet das noch ungenutzte Recht aus.
- AK-04 verwendet den tatsächlichen Zuweisungswriter mit eng begrenzter lokaler TEST-Ereignisunterdrückung: reale Ablehnung/Transaktionsrollback, danach erfolgreiche Wiederholung und erneute Karten-/Ereignisprüfung. Der frühere Test-Judge ist entfernt.

## Nachweise

Echter AK-Auftragslauf gegen Replay-DB einschließlich zweimaligem Startseiten-Neulesen: PASS7,84s; genau ein Diagnoseereignis, Auftrag bleibt sichtbar, tatsächliche Logins und Zuweisungsereignis geprüft. Drei gezielte UI-Fälle für unzugewiesen/unlesbar/Validierung mit ausführbarem Neuladen: PASS4,93s. Typprüfung und gezielter Lint grün. Frühere Empfänger-, neutrale Akteur- und AK-04-Produktnachweise bleiben im selben PR erhalten.

Vorheriger Kandidat 264c3bab hatte alle acht CI-Checks grün und die exakt zugehörige READY-Preview mit echter Desktop-/Handysicht. Für den neuen Kopf gelten ausschließlich seine neu laufenden Checks und seine neue Preview; ein unabhängiger PL-PASS ist weiterhin vor ready erforderlich. Aktuelle Kandidatenangaben werden im PR und BAULOG festgehalten.
