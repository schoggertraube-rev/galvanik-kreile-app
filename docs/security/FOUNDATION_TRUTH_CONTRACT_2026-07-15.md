# Foundation Truth Contract 2026-07-15

Status: fachlicher Fundamentvertrag fuer die laufende Hardening-Mission. Keine UI-Spezifikation und keine Behauptung eines Live-Rollouts.

Abgeleitet aus der vom Auftraggeber bereitgestellten USP-Neupositionierung, den User-Twins Michael, Rolf und Philipp, der Ideensammlung 3.0 sowie den fuenf Ideenkatalogen Home, Auftragsbuch/Kundenkartei, Warendurchlauf, Betriebs-Cockpit und Performance/Analyse/KI.

## 1. Lieferwahrheit

Eine Funktion gilt nur dann als echt, wenn der produktive Pfad nachweisbar diese Kette schliesst:

1. reale Quelle oder bewusst manuelle Eingabe,
2. Authentifizierung, Tenant- und Berechtigungspruefung,
3. Schema-, Format- und Plausibilitaetsvalidierung,
4. dauerhafte, idempotente Speicherung oder ein ausdruecklich benannter Read-only-Pfad,
5. Verknuepfung mit den betroffenen Kernobjekten,
6. Audit-/Provenienzspur,
7. ehrlicher Fehler-, Retry-, Review- oder Offline-Zustand,
8. positiver und negativer Nachweis.

Eine Route, Kachel, Action oder Provider-Methode mit leerem Array, Nullobjekt, erfundener Zahl, `Math.random`, verschlucktem Fehler, Demo-Fallback oder nicht persistierendem Erfolg ist keine fertige Funktion.

## 2. Wahrheitsklassen

| Klasse | Bedeutung | Zulaessige Nutzung |
|---|---|---|
| A - intern bestaetigt | Mensch oder harter Systemvertrag hat bestaetigt | operative und kaufmaennische Entscheidung |
| B - intern abgeleitet | deterministisch aus echten App-Daten berechnet | Entscheidung mit Formel und Datendeckung |
| C - extern belegt | Provider/Register/Web mit Quelle und Abrufzeit | Kontext; nicht alleinige Wahrheit |
| D - KI-Vermutung | Modellinterpretation mit Annahmen | Vorschlag; menschliche Freigabe |
| E - ungeklärt | Quelle/Zuordnung/Confidence reicht nicht | Eingangskorb oder Review, niemals still uebernehmen |

`0`, `[]` und `null` duerfen nur reale Nullmengen oder klar typisierte Abwesenheit bedeuten. Unverfuegbarkeit, fehlende Konfiguration, zu geringe Datenreife und Providerfehler brauchen voneinander unterscheidbare Zustaende.

## 3. Pflichtnetz der Kernobjekte

- Auftrag -> Tenant, Kunde, Ansprechpartner, Teile/Objekte, Stationen, Frist, Verantwortliche, Kommunikation, Dokumente, Fotos, Zeit, Material, Kosten, Rechnung, Zahlung, Reklamation, Nacharbeit und Audit.
- Beleg -> Tenant, Originalnachweis, Lieferant, Kategorie/Konto, Auftrag/Kostenstelle soweit bekannt, Zahlung, OCR-Quelle, Confidence, Pruefstatus und Korrekturhistorie.
- Ausgangsrechnung -> Tenant, Kunde, Auftrag, Positionen, Faelligkeit, Zahlung/Mahnung und Audit.
- Zahlung -> Tenant, Provider, Provider-ID, Attempt/Idempotenz, Quote-Version, Betrag/Waehrung, Auftrag, Kunde ueber Auftrag, Rechnung und Providerstatus.
- Marketingaktion -> Zielgruppe/Segment, Kanal, Zeitraum, Kosten, Reichweite, Reaktion, Anfrage/Lead, Auftrag, Rechnung/Umsatz, Marge und Lerneffekt.
- KI-Ausgabe -> Nutzer/Tenant, Zweck, verwendete Objekt-IDs und Datenzeitraeume, Quellenklassen, Annahmen, fehlende Daten, Confidence, Modell/Version, Kosten-/Quota-Bezug und menschliche Entscheidung.

Kein Objekt darf nur als isolierte Anzeige existieren, wenn die Fachunterlagen eine Beziehung verlangen.

## 4. Connector-Vertrag

Jeder externe Connector braucht mindestens:

- `not_configured`, `ready`, `degraded`, `unavailable`, `review_required` als explizite Betriebszustaende,
- minimalen geheimen Scope und serverseitige Secret-Nutzung,
- feste Tenant-Zuordnung,
- zeitbegrenzte Requests und begrenzte Payloads,
- Idempotency-Key oder dedizierten Deduplizierungsschluessel,
- Quell-ID, Abrufzeit, Originalnachweis/Hash und Verarbeitungsstatus,
- Retry mit Obergrenze sowie Dead-letter/Review statt Endlosschleife,
- Audit fuer fachliche Zustandsaenderungen,
- keine Erfolgsmeldung, bevor die zugesagte Wirkung durable ist.

Provider-Wahrheit ersetzt keine lokale Zulassung. Webhooks muessen zuerst lokal einem vorregistrierten Vorgang zugeordnet werden, bevor kostenpflichtige oder amplifizierbare Providerabfragen erfolgen.

## 5. Buchhaltung und Analyse

- Kennzahlen werden deterministisch aus echten Datensaetzen berechnet; eine KI formuliert hoechstens die Erklaerung.
- Jede Kennzahl braucht Formel, Zeitraum, Tenant, Quelldatensaetze, Abdeckung und benannte Datenluecken.
- Fehlende Zuordnung ist keine Null: Beispiel `Umsatz nach Station noch nicht zuordenbar` statt erfundener Prozentsaetze oder `0 EUR`.
- Providerfehler werden nicht in leere BWA-, UStVA-, Einsparungs- oder Kostenobjekte uebersetzt.
- Analysen sind read-only; Mutationen liegen in gesonderten, berechtigten und auditierten Actions.
- Zahlung, Rechnung, Auftrag und Kunde bilden eine transaktional nachvollziehbare Kette.

## 6. Marketing

Marketing ist erst vernetzt, wenn Aktion -> Zielgruppe -> Kosten -> Reichweite/Antwort -> Anfrage -> Auftrag -> Umsatz/Marge -> Lerneffekt nachvollziehbar ist. Content-Erzeugung ohne Attribution und durable Ergebnisspur ist kein fertiges Marketingmodul.

## 7. KI und Automatisierung

- Regeln, SQL, Views und Templates zuerst; Modellaufruf nur fuer echte Unsicherheit oder Sprache/Vision.
- Quota wird vor jedem kostenpflichtigen Aufruf atomar und fail-closed verbraucht.
- Readonly darf keine kostenpflichtige, persistierende oder fachlich mutierende KI-Aktion ausloesen.
- Modellantworten muessen strukturell validiert werden; keine autonome Steuer-, Rechts-, Zahlungs- oder Personalentscheidung.
- Bei unzureichenden Daten lautet das Ergebnis `nicht belastbar` plus konkrete Datenluecke, nicht eine plausible Erfindung.
- Vorgeschlagene Aktionen bleiben `pending_review`, bis Berechtigung, Zielobjekt und Persistenz bestaetigt sind.

## 8. Rollen und Nutzer-Twins

- Michael: wenige Eingaben, klare Zusagen/Fristen, kein Zwang zu technischer Interpretation.
- Rolf: Finanz- und Entscheidungswahrheit, Quellen und Auswirkungen; `perm_view_prices` bleibt die vorhandene Schranke.
- Philipp: transparenter Produktionskontext und schrittweise Verantwortung; keine stillschweigende globale Finanzberechtigung.
- Neue Rollen oder breitere Rechte werden nicht aus Personas erfunden, sondern als Produktentscheidung behandelt.

## 9. Offline- und Ausfallsicherheit

Kernereignisse duerfen bei Netzausfall nicht als erfolgreich verschwinden. Capture-/Statuspfade brauchen einen dauerhaften Outbox-Zustand mit Tenant/User, Client-ID, Zeit, Payload-Hash, Retry-Zahl, Konfliktstatus und sichtbarer Synchronisationswahrheit. Bis ein solcher Pfad real existiert, darf Offline-Faehigkeit nicht behauptet werden.

## 10. Abnahmegate fuer das Fundament

Vor dem UI-Ausbau muessen mindestens erfuellt sein:

- alle Security-Scan-Befunde geschlossen oder mit echter externer Grenze benannt,
- keine produktiven Mock-/Null-Erfolgsprovider in Buchhaltung, Analyse, Marketing oder Capture,
- Kernrelationen und Providerzustaende schema- und testseitig abgesichert,
- gezielte Tests plus Typecheck/Build/Lint-Ratchet in belastbarem Zustand,
- vorbereitete Migrationen lokal real ausgefuehrt und remote nur nach Freigabe,
- unabhaengiges Read-only-Review,
- Draft-PR und Vercel Preview ohne Production-Promotion.
