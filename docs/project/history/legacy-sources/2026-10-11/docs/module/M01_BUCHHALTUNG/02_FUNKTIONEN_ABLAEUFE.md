<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# M01_BUCHHALTUNG — Funktionen und Abläufe

Für jede Funktion gilt: Standardmäßig dürfen alle Personen sie sehen; serverseitige personenbezogene Capabilities entscheiden über Lesen und Mutieren, und der Admin kann je Person sperren oder erweitern. Kein UI-Zustand ersetzt diese Prüfung.

### F-M01-001 — Buchhaltungs-Arbeitsvorrat öffnen

**Auslöser:** Nach M01-Adoption öffnet eine berechtigte Person das Buchhaltungs-Kontrollzentrum.

**Personen:** alle; Admin kann personenbezogen sperren/erweitern.

**Schritte:**

1. HostAdapter löst Tenant, Actor und Read-Capabilities auf.
2. M01 liest Rechnungs-/Zahlungsfälle, Dokumentquarantäne, Bankklärungen, Mahn-, Export- und Liquiditätsstände ausschließlich über ihre öffentlichen Ports.
3. Jeder Read behält Quelle, Stand, Coverage, stale/partial/denied.
4. Fälle werden nach Handlungsbedarf dargestellt, nicht als KPI-Wand und nicht als zweite Aufgabenwahrheit.
5. Reload liest dieselben Facts neu; Browsercache ist nie Wahrheit.

**Ergebnis + Receipt/Readback:** Ein ReadEnvelope je Quelle und ein reproduzierbarer Reload; Reads erzeugen kein Domain-Receipt.

**Fehlerfälle:** denied, partial, stale, unavailable oder unknown bleiben als solche sichtbar; kein leeres Erfolgsarray.

**Sperren/Konflikte:** K-M01-002, K-M01-003, K-M01-011.

### F-M01-002 — Rechnung, Zahlung und offenen Betrag prüfen

**Auslöser:** Eine Person öffnet einen Rechnungs-/Zahlungsfall oder folgt einem Deep Link aus dem Grundstamm.

**Personen:** alle; Admin kann personenbezogen sperren/erweitern.

**Schritte:**

1. M01 liest `InvoiceSummaryV1` und `PaymentSummaryV1` aus der vorhandenen Host-Wahrheit.
2. Integer-Cent, Währung, Version, Lifecycle und Paymentkonsistenz werden validiert.
3. Original-/Stornobelege werden nur über berechtigte Hostreads verlinkt.
4. Eine Aktion delegiert ausschließlich an den bestehenden Hostcommand.
5. Receipt und neuer unabhängiger Readback müssen exakt übereinstimmen.

**Ergebnis + Receipt/Readback:** Verifizierter Rechnungs-/Paymentstand oder ehrlicher Fehlerzustand; bei Command ein dauerhaftes Receipt plus Reload.

**Fehlerfälle:** Fremdtenant, veraltete Version, widersprüchliche Summen, beschädigtes Receipt, Antwortverlust.

**Sperren/Konflikte:** K-M01-001, K-M01-002, K-M01-004.

### F-M01-003 — Rechnungsstorno sicher ausführen

**Auslöser:** Eine berechtigte Person fordert das Storno einer ausgestellten, eindeutig unbezahlten Rechnung an.

**Personen:** alle mit `accounting.invoice.cancel.v1`; Admin kann personenbezogen sperren/erweitern.

**Schritte:**

1. Grund, Intent, Idempotency-ID und erwartete Aggregatversion werden geprüft.
2. Ein frischer Cancel-State wird tenantgebunden gelesen.
3. Fail-closed-Policy erlaubt nur `issued`, Paymentvertrag 1, Status offen, bezahlt 0, offen = brutto und Paymentversion 0 ohne Paymentbeleg.
4. Der Hostcommand prüft dieselben Preconditions atomar in derselben Transaktion.
5. Stornoevent und Stornobeleg entstehen additiv; Original und Paymentfacts bleiben unverändert.
6. Receipt und unabhängiger Reload werden abgeglichen.

**Ergebnis + Receipt/Readback:** `INVOICE_CANCELLED_V1` mit Storno-PDF/Hash oder konfliktbedingte Nullmutation.

**Fehlerfälle:** Teil-/Vollzahlung, inkonsistenter Zustand, Versionskonflikt, parallele Zahlung, verlorene Antwort, DB-Fehler.

**Sperren/Konflikte:** K-M01-001, K-M01-002.

### F-M01-004 — Falsch bestätigte Zahlung korrigieren

**Auslöser:** Eine berechtigte Person meldet eine fehlerhafte manuelle Zahlung.

**Personen:** alle mit späterer Korrektur-Capability; Admin kann personenbezogen sperren/erweitern.

**Schritte:**

1. Bis Q-M01-001 entschieden und A3 geöffnet ist, bleibt die Aktion nicht klickbar „In Klärung“.
2. Danach wird exakt ein unreversiertes `PAYMENT_CONFIRMED_V1`-Receipt gewählt.
3. Teil- oder Vollbetrag, erwartete Paymentversion und explizite Bestätigung werden validiert.
4. Append-only Gegenereignis und neuer aktueller Zahlungsstand entstehen atomar.
5. Reversal-Receipt und unabhängiger Readback bestätigen Original, Gegenbeleg und offenen Betrag.

**Ergebnis + Receipt/Readback:** Additives Payment-Reversal; Originalevent bleibt unverändert.

**Fehlerfälle:** Doppel-/Überreversal, falscher Tenant, parallele Korrektur, beschädigtes Receipt, Unknown.

**Sperren/Konflikte:** K-M01-002, K-M01-004, K-M01-005.

### F-M01-005 — Gutschrift und Refund bearbeiten

**Auslöser:** Eine berechtigte Person muss eine ausgestellte oder bezahlte Rechnung fachlich korrigieren.

**Personen:** alle mit späterer Credit-/Refund-Capability; Admin kann personenbezogen sperren/erweitern.

**Schritte:**

1. Bis Bauvertrag und Gate offen sind, bleibt die Aktion „In Aufbau“.
2. Gutschrift referenziert die Originalrechnung und validiert Betrag, Tenant, Version und Grund.
3. Credit-Note-Command erzeugt additiven Beleg und Receipt; Original bleibt unverändert.
4. Nur falls eine Auszahlung nötig ist, wird ein separater Refund-Command gestartet.
5. Refundstatus `failed`, `unknown` oder `succeeded` wird per eigenem Receipt gelesen.

**Ergebnis + Receipt/Readback:** Getrennte Credit-Note- und gegebenenfalls Refund-Receipts mit Reload.

**Fehlerfälle:** Betrag über zulässiger Basis, fehlende Gutschrift, Provider-Timeout, Antwortverlust, Doppelrefund.

**Sperren/Konflikte:** K-M01-002, K-M01-005, K-M01-006.

### F-M01-006 — Bankbewegung importieren, zuordnen und zurücknehmen

**Auslöser:** Eine freigegebene Importquelle oder ein PaymentAdapter liefert Bankbewegungen; eine Person prüft einen Vorschlag.

**Personen:** alle mit späterer Bank-Capability; Admin kann personenbezogen sperren/erweitern.

**Schritte:**

1. Bis Q-M01-006/Owner-Gate geschlossen ist, bleibt der Bankabgleich „In Aufbau“.
2. Bankbewegung wird tenantgebunden, unveränderlich und dedupliziert erfasst.
3. M01 erzeugt nur einen Zuordnungsvorschlag zu kanonischer Rechnung/offenem Betrag.
4. Menschliche Bestätigung ruft `assignBankMovement` auf; Payment entsteht über denselben Accounting-Zahlungsweg.
5. Fehlerhafte Zuordnung wird nur durch append-only `reverseBankAssignment` korrigiert.
6. Bewegungs-, Assignment-, Payment- und Reversal-Receipts werden unabhängig gelesen.

**Ergebnis + Receipt/Readback:** Nachvollziehbare Bewegung mit bestätigter Zuordnung oder offener Klärung; nichts verschwindet.

**Fehlerfälle:** Dedupekonflikt, fremde Währung, beschädigte Datei, Mehrdeutigkeit, parallele Zahlung, Providerpagination, Unknown.

**Sperren/Konflikte:** K-M01-002, K-M01-007, K-M01-008.

### F-M01-007 — Kartenzahlung bei Abholung anstoßen

**Auslöser:** Phillip oder eine andere berechtigte Person kassiert bei Abholung per Karte.

**Personen:** alle mit Kassen-/Payment-Capability; Admin kann personenbezogen sperren/erweitern.

**Schritte:**

1. Ohne freigegebenen Anbieter bleibt „Kartenterminal“ nicht klickbar „In Aufbau“; bestehende Kassieren-Bestätigung bleibt aktiv.
2. Nach Gate sendet der HostAdapter Betrag, Währung, Rechnung/Auftrag, Intent und Idempotency an den Terminal-PaymentAdapter.
3. `unknown` blockiert erneuten Zahlungsversuch bis Readback/Reconciliation.
4. Nur bestätigter Terminalerfolg darf über den kanonischen Payment-Command als Zahlung verbucht werden.
5. Terminal- und Payment-Receipt werden korreliert und nach Reload geprüft.

**Ergebnis + Receipt/Readback:** Bestätigte Kartenzahlung im bestehenden Paymentstand oder ehrlicher offener/fehlgeschlagener Vorgang.

**Fehlerfälle:** Terminal offline, Abbruch, Doppelclick, Timeout nach externer Annahme, Betragsabweichung, falsche Rechnung.

**Sperren/Konflikte:** K-M01-002, K-M01-009.

### F-M01-008 — Dokument und E-Rechnung empfangen

**Auslöser:** Datei/Kamera, später M365 oder ein freigegebener Connector liefert ein Dokument.

**Personen:** alle; Admin kann personenbezogen sperren/erweitern.

**Schritte:**

1. Genau ein privates Original wird mit Hash, MIME, Quelle, Tenant und Stand finalisiert.
2. Für strukturierte E-Rechnungen wird der strukturierte Teil unverändert aufbewahrt und gegen das freigegebene EN-16931-Profil validiert.
3. OCR/Parser liefert ausschließlich versionierte Feldvorschläge mit Fundstellen und Konfidenz.
4. Mehrdeutige oder fehlerhafte Eingänge bleiben in Quarantäne.
5. Eine Person bestätigt Routing und Fachwerte; erst danach läuft der zuständige Domain-Command.
6. Original-, Vorschlags- und Domain-Receipt werden unabhängig gelesen.

**Ergebnis + Receipt/Readback:** Unverändertes Original plus nachvollziehbarer Verarbeitungsstand; kein stiller Fan-out.

**Fehlerfälle:** Uploadabbruch, Hash-/MIME-Fehler, ungültiges XML, Abweichung XML/Bildteil, OCR-Timeout, denied Routing, doppeltes Original.

**Sperren/Konflikte:** K-M01-002, K-M01-010, K-M01-011.

### F-M01-009 — Kosten-/Ausgabenfakt anlegen oder korrigieren

**Auslöser:** Eine Person bestätigt ein Original oder einen belegten manuellen Ursprung als Kostenfakt.

**Personen:** alle mit späterer Cost-Capability; Admin kann personenbezogen sperren/erweitern.

**Schritte:**

1. Bis Q-M01-002 entschieden ist, bleibt die Funktion „In Klärung“.
2. Danach werden Betrag/Währung, Leistungs-/Steuerdatum, Lieferant, Original und optionale Attributionen validiert.
3. Genau ein Command erzeugt den kanonischen Cost-Fact.
4. Änderungen erfolgen nur als additive Korrektur/Storno.
5. Receipt und Fact-Readback werden neu geladen; Legacytabellen werden nicht beschrieben.

**Ergebnis + Receipt/Readback:** Ein versionierter Kostenfakt ohne Dual Write.

**Fehlerfälle:** fehlendes Original, Doppelerfassung, widersprüchliche Steuerklassifikation, Legacywriter, Fremdtenant.

**Sperren/Konflikte:** K-M01-002, K-M01-012.

### F-M01-010 — Zahlungserinnerung oder Mahnung vorbereiten

**Auslöser:** Kanonischer offener Betrag ist fällig und die Person öffnet den Fall.

**Personen:** alle mit späterer Dunning-Capability; Admin kann personenbezogen sperren/erweitern.

**Schritte:**

1. Bis Q-M01-003 entschieden ist, bleibt die Funktion „In Klärung“; der bestehende Stub wird nicht als Capability angezeigt.
2. Eligibility liest Rechnung, OP, Fälligkeit, Empfänger und bisherige Mahnereignisse.
3. Entwurf wird menschlich geprüft und freigegeben.
4. Direkt vor Sendung werden OP, Lifecycle und Empfänger erneut gelesen.
5. Externer Kommunikationsport sendet; Accounting referenziert sein Providerreceipt in einem append-only Mahnereignis.
6. Reload blockiert Doppelversand; `unknown` bleibt offen.

**Ergebnis + Receipt/Readback:** Bestätigtes Mahnereignis und korreliertes Zustellreceipt oder unveränderter offener Entwurf.

**Fehlerfälle:** zwischenzeitliche Zahlung/Storno, falsche Adresse, Provider-Timeout, Antwortverlust, Doppelclick.

**Sperren/Konflikte:** K-M01-002, K-M01-006, K-M01-013.

### F-M01-011 — Steuerberaterexport erzeugen

**Auslöser:** Eine berechtigte Person wählt Zeitraum/Cutoff und freigegebene Formatversion.

**Personen:** alle mit späterer Export-Capability; Admin kann personenbezogen sperren/erweitern.

**Schritte:**

1. Bis Q-M01-004 und Q-M01-013 geschlossen sind, bleibt Export „In Klärung“.
2. Der Run liest nur kanonische Rechnungs-, Zahlungs- und später Kostenfacts.
3. Vollständigkeit, Tenant, Zeitraum, Formatversion und Cutoff werden validiert.
4. Artefakt entsteht deterministisch mit Inputset- und Dateihash.
5. Erfolg wird erst nach gespeichertem, hashverifiziertem Readback gesetzt.
6. Erneuter Download liefert denselben Hash.

**Ergebnis + Receipt/Readback:** Persistenter Export-Run samt Artefaktbezug und Receipt.

**Fehlerfälle:** Teilabdeckung, Speicherfehler, Formatfehler, Hashmismatch, Antwortverlust, fremder Tenant.

**Sperren/Konflikte:** K-M01-002, K-M01-014.

### F-M01-012 — Manuelle Liquiditätsgrundlagen pflegen

**Auslöser:** Admin pflegt laufende Kosten oder aktualisiert den Kontostand.

**Personen:** alle dürfen lesen; Schreiben nur personenbezogen freigegebene Admin-Capability.

**Schritte:**

1. Fixkosten werden mit Integer-Centbetrag, Rhythmus, Fälligkeit, Gültigkeit und Quelle erfasst.
2. Kontostand wird mit Stichtag, Erfassungszeit, Actor und Quelle `manual` bestätigt.
3. Geschützte Gehaltsplanung liefert nur ein berechtigtes Aggregat.
4. Jeder Write erzeugt Receipt und unabhängigen Readback.
5. Alter des Kontostands wird gegen die konfigurierte Schwelle geprüft.

**Ergebnis + Receipt/Readback:** Versionierte Eingabefacts und gegebenenfalls Konflikt „Kontostand veraltet“.

**Fehlerfälle:** negative/unsichere Werte, überschneidende Gültigkeit, denied Gehaltsaggregat, veralteter Kontostand, Versionskonflikt.

**Sperren/Konflikte:** K-M01-002, K-M01-015, K-M01-016.

### F-M01-013 — Liquiditätsdaten für 30 Tage liefern

**Auslöser:** M02 liest den M01-Faktenport oder eine Person öffnet die Datenabdeckung.

**Personen:** berechtigte Nutzer und M02-Servicekontext; Admin kann personenbezogen sperren/erweitern.

**Schritte:**

1. M01 liest offene Posten/erwartete Eingänge, Fixkosten, manuellen/bestätigten Kontostand und geschützte Personalkostensumme.
2. Jede Quelle behält Standzeit, Coverage und Redaktionen.
3. M01 liefert ausschließlich Fakten und Datenlücken, keine Forecast- oder Entscheidungsaussage.
4. M02 berechnet Liquidität 30 Tage in eigener Version und verweist auf die M01-Quellstände.

**Ergebnis + Receipt/Readback:** Versionierter ReadEnvelope; Reads erzeugen kein Domain-Receipt.

**Fehlerfälle:** fehlende Quelle, stale Kontostand, partial Fixkosten, denied Gehalt, unterschiedliche Standzeiten.

**Sperren/Konflikte:** K-M01-003, K-M01-015, K-M01-016.

### F-M01-014 — Aufbewahrung prüfen und Anonymisierung freigeben

**Auslöser:** Eine Retentionprüfung findet Dokumente/Facts nach Ablauf der Mindestfrist.

**Personen:** alle dürfen eigenen Status sehen; Freigabe nur Admin-Capability.

**Schritte:**

1. Policy bestimmt Dokumentart, Fristbeginn, Mindestfrist und Ablaufhemmung.
2. Vor Fristablauf ist jede Lösch-/Anonymisierungsaktion gesperrt.
3. Nach Fristablauf entsteht nur ein Vorschlag mit betroffenen Daten, Wirkung und erhaltener Aggregation.
4. Admin bestätigt explizit; der Command erzeugt Receipt und unabhängigen Readback.
5. Zahlen/Aggregate bleiben nur in zulässiger anonymisierter Form erhalten.

**Ergebnis + Receipt/Readback:** Nachvollziehbare Freigabe oder Nullmutation; niemals stilles Löschen.

**Fehlerfälle:** offene Prüfung/Ablaufhemmung, falsche Dokumentart, unvollständige Preview, fehlende Admin-Capability, Antwortverlust.

**Sperren/Konflikte:** K-M01-002, K-M01-017.

## Zustände — verbindlich für F-M01-001 bis F-M01-014

Die Tabelle gilt für jede Funktion. Wo ein Funktionsscreen noch keine gültige Optikvorlage besitzt, ist der wörtliche Text bewusst nicht erfunden und in Q-M01-011 an Designphase 1b übergeben. Die drei Statuswörter sind durch die Anleitung belegt.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Reale, quellengebundene Facts mit Stand, Coverage und erlaubten Aktionen; je Funktion konkrete Inhalte gemäß Abschnitt. | `FEHLT → Q-M01-011` | Designphase 1b; Inhalte dieses Dossiers |
| lädt | Ruhiger Ladezustand ohne erfundene Werte und ohne mutierende Aktion. | `FEHLT → Q-M01-011` | Designphase 1b |
| leer | Ehrlicher Leerzustand mit höchstens einer real verfügbaren nächsten Handlung. | `FEHLT → Q-M01-011` | D-RES-001; Designphase 1b |
| Fehler | Fehlerwirkung, sicherer Datenstand, nächster erlaubter Schritt und kopierbare Correlation-ID. | `FEHLT → Q-M01-011` | D-RES-001; Designphase 1b |
| gesperrt | Aktion bleibt deaktiviert; Grund und erlaubter Rückweg sind sichtbar. | „Gesperrt“ | Anleitung §8; D-RES-001 |
| In Klärung | Gedämpftes nicht klickbares Element für offene Entscheidung; keine Route. | „In Klärung“ | Anleitung §§6/8; OE-2609-04 |
| In Aufbau | Gedämpftes nicht klickbares Element für entschiedene, noch nicht angebundene Funktion; keine Route. | „In Aufbau“ | Anleitung §§6/8; OE-2609-04 |
