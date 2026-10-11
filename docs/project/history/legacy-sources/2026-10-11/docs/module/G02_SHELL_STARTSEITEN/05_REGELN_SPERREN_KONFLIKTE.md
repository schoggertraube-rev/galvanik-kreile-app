<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Regeln, Sperren und Konflikte

G09 besitzt Erkennung, Deduplizierung und Zuständigkeitsvertrag. G02 besitzt nur die sichere Darstellung am festgelegten Startseitenort. Keine Zeile dieser Datei berechtigt G02, eine Besitzerregel lokal nachzubauen.

## 1. Sperren (vorbeugend)

| Sperre | verhindert | Ebene (UI/Server/DB) | Beleg | Stand |
|---|---|---|---|---|
| S-G02-001 Tenantgebundene Sitzung | Fremdtenant- oder Fallback-Startseite | Server/DB | D-ARCH-009; `authorization.ts` | GEBAUT |
| S-G02-002 Aktive, eindeutige Produktidentität | Rollenraten und Zugriff mit deaktivierter Person | Server | `resolveProductActorAuthorization`; Root-Route-Test | GEBAUT |
| S-G02-003 Effektive Capability je Ziel | Sichtbarer oder direkt aufrufbarer gesperrter Bereich | UI/Server | OE-2609-09; G01-Grenze | SPEZ |
| S-G02-004 Geräteklasse ausschließlich aus Viewport | Rollenabhängige oder doppelte Navigation | UI | Owner 2026-09-24; `MockAppFrame.tsx` | GEBAUT |
| S-G02-005 Kein Startseiten-Schreibweg | Zweite Auftrags-, Konflikt- oder Kalenderwahrheit | UI/Server | D-ARCH-009; G09-Schnittstellenvertrag | SPEZ |
| S-G02-006 Validierter `ConflictFeedV1` | Karten ohne stabile Identität, Besitzer, Zuständigkeit oder Quelle | Server/UI | G09 `04_SCHNITTSTELLEN_DATEN.md` | SPEZ |
| S-G02-007 Owner-Transfergate | Fake-Kalender, Fake-Analyse oder klickbare leere Route | UI/Server | OE-2609-04, OE-2609-19, OE-2609-22 | SPEZ |
| S-G02-008 Sichere Deep-Links | Tote/private Links und Umgehen der Zielautorisierung | UI/Server | G09 RoutingPort; D-ARCH-009 | SPEZ |
| S-G02-009 Keine technische Quelle als Fachalarm | Falsche Konfliktzähler bei Provider-/Read-Fehler | UI/Server | G09 K-G09-010 | SPEZ |
| S-G02-010 Kein altes Warning-System | Schattenzustand durch WarningBell, Drawer, Store, Registry, Snooze/Resolve | Importgrenze/UI | G09 Altsystementscheidung; RT-08 | SPEZ |

## 2. Konflikte und Anzeigeorte

### Referenzierbare Anzeigeorte für Handlungsbedarf

Gemäß `AUFTRAG_NACHARBEIT_2026-09-26.md` referenzieren andere Dossiers einen Anzeigeort mit Person, persönlicher Startseite und dem folgenden wörtlichen Text; ein allgemeiner Ort „Handlungsbedarf“ ohne diese Zuordnung ist nicht eindeutig.

| Person | Persönliche Startseite | Anzeigeort (wörtlicher Text) | Beleg | Abgrenzung |
|---|---|---|---|---|
| Rolf | „Der Tag“ | oberster Bereich „Das braucht dich“ | `../../00_BIBEL/design und klickpfade UI/KREILE_STARTSEITE_ROLF_V8_2026-08-20.html` (Bereichstitel); `../00_PROJEKT/OWNER_ENTSCHEIDUNGEN_2026-09-25_26.md` (OE-2609-10) | Rolf zugeordnete operative Fälle erscheinen hier. |
| Phillip | „Werkstatt“ | oberster Bereich „Heute sichern“ | `../../00_BIBEL/design und klickpfade UI/KREILE_STARTSEITE_PHILLIP_V4_2026-08-20.html` (Bereichstitel); `../00_PROJEKT/OWNER_ENTSCHEIDUNGEN_2026-09-25_26.md` (OE-2609-10) | Phillip zugeordnete operative Fälle erscheinen hier. |
| Gregor | „Einstellungen“ | Hinweis „Microsoft-Verbindung abgelaufen“ auf Gregors Startseite | `../../_DESIGN_VERBINDLICH/CLAUDE_DESIGN_AUFTRAG_KREILE_2026-09-26.md` §8 | Dies ist der belegte administrative Handlungsbedarf; ein allgemeiner G09-Konfliktbereich für Gregor ist nicht belegt. Operative Konflikte gehen gemäß `../00_PROJEKT/OWNER_ENTSCHEIDUNGEN_2026-09-25_26.md` (OE-2609-10) an Rolf beziehungsweise Phillip. |

| ID | Auslöser | Erkennung | zuständig (Rolf/Phillip/Gregor) | Anzeigeort (Startseite-Bereich) | Auflösung | Stand |
|---|---|---|---|---|---|---|
| K-G09-001 | Version/Receipt nach Schreiben nicht eindeutig oder veraltet | Besitzer-Receipt und kanonischer Readback widersprechen | Rolf oder Phillip gemäß auslösendem Vorgang | jeweilige Startseite oben; nur wenn nicht bereits inline und Fall offen | Besitzerobjekt öffnen, Receipt/Readback wiederholen | SPEZ; Anzeige FEHLT |
| K-G09-002 | Netzwerkabbruch lässt Command-Ausgang ungeklärt | idempotenter Command ohne eindeutigen Receipt/Readback | Rolf oder Phillip gemäß Vorgang | jeweilige Startseite oben, falls nicht inline lösbar | Besitzerobjekt öffnen, Ausgang sicher prüfen | SPEZ; Anzeige FEHLT |
| K-G09-003 | Ungültiger Stationsübergang | Orders-Lifecycle/Command weist Übergang ab | Phillip | „Heute sichern“ | Auftrag öffnen und zulässigen Schritt ausführen | SPEZ; Anzeige FEHLT |
| K-G09-004 | Pflichtbeleg oder Integrität für Arbeitsschritt fehlt | Orders-/Evidence-Port liefert belegte Lücke | Phillip | „Heute sichern“ | Auftrag öffnen, Evidenz vervollständigen | SPEZ; Anzeige FEHLT |
| K-G09-005 | Preis, Kundenfreigabe oder Geschäftsfakt ist ungeklärt | Besitzer-Port meldet reale, entscheidungsbedürftige Abweichung | Rolf | „Das braucht dich“ | Auftrag oder Kunde öffnen und kanonisch entscheiden | SPEZ; Anzeige FEHLT |
| K-G09-006 | Warenausgang ist durch Zahlung, Rechnung oder Status blockiert | Payment Summary `goods_out_allowed = false` mit Grund | Rolf; Phillip nur Inline-Status | Rolf „Das braucht dich“; bei Phillip kein zweiter Home-Fall | Zahlung/Rechnung/Auftrag im Besitzer-Modul klären | SPEZ; Anzeige FEHLT |
| K-G09-007 | Fälliger/überfälliger Auftrag ist nicht fertig | Frist plus kanonischer Lifecycle | Phillip bei physischer Arbeit; Rolf bei Kundenentscheidung | Phillip „Heute sichern“ oder Rolf „Das braucht dich“, nie doppelt | Auftrag öffnen und Besitzerhandlung ausführen | Basis-Priorität GEBAUT; Zuständigkeit/Anzeige SPEZ |
| K-G09-008 | Termin fehlt, ist ungültig oder muss verschoben werden | Orders-/Calendar-Fakten melden belegte Terminkollision oder fehlende Frist | Rolf | „Das braucht dich“ | Auftrag öffnen und Terminweg ausführen | SPEZ; M04 FEHLT |
| K-G09-009 | Auftrag überlappt Abwesenheit/Betriebstermin derselben Person/Ressource | M04-Projektion plus Orders-Fakten | Rolf; Phillip erst bei neuer physischer Aufgabe | Rolf „Das braucht dich“; Phillip nur nach G09-Neuzuordnung | Auftrag öffnen und Termin/Aufgabe neu ordnen | SPEZ; M04 FEHLT |
| K-G09-010 | Kalenderquelle ist nicht verbunden oder fehlerhaft | `CalendarPort` Health/Sync-Status | Rolf verantwortlich; Phillip sieht nur Quellstatus | separater Quellstatus, nicht im Fachzähler | M04-Verbindung im Besitzerweg herstellen | SPEZ; M04 FEHLT |
| K-G09-011 | Auftrag liegt aktuell in Werkstattstation | kanonischer Stationszustand | Phillip | „Heute sichern“ beziehungsweise WIP-Hinweis, nicht als Konflikt | Auftrag öffnen | GEBAUT als WIP; G09-Klassifikation SPEZ |
| K-G09-012 | Mindestens zwei offene Teile besitzen dieselbe normalisierte Oberfläche | integritätsgeprüfte Teile-/Auftragsprojektion | Phillip | „Heute sichern“ als Bündelhinweis | gefilterte Aufträge öffnen; keine Kompatibilität behaupten | Basis GEBAUT; Normalisierung/Port SPEZ |
| K-G09-013 | Belegte Kundendublette | G05 liefert expliziten Dublettenfall, nicht bloße Namensähnlichkeit | Rolf | „Das braucht dich“ | Kundenfall öffnen; keine automatische Fusion | SPEZ; Anzeige FEHLT |
| K-G09-014 | Phillip gibt eine Auftragsaufgabe an Rolf zurück | persistiertes `ORDER_TASK_HANDED_BACK_V1`/Assignment-Readback | Rolf | „Das braucht dich“ | Auftrag öffnen und Aufgabe übernehmen/neu zuweisen | SPEZ; Anzeige FEHLT |
| K-G09-015 | Auftragsnummer kollidiert beim Intake | G03/G04 Command weist eindeutige Nummernkollision ab | Rolf | zunächst Intake inline; Home nur als offener Wiederaufnahmefall | Intake-Fall öffnen und kanonisch fortsetzen | SPEZ; Anzeige FEHLT |
| K-G09-016 | Kapazität kann mangels ratifizierter Quelle nicht bewertet werden | benötigte Kapazitätsfakten fehlen oder sind unvollständig | Rolf und Phillip als Status, nicht als Alarm | graue Statuskarte „Konflikte & Kapazität — In Klärung“ | keine Aktion bis PL/Owner-Entscheidung | SPEZ; sicher abgegrenzt |
| K-G09-017 | Snooze oder freie Delegation eines nicht auftragsbezogenen Falls wäre nötig | G09-Vertrag bietet bewusst keinen solchen Command | Rolf | keine Aktion rendern | Besitzerweg nutzen; keine lokale Snooze-/Delegationslogik | SPEZ |

## 3. Darstellungsregeln

- Priorität: `blockierend`/`dringend` vor `wichtig`; reine Hinweise gehören nicht in den oberen Handlungsbedarf, sofern G09 keinen konkreten nächsten Schritt liefert.
- Deduplizierung erfolgt nach G09-`key`, nicht nach Titel oder Freitext.
- Leerer Konfliktfeed erzeugt keinen leeren Kasten und keinen Erklärtext; der Tagesüberblick rückt nach oben.
- `partial` oder eine fehlgeschlagene Quelle zeigt einen getrennten Quellstatus und macht keine Aussage „alles in Ordnung“.
- Karten zeigen höchstens eine sichere Primäraktion, die in das Besitzerobjekt führt.
- Gregor erhält keine automatisch erfundene Konfliktsektion; technische Administration bleibt in G01/G10.
