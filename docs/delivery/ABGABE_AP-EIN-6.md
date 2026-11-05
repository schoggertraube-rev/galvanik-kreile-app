# AP-EIN Teil 6 · Versandpflege und Serververträge

## Versandpflege · 05.11. · aktueller Nachtrag

Unter Einstellungen → Firmendaten → Versand sind die vier bereits beschlossenen Felder angebunden: Versanddienst, Format und Hinweis der Sendungsnummer sowie Sendungsverfolgung mit `{nr}`. Derselbe bestehende `readShippingSettingsAction`/`saveShippingSettingsAction`-Weg liest und ändert ausschließlich `company_settings`; kein Providername als Produkt-Ersatzwert und kein zweiter Konfigurationsspeicher. Die Stufe-3-Label-API wird nicht beschrieben.

Nach erfolgreichem Speichern wird der Server erneut gelesen, bevor die Erfolgsmeldung erscheint. Doppelklick ist gesperrt, Fehler lassen die Eingaben stehen. Bei einem fremden Änderungsstand werden die gespeicherten vier Werte angezeigt; erst eine ausdrückliche Wahl übernimmt diesen Stand oder hält nach Abgleich die eigenen Eingaben für den nächsten Speichervorgang. Enter wechselt durch die vier Felder und speichert erst am letzten. Keine zusätzliche Session-/Rollenregel; die Action prüft weiterhin `einstellungen`.

Beim tatsächlichen Bildlesen zusätzlich gefunden: Der vorhandene allgemeine Einstellungs-Hover färbte den Hintergrund heller, behielt bei Hauptknöpfen aber weiße Schrift. Eine begrenzte Hover-Regel verwendet dort jetzt das bestehende Navy-Token mit weißer Schrift, entsprechend dem vorhandenen Primärknopf. Kein Layout-/Shell-Umbau und keine Änderung der gelieferten Design-Dateien.

| Nachweis | Ergebnis |
|---|---|
| Bestehende echte Versand-Action → DB-Zeile/Event → Leser | 1/1 PASS, `h18_order_admin_actions.integration.test.ts`, Fall „shipping settings“ |
| Isolierter Browser → dieselbe Action → DB/Event → Neuladen | 1/1 PASS; die vier Werte kommen zurück, genau ein `shipping_settings_updated`, unverändertes erneutes Speichern erzeugt kein zweites Ereignis |
| UI-Regressionen | 13 bestehende Einstellungsfälle und 5 neue Versandfälle PASS, einschließlich Konflikt, Transportfehler, Doppelklick, verweigertem Lesen und Enter |
| Desktop / Tablet / Handy | Lesender Browserlauf 1914×917 / 1220×880 / 390×844; gespeicherter DB-Wert, Knöpfe ≥48 px, kein Konfigurations-Schreibvorgang |
| Build / Typen / vollständiges Lint / Whitespace / H18 | PASS; Vollsuite gemäß Owner in CI |
| Vollständige lokale A11-Strecke | 19 PASS, 3 bekannte fremde Runde-53-Bindungsfehler (`authority/selftest/module-gates`); keine Änderung der gelieferten Quellen oder geschützter Prüfer |
| Dev-Gleichstand nach P47 | Probe 76→76 mit vollständig belegtem Rollback; dieselbe eingefrorene SQL anschließend 76→77, vollständige Versionslisten Repo=Dev 77/77 und Ledger-SQL bytegleich. Bestehende Geschäftsspalten/-zeilen und Tabellenrechte unverändert; neue Funktionen ohne Public-EXECUTE und ohne SECURITY DEFINER. Alle elf beschlossenen Spalten vorhanden. Startformat akzeptiert 14 Ziffern und verwirft 13. |

Belege außerhalb des Repos: `C:/Users/Traube/.codex/visualizations/2026/11/04/01a1a6e4-4199-7bb0-80cf-d86e82e8c3cb/p65-shipping/` (`proof.json`, drei `*-read.png`/`*-read.json`). Das sind isolierte Replay-Belege mit synthetischen Daten und dem fremden, noch ungebundenen Arbeitsbaum-CSS, keine READY-/Exact-SHA-Sichtabnahme. Der erste Browserlauf wurde korrekt durch unvollständige synthetische Stufenschalter gesperrt; danach nur die isolierte Fixture aus dem bestehenden Feature-Katalog vervollständigt. Kein Produkt-Fallback, keine Assertion geschwächt.

Neue CI und READY dieses Produktnachtrags stehen nach Push aus. Der Stapel übernimmt die nachgewiesene G09-Korrektur und die zentrale Warenstandsprüfung aus #171. Der geerbte Scope-Befund am bestehenden Stations-Unit-Test ist in NACHTLAUF C angefordert; kein Scope-PASS behauptet. **Draft; kein Owner-Merge-Aufruf**, solange Paketfälle, Scope-Freigabe und verbindliche Sichtabnahme fehlen.

## Bestehende Serververträge und bisherige Nachweise

P56 ergänzt die bestehende tenantgebundene Queue-View um orders.ausgabe_frei; der Leser verwendet ausschließlich diese View. Aktuelle lokale Stack-Basis ist Teil 5 `9dc00203`; sein Rechnungs-Produktdelta bleibt unverändert. Der neue Produkt-SHA und seine Git-Preview werden nach Push in NACHTLAUF C belegt. Kein Merge und kein Production-Deploy.

Die Migrationen wurden auf einer frischen lokalen Replay-DB ohne Seed in chronologischer Reihenfolge angewendet. Abholperson und Versand bestanden 2 echte Action-Fälle; der erste vergleicht zudem den gespeicherten Ausgabewert mit dem kanonischen App-Leser. Warenausgangs- und Werkstattverträge bestanden 15 Fälle. Frühere Ergebnisse sind historisch.

CI-Korrektur: „Heute sichern“ verwendet für fertige Aufträge wieder deren tatsächliche Risikoeinstufung; die Freigabe zur Ausgabe bleibt separat gesperrt. Die Sichtbarkeit gesperrter Fertigaufträge bleibt offen; siehe NACHTLAUF C.

## Implementiert

- DA01/DA02: `changeOrderPickupNoticeAction` speichert Name/Notiz/Quelle/Login/Zeit am bestehenden Auftrag, erhöht seine Version und schreibt den vorherigen/nachfolgenden Stand in das vorhandene Event-System. Widerruf = Name NULL; kein zweiter Abholer-Datensatz. Wiederholung liefert denselben Beleg. `getOrderPickupNoticeAction` liest die DB neu; ein Konflikt enthält den aktuellen Stand.
- Versand: `readShippingSettingsAction` und `saveShippingSettingsAction` verwenden ausschließlich die bestehende company_settings-Zeile. Pflege nur mit einstellungen; feste Startwerte nur in der Migration. Gleiches Speichern erzeugt kein zweites Ereignis, ein fremder Änderungsstand wird abgeglichen statt überschrieben. Versandlabel-API bleibt Stufe 3 und wird nicht beschrieben.
- Eine Freigabe: `orders.ausgabe_frei` wird nach der vollständigen Abschluss-/Zahlungstransaktion aus deren bestehenden Belegen berechnet. Werkstattprojektion und `recordGoodsOutCommand` lesen dieselbe DB-Spalte. Vorkasse/Bar unbezahlt bleiben gesperrt; Rechnung auf Ziel braucht einen vorbereiteten Abschluss. Keine Freigabe aus einem Clientwert.
- Drizzle führt die im Teil geänderten Tabellen mit. Die einzige Änderung in der Werkstatt-Seitenkomposition reicht dieses DB-Feld an die Projektion durch; kein Markup-/Stilumbau.

## Prüfung

- P62: Die vorgegebenen Fälle DA01/DA02 wurden gegen einen frischen lokalen Replay erneut ausgeführt. Beide bleiben erwartungsgemäß rot: Das Anliegen `eingang.anliegen.abholung_durch` wird noch nicht angeboten; ein Speichervorgang hat dabei nicht stattgefunden. Playwright zählt die als erwartete Fehler markierten Fälle als bestanden, das ist kein Nachweis der Funktion. Der bestehende Abholmitteilungs-Command und seine Action-/DB-/Event-Belege sind bereits vorhanden. Für die Auftragsauswahl verweist P56 auf das gesonderte Picker-Paket; die vollständige Erfassung und Anzeige bleiben offen.
- Der lokale Stapel übernimmt die P62-Korrekturen der Vorgänger für sichtbare Schreibfehler und die gezielt unterbrochenen Schreibactions. Der konkrete neue SHA, CI und Preview stehen nach dem Push im NACHTLAUF; bis dahin kein Merge-Reife-Claim.

- Migration lokal und nach P47 mit erzwungener Rollback-Probe auf Dev angewendet. Datei `supabase/migrations/20261103184000_ein6_korrekturen.sql`; SHA-256 `730601D1A6DDA8E5FC7835B3F6A9FE5F7E3A180A2E3D8C9749C36380049292FD`, ab jetzt eingefroren. Vollständiger Gleichstand 77/77, private Belege `.git/kreile-p65-dev6-probe.json` / `kreile-p65-dev6-apply.json`. Keine bestehenden Geschäftsspalten geändert und keine Zeile gelöscht.
- H18 order admin: 2 gezielte echte Action→DB→Ansicht-Fälle grün, darunter DA01/DA02 und Versandkonfiguration.
- Gezielte Warenausgangs-/Werkstatt-Verträge: 15/15 grün nach einem Fixture-Nachtrag. Der bestehende erwartete Kandidat erhält explizit ausgabeFrei=true; seine Assertions bleiben vollständig erhalten.
- Ergebnisse der laufenden Prüfungen und der genaue Kandidatenstand stehen im PR und NACHTLAUF C.
- Volltests laufen nach Push in CI; keine Aussage, dass die CI dieses noch nicht gepushten Standes bereits grün sei.
- Sicht-Ampel: noch nicht für den aktuellen Kandidaten geprüft. Kein Owner-Klicktest für diesen Server-Zwischenstand.

## Offen, in NACHTLAUF C gemeldet

1. Der bestehende Warenausgangs-Input und seine V1/V2-SQL-Belege kennen weder tatsächlichen Empfänger, gespeicherten Versanddienst/Sendungsnummer noch Teilabholung. Vorschlag: streng erweiterten/versionierten Beleg im selben Command samt Rücklese und Owner-Fällen festlegen; keine zweite Ablage bauen. Diese Teile sind hier nicht als umgesetzt ausgewiesen.
2. DA01/DA02 nennt order_events, während die bestehende Wahrheit public.events ist. Das Generator-Mapping muss darauf zeigen; hier entsteht keine zusätzliche Tabelle.
3. Sondervereinbarungen bleiben bis AP-ABS gesperrt. Für nacharbeit_zu fehlt im aktuellen SQL noch der maßgebliche Bezug; kein Ersatzfeld und keine pauschale Freigabe.
4. Die Pflege der Versandkonfiguration ist mit diesem Nachtrag vorhanden. Darstellung der Abhol-/Versandangaben am Warenausgang und Heute sichern bleiben offen.

## Owner-Weg nach dem UI-Durchbau

Der Planungschat legt nach Freigabe der neuen C den echten Klickweg und die READY-Preview dieses Kandidaten vor. Dieser Server-Zwischenstand fordert noch keine manuelle Owner-Abnahme an.
