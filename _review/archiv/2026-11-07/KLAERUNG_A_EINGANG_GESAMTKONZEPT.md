# Klärung A – Modul Eingang: Gesamtkonzept

Stand: 28.10.2026. Diese Datei ist die gemeinsame fachliche Grundlage für B1 bis B5. Sie ist kein Bauauftrag und ändert weder App-Code noch Datenbank. Optik und endgültige Bedienung werden erst durch den Endversion-Chat verbindlich.

## 1. Ziel und Abgrenzung

### Ziel

Jede eingehende Information erhält sofort genau einen sichtbaren Datensatz im **Eingangskorb**. Der Datensatz bleibt dort, bis ein Mensch oder eine nachweislich sichere Regel ihn abgeschlossen hat. Kein Kanal darf einen eigenen, unsichtbaren Nebenweg bilden.

Der gemeinsame Begriff lautet **Eingang**. Ein Eingang besitzt mindestens:

- eine stabile Eingang-ID, Empfangszeit und einen Kanal,
- mindestens ein unverändertes Original oder, bei persönlichem/telefonischem Eingang, eine sofort erfasste Ursprungsnotiz,
- genau einen Arbeitsstatus, eine Dringlichkeitsfarbe und eine Verantwortlichkeit,
- null bis mehrere erkannte Vorschläge,
- ein oder mehrere **Anliegen**, wenn eine Quelle mehrere Geschäftsvorgänge betrifft,
- einen unveränderlichen Verlauf bis zum Ergebnis.

Kanäle: **Mail**, **Eingangsrechnung** einschließlich PDF, Bild, XML/XRechnung und ZUGFeRD, **Papier/Foto/Scan**, **Paket/Wareneingang**, **persönlich**, **Telefon**. Fax, Website/Kundenportal, SMS/Messenger, Mailbox, Datenträger/Download, interne Überbringer und behördliche Fristsachen nutzen in Stufe 1 den nächstliegenden sicheren Foto-/Datei-/Mail-/Notizweg; eine direkte Provideranbindung wird nicht vorgetäuscht. Ausgang, Antwort, Eingangsbestätigung, Rückfrage, KV-Versand und sonstige Korrespondenz werden als Folgeaktion verknüpft; Text, Versandregeln und Zustellstatus klärt erst C.

Kunde, Lieferant, KV und Auftrag bleiben die fachliche Wahrheit in ihren bestehenden Modulen. Der Eingang speichert nur Quelle, Vorschläge, Bearbeitungszustand, Verknüpfungen und Verlauf; er wird keine zweite Kunden-, Auftrags- oder Rechnungswahrheit.

### Verbindliche Stufentrennung

| Stufe 1 bis 29.11.2026 | Später „geplant“ |
|---|---|
| Ein gemeinsamer Eingangskorb mit Liste, Detail, Filter, Dringlichkeit, vier Arbeitsstatus, Verantwortung, Übernahme, Verlauf, Wiedereröffnung und Konfliktschutz | Frei konfigurierbarer Regelbaukasten und lernende Zuordnung |
| Mailabruf; Mailtext und alle Anhänge als Original; sichere Zuordnung; unbekannte Mail bleibt sichtbar | Weitere Mailanbieter und mehrere frei konfigurierbare Postfächer |
| Paket/Wareneingang und persönlicher Eingang als geführter Kern; Ziel höchstens 5 Minuten, Bedienziel höchstens 10 Klicks | Versandetikett, automatische Eingangsbestätigung und weitergehende Korrespondenz nach C |
| Papier, Foto und Scan; unverändertes Original; OCR-Vorschläge mit Herkunft und Sicherheit; menschliche Bestätigung | Handschrift-Spezialisierung, lernende Belegerkennung und Stapeloptimierung |
| Eingangsrechnungen aller genannten Formate erfassen, unverändert ablegen, technisch lesen und prüfen; Lieferant zuordnen | Kontierung, Freigabekette, Buchung, Zahlung, DATEV und Ausgangs-E-Rechnung |
| Einfacher persönlicher und telefonischer Eingang als Notiz mit Zuordnung; erweiterte Telefonie ist nicht erforderlich | Telefonanlage, automatische Gesprächserkennung, Aufzeichnung und Sprachassistent |
| Sonstige Zugänge wie Fax, Portaldownload, Messenger-Screenshot, Datenträger oder interne Übergabe über Foto, sichere Datei oder Ursprungsnotiz in denselben Eingangskorb führen | Direkte Integrationen für weitere Portale, Messenger, Formulare und Faxanbieter |
| Fremdsprachige Inhalte: Original plus Übersetzungsvorschlag; bei Fehler immer manuell weiterbearbeitbar | Terminologie-Lernen und automatisch formulierte Antworten |
| Technische Fehler dauerhaft in Wartung und am betroffenen Eingang; rot auf „Der Tag“, wenn die Eskalationsregel greift | Trendanalyse, SLA-Auswertung und automatische Provider-Umschaltung |

Maßgeblich für diese Abgrenzung sind `_review/ORIENTIERUNG_KLAERUNG.md:120-136`, die Worst-Case-Vorgaben in `:153-189`, Stufe 1 aus `_review/OWNER_ENTSCHEIDUNGEN.md:101-113` und der Wareneingang als Kern-USP in `:116-120`.

## 2. Bestand

Bewertet ist der lokale Arbeitsstand vom 28.10.2026. Nicht eingecheckte Dateien sind **kein Nachweis einer bereits ausgelieferten oder in der Entwicklungsdatenbank vorhandenen Funktion**. `ABGLEICH_SPEC_CODE.md` ist eine frühere Bestandsaufnahme; neuere lokale Änderungen werden deshalb separat benannt.

### Entschieden

| Punkt | Beleg | Bewertung |
|---|---|---|
| „Infos rein“ und „+ Anlegen“ sind ein Einstieg „Neuer Eingang“. | `_review/OWNER_ENTSCHEIDUNGEN.md:61-64`; `docs/project/endversion/ENTSCHEIDUNGEN_UI.md:123-130` | Verbindlich; kein zweiter Erfassungsweg. |
| Zuerst suchen, nichts doppelt tippen, Vorbelegung, kein Datenverlust und ein Hauptknopf. | `docs/project/endversion/ENTSCHEIDUNGEN_UI.md:126-130` (U-082 bis U-086) | Verbindliche Bedienregel. |
| Mail/OCR dürfen nur vorbelegen; Übernahme erst nach Bestätigung; Original immer sichern. | `docs/project/endversion/ENTSCHEIDUNGEN_UI.md:130` (U-086) | Verbindlich; sichere Regelzuordnung ist nur unter den Bedingungen in Abschnitt 4 zulässig. |
| Statuswortlaut: „automatisch zugeordnet“, „Vorschlag prüfen“, „von Hand bearbeiten“, „erledigt / archiviert“. | `_review/ORIENTIERUNG_KLAERUNG.md:153-167` | Unverändert übernommen. |
| Verlauf, Original, Erkennung, Vorschlag, Bestätigung, Ergebnis und sichtbare Providerfehler sind Pflicht. | `_review/ORIENTIERUNG_KLAERUNG.md:168-185` | Verbindlich. |
| Rechte werden über Rollen/Berechtigungen, nie über Personennamen, gesteuert; developer ist kein Mitarbeiter. | `_review/OWNER_ENTSCHEIDUNGEN.md:92-98`; `_review/ORIENTIERUNG_KLAERUNG.md:9-17` | Verbindlich. U-200 bestimmt derzeit, wer Rechte verwaltet. |
| „Der Tag“ zeigt nur die jetzt nötige Handlung; unzugeordnete Mails/Belege gehören in „Zuordnen“. | `docs/project/endversion/ENTSCHEIDUNGEN_UI.md:224-225` (U-205/U-206) | Verbindlicher Anschluss. |

### Vollständig gebaut – aber nur als enger Baustein

| Baustein | Datei- und Zeilenbeleg | Grenze |
|---|---|---|
| Graph-Posteingang kann Nachrichten listen/lesen; unterstützte Anhänge werden geladen. | `src/lib/server/microsoftGraph.ts:177-218`, `:257-290` | Nur PDF/JPEG/PNG/WebP; kein gemeinsamer Eingang, kein XML. |
| Eine Mail kann transaktional genau einem vorhandenen Kunden oder Auftrag zugeordnet werden; Doppelzuordnung wird abgewehrt. | `src/lib/server/communicationPort.ts:63-133` | Kein Lieferant/KV/„kein Geschäftsvorgang“, keine vier Eingangszustände. |
| Unterstützte PDF-/Bildoriginale werden reserviert, Signatur und Hash geprüft und unverändert gesichert. | `src/lib/server/domainAttachment.ts:81-184` | Nur Customer/Order/IntakeDraft und keine XML-Datei. |
| Azure-Erkennung speichert Vorschläge und Sicherheitswerte getrennt vom Original. | `src/lib/server/documentIntelligencePort.ts:11-50` | Noch kein gemeinsamer Prüfvorgang oder vollständiger Verlauf. |

„Vollständig“ bedeutet hier nur: Der genannte, enge Serverbaustein ist im Code vorhanden. Es bedeutet nicht, dass das Modul Eingang vollständig gebaut oder produktiv nachgewiesen ist.

### Teilweise gebaut

| Teilstand | Datei- und Zeilenbeleg | Was fehlt |
|---|---|---|
| `GlobalCreateFlow` kennt die Eingangsarten persönlich, Versand/Paket, Abholung, Mail und Telefon sowie Belege. | `src/components/layout/GlobalCreateFlow.tsx:131-168`, `:483-520`, `:2143-2288` | Es ist ein Auftrag/KV-Formular, kein Eingangskorb; vorgeschriebene Zustände, Verantwortung, Verlauf und Wiedereröffnung fehlen. |
| Text kann Kundendaten, Termin und Positionen vorbelegen. | `src/components/layout/GlobalCreateFlow.tsx:1530-1586`; `src/lib/server/intakeTextRecognition.ts:3-91` | Nur einfache deutsche Muster; keine Sprache, Übersetzung, Anliegenanalyse oder kalibrierte Sicherheit. |
| Der aktuelle Auftrags-Intake legt Kunde, Auftrag, Positionen, Ereignis und Receipt in einer Transaktion an. | `src/lib/server/commands/orderIntakeCommand.ts:417-477`, `:538-725` | Lokaler neuer Stand; zugehörige Migration ist ungetrackt. Kein allgemeiner Eingang. |
| Mail/Beleg kann nach dem Auftrag angehängt werden. | `src/components/layout/GlobalCreateFlow.tsx:1760-1840` | Anhängen erfolgt nach dem Auftragsabschluss; bei Fehler besteht der Auftrag ohne vollständig verknüpfte Quelle. |
| Mail- und Belegdialoge zeigen Originalhinweis, Vorschläge und Sicherheit. | `src/components/layout/F1SourceDialogs.tsx:109-193`, `:211-268` | Kein echtes Original-neben-Vorschlag für alle Formate, keine Übersetzung, keine Mehrfachanliegen, kein Eingangseigentümer. |
| Ein serverseitiger Entwurf je Login ist vorhanden. | `src/lib/server/intakeDraft.ts:10-75`; `src/components/layout/GlobalCreateFlow.tsx:751-850` | Nur ein Entwurf, kein Eingangskorb; Abbruch-/Wiederaufnahmeverhalten weicht teilweise vom Bauplan ab. |
| „Der Tag“ zeigt einen Entwurf und bis zu fünf unzugeordnete Graph-Mails. | `src/lib/server/todayDashboard.ts:11-27`, `:58-103` | Keine Pakete, persönlichen/telefonischen Eingänge, OCR-Fälle, 24-h-Regel oder gemeinsame Zustände. |
| Rechtebereiche enthalten „eingang“, „mails“ und „wartung“. | `src/lib/auth/authorizationContract.ts:19-64` | Grobe Bereichshaken und alte feste Rollenrechte bestehen parallel (`:98-157`); die sieben Eingangsaktionen sind nicht getrennt. |
| Tabellen für Lieferanten und Belege existieren. | `src/db/schema_buchhaltung.ts:18-65` | Aktionen zum Erstellen/Freigeben/Stornieren melden noch `NOT_AVAILABLE`: `src/app/buchhaltung/actions.ts:97-131`. |

### Fehlend oder nur angenommen

| Lücke | Beleg/Einordnung |
|---|---|
| Gemeinsamer Eingang-Datensatz, Eingangskorb, Verantwortung, vier Zustände, Wiedereröffnung und vollständige Ereigniskette | In keinem bestehenden Eingangspfad vorhanden. Der frühere Abgleich nennt zahlreiche F1-Funktionslücken: `docs/project/endversion/ABGLEICH_SPEC_CODE.md:572-613`. |
| XML/XRechnung und ZUGFeRD empfangen, unverändert sichern und lesen | Graph und Attachment-Port lehnen XML ab: `src/lib/server/microsoftGraph.ts:257-290`; `src/lib/server/domainAttachment.ts:8-13`. `ERechnungParser.ts` ist nur eine Schnittstelle; `MockERechnungParser.ts` liefert ausdrücklich Demo-Daten. |
| Unbekannter Absender, Fremdsprache, Original/Übersetzung nebeneinander, Absicht und Sicherheit | Nur als Owner-Anforderung beschrieben: `_review/ORIENTIERUNG_KLAERUNG.md:162-166`; im Code fehlt der durchgängige Weg. |
| Mehrere Anliegen oder Anhänge getrennt bearbeiten, ohne das gemeinsame Original zu verlieren | Kein Anliegen-Unterobjekt vorhanden. |
| Paket beschädigt, Beleg fehlt, geführte Checkliste, offener KV/angekündigte Sendung | In der Orientierung ausdrücklich als Planlücke benannt: `_review/ORIENTIERUNG_KLAERUNG.md:142-146`. |
| Persistente technische Vorfälle in Wartung | Der Abgleich nennt Fehlerlog und Live-Verbindungstest als fehlend: `docs/project/endversion/ABGLEICH_SPEC_CODE.md:495-518`. Aktuell werden Fehler nur an den Aufrufer zurückgegeben. |
| Gleichzeitige Übernahme/Bearbeitung des Eingangs mit Versionskonflikt | Es gibt einzelne Advisory Locks, aber keinen Eingang mit `version` und atomarem Übernehmen/Zuordnen/Erledigen. |
| Vollständige Dublettenbehandlung über Graph-ID, Dateihash und fachliche Rechnungsdaten | Einzelne Idempotenzmechanismen existieren; eine kanalübergreifende Regel fehlt. |
| Bauplan ist für F1 widerspruchsfrei baureif | Top-Level meldet nicht baureif (`docs/project/endversion/codex/BAUPLAN.json:2-20`), während der F1-Abschnitt „bau-frei“ nennt (`:202-225`); die Gegenprüfung ist nicht bestanden (`:369-374`). Top-Level und Gegenprüfung haben bis zur Korrektur Vorrang. |
| Die neue Intake-Klassifizierung ist in der Datenbank vorhanden | `supabase/migrations/20261028115500_store_intake_classification.sql:1-35` ist lokal ungetrackt; deshalb nur Arbeitsstand, kein Datenbanknachweis. |

## 3. Ablauf aus Nutzersicht

### Gemeinsamer Ablauf – Worst Case zuerst

1. **Annehmen:** Beim Abruf, Upload, Foto oder Speichern der Ursprungsnotiz entsteht sofort der Eingang. Original zuerst sichern, dann erkennen. Ist Sichern nicht möglich, bleibt ein roter technischer Eingang mit wiederholbarer Aktion; die Quelle wird nicht als verarbeitet markiert.
2. **Sichten:** App zeigt Original, Kanal, Empfangszeit, Absender/Überbringer, erkannte Sprache und Anhänge. Ein technischer Fehler verdeckt das Original nie.
3. **Erkennen:** Erkennung erzeugt nur Vorschläge. Fremdsprachiges Original bleibt links, Übersetzungsvorschlag rechts. Unklare oder widersprüchliche Werte sind markiert.
4. **Aufteilen:** Bei mehreren Anliegen legt der Bearbeiter je Anliegen eine Zeile an. Ein Original kann mehreren Anliegen zugeordnet sein; es wird nicht dupliziert oder entfernt.
5. **Zuordnen:** Jedes Anliegen erhält genau ein Primärziel: Kunde, Lieferant, KV, Auftrag oder „kein Geschäftsvorgang“. Bei KV/Auftrag ist der Kunde daraus ableitbar und wird nicht nochmals gespeichert.
6. **Übernehmen und bestätigen:** „Übernehmen“ reserviert den Fall atomar. Der Bearbeiter bestätigt/ändert Vorschläge und Ergebnis. Bei Versionskonflikt wird nichts überschrieben; die App lädt den neuen Stand.
7. **Abschließen:** Erst wenn alle Anliegen ein Ergebnis und alle erforderlichen Originale besitzen, wird der Eingang „erledigt / archiviert“. Abbruch speichert den offenen Stand. Kein Eingang wird gelöscht.
8. **Eskalieren:** Rot oder länger als die beschlossene Frist offen erscheint genau einmal auf „Der Tag“ der verantwortlichen Rolle. Providerfehler erscheinen zusätzlich in Wartung.

Worst-Case-Regeln stehen vor Normalfällen in Abschnitt 5. Der Normalfall verwendet denselben Ablauf, überspringt aber unnötige Schritte: sichere Zuordnung wird angezeigt, der Nutzer prüft nur offene Punkte und schließt ab.

### Foto-zuerst-Einstieg und 5-Sekunden-Regel

Für jeden **physischen** Eingang gilt ein gemeinsamer Start: **„Neuer Eingang“ öffnet mit einem Klick direkt die Kamera.** Vor dem Foto wird weder nach Paket, Rechnung, Papier, Kunde noch Erwartung gefragt. Eingang-ID, Zeit und verantwortliche Rolle entstehen vor beziehungsweise spätestens mit der Aufnahme. Nach dem Foto schlägt die App anhand von Bild, Absender, Referenzen, Korrespondenz, KV und offenen Aufträgen eine Art und den kürzesten Weg vor: Paket/Etikett, Eingangsrechnung, Lieferschein, Brief/Dokument, Kontaktkarte, Ware ohne Etikett oder „nicht sicher erkannt“. Der Mensch kann den Vorschlag bestätigen oder korrigieren. Das Originalfoto wird dadurch nie umgedeutet oder überschrieben.

Mail und ihre Anhänge bilden die Ausnahme vom manuellen Start: Sie werden im Hintergrund empfangen, gesichert und eingeordnet. Telefon besitzt einen direkt beschrifteten Soforteinstieg „Telefonnotiz“. Eine persönlich anwesende Person ist kein eigener fachlicher Dokumenttyp: Ware führt in den Paketweg, Papier in Foto/Scan, Abholung in den Warenausgang, Zahlung in den Zahlungsweg, Frage/KV in den KV-Weg und Reklamation in die Klärung.

Jede Oberfläche muss in fünf Sekunden erkennen lassen: **Wo bin ich? Was ist sicher gespeichert? Was ist der eine nächste Schritt?** Deshalb sind globale Aktionen mit Text beschriftet (`Telefonnotiz`, `Foto / Scan`, `Neuer Eingang`, `Konto`); alleinstehende Symbole `◉`, `▣`, `+` oder Initialen ohne Erklärung genügen nicht. Die Reihenfolge bleibt immer Eingang sichern → Art/Zusammenhang erkennen → nur echte Lücken ergänzen → prüfen → eindeutiger Endpunkt.

Schwierigkeitskennzeichnung für Ablauf und Wegekarte:

- **D1:** automatisch; keine Eingabe,
- **D2:** einen eindeutigen Vorschlag bestätigen,
- **D3:** auswählen oder korrigieren,
- **D4:** tatsächlich fehlende Angaben eingeben,
- **D5:** Sonderfall, Freigabe, Sicherheit oder technischer Fehler.

Jeder Knoten der getrennten Wegekarte trägt D1 bis D5; jeder Blattknoten nennt einen Endpunkt. Eine höhere Nummer bedeutet nicht „schlechte Bedienung“, sondern mehr fachliche Unsicherheit oder Verantwortung.

### Geführter Paketweg – vom Plus bis „bereit für Galvanik“

Das **globale Plus** ist der sichtbare Start für alles, was physisch im Betrieb ankommt. Mail erscheint dort nicht: Sie wird im Hintergrund abgerufen, als Eingang gesichert und nur bei nötiger Handlung im Eingangskorb beziehungsweise auf „Der Tag“ gezeigt. Auf der aktuellen Startseite bleiben Kopf, linke Navigation, „Der Tag“, „Neuer Eingang“ und „Ware raus“ erhalten (`src/ui/kr/AppShell.tsx:21-57`; `src/components/home/RolfHomeClient.tsx:29-63`, `:95-102`).

Der Paketweg fragt **nicht** zuerst „erwartet oder unerwartet?“ und **nicht** „Kunde vorhanden?“. Diese Verzweigung wird aus den vorhandenen Informationen abgeleitet:

1. **Neuer Eingang → Kamera (D1).** Sofort entstehen Eingang-ID, Empfangsdatum/-zeit, verantwortliche Rolle und Verlaufseintrag. Es gibt keine vorgelagerte Typauswahl. Ab diesem Moment kann Abbruch nichts mehr verlieren.
2. **Erstes Foto aufnehmen und Vorschlag bestätigen (D1/D2).** Ein Foto startet parallel: Typ-, Text-, Adress- und Referenzerkennung, Kundensuche, Dublettenprüfung, Suche nach offenem KV/Auftrag, angekündigter Sendung und zugehöriger Mailkorrespondenz. Wird ein Paketetikett vorgeschlagen, genügt im eindeutigen Fall ein Bestätigungsklick. Etikett, persönliche Übergabe oder Kurierangaben sind verschiedene Originalquellen desselben Eingangs.
3. **App zeigt genau einen Ergebnisweg:**
   - **Erwartet und eindeutig:** Kunde plus KV/Auftrag/Korrespondenz sind verknüpft. Der Nutzer bestätigt nur den Treffer.
   - **Kunde eindeutig, Sendung nicht erwartet:** Kunde ist verknüpft; die App legt einen neuen Auftragsentwurf an und übernimmt alle auffindbaren Angaben aus Korrespondenz und ähnlichen Vorgängen.
   - **Nicht eindeutig:** Die App zeigt Treffer nebeneinander und fragt nur die Entscheidung.
   - **Neuer Kunde:** Etikettdaten füllen Firma, Name und Anschrift. Angezeigt werden nur fehlende Pflichtfelder; während der Eingabe läuft die Dublettenprüfung. Ohne vollständige Kundendaten bleibt der Eingang sicher offen und geht nicht in die Galvanik.
4. **Eingangsbilder und Zustand.** Paketübersicht und Ware/Teile werden fotografiert; der Nutzer bestätigt „unauffällig“ oder markiert Abweichung. Schaden, Nässe, geöffnetes Paket, Mengenabweichung, falsche Teile, unbekannter Inhalt oder Verunreinigung verlangen passende Detailbilder und führen nicht still weiter.
5. **Inhalt mit vorhandenen Daten abgleichen.** Positionen, Mengen, Verfahren, Ausführung, Preis, Termin und Absprachen aus KV/Auftrag/Mail werden als Vorschlag übernommen. Standard ist eine **Teilegruppe**; nur bei abweichendem Zustand, Verfahren, Preis oder Termin wird bis zum einzelnen Teil aufgeklappt. Nichts Vorhandenes wird erneut abgefragt.
6. **Auftrags- und Rechnungsfähigkeit prüfen.** Die Prüfliste enthält Kunde/Rechnungsempfänger, Positionen/Mengen, Verfahren, Preis/KV, Wunsch-/Bestätigungstermin, Übergabeart, Zahlungsmodus, Eingangsbilder und Zustand. Zahlungsstandard bleibt: Versand nur nach Zahlung, Abholung bar/Karte; Rechnung auf Ziel nur als freigeschaltete Ausnahme (`docs/project/endversion/ENTSCHEIDUNGEN_UI.md:154-157`).
7. **Buchen.** Erst bei vollständiger Prüfliste erzeugt beziehungsweise ergänzt der bestehende einzige Auftragsweg genau einen Auftrag und übernimmt den Eingang in dessen Akte. Dann lautet das Ergebnis „bereit für Galvanik“. Jede spätere Korrektur zeigt vorher/nachher, Zeit, Bearbeiter und Grund; sie überschreibt den Verlauf nicht.

Der bestehende Auftrags-Intake kann Kunde, Termin, Zahlungsmodus und 1–20 Positionen bereits transaktional anlegen (`src/lib/server/commands/orderIntakeCommand.ts:37-80`, `:517-725`). Noch nicht vorhanden ist der hier beschriebene vorgeschaltete, verlustsichere Paket-Eingang mit Fotoerkennung, Korrespondenz-/KV-Suche, Teilegruppen, Prüfliste und Eingangskorb.

### Oberflächenskizze – Vorschlag, keine verbindliche Optik

```text
+--------------------------------------------------------------------------------+
| KREILE   [Suche]  [Telefonnotiz] [Foto / Scan] [ + Neuer Eingang] [RL · Konto] |
| Eingangskorb                              [Alle Eingangswege / D1–D5]           |
| [Alle 18] [Rot 3] [Orange 6] [Navy 5] [Grün 4]  Kanal v  Status v  Zuständig v|
+--------------------------------------------------------------------------------+
| ! E-2026-0042  Paket · 09:14  Unbekannt       Werkstatt  von Hand   [Übernehmen]|
| ! E-2026-0041  Mail · 08:52   Müller GmbH     Büro       prüfen     [Öffnen]    |
| ✓ E-2026-0040  XML · 08:31    Lieferant AG    Büro       auto       [Öffnen]    |
+--------------------------------------+-----------------------------------------+
| Original                             | Vorschlag und Zuordnung                 |
| [Mail / PDF / Foto / XML anzeigen]   | Anliegen 1: Bestellung                  |
| [Anhang 1] [Anhang 2]                | Kunde: Müller GmbH      Sicherheit hoch |
| Originalsprache / Übersetzung        | Ziel:  Auftrag A-1042   [ändern]        |
| unverändert · Hash · empfangen 08:52 | Status: Vorschlag prüfen                |
+--------------------------------------+-----------------------------------------+
| Prüfliste: Original ✓  Ziel ✓  Ergebnis offen     [An Der Tag] [Erledigen]     |
+--------------------------------------------------------------------------------+
| Verlauf: 08:52 eingegangen · 08:53 erkannt · 08:54 Vorschlag · 09:01 übernommen|
+--------------------------------------------------------------------------------+
```

Liste und Detail dürfen als Seite oder Seitenblatt umgesetzt werden. Die gesamte Seite muss vertikal scrollbar bleiben; feste Kopf-/Seitennavigation darf keinen Inhalt abschneiden. Verbindlich sind Inhalt, Zustände, Aktionen und keine Sackgasse; Raster, Farben und endgültige Komposition bestimmt der Endversion-Chat.

## 4. Daten

### Gemeinsamer Datenvertrag für B1 bis B5

Die folgenden Namen sind der vorgeschlagene logische/physische Vertrag. Vor dem Bau muss der Endversion-Chat ihn in Spec und Bauplan übernehmen. Bestehende Geschäftstabellen bleiben führend.

| Struktur | Pflichtinhalt | Regel |
|---|---|---|
| `intake_entries` | `id`, sichtbare `intake_no`, `channel`, `received_at`, `work_state`, `urgency`, `responsible_role`, optional `handler_user_id`, `technical_state`, `version`, Abschlusszeit | Genau ein Kopf je externer Quelle/physischem Ereignis; keine Löschung im normalen Betrieb. |
| `intake_originals` | Eingang-ID, Art, Dateiname/MIME, unveränderlicher Speicherverweis, Hash, externe Message-/Attachment-ID, Empfangszeit | Original ist unveränderlich. ZUGFeRD-PDF und eingebettetes XML bilden ein Bündel mit zwei Originalteilen. |
| `intake_issues` | Eingang-ID, laufende Nummer, Kurzinhalt, Originalsprache, optional Übersetzung, erkannte Absicht, eigener offener/erledigter Zustand, Primärzielart und Ziel-ID | Mindestens eins; mehrere Anliegen möglich. Bei Abschluss genau ein Primärziel: `CUSTOMER`, `SUPPLIER`, `QUOTE`, `ORDER` oder `NO_BUSINESS`. |
| `intake_suggestions` | Eingang/Anliegen, Feld, vorgeschlagener Wert, Quelle/Seite, Provider/Modell/Version, Sicherheit, `pending/accepted/rejected`, Bestätiger und Zeit | Nie fachliche Wahrheit. Annahme erzeugt ein Ereignis und schreibt über den einzigen bestehenden Geschäftsschreibweg. |
| `intake_events` | Eingang-ID, Zeit, Ereignisart, Akteur oder Regel-ID, Von-/Nach-Zustand, Begründung, betroffene IDs, technische Korrelation | Append-only; Korrektur erzeugt ein neues Ereignis statt Überschreiben. |
| `provider_incidents` | Provider, Operation, sicherer Fehlercode, erster/letzter Zeitpunkt, Versuche, Zustand, betroffene Eingang-IDs | In Wartung sichtbar; keine Secrets, Mailinhalte oder Schlüssel im Fehlertext. |

`handler_user_id` dokumentiert den angemeldeten Bearbeiter. Das ist kein personenbezogenes Rechtemodell: Rechte folgen weiterhin Rolle/Berechtigung; der Login ist nur für Verantwortung und Revision sichtbar.

Für Paket/Ware gelten zusätzlich folgende Verknüpfungen, ohne eine zweite Auftragswahrheit anzulegen:

- Eingangsbilder und Etikett bleiben unveränderliche `intake_originals`; Bildart (`LABEL`, `PACKAGE_OVERVIEW`, `PART_GROUP`, `DAMAGE`) und Aufnahmezeit sind Metadaten.
- Erkannte Firma, Referenz, Position, Menge, Zustand, Verfahren, Preis und Termin sind bis zur Bestätigung `intake_suggestions` mit Quelle, Sicherheit und Fundstelle.
- Erwartet/unerwartet ist ein **abgeleitetes Ergebnis**, kein manuell zu pflegendes Stammdatenfeld: `EXPECTED_ORDER`, `KNOWN_CUSTOMER_NO_ORDER`, `AMBIGUOUS` oder `NEW_CUSTOMER`.
- Teilegruppen sind eine Erfassungsansicht. Nach Bestätigung werden sie über den bestehenden KV-/Auftragsschreibweg zu Auftragspositionen. Bilder können einer Gruppe oder einzelnen Positionen zugeordnet sein.
- Die Prüfliste speichert pro Prüfpunkt Zustand, Quelle und Bestätigung. Geschäftsdaten bleiben in Kunde/KV/Auftrag/Rechnung führend.

### Arbeitsstatus – exakt ein Wert

| Code | Anzeige | Bedeutung |
|---|---|---|
| `AUTO_ASSIGNED` | automatisch zugeordnet | Eine sichere Regel hat das Primärziel eindeutig bestimmt; keine widersprüchlichen Treffer. |
| `REVIEW_PROPOSAL` | Vorschlag prüfen | Mindestens ein plausibler Vorschlag liegt vor, braucht aber menschliche Bestätigung. |
| `MANUAL` | von Hand bearbeiten | Quelle, Inhalt, Ziel oder Erkennung ist unklar/fehlerhaft oder ein Sonderfall liegt vor. Das ist auch der sichere Anfangszustand während Erkennung. |
| `DONE_ARCHIVED` | erledigt / archiviert | Alle Anliegen haben Ergebnis, Original/Notiz ist gesichert und Abschluss ist protokolliert. |

„eingegangen“, „Erkennung läuft“, „Providerfehler“, „wartet auf Rückfrage“ und „Konflikt“ sind **technische/zeitliche Marker**, keine zusätzlichen Arbeitsstatus.

### Erlaubte Zustandswechsel

| Von | Nach | Voraussetzung |
|---|---|---|
| neuer Eingang | `MANUAL` | Kopf und mindestens Original/Notiz atomar gesichert. |
| `MANUAL` | `REVIEW_PROPOSAL` | Erkennung liefert einen prüfbaren, nicht eindeutigen Vorschlag. |
| `MANUAL` oder `REVIEW_PROPOSAL` | `AUTO_ASSIGNED` | Später eingetroffene sichere Referenz erfüllt sämtliche Automatikregeln. |
| `AUTO_ASSIGNED` | `REVIEW_PROPOSAL` oder `MANUAL` | Konflikt, Korrektur, Dublettenverdacht oder unsichere Zusatzinformation. |
| `REVIEW_PROPOSAL` | `MANUAL` | Vorschlag abgelehnt, unvollständig oder widersprüchlich. |
| jeder offene Status | `DONE_ARCHIVED` | Alle Anliegen abgeschlossen; je Anliegen Primärziel oder begründetes `NO_BUSINESS`; keine blockierende Original-/Speicherstörung. |
| `DONE_ARCHIVED` | `MANUAL` | Berechtigtes Wiederöffnen mit Pflichtgrund. Voriges Ergebnis bleibt im Verlauf. |

Andere direkte Wechsel sind verboten. Insbesondere gibt es kein Löschen, kein direktes Archivieren ohne Ergebnis und kein Überschreiben einer fremden neueren Version.

### Dringlichkeitsfarbe, Verantwortung und Sicherheit

- **Rot – dringend:** beschädigtes Paket/Sicherheitsfall, blockierender Speicher-/Providerfehler, überfälliger Eingang, ungelöster Gleichzeitigkeitkonflikt. Sofort beziehungsweise nach Frist auf „Der Tag“.
- **Orange – Achtung:** manuelle Bearbeitung, unbekannter Absender, fehlender Beleg, schlechte Erkennung, Dubletten- oder Mehrfachanliegenverdacht.
- **Navy – zu tun:** Vorschlag liegt zur Prüfung vor, ohne akute Gefahr.
- **Grün – sicher/erledigt:** sichere automatische Zuordnung oder abgeschlossener Eingang.
- **Grau – wartet:** belegter externer Wartezustand. Der Arbeitsstatus bleibt bestehen; die Frist läuft weiter, sofern nicht ausdrücklich pausiert.

Die Farbe ist abgeleitet und ersetzt nie den Arbeitsstatus. Das folgt der appweiten Dringlichkeitslogik U-191 (`docs/project/endversion/ENTSCHEIDUNGEN_UI.md:208-210`).

Jeder Eingang gehört zu jedem Zeitpunkt einer `responsible_role`; „niemand“ ist unzulässig. `handler_user_id` ist optional, bis jemand übernimmt. Übernehmen, Zuordnen und Erledigen prüfen `version` atomar. Eine zweite Person darf lesen, aber nicht unbemerkt überschreiben.

Automatische Zuordnung ist nur zulässig, wenn eine **deterministische starke Referenz** eindeutig trifft, etwa bekannte Graph-Konversation plus vorhandener Auftrag oder exakte, widerspruchsfreie KV-/Auftragsnummer. OCR-Sicherheit oder Absenderadresse allein reichen nie. Bei mehreren Treffern, unbekanntem Absender, fremder Sprache, abweichender Kundenzuordnung, Dublettenverdacht oder fehlendem Original gilt mindestens `REVIEW_PROPOSAL`, meist `MANUAL`.

### Verlauf, Korrektur und technische Fehler

Pflichtereignisse: Eingang erzeugt, Original gesichert, Erkennung begonnen, Erkennung erfolgreich/fehlgeschlagen, Vorschlag erzeugt, automatisch zugeordnet, übernommen, Vorschlag bestätigt/abgelehnt/geändert, Anliegen geteilt, Ergebnis verknüpft, erledigt, wiedereröffnet, korrigiert, Providerfehler eröffnet/gelöst, an „Der Tag“ eskaliert/entfernt.

Wiedereröffnung verlangt einen Grund und setzt `DONE_ARCHIVED → MANUAL`. Alte Verknüpfungen und Bestätigungen bleiben sichtbar; eine Korrektur markiert sie als ersetzt, löscht sie aber nicht. Technische Wiederholung ist idempotent über externe ID/Hash und darf keinen zweiten Eingang erzeugen.

## 5. Regeln und Sonderfälle

### Übergreifende Regeln

1. **Original zuerst:** Kein Abruf wird als verarbeitet markiert, bevor Eingang und Original/Notiz dauerhaft gesichert sind.
2. **Kein stiller Verlust:** Bei jedem Abbruch bleibt ein offener Eingang. Bei technischem Fehler bleiben Quelle, Fehlermeldung in sicherer Form und nächster Schritt sichtbar.
3. **Dubletten werden nicht gelöscht:** Exakte externe ID/Hash verhindert eine zweite Anlage. Fachlich ähnliche Dokumente werden als Verdacht verknüpft und durch einen Menschen entschieden.
4. **Mehrere Anliegen:** Ein Eingang bleibt ein Eingang; Anliegen werden darunter getrennt. Abschluss erst, wenn jedes Anliegen ein Ergebnis hat.
5. **Kein Geschäftsvorgang:** Pflichtgrund aus `Werbung/Spam`, `privat`, `Fehlzustellung`, `reine Information`, `Dublette bestätigt`, `sonstiges`; bei „sonstiges“ kurze Notiz Pflicht.
6. **Rechnungen Stufe 1:** Original unverändert, Format/Lesbarkeit, Lieferant, Rechnungsnummer, Datum, Betrag/Steuer und Dublette prüfen; danach ausdrücklich `bereits bezahlt`, `noch offen` oder `unklar` bestätigen. `Unklar` gilt niemals als bezahlt. Noch kein Buchungssatz.
7. **ZUGFeRD:** PDF und eingebettetes XML sind ein Rechnungsbündel. Widerspruch zwischen sichtbarem PDF und XML ist rot und manuell zu klären.
8. **Korrespondenz:** A speichert nur „Folgeaktion angefordert/ausgeführt“ mit Ziel. Formulierungen, Vorlagen, Versand und Rücklauf klärt C.
9. **Sicherheit:** Providertexte sind Vorschläge; keine automatische Kunden-/Lieferantenanlage, kein Auftrag/KV und keine Buchung nur aufgrund eines Modells.
10. **Frist:** Offen älter als 24 Stunden wird rot und erscheint auf „Der Tag“. Für Schäden und blockierende Fehler gelten die in Abschnitt 10 zu bestätigenden kürzeren Regeln.
11. **Keine Vorabfragen beim Paket:** Erwartung, Kunde und Vorgang werden aus Etikett, Korrespondenz, KV und Auftrag abgeleitet. Erst ein fehlender oder widersprüchlicher Treffer erzeugt eine Frage.
12. **Paketbilder und Zustand sind Pflicht:** Ohne bestätigte Eingangsbilder und Zustandsprüfung wird ein Paket nicht „bereit für Galvanik“. Das ist eine neuere Owner-Vorgabe und ändert U-090 begründet; siehe Abschnitt 8.
13. **Preis vor Galvanik:** Preis/KV muss geklärt sein, bevor „bereit für Galvanik“ gesetzt wird. Eine Ausnahme ist nur als sichtbare, berechtigte Freigabe mit Grund zulässig; kein stiller Platzhalter.
14. **Versand erst nach Geld:** Bei Versand ist Vorkasse der Standard und Warenausgang bleibt bis Zahlung gesperrt. Abholung und freigeschaltete Zielrechnung folgen U-110 bis U-113; der Eingang prüft nur, ob der Vertrag vollständig gesetzt ist.
15. **Foto vor Typwahl:** Bei physischem Eingang öffnet „Neuer Eingang“ direkt die Kamera. Erst nach Sicherung des Fotos wird ein begründeter Typ-/Zusammenhangsvorschlag gezeigt. Eine Korrektur ändert den Vorschlag, nie das Original.
16. **Keine Symbolrätsel:** Globale Einstiege sind textlich beschriftet und nach Häufigkeit geordnet. Telefonnotiz ist direkt; Mail hat keinen manuellen Empfangsklick; Konto ist als Konto erkennbar.
17. **Persönlich nach Handlung verzweigen:** Ein Besucher erzeugt kein leeres Allgemeinformular. Ware, Papier, Abholung, Zahlung, KV/Frage und Reklamation folgen direkt ihrem vorhandenen Fachweg.
18. **Nicht integrierter Kanal bleibt sichtbar:** Fax, Portal, Messenger, Mailbox, Datenträger oder interne Übergabe werden mit Quelle, Zeit und erreichbarem Original über Foto/Datei/Notiz erfasst. Eine manuelle Sicherung ist als solche markiert; eine nicht vorhandene Provideranbindung wird nie behauptet.

### Falltabelle

Klickzählung beginnt beim sichtbaren Eingang oder bei „+ Eingang erfassen“, ohne Login. Ein Klick ist Tippen, Auswahl, Fotoauslösen oder Bestätigen; reine Texteingabe wird in der eigenen Spalte genannt. `+2 je weiteres Anliegen` ist eine feste Formel. Die Werte sind Obergrenzen für den beschriebenen Weg, nicht für optionale Detailansichten.

| Fall | Startpunkt | Geführte Schritte | Klicks | Texteingabe | Ergebnis | Bei Abbruch oder Fehler |
|---|---|---|---:|---|---|---|
| **W1 Unbekannter Absender/Kunde** | Etikettfoto/orange Mail | automatisch ohne Treffer → Etikettdaten übernehmen → Dubletten prüfen → nur fehlende Pflichtdaten ergänzen → Kunde bestätigen | ≤7 | nur nicht erkannte Pflichtfelder | vollständiger Kunde und verknüpfter Eingang; noch kein Galvanikstart ohne vollständigen Auftrag | Offener `MANUAL`-Eingang bleibt; Foto, Entwurf und erkannte Werte erhalten |
| **W2 Fremde Sprache** | orange Mail/Datei | öffnen → Original/Übersetzung vergleichen → Anliegenvorschlag prüfen → Ziel wählen → bestätigen | ≤5 | nur Korrektur/Notiz bei Bedarf | Originalsprache, Übersetzungsvorschlag und Bestätigung im Verlauf | Übersetzungsfehler setzt/behält `MANUAL`; Original bleibt nutzbar |
| **W3 Inhalt unverständlich** | orange Eingang | übernehmen → „unklar“ → bekannte Partei suchen → Rückfrage als Folgeaktion oder `NO_BUSINESS` wählen | ≤5 | kurze Rückfrage-/Klärungsnotiz | Kein Raten; klarer offener Wartezustand oder begründeter Abschluss | Abbruch speichert offen; Frist und Eskalation laufen weiter |
| **W4 Paket beschädigt** | `Neuer Eingang` | Kamera (D1) → Foto/Typvorschlag (D1) → Paket bestätigen (D2) → Treffer bestätigen (D2) → Paketübersicht (D1) → „beschädigt“ (D3) → Schadensfoto (D1) → sichere Übergabe (D2) | ≤9 | optionale Schadensnotiz | roter Eingang, Originalfotos, Verantwortlicher, genau eine Handlung auf „Der Tag“ | Kamera-/Speicherfehler blockiert Abschluss, Eingang und bisherige Fotos bleiben erhalten |
| **W5 Beleg fehlt** | Paket/persönlich/Rechnung | erfassen → „Beleg fehlt“ → Partei/Ziel wählen → fehlenden Beleg als offene Prüfstelle bestätigen | ≤5 | optional, was fehlt | orange `MANUAL`, nicht fälschlich erledigt | Abbruch offen; späteres Dokument wird demselben Eingang hinzugefügt |
| **W6 Mehrere Anliegen/Anhänge** | Mail/Scan mit mehreren Themen | öffnen → „Anliegen teilen“ → Anhänge je Anliegen markieren → je Anliegen Ziel bestätigen → gesamthaft erledigen | 5 + 2 je weiteres Anliegen | Kurzbezeichnung nur wenn nicht erkannt | Ein Eingang, mehrere getrennte Ergebnisse, gemeinsame Originale | Erledigen gesperrt, solange ein Anliegen offen ist |
| **W7 Dublette** | Eingang mit Treffer | öffnen → Vergleich anzeigen → „gleicher Eingang“ oder „neuer Vorgang“ → Grund bestätigen | ≤4 | Grund nur bei Abweichung | kein zweiter Eingang bei exakter Dublette; sonst verknüpfter Verdacht | Keine automatische Löschung; bei Zweifel `MANUAL` |
| **W8 Schlechte Erkennung** | unscharfes Foto/OCR-Fehler | öffnen → Original prüfen → neues Foto/Datei oder Handbearbeitung → Felder bestätigen | ≤5 plus Foto | nur nicht erkennbare Pflichtwerte | verbesserter Vorschlag oder vollständig manuelles Ergebnis | Vorheriges Original und Fehlversuch bleiben im Verlauf |
| **W9 Provider-/Abruffehler** | roter technischer Eintrag/Wartung | öffnen → betroffene Eingänge sehen → „erneut versuchen“ oder manuell fortsetzen | ≤3 | keine | idempotente Wiederholung oder manueller Weg; Vorfall protokolliert | Fehler bleibt sichtbar, wird nicht als erledigt markiert; Eskalation greift |
| **W10 Gleichzeitige Bearbeitung** | zwei Nutzer öffnen denselben Eingang | erster übernimmt → zweiter versucht Änderung → Konflikthinweis → neu laden/übernehmen lassen | ≤3 | keine | keine verlorene Änderung; genau ein aktueller Bearbeiter | abgewiesener Schreibversuch ändert nichts; Konflikt im Verlauf |
| **N1 Bekannte Mail mit Anhang** | Mailabruf | sichere Zuordnung öffnen → Vorschlag prüfen → erledigen | ≤3 | keine | Mail und Anhänge am Ziel, Eingang abgeschlossen | Anhangsfehler hält Eingang offen und zeigt fehlenden Teil |
| **N2 Rechnung als PDF/Bild** | Mail automatisch oder `Neuer Eingang` → Foto | Original sichern/erkennen (D1) → Rechnungsart bestätigen (D2) → Lieferant/Werte prüfen (D2/D3) → `bezahlt`, `offen` oder `unklar` wählen (D2) → Ergebnis bestätigen (D2) | ≤5 | nur unsichere Werte | unverändertes Original + geprüfte Rechnungsdaten + eindeutiger Zahlungsstatus, noch keine Buchung | unvollständig bleibt `REVIEW_PROPOSAL`/`MANUAL`; nie still „bezahlt“ |
| **N2a Rechnung bezahlt** | geprüfte Rechnung | „bereits bezahlt“ (D2) → Zahlungsbestätigung prüfen (D2) → archivieren (D2) | ≤3 | keine; optional Belegreferenz | geprüft bezahlt und archiviert; Original/Bestätigung getrennt | fehlende Bestätigung lässt den Fall offen |
| **N2b Rechnung offen** | geprüfte Rechnung | „noch offen“ (D2) → vorgeschlagenen Zahlungslauf bestätigen (D2) | ≤2 | keine | offene Rechnung mit genau einer fälligen Buchhaltungsaufgabe/„Der Tag“ | Abbruch behält Zahlungsstatus offen; Aufgabe wird nicht doppelt angelegt |
| **N2c Zahlung unklar** | geprüfte Rechnung | „unklar“ (D3) → Prüfverantwortung bestätigen (D2) | ≤2 | optional kurze Notiz | `MANUAL`, konkrete Prüfaufgabe, ausdrücklich nicht bezahlt | bleibt offen und eskaliert nach Regel |
| **N3 XML/XRechnung** | XML-Anhang/Upload | XML lesen → Pflichtfelder/Format anzeigen → Lieferant prüfen → bestätigen | ≤4 | nur Korrektur | Original-XML unverändert, lesbare Ansicht und Prüfergebnis | ungültiges XML bleibt rot/orange und manuell sichtbar |
| **N4 ZUGFeRD** | PDF mit XML | Bündel öffnen → PDF/XML-Abgleich → Lieferant prüfen → bestätigen | ≤4 | nur Korrektur | ein Eingang, zwei Originalteile, ein Prüfergebnis | Widerspruch wird rot; kein automatischer Abschluss |
| **N5 Papier/Foto/Scan** | `Neuer Eingang` | Kamera (D1) → Foto/Datei (D1) → Typvorschlag bestätigen/korrigieren (D2/D3) → OCR-Vorschläge prüfen (D2/D3) → Ziel bestätigen (D2) | ≤5 | nur unsichere Felder | Original und bestätigte Werte am Ziel | Abbruch speichert ab Aufnahme; OCR-Fehler führt zu Handbearbeitung |
| **N6 Paket erwartet** | `Neuer Eingang` | Kamera/Foto (D1) → Paketvorschlag (D2) → eindeutigen Kunde/KV/Auftrag bestätigen (D2) → Paket-/Teilebild (D1) → Zustand „unauffällig“ (D2) → übernommene Positionen/Preis/Termin prüfen (D2) → Auftrag buchen (D2) | ≤8 | keine | Paket in ≤5 Minuten vollständig zugeordnet, Auftrag rechnungsfähig und „bereit für Galvanik“ | Prüfliste springt zum einzigen offenen Punkt; Abbruch bleibt im Eingangskorb |
| **N6a Paket unerwartet, Kunde bekannt** | `Neuer Eingang` | Kamera/Foto (D1) → Paket/Kundentreffer bestätigen (D2) → Auftragsentwurf (D2) → Teilegruppe/Bilder (D1) → nur fehlende Preis-/Termin-/Verfahrensdaten (D4) → buchen (D2) | ≤10 plus echte Texteingaben | nur fachlich fehlende Angaben | neuer Auftrag am bestehenden Kunden; gesamte Herkunft im Verlauf | Unvollständig bleibt als sichtbarer Entwurf und Eingang offen |
| **N6b Paket neuer Kunde** | `Neuer Eingang` | Kamera/Foto (D1) → „kein Treffer“ prüfen (D3) → vorgefüllten Kunden vervollständigen (D4) → Teilegruppe/Bilder (D1) → Auftrag vervollständigen (D4) → buchen (D2) | kein starres 10-Klick-Ziel; jede vorhandene Angabe wird übernommen | nur fehlende Pflicht- und Auftragsdaten | Kunde einmal angelegt, Eingang und Auftrag verknüpft, keine Doppeleingabe | Dublette/Abbruch stoppt sicher vor Anlage; Eingang bleibt vollständig erhalten |
| **N7 Person bringt Ware/Papier** | `Neuer Eingang` | direktes Foto (D1) → Art/Zusammenhang bestätigen (D2/D3) → Paket- oder Dokumentweg | 1 bis zum sicheren Original; danach jeweiliger Normalfall | keine zusätzliche Besuchsnotiz | Eingang ist nach Inhalt, nicht nach anwesender Person verarbeitet | Abbruch nach Foto bleibt offen; kein allgemeines Sackgassenformular |
| **N7a Person holt ab/bezahlt/fragt/reklamiert** | direkte beschriftete Handlung | Abholung → Warenausgang; Zahlung → Zahlungsweg; Frage → KV; Reklamation → Auftrag/Klärung (je D2/D3) | ≤3 bis zum zuständigen Fachweg | nur tatsächlich neue Aussage | Handlung und Person/Vorgang verbunden | unbekannte Person: Name + Kontakt als D4; Aufgabe bleibt sichtbar |
| **N8 Telefon** | Kopfaktion „Telefonnotiz“ | direkt öffnen (D1) → vorgeschlagenen Kontakt/Vorgang prüfen (D2/D3) → Anliegen wählen (D2) → kurze Notiz → Handlung bestätigen (D2) | ≤4 | Gesprächsnotiz; ggf. Name + Telefon | Telefonnotiz im Eingang und an Partei/Vorgang | Abbruch speichert vorhandene Notiz als offenen Entwurf |
| **N9 Kein Geschäftsvorgang** | beliebiger Eingang | öffnen → `kein Geschäftsvorgang` → Grund → bestätigen | ≤4 | nur bei „sonstiges“ | begründet archiviert, Original und Verlauf erhalten | Ohne Grund kein Abschluss |
| **N10 Fax/Portal/Messenger/Mailbox/Datenträger/interne Übergabe** | jeweilige Quelle | sicherstes verfügbares Original sichern (D1–D3) → Quelle/Kanal bestätigen (D2) → Typ/Zusammenhang vorschlagen (D2/D3) → zuständigen Fachweg öffnen | ≤4 bis zum Fachweg | nur fehlender Absender/Kontakt oder Ursprungsnotiz (D4) | derselbe Eingangskorb und eindeutiger Endpunkt; keine Schattenablage | nicht lesbar/verdächtig: D5 Wartung; Original oder Quellennachweis bleibt offen |

## 6. Rechte

Rechte werden als einzelne Fähigkeiten geprüft; Rollen sind nur Vorlagen. Ein Bereichshaken „Eingang“ allein darf serverseitige Einzelprüfungen nicht ersetzen. Keine Regel verwendet Personennamen.

| Fähigkeit | Meister-Vorlage | Büro-Vorlage | Werkstatt-Vorlage | developer-Vorlage | Nur Lesen |
|---|---:|---:|---:|---:|---:|
| sehen | ja | ja | ja, ohne Geldfelder | ja, für Support/Wartung | ja, freigegebene Kanäle |
| übernehmen | ja | ja | ja für Paket, persönlich, Telefon | nein | nein |
| zuordnen | ja | ja | ja zu Kunde/KV/Auftrag, ohne Lieferantenbeträge | nein | nein |
| Vorschläge/Angaben ändern | ja | ja | ja im erlaubten Kanal, ohne Geld | nein | nein |
| erledigen/archivieren | ja | ja | ja im erlaubten Kanal | nein | nein |
| wieder öffnen | ja | ja mit Pflichtgrund | nur eigene/zugewiesene Fälle mit Pflichtgrund | nein | nein |
| Regeln verwalten | nur wenn separat freigeschaltet | nein | nein | ja | nein |
| technische Fehler erneut versuchen/lösen | nein | nein | nein | ja | nein |

Zusatzregeln:

- Geldwerte und Eingangsrechnungsdetails erfordern zusätzlich das Recht „Geld/Buchhaltung“; die Werkstatt sieht nur „Lieferantenbeleg vorhanden/fehlt“.
- developer darf Einsicht, Diagnose und Regeln verwalten, führt aber keine Geschäftsvorgänge als Mitarbeiter aus (`_review/OWNER_ENTSCHEIDUNGEN.md:92-95`). Ein technischer Retry ist kein fachlicher Abschluss.
- „Übernehmen“ setzt Bearbeiter und Version atomar. „Zuweisen an“ darf nur eine berechtigte Rolle wählen, nie eine unberechtigte Person umgehen.
- Rechteverwaltung bleibt gemäß U-200 vorerst beim dafür festgelegten technischen Administrationsrecht (`docs/project/endversion/ENTSCHEIDUNGEN_UI.md:219`); die Matrix definiert Fähigkeiten, nicht den aktuell berechtigten Namen.
- Jede Rechteänderung und jede regelbasierte Zuordnung wird mit Akteur, Zeit, vorher/nachher protokolliert.

## 7. Entscheidungen des Owners in diesem Chat

**28.10.2026:** Der Owner hat den physischen Paketweg konkretisiert. Die folgenden neuen und vorhandenen Entscheidungen gelten und werden nicht erneut gefragt:

| Entscheidung | Datum/Beleg | Folge für A |
|---|---|---|
| Ein einheitlicher Einstieg „Neuer Eingang“; keine zweite fachliche oder technische Wahrheit. | 26.10.2026, `_review/OWNER_ENTSCHEIDUNGEN.md:60-64` | Eingangskorb ergänzt den Einstieg; er erzeugt keine parallelen Kunden-/Auftragsschreibwege. |
| Desktop/Tablet große Erfassungsseite, mobil geführt; Quelle kann Text, Foto, Datei oder Mail sein. | 27.10.2026, U-081/U-195, `docs/project/endversion/ENTSCHEIDUNGEN_UI.md:123-130`, `:214` | Die frühere pauschale Drei-Schritte-Vorgabe gilt nur dort, wo der Endversion-Chat sie als mobilen/geführten Ablauf übernimmt. |
| Original sichern, Vorschläge erst nach Bestätigung übernehmen. | 27.10.2026, U-086, `docs/project/endversion/ENTSCHEIDUNGEN_UI.md:130` | Keine KI-/OCR-Antwort ist selbst Geschäftswahrheit. |
| Rollen/Berechtigungen statt Namen; developer ist Wartung/Einsicht, nicht Mitarbeiter. | 27.10.2026, `_review/OWNER_ENTSCHEIDUNGEN.md:92-98` | Abschnitt 6. |
| Stufe 1 enthält OCR vollständig, Mail-Eingang mit Zuordnung und „Der Tag“ in schlicht; Diktat ist später geplant. | 28.10.2026, `_review/OWNER_ENTSCHEIDUNGEN.md:101-113` | Die neuere Entscheidung geht U-193 zum Diktat vor. Einfaches Tippen reicht für Telefon/persönlich. |
| Wareneingang ist Kern-USP: höchstens fünf Minuten, ohne offenen Punkt. | 28.10.2026, `_review/OWNER_ENTSCHEIDUNGEN.md:116-120` | Der Normalfall N6 ist auf höchstens zehn Klicks begrenzt. |
| Jede Information landet im Eingangskorb; vier sichtbare Status; geringe Sicherheit handelt nie selbst; überlange Eingänge erscheinen auf „Der Tag“. | 28.10.2026, `_review/ORIENTIERUNG_KLAERUNG.md:153-184` | Gemeinsamer Vertrag in Abschnitt 4. |
| Empfangene XML-E-Rechnung muss erkannt und gelesen werden; Senden wird später in Thema 4 entschieden. | 28.10.2026, `_review/ORIENTIERUNG_KLAERUNG.md:187-189` | Eingang kann XML/ZUGFeRD; Ausgang bleibt außerhalb von A. |
| Mail erfordert keinen Klick auf das Plus und keinen manuell geöffneten Eingang; Abruf, Originalablage und Erkennung laufen im Hintergrund. Das Plus startet physische Eingänge. | 28.10.2026, Owner in diesem Chat | Neuerer, begründeter Änderungsvorschlag zu U-160; siehe Abschnitt 8. Mail bleibt im selben Eingangskorb und derselben Zustandssprache. |
| Beim Paket wird „erwartet/unerwartet“ und „Kunde vorhanden/nein“ nicht vorab gefragt. Das Etikettfoto sucht Kunde, Korrespondenz, KV, Auftrag und angekündigte Sendung. | 28.10.2026, Owner in diesem Chat | Die UI zeigt nur den ermittelten Treffer oder echte Unklarheit. |
| Bei vorhandenem Kunde/Vorgang werden Korrespondenz, KV, Preise, Teile, Mengen, Bilder, Termin und Absprachen zusammengezogen und nur nachkontrolliert. | 28.10.2026, Owner in diesem Chat | Keine erneute Eingabe bereits vorhandener Daten; Vorschläge bleiben bis Bestätigung getrennt. |
| Neukundenanlage ist der seltene Sonderfall; Etikett und vorhandene Kommunikation füllen vor, die UI verlangt nur fehlende Angaben und prüft Dubletten. | 28.10.2026, Owner in diesem Chat | Kunde wird einmal über den bestehenden Kundenschreibweg angelegt; unvollständiger Fall bleibt im Eingangskorb. |
| Eingangsdatum/-zeit und jeder Verarbeitungsschritt werden automatisch historisiert. Bilder der Ware und Zustandsdokumentation sind unerlässlich. | 28.10.2026, Owner in diesem Chat | Neuere Vorgabe ändert U-090 für Paket/Ware; Abschnitt 8. |
| Paketinhalt darf als Teilegruppe erfasst werden; genaue Angaben pro Teil bleiben möglich. Bei vorhandenem KV werden Positionen übernommen und nur geprüft. | 28.10.2026, Owner in diesem Chat | Teilegruppe ist Bedienhilfe, keine zweite fachliche Wahrheit. |
| Vor „bereit für Galvanik“ müssen offene Angaben einschließlich Preis/KV, Bilder, Teile/Mengen und Termin geklärt sein. Rechnungsweg und Zahlung müssen feststehen; Versand grundsätzlich erst nach Zahlung, Ausnahmen sichtbar. | 28.10.2026, Owner in diesem Chat; Zahlungsbestand U-110 bis U-113 | Eingang endet mit einem vollständigen, rechnungsfähigen Auftrag; Warenausgang bleibt eigenes Anschlussmodul. |
| Archivierte Angaben bleiben korrigierbar; jede spätere Änderung muss als solche erkennbar bleiben. | 28.10.2026, Owner in diesem Chat | Wiedereröffnung/Korrektur erzeugt Ereignis mit vorher/nachher, Grund, Zeit und Bearbeiter. |
| Beim physischen Eingang wird zuerst fotografiert; erst danach schlägt die App Art und Zusammenhang vor. Der Nutzer muss Paket, Rechnung oder Papier nicht vorab wählen. | 28.10.2026, Owner in diesem Chat | „Neuer Eingang“ und „Foto / Scan“ öffnen direkt die Kamera; Korrektur des Vorschlags bleibt jederzeit möglich. |
| Bei Eingangsrechnungen wird nach der Werteprüfung ausdrücklich gefragt: bereits bezahlt, noch offen oder unklar. | 28.10.2026, Owner in diesem Chat | Bezahlt wird geprüft archiviert; offen erzeugt den Zahlungslauf; unklar bleibt menschliche Prüfung und gilt nie als bezahlt. |
| Die Oberfläche muss in fünf Sekunden verständlich, modern, nüchtern, geordnet und vollständig scrollbar sein. | 28.10.2026, Owner in diesem Chat | Globale Aktionen erhalten Klartext; alleinstehende Symbole werden nicht als Navigation vorausgesetzt. |
| Telefon öffnet mit einem direkten Klick die Notiz; „persönlich“ wird nach tatsächlicher Handlung verzweigt und nicht als allgemeines Formular geführt. | 28.10.2026, Owner in diesem Chat | Telefon steht im Kopf; Ware/Papier/Abholung/Zahlung/KV/Reklamation nutzen sofort ihren Fachweg. |
| Jede im Unternehmen erwartbare Eingangsquelle braucht einen Weg in die App, durch die App und zu einem benannten Endpunkt; es darf keine Sackgasse oder unsichtbare Ablage geben. | 28.10.2026, Owner in diesem Chat | Weitere Kanäle nutzen bis zu einer echten Integration den sicheren Foto-/Datei-/Notizweg; Wegekarte und Abnahme markieren D1–D5. |

## 8. Änderungsvorschläge zum Bestehenden

Diese Punkte ändern bestehenden Bauplan oder Codevertrag und benötigen Übernahme durch den Endversion-Chat sowie die jeweils genannte Owner-Entscheidung. In dieser Klärung wird nichts gebaut.

1. **Neues gemeinsames Eingang-Objekt mit Anliegen und Ereignissen.** Begründung: Mail, Auftragserfassung, Beleg, Entwurf und „Der Tag“ sind heute getrennte Teilwahrheiten. Nachteil: neue dauerhafte Tabellen und Migration. Kleine Alternative „nur bestehende Objekte zusammen anzeigen“ scheitert an Verantwortung, Mehrfachanliegen, Wiedereröffnung und lückenlosem Verlauf. Empfehlung: Vertrag aus Abschnitt 4 übernehmen.
2. **„Neuer Eingang“ in Erfassung und Eingangskorb trennen, aber unter einem Modulnamen.** „+ Eingang erfassen“ erzeugt/öffnet einen Eingang; der Eingangskorb zeigt alle offenen und erledigten Fälle. Begründung: U-081a bleibt erfüllt, ohne den bestehenden Auftragsdialog zum Universalarchiv zu machen.
3. **Bestehende Quellen anbinden statt kopieren.** Graph-Nachricht, `communication_threads`, `scan_uploads`, Kunden, Lieferanten, KV und Aufträge bleiben ihre Wahrheit; `intake_originals`/Anliegen halten unveränderliche Links und Prüfdaten. Begründung: kein Schattenmodell.
4. **XML/ZUGFeRD in den sicheren Dateivertrag aufnehmen.** MIME/Signaturprüfung, Größenlimit, Hash, Viren-/Parserfehler und unveränderte Ablage ergänzen. Eingebettetes XML wird nicht als OCR-Bild behandelt.
5. **Providerfehler persistent machen.** `provider_incidents` ergänzt Wartung und verknüpft betroffene Eingänge. Das ersetzt keine sichtbare Fehlermeldung am Eingang, sondern ergänzt sie.
6. **Eingangsrechte feingranular ergänzen.** Die heutigen Bereichsrechte (`src/lib/auth/authorizationContract.ts:19-64`) reichen nicht für sehen/übernehmen/zuordnen/ändern/erledigen/wieder öffnen/Regeln. Alte feste Rollenrechte (`:98-157`) dürfen danach keine zweite Autorisierung bleiben.
7. **„Der Tag“ aus dem Eingang ableiten.** Keine zweite Aufgabenzeile manuell pflegen. Rot, überfällig oder ausdrücklich eskaliert erzeugt genau eine Projektion; erledigt/Verantwortung geändert aktualisiert sie.
8. **F1-Baureife vor Neubau bereinigen.** Der Widerspruch in `BAUPLAN.json` und der offene Idempotenzbefund (`docs/project/endversion/codex/BAUPLAN.json:369-374`) müssen vor Bau des neuen Moduls aufgelöst werden. Der Eingangskorb darf nicht als freigegeben gelten, solange Top-Level `baureife=false` ist.
9. **U-160 an den Mail-Staubsauger anpassen.** Statt Mail manuell über den Quellenschalter „Neuer Eingang“ zu öffnen, erzeugt der Hintergrundabruf den Eingang automatisch. Der bestehende Dialog darf weiterhin eine bereits eingegangene Mail auswählen, ist aber nicht mehr der Empfangsweg. Begründung: Eine Mail liegt bereits digital vor und darf keinen Büro-Klick zum Eintreffen brauchen. Nachteil: Abruf, Idempotenz und sichtbare Providerstörung müssen zuverlässig gebaut sein.
10. **U-090 für Paket/Ware präzisieren und ändern.** Eingangsbilder und Zustandsbestätigung sind bei physischer Ware ein Abschluss-Gate; bei reinen Dokument-/Notizfällen bleibt die Fotoregel fachabhängig. Begründung: Zustand und Umfang sind nach dem Öffnen nicht reproduzierbar. Nachteil: mindestens eine Aufnahme mehr im Normalfall. Empfehlung: eine Paketübersicht plus ein Bild je Teilegruppe; Einzelteilbild nur bei Abweichung oder wert-/zustandskritischem Teil.
11. **Preis-/Rechnungs-Gate vor Galvanik ergänzen.** Der bestehende Intake lässt Positionen ohne finalen Preis zu; künftig darf das Paket zwar sofort sicher erfasst werden, aber erst nach geklärtem Preis/KV oder berechtigter dokumentierter Ausnahme „bereit für Galvanik“ werden. Begründung: Der Auftrag muss später ohne nachträgliche Suche korrekt abrechenbar sein. Nachteil: ungeklärte Preisfälle starten nicht sofort in der Werkstatt.
12. **Teilegruppen als Bedienkonzept ergänzen.** Eine Gruppe übernimmt gemeinsame Menge, Verfahren, Preis, Termin und Bilder; abweichende Einzelteile werden aufgeklappt. Nachteil: falsches Gruppieren muss vor Buchung sichtbar korrigierbar sein. Die endgültigen Daten werden ausschließlich in vorhandene KV-/Auftragspositionen geschrieben.
13. **Universellen Foto-zuerst-Einstieg statt vorgelagerter Typauswahl verwenden.** Der Klick auf „Neuer Eingang“ erzeugt den offenen Eingang und öffnet direkt die Kamera; erst das gesicherte Bild führt zu einem begründeten Typ- und Zusammenhangsvorschlag. Begründung: Nutzer wissen vor der Aufnahme oft nicht, ob ein Blatt Rechnung, Lieferschein oder sonstiger Beleg ist. Nachteil: Erkennung muss mehrere Dokument-/Objektarten unterscheiden; bei Unsicherheit ist eine kurze Typwahl nötig.
14. **Globale Symbolknöpfe beschriften.** Diktat/Telefon, Scan, Plus und Konto dürfen nicht nur durch `◉`, `▣`, `+` und Initialen erklärt werden. Empfehlung: `Telefonnotiz`, `Foto / Scan`, `+ Neuer Eingang`, `RL · Konto`. Nachteil: mehr Breite im Kopf; auf kleinen Bildschirmen werden seltenere Aktionen in ein klar beschriftetes Menü verschoben.
15. **Zahlungsstatus als Pflichtentscheidung der Rechnungsprüfung ergänzen.** Nach bestätigten Rechnungswerten stehen genau `bereits bezahlt`, `noch offen`, `unklar` zur Wahl. „Offen“ erzeugt eine idempotente Aufgabe zum konfigurierten Zahlungslauf; „unklar“ eine Prüfaufgabe; „bezahlt“ braucht eine menschliche Bestätigung. Nachteil: ein zusätzlicher Bestätigungsschritt, der jedoch falsches Archivieren verhindert.
16. **Wegekarte D1–D5 als Klärungs- und Abnahmewerkzeug führen.** Jede Eingangsart, Verzweigung und jedes Ende ist sichtbar; kein Blatt darf ohne Endpunkt bleiben. Sie ist keine zweite fachliche Wahrheit, sondern visualisiert Regeln und verweist auf Eingangszustand/Folgeaktion. Nachteil: muss bei Regeländerungen mitgepflegt werden.

## 9. Abnahmefälle

Voraussetzung aller Fälle: UI-Prüfung über echte Klicks und Datenbankprüfung gegen den in Abschnitt 4 übernommenen Vertrag. „Ein Ereignis“ bedeutet genau eine append-only Zeile mit Eingang-ID, Zeit, Akteur/Regel und Korrelation. Dateihashes werden verglichen; Originalinhalt wird nicht verändert.

1. **Wenn** eine neue Mail mit zwei Anhängen abgerufen wird, **dann** erscheint sie nach dem nächsten Abruf mit höchstens einem Klick im Eingangskorb, bevor eine Zuordnung erfolgt. In der Datenbank existieren genau ein `intake_entries`-Kopf, drei `intake_originals`-Teile beziehungsweise Mail plus zwei Anhänge und je ein Ereignis „eingegangen“/„Original gesichert“.
2. **Wenn** dieselbe Graph-Nachricht erneut abgerufen wird, **dann** zeigt ein Klick auf den Eingang weiterhin denselben Datensatz. In der Datenbank existiert zur externen Message-ID genau ein Eingang; der Wiederholungsversuch ist als idempotentes Ereignis sichtbar.
3. **Wenn** eine bekannte Mail eine eindeutige bestehende Auftragsreferenz enthält, **dann** zeigt Öffnen → Prüfen → Erledigen in höchstens drei Klicks „automatisch zugeordnet“ und danach „erledigt / archiviert“. In der Datenbank zeigt das Anliegen auf genau diesen Auftrag; Regel-ID, Referenz und beide Zustandswechsel stehen im Verlauf.
4. **Wenn** der Absender unbekannt ist, **dann** führt Öffnen → Übernehmen → Kunde suchen → Interessent anlegen → Bestätigen in höchstens sechs Klicks ohne Sackgasse zum Ergebnis. In der Datenbank bleibt das Original unverändert; der neue Kunde wurde über den einzigen Kundenschreibweg erzeugt und das Anliegen verknüpft ihn.
5. **Wenn** eine fremdsprachige Mail nicht sicher verstanden wird, **dann** zeigt ein Klick Original und Übersetzung nebeneinander, Status „von Hand bearbeiten“ und einen Sicherheitswert. In der Datenbank bleiben Originaltext, Übersetzung als Vorschlag, Provider/Version und spätere Annahme/Ablehnung getrennt.
6. **Wenn** ein Eingang drei Anliegen enthält, **dann** kann der Nutzer über „Anliegen teilen“ jedes Anliegen einzeln zuordnen und den Eingang erst nach allen drei Ergebnissen erledigen. In der Datenbank gibt es einen Eingang, drei `intake_issues`, gemeinsame Originalverknüpfungen und keinen Abschluss, solange eines offen ist.
7. **Wenn** ein beschädigtes Paket angenommen wird, **dann** führen höchstens neun Klicks zu Fotos, Schadensmarkierung, Verantwortlichkeit und rotem Eintrag auf „Der Tag“. In der Datenbank sind Hashes der Fotos, Schadenereignis, aktuelle Rolle und genau eine aktive Eskalation gespeichert.
8. **Wenn** bei einem Paket der Beleg fehlt, **dann** verhindert „Erledigen“ den Abschluss und springt zur offenen Prüfstelle. In der Datenbank bleibt `work_state=MANUAL`, das Anliegen offen und „Beleg fehlt“ als Ereignis/Prüfpunkt gespeichert.
9. **Wenn** ein bekanntes Paket mit Begleitzettel und offenem KV ankommt, **dann** gelangen Nutzer in höchstens zehn Klicks und fünf Minuten vom Foto über KV/Positionen/Zustand zur Folgeaktion „in Galvanik“. In der Datenbank verweist das Anliegen auf genau den bestehenden KV beziehungsweise den daraus erzeugten Auftrag; Original und Bestätiger sind protokolliert.
10. **Wenn** ein unscharfes Foto schlecht erkannt wird, **dann** bietet die Detailansicht „neues Foto“ und „von Hand bearbeiten“, ohne Datenverlust. In der Datenbank bleiben beide Originalversionen und der fehlgeschlagene Erkennungsversuch erhalten; nur bestätigte Werte gelangen ins Zielobjekt.
11. **Wenn** eine XML/XRechnung eingeht, **dann** zeigt Öffnen → Prüfen → Bestätigen in höchstens vier Klicks eine lesbare Ansicht mit Lieferant, Nummer, Datum, Betrag und Prüfstatus. In der Datenbank bleibt das Original-XML hashgleich gespeichert; erkannte Werte und Bestätigung sind getrennt, es entsteht kein Buchungssatz.
12. **Wenn** eine ZUGFeRD-Datei widersprüchliche Werte in PDF und XML enthält, **dann** wird sie rot und nicht automatisch abgeschlossen. In der Datenbank gehören PDF/XML zu einem Eingang, der Widerspruch ist ein Ereignis und `work_state=MANUAL`.
13. **Wenn** OCR oder Microsoft nicht erreichbar ist, **dann** bleibt der Eingang sichtbar und bietet Wiederholen oder Handbearbeitung; Wartung zeigt den Vorfall. In der Datenbank existieren Eingang, `provider_incidents`-Verknüpfung und Fehlereignis; ein Retry erzeugt keinen zweiten Eingang.
14. **Wenn** zwei berechtigte Nutzer denselben Versionsstand ändern, **dann** wird der zweite Schreibversuch abgewiesen und bietet „neu laden“. In der Datenbank ist nur der erste Wechsel gespeichert; `version` wurde genau einmal erhöht und der Konflikt protokolliert.
15. **Wenn** ein erledigter Eingang mit Grund wieder geöffnet wird, **dann** zeigt ein Klick „Wieder öffnen“ den Status „von Hand bearbeiten“. In der Datenbank bleiben alter Abschluss und Ergebnis bestehen; ein neues Wiedereröffnungsereignis enthält Grund und Akteur.
16. **Wenn** ein offener Eingang 24 Stunden überschreitet, **dann** erscheint er ohne manuellen Doppelklick genau einmal auf „Der Tag“ der verantwortlichen Rolle. In der Datenbank existiert eine aktive Eskalation; Abschluss oder Verantwortungswechsel aktualisiert dieselbe Projektion, statt eine zweite anzulegen.
17. **Wenn** „kein Geschäftsvorgang“ gewählt wird, **dann** verlangt die UI einen Grund und schließt in höchstens vier Klicks. In der Datenbank ist das Anliegen ausschließlich auf `NO_BUSINESS` gesetzt, der Grund gespeichert und das Original weiterhin vorhanden.
18. **Wenn** ein Nutzer ohne jeweilige Fähigkeit eine Direkt-URL oder Serveraktion zum Zuordnen, Erledigen, Wiederöffnen oder Regeländern aufruft, **dann** wird die Aktion serverseitig abgelehnt. In der Datenbank ändern sich Eingang, Version und Verlauf nicht; der Sicherheitsversuch wird im vorhandenen Audit protokolliert.
19. **Wenn** auf der echten Startseite das globale Plus und danach „Neuer Eingang“/„Paket oder Ware“ geklickt wird, **dann** öffnet spätestens nach zwei Auswahlen die Kamera und erzeugt vor der Erkennung einen offenen Eingang. In der Datenbank stehen `received_at`, verantwortliche Rolle, `work_state=MANUAL` und das Ereignis „Eingang erzeugt“, auch wenn danach abgebrochen wird.
20. **Wenn** ein Etikettfoto eine eindeutige Kundenreferenz und einen offenen KV trifft, **dann** zeigt die nächste Ansicht Kunde, KV, zugehörige Mailquelle und den Grund des Treffers, ohne „erwartet?“ oder „Kunde vorhanden?“ zu fragen. In der Datenbank bleiben Foto und Erkennung Vorschlag; erst der Bestätigungsklick verknüpft den Eingang mit dem KV.
21. **Wenn** das Etikett einen bekannten Kunden, aber keinen offenen Vorgang trifft, **dann** bietet die App nach einem Bestätigungsklick einen neuen Auftragsentwurf mit bereits gefundenen Kontakt-/Korrespondenzdaten. In der Datenbank existiert genau ein Eingang; der Auftrag entsteht erst beim abschließenden Buchen über den bestehenden Auftrags-Intake.
22. **Wenn** weder Kunde noch Vorgang eindeutig erkannt werden, **dann** zeigt „Neuer Kunde“ die aus dem Etikett erkannten Angaben und nur die fehlenden Pflichtfelder; Dublettentreffer stoppen die Neuanlage und bieten den vorhandenen Kunden. In der Datenbank entsteht kein zweiter Kunde bei abgebrochener oder als Dublette erkannter Anlage.
23. **Wenn** ein KV drei Positionen mit Menge, Verfahren, Preis und Termin enthält, **dann** sind diese nach Bestätigung des Treffers ohne Texteingabe in der Inhaltsprüfung sichtbar und änderbar. In der Datenbank bleiben KV-Quelle und spätere bestätigte Auftragspositionen nachvollziehbar; eine Änderung erzeugt ein Korrekturereignis statt die Herkunft zu löschen.
24. **Wenn** mehrere gleichartige Teile gemeinsam ankommen, **dann** kann ein Nutzer sie als eine Teilegruppe mit gemeinsamem Bild/Zustand bestätigen und nur abweichende Teile einzeln öffnen. In der Datenbank entstehen die bestätigten Auftragspositionen über den bestehenden Schreibweg; Bildverknüpfungen zeigen Gruppe beziehungsweise Einzelposition eindeutig.
25. **Wenn** Preis, Rechnungsempfänger, Termin, Zahlungsmodus, Pflichtbild oder Zustand noch offen ist, **dann** ist „Bereit für Galvanik“ gesperrt und der Klick auf die Prüfliste springt zur ersten echten Lücke. In der Datenbank bleibt der Eingang offen; es gibt keinen Galvanik-Übergang und keinen fingierten Wert.
26. **Wenn** ein vollständiger Versandauftrag gebucht wird, **dann** ist Zahlungsmodus standardmäßig Vorkasse, der Rechnungsempfänger festgelegt und der spätere Warenausgang bis Zahlung gesperrt. In der Datenbank sind Auftrag, Zahlungsmodus und Eingang verknüpft; eine Zielrechnungs-Ausnahme enthält Berechtigung und Verlauf.
27. **Wenn** ein archivierter Paketeingang korrigiert wird, **dann** zeigt „Wieder öffnen“ den bisherigen und neuen Wert sowie einen Pflichtgrund. In der Datenbank bleibt der alte Wert im Ereignisverlauf, `version` steigt und der aktuelle fachliche Wert wird über den bestehenden Schreibweg geändert.
28. **Wenn** auf der Startseite „Neuer Eingang“ oder „Foto / Scan“ einmal geklickt wird, **dann** öffnet direkt die Kamera, ohne vorher Paket, Rechnung, Kunde oder Erwartung abzufragen. In der Datenbank existiert bereits der offene Eingang mit Nummer, Empfangszeit, verantwortlicher Rolle und Ereignis „Eingang erzeugt“; ein Abbruch löscht ihn nicht.
29. **Wenn** das erste Foto ein Paketetikett mit bekannter KV-Referenz zeigt, **dann** zeigt die nächste Ansicht den Vorschlag „Paketetikett“, Treffergrund und Sicherheit; ein weiterer Klick führt zum Kunden/KV-Treffer. In der Datenbank bleibt das Foto unverändertes Original, während Typ, Referenz und Sicherheit als Vorschlag gespeichert sind; die Verknüpfung entsteht erst nach Bestätigung.
30. **Wenn** das erste Foto eine Rechnung zeigt, **dann** führt „Eingangsrechnung“ → Werte bestätigen zwingend zur Frage „bereits bezahlt / noch offen / unklar“. In der Datenbank existiert vor dieser Entscheidung kein impliziter Zahlungsstatus; Original, Erkennung und bestätigte Rechnungswerte bleiben getrennt.
31. **Wenn** bei einer geprüften Rechnung „bereits bezahlt“ gewählt und bestätigt wird, **dann** endet der Klickweg sichtbar mit „als bezahlt geprüft“ und archiviert den Eingang. In der Datenbank stehen Zahlungsstatus, Bestätiger, Zeit und Ereignis; es entsteht in Stufe 1 kein Buchungssatz.
32. **Wenn** bei einer geprüften Rechnung „noch offen“ gewählt wird, **dann** zeigt der Bestätigungsklick den vorgeschlagenen Zahlungslauf und genau eine konkrete Buchhaltungsaufgabe auf „Der Tag“. In der Datenbank bleiben Rechnung und Eingang offen, besitzen eine Fälligkeit/Aufgabenprojektion und keine doppelte Aufgabe bei erneutem Klick.
33. **Wenn** bei einer geprüften Rechnung „unklar“ gewählt wird, **dann** führt der Bestätigungsklick zu „von Hand bearbeiten“ mit Verantwortlichkeit und nächster Prüfung. In der Datenbank ist der Status ausdrücklich unklar und niemals bezahlt; Verlauf und Eskalationsfrist laufen weiter.
34. **Wenn** ein Nutzer den vollständigen Eingangskorb oder die Wegekarte auf einem unterstützten Bildschirm öffnet, **dann** kann er durch normales vertikales Scrollen jeden Inhalt und jeden Endpunkt erreichen; Kopf/Navigation verdecken keinen Abschlussknopf. In der Datenbank entsteht durch reines Scrollen keine Änderung; erst eine explizite Aktion erzeugt ein Ereignis.
35. **Wenn** „Telefonnotiz“ in der Kopfzeile geklickt wird, **dann** öffnet ohne Zwischenmenü die Notiz mit vorgeschlagenem Kontakt/Vorgang, Anliegen und genau einem Textfeld für die neue Aussage. In der Datenbank entsteht beim Speichern ein Eingang/Anliegen mit Zeit, Bearbeiter, Zuordnung und Folgeaktion; Abbruch nach Texteingabe hält einen offenen Entwurf.
36. **Wenn** eine anwesende Person Ware, Papier, eine Abholung, Zahlung, KV-Frage oder Reklamation auslöst, **dann** führt die jeweils sichtbare Handlung ohne allgemeines Personenformular in den zugehörigen Fachweg. In der Datenbank verweist genau ein Eingang beziehungsweise eine Folgeaktion auf das führende Zielobjekt; es entsteht kein paralleler Besuchsdatensatz als zweite Wahrheit.
37. **Wenn** eine Information über Fax, Portal, Messenger, Mailbox, Datenträger oder einen internen Überbringer ankommt und dafür keine direkte Integration besteht, **dann** kann der Nutzer in höchstens vier Klicks Original/Quellennachweis sichern und den passenden Foto-/Datei-/Telefonweg öffnen; die UI kennzeichnet die Erfassung als manuell. In der Datenbank existieren genau ein Eingang, Kanal/konkrete Quelle, Empfangszeit, Original oder Ursprungsnotiz und Verlauf; kein nicht vorhandener Providerstatus wird gespeichert.

## 10. Offene Punkte

### Einzeln zu entscheidende Owner-Fragen

**O-01 – Sichtbare Eingang-Nummer**
Empfehlung: zusätzlich zur UUID `E-JJJJ-NNNNN`, mandantenweit fortlaufend. Wesentlicher Nachteil: ein weiterer Nummernkreis und Lücken bei abgebrochenen Transaktionen müssen erlaubt sein. Kleine Alternative: nur gekürzte UUID, technisch einfacher, am Telefon schlechter. **Entscheidung erbeten:** Empfehlung übernehmen?

**O-02 – Fallback-Verantwortung**
Empfehlung: In Stufe 1 ist die Rolle `meister` Fallback für jeden Eingang; Paket/persönlich kann sicher an `werkstatt`, Mail/Rechnung an `buero` geroutet werden, aber nur wenn dort mindestens ein aktiver berechtigter Login existiert. Wesentlicher Nachteil: ohne Büro-Login erhält der Meister mehr Einträge. Kleine Alternative: neue Rolle „Eingang“, die vor Go-live besetzt werden muss. **Entscheidung erbeten:** Fallback `meister` bestätigen?

**O-03 – Grenze der Automatik**
Empfehlung: automatische Zuordnung nur mit eindeutiger starker Referenz; OCR-Konfidenz und bekannte Absenderadresse allein erzeugen höchstens „Vorschlag prüfen“. Wesentlicher Nachteil: anfangs mehr manuelle Bestätigungen. Kleine Alternative: konfigurierbarer Schwellenwert, der aber Fehlzuordnungen riskiert. **Entscheidung erbeten:** konservative Regel bestätigen?

**O-04 – Übersetzungsanbieter**
Empfehlung: Azure AI Translator in der vorhandenen EU-Azure-Umgebung, mit Original immer daneben und ohne automatisches Handeln. Wesentlicher Nachteil: zusätzlicher Dienst, Vertrag und laufende Kosten. Kleine Alternative: Übersetzung zunächst nur manuell; dann ist der verbindliche Worst Case nicht durchgängig in der App gelöst. **Entscheidung erbeten:** Azure Translator für Stufe 1 freigeben?

**O-05 – Eskalationsfristen**
Empfehlung: allgemein nach 24 Stunden; beschädigtes Paket sofort; blockierender Speicher-/Abruffehler sofort in Wartung und nach 2 Stunden zusätzlich auf „Der Tag“. Wesentlicher Nachteil: mehr rote Einträge bei längerer Providerstörung. Kleine Alternative: nur die 24-Stunden-Regel, wodurch akute Schäden/Fehler zu spät sichtbar werden. **Entscheidung erbeten:** diese drei Fristen bestätigen?

**O-06 – Mindestbilder je Paket/Teilegruppe**
Empfehlung: im Normalfall genau eine Paketübersicht und ein aussagekräftiges Bild je Teilegruppe; ein zusätzliches Einzelteil-/Schadensbild nur bei Abweichung, unklarer Menge, besonderem Wert oder sichtbarem Schaden. Wesentlicher Nachteil: Bei großen gemischten Paketen entstehen mehrere Fotos. Kleine Alternative: nur ein Paketfoto, das für Zustand und spätere Zuordnung häufig zu wenig belegt. **Entscheidung erbeten:** diese Mindestregel bestätigen?

**O-07 – Fester Zahlungslauf für offene Eingangsrechnungen**
Empfehlung: eine betriebsweit konfigurierbare Wochenzeit, initial Freitag 09:00; eine vor diesem Zeitpunkt fällige Rechnung erscheint zusätzlich sofort als dringend auf „Der Tag“. Wesentlicher Nachteil: Feiertage und Abwesenheit benötigen eine sichtbare Vertretung/Terminverschiebung. Kleine Alternative: jede Rechnung nur nach individueller Fälligkeit anzeigen, wodurch der gewünschte gemeinsame Zahllauf verloren geht. **Entscheidung erbeten:** Freitag 09:00 als initialen Zahlungslauf bestätigen?

### Übergaben, keine Owner-Fragen

- B1 konkretisiert Fotos, Schadenscheckliste, KV-/Sendungstreffer und den ≤10-Klick-Weg, ohne Status oder Datenbegriffe zu ändern.
- B2 konkretisiert Postfach, Abrufintervall, Antwort-/Thread-Erkennung und XML-Anhangsregeln auf diesem Vertrag.
- B3 konkretisiert Dokumentarten, OCR-Felder, Qualitätsprüfung und Kosten-/Seitengrenzen.
- B4 konkretisiert XRechnung/ZUGFeRD-Prüffelder und Lieferantenprüfung; Buchung bleibt später.
- B5 konkretisiert Telefonnotiz und Folgeaktionen; keine Gesprächsaufzeichnung in Stufe 1.
- C definiert Rückfrage, Eingangsbestätigung, KV-/Auftragskorrespondenz und Ausgang. A übergibt nur Eingang-ID, Anliegen-ID, Ziel und gewünschte Folgeaktion.
- Endversion-Chat muss die Skizze, Tabellenverträge, vier Status, Rechte, Abnahmefälle und die Auflösung der F1-Baureife in Spec/BAUPLAN übernehmen; erst dort wird die Optik verbindlich.

Mit den vier unveränderten Arbeitsstatus, getrennten Dringlichkeitsfarben, genau einem Verantwortungsprinzip, dem Anliegen-Unterobjekt, unveränderten Originalen und append-only Verlauf können B1 und B2 unabhängig und parallel detaillieren. Der Paketweg verwendet dieselben Begriffe: Etikettfoto erzeugt einen Eingang, die Trefferart ist abgeleitet, Teilegruppen sind nur die Erfassungsansicht und erst der bestätigte bestehende Schreibweg erzeugt Kunde/KV/Auftrag. Die offenen Owner-Punkte ändern keine Begriffswelt; O-06 bestimmt nur die Anzahl der Pflichtbilder.
