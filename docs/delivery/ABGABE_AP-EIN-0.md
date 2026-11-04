# AP-EIN Teil 0 – Replay-Fundament und „Was ist neu“ (P52)

Status: #166 zur Prüfung; kein Merge durch Codex. Die Freigabe der fünf P52-Pfade erfolgt im Folge-Anker #174. Spätere Teile werden hier nicht fachlich abgenommen.

## Stand und Produktbasis

Produkt-SHA: `e6ee26c8c04d8d2fcee261c9e92fbdd9a1d9e076`.
Exakte Git-Preview READY: https://galvanik-kreile-werkstatt-9nu8rmvrc.vercel.app . GitHub-Deployment 7544934856 und Vercel `dpl_2RTYj5mrPdb6LrVvqfopEQjWQSN4` bestätigen genau diesen SHA.
Teil 0 liefert das Replay-Fundament und, zusätzlich auf ausdrücklichen Auftrag P52, die Anzeige „Was ist neu“. Eine folgende reine Abgabeänderung verändert diesen Produktbaum nicht.

## Umsetzung

- BAUPLAN spec `ee64f8882bb7`, SHA-256 `DF3E1AFEC7B6C3DED6DA51F22FDAADF8CFAB780DA9A4F619EDB42D3C2D6AC5C4`.
- Alle 306 Fälle aller 14 Modellseiten werden deterministisch erzeugt; Paketzuordnungen filtern keine Fälle aus.
- Die eingebetteten Fallbeschreibungen und Assertions sind bytegleich zur JSON-Projektion des Owner-Modells.
- Sieben ausschließlich synthetische Replay-Logins; Datenlagen werden je Fall mit ihren Abhängigkeiten in die echte lokale Datenbank eingebracht.
- Modell-/Speichernamen stehen einmal im Generator. Das vorhandene `private.intake_drafts` wird im privaten Schema geprüft und befüllt; es entsteht keine zweite Tabelle.
- Ergänzte Datums-/Wertplatzhalter, gezielte Netzwerkunterbrechung und erneutes Lesen sowie exakte Zeilen-/Delta-Prüfungen im Testgerüst.
- Auswahlerwartungen behalten die vom Owner-Modell verlangte `aria-pressed`- und Erfolg-Grün-Prüfung. Optionsknöpfe werden über ihren exakten sichtbaren Text im bezeichneten Steuerelement gefunden; ein umgebendes HTML-Label kann ihren zugänglichen Namen verändern.
- P52: Einzige Inhaltsquelle ist `src/content/was-ist-neu.json`, mit tatsächlichen PR-Einträgen für #164 und #166–#173. Nicht gelieferte Produktteile sind ausdrücklich als Vorschau beschrieben. Kopfknopf, Zähler, neueste Einträge zuerst und Links verwenden bestehende Navigation; ein auf diesem älteren Stand fehlender Nachrichten-Einstieg zeigt eine Erklärung statt einer 404.
- Lesemarker ausschließlich im Browser pro bestehendem opakem Login-Handle; keine interne Nutzer-ID, PIN oder DB-Zeile im Marker. Gesperrter/voller Speicher bleibt nutzbar; dann zählen und erscheinen nur die letzten sieben Tage.

## Prüfungen und offene Befunde

- Frische lokale Supabase-Replay-Kette ohne Seed: PASS. Keine Dev-Migration und keine Dev-Datenänderung.
- Produktions-Build gegen diese lokale Datenbank: PASS.
- Generator-Schreiben/`--check`, Modellvergleich aller 306 Fälle und Whitespace-Prüfung: PASS.
- Der frühere breite Runde-51-Lauf wurde nach 144 begonnenen Fällen wegen konkreter Gerüstbefunde beendet; er gilt ausdrücklich nicht als vollständiger PASS. Der Runde-52-Gesamtlauf der 306 Fälle läuft gemäß Owner-Freigabe in CI. Teil 0 besitzt keine eigenen Produktseiten; lokal werden sein Generator und die zwei betroffenen Gerüstfälle D07/TA14 geprüft.
- D07: Fixture wurde im falschen Schema gesucht. Korrektur nutzt die bestehende private Tabelle samt echtem fremdem Login und isoliertem Rücksetzen der Testdaten.
- Gezielter Nachlauf D07 und TA14 gegen die echte Replay-DB: beide PASS. JSON-Fixtures verwenden den typisierten JSON-Parameter des vorhandenen Treibers statt doppelter Serialisierung.
- P50: Der vollständige CI-Lauf des Teil-0-SHA widerlegt den lokalen TA14-Einzelnachweis: Die Ladefehleranzeige fehlt an diesem älteren Produktstand. TA14 ist deshalb ausdrücklich AP-EIN-2 zugeordnet. Die Erwartung bleibt unverändert.
- E32: Die Modellkonvention verlangt Erfolg-Grün für erkannte Eingaben. Dieser ältere Produktstand liefert es noch nicht; P50 ordnet den Fall AP-EIN-2 zu. T05c besteht im vollständigen CI-Lauf und hat keinen Rot-Marker mehr. Die Liste enthält damit 268 tatsächlich noch rote Zukunftsfälle; sie wird pro gestapeltem Stand geführt.
- Die vollständigen 306 Fälle laufen weiterhin in der CI. Die Check-Liste im PR nennt den wirklichen Stand; rot ist keine Abnahme.
- #165 und #172 sind Owner-gemergt. ESLint-Regeln und Baseline werden in #166 nicht geändert. #174 ergänzt genau fünf fehlende Pfade für P52, keine Globs.
- P52: 11/11 gezielte Tests für Login-Trennung, vorhandene Bootstrap-Assertions, Navigation, Speicherfehler/7-Tage-Fallback und erneutes Lesen des Markers PASS; 22/22 lokale A11-Befehle PASS. Keine unveränderte Vollsuite zusätzlich zur CI.
- CI am Produkt-SHA: `quality` scheitert im Scope-Schritt ausschließlich an den fünf P52-Pfaden (Run 41822715446, Job 126549595838, Log 11:40:52 UTC: `SALES_STAGE_B2_SCOPE:src/components/layout/WasIstNeu.tsx` plus die vier weiteren exakten Pfade). Das ist die Abhängigkeit zu #174, kein pauschaler erwarteter Rot-Claim. Die übrigen Jobs und Schritte werden nach ihrem tatsächlichen Abschluss in NACHTLAUF C belegt.
- Das Testfundament hat keine eigene Modellseite. Die Ausgangsmessung der 117 Sichtzustände liegt im Teil 0b; dort dokumentierte Rot/Gelb werden nicht zu einer Sicht-Abnahme von Teil 0 umgedeutet. AP-NEU hat keinen eigenen Eintrag im eingefrorenen Sichtvertrag.

## Owner-Klickweg und DB-Soll

Gerüstkorrektur aus dem ersten vollständigen Runde-52-Kundenlauf: Der DB-Readback las trotz vorhandener Zeile 0 Treffer, weil ein JSON-Parameter doppelt kodiert wurde. Dieselbe lokale Zeile liefert mit der expliziten Text-zu-JSON-Konvertierung genau 1 Treffer. Daten, Erwartungen und Zeilenzahlprüfung bleiben unverändert.

Weitere mechanische Anschlüsse: 5.2 benutzt den vorhandenen Knopf `kunde.bearbeiten`; ein Modus wird als vollständiges Argument an den bestehenden Kundenadapter übergeben. Optionslabels werden als zugängliche Namen gelesen, ohne den zusätzlichen Beschreibungstext der gelieferten Auswahlkarten. Die positive Sichtbarkeit eines Texts verlangt weiterhin einen sichtbaren Treffer; ausdrücklich vorgegebene Anzahl-/Eindeutigkeitsprüfungen bleiben unverändert. Kein Owner-Modellfall und keine feste Akzeptanzdatei wurde umgeschrieben. Die geänderten Anschlüsse werden gezielt im folgenden Teil 1 geprüft; es wird kein zweiter unveränderter Gesamtlauf gestartet.

Der exakte Auswahl-Farbvergleich wartet lediglich die gelieferte CSS-Transition ab; Sollfarbe und Auswahlzustand bleiben unverändert. `orders.geprueft` wird nach P39 direkt als Datenbankspalte gelesen, statt aus der bloßen Existenz eines Auftragsereignisses abgeleitet. Vor Lieferung dieser Spalte in Teil 2 bleiben entsprechende Zukunftsfälle rot.

P52 Owner-Klickweg: obigen Preview-Link öffnen, mit vorhandenem Login anmelden, „Was ist neu“ im Kopf öffnen, neuesten Eintrag lesen, Punkt antippen. Liste erneut öffnen: Zähler ist für diesen Login gelesen; anderer Login hat einen eigenen Lesestand. Auf Handy bleibt der Knopf mit zugänglichem Namen und Zahl erreichbar. Die überarbeiteten Eingang-Seiten folgen in ihren eigenen Teil-PRs.

Bekannte Dev-Abhängigkeit P52: Rolf besitzt seit der freigegebenen Teil-1-Migration `entscheiden`; ältere Code-Stände #166/#169 kennen es noch nicht. Der Owner prüft bis zum Merge von Teil 1 dessen neuere Preview. Der Einstellungen-Leser prüft alle aktiven Nutzer vor dem Filtern und scheitert deshalb auch für Phillip an Rolfs unbekanntem Wert. READ-ONLY-Dev-Beleg mit drei aktiven Nutzern und Vergleich der tatsächlichen Enums: `.git/kreile-p52-settings-db-proof.json`. Kein Recht wird zurückgenommen oder ignoriert; Teil 1 enthält bereits den passenden Wert.

DB-Soll dieses Teils: Testdaten ausschließlich synthetisch auf `127.0.0.1:54322`; „Was ist neu“ erzeugt keine DB-Schreibaktion. Vorhandene Produkt-, Auth- und Tenant-Verträge bleiben bestehen. Die sichtbaren Folgeteile bekommen ihren eigenen Preview-/Sichtnachweis und ihren jeweiligen echten Action–DB–Ansicht-Nachweis.
