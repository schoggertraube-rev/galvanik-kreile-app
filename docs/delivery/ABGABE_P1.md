# Abgabe P1 · Datenfundament

Stand: 26.10.2026

## 1. Preview und Kandidat

- Preview: https://galvanik-kreile-werkstatt-p8hd4r46a.vercel.app
- Exakter Produkt-SHA: `77be9686fcaeef0df576b1139ef229faabbb4384`
- Draft-PR: https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/153
- PR-Basis: `kreile/b1-shell`
- Vercel-Nachweis am Produkt-SHA: Deployment `dpl_3WtiqD6heDubjG3wMAcHJ5kW4t4y`, Status `Ready`, Ziel `Preview`.

## 2. Rollen auf der Preview

- Gregor (Admin): sieht unter `/settings` Firmendaten, unveränderliche Nummernkreise, Leistungskatalog sowie Rollen-, PIN- und Sperrpflege für die bestehenden Nutzer.
- Rolf (Meister/Büro): kann vollständige Kunden und kataloggebundene Aufträge mit Preis, Steuer und Liefertermin anlegen und Kundenstammdaten bearbeiten.
- Phillip (Werkstatt): behält seine Werkstattansicht; P1 erweitert dort keine administrativen Schreibrechte.
- PINs und Zugangsdaten stehen nicht in dieser Abgabe. Es wurden keine Nutzer und keine Daten in der Live-Datenbank angelegt oder verändert.

## 3. Gebaut

| ID | Stand | Route | Zentrale Dateien | Test/Nachweis |
|---|---|---|---|---|
| S01 Firmendaten | ja | `/settings` | `src/app/settings/SettingsAdminClient.tsx`, `src/modules/fundament/server/systemSettingsPort.ts`, Migration | `systemSettingsPort.test.ts`, `SettingsAppAdapter.test.tsx` |
| S02 Leistungskatalog | teilweise | `/settings`, Auftragserfassung | `src/modules/katalog/**`, `src/app/actions/catalog.actions.ts`, `src/components/erfassung/OrderIntakePanel.tsx`, Migration | `catalogServicePort.test.ts`, `OrderIntakePanel.test.tsx` |
| S03 Nutzer & Rollen | ja, im entschiedenen Stufe-1-Scope | `/settings` | `src/app/settings/SettingsAdminClient.tsx`, bestehende Auth-Actions | `SettingsAppAdapter.test.tsx`; bestehende Rollen-/PIN-Tests im Gesamtlauf |
| A06 Kunde vollständig | ja | Kundenanlage, Kundenkarte | `src/modules/customers/server/createCustomerCommand.ts`, `updateCustomerCommercialCommand.ts`, `CustomerCardView.tsx`, Migration | `createCustomerCommand.test.ts`, Global-Create-Real-Render-Test |
| E02/A04 Auftrag vollständig | teilweise | Auftragserfassung | `orderIntakeCommand.ts`, `orderIntakeRead.ts`, `OrderIntakePanel.tsx`, Migration | Command-/Read-/Panel-Tests; Paket-E2E noch nicht grün |

`S02` ist für direkte Aufträge und als öffentlicher Modulport gebaut. Die Nutzung kataloggebundener Positionen in Angeboten folgt in P2. `E02/A04` erzwingt Liefertermin, Katalogleistung, Nettopreis und Steuer beim neuen Auftrag; eine vollständige sichtbare Terminänderungs-Historie ist noch nicht fertig.

## 4. Abweichungen von Vorlage und Bauumfang

- S03: Owner-Entscheidung vom 25.10.2026 umgesetzt. Stufe 1 pflegt ausschließlich Rolf, Phillip und Gregor; „Nutzer anlegen“ ist im V8-Muster als „geplant“ ausgegraut. Neue Nutzer folgen später als eigene Auth-Erweiterung.
- S02/A07: Bestehende freie Angebotspositionen sind noch nicht auf den Leistungskatalog umgestellt. Diese Integration gehört zum unmittelbar folgenden P2.
- A04: Der Datenbankbefehl verlangt bei Terminänderungen einen Grund und schreibt ein Ereignis; eine eigene Bearbeitungsoberfläche samt vollständiger sichtbarer Verlaufsausgabe fehlt noch.
- Screenshots der geschützten Seiten sind noch nicht erzeugt. Der Owner hat die Nutzung der bestehenden Testphasen-Logins am 26.10.2026 freigegeben; im aktuellen Repository, Prozess-Environment und Vercel-Environment waren die Zugangswerte nicht auffindbar. Die Suche in den freigegebenen Projektablagen läuft, ohne Zugangsdaten ins Repository oder in die Abgabe zu schreiben.
- Die Preview wurde als reales Vercel-Deployment nachgewiesen; ein authentifizierter Browser-Smoke ist noch offen und wird nach Auffinden der freigegebenen Zugangswerte nachgeholt.

## 5. Checks am Produkt-SHA

| Check | Ergebnis |
|---|---|
| Fresh-Replay der lokalen Supabase-Migrationen | PASS; vollständiger Replay bis `20261025182920_s1_p1_datenfundament.sql`, danach lokale Umgebung beendet |
| `npx tsc --noEmit --incremental false` | UNBESTÄTIGT am neuen SHA: lokaler Wiederholungslauf überschritt 300 Sekunden; letzter vollständiger Lauf vor der reinen S03-UI-Korrektur war PASS |
| `npm run lint:full` | UNBESTÄTIGT am neuen SHA: kombinierter lokaler Wiederholungslauf überschritt sein Zeitlimit; letzter vollständiger Lauf vor der reinen S03-UI-Korrektur war PASS |
| fokussierte P1-Unit-/Render-Tests | PASS: ursprüngliche 87/87 sowie nach der S03-Entscheidung `SettingsAppAdapter.test.tsx` 5/5 |
| GitHub `npm run test:unit` | FAIL: 1006/1008 grün; ausschließlich zwei Authority-Assertions wegen vier nicht registrierter aktiver Lieferdateien |
| `npm run build` | PASS |
| `npm run quality:no-fake-production` | PASS |
| `npm run quality:module-gates` | FAIL: ausschließlich `ACTIVE_DELIVERY_SURFACE` für `ABGABE_P0.md`, `KREILE_BAUUMFANG_STUFEN.html`, `KREILE_CODEX_BAUAUFTRAG_STUFE1.md`, `OWNER_TODO.md`; Checker-/Governance-Dateien sind in P1 gesperrt |
| `e2e/f1-4-immutable-invoice.real.spec.ts` | NICHT GRÜN: letzter vollständiger Fresh-Replay-Lauf lief beim Katalog-Select in ein Timeout; die anschließende Selector-Korrektur ist noch nicht erneut end-to-end bestätigt |
| Vercel | PASS: Preview `Ready` |
| GitHub `agentur-gate` | am Produkt-SHA beim Abgabe-Update noch `IN_PROGRESS`; der vorherige Lauf scheiterte ausschließlich an den beiden genannten Authority-Tests |

Es gibt keinen Erfolgsclaim für den Paket-E2E oder das Gesamt-Gate. Die erforderliche Owner-Aktion und die Empfehlung stehen in `docs/delivery/OWNER_TODO.md`.

## 6. Screenshots

Noch nicht geliefert. Die Nutzung der bestehenden Testphasen-Logins ist inzwischen freigegeben; neue Testnutzer bleiben untersagt und Zugangswerte werden weder im Repository noch in dieser Abgabe gespeichert. Offen sind 1914×917, 1220×880 und 390×844 für `/settings` und die kataloggebundene Auftragserfassung.

## 7. Nächster Schritt

Codex beginnt gemäß §1b ohne Wartephase P2 auf `kreile/s1-p2-eingang`, liest zuerst `_review/REVIEW_P2.md` (falls vorhanden) und baut zunächst die nicht extern blockierten Teile A07, E03 und A08. Graph/Azure werden bei fehlenden Zugängen als blockiert in `OWNER_TODO.md` geführt, ohne den restlichen Bau anzuhalten.

Owner: Nur noch die Authority-Checker-Freigabe gemäß `OWNER_TODO.md` entscheiden; S03 ist durch `OWNER_ENTSCHEIDUNGEN.md` geklärt und umgesetzt. Für den Start von P2 sonst nichts tun.
