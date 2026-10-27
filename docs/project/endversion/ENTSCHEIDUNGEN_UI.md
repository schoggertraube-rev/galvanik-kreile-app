# ENTSCHEIDUNGEN_UI – Kreile WerkstattCockpit

Stand 2026-10-27 · Owner: Siglinder · erstellt für die ENDVERSION (spec.json / index.html)

**Regel:** Ab jetzt ist diese Datei die einzige Quelle für UI-Entscheidungen (Design, Inhalt, Klickwege, Gestaltung, Rollen, Pflichtfelder, Stufen). Chats werden nicht mehr herangezogen. Neue Entscheidungen werden hier als neue Zeile eingetragen; alte Zeilen bleiben stehen und bekommen „überholt durch U-xxx“.

**Rang bei Widerspruch:** neuere Owner-Aussage vor älterer. Bei gleichem Datum: Owner-Aussage im Chat vor Ableitung des PL/Design-Chats. Nicht auflösbare Widersprüche stehen unter „Widersprüche“ und gehen einzeln an den Owner.

## Quellen

Verwendet wurden nur Endstände (Owner 2026-10-27: „wenn die Chats alles abgelegt haben und das vollständig ist, sind das die finalen Versionen“).

| Kürzel | Quelle | Stand | Vollständig? |
|---|---|---|---|
| EV | Endversion-Startauftrag (dieser Chat) – https://claude.ai/code/session_013errgLmVJhJycmC8hiCNP3; festgehalten in `spec.json` → `owner_regeln` OR-01…10 | 2026-10-27 | ja |
| CX | Chat „Projektplanung mit Codex“ – https://claude.ai/chat/d01200ee-3cf4-4943-985b-18e53304bbdf | 2026-10-25…27 | ja |
| REG | `02_app/docs/project/linie/KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md` (operative Fassung laut D-GOV-002) | 2026-10-11 | ja |
| OE | `_MODULDOSSIERS/00_PROJEKT/OWNER_ENTSCHEIDUNGEN_2026-09-25_26.md` (OE-2609-01…33, im REG unter D-GOV-003 disponiert) | 2026-09-28 | ja |
| DSA | Design-Bundle: `_DESIGN_VERBINDLICH/BUNDLE_DESIGN_KREILE_2026-09-26.zip` → `01_AUFTRAG_DESIGN_KREILE.md` (§6 Prüfkriterien) | 2026-09-26 | ja |
| P11 | `_DESIGN_VERBINDLICH/PROMPT_DESIGN_V1_1_2026-09-27.md` (V1.1-Auftrag, Teil D „nicht übernehmen“) | 2026-09-27 | ja |
| OF | `_DESIGN_VERBINDLICH/designsystem_v1_1/OFFENE_FRAGEN_DESIGN.md` (OF-01…44 mit Owner-Antworten) | 2026-09-27 | ja |
| FRG | `_DESIGN_VERBINDLICH/FREIGABE_DS_V1.txt` + `PRUEFUNG_DESIGN_V1_1_2026-09-27.md` | 2026-09-27 | ja |
| SU | Searchbundle: `00_BIBEL/_parallel/suche/LIEFERUNG_V1/search-modul/LIEFERSCHEIN.md` | 2026-08-18 | ja (Status PASS, eine gemeldete Lücke) |
| MM | Modul-Mindmap: `_MODULDOSSIERS/00_PROJEKT/QUELLEN/KREILE_MODUL_MINDMAP_V2_2026-08-15.html` | 2026-08-15 | ja; laut eigenem Vermerk „Arbeitsgrundlage, keine freigegebene Entscheidung“, im REG nur REFERENCE_ONLY (OE-2609-16) |

**Chats ohne eigene Zeilen:**
- M1A-2.5-Chats (27.08.–02.09.): UI-Vertrag M1A-2.5. Sie sind älter als D-UI-CORE-001 und alle folgenden Einträge, die jede UI-Aussage daraus ersetzen. Einzeln ausgewertet habe ich sie nicht.
- „Prozessneugestaltung“ (24.06.) und „Antigravity-App Ideensammlung“ (27.05.): Frühphase, ganz überholt.

**Lücke:** Für „Modular App Planning“ gibt es keine eigene Ablage. Die Stufen-Entscheidungen stammen aus CX und EV. Falls dort etwas Abweichendes beschlossen wurde, wird der Link gebraucht.

## Entscheidungen

### Quellen-Schichtung und Optik
| ID | Entscheidung | Bereich | Datum | Quelle | Status |
|---|---|---|---|---|---|
| U-001 | Geschichtete UI-Wahrheit: DS V1.1 = Tokens, Typografie, Komponenten, responsiv; Rolf V8, Phillip V4, Auftragskarte V8, Kundenkarte V2 = Seitenkomposition/Rollenlayout; Gesamtmock V5 = Ablauf und Zwischenschritte; V2/V3/V4/V6 und DS V1/V2 kein Bauinput | Quellen | 2026-10-11 | REG D-UI-DS-001 | gilt (Größen: U-004) |
| U-002 | V5 ist einzige Zielvorlage (1:1) | Quellen | 2026-09-21 | REG D-UI-V5-003 | überholt durch U-001 (V5 nur noch Ablauf) |
| U-003 | V6 (UI-Bibel, D-UI-V6-001…004) verworfen, kein Bauinput | Quellen | 2026-09-21 / 09-28 | REG D-UI-V5-003, D-GOV-002 | gilt |
| U-004 | Farben V1.1; Größen und Bedienbarkeit wie V8; Touch-Ziel ≥ 48 px | Optik | 2026-10-27 | EV OR-02 | gilt (ersetzt die Größen aus DS V1.1; umgesetzt in `groessen_v8.css`) |
| U-005 | Flächen neutral statt bräunlich: `--ground #F4F2EE`, `--surface #FFFFFF`, `--line #E4E0D8`, `--ground-rail #EFEDE8`, neu `--rand`, `--flaeche`; Navy, Signalfarben, Marken-Verlauf aus V5 | Optik | 2026-09-27 | OE-2609-30, OF-41 | gilt |
| U-006 | Verbindlich ist die hellere, weißere neueste Version, nicht die beigen älteren Vorlagen | Optik | 2026-10-26 | CX | gilt (= U-005) |
| U-007 | Fraunces (sparsam) + Inter; reines CSS mit `kr-`-Präfix; kein Tailwind in DS-Komponenten; kein Dark-Mode | Optik | 2026-09-25/26 | OE-2609-03, DSA §5 | gilt |
| U-008 | Optik bleibt über alle Stufen gleich; Stufen fügen nur Funktionen hinzu | Optik/Stufen | 2026-10-25 | CX | gilt |
| U-009 | Kleine Optikänderungen erst Mitte Dezember; jetzt fertig bauen | Optik | 2026-10-26 | CX | gilt |
| U-010 | Demo-Daten der Mocks (Mustermann, 300 SL …) sind nie Produktdaten | Inhalt | 2026-09-14 | REG 00_UI_REFERENZEN | gilt |

### Anzeige-Grundsätze
| ID | Entscheidung | Bereich | Datum | Quelle | Status |
|---|---|---|---|---|---|
| U-011 | Handlungsbedarf zuerst; jeder Eintrag trägt seine Aktion (1 Tipp); ist nichts dringend, entfällt der Block (keine „Alles gut“-Fläche) | Inhalt | 2026-09-26 | OE-2609-26/27, DSA §6.1 | gilt |
| U-012 | Handlungsbedarf und erster Tagesüberblick ohne Scrollen bei 1914×917, 1220×880, 390×844 | Gestaltung | 2026-09-26 | DSA §6.2 | gilt |
| U-013 | Genau eine Überschrift je Seite; keine Overline, Unterzeile (auch keine Wochentag-/Datumszeile), kein Slogan, keine überflüssige Abschnittsüberschrift | Gestaltung | 2026-09-26/27 | DSA §6.3, P11 D | gilt |
| U-014 | Keine Erklärtexte, Legenden oder Beschriftungserklärungen; Bedeutung über Form, Farbe, Symbol **mit** Kurzlabel | Gestaltung | 2026-09-26 | DSA §6.4 | gilt |
| U-015 | Keine Doppelungen; Navigationszähler nur als Konflikt-Zähler an „Der Tag“ (Rolf) | Gestaltung | 2026-09-26 | DSA §6.5, OF-04 | gilt |
| U-016 | Kachelhöhe = Inhalt; Listeneintrag max. 2 Zeilen (Titel + 1 Meta), Aktion rechts; keine Riesenzahlen; „In Arbeit“ als eine ruhige Menge | Gestaltung | 2026-09-26 | DSA §6.6, OF-03 | gilt |
| U-017 | Leer/Fehler ehrlich: eine Zeile Datenlage + genau ein verfügbarer nächster Schritt; nichts Erfundenes | Inhalt | 2026-09-15/26 | REG D-UI-V5-002, DSA §6.7 | gilt |
| U-018 | Kerninfo nie mit „…“ kürzen (Titel darf 2 Zeilen umbrechen), nur die Meta-Zeile kürzt | Gestaltung | 2026-09-27 | P11 A3 | gilt |
| U-019 | Galvanik = ein Schritt: keine Bäder/Stationen; Stationsband, Transport-Kanban, „In Galvanik starten“, Bad-Sprache auf Startseiten verworfen | Inhalt | 2026-09-06/10 | REG D-ARCH-010, 00_UI_REFERENZ_KANONISCH | gilt |

### Stufen und Ausgrauen
| ID | Entscheidung | Bereich | Datum | Quelle | Status |
|---|---|---|---|---|---|
| U-020 | Nicht Angebundenes nur als ausgegrautes **Element** (Kachel/Zeile/Knopf/Navigationseintrag), eine Zeile, nicht klickbar, „In Aufbau“ oder „In Klärung“; nie ganze Route/Fläche, nie „kommt bald“ | Stufen | 2026-09-25 | OE-2609-04, DSA §6.8 | gilt; für Stufen-Sperren ergänzt durch U-022 |
| U-021 | KI-/OCR-/Provider-Funktionen ohne Vertrag unsichtbar | Stufen | 2026-09-14 | REG D-UI-V5-001 | überholt durch U-020 und U-086 |
| U-022 | Stufen 1–4 per Schalter; nicht Freigeschaltetes grau mit „geplant“; DATEV = Add-on in Stufe 2, standardmäßig aus | Stufen | 2026-10-27 | EV OR-08 | gilt (auch für Analyse, U-164) |
| U-023 | Stufe 1 = verkaufbares, voll funktionierendes Minimum ohne Sackgassen (Daten rein/raus, u. a. M365 und OCR-Eingang); spätere Pakete als ausgegraute Knöpfe/Anschluss-Stellen sichtbar | Stufen | 2026-10-25 | CX | gilt |
| U-024 | Stufe 1 richtet sich an Kreiles Engpässen aus: Struktur, Termintreue, Überblick | Stufen | 2026-10-25 | CX | gilt |
| U-025 | Module entfallen nicht, sie sind hinten angestellt (Buchhaltung, Analyse, Unternehmensführung) | Stufen | 2026-09-25 | OE-2609-05, REG D-GOV-003 | gilt; überholt MM „entfällt bewusst“ |
| U-026 | Analyse-Menüpunkt erscheint erst nach realer Anbindung, **keine ausgegraute Route**; Startseiten zeigen daraus nur Dringendes | Stufen/Navigation | 2026-09-26 | OE-2609-22, REG D-GOV-003 Nr. 2 | Teil „keine ausgegraute Route“ überholt durch U-164; Rest gilt |
| U-027 | Keine Sackgassen, in jeder Stufe | Klickwege | 2026-10-25/27 | CX, EV | gilt |
| U-028 | Kein zentrales Backend über alle Kunden-Apps; Kunde erhält fast die ganze App, nicht alles freigeschaltet | Stufen | 2026-10-26 | CX | gilt |

### Rollen und Rechte
| ID | Entscheidung | Bereich | Datum | Quelle | Status |
|---|---|---|---|---|---|
| U-030 | Sichtbar nur Rolf (meister), Phillip (werkstatt), Gregor (developer = Owner); technische Rollen bleiben serverseitig; die Spec nennt Rollen, nicht Namen | Rollen | 2026-09-25 / 10-27 | OE-2609-02, REG D-UI-V5-002, EV | gilt |
| U-031 | Jede Person darf alles, außer der Admin sperrt oder erweitert je Person; gesperrte Bereiche verschwinden aus der Navigation, ein Direktaufruf zeigt „gesperrt“ | Rollen | 2026-09-26 | OE-2609-09, OF-08 | gilt; überholt die engen Rechte aus D-UI-V5-002 |
| U-032 | Rolf (Inhaber) und Siglinder dürfen in der App alles bestimmen | Rollen | 2026-10-26 | CX | gilt |
| U-033 | Phillip sieht nie Geld (keine Beträge, kein Zahlungsstatus, nur „Freigabe fehlt“) | Rollen | 2026-09-26 | DSA §6.9, Phillip V4 | gilt |
| U-034 | Genau eine Startseite je Login: meister „Der Tag“, werkstatt „Werkstatt“, developer Einstellungen | Rollen | 2026-09-06/10 | REG #7, D-UI-CORE-002 A | gilt |
| U-035 | Navigation folgt dem Gerät, nicht der Rolle | Navigation | 2026-09-26 | DSA §2 | gilt |
| U-036 | Stufe 1: drei Nutzer; neue Nutzer später schnell anlegbar | Rollen | 2026-10-25 | CX | gilt |
| U-037 | Idee für später: modulare Startseite, die jede Person selbst konfiguriert wie einen Handy-Desktop | Startseite | 2026-10-27 | EV | vorgemerkt, nicht Stufe 1 |

### Shell und Navigation
| ID | Entscheidung | Bereich | Datum | Quelle | Status |
|---|---|---|---|---|---|
| U-040 | Shell in Rolf-V8-Machart: Seitenleiste am Desktop; Dock auf Tablet/Handy „Der Tag · Aufträge · Kunden · Geld · Mehr“ („Mehr“ Pflicht) | Navigation | 2026-09-10/27 | REG D-UI-CORE-002 B, P11 D | gilt |
| U-041 | Hauptziele: Der Tag, Werkstatt, Aufträge, Kunden & Kontakt, Geld & Rechnungen, Einstellungen; Kalender als Menüpunkt erst nach realer M365-Abnahme | Navigation | 2026-09-10 | REG D-UI-CORE-002 B | gilt |
| U-042 | Werkstatt: Kompaktkopf + feste Navy-Aktionsleiste mit 5 Aktionen (Auftrag öffnen/scannen · Mehrarbeit · Fertig melden · Neuer Eingang · Ware raus); nie auf dem Rolf-Desktop | Navigation | 2026-09-10/26 | 00_UI_REFERENZ_KANONISCH, DSA §7.3 | gilt |
| U-043 | Phillip erreicht weitere Bereiche über das Konto-Menü: Aufträge, Kunden, Einstellungen, Abmelden; kein Geld | Navigation | 2026-09-26 | OF-09 | gilt, Umfang: U-166 |
| U-044 | Phillip am Desktop: Werkstatt-Shell in voller Breite. Rolf öffnet „Werkstatt“ am Desktop in der Büro-Shell ohne Aktionsleiste | Navigation | 2026-09-26 | OF-10, OF-11 | gilt |
| U-045 | Globales Plus in Primärfarbe (Marken-Verlauf); höchstens 2 Klicks bis Kunde anlegen bzw. Auftrag/KV; Plus und „Neuer Eingang“ in der Seitenleiste gibt es beide | Navigation | 2026-09-14/26 | REG D-UI-V5-001, OF-12, OF-13 | gilt |
| U-046 | Befehlspalette „Suchen oder tun“ (Strg K, /), Gruppen „Treffer“/„Tun“, nur echte Aktionen, für Phillip ohne Geld, gesperrte Bereiche erscheinen nicht | Navigation | 2026-09-27 | P11 B2, OF-35 | gilt |
| U-047 | Karten öffnen als Seitenblatt (Desktop/Tablet von rechts, Handy von unten), Hintergrund sichtbar, „Zurück · Ziel“ | Klickwege | 2026-09-27 | P11 B3, OF-36 | gilt |
| U-048 | Eine Rücksprung-Wahrheit Home→Auftrag→Kunde→Auftrag; Filter und Scrollposition bleiben erhalten; keine NOT_AVAILABLE- oder „kommt bald“-Flächen | Klickwege | 2026-09-10 | REG D-UI-CORE-002 D | gilt |
| U-049 | Tastatur am Desktop: j/k wählen, Enter Hauptaktion, s Später, Esc, N Neuer Eingang, / Suche; nicht in Eingabefeldern, nicht bei offenem Dialog | Bedienung | 2026-09-26/27 | P11 B4, OF-31 | gilt |
| U-050 | Wischen nur auf Touch und nur zusätzlich zu sichtbaren Knöpfen; nie für Freigaben und Geld | Bedienung | 2026-09-27 | P11 B5 | gilt |
| U-051 | 1220 px ohne Touch zählt als Desktop | Bedienung | 2026-09-26 | OF-16 | gilt |

### Startseiten und Handlungsbedarf
| ID | Entscheidung | Bereich | Datum | Quelle | Status |
|---|---|---|---|---|---|
| U-060 | Startseite: oben dringende Konflikte, Warnungen, Entscheidungen je Zuständigkeit, darunter der Tagesüberblick | Startseite | 2026-09-26 | OE-2609-10/26 | gilt |
| U-061 | Tagesüberblick = Zeitstrahl „Heute & Woche“; Knöpfe öffnen die bestehenden Abläufe (Ware raus mit allen Prüfungen, Abholung mit Zahlung), kein Abschluss mit einem Tipp; auf Rolfs Startseite kein Kassieren; Abwesenheiten, Bündeln, „Neu seit gestern“ bleiben | Startseite | 2026-09-27 | OE-2609-29, OF-34 | gilt; überholt die Kacheln „Termine“/„Heute raus“ (Rolf V8, OE-2609-26) |
| U-062 | Fokuseintrag: eine Hauptaktion + „Später“, alles Weitere (auch Delegieren) hinter „Weitere“; Reihenfolge Konflikt → Entscheidung → Warnung; kein „1/6“-Zähler; nach Erledigen rückt der nächste nach (mit Rückgängig) | Startseite | 2026-09-27 | OE-2609-31, P11 B1, OF-42 | gilt |
| U-063 | Konflikte werden nie eingeklappt; Tablet/Handy: Fokus + 2, Rest aufklappbar | Startseite | 2026-09-27 | OE-2609-31, OF-37 | gilt |
| U-064 | Farben im Handlungsbedarf: Konflikt RAL-Rot, Warnung Orange, Entscheidung Info-Navy | Optik | 2026-09-26/27 | OF-14 | gilt mit Freigabe DS V1.1 (ausdrückliche Einzelbestätigung nicht dokumentiert) |
| U-065 | Aufgeschobene Punkte zählen weiter mit | Startseite | 2026-09-26 | OF-29 | gilt |
| U-066 | Firmengesundheit nur als Zustandswort in der Lage-Leiste (Termintreue · Liquidität 30 Tage; Phillip nur Termintreue), bis zur Anbindung „In Aufbau“; keine Zahl, keine Kachel | Startseite | 2026-09-26/27 | OF-22, OF-32, OE-2609-22/23 | gilt |
| U-067 | Schnellknöpfe auf Tablet/Handy stehen nach dem Handlungsbedarf | Startseite | 2026-09-27 | OF-39 | gilt |
| U-068 | Phillip V4: „Heute sichern“ als kleines Label, Bündel-Vorschlag, „In Arbeit“ als eine Menge | Startseite | 2026-09-10/26 | 00_UI_REFERENZ_KANONISCH, OF-02 | gilt |
| U-069 | Rolf V8 ohne Begrüßungs-/Statuszeile, ohne „Das braucht dich“, ohne „erledigt, sobald …“ | Startseite | 2026-09-26 | OF-01 | gilt |
| U-070 | Abwesenheiten von Kollegen (z. B. Urlaub) erscheinen auf der Startseite | Startseite | 2026-09-26 | OE-2609-19 | gilt |
| U-071 | Gregor: „Microsoft-Verbindung abgelaufen“ + „Neu verbinden“ | Startseite | 2026-09-26 | DSA §8, OF-20 | gilt |
| U-072 | Interne Sperren gegen Fehler; Konflikte landen je Zuständigkeit auf der Startseite von Rolf bzw. Phillip | Inhalt | 2026-09-26 | OE-2609-10 | gilt |
| U-073 | Schwerpunkt Rolf = Betriebsführung, Phillip = Termintreue/Abläufe; echte Führungssichten erst mit M01–M03 | Startseite | 2026-09-27 | OE-2609-31, OF-44 | gilt |

### Eingang, Kunde, Pflichtfelder
| ID | Entscheidung | Bereich | Datum | Quelle | Status |
|---|---|---|---|---|---|
| U-080 | Höchste Priorität: Kunden und Aufträge flüssig anlegen, gut darstellen, bearbeiten, wie in der Vorlage; die Eingabe muss Arbeit erleichtern | Eingang | 2026-10-26 | CX | gilt |
| U-081 | Neuer Eingang: Kunde bestehend/neu, KV oder Auftrag, 1–20 Positionen, Termin, Übergabe, Zahlungsmodus, Feldfehler, Rücksprung ohne Datenverlust; Desktop/Tablet eine Seite in Abschnitten, Handy in Schritten | Eingang | 2026-09-15/27 | REG D-UI-V5-002, P11 B6 | gilt |
| U-081a | „Infos rein“ und „+ Anlegen“ sind **ein** Einstieg: „Neuer Eingang“ | Eingang | 2026-10-26 | CX | gilt; Mail/Beleg darin: U-160 |
| U-082 | Bestehenden Kunden suchen und auswählen, ohne neu einzugeben; ein Neukunde wird einmal erfasst | Eingang | 2026-09-21 | REG D-UI-V5-003 | gilt |
| U-083 | Auftrag nur mit vollständigen Kundendaten: Name/Firma, Ansprechpartner, Telefon, E-Mail, Anschrift, Zahlungsbedingung | Pflichtfelder | 2026-10-27 | EV OR-03 (präzisiert CX 26.10.) | gilt; verschärft D-UI-V5-003 („Adresse spätestens vor Versand/Rechnung“) |
| U-084 | Interessent mit Name + Telefon erlaubt, markiert „unvollständig“; fehlende Daten werden inline im Neuen Eingang ergänzt | Pflichtfelder | 2026-10-27 | EV OR-04 | gilt |
| U-085 | Eingabe-Grundsätze: zuerst suchen, nichts doppelt tippen, Vorbelegung, nur fehlende Felder zeigen, kein Verlust bei Fehler, ein Hauptknopf, Tastatur am Desktop | Eingang | 2026-10-27 | EV OR-05 | gilt |
| U-086 | Mail (M365) und Beleg-Erkennung (Azure) belegen Daten vor; Übernahme erst nach Bestätigung, Original wird immer gesichert | Eingang | 2026-10-27 | EV OR-06, CX | gilt; überholt U-021, OF-07 („OCR nicht zeigen“), MM „Foto-KI voll oder gar nicht“ |
| U-087 | Sehr einfacher, formatoffener Massen-Eingang, zum Start offen („Deckel offen“) | Eingang | 2026-10-25 | CX | gilt |
| U-088 | Kunden- und Auftragsdaten ab Stufe 1 vollständig, damit später keine unvollständigen Datensätze entstehen | Pflichtfelder | 2026-10-25 | CX | gilt |
| U-089 | Positionen mit Katalog- oder Freitext-Auswahl wie V5 | Eingang | 2026-09-21 | REG D-UI-V5-003 | gilt; „nur Katalog“ (D-UI-V6-004) ist verworfen (D-GOV-002) |
| U-090 | Foto weich: fehlendes Eingangsfoto ergibt einen Hinweis, blockiert aber nicht | Eingang | 2026-09-21 | REG D-UI-V5-003 | gilt |
| U-091 | Foto-Knopf je Teil vor „fertig“ | Auftrag | 2026-09-27 | OE-2609-31 | gilt; Pflichtfoto offen (OF-43) |
| U-092 | KV ist ein eigenes, dauerhaftes Objekt; bei Zuschlag wird es zu genau einem Auftrag | Eingang | 2026-09-14 | REG D-UI-V5-001 | gilt |
| U-093 | Zwei Nummern: Auftragsnummer bei Anlage, Rechnungsnummer bei Rechnung | Inhalt | 2026-09-06 | REG #2/#4 (Owner C1) | gilt |

### Auftrag und Kunde
| ID | Entscheidung | Bereich | Datum | Quelle | Status |
|---|---|---|---|---|---|
| U-100 | Auftragskarte V8 ist die Hauptansicht; Rechnung und Zahlung stehen in der Karte; Termine Wunsch/bestätigt/verschoben | Auftrag | 2026-09-10/26 | REG D-UI-CORE-002 D, DSA §8 | gilt |
| U-101 | Karte ohne Overline/Hinweistexte; Freeze über den Dialog „Fertig melden“ mit 3 Pflichtprüfungen (V5), keine Verkürzung | Auftrag | 2026-09-26/27 | OF-05, P11 B3/D | gilt |
| U-102 | Zahlungsmodus nur in der Schwelle, solange gesperrt; im Rechnungsblock erst nach Freigabe | Auftrag | 2026-09-26 | OF-06 | gilt |
| U-103 | Teile abhaken mit Fortschritt erlaubt | Auftrag | 2026-09-27 | P11 B3 | gilt |
| U-104 | Kundenkarte V2 ist die Hauptansicht; Listen sind Such- und Filtereinstiege | Kunde | 2026-09-10 | REG D-UI-CORE-002 D | gilt |
| U-105 | Termintreue-Wert bei Auftrag und Kunde nur ausgegraut, bis Analyse angebunden ist | Auftrag/Kunde | 2026-09-26 | DSA §8, OE-2609-22 | gilt |
| U-106 | „Ware raus“ (Werkstatt) bietet nur Aufträge mit Stand „fertig“; ehrlicher Leerzustand | Klickwege | 2026-09-10 | REG D-UI-F15-004A | gilt |
| U-107 | Wareneingang und Warenausgang sind Aktionswege, keine eigenen Bereiche | Klickwege | 2026-09-10 | REG D-UI-CORE-002 C | gilt |

### Geld und Zahlung
| ID | Entscheidung | Bereich | Datum | Quelle | Status |
|---|---|---|---|---|---|
| U-110 | Zahlungs-Standard: bei Abholung bar oder Karte, sonst immer Vorkasse | Geld | 2026-09-25 | OE-2609-07 (REG RATIFIED) | gilt; überholt die Vorbelegung „rechnung/abholung“ aus D-F15-002 (Reconciliation 20.09.) – spec.json Korrektur K-1 |
| U-111 | Rechnung auf Ziel nur als Ausnahme je Kunde (Admin/Rolf schaltet frei): 14 Tage, 2 % Skonto bei Zahlung in 10 Tagen | Geld | 2026-09-26 | OE-2609-11, REG D-GOV-003 | gilt |
| U-112 | Zahlungsmodus wird bei Annahme gesetzt (nie leer), ist später änderbar, nach Warenausgang nicht mehr | Geld | 2026-09-05 | REG D-F15-002 | gilt |
| U-113 | Vorkasse bleibt gesperrt bis bezahlt; Abholung = Kassieren bei Übergabe; Rechnung ohne Sperre | Geld | 2026-09-05/09 | REG D-F15-001/003 | gilt |
| U-114 | Kartenzahlung über integriertes Terminal; bis zur Anbindung „In Aufbau“ | Geld | 2026-09-26 | OE-2609-12 | gilt; in Stufe 1 grau „geplant“ (U-168) |
| U-115 | E-Rechnung (ZUGFeRD) vor Livegang im Grundstamm | Geld | 2026-09-26 | OE-2609-14 | überholt durch U-168 (nicht im Bauumfang Stufe 1, grau „geplant“) |
| U-116 | Rolfs Startseite zeigt Geld nur als Warnung/Entscheidung, keine Zahlenflächen | Geld | 2026-09-26 | DSA §6.9 | gilt |
| U-117 | Liquidität: laufende Kosten und Kontostand von Hand in den Einstellungen, später Bank als Vorschlag | Geld | 2026-09-26 | OE-2609-24 | in Stufe 1 grau „geplant“ (U-168); Schwelle offen (OF-23) |
| U-118 | DATEV-Export wird gebaut und vernetzt, der Knopf bleibt aus Verkaufsgründen aus (Add-on); Buchhaltungsmodul nicht in Stufe 1 | Geld/Stufen | 2026-10-25/26 | CX, EV OR-08 | gilt; überholt MM „kein DATEV“ |

### Kalender und Termine
| ID | Entscheidung | Bereich | Datum | Quelle | Status |
|---|---|---|---|---|---|
| U-120 | Kalender ist Hintergrund: verknüpft mit Annahme (Wunschtermin), Verschiebung, Startseite, Werkstatt; ein Outlook-Termin zeigt minimal Terminart, Auftragsnummer, Kurzname und enthält Links in die App | Termine | 2026-09-26 | OE-2609-19 | gilt |
| U-121 | Terminübersicht Woche/Monat als Ansicht in „Aufträge“ (Liste · Woche · Monat), Mo–Sa, Sonntag nur im Monat | Termine | 2026-09-26 | DSA §8, OF-21 | Woche gilt (BU A03); Monat grau „geplant“ (U-168) |
| U-122 | Eigenes Kreile-Büropostfach; die App nutzt dessen Hauptkalender und Posteingang | Termine/Mail | 2026-09-26 | OE-2609-18 | gilt; bis Kreile-Konten: Test-/Entwicklerzugang des Owners (CX 25.10.) |
| U-123 | Ohne Microsoft-Verbindung: Abwesenheiten/Betriebstermine als ehrlicher Zustand („In Klärung“), sonst gelesen | Termine | 2026-09-26 | OF-19, OF-20 | gilt |

### Mail, Microsoft 365, Azure
| ID | Entscheidung | Bereich | Datum | Quelle | Status |
|---|---|---|---|---|---|
| U-160 | Mail und Beleg-Erkennung kommen über „Neuer Eingang“ in die App: Schalter „Woher: Manuell · aus Mail · aus Beleg/Foto“; Mail bzw. Beleg belegt Kunde, Positionen und Anhänge vor, ein Mensch bestätigt (Antwort auf F-01, Empfehlung a) | Eingang/Mail | 2026-10-27 | EV (Owner-Antwort F-01) | gilt |
| U-161 | Mail ist vollständig in die App eingebaut: kein Outlook-Fenster, kein mailto, keine Windows- oder Microsoft-Oberfläche. Mail schreiben funktioniert wie ein Kontaktformular auf einer Internetseite: Empfänger, Betreff, Text und Anhänge kommen aus dem Vorgang, gesendet wird im Hintergrund über das Kreile-Büropostfach (U-122) | Mail | 2026-10-27 | EV | gilt – Bauabweichung: `src/modules/customers/ui/CustomerCardView.tsx:128` öffnet heute `mailto:` |
| U-162 | Kein eigener Menüpunkt für Mail; später möglich, wenn gewünscht | Navigation/Mail | 2026-10-27 | EV | gilt |
| U-163 | Azure (Beleg-Erkennung) ist genauso vollständig in die App eingebaut; keine Microsoft-Oberfläche sichtbar | Eingang | 2026-10-27 | EV | gilt |

### Nachträge 2026-10-27
| ID | Entscheidung | Bereich | Datum | Quelle | Status |
|---|---|---|---|---|---|
| U-164 | Analyse-Menüpunkt „Zahlen“ erscheint wie alle späteren Stufen grau mit „geplant · Stufe 4“; die Startseite zeigt aus der Analyse weiterhin nur Dringendes (W-01, Empfehlung) | Stufen/Navigation | 2026-10-27 | EV (Owner: „deine Empfehlung“) | gilt; überholt U-026 (nur den Teil „keine ausgegraute Route“) |
| U-165 | Stufen: 1 Basis · Überblick & Termintreue · 2 Buchhaltung & Geld (Export, Buchhaltung, Bankabgleich, Mahnwesen, Mails automatisch zuordnen, Status-Link) · 3 Werkstatt (Galvanik-Stufen, Material & Einkauf, Versand DHL, Begleitschein & Etiketten) · 4 Assistent (Zahlen, Spracheingabe, Kapazitätsplanung) | Stufen | 2026-10-25 | `docs/delivery/KREILE_BAUUMFANG_STUFEN.html` | gilt; ersetzt die Annahme in spec.json, F-02 entfällt |
| U-166 | Phillip hat „Einstellungen“ im Konto-Menü, sieht dort aber nichts mit Geld oder Preisen (Rechnung auf Ziel, DATEV, Kontostand, Stundensatz, Leistungskatalog) | Rollen | 2026-09-26 | OF-09 + OE-2609-09 + U-033 | gilt; W-02/F-05 entfällt: der Bauumfang enthält keine gegenteilige Aussage |
| U-167 | Termin im Eingang: Feld „Liefertermin“ (Pflicht) mit Status „Wunsch · bestätigt“; „verschoben“ entsteht nur über eine Terminänderung mit Grund | Eingang/Termine | 2026-09-26 / 10-25 | BU E02/A04, DSA §8 | gilt; F-04 entfällt (beides vereinbar) |
| U-168 | **Stufe 1 = genau der Bauumfang vom 25.10.** (E01–E05, A01–A09, R01–R05, S01–S03) plus Bündel-Vorschlag, weil er Teil der Seitenvorlage Phillip V4 ist. Alles aus V1.1, was nicht im Bauumfang steht (Kartenterminal, E-Rechnung ZUGFeRD, Reklamation, Aufbewahrung, Liquidität/Kontostand, Monatsansicht), wird nicht gebaut und erscheint grau „geplant“ | Stufen | 2026-10-25 | `docs/delivery/KREILE_BAUUMFANG_STUFEN.html` (neueste Umfangsfassung) | gilt; überholt K-2 und die Bau-Zusage für ZUGFeRD aus OE-2609-14 (U-115) |
| U-169 | Nummern: Auftrag `A-JJJJ-NNNN`, Kunde `K-JJJJ-NNNN`, KV `KV-JJJJ-NNNN` (je Jahr fortlaufend, schon gebaut), Rechnung `R-JJJJ-NNNN` lückenlos, Gutschrift eigene Nummer; der Lieferschein trägt die Auftragsnummer, ohne eigenen Kreis | Inhalt | 2026-09-06 / 09-14 / 10-25 | REG #2/#4, `_MODULDOSSIERS/G06_KV_ANGEBOT/01_ANFORDERUNGSKATALOG.md` A-G06-004, Migration `20260914110000_path1_quote_persistence_contract.sql`, `src/lib/pdf/DeliveryNote.tsx:208`, BU R03/S01 | gilt; F-06 entfällt |
| U-170 | Doppelte Beschreibungen verlassen die App: keine Begleittexte, die Sichtbares wiederholen (z. B. „Code für Rolf“), kein Knopf mit dem Text seiner Blocküberschrift, jede Aktion nur einmal je Ansicht und Gerät. Wird maschinell geprüft (`pruefung.js` Prüfung 7, Fehler = Bau rot) | Gestaltung | 2026-10-27 | EV (Owner) | gilt; verschärft U-014/U-015 |
| U-171 | Login am Desktop: Code sofort per Tastatur, ohne Klick und ohne Bestätigung; nach der 4. Ziffer angemeldet | Login | 2026-10-27 | EV (Owner) | gilt |
| U-172 | **Der Tag** = Startseite von Rolf und Phillip, je Person konfigurierbar („Anpassen“): Bausteine Heute & Woche, Neu seit gestern, In Arbeit, Bündel-Vorschlag, Abwesenheiten, Offene Rechnungen (nicht für Phillip); Vorschläge je Rolle sind Standard; Handlungsbedarf ist immer an, damit nichts unter den Tisch fällt | Startseite | 2026-10-27 | EV (Owner) | gilt; überholt U-037 (war „später“) und U-034 (Phillip startet jetzt auf Der Tag) |
| U-173 | **Werkstatt** ist für alle gleich und zeigt nur Aufträge: Dringend · In Arbeit · Wartet · Fertig (jeder Auftrag genau einmal), Filter oben, Bündel-Vorschlag; Werkstatt-Aktionen (Auftrag öffnen/scannen, Mehrarbeit, Fertig melden, am Tablet/Handy Ware raus) im Seitenkopf. Phillip nutzt dieselbe Navigation wie alle (Dock: Der Tag · Werkstatt · Aufträge · Kunden · Mehr) | Navigation/Werkstatt | 2026-10-27 | EV (Owner) | gilt; überholt U-042 (feste Aktionsleiste) und U-068 (Phillip-V4-Startseite) |
| U-174 | **Gregor** (developer) startet in der **Wartung**: Systemzustand, Fehlerprotokoll, Updates (Liste; „Update einspielen“ geplant), Anbindungen, Stufen & Add-ons, Nutzer. Firmeneinstellungen bleiben in „Einstellungen“; Stufen schaltet nur Gregor | Rollen/Wartung | 2026-10-27 | EV (Owner) | gilt; überholt U-034 (Gregor startete in Einstellungen) |
| U-175 | Hintergrund fast weiß, keine sand-/cremefarbenen Flächen, Felder oder Knöpfe; Zifferntasten im Login navy-transparent; Personenkreise größer | Optik | 2026-10-27 | EV (Owner) | gilt; überholt U-005/U-006 (Flächenwerte), umgesetzt in `ui_ergaenzung.css` |
| U-176 | Wichtige Knöpfe farbig nach Dringlichkeit, Farben aus dem Designsystem: grün = abschließen/im Plan · orange transparent = Entscheidung · rot transparent = Warnung · voll rot = Konflikt | Optik | 2026-10-27 | EV (Owner) | gilt |
| U-177 | Beleg-Erkennung gehört in die Suche: erkannter Text aus Belegen, Fotos und Dateien wird durchsucht; „Tun“ bietet Beleg/Foto lesen, Visitenkarte scannen, Datei lesen, Mail zuordnen; ebenso im Plus-Menü. Jede Funktion der bestehenden App ist in `spec.json` → `bestand_abgleich` zugeordnet (übernommen mit Ziel oder verworfen mit Entscheidung); `pruefung.js` Prüfung 8 macht den Bau rot, wenn etwas ohne Zuordnung fehlt | Suche/Eingang | 2026-10-27 | EV (Owner) | gilt |
| U-178 | Handlungsbedarf ohne Punkt: Fläche transparent und dicker Rand in der Farbe der Art (Konflikt rot · Warnung orange · Entscheidung blau). Hauptknopf nach Bedeutung: grün = freigeben/abschließen · blau = zuordnen/einrichten · orange = vorbeugen · rot transparent = Geld fehlt/mahnen · voll rot = Blockade lösen. Scan-Knopf (Beleg/Foto lesen) direkt neben der Suche in der Kopfleiste, überall erreichbar | Optik/Suche | 2026-10-27 | EV (Owner) | gilt; präzisiert U-176 |
| U-179 | Aufteilung Der Tag (konfigurierbar, Rolf/Phillip) · Werkstatt (für alle gleich, Aufträge) · Wartung (Gregor) bestätigt | Navigation | 2026-10-27 | EV (Owner: „passt jetzt so“) | gilt; bestätigt U-172–U-174 |
| U-180 | Erst Desktop fertig, Tablet/Handy-Feinschliff im Dezember. Der Tag am Desktop zweispaltig: links „zu tun“ (Handlungsbedarf, Neu seit gestern, Bündel-Vorschlag), rechts „Überblick“ (Heute & Woche, Offene Rechnungen, In Arbeit, Abwesenheiten); Einträge einzeilig mit Aktionen rechts, kein leerer Platz. Einträge weiß mit dickem Farbrand – nie rote Fläche mit rotem Knopf und roter Schrift | Optik/Startseite | 2026-10-27 | EV (Owner) | gilt; ändert U-178 (Fläche nicht mehr eingefärbt) |
| U-181 | Scan-Knopf öffnet sofort die Kamera (Desktop Webcam, Tablet/Handy Rückkamera), Sucher mit Rahmen, ein Auslöser (Desktop: Leertaste/Enter); danach Beleg-Prüfung; „Weitere Seite“ möglich; ohne Kamera oder Freigabe direkt Dateiauswahl. Gilt für Kopfleiste, Suche, Neuer Eingang, Visitenkarte | Eingang | 2026-10-27 | EV (Owner) | gilt |
| U-182 | Der Tag = Kontrolle. „Anpassen“ zeigt die Felder der Startseite direkt auf der Seite (nummeriert, zwei Spalten); je Feld wird der Inhalt aus einer Auswahl gewählt – nur, was die Berechtigung zulässt –, Felder lassen sich hinzufügen, entfernen, hoch/runter und in die andere Spalte verschieben; „Fertig“ speichert je Person, „Vorschlag übernehmen“ setzt zurück. Handlungsbedarf ist Feld 1 und immer an; jeder Inhalt nur einmal. Jedes Feld ist in sich nach Dringlichkeit gestaffelt (rot → orange → blau/grau → grün, dann Zeit) | Startseite | 2026-10-27 | EV (Owner) | gilt; ersetzt den Dialog „Der Tag anpassen“ aus U-172 |
| U-183 | Werkstatt (Desktop) als farbiges Brett: vier Spalten Dringend (rot) · In Arbeit (navy) · Wartet (amber) · Fertig (grün); der farbige Spaltenkopf mit Anzahl ist zugleich Filter (Klick = nur diese Spalte breit, erneut = alle); Auftragskarten weiß mit Farbrand, Termin als farbige Marke, eine passende Aktion je Spalte (Öffnen · Fertig melden · Ware raus); Bündel-Vorschlag amber hinterlegt | Werkstatt | 2026-10-27 | EV (Owner) | gilt; ersetzt die grauen Gruppen-Kacheln und die Filterleiste aus U-173 |
| U-184 | Werkstatt-Spalten: Wareneingang (navy, alle angenommenen Aufträge im Regal) · Dringend (rot) · In Arbeit (amber) · Fertig (grün). Wareneingang nach Priorität: spätester Start = Liefertermin − Durchlaufzeit der Oberfläche − Aufwandstage (Auftragswert ÷ Tagesleistung, Einstellung, Vorbelegung 800 €); kleinster Puffer oben, Marke „Start überfällig“/„heute starten“/„starten bis …“. Karte: Bild zur Erkennung, Kunde · Teil, Nummer, Ziel (Verfahren · Ausführung), Menge, Termin, eine Aktion – nichts doppelt, kein Geld; gefiltert untereinander als eine Zeile | Werkstatt | 2026-10-27 | EV (Owner) | gilt; ändert U-183 (Wartet → Wareneingang, Reihenfolge) |
| U-185 | **Minimalklick-Strategie** gilt für die ganze App: häufige Handgriffe direkt dort, wo man ist, höchstens 2 Klicks bis gespeichert. Auftragskarte ist ein **Standard-Baustein**: gleiche Optik überall, je nach Ort ändern sich nur Inhalt und Knöpfe. In der Werkstatt: Abschnitte untereinander, Karten in voller Breite, je Karte „Foto“ (Kamera → Auslösen → gespeichert) und „Mehrarbeit“ (bei Fertig nur Foto, weil eingefroren) plus eine Hauptaktion | Bedienung/Werkstatt | 2026-10-27 | EV (Owner) | gilt; ändert U-183/U-184 (Spalten → Abschnitte) |
| U-186 | **Seitennummern** (stabil, nie neu vergeben): 0 Anmelden · 1 Suche · 2 Der Tag · 3 Neuer Eingang (3.1–3.5) · 4 Aufträge (4.1 Auftragskarte … 4.7) · 5 Kunden (5.1–5.3) · 6 Kalender reserviert · 7 Geld & Rechnungen (7.1–7.3) · 8 Einstellungen (8.1–8.7) · 9 Telefonnotiz reserviert · 10 Ware raus (10.1) · 11 Werkstatt · 12 Wartung (12.1–12.3) · 13 Freigeschaltete Funktion · Menüs M1–M5; sichtbar nur in der Spec-Ansicht. **Aufträge (4)**: gleiche Auftragskarte wie Werkstatt, Farbrand = Status, Aufträge eines Kunden in einer großen Klammer mit Kundenkopf (Name, Nummer, Anzahl, Kundenkarte); Kunde mit dem dringendsten Auftrag oben; Filter Alle · Wareneingang · In Arbeit · Fertig · KV | Navigation/Aufträge | 2026-10-27 | EV (Owner) | gilt |
| U-187 | **Kunden (5)**: Kundenkarte = Standard-Baustein wie die Auftragskarte (Kürzel-Kreis, Name · K-Nr, Ansprechpartner · Ort · aktive Aufträge; Aktionen Neuer Auftrag · Mail · Öffnen). **Oranges „!“** = Achtung beim Kunden (ungelesene Mails, Terminkonflikt, Verhalten/Eigenheit, Zahlungsmoral, fehlende Pflichtdaten); Gründe in einer Zeile daneben, solche Kunden oben. Filter Alle · Mit Hinweis · Unvollständig. Werkstatt sieht keine Geld-Gründe | Kunden | 2026-10-27 | EV (Owner) | gilt |
| U-188 | **Buchhaltung (7)** = ein Modul, ein Menüpunkt „Buchhaltung“ (ersetzt „Geld & Rechnungen“ und den separaten Stufe-2-Eintrag). Stufe 1 = Basis, klein und einfach: Kennzahlen Geld fehlt · Abrechnen · Offen im Zahlungsziel; Liste nach Dringlichkeit Geld fehlt (überfällig, Vorkasse) → Abrechnen → Offen, Standardkarte; Aktionen Zahlung bestätigen · Erinnern · Rechnung erstellen. Stufe 2 = voller Umfang (Mahnwesen, Bankabgleich, DATEV) auf derselben Seite; vorher als eine ruhige Ausbau-Zeile, Späteres als zweite Zeile | Buchhaltung | 2026-10-27 | EV (Owner) | gilt |
| U-189 | **Dringlichkeit appweit einheitlich**: weiße Karte/Zeile, links Balken 6 px (U-191) im Ton, Etikett im selben Ton (Ecken 6 px), Grund in einer Zeile in Ton-Schrift, oranges „!“ = Achtung. Kein Punkt, keine farbig gefüllten Warnflächen (auch Hinweise, Bündeln, Lage-Zähler). Neutrale Zeilen ohne Balken | Design | 2026-10-27 | EV (Owner) | gilt |
| U-190 | **Werkstatt (11) sachlicher**: Gruppenköpfe als schmale Überschrift mit Farblinie statt gefüllter Balken, Zähler als Etikett, Karten Ecken 8 px, Balken 4 px, Bildvorschau 56 px; Inhalt und Logik unverändert | Werkstatt | 2026-10-27 | EV (Owner) | gilt |
| U-191 | **CI appweit (verbindlich für alle Seiten, Dialoge, Untermenüs)**: (1) Flächen weiß wie die Anmeldeseite, neutrale kühle Grautöne, kein Sand; (2) Karten heben sich ab durch Linie + einheitlichen Kartenschatten; (3) eine Ecken-Skala: Etikett 4 · Bild/Knopf 6–8 · Karte 10 · Kachel 12 · Dialog 14; (4) Serifen nur für Seiten-/Dialogtitel, Marke, Anmeldegruß – Nummern, Zähler, Zeiten serifenlos; (5) **Objekttyp sofort erkennbar**: jede Nummer mit Typ-Zeichen wie in der Navigation – Auftrag (Liste) · Kunde (Person) · Rechnung (Beleg) · Mail; (6) **Dringlichkeit** = Balken links 6 px + Etikett im selben Ton: rot dringend/Geld fehlt · orange Achtung · amber in Arbeit · navy zu tun · grün erledigt · grau wartet. Werkstatt-Gruppenköpfe wieder gefüllt (klar erkennbar), aber sachlich: 48 px, Ecken 8, serifenlose Zahl – ersetzt den Kopf-Teil von U-190. Appweite Wünsche werden immer sofort überall umgesetzt (OR-11) | Design/CI | 2026-10-27 | EV (Owner) | gilt |
| U-192 | **Einstellungen (8)** nüchtern in Reitern nach Themen: Firma · Leistungen & Preise · Personen & Rechte · Zahlung · Daten & Export; eine Spalte, Kacheln nach CI; Reiter ohne sichtbaren Inhalt für die Rolle entfallen (Phillip: Firma · Personen & Rechte · Daten & Export) | Einstellungen | 2026-10-27 | EV (Owner) | gilt |
| U-193 | **Diktat (E06, Stufe 1)**: Mikrofon neben der Suche im Kopf, im Suchfeld (Seite 1) und appweit in jedem Freitextfeld (Notiz, Telefonnotiz, Erfassen, Akte); gesprochener Text landet im Feld. Produktiv über Azure Speech (EU), dieselbe Azure-Anbindung wie die Beleg-Erkennung; keine Aufnahme wird gespeichert. Der Sprach-Assistent mit Befehlen bleibt Z03, Stufe 4 | Bedienung | 2026-10-27 | EV (Owner) | gilt |
| U-194 | **Menüs M1–M5**: öffnen direkt am Auslöser (Plus, Kürzel, „Später“, „Weitere“). M1 Plus = Neuer Eingang · Kunde anlegen (· Datenkiste in der Einführung). M2 Konto = Abmelden. M3 „Weitere Bereiche“ gibt es nur im Dock von Tablet/Handy und zeigt die übrigen Bereiche der Seitenleiste; auf dem Desktop entfällt es; kein Abmelden und keine Datenkiste darin (nichts doppelt). M4 „Später erinnern“, M5 „Weitere Aktionen“ zum Eintrag | Navigation | 2026-10-27 | EV (Owner) | gilt |
| U-195 | **Neuer Eingang (3) und Kunde anlegen (3.1) als große Erfassungsseite**: oben „Schnell erfassen“ (Text, Diktat, Foto von Zettel, Etikett, Karte, Lieferschein, Datei, Mail); die App führt Text, Kundendaten und Katalog zusammen, füllt vor, markiert „erkannt“ oder „vorgeschlagen“ und lässt alles mit einem Klick bestätigen. Pflicht steht am Feld; rechts die Prüfliste mit Fortschritt und Sprung zum Feld. Terminvorschlag (A10) gleicht Wunsch gegen Machbar ab (Durchlauf, Auslastung/Bündel, Erfahrung mit ähnlichen Teilen, Kunde); Preisvorschlag (A11) aus gleichem Kunden, ähnlichen Teilen und Katalog. Beides wird nie automatisch übernommen. Kunde anlegen: Dublettenprüfung beim Tippen, Ort und Land aus der PLZ. Formulare appweit: Bezeichnungen in normaler Schreibweise, ohne Grauflächen | Eingang | 2026-10-27 | EV (Owner) | gilt |
| U-196 | **Akte in Auftragskarte (4.1) und Kundenkarte (5.1)**: eine Quelle, zwei Sichten. Verlauf (neueste oben, nach Tag), Fotos & Dokumente, Mails & Notizen, Rechnungen & Zahlungen, bei Kunden zusätzlich Aufträge (aktive und erledigte); jeder Eintrag verlinkt sein Objekt (Auftrag, Rechnung, Mail, Datei). Notiz direkt in der Akte schreiben oder diktieren. Reihenfolge nach Bedarf: Hinweise/nächster Schritt → Arbeit (Teile, Mehrarbeit bzw. aktive Aufträge, Absprachen) → Akte; rechts Schnellaktionen → Verknüpft bzw. Kennzahlen → Geld. Phillip sieht keine Geld-Einträge | Auftrag/Kunde | 2026-10-27 | EV (Owner) | gilt |
| U-197 | **Mehrarbeit (4.3) für Hände im Dreck**: Wo? (ganzer Auftrag oder Teil) · Was? große Kacheln je Arbeitsgang, jedes Antippen = feste Minuten (Löten 5 · Schleifen 5 · Polieren 5 · Strahlen 10 · Nacharbeit 15 · Sonstiges 5), „−“ nimmt zurück; Regler zeigt die Summe gegen den KV-Spielraum: grün im Umfang, ab 80 % orange, darüber rot („Preisfreigabe bei Rolf“). „Kunde informieren“ verschickt automatisch eine Mail mit Hinweis (bei Überschreitung ohne Preis). Speichern verteilt sofort an Verlauf, Rechnungsposition, Terminprognose, Der Tag (bei Überschreitung) und Erfahrungswerte. Foto und Notiz per Diktat optional. Phillip sieht Minuten, keine Euro | Auftrag | 2026-10-27 | EV (Owner) | gilt |
| U-198 | **Fertig melden (4.4) heißt ergänzen**: je Teil Haken antippen, gut/Ausschuss mit + / − (zusammen höchstens die Stückzahl), Grund per Antippen, fehlendes Fertigfoto direkt aufnehmen, Notiz per Diktat, Mehrarbeit nachtragen, Problem melden; oben der Stand („3 von 3 Teilen fertig – bereit“). „Kunde informieren“ ist vorausgewählt. Danach Werkstatt › Fertig, Ware raus, Buchhaltung › Abrechnen | Auftrag | 2026-10-27 | EV (Owner) | gilt |
| U-199 | **Aufwand, Priorität und Termin – wichtig**: entscheidend sind KV und Menge der Einzelteile, der bei Auftragsannahme im KV eingeplante Aufwand und Erfahrungswerte ähnlicher Aufträge und Teile (Median Ist ÷ Plan der letzten 10 ähnlichen, gleicher Kunde doppelt, begrenzt 0,7–1,8). Stufe 1 = einfacher Algorithmus (werkstattregel), Stufe 4 (Z04) = die App lernt aus Ist-Zeiten, Mehrarbeit und Fertigmeldungen. Beantwortet die offene Frage zum Auftragswert (= Summe der KV-Positionen) | Logik | 2026-10-27 | EV (Owner) | gilt |
| U-200 | **Rechte & Logins**: Wer was sehen und tun darf, legt vorerst nur Gregor fest – Wartung › Logins & Rechte (8.5, umgewidmet): Haken je Login und Bereich (Aufträge & Werkstatt · Neuer Eingang & Kunde anlegen · Kunden & Kontakt · Geld, Preise & Buchhaltung · Mails · Firmen-Einstellungen · Logins & Rechte · Wartung), wirkt sofort, ohne Haken unsichtbar. Gregor legt Logins an und ändert sie (Name, Kürzel, Bezeichnung, Vorlage, Code, aktiv); Gregors Logins & Rechte und Wartung sind fest (kein Aussperren). Alle anderen ändern nur den eigenen Code (8.8). Innerhalb seiner Rechte stellt sich jeder Login „Der Tag“ selbst zusammen. Rollen in der Spec sind nur Vorlagen; ersetzt U-031 (Admin-Rechte bei Rolf) bis auf Weiteres | Rechte | 2026-10-27 | EV (Owner) | gilt |
| U-201 | **Jede Ansicht zeigt das angeklickte Objekt**: Auftragskarte, Kundenkarte, Mehrarbeit, Fertig melden, Rechnung, Zahlung, Warenausgang und „Neuer Auftrag“ werden aus dem Auftrag/Kunden/der Rechnung gebildet; Dialoge zeigen oben das Objekt (Nummer · Kunde · Teil). Unbekannte Nummer = Fehlerzustand. Abschluss (Buchen, Speichern) schließt den Dialog und öffnet das neue Objekt. Pflicht-Gate beim Buchen (springt zur ersten offenen Angabe), Abbrechen fragt „Entwurf behalten?“ (3.6). Prüfer-Regel 9: jeder Verweis löst auf | Logik | 2026-10-27 | EV (Owner) | gilt |
| U-202 | **Mock nie an Codex**: index.html, Musterdaten, Mock-Texte und Bildschirmfotos dienen nur der Darstellung für die Owner. An Codex geht ausschließlich der Bauplan (Struktur, Felder, Regeln, Rechte, Zustände, Abläufe) ohne Inhalt (OR-13) | Export | 2026-10-27 | EV (Owner) | gilt |
| U-203 | **Abgleich Spec ↔ Code**: ABGLEICH_SPEC_CODE.md wird übernommen, sobald vorhanden – je Element Kennzeichnung `aenderung`: optik / inhalt_neu / funktion_neu in spec.json; Widersprüche zu Server-Regeln werden der Owner einzeln vorgelegt. Jede Freigabe in FREIGABEN.md mit Screen-IDs und spec-Stand (sha256) (OR-15) | Ablauf | 2026-10-27 | EV (Owner) | gilt |
| U-204 | **Prüfbefunde 27.10. umgesetzt**: Bündeln als Dialog (11.1); Abschluss-Knöpfe grün, „Öffnen“ neutral; Doppelungen in der Auftragskarte raus (Kunden-Update, Foto+/Dokument+, Mail in der Akte), M5 ohne „Auftrag öffnen“, Aufträge-Seite ohne zweites „Neuer Eingang“; Der Tag: „Foto aufnehmen“, „Prüfen & freigeben“, A-0102 heute fällig für alle; Werkstatt › Dringend mit „Fertig melden“; Zähler aus den Daten (In Arbeit, Aufträge · KV); Geplantes einheitlich „Stufe n“ bzw. „geplant“ ohne Werte; ein Datumsformat appweit (Mo 28.09.); Wartung-Befunde aus den Daten; Fertig-Schalter „fertig?“/„fertig“. Abgelehnt: weiße Gruppenköpfe (bleibt U-191) | Design/Logik | 2026-10-27 | EV (Owner) | gilt |
| U-205 | **Entwurf und Kassieren (früher entschieden, bestätigt)**: Entwurf aus Neuer Eingang/Kunde anlegen wird serverseitig je Login gespeichert und erscheint auf „Der Tag“ dieses Logins mit „Weiter bearbeiten“ und „Löschen“ (K27). Kassieren bei Abholung bar oder mit Karte: in Stufe 1 nur der Knopf „bezahlt“ (bar / Karte) im Warenausgang, Rechnung wird im selben Schritt festgeschrieben; Kartenzahlung über Mollie später (K13, X01) | Eingang/Ware raus | 2026-10-27 | Owner (Bestand) | gilt |
| U-182 | Der Tag = Kontrolle. „Anpassen“ zeigt die Felder der Startseite direkt auf der Seite (nummeriert, zwei Spalten); je Feld wird der Inhalt aus einer Auswahl gewählt – nur, was die Berechtigung zulässt –, Felder lassen sich hinzufügen, entfernen, hoch/runter und in die andere Spalte verschieben; „Fertig“ speichert je Person, „Vorschlag übernehmen“ setzt zurück. Handlungsbedarf ist Feld 1 und immer an; jeder Inhalt nur einmal. Jedes Feld ist in sich nach Dringlichkeit gestaffelt (rot → orange → blau/grau → grün, dann Zeit) | Startseite | 2026-10-27 | EV (Owner) | gilt; ersetzt den Dialog „Der Tag anpassen“ aus U-172 |

### Suche
| ID | Entscheidung | Bereich | Datum | Quelle | Status |
|---|---|---|---|---|---|
| U-130 | Suche in der Kopfleiste, Treffer mit Grund + Quelle; jedes Modul liefert Suchdokumente; Pflicht vor Pilot | Suche | 2026-08-15 / 09-26 | MM, DSA §7.3 | gilt |
| U-131 | Die Suchleiste funktioniert von Anfang an vollständig oder ist sauber und sichtbar erweiterbar | Suche | 2026-10-25 | CX | gilt |
| U-132 | Such-Lieferung V1: Treffer Auftrag + Kunde, höchstens 20 je Typ, 6 Zustände, Tastatur; Lücke: Suchdokument-Port für Notizen/Positionen | Suche | 2026-08-18 | SU | gilt als Technik; Gestalt überholt durch U-046 |

### Einstellungen und Daten
| ID | Entscheidung | Bereich | Datum | Quelle | Status |
|---|---|---|---|---|---|
| U-140 | Einstellungen: Rechte je Person, Rechnung auf Ziel je Kunde, laufende Kosten + Kontostand, Aufbewahrungsfristen + Lösch-/Anonymisierungsvorschläge zur Freigabe | Einstellungen | 2026-09-26 | DSA §8, OE-2609-20 | gilt ohne Aufbewahrung/Kontostand/laufende Kosten: diese grau „geplant“ (U-168) |
| U-141 | Login `/start` mit PIN; Gregor mit E-Mail + Passwort | Login | 2026-09-10/26 | REG D-UI-CORE-002 A, OF-17 | gilt; MFA offen |
| U-142 | Analyse wird ein eigener Menüpunkt mit voller Analyse; erste Kennzahl Termintreue | Analyse | 2026-09-26 | OE-2609-21/22 | gilt (Zeitpunkt der Anzeige: W-01) |
| U-143 | Eigene Steuerung im Owner-Login (Nutzer anlegen, Stufen schalten, später KI-Anweisungen); blockiert den Bau nicht | Einstellungen | 2026-10-26 | CX | gilt, Feinschliff Dezember |

### Verworfen
| ID | Entscheidung | Bereich | Datum | Quelle | Status |
|---|---|---|---|---|---|
| U-150 | Nie bauen: Transport-/Stationsband als Startseite, Kanban, „In Galvanik starten“, Bad-Sprache auf der Startseite, zweites Designsystem / Dark-Mode | Verworfen | 2026-09-10 | 00_UI_REFERENZ_KANONISCH | gilt |
| U-151 | Die alte Shell, Navigation, Startseite und Auftrags-/Kundenoberfläche werden vollständig ersetzt, nicht umgestylt | Verworfen | 2026-09-10 | REG D-UI-CORE-002 (Nachschärfung) | gilt |
| U-152 | Aus V2 nicht übernommen: Icon-Leiste ohne Beschriftung, Handy-Aktionen nur als Symbol, Dock ohne „Mehr“, „Später“ fest 14:00, „Fertig melden“ mit 2 statt 3 Prüfungen, Werte ohne Anbindung, abgeschnittene Lage-Leiste, Versenden/Übergeben mit einem Tipp | Verworfen | 2026-09-27 | P11 D | gilt |

## Offen (Owner, kein Blocker für Ebene 0)
| Nr. | Frage | Quelle | bis dahin |
|---|---|---|---|
| OF-17 | MFA für Gregor? | OF | E-Mail + Passwort |
| OF-23 | Schwelle „Kontostand älter als X Tage“ und Eingaberhythmus | OF, OE-2609-24 | „In Klärung“ |
| OF-24 | Inhalt des „5-Punkte-Checks“ (D-USP-001) | OF | nicht dargestellt |
| OF-25 | Bestätigung der Aufbewahrungsfristen | OF, OE-2609-20 | Werte als Vorbelegung |
| OF-30 | Vibration (8 ms, nur Touch, abschaltbar?) | OF | ohne |
| OF-43 | Pflichtfoto vor „fertig“? | OF, FRG | nicht Pflicht |

## Widersprüche (einzeln an den Owner)
| Nr. | Widerspruch | Empfehlung | Status |
|---|---|---|---|
| W-01 | U-022 (27.10.: alles nicht Freigeschaltete grau mit „geplant“) gegen U-026 (26.09.: Analyse-Menüpunkt erst nach Anbindung, keine ausgegraute Route). Betrifft in spec.json den Navigationspunkt „Zahlen“ (Z01). | U-022 gilt auch für Analyse: Menüpunkt „Zahlen · geplant“ ausgegraut. U-022 ist neuer, und die ausgegrauten Stufen sind Verkaufsanzeige; die Startseite zeigt aus der Analyse weiterhin nur Dringendes. | entschieden 2026-10-27 → U-164 |
| W-02 | U-043 (26.09.: Phillip hat „Einstellungen“ im Konto-Menü) gegen den Bauumfang (Rolle werkstatt ohne Einstellungen) | Prüfung des Bauumfangs: keine gegenteilige Aussage | aufgelöst → U-166 |

Gestellt wird immer nur eine Frage; die Reihenfolge steht in `FREIGABEN.md`.

**Ohne Rückfrage nach Datum entschieden** (jeweils neuere Owner-Aussage): U-002→U-001 · U-021→U-020/U-086 · enge Rechte→U-031 · Vorbelegung „rechnung“→U-110 · Kacheln→U-061 · MM „entfällt“→U-025 · MM „kein DATEV“→U-118 · Adresse erst vor Versand→U-083. „In Aufbau“/„In Klärung“ (U-020) und „geplant“ (U-022) bestehen nebeneinander: „geplant · Stufe n“ für nicht verkaufte Stufen, „In Aufbau“ für ein Modul in Arbeit, „In Klärung“ für eine fehlende Verbindung oder Entscheidung.

## Korrekturen an spec.json (folgen ohne Owner-Entscheidung, da die Entscheidung schon fiel)
| Nr. | Stelle | Änderung | Grund |
|---|---|---|---|
| K-1 | `formulare.kunde` → `zahlungsbedingung` | Vorbelegung „Vorkasse“; im Neuen Eingang bei Übergabe „Abholung“ → „Bar oder Karte bei Abholung“; „Rechnung auf Ziel“ nur bei freigeschaltetem Kunden (bisher: keine Vorbelegung) | U-110, U-111 · **erledigt 2026-10-27** |
| K-2 | Frage F-03 (V1.1-Elemente ohne Bauumfang) | aus dem Register beantwortet: bauen = E-Rechnung (U-115), Bündeln (U-061/U-068), Monatsansicht (U-121), Aufbewahrung (U-140); ausgegraut „In Aufbau“ = Kartenterminal (U-114), Reklamation (OF-07), Liquidität (U-066/U-117) | **überholt durch U-168** (Bauumfang ist die neuere Umfangsfassung); umgesetzt: X01–X05, X07 grau „geplant“, X06 Bündeln Stufe 1 |
| K-3 | Navigation „Zahlen“ (Z01) | bleibt grau „geplant · Stufe 4“ (war schon so) | U-164 · **erledigt** |
| K-4 | `stufen` 2–4 | Status „annahme“ entfernt, Quelle Bauumfang | U-165 · **erledigt** |
| K-5 | Einstellungen, Konto-Menü | werkstatt erhält Einstellungen, Firmendaten, Rechte, Stufen, Datenkiste, Anbindungen; Geld- und Preis-Kacheln nur meister/developer | U-166 · **erledigt** |
