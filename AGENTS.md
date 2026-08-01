# Galvanik-Kreile WerkstattCockpit

## Projekt

- Arbeite ausschliesslich fuer das Galvanik-Kreile WerkstattCockpit.
- Der feste Tenant ist `galvanik-kreile`.
- Stack: Next.js App Router, TypeScript, Supabase, Drizzle, Recharts, Framer Motion und PWA.
- `main` ist die einzige Lieferwahrheit.
- Vor Next.js-Codeaenderungen die relevante Dokumentation unter `node_modules/next/dist/docs/` lesen.

## Produktziel

- Das WerkstattCockpit verwandelt einen papiergefuehrten, inhaberabhaengigen Handwerksbetrieb in ein transparentes, planbares und uebergabefaehiges Unternehmen.
- Primaerer Kundennutzen: Kontrolle, Planbarkeit und unternehmerische Sicherheit.
- Das operative Herz ist Eingang -> Produktion -> Ausgang.
- Erfassung muss Arbeit abnehmen: Kamera, Sprache, Datei und Scan mit wenigen klaren Handlungen.
- Die App verbindet Kunde, Auftrag, Teil, Ereignis, Kommunikation, Dokument, Rechnung, Zahlung und Ergebnis in einem nachvollziehbaren Datenkreislauf.
- KI strukturiert, analysiert und empfiehlt, ersetzt aber weder Datenbank noch belegte Wahrheit.
- Der Kern bleibt forkbar: bestaetigte Module muessen spaeter ohne Kreile-spezifische Interna in andere Apps uebertragbar sein.

## Dokumentenautoritaet

Vor jeder Mission aus aktuellem `origin/main` lesen:

1. `AGENTS.md`
2. `docs/project/MASTERPLAN.md`
3. `docs/project/CURRENT_STATE.md`
4. `docs/project/NON_LOSS_REGISTER.md`
5. `docs/project/DOCUMENT_AUTHORITY.md`
6. `docs/project/MODULARITY_STRATEGY.md`
7. die freigegebene Missionsdatei oder nummerierten Akzeptanzkriterien

- Alte Masterplaene, Uebergaben, Review-Bundles, lokale Governance-Dateien und Dirty-Worktrees sind nur Quellenmaterial.
- Sie duerfen den kanonischen Stand nicht ueberschreiben.
- Reale Systemwahrheit kommt aus GitHub `main`, Vercel Production, Remote-Supabase und reproduzierbaren Nachweisen.
- Widersprueche muessen benannt werden; keine stille Prioritaetsentscheidung.

## Arbeitsmodell

- Jede Mission nutzt immer einen isolierten Worktree.
- Pro Mission gibt es genau einen Writer und genau einen unabhaengigen Reviewer.
- Parallele Writer sind nur auf nachweislich unabhaengigen, nicht ueberlappenden Pfaden und ohne gemeinsame Migration erlaubt.
- Der Writer trifft gewoehnliche technische Entscheidungen selbststaendig im freigegebenen Scope.
- Es gibt hoechstens zwei automatische Reparaturschleifen.
- Rueckfragen sind nur bei echtem externem Blocker oder Produktentscheidung erlaubt.
- Dirty-Worktrees werden ohne ausdrueckliche Freigabe ausschliesslich read-only behandelt.

## Ohne Freigabe verboten

- Merge nach `main`.
- Production-Promotion oder Production-Deploy.
- Remote-Supabase-Migration.
- RLS- oder Policy-Aenderung.
- Daten- oder Dateiloeschung.
- Aktivierung kostenpflichtiger Dienste.

## Architekturregeln

- Stabile Vertraege laufen ueber SQL-Views, TypeScript-Typen und Komponenten-Props.
- Jede fachliche Wahrheit hat genau eine Single Source of Truth.
- KPI-Berechnungen gehoeren in SQL-Views.
- Keine Mockdaten, erfundenen Zahlen oder `Math.random` im Produktionspfad.
- Keine Client-`tenantId`-Autorisierung.
- Keine pauschale Public-RLS-Policy mit `FOR ALL` und `USING true`.
- Keine Secrets oder PIN-Felder im Client-Payload.
- Keine Navigation ohne ausdruecklichen Auftrag aendern.
- Datenkette immer: Datenquelle -> View/Vertrag -> Query/Action -> Komponente -> Loading/Empty/Error/Data.
- Supabase-Fehler immer mit `message`, `details` und `hint` loggen, wenn diese Felder verfuegbar sind.
- Originale werden vor OCR und fachlicher Zuordnung dauerhaft gesichert.
- Kamera, Datei-Upload, Dokument-OCR und Teile-/Zustandsfoto sind getrennte Fachzwecke auf einer gemeinsamen Capture-Basis.
- Modulgrenzen muessen ueber explizite Ports/Provider, Typen und Props verlaufen; keine Tiefimporte in fremde Modul-Interna.
- Kreile-spezifische Begriffe, Tenant-Werte, Rollen, Tabellen und UI-Texte duerfen nicht in wiederverwendbare Kerne eingebrannt werden.
- Jetzt wird nichts vorschnell extrahiert: zuerst stabilisieren, waehrenddessen Schnittkanten dokumentieren; spaeter genau einmal kontrolliert herausloesen.

## Abschluss

- Erlaubte Abschlussstatus: `PASS`, `FAIL_INTERNAL`, `BLOCKED_EXTERNAL_PERMISSION`, `BLOCKED_PRODUCT_DECISION`.
- Kein Abschluss ohne Draft-PR, Checks, Vercel Preview und nummerierte Nachweise.
- Ein Feature gilt nicht als produktreif, wenn der relevante Nutzer-Twin den Kernweg nicht ohne versteckte Entwicklerkenntnisse ausfuehren kann.
