# Kreile WerkstattCockpit — Abschlussplan bis Demo-fertig

> **Status: VERBINDLICH. Diese Datei hat Vorrang vor 00–07 und ergänzt 08.**
> **Ziel: Aus dem aktuellen 30–35 %-Stand einen demo-fähigen Zustand machen.**
> **Ablage:** `docs/antigravity/kreile-workshop-app/09_ABSCHLUSSPLAN_DEMO_KREILE.md`
> **Antigravity liest in dieser Reihenfolge:** 09 (diese Datei) → 08 → 00 → … Bei Konflikt zählt 09.

---

## 0. Definition „Abschluss"

| Ziel | Inhalt |
|---|---|
| **Abschluss = Demo-fertig** | App ist intern vorführbar. Alle Links führen irgendwohin. Keine toten Buttons. Mockdaten reichen für 10-Minuten-Walkthrough. |
| **Nicht-Ziel jetzt** | Supabase, Google Vision OCR, `getUserMedia`-Kamera, RLS, Tests, TanStack Query, Drizzle |
| **V2 (separat geplant)** | Supabase-Migration + echte OCR + Auth-Rollen — siehe §6 der Datei 08, hier nicht ausgeführt |

Der Sprung auf Supabase wird bewusst **nicht** mit dem Demo-Abschluss vermischt. Er bekommt eine eigene Phase mit eigenem Risiko-Budget. Aktueller Stand-Bruch wäre zu teuer.

---

## 1. Was demo-fertig konkret heißt

Akzeptanzliste, an der Antigravity sich messen lässt:

1. Kein Klick führt auf 404.
2. Jeder sichtbare Button hat entweder Funktion **oder** ist `disabled` mit `title`-Tooltip.
3. Vollständiger Walkthrough möglich: Login → Leitstand → Wareneingang → Auftrag erzeugen → Auftragsdetail → Station starten → Verbrauch buchen → Etikett drucken → Kundenprofil öffnen → Performance ansehen.
4. Mockdaten ≥ 12 Kunden, ≥ 25 Aufträge, ≥ 30 StatusEvents, ≥ 4 Bäder mit Messungen, ≥ 10 Lagerartikel mit Bewegungen.
5. Heute-Button im Topbar ist Link zur Startseite.
6. Stationsseiten zeigen vorgefilterte Auftragslisten.
7. `eventType` im Repository ist Union-Type, keine Strings.
8. Echter QR-Code auf Etikett (scannbar mit Handy-Kamera).
9. Priorität wird tatsächlich aus `dueDate` berechnet, nicht hartkodiert.
10. Kundenprofil zeigt mindestens: Header, Preisabsprachen, Zeitstrahl, Reklamations-Panel (auch wenn leer), ähnliche Aufträge (auch wenn 0).
11. TypeScript 0 Fehler, ESLint 0 Errors, 0 Warnings.
12. Lighthouse Mobile ≥ 80 / ≥ 90 Accessibility (nicht ≥ 90 / ≥ 95 — das kommt erst mit Supabase-Stabilisierung).

---

## 2. Drei Antigravity-Sessions bis Demo-fertig

Jede Session ist so geschnitten, dass sie in einem Antigravity-Lauf abgearbeitet werden kann, ohne Token-Limit zu sprengen.

### Session 1 — Routen-Stabilisierung (geschätzt 1–2 h)

**Ziel:** Keine 404-Seite mehr. App fühlt sich vollständig an.

**Sicherheitsregel:** `git status` zeigen, Branch `feat/session-1-routen-stabil` erstellen, vor jedem Commit Diff prüfen.

**Aufgaben:**

1. `src/app/today/page.tsx` erstellen — entweder als `redirect("/")` oder als eigenständige Tageskarte. **Empfehlung:** eigene Seite mit gleicher Logik wie `/` (Dashboard), zusätzlich gefiltert auf „heute geplante / fällige Aufträge".
2. `src/app/settings/page.tsx` — Platzhalter-Seite mit 3 Abschnitten: „Mein Profil", „Benachrichtigungen", „Werkstattdaten". Jedes Feld `disabled`, oben Hinweis-Banner: *„Einstellungen sind in Vorbereitung. Inhalte werden mit der Datenbank-Anbindung freigeschaltet."*
3. `src/app/archive/page.tsx` — Platzhalter mit Liste abgeschlossener Aufträge aus Mockdaten (Status `closed`). Reine Lese-Liste.
4. `src/app/station/[slug]/page.tsx` — generische Stationsseite:
   - Slug-Whitelist: `wareneingang`, `entmetallisierung`, `schleiferei`, `galvanik`, `warenausgang`
   - Bei unbekanntem Slug: Next.js `notFound()`
   - Filtert Mockaufträge nach `currentStationId === slug`
   - Layout wie `/orders/page.tsx`, aber vorgefiltert
   - Header zeigt Stationsname, aktive/wartende Anzahl, Statusfarbe
5. `src/middleware.ts` — Datei anlegen, `proxy.ts` als `middleware`-Funktion exportieren (sonst greift Auth-Logik nie). Aber ohne Supabase-Crash: Wenn ENVs fehlen, `NextResponse.next()` zurückgeben statt zu werfen.
6. `Topbar.tsx` Zeile 166: Heute-Button als `<Link href="/today">` mit Statusfarbe.
7. `IntakeCompletionSummary` — Link auf `/today` bleibt, jetzt funktioniert er.
8. Nach jedem Schritt: `npm run typecheck && npm run lint`. Beides muss 0 Fehler liefern.

**Akzeptanzkriterium Session 1:** Klicken auf alle Sidebar- und Topbar-Links führt nirgends auf 404.

**Antigravity-Prompt 1 (kopierfertig):**

```text
Session 1 — Routen-Stabilisierung Kreile WerkstattCockpit.

Lies zuerst docs/antigravity/kreile-workshop-app/09_ABSCHLUSSPLAN_DEMO_KREILE.md, Abschnitt §2 Session 1.

Erstelle einen neuen Branch feat/session-1-routen-stabil. Zeige vor jeder Dateioperation git status.

Implementiere genau die 8 Aufgaben aus §2 Session 1 dieses Plans. Keine zusätzlichen Features, keine Refactorings, kein Supabase, keine OCR.

Wichtig:
- Stations-Slugs: wareneingang, entmetallisierung, schleiferei, galvanik, warenausgang
- Mittleware muss ohne Supabase-ENVs lauffähig sein (NextResponse.next() Fallback)
- Nach jedem Schritt: npm run typecheck && npm run lint, beides 0 Fehler

Am Ende: Liste alle geänderten/neuen Dateien auf, zeige finalen git diff --stat, und teste manuell: klicke alle Sidebar- und Topbar-Links durch. Kein einziger Link darf auf 404 führen.
```

---

### Session 2 — Tote Buttons und Kernlogik (geschätzt 2–3 h)

**Ziel:** Jeder Button hat Funktion oder ist sauber disabled. Auftragsdetail wird operativ.

**Sicherheitsregel:** Branch `feat/session-2-buttons-kernlogik`. Vor jeder Funktion: Repository-Methode prüfen, bevor neue erfunden wird.

**Aufgaben:**

1. **`OrderActionGrid` — „Station starten":**
   - Öffnet Modal mit Stations-Dropdown (nur Nachfolge-Stationen aus `STATIONS` erlaubt)
   - Bei Bestätigung: `ordersRepository.updateOrder(id, { currentStationId, status: "in_progress" })` + `eventsRepository.add({ eventType: "STATION_STARTED", … })`
   - Toast-Bestätigung
2. **„Station abschließen":** analog, schreibt `STATION_COMPLETED`, setzt nächste Station auf Default oder lässt Nutzer wählen.
3. **„Foto aufnehmen":** öffnet `<input type="file" accept="image/*" capture="environment" />`. Foto wird als base64 in localStorage gespeichert, in Zeitstrahl als `PHOTO_CAPTURED`-Event. Kein `getUserMedia` jetzt — das ist V2.
4. **„Kunde anrufen":** `<a href="tel:{phone}">` wenn Telefonnummer vorhanden, sonst `disabled` + Tooltip „Keine Telefonnummer hinterlegt".
5. **„Weitere":** Dropdown-Menü mit: „Nacharbeit starten", „Auftrag schließen", „Auftrag stornieren". Jeweils mit Bestätigungsdialog.
6. **Heute-Button-Status:** dynamisch aus aktuellen Mockaufträgen berechnen (rot wenn 1+ überfällig, gelb wenn 1+ heute fällig, sonst neutral). Logik in `lib/today/todayStatus.ts`.
7. **`StatusEventType` Union-Type:** `src/lib/repositories/eventsRepository.ts` umbauen. Type aus §4.3 von Datei 08 übernehmen. Alle Aufrufer auf Union-Typ anpassen. TypeScript-Compiler muss die Migration sichtbar machen.
8. **`priority.ts` dynamisch:** aktuelle hartkodierte Map ersetzen durch echte Berechnung:
   - `now > dueDate` → `critical`
   - `dueDate - now < 24h` → `at_risk`
   - `dueDate - now < 72h` → `light_critical`
   - `dueDate - now < 7d` → `watch`
   - sonst → `in_plan`
9. Alle übrig bleibenden Buttons ohne Handler: `disabled={true}` + `title="Funktion folgt in V2"`.

**Akzeptanzkriterium Session 2:** Kein Button reagiert ohne Wirkung. Auftragsdetail erlaubt vollständigen Stationsdurchlauf in Mock-Daten.

**Antigravity-Prompt 2 (kopierfertig):**

```text
Session 2 — Tote Buttons und Kernlogik Kreile WerkstattCockpit.

Lies zuerst docs/antigravity/kreile-workshop-app/09_ABSCHLUSSPLAN_DEMO_KREILE.md, Abschnitt §2 Session 2, und §4.3 aus 08_KORREKTUREN_VERBINDLICH_KREILE.md (StatusEventType Union).

Branch feat/session-2-buttons-kernlogik. Git status vor jeder Änderung.

Implementiere die 9 Aufgaben aus §2 Session 2.

Wichtigste Punkte:
- Station starten/abschließen schreibt sowohl ordersRepository als auch eventsRepository
- Foto aufnehmen nutzt input type=file mit capture=environment, NICHT getUserMedia
- StatusEventType wird Union-Type, alle Aufrufer migrieren
- priority.ts wird dynamisch aus dueDate berechnet
- Buttons ohne MVP-Handler: disabled + title-Tooltip

Nach jedem Schritt: npm run typecheck && npm run lint.

Am Ende: zeige git diff --stat, liste alle geänderten Dateien, teste manuell den Walkthrough Wareneingang → Auftrag → Station starten → Verbrauch buchen → Station abschließen → Etikett drucken. Notiere alles, was nicht klappt.
```

---

### Session 3 — Substanz und Politur (geschätzt 1–2 h)

**Ziel:** Demo wirkt voll. Mockdaten plausibel. QR-Code echt. Kundenprofil komplett.

**Sicherheitsregel:** Branch `feat/session-3-substanz`.

**Aufgaben:**

1. **Mockdaten aufstocken** in `src/lib/mockData.ts`:
   - 12 Kunden (5 Privat, 4 Business, 3 Institution — z. B. Museum Lenzburg, Pfarrei St. Martin, Schloss Heidelberg-Werkstatt)
   - 25 Aufträge, verteilt über alle 5 Stationen, mit unterschiedlichen Statusständen und `dueDate`s
   - 8 Aufträge als „kritisch / überfällig" (damit Statusfarben sichtbar werden)
   - 30+ StatusEvents (mit der neuen Union)
   - 10 Lagerartikel mit 20 Bewegungen
   - 4 Bäder mit je 3 Messungen
   - 6 Preisabsprachen
   - 3 Reklamationen
   - Faker.js ist optional — handgepflegte Daten sind für die Demo realistischer
2. **Echter QR-Code:** `qrcode` npm-Paket installieren. In `LabelPrintView.tsx` den CSS-Fake-Barcode durch echten QR-Code ersetzen. Payload: Auftrags-ID. Scannbar mit normalem Handy.
3. **Kundenprofil `/customers/[id]/page.tsx` ausbauen:**
   - Aktuelle 55 Zeilen → ~250 Zeilen
   - Sektionen: Header (vorhanden), Aktive Aufträge, Preisabsprachen (vorhanden), Reklamationen (neu, aus `complaintsRepository`), Wiederkehrende Teile (Top 5 nach Häufigkeit), Ähnliche Aufträge (Empfehlung: Filter `customerId = ?` ORDER BY `receivedAt` DESC LIMIT 10), Zeitstrahl, Kommunikationshistorie (Platzhalter mit „noch keine Einträge")
4. **`StationStatusButton`-Komponente extrahieren** — aktuell inline in Topbar, soll wiederverwendbar werden für Performance-Heatmap.
5. **Performance-Score-Formel** aus §12 der Datei 08 implementieren (`lib/performance/score.ts`). Inputs aus aktuellen Mockdaten ableiten.
6. **Performance-Drilldown:** Klick auf KPI-Karte filtert `/orders` entsprechend.
7. **Globale Suche minimal funktional:** durchsucht Mockaufträge nach Auftragsnummer, Kunde, Titel; Mockkunden nach Name, Telefon, E-Mail. Kein Full-Text, einfache `includes`-Filter reicht für Demo.

**Akzeptanzkriterium Session 3:** Demo-Walkthrough fühlt sich voll an. Suche liefert Treffer. QR-Code scannt.

**Antigravity-Prompt 3 (kopierfertig):**

```text
Session 3 — Substanz und Politur Kreile WerkstattCockpit.

Lies zuerst docs/antigravity/kreile-workshop-app/09_ABSCHLUSSPLAN_DEMO_KREILE.md §2 Session 3 und §12 aus 08_KORREKTUREN_VERBINDLICH_KREILE.md (Performance-Score-Formel).

Branch feat/session-3-substanz.

Implementiere die 7 Aufgaben aus §2 Session 3.

Wichtig:
- Mockdaten handgepflegt, nicht generisch. Echte deutsche Werkstatt-Sprache, plausible Teilenamen (Stoßstange Mercedes 280SE, Türgriff Wohnzimmertür, Leuchter Pfarrei, Bremshebel Motorrad, Schaltknauf Porsche etc.)
- 8 von 25 Aufträgen müssen überfällig oder kritisch sein
- qrcode npm-Paket installieren (npm i qrcode @types/qrcode)
- Kundenprofil komplett ausbauen, nicht nur Header
- Suche: einfache includes-Filter, nicht fancy

npm run typecheck && npm run lint nach jedem Schritt.

Am Ende: Lighthouse-Test auf /, /orders, /performance. Werte notieren. Demo-Walkthrough durchgehen und Screenshots aufnehmen.
```

---

## 3. Bewusst NICHT in diesem Abschluss

| Punkt | Warum verschoben | Wohin |
|---|---|---|
| Supabase-Anbindung | bricht stabilen Mock-Stand, 3–5 Sessions Aufwand | V2 |
| Google Vision OCR | braucht API-Key, Backend-Route, Kostenposition | V2 |
| `getUserMedia` echte Kamera | iOS-Safari-Komplexität, Permissions, kein Demo-Mehrwert | V2 |
| RLS / Auth-Rollen | ohne Supabase sinnlos | V2 |
| TanStack Query / Drizzle | gehört zu Supabase-Paket | V2 |
| Vitest / Playwright | Tests gegen Mock-Daten testen falsche Realität | nach V2 |
| `WorkTimeLog` Pausen | nicht sichtbar in Demo | V2.1 |
| Bluetooth-Etikettendrucker | spielt für Demo keine Rolle | V3 |
| Mandantenfähigkeit | Overhead für 1-Werkstatt-Pilot | V3 |

Diese Liste ist verbindlich. Antigravity darf in den drei Sessions oben nichts davon einbauen, auch nicht „nebenbei".

---

## 4. Risiken und Stolperfallen

| Risiko | Mitigation |
|---|---|
| `middleware.ts` ohne Supabase wirft Fehler | Fallback `NextResponse.next()` wenn ENVs fehlen — siehe Session 1 Aufgabe 5 |
| Mockdaten-Aufstockung bricht bestehende Filter | nach Aufstockung alle Seiten manuell durchklicken |
| `eventType` Union-Migration in Session 2 berührt viele Dateien | TypeScript-Compiler arbeiten lassen, schrittweise alle Fehler fixen |
| QR-Code-Lib bringt SSR-Probleme in Next.js | `qrcode` clientseitig in `useEffect` rendern, nicht im Server Component |
| `customers/page.tsx` mit 1042 Zeilen wird bei Mockdaten-Aufstockung langsam | erst Performance messen, dann refaktorisieren — nicht prophylaktisch |
| Session 2 Foto-Upload als base64 in localStorage sprengt Quota | max. 200 KB pro Foto, Komprimierung via `canvas.toBlob` mit Qualität 0.6 |

---

## 5. Was noch geklärt werden muss

Punkte, die ich nicht allein entscheiden kann oder wo deine Präferenz das Ergebnis kippt:

| # | Frage | Meine Empfehlung | Brauche ich Entscheidung? |
|---|---|---|---|
| 1 | Stationsname: „Galvanik" oder „Veredelung"? | „Galvanik" als Slug, „Veredelung (Galvanik)" als Anzeigename | ja, vor Session 1 |
| 2 | Reihenfolge der 5 Stationen — Wareneingang → Entmetallisierung → Schleiferei → Galvanik → Warenausgang. Ist das die echte Werkstatt-Reihenfolge? | so wie hier | ja, vor Session 1 |
| 3 | Bei „Station abschließen" automatisch in nächste Station oder Nutzer wählen lassen? | Nutzer wählt, Vorschlag = nächste Station | ja, vor Session 2 |
| 4 | Wer ist der „Demo-Nutzer" beim Walkthrough — gibt es eine Person, der vorgeführt wird? Hat das Auswirkung auf Mockdaten-Auswahl (z. B. echte Kreile-Kunden anonymisiert)? | wenn ja: 3–4 echte (anonymisierte) Kreile-Kunden in Mockdaten, Rest erfunden | ja, vor Session 3 |
| 5 | QR-Code-Inhalt: nur Auftrags-ID, oder URL wie `https://app.kreile.local/orders/{id}`? | URL (dann scannbar mit Browser öffnen) | empfohlen, nicht blockierend |
| 6 | Welche „typischen Teile" gehören in Mockdaten? Galvanik / Restauration ist breit — Schwerpunkt Kreile? Oldtimer / Sakralkunst / Möbel / alles? | wenn unklar: alle drei Schwerpunkte mit je 8 Aufträgen | empfohlen, nicht blockierend |
| 7 | Login-Flow für Demo: echter Login (Dummy-User) oder „Demo-Modus" Button auf `/login`? | Demo-Modus-Button, der direkt einloggt | empfohlen, nicht blockierend |
| 8 | Soll der Hinweis „Mock-Phase — Daten nicht persistent über Geräte" sichtbar in der App stehen (z. B. dezenter Banner)? | ja, kleines Badge in Topbar rechts | empfohlen, nicht blockierend |
| 9 | Wie viel Performance-Tiefe in Session 3? Score + Drilldown reicht, oder auch Insights mit Empfehlungstexten? | Score + Drilldown reicht. Insights = V2 | empfohlen, nicht blockierend |
| 10 | Lighthouse-Mindestschwelle für Demo akzeptabel: 80 / 90 (Performance / Accessibility)? Oder höher? | 80 / 90 reicht — höher kostet 2–3 zusätzliche Sessions Polish | bestätigen |

**Vorgehensvorschlag:** Du beantwortest Punkte 1–3 jetzt direkt, 4–7 kannst du bis vor Session 3 nachreichen, 8–10 sind weiche Defaults.

---

## 6. Was nach Demo-Abschluss kommt (V2-Vorschau, nicht jetzt umsetzen)

Damit der Abschluss nicht in der Luft hängt, hier kurz der Plan für danach. Wird in eigener Datei (`10_V2_DATENBANK_KREILE.md`) ausgearbeitet, **nachdem** Demo steht.

1. Supabase-Projekt anlegen (EU-West Frankfurt)
2. Schema mit Drizzle, Migration aus aktuellen Repository-Types
3. Seed-Skript für identische Mockdaten in DB
4. Repositories Schritt für Schritt von localStorage auf Supabase umstellen — pro Session ein Repository
5. Auth mit Supabase
6. RLS-Policies
7. `/api/ocr`-Route mit Google Vision
8. echter `getUserMedia`-Flow
9. Vitest + Playwright

Aufwand grob: 6–8 Sessions. Erst beginnen, wenn Demo läuft und stabil ist.

---

## 7. Definition of Done für diesen Abschlussplan

Das Projekt gilt als „Demo-fertig abgeschlossen", wenn:

- [ ] Session 1, 2, 3 alle drei in `main` gemergt
- [ ] Walkthrough aus §1 Punkt 3 läuft ohne Bug durch
- [ ] §1 Akzeptanzliste alle 12 Punkte erfüllt
- [ ] Alle Klärungspunkte aus §5 entschieden (mindestens 1–3, idealerweise alle)
- [ ] Lighthouse-Werte ≥ 80 / ≥ 90 erreicht
- [ ] Screenshot-Demo (5–8 Screenshots) als `docs/demo/` abgelegt
- [ ] V2-Vorschau-Datei `10_V2_DATENBANK_KREILE.md` als Stub vorhanden (damit es weitergeht)

Danach: Pause, Feedback einholen, V2-Planung starten.

Ende.
