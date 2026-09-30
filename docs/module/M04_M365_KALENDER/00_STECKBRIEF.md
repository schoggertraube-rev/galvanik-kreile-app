<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 00 — Steckbrief M04 Microsoft-365-Kalender

**Zweck:** Fachlich bestätigte Kreile-Termine in den Hauptkalender des Kreile-Büropostfachs projizieren, Änderungen und Löschungen idempotent nachführen sowie Betriebstermine und Abwesenheiten von dort schreibgeschützt in die Kreile-App einblenden. Der Kalender arbeitet hauptsächlich im Hintergrund; Auftragsannahme, Terminverschiebung, Startseite und Werkstatt bleiben die primären Arbeitsorte.

**Stufe:** **hinten angestellt**; M04 ist Pflicht vor Abschluss F1.6, Umsetzung jedoch hinter Grundsystem, Owner-UX-Konvergenz, Suche und den Missionspaketen A–D.

**Dossier-Status:** **BAUBEREIT** — Spezifikation vollständig; ungelöste Produkt- und Providerfragen sind in `08_OFFENE_FRAGEN.md` fail-closed geschlossen.

**Modul-Status:** **HINTEN_ANGESTELLT**; wiederverwendbarer Kern liegt als **OFF_REPO_KANDIDAT** vor, Produktadoption und reale Provider-E2E fehlen.

**zuständige Session:** Modulchat M365, Session `01a0aa99`; spätere Koordinator-Digests wurden wegen Aktualität zusätzlich geprüft.

**Arbeitsordner:** `C:\Users\Traube\Documents\Codex\2026-09-16\kreile-microsoft-365-integration` (nur Quelle, nicht Produktwahrheit).

**Code-Pfad:** Off-repo-Kandidat `work\provider-operation-kernel-v1-candidate.3\`; Artefakt-Set SHA-256/12 `87015E9ED2CB`.

**Produktcode:** Im zuletzt verfügbaren, am 2026-09-26 dokumentierten Stand war noch kein M04-Code in `origin/main@21a23567d51e`; die alte Route `/kalender` war entfernt. Aktuelle Revalidierung ist wegen `dubious ownership` nicht möglich → Q-M04-011.

**Braucht:** Kanonische Kreile-Fachterminquellen, Kreile-Tenant mit lizenziertem Büropostfach und Azure-Abo, delegierte Identität, sichere Token-Übergabe, connector-private Job-/Outbox-/Operation-/Mapping-/Delta-Ablage mit Receipts, Supabase Cron, Vercel-Queue-Eingang für Microsoft-Benachrichtigungen, Graph-Adapter, Designfreigabe und reale E2E-Abnahme.

**Wird gebraucht von:** Auftragsannahme (Wunschtermin), Terminverschiebung, Startseite/Tagesüberblick mit anstehenden Abwesenheiten, Werkstatt, Auftrags-/Kundenkontext, T-07 zum Nachschlagen und Gregor-Einstellungen für den Verbindungszustand.

**Anbindungszeitpunkt + Gate:** Nach fertigem Grundstamm und abgenommenem Modul: atomare Adoption von Manifest + Handshake + Ports + Kreile-HostAdapter + DB/RLS/Job-/Outbox-Tabellen + Supabase-Cron/Edge-Worker + Vercel-Queue-Eingang + realem Graph-Adapter; danach Tests aus `07_ABNAHME_TESTS.md`, unabhängiger Review, Kreile-Tenant-E2E und Owner-Abnahme. Keine Teiladoption.

**Bis dahin im Grundsystem:** **Element:** nicht klickbarer Microsoft-365-Verbindungsstatus in Gregors Einstellungen; keine M04-Route und kein Kalender-Navigationsziel. **Status:** `In Klärung`. **Wörtlicher Text:** „Microsoft 365 – In Klärung“. Auftrags-/Startseitenflächen zeigen keine erfundenen Outlook-Daten.

**Übertragbarkeit:** **Kern app-neutral: ja.** Grund: Ports, Idempotenz-, Receipt-/Readback-, Retry-, Lease-, Delta- und Subscription-Mechanik sind fachbegriffsneutral; Kreile-Terminarten, Inhalte, Identität, Ressourcen und Feldzuordnung liegen ausschließlich im Kreile-HostAdapter.

**Rate-Stellen aus Red-Team:** RT-03, RT-09, RT-21, RT-22, RT-23, RT-24, RT-25 und RT-31; geschlossen durch Terminologie-/Hostgrenzen, responsive Zustandsmatrix, fail-closed Sichtbarkeit, Designphase-1b-Gate und externe M365-Gates.

**Stand:** 2026-09-26

**Bearbeiter:** Codex, quellengebundene Dossiererstellung; keine Code-, Provider- oder Repo-Änderung.

## Verbindliche Kurzform

1. **App/Postgres ist Terminwahrheit; Microsoft 365 ist nur Projektion.**
2. **Kein Google-, Demo-, In-Memory- oder stiller Fallback.**
3. **Provider-Erfolg zählt erst nach Receipt und Readback.** Ein Timeout ist `UNKNOWN`, nicht Erfolg und nicht vorschnell Fehler.
4. **Delegiertes Kreile-Büropostfach mit eigener Lizenz und dessen Hauptkalender** ist der Zielmodus. App-only erfordert eine neue Owner-Entscheidung.
5. **M04-Route und Kalendernavigation bleiben unsichtbar**, bis Produktadoption und reale nichtproduktive Graph-E2E vollständig bestanden sind; im Grundstamm ist nur das nicht klickbare Element „Microsoft 365 – In Klärung“ zulässig.
6. **`public.calendar_events` ist Legacy**, nicht die fachliche oder technische Wahrheit des neuen M04.
7. **Produktivressourcen gehören Kreile.** Die bestehende Owner-Dev-Umgebung ist ausschließlich für synthetische Tests; der E2E wird im Kreile-Tenant wiederholt.
