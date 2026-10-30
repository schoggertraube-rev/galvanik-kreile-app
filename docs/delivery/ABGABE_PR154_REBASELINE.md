# Abgabe · PR #154 Rebaseline nach Retarget

Stand: 30.10.2026

## Kandidat

- Branch: `kreile/s1-p2-eingang`
- Produktkandidat: `114b43f217c63fc5a1740687be4fc7520b10b152`
- PR: `#154`, Basis `main`
- Exact-SHA-Preview (`READY`): `https://galvanik-kreile-werkstatt-9ycaf8j2s.vercel.app`
- Merge: nicht durchgeführt

## Einmalige Umfangs-Rebaseline

`docs/evidence/live-line/pr154/REBASELINE.json` bindet die Freigabe an genau:

- PR `#154`
- Branch `kreile/s1-p2-eingang`
- Main-Basis `1fa4920d6d06b02413c8c157ae6b739507105846`
- Owner `Siglinder`, Entscheidung `30.10.2026`

Eine andere Basis, ein anderer Branch oder ein veränderter Receipt wird abgelehnt. Für alle Folge-PRs bleibt die normale Paketprüfung unverändert streng. Der Selbsttest belegt den gültigen Receipt sowie die Ablehnung einer verschobenen Basis und einer gelockerten Folge-PR-Regel.

## ESLint-Ratchet · geprüfte Migration

Die Regeln wurden nicht abgeschwächt. Der neue Kandidatenstand bleibt bei **0 Fehlern, 0 Warnungen, 0 Dateien mit Issues**.

Regel-Diff gegen `origin/main`:

| Änderung | Schwere / Grenze |
|---|---|
| H16-Regeln `no-role-identity-comparison`, `no-role-permissions`, `no-person-names`, `no-silent-errors`, `no-alert`, `no-placeholder-text` ergänzt | jeweils `error` in `src/**/*.ts(x)` |
| Testdateien | H16-Regeln dort `off`, damit synthetische Testtexte keine Produktverletzung vortäuschen; Produktpfade bleiben `error` |
| Bestehende Altlastenlisten | einzelne, benannte Dateien; Listen dürfen nur schrumpfen |
| H11c-Ausnahmen | exakt drei datei- und ausdrucksgebundene Stellen mit angrenzendem Kommentar `erlaubt H11c`; keine allgemeine Rollen-Ausnahme |
| `supabase/.temp/**` | generierte lokale Supabase-Artefakte ignoriert |
| Vorhandene Regeln und Schweregrade | unverändert |

Baseline-Vertrag:

- vorher: 0 Fehler / 0 Warnungen
- nachher: 0 Fehler / 0 Warnungen
- neuer `lintContractHash`: `242a5417463fe83bac8dd05764b4f54759106e1670bc4f55af58caa0710b6adb`
- neuer `judgeContractHash`: `faf59afb7e1a02ec7026ea37858e02a1a99dc7d7a3712d7133d8ac8505abaa64`

## F1.4 auf aktuellem Schema

Der CI-Replay setzt unmittelbar vor F1.4 die komplette aktuelle Migrationkette frisch und ohne Seed auf. Danach wird der historische F1.5-Stand separat wiederhergestellt, damit dessen eigene Regression unverändert isoliert bleibt. Die F1.4-Fixtures verwenden die aktuelle Rechtewahrheit `app_user_rights`; Assertions für unveränderliche Rechnung, Storno, Reissue, PDF/Hash, Replay, Tenant-Isolation und Race-Verhalten wurden nicht entfernt oder abgeschwächt.

Lokaler Fresh-Replay: **2 Dateien, 11 Tests grün**.

Die anschließende F1.5-Fixture übergibt jetzt den im aktuellen Intake-Vertrag verpflichtenden Start-Zahlungsmodus `vorkasse`. Ihre Prüfungen der späteren Zahlungsmodus-Wechsel, Rechnung und des Warenausgangs bleiben unverändert.

## Capability-Register nach Retarget

Das Register wurde ausschließlich an die tatsächlich im Rebaseline-Kandidaten vorhandenen Pfade angeglichen: **13 Seiten, 2 API-Routen, 48 Server-Action-Gruppen**. Entfernt wurden 27 veraltete Registerzeilen für im Kandidaten nicht vorhandene Pfade; es wurden keine Produktpfade, Stubs oder Funktionen ergänzt. `quality:no-fake-production` meldet danach 0 Mock-Befunde und 0 Registerlücken.

## Erfolgsmeldung „Rechnung ausstellen“

Nach bestätigter Server-Action und erfolgreichem Receipt-/Auftragskarten-Readback erscheint ein Dialog „Rechnung ausgestellt“. Er verwendet denselben `invoice`-Receipt wie der bestehende Inline-Status und erzeugt keine zweite Erfolgswahrheit.

Nachweise:

- `src/test/h18_invoice_actions.integration.test.ts`: echte `issueInvoiceAction` gegen Replay-DB; prüft Rechnungszeile, `INVOICE_CREATED_V1`, Receipt, Rechnungsansicht und PDF/Hash — **grün**.
- `src/modules/orders/__tests__/OrderSurfaces.v8.test.tsx`: Dialog und sichtbarer Text — rot vor Änderung, danach **12/12 grün**.

## Datenbank-Soll und Gleichstand

- Aktion: genau eine ausgestellte Rechnungszeile und genau ein `INVOICE_CREATED_V1` für den Client-Event; danach dieselbe Rechnung im Readback.
- Dev-DB: Repo **65**, Dev **65**, letzte Migration beidseitig `20261030005000`, fehlend **0**, zusätzlich **0**.
- Diese Änderung führt keine neue Migration aus und ändert keine Live-Daten.

## Check-Liste

| Check | Ergebnis |
|---|---|
| Package-Scope Selbsttest | grün |
| Package-Scope PR #154 (Kandidaten-Gate) | grün; exakt an PR, Branch, Main-Basis und Receipt gebunden |
| Authority-Gate | grün im getrackten Kandidatenbestand |
| Module-Gates | grün im getrackten Kandidatenbestand |
| TypeScript | grün |
| fokussierter Order-Surface-Test | 12/12 grün |
| F1.4 Current-Schema-Replay | 11/11 grün |
| H18 Invoice Action → DB → Ansicht | 1/1 grün |
| vollständige Unit-Suite | grün im sauberen CI-Checkout |
| Fresh Supabase Replay einschließlich V5-Shell-Browserlauf | grün; 51 Schritte |
| GitHub CI am Produktkandidaten | vollständig grün |
| Vercel Exact-SHA-Preview | `READY` |

Der einmalige Trust-Anchor-Mini-PR `#155` ist gemergt. Die Schutzregeln sind wieder vollständig aktiv: Classic Branch Protection verlangt `agentur-gate` und `quality`; das aktive Ruleset verlangt zusätzlich `Fresh Supabase replay`. Es besteht keine Bypass-Ausnahme.

## Owner-Klickweg

1. `https://galvanik-kreile-werkstatt-9ycaf8j2s.vercel.app` öffnen und mit einem bestehenden Büro-/Meister-Zugang anmelden.
2. Einen fertigen Auftrag mit vollständigen Preisen öffnen und „Rechnung“ wählen.
3. Erwartet: Dialog „Rechnung ausgestellt“ mit Rechnungsnummer und Bestätigung des gespeicherten Readbacks.
4. Dialog schließen, Auftragskarte neu öffnen und Rechnungsnummer sowie „Rechnungs-PDF öffnen“ prüfen.
