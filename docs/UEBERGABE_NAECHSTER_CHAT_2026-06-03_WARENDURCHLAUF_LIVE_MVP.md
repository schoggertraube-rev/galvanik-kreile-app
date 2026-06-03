# Kreile WerkstattCockpit — Übergabe nächster Chat

## 1. Kurzstand

* Live-MVP ist deployed.
* Warendurchlauf wurde neu strukturiert.
* Telefonnotiz wurde verbessert und deployed, bleibt aber fachlich nicht final.
* Seed/Cleanup-Skripte wurden erstellt und gepusht, aber nicht ausgeführt.
* Adaptive Warendurchlauf-Icons wurden deployed.
* Sicherheits-Tags vorhanden:
  * `checkpoint-2026-06-03-live-mvp-workflow-phone-notes-deployed`
  * `checkpoint-2026-06-03-adaptive-icons-deployed`

## 2. Wichtige Commits und Tags

Auflisten:

* `c61b4b8 feat(live-mvp): stabilize workflow and phone notes`
* `eab1c46 fix(phone-notes): improve workflow and context matching`
* `ae4dee2 docs(live): record deployed MVP state`
* `b9a67a0 feat(demo): add safe seed and cleanup scripts`
* `c36a5e6 fix(lint): clean current warnings`
* `2bd18e6 feat(workflow): add adaptive station icons`
* Tag:
  `checkpoint-2026-06-03-live-mvp-workflow-phone-notes-deployed` (Vorhanden)
* Tag:
  `checkpoint-2026-06-03-adaptive-icons-deployed` (Vorhanden)

## 3. Production-Stand

* Live-Alias:
  `https://galvanik-kreile-werkstatt.vercel.app`
* letzte gemeldete Production URL:
  `https://galvanik-kreile-werkstatt-8q5oncpmo.vercel.app`
* Geprüfte Routen:

  * `/`
  * `/warendurchlauf`
  * `/warendurchlauf/wareneingang`
  * `/warendurchlauf/galvanik`
  * `/warendurchlauf/warenausgang`
  * `/kommunikation`
  * `/performance`
  * `/finanzen`
  * `/customers`
  * `/orders`
  * `/admin/devices`

## 4. Was wurde in diesem Chat geschafft

### Warendurchlauf

* `/warendurchlauf` als eigener Bereich mit internem Warenfluss-Untermenü.
* Drei Bildicons:

  * Wareneingang
  * Galvanik
  * Warenausgang
* Icons bleiben innerhalb des Warendurchlaufs oben sichtbar/sticky.
* Aktives Icon:

  * grüner Ring
  * zusätzlich größer
* Keine alten generischen Lucide-Haupticons mehr im Warenfluss.
* `/warendurchlauf/neu` enthält weiterhin den Intake-Wizard.
* Galvanik-/Warenausgang-Unterseiten vorhanden.
* Galvanik Wetter-/Tageszeit-Assets wurden integriert:

  * morning/noon/evening
  * normal/rain
* Fallback-Resolver gebaut.
* Rote echte Warnpunkte können dezent pulsieren.

### Telefonnotiz

* Telefonnotiz speichert über Server Action in `phone_notes`.
* Drizzle-Schema wurde ergänzt.
* Mock-FK-Schutz eingebaut.
* gespeicherte Telefonnotizen in Kommunikation anklickbar.
* Detailansicht für Telefonnotizen erstellt.
* SmartMatcher angelegt:

  * Name
  * Material
  * Beschichtung
  * Stichwort
  * Logistik/Zahlung
* Antwortvorschlag verbessert.
* Logistik-/Zahlungs-Kontext als Overlay angelegt.
* Kunden-/Auftragsakte enthält aktuell nur vorbereitete Hinweisblöcke, keine echte Liste.

### Fake-Button-Bereinigung

* Kalenderbutton entschärft/vorbereitet.
* Mikrofon-Icon nicht als echte Aufnahme verkaufen.
* Payment/DATEV/Lexware/Import/Export ehrlicher beschriftet.
* keine Fake-Zahlung behaupten.

### Seed/Cleanup

* Scripts erstellt:

  * `scripts/seed-demo-data.ts`
  * `scripts/cleanup-demo-data.ts`
* Dry-Run ist Standard.
* `--confirm` für echte Schreib-/Löschvorgänge.
* Demo-Markierung:

  * `DEMO-%`
  * `demo-galvanik-kreile`
  * Batch-ID `demo-livegang-2026-06-03`
* package.json Scripts:

  * `demo:seed`
  * `demo:cleanup`
  * `demo:reset`
* WICHTIG:

  * Seed/Cleanup wurden NICHT auf Production ausgeführt.

## 5. Was offen geblieben ist

### Telefonnotiz — hoher späterer Feinschliff

* Erkennung ist noch zu schwach.
* Antwortvorschlag noch nicht ausreichend intelligent.
* Nutzer sah live keine ausreichende Verbesserung.
* Muss später besser finden über:

  * Kundenname
  * Firma
  * Material
  * Beschichtung
  * Auftragsstatus
  * Warenausgang
  * Zahlung
  * Reklamation
  * Abholung
  * Versand
* Live DB-Insert/Read sollte noch einmal sauber mit manuellem Testdatensatz geprüft werden.
* Kunden-/Auftragsakte muss echte Telefonnotizen anzeigen, nicht nur vorbereitete Hinweisblöcke.
* Telefonnotiz muss später vollständig als Arbeitsobjekt in Kunden- und Auftragsakte erscheinen.

### Kommunikationszentrale

* Nutzer bezeichnet Kommunikationszentrale weiter als schwach.
* Redesign später:

  * mehr Messenger/WhatsApp-artig
  * klare Schritte
  * wo beantworten
  * wo ablegen
  * wo Kunde/Auftrag zuordnen
  * wo Datei/Link einfügen
* E-Mail/WhatsApp/Instagram/Website sind weiterhin keine echten Integrationen.

### Warendurchlauf

* Grundstruktur steht.
* Noch offen:

  * finaler Konsistenzcheck aller Links/Routen/Buttons
  * Wareneingang-Volumenicons fehlen noch als echte Assets/Logik
  * Warenausgang Wetter-/Zeitvarianten fehlen noch
  * echte Wetterdaten fehlen
  * historische adaptive Volumenschwellen fehlen
  * Galvanik-Inhalt fachlich später vertiefen
  * Warenausgang real mit fertigen Aufträgen, Zahlung, Versand, Abholung verbinden

### Kalenderbutton

* Kalenderbutton oben rechts bleibt vorbereitet/inaktiv.
* Später soll er zentrale Datums-/Ereignis-Drehscheibe werden:

  * alle Appfunktionen dürfen Daten liefern, wenn Developer/Admin freigibt
  * Google Kalender später
  * Abwesenheiten/Urlaub später

### Seed/Cleanup

* Scripts sind vorhanden und gepusht.
* Noch nicht gegen Production ausgeführt.
* Vor Verkauf/Präsentation:

  * Demo-Daten bewusst seed-en
  * Cleanup testen
  * keine echten Daten kontaminieren
* Nicht im Drizzle-Schema enthalten und daher nicht geseedet:

  * `business_kvp_items`
  * `feedback_notes`
  * `cost_positions`
  * `invoices`
  * `payments`

### Performance und Datenrealität

* Performance enthält weiter viel Demo/Fallback.
* echte Aggregation aus Orders/Events/Bädern/Reklamationen fehlt.
* Appnutzungsanalyse soll später echten Mehrwert liefern:

  * Klickpfade
  * Abbrüche
  * Suchbegriffe ohne Treffer
  * Geräte/Browser
  * Verbesserungsvorschläge

### Geräte/Lizenzen/Sicherheit

* Admin Devices bleibt teilweise UI/Vorbereitung.
* Harte Gerätesperre fehlt.
* Lizenzprüfung fehlt.
* Mandantenfähigkeit langfristig offen.
* Keine Datenvermischung bei späteren Kunden.

### Finanzen/Payment/Export

* Payment Provider nicht angebunden.
* Tap to Pay nicht echt.
* QR/Zahlungslink nicht produktiv.
* DATEV/Lexware/Steuerberater-Export nicht produktiv.
* Finanzen/Kosten teilweise UI/Demo.

### Betriebs-KVP und Feedback

* Betriebs-KVP/Feedback-Persistenz noch nicht final produktiv geprüft.
* Falls Tabellen nicht im Drizzle-Schema: noch offen.
* Chef-Auswertung später.

### Buchhaltung

* `buchhaltung/` bleibt bewusst unberührt und untracked.
* Nicht anfassen, bis ausdrücklich „Buchhaltung jetzt“ gesagt wird.

## 6. Nächste empfohlene Reihenfolge

1. Live-Konsistenzprüfung:

   * alle Routen
   * alle Buttons
   * keine toten Links
   * keine Fake-Funktionen
2. Telefonnotiz Feinschliff separat:

   * bessere Erkennung
   * echte Aktenintegration
   * DB-Read beweisen
3. Warendurchlauf fachlich finalisieren:

   * Warenausgang echte Funktionen
   * Galvanik-Inhalt
   * Volumenicons
4. Seed/Cleanup bewusst auf Test-/Demo-Daten anwenden.
5. Kalenderbutton-Konzept.
6. Kommunikationszentrale redesignen.
7. Performance echte Datenaggregation.
8. Geräte/Lizenzen/Mandantenfähigkeit.
9. Buchhaltung erst später separat.

## 7. Nicht vergessen

* Nicht behaupten, was nur Demo/Fallback ist.
* Keine Fake-Buttons.
* Keine neuen Features ohne Build/Test.
* Kein Deploy ohne expliziten Production-Deploy und Live-Routenprüfung.
* Bei DB-Änderungen immer Migrationsprozess beachten:

  * Migration lokal
  * idempotent
  * remote Supabase ausführen
  * Schema prüfen
  * App testen
  * build/test
  * commit/push/deploy
