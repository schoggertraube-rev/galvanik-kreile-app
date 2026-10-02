<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G06 KV / Angebot — Funktionen und Abläufe

## Gemeinsame Personen- und Sicherheitsregel

Standard ist nach OE-2609-09: Rolf, Phillip und Gregor dürfen alle Funktionen. Der G01/G10-HostAdapter darf je Person einzelne Capabilities sperren oder erweitern; der G06-Kern erhält nur einen tenantgebundenen Authorization-Snapshot und entscheidet nie anhand sichtbarer Rollennamen.

### F-G06-001 — KV manuell anlegen

**Auslöser:** Globales `Anlegen` → `Auftrag / KV anlegen` oder nach sicherer Kundenanlage `KV / Angebot anlegen`.

**Personen:** Rolf, Phillip, Gregor; personenbezogene Admin-Sperre gilt fail-closed.

**Schritte:**

1. G03 öffnet dieselbe Global-Create-Komposition; eine zweite KV-Route ist unzulässig.
2. G05 liefert tenantgebundene Kunden; der Mitarbeiter sucht und wählt einen vorhandenen Kunden oder legt ihn über den G05-Port an.
3. Der Mitarbeiter erfasst 1–20 Positionen, Wunschtermin und optionalen Hinweis; Mehrzeilen-/Wiederverwendungsfunktionen übernehmen nur echte, bestätigte Werte.
4. Der Client erzeugt eine UUID als `clientEventId`; Server und DB validieren die vollständige Absicht.
5. Der Quote-Command reserviert die KV-Nummer, speichert KV und Positionen, schreibt `QUOTE_CREATED_V1` und Receipt in einer Tenant-Transaktion.
6. Die UI zeigt Erfolg erst nach Receipt und fachlichem Readback.

**Ergebnis + Receipt/Readback:** `QuoteCreateReceipt` und `QuoteReadback`; Status `draft`, Version 1, `linkedOrderId = null`.

**Fehlerfälle:** Validierungsfehler belässt Eingaben; Fremdtenant/fehlendes Recht sperrt; Timeout zeigt ungeklärten Ausgang mit derselben Anfragekennung.

**Sperren/Konflikte:** S-G06-001 bis S-G06-007; K-G06-003, K-G06-005.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | KV-Formular mit Kunde, Positionen, Wunschtermin, Hinweis und Speichern | `Kostenvoranschlag anlegen` · `KV sichern` | `GlobalCreateFlow.tsx`; V5 Zeilen 1177–1192 |
| lädt | Kundenstamm wird gelesen | `Kundenstamm wird sicher gelesen …` | `GlobalCreateFlow.tsx` |
| leer | Kein passender Kunde; sichere Anlage wird angeboten | `Noch kein belegter Kunde` · `Kunde anlegen` | `GlobalCreateFlow.tsx` |
| Fehler | Anlage nicht bestätigt; Eingaben bleiben | `Vorgang nicht abgeschlossen` | `GlobalCreateFlow.tsx` |
| gesperrt | Capability fehlt; keine Eingabe wird geschrieben | `Zugriff verweigert` | `GlobalCreateFlow.tsx`; G01 |
| In Klärung | Ungeklärte Zuschlags-Zusatzdaten sind nicht Teil der KV-Anlage | `Auftragsdetails · In Klärung` | OE-2609-04; Q-G06-001 |
| In Aufbau | Späterer Versand ist gedämpft und nicht klickbar | `KV senden · In Aufbau` | OE-2609-04; Q-G06-003 |

### F-G06-002 — Offene KVs öffnen und bearbeiten

**Auslöser:** `Offene KVs bearbeiten` oder `Gespeicherten KV fortsetzen`.

**Personen:** Rolf, Phillip, Gregor; personenbezogene Lese-/Änderungssperren gelten getrennt.

**Schritte:**

1. Der Read-Port lädt höchstens 100 offene KVs des aktuellen Tenants.
2. Auswahl liest den vollständigen KV samt aktueller Revision.
3. Der Mitarbeiter ändert Positionen, Wunschtermin oder Hinweis; bestätigter Auftragstermin wird beim Bearbeitungsbeginn bewusst zurückgesetzt.
4. Das Update sendet `expectedVersion` und eine neue `clientEventId`.
5. Server/DB schreiben neue Aggregate-Version, neue Positionsrevision, `QUOTE_UPDATED_V1` und Update-Receipt.
6. Receipt und Readback müssen dieselbe neue Version belegen.

**Ergebnis + Receipt/Readback:** `QuoteUpdateReceipt` und `QuoteReadback` mit `version = expectedVersion + 1`.

**Fehlerfälle:** Leere Liste, Leseausfall, veraltete Version, bereits konvertierter KV, unklarer Ausgang.

**Sperren/Konflikte:** S-G06-004 bis S-G06-009; K-G06-001 bis K-G06-003.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Liste mit KV-Nummer, Kunde, Stand, Terminwunsch und Netto-Summe | `Offene KVs` | `GlobalCreateFlow.tsx` |
| lädt | Lesender Fortschritt ohne leere Fake-Liste | `Offene KVs werden geladen …` | `GlobalCreateFlow.tsx` |
| leer | Sicher geladene Liste ohne offene KVs | `Keine offenen KVs` · `Es ist derzeit kein gespeicherter KV zur Weiterbearbeitung offen.` | `GlobalCreateFlow.tsx` |
| Fehler | Lesevorgang fehlgeschlagen | `Offene KVs konnten nicht geladen werden` | `GlobalCreateFlow.tsx` |
| gesperrt | Lese-/Änderungsrecht fehlt | `Zugriff nicht freigegeben` | `GlobalCreateFlow.tsx`; G01 |
| In Klärung | Ergebnis einer unterbrochenen Speicherung ist noch nicht belegt | `Stand noch nicht geklärt` | `GlobalCreateFlow.tsx`; D-RES-001 |
| In Aufbau | Reuse/Mehrzeilen-Hilfe ist noch nicht angebunden | `Schnellerfassung · In Aufbau` | Digest KOORD_late P2; OE-2609-04 |

### F-G06-003 — Echte Positionen wiederverwenden und mehrzeilig erfassen

**Auslöser:** Im KV-Formular `Positionen übernehmen` oder Einfügen mehrerer Textzeilen.

**Personen:** Rolf, Phillip, Gregor.

**Schritte:**

1. Der Kreile-HostAdapter liest ausschließlich reale frühere Positionen des gewählten Kunden über einen G04/G05-Read-Port; der G06-Kern liest keine fremden Tabellen.
2. Jede Auswahl zeigt Herkunftsauftrag, Bezeichnung, Menge, Material, Oberfläche und bisherigen Preisstand; sie wird niemals still übernommen.
3. Mehrzeilentext wird lokal in bearbeitbare Zeilen zerlegt; nicht eindeutig zuordenbare Felder bleiben leer und sichtbar prüfpflichtig.
4. Erst die ausdrückliche Bestätigung überführt Zeilen in die KV-Positionen.
5. Gespeichert wird ausschließlich über F-G06-001 oder F-G06-002.

**Ergebnis + Receipt/Readback:** Kein eigener Schreib-Receipt; bestätigte Positionen werden Bestandteil des normalen Create-/Update-Receipts.

**Fehlerfälle:** Read-Port nicht verfügbar, keine Historie, unvollständige Zeile, Preisstand fehlt; niemals Fake-Vorschlag oder stiller Default.

**Sperren/Konflikte:** S-G06-006, S-G06-010; kein Startseitenkonflikt, weil Eingaben lokal erhalten bleiben.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Auswahl realer Positionen mit Herkunft und editierbaren Werten | `Positionen übernehmen` | FEHLT → Q-G06-004; Funktion aus Digest KOORD_late P2 |
| lädt | Read-Port liest echte Historie | `Frühere Positionen werden geladen …` | FEHLT → Q-G06-004 |
| leer | Kunde hat keine wiederverwendbaren Positionen | `Keine früheren Positionen gefunden.` | FEHLT → Q-G06-004 |
| Fehler | Historie nicht sicher lesbar; manuelle Eingabe bleibt möglich | `Positionen konnten nicht sicher geladen werden. Manuelle Eingabe bleibt möglich.` | FEHLT → Q-G06-004; D-RES-001 |
| gesperrt | Read-Capability fehlt | `Wiederverwendung ist für diese Person gesperrt.` | FEHLT → Q-G06-004; OE-2609-09 |
| In Klärung | Unklare Mehrzeilenfelder bleiben leer | `Angaben prüfen · In Klärung` | FEHLT → Q-G06-004; OE-2609-04 |
| In Aufbau | Port noch nicht implementiert | `Schnellerfassung · In Aufbau` | FEHLT → Q-G06-004; OE-2609-04 |

### F-G06-004 — Zuschlag bestätigen und genau einen Auftrag anlegen

**Auslöser:** `Zuschlag bestätigen · Auftrag anlegen`.

**Personen:** Rolf, Phillip, Gregor mit `quotes:convert-to-order` und G04-Auftragserstellrecht.

**Schritte:**

1. UI verlangt einen gültigen, ausdrücklich zugesagten Auftragstermin; der KV-Wunschtermin wird nicht überschrieben.
2. Zusatzangaben Zahlungsart/Eingangsart/Express bleiben gemäß Q-G06-001 gesperrt, bis ihr G04/G07-Vertrag geklärt ist.
3. `prepareQuoteConversionCommand` sperrt/prüft KV, Tenant, Version, Status, Absicht und vorhandene Conversion-Request.
4. Der bestehende F1.1-Port `createOrderIntake` erhält Kunde, bestätigten Termin, Notiz und Positionen.
5. Das erfolgreiche `ORDER_INTAKE_CREATED_V1` finalisiert im selben F1.1-Transaktionskontext den KV zu `converted`, verknüpft den Auftrag und schreibt `QUOTE_AWARDED_V1` samt Conversion-Receipt.
6. Die Action liest Order-Receipt, Quote-Conversion-Receipt und KV-Readback; erst dann zeigt die UI Erfolg und öffnet die Auftragskarte.

**Ergebnis + Receipt/Readback:** genau ein `OrderIntakeReceipt`, ein `QuoteConversionReceipt` und ein `QuoteReadback` mit `status = converted` und passender `linkedOrderId`.

**Fehlerfälle:** Fehlender Termin, veraltete Version, bereits konvertiert, Auftragseingang fehlgeschlagen, Timeout/unklarer Ausgang.

**Sperren/Konflikte:** S-G06-008 bis S-G06-014; K-G06-001, K-G06-002, K-G06-004.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Gesicherter KV, zugesagter Termin und Zuschlagsknopf | `Zuschlag bestätigen · Auftrag anlegen` | `GlobalCreateFlow.tsx`; V5 Zeilen 1195 ff. |
| lädt | Knopf ist gesperrt, Spinner läuft; keine zweite Anlage | `Zuschlag bestätigen · Auftrag anlegen` | `GlobalCreateFlow.tsx` |
| leer | Kein gültiger Auftragstermin | `Bitte vor dem Zuschlag einen gültigen Auftragstermin festlegen.` | `GlobalCreateFlow.tsx` |
| Fehler | Conversion sicher fehlgeschlagen | `Vorgang nicht abgeschlossen` | `GlobalCreateFlow.tsx` |
| gesperrt | Conversion-Capability fehlt | `Zugriff verweigert` | `GlobalCreateFlow.tsx`; G01 |
| In Klärung | Zusatzdaten besitzen noch keinen freigegebenen Order-Vertrag | `Auftragsdetails · In Klärung` | Q-G06-001; OE-2609-04 |
| In Aufbau | Späterer Versand bleibt getrennt und passiv | `KV senden · In Aufbau` | OE-2609-04; Q-G06-003 |

### F-G06-005 — Unklaren Ausgang sicher klären

**Auslöser:** Command-Ausfall/Timeout mit `UNAVAILABLE` oder Transportfehler.

**Personen:** Die Person, die den Vorgang ausgelöst hat; Rolf übernimmt einen ungelösten fachlichen Konflikt.

**Schritte:**

1. UI bewahrt Eingaben und die ursprüngliche Anfragekennung.
2. `Status mit gleicher Kennung prüfen` führt ausschließlich den passenden Receipt-/Readback-Port aus.
3. Gefundener Erfolg wird als normaler Erfolg dargestellt; `NOT_FOUND` bestätigt nur, dass noch kein Nachweis existiert.
4. Erst nach Statusprüfung kann der Mitarbeiter ein explizites erneutes Senden vorbereiten und bestätigen; dieselbe Kennung macht es idempotent.
5. Bleibt der Ausgang ungelöst, projiziert G09 den Konflikt mit Deep-Link bei Rolf.

**Ergebnis + Receipt/Readback:** belegter gespeicherter Stand oder weiterhin ungeklärter, fortsetzbarer Vorgang; niemals stiller Erfolg.

**Fehlerfälle:** Receipt-Port selbst nicht verfügbar, Kennung fehlt, fremder Tenant, Readback widerspricht Receipt.

**Sperren/Konflikte:** S-G06-003, S-G06-007, S-G06-013; K-G06-002, K-G06-003.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Nachweis und fachlicher Stand sind wiedergefunden | `Der KV ist sicher gespeichert und kann weiterbearbeitet werden.` | `GlobalCreateFlow.tsx` |
| lädt | Nur lesende Statusprüfung läuft | `Status mit gleicher Kennung prüfen` | `GlobalCreateFlow.tsx` |
| leer | Noch kein Receipt gefunden, Eingaben bleiben | `Es wurde noch keine Speicherung gefunden. Die Eingaben bleiben erhalten.` | `GlobalCreateFlow.tsx` |
| Fehler | Readback selbst konnte nicht sicher gelesen werden | `Der gespeicherte Stand konnte nicht sicher gelesen werden. Es wurde nichts erneut gesendet.` | `GlobalCreateFlow.tsx` |
| gesperrt | Receipt gehört nicht zur Person/zum Tenant | `Zugriff verweigert` | D-RES-001; G01 |
| In Klärung | Outcome bleibt offen | `Ausgang ungeklärt` | `GlobalCreateFlow.tsx`; D-RES-001 |
| In Aufbau | Startseitenprojektion fehlt noch | `Handlungsbedarf · In Aufbau` | OE-2609-10; G02/G09 |

### F-G06-006 — KV-Dokument erzeugen und versenden

**Auslöser:** Späterer Knopf `KV senden` nach sicher gespeichertem KV.

**Personen:** Rolf, Phillip, Gregor; Versandrechte personenbezogen, menschliche Freigabe zwingend.

**Schritte:**

1. Bis Q-G06-002/-003 und M05-Gate geschlossen sind, gibt es keinen aktiven Schritt und keinen Provider-Aufruf.
2. Später erzeugt ein Dokument-Port aus einer unveränderlichen KV-Version ein prüfbares Dokument mit Hash.
3. Der Mitarbeiter prüft Empfänger, Dokumentversion und Preisbasis und bestätigt ausdrücklich.
4. M05 versendet über seinen Provideradapter und liefert Versand-Receipt; G06 liest Dokument- und Versandnachweis zurück.
5. Ohne beide Nachweise bleibt der Versand ungeklärt und darf nicht als Erfolg erscheinen.

**Ergebnis + Receipt/Readback:** Noch nicht gebaut; Ziel sind unveränderlicher Dokumentnachweis und M05-Versand-Receipt, ohne G06-eigenes Provider-Secret.

**Fehlerfälle:** Dokumentvertrag offen, Provider nicht freigegeben, Empfänger fehlt, Versand unklar; kein Fallback.

**Sperren/Konflikte:** S-G06-015; Q-G06-002/-003.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | FEHLT, erst nach Dokument-/M05-Gate | `KV senden` | V5 Zeilen 1177–1195; Digest KOORD_late P2 |
| lädt | FEHLT, erst mit echtem Versand-Receipt | `KV wird gesendet …` | FEHLT → Q-G06-003 |
| leer | Empfänger oder Dokument fehlt | `Versand ist noch nicht möglich.` | FEHLT → Q-G06-002 |
| Fehler | Versand sicher fehlgeschlagen, kein Erfolg | `KV konnte nicht gesendet werden.` | FEHLT → Q-G06-003 |
| gesperrt | Versandrecht oder Owner-Gate fehlt | `KV-Versand ist gesperrt.` | OE-2609-09; M05-Gate |
| In Klärung | Dokumentformat/-snapshot ist offen | `KV-Dokument · In Klärung` | Q-G06-002; OE-2609-04 |
| In Aufbau | Versandadapter ist noch nicht angebunden | `KV senden · In Aufbau` | Q-G06-003; OE-2609-04 |
