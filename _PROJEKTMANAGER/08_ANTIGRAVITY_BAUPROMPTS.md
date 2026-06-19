# 08 — ANTIGRAVITY-BAUPROMPTS
## Kreile WerkstattCockpit

**Hinweis zur Nutzung:** Jeder Prompt ist einzeln, vollständig und copy-paste-fähig für Antigravity (PowerShell-Terminal, Projektpfad `C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app`). Reihenfolge ist verbindlich — Prompt N+1 erst starten, wenn Prompt N die Prüfphase fehlerfrei durchlaufen hat und Siglinder den Stand committet. Antigravity committet nie selbst.

Jeder Prompt folgt dem Schema: Ziel · Scope · Nicht-Scope · betroffene Verträge/Dateien · Arbeitsschritte · STOPP-Bedingungen · Definition of Done · Prüfphase.

---

## PRÜFPHASE-BLOCK (in jedem Prompt unten enthalten — Pflichtbestandteil)

```text
PRÜFPHASE (vor jeder Fertigmeldung vollständig und fehlerfrei durchlaufen):
P1: npx tsc --noEmit
P2: npm run lint
P3: npm run build
P4: git diff --stat
P5: git status --short

Zusätzlich für dieses Arbeitspaket:
- DB-Query mit erwartetem Ergebnis ausführen und Output zeigen
- API- oder Servernachweis (Request/Response oder Server-Log)
- UI-Nachweis (Screenshot oder Beschreibung des sichtbaren Zustands)
- Reload-Nachweis (Seite neu laden, Daten bleiben korrekt)
- Jedes Akzeptanzkriterium einzeln mit Datei und Nachweis auflisten

Nicht als "fertig" melden, bevor alle Punkte fehlerfrei und belegt sind.
Keine Mockdaten, kein Math.random, keine erfundenen Kennzahlen im Produktionspfad.
Keine Löschung ohne vorherige Bestätigung durch Siglinder.
```

---

## BAUPROMPT 00 — Sicherung und Wahrheit (Phase 0, AP P0-01 bis P0-05)

```text
ZIEL
Projektzustand vor jeder inhaltlichen Änderung sichern und verifizieren.

SCOPE
- Git-Status und Branch prüfen
- .env.local gegen Soll-Liste prüfen
- Supabase-Migrationsstand verifizieren (remote, nicht nur lokale Dateien)
- Sicherungs-Tag setzen

NICHT-SCOPE
- Keine Code-Änderungen in diesem Prompt
- Keine Migration ausführen

ARBEITSSCHRITTE
1. Führe aus: git status --short
   Liste alle uncommitteten Dateien auf. Committe NICHTS automatisch — nur auflisten.
2. Führe aus: git branch --show-current
3. Prüfe .env.local auf Vorhandensein folgender Variablen und liste den Status jeder einzeln:
   GEMINI_API_KEY, DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, APP_SESSION_SECRET,
   NEXT_PUBLIC_GOOGLE_PLACES_API_KEY, SUPABASE_URL (server-seitig, vermutlich FEHLEND),
   RESEND_API_KEY (vermutlich FEHLEND), KLIPPA_API_KEY (vermutlich FEHLEND, ist ok)
4. Führe aus: npx supabase login (falls nicht bereits eingeloggt)
5. Führe aus: npx supabase link --project-ref <PROJECT_REF>
6. Führe aus: npx supabase db push --dry-run (oder Äquivalent) um zu prüfen ob lokale
   Migrationsdateien mit Remote-Stand übereinstimmen. Melde jede Abweichung.
7. Erstelle KEINEN Commit. Berichte stattdessen den vollständigen Ist-Zustand an Siglinder
   zur manuellen Freigabe.

STOPP-BEDINGUNGEN
- Bei jeder Abweichung zwischen lokalem und Remote-Migrationsstand: STOPP, an Siglinder melden.
- Bei fehlenden kritischen Env-Vars (DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL): STOPP.

DEFINITION OF DONE
- Vollständiger Statusbericht zu allen 7 Arbeitsschritten liegt vor.
- Keine Datei wurde verändert oder committet.

PRÜFPHASE
[siehe PRÜFPHASE-BLOCK oben — P1-P5 plus: Statusbericht vollständig, keine Änderung am Code]
```

---

## BAUPROMPT 01 — OCR-URL-Platzhalter ersetzen (Phase 1, AP P1-01)

```text
ZIEL
Den Literal-Platzhalter "https://YOUR_SUPABASE_URL/..." in der OCR-Route durch die echte
Supabase-Storage-URL ersetzen, sodass Bild-URLs tatsächlich auflösbar sind.

SCOPE
- Datei: src/app/api/ocr-process/route.ts

NICHT-SCOPE
- Kein Wechsel des OCR-Providers in diesem Prompt (folgt in Bauprompt 02)
- Keine Änderung an anderen Routen

BETROFFENE VERTRÄGE
- Datenvertrag: belege-Tabelle (unverändert)
- Datenquelle: Supabase Storage Bucket "belege"

ARBEITSSCHRITTE
1. Öffne src/app/api/ocr-process/route.ts
2. Finde die Zeile mit dem Literal-Platzhalter:
   const imageUrl = `https://YOUR_SUPABASE_URL/storage/v1/object/public/belege/${storagePath}`
3. Ersetze durch:
   const imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/belege/${storagePath}`
4. Prüfe, ob NEXT_PUBLIC_SUPABASE_URL zur Build-Zeit in diesem Server-Kontext verfügbar ist.
   Falls die Route als Server-Route läuft und NEXT_PUBLIC_-Variablen dort nicht zuverlässig
   verfügbar sind, nutze stattdessen eine server-seitige SUPABASE_URL-Variable (separat in
   .env.local zu ergänzen, siehe Bauprompt 00 Schritt 3) und falle nur dann auf
   NEXT_PUBLIC_SUPABASE_URL zurück, wenn die server-seitige Variable fehlt.
5. Teste mit einem realen Storage-Pfad, ob die resultierende URL einen Beleg tatsächlich auflöst
   (HTTP-Request, kein DNS-Fehler).

STOPP-BEDINGUNGEN
- Falls weder NEXT_PUBLIC_SUPABASE_URL noch SUPABASE_URL gesetzt sind: STOPP, an Siglinder melden.

DEFINITION OF DONE
- imageUrl löst einen tatsächlichen Storage-Pfad auf (per Test-Request nachgewiesen).
- Kein Literal-Platzhalter mehr im Code.

PRÜFPHASE
[siehe PRÜFPHASE-BLOCK oben]
Zusätzlich: HTTP-Request gegen die generierte URL zeigen, Status 200 oder klar erklärter
Fehlercode (z.B. 404 wenn Testdatei nicht existiert, aber NICHT DNS-Fehler).
```

---

## BAUPROMPT 02 — GeminiProvider als primären OCR-Provider aktivieren (Phase 1, AP P1-02)

```text
ZIEL
Beleg-OCR funktionsfähig machen, indem GeminiProvider (API-Key bereits vorhanden) als
primärer Provider genutzt wird, statt auf den nicht-funktionalen ManualProvider-Stub
zurückzufallen. Klippa wird laut Entscheidung E-01 vorerst NICHT integriert (kein API-Key,
keine Kosten ohne Nutzen für MVP).

SCOPE
- Datei: src/app/api/ocr-process/route.ts
- Datei: src/lib/ocr/geminiOcr.ts (oder Äquivalent, falls Pfad abweicht — vorher prüfen)

NICHT-SCOPE
- Keine Klippa-Integration
- Keine Änderung der DB-Schreiblogik für belege-Tabelle in diesem Prompt

BETROFFENE VERTRÄGE
- belege-Tabelle (Lesevertrag unverändert, Schreibvertrag: echte statt Dummy-Daten)

ARBEITSSCHRITTE
1. Prüfe den bestehenden geminiOcr-Client (bereits für Scan-to-Order und Telefonnotizen
   produktiv genutzt laut Projektarchäologie — wiederverwenden, nicht neu bauen).
2. In src/app/api/ocr-process/route.ts: Provider-Auswahl so anpassen, dass bei fehlendem
   KLIPPA_API_KEY automatisch GeminiProvider genutzt wird (nicht ManualProvider-Stub).
3. Definiere ein striktes JSON-Schema für die erwartete Extraktion (Betrag, Datum, Lieferant,
   Belegnummer, MwSt-Satz) und erzwinge strukturierte Ausgabe.
4. Bei Extraktion mit niedriger Plausibilität (z.B. fehlender Betrag): Beleg als
   "manuell zu prüfen" markieren statt stillschweigend Dummy-Werte zu speichern.
5. Schreibe das tatsächliche Extraktionsergebnis in die belege-Tabelle — keine Dummy-Daten.

STOPP-BEDINGUNGEN
- Falls GEMINI_API_KEY nicht gesetzt ist: STOPP (sollte laut .env.local-Prüfung vorhanden sein).
- Bei Unsicherheit über das Belegformat: lieber "manuell zu prüfen" markieren als raten.

DEFINITION OF DONE
- Ein echter Testbeleg (PDF oder Foto) wird hochgeladen und liefert ein plausibles,
  in der DB gespeichertes Ergebnis — kein Dummy-Wert.
- Bei einem absichtlich unklaren Testbeleg wird "manuell zu prüfen" korrekt gesetzt.

PRÜFPHASE
[siehe PRÜFPHASE-BLOCK oben]
Zusätzlich: Zwei Testläufe zeigen (1 klarer Beleg, 1 unklarer Beleg), jeweils mit
DB-Query-Ergebnis als Nachweis.
```

---

## BAUPROMPT 03 — Scan→Auftrag: echten DB-Write einbauen (Phase 1, AP P1-03)

```text
ZIEL
handleConfirm() im Scan-Flow erstellt tatsächlich einen Auftrag in der Datenbank, statt
nur console.log() auszuführen und eine falsche Erfolgsmeldung zu zeigen.

SCOPE
- Datei: src/app/scan/page.tsx
- Neue Server Action: createOrderFromScan() (Pfad gemäß bestehendem actions-Verzeichnis,
  z.B. src/app/actions/orders.actions.ts erweitern oder eigene Datei)

NICHT-SCOPE
- Keine Änderung an der OCR-Erkennung selbst (geminiOcr bleibt wie es ist, funktioniert laut
  Archäologie bereits)
- Keine Änderung an anderen Intake-Flows (Telefon, Walk-In, E-Mail-Import — separate
  Arbeitspakete, nicht Teil dieses Prompts)

BETROFFENE VERTRÄGE
- orders-Tabelle (neuer Schreibpfad)
- Mindestfelder gemäß Audit-Korrekturplan: customer_id (oder customer_name als Fallback bei
  neuem Kunden), description, tenant_id = "galvanik-kreile", source = "scan"

ARBEITSSCHRITTE
1. Lokalisiere handleConfirm() in src/app/scan/page.tsx.
2. Entferne den console.log()-Stub.
3. Implementiere createOrderFromScan(scanData) als Server Action:
   - Validiere Pflichtfelder (Kunde erkannt oder manuell nachgetragen, Teilebeschreibung)
   - Falls Kunde nicht in DB gefunden: biete Anlage eines neuen Kunden an (nicht automatisch
     anlegen ohne Bestätigung)
   - Schreibe Order mit tenant_id = "galvanik-kreile", source = "scan"
   - Erzeuge zugehöriges StatusEvent (ORDER_CREATED)
4. UI zeigt Erfolgsmeldung ERST nach bestätigtem DB-Schreibvorgang (await auf Server Action
   Response, nicht optimistisches UI).
5. Bei Fehler: zeige echten Fehlerzustand, keine falsche Erfolgsmeldung.

STOPP-BEDINGUNGEN
- Falls Kundenerkennung mehrdeutig ist (mehrere Treffer): UI muss Auswahl anbieten, nicht
  automatisch den ersten Treffer nehmen.

DEFINITION OF DONE
- Ein realer Scan-Testlauf erzeugt nachweislich einen neuen Datensatz in der orders-Tabelle.
- Die UI zeigt den neuen Auftrag nach Reload in der Auftragsliste.
- Fehlerfall (z.B. fehlende Pflichtfelder) zeigt einen ehrlichen Fehlerzustand.

PRÜFPHASE
[siehe PRÜFPHASE-BLOCK oben]
Zusätzlich:
- DB-Query vor und nach dem Scan-Test zeigen (Zeilenanzahl orders-Tabelle steigt um 1)
- Reload der Auftragsliste zeigt den neuen Auftrag
- Akzeptanzkriterium "Erfolgsmeldung nur nach DB-Bestätigung" einzeln mit Code-Stelle belegen
```

---

## BAUPROMPT 04 — Auth-Feedback einbauen (Phase 1, AP P1-04)

```text
ZIEL
Bei abgelaufener oder fehlender Session zeigt die App einen sichtbaren Hinweis statt einer
leeren Liste ohne Erklärung. Dies ist der wichtigste Einzelfix für die Nutzerakzeptanz
(siehe Nutzersimulation: häufigster App-Abbruchgrund).

SCOPE
- Alle Server Actions, die checkAppAuth() nutzen (orders.actions.ts, customers.actions.ts,
  und alle weiteren mit demselben Muster)
- Neue Komponente: SessionWarningBanner (oder Redirect-Logik in KreileAppShell.tsx)

NICHT-SCOPE
- Keine Änderung der Auth-Mechanik selbst (HMAC-Cookie-Logik bleibt unverändert — das ist
  Phase-7-Thema, A-01)

BETROFFENE VERTRÄGE
- Kein neuer Datenvertrag, nur UI-Zustand bei UNAUTHORIZED

ARBEITSSCHRITTE
1. Identifiziere alle Stellen, an denen checkAppAuth() → UNAUTHORIZED → return [] führt.
2. Entscheide pro Seitentyp:
   - Seiten mit Server-Komponenten: Redirect zu /start?reason=session_expired
   - Seiten mit Client-State: persistenter SessionWarningBanner in KreileAppShell.tsx mit
     Text "Sitzung abgelaufen – bitte erneut einloggen" und Link zu /start
3. Implementiere SessionWarningBanner als wiederverwendbare Komponente (nicht pro Seite neu).
4. Stelle sicher, dass nach erneutem Login die ursprünglich angeforderte Seite wieder
   angezeigt wird (kein Datenverlust am Übergang).

STOPP-BEDINGUNGEN
- Keine automatische Wiederholung von Login-Versuchen ohne Nutzerinteraktion.

DEFINITION OF DONE
- Test mit absichtlich abgelaufenem Cookie zeigt sichtbaren Hinweis statt leerer Liste,
  auf mindestens: /orders, /customers, /, /station/[slug]
- Redirect oder Banner funktioniert konsistent auf allen geprüften Seiten.

PRÜFPHASE
[siehe PRÜFPHASE-BLOCK oben]
Zusätzlich: Screenshot oder Beschreibung des Banners/Redirects bei simuliertem
Session-Ablauf auf mindestens 3 verschiedenen Seitentypen.
```

---

## BAUPROMPT 05 — Tenant-Filter in Kundenabfrage (Phase 1, AP P1-05)

```text
ZIEL
customers.actions.ts filtert ausschließlich nach tenant_id = "galvanik-kreile" und schließt
Seed-/Test-/Demo-Daten aus. Aktuell werden Kundendaten aller Mandanten zurückgegeben
(kritischer Datenschutzbefund, auch wenn aktuell Single-Tenant-Betrieb).

SCOPE
- Datei: src/app/actions/customers.actions.ts (oder Äquivalent)

NICHT-SCOPE
- Keine Änderung an anderen *.actions.ts-Dateien in diesem Prompt (orders.actions.ts hat
  vermutlich bereits einen Tenant-Filter laut Audit — falls nicht, separat melden)

ARBEITSSCHRITTE
1. Öffne customers.actions.ts.
2. Ergänze die Query um:
   .where(and(
     eq(customers.tenantId, "galvanik-kreile"),
     sql`coalesce(${customers.source}, '') not in ('seed', 'test', 'demo', 'integration-test')`
   ))
3. Prüfe alle weiteren Stellen in derselben Datei, die customers ohne Tenant-Filter lesen.

DEFINITION OF DONE
- Query gibt ausschließlich Kunden mit tenant_id = "galvanik-kreile" zurück.
- Seed-/Test-Daten erscheinen nicht in der Kundenliste.

PRÜFPHASE
[siehe PRÜFPHASE-BLOCK oben]
Zusätzlich: DB-Query-Vergleich vorher/nachher (Zeilenanzahl mit und ohne Filter), zeigt
korrekte Reduktion auf reale Mandanten-Kunden.
```

---

## BAUPROMPT 06 — Fake-Fallback-Werte entfernen (Phase 1, AP P1-06)

```text
ZIEL
Home-Dashboard zeigt ausschließlich echte Daten. Keine erfundenen Zähler-Fallbacks, keine
hartkodierten Demo-Inhalte (Mitarbeiternotizen, Stressphasen).

SCOPE
- Datei: src/app/page.tsx

ARBEITSSCHRITTE
1. Finde: orders.length > 0 ? orders.length : 84
   Ersetze durch: orders.length (kombiniert mit korrektem Empty-State, siehe Schritt 3)
2. Finde und entferne den Fallback "|| 3" bei der kritischen-Aufträge-Zahl analog.
3. Implementiere für den Fall orders.length === 0 && !loading einen echten Leer-Zustand
   ("Noch keine Aufträge erfasst") statt einer erfundenen Zahl.
4. Entferne hartkodierte Demo-Blöcke (z.B. "Stressphasen", "Urlaub M. Müller", "S. Schmidt").
   Falls eine echte Kalender-/HR-Integration später gewünscht ist: Block vollständig entfernen,
   nicht durch Platzhaltertext ersetzen.
5. Falls ein Feedback-Formular mit "(Demo-Modus)"-Hinweis existiert: entweder an echten
   Endpunkt anschließen oder vollständig entfernen — keine Demo-Beschriftung im
   Produktionspfad stehen lassen.
6. Entferne nicht-funktionale Dauer-Animationen ohne Zustandsbezug (hm-gradShift, hm-pulse).
   Card-pulse bleibt nur bei tatsächlich kritischen Aufträgen (risk=red), maximal 3 Zyklen.

DEFINITION OF DONE
- Startseite zeigt exakt die Daten aus der DB, keine Fallback-Zahlen.
- Keine hartkodierten Personennamen oder Fake-Termine mehr sichtbar.
- Leer-Zustand ist ehrlich beschriftet statt eine Zahl zu erfinden.

PRÜFPHASE
[siehe PRÜFPHASE-BLOCK oben]
Zusätzlich: Test mit leerer Test-DB (oder gefiltert auf 0 Aufträge) zeigt korrekten
Leer-Zustand, kein "84".
```

---

## BAUPROMPT 07 — RLS auf priorisierte Tabellen aktivieren (Phase 1, AP P1-08)

```text
ZIEL
Row Level Security für die fünf höchstpriorisierten ungeschützten Tabellen aktivieren:
events, communications, ausgangsrechnung_position, arbeitszeit_buchung, konto.
Die übrigen 25 Tabellen folgen in Phase 2 als separates Arbeitspaket.

SCOPE
- Supabase SQL Editor oder Migration für die 5 genannten Tabellen

NICHT-SCOPE
- Nicht alle 30 Tabellen in diesem Prompt (bewusst gestaffelt, um Risiko pro Schritt klein
  zu halten)

ARBEITSSCHRITTE
1. Für jede der 5 Tabellen: RLS aktivieren.
   ALTER TABLE <tabelle> ENABLE ROW LEVEL SECURITY;
2. Policy je Tabelle (Standard-Muster, anpassen falls Tabelle keine direkte tenant_id-Spalte
   hat — dann über Join-Policy oder zunächst restriktive Policy):
   CREATE POLICY tenant_isolation ON <tabelle>
     USING (tenant_id = current_setting('app.tenant_id', true));
3. Nach jeder Tabelle: Teste mit einer Test-Query, dass berechtigte Lesevorgänge weiterhin
   funktionieren und fremde Mandanten-Daten nicht sichtbar sind.
4. Führe NOTIFY pgrst, 'reload schema'; nach Abschluss aller Policies aus.

STOPP-BEDINGUNGEN
- Falls eine Tabelle keine tenant_id-Spalte besitzt: STOPP, an Siglinder melden statt
  eine falsche Policy zu raten.
- Bei jedem Hinweis, dass eine bestehende Funktion durch RLS blockiert wird: STOPP,
  nicht die Policy aufweichen ohne Rücksprache.

DEFINITION OF DONE
- Alle 5 Tabellen zeigen rowsecurity = true in pg_tables.
- Bestehende App-Funktionen (Events-Tracking, Kommunikation) funktionieren unverändert
  für den aktuellen Tenant.

PRÜFPHASE
[siehe PRÜFPHASE-BLOCK oben]
Zusätzlich: SQL-Query gegen information_schema/pg_tables zeigt rowsecurity=true für alle
5 Tabellen. Funktionstest pro Tabelle (ein Lese- und ein Schreibvorgang) erfolgreich.
```

---

## BAUPROMPT 08 — Tablet-Navigation Touch-Fix (Phase 1, AP P1-09)

```text
ZIEL
RightNav.tsx funktioniert auf Touch-Geräten (Tablet quer, das primäre Arbeitsgerät in der
Werkstatthalle). Aktuell ist die Sidebar-Expansion ausschließlich über onMouseEnter/Leave
gesteuert und auf Touch funktionslos.

SCOPE
- Datei: src/components/layout/RightNav.tsx

ARBEITSSCHRITTE
1. Ergänze einen Pinned-State:
   const [pinned, setPinned] = useState(false);
   const expanded = pinned || isHovered;
2. Füge einen permanenten Toggle-Button (Hamburger-Icon) oben in der Sidebar hinzu:
   onClick={() => setPinned(!pinned)}
3. Alternative/Ergänzung: Ab md-Breakpoint permanent 180px Breite mit sichtbaren Labels,
   damit auf Tablet keine Interaktion nötig ist, um Labels zu sehen.
4. Stelle sicher, dass die Lösung auch bei (pointer: coarse) Media Query funktioniert.
5. Ergänze aria-label={label} für alle Icons im kollabierten Zustand (Barrierefreiheit).

DEFINITION OF DONE
- Auf simuliertem Tablet-Viewport (1024px, Touch-Emulation) ist die Navigation vollständig
  bedienbar ohne Hover.
- Desktop-Verhalten bleibt unverändert gut nutzbar.

PRÜFPHASE
[siehe PRÜFPHASE-BLOCK oben]
Zusätzlich: Test auf 3 Viewport-Breiten (Desktop >1280px, Tablet quer 1024px,
Tablet hochkant 768px) mit Touch-Emulation, jeweils Navigationsfähigkeit nachgewiesen.
```

---

## BAUPROMPT 09 — TopWorkflowBar vollständige Stationen (Phase 1, AP P1-10)

```text
ZIEL
TopWorkflowBar zeigt alle 5 Stationen (Wareneingang, Entmetallisierung, Schleiferei,
Beschichtung/Galvanik, Warenausgang), nicht nur 3.

SCOPE
- Datei: src/components/.../TopWorkflowBar.tsx

ARBEITSSCHRITTE
1. Ergänze die fehlenden Einträge "Entmetallisierung" und "Schleiferei" zum
   STATIONS-Array, mit korrekten Links auf VALID_SLUGS
   ["wareneingang","entmetallisierung","schleiferei","beschichtung","warenausgang"].
2. Stelle sicher, dass "Galvanik" als Anzeigename für den Slug "beschichtung" verwendet wird
   (nicht "galvanik" als Slug selbst — das ist laut Audit ein ungültiger 404-Pfad).
3. Kompakte Darstellung für Tablet sicherstellen: Icons + kurze Labels, horizontal
   scrollbar auf Mobile falls nötig.

DEFINITION OF DONE
- Alle 5 Stationen sind über die TopWorkflowBar erreichbar, kein 404.
- Klick auf "Galvanik" führt zu /station/beschichtung, nicht /station/galvanik.

PRÜFPHASE
[siehe PRÜFPHASE-BLOCK oben]
Zusätzlich: Klicktest auf alle 5 Stationen, jeweils korrekte Seite ohne 404 nachgewiesen.
```

---

## Hinweis zu weiteren Bauprompts (Phase 2+)

Die Bauprompts für Phase 2 (Token-Konsolidierung, Feature-Flags, KI-Adapter-Konsolidierung), Phase 3 (Tages-Fokus-Block, Auto-Draft, 1-Klick-Statuswechsel), Phase 4 (Kalkulationsmodul, Mollie) und folgende werden nach demselben Schema erzeugt, sobald Phase 1 vollständig verifiziert und committet ist. Sie werden nicht vorab erzeugt, um zu verhindern, dass auf einem unverifizierten Zwischenstand aufgebaut wird (Prinzip: keine Phase beginnt ohne nachgewiesene Voraussetzung, siehe Dok. 07 Abschnitt 3).

**Nächster Schritt nach Abschluss dieser 10 Prompts:** Rückmeldung an dieses Projektmanagement mit Prüfphasen-Nachweisen je Arbeitspaket. Daraufhin werden die Bauprompts für Phase 2 erzeugt.
