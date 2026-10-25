# Abgabe P1 · Datenfundament

Stand: 25.10.2026

## 1. Preview und Kandidat

- Preview: https://galvanik-kreile-werkstatt-7wmei8xcv.vercel.app
- Exakter Produkt-SHA: `38054e64aeb4d0778f6b3f0d8d14a55fadccc0e2`
- Draft-PR: https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/153
- PR-Basis: `kreile/b1-shell`
- Vercel-Nachweis am Produkt-SHA: Deployment `dpl_EZL2Z1ikTFTBpJ7QnmWK1qXWFZ5u`, Status `Ready`, Ziel `Preview`.

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
| S03 Nutzer & Rollen | teilweise | `/settings` | `src/app/settings/SettingsAdminClient.tsx`, bestehende Auth-Actions | `SettingsAppAdapter.test.tsx`; bestehende Rollen-/PIN-Tests im Gesamtlauf |
| A06 Kunde vollständig | ja | Kundenanlage, Kundenkarte | `src/modules/customers/server/createCustomerCommand.ts`, `updateCustomerCommercialCommand.ts`, `CustomerCardView.tsx`, Migration | `createCustomerCommand.test.ts`, Global-Create-Real-Render-Test |
| E02/A04 Auftrag vollständig | teilweise | Auftragserfassung | `orderIntakeCommand.ts`, `orderIntakeRead.ts`, `OrderIntakePanel.tsx`, Migration | Command-/Read-/Panel-Tests; Paket-E2E noch nicht grün |

`S02` ist für direkte Aufträge und als öffentlicher Modulport gebaut. Die Nutzung kataloggebundener Positionen in Angeboten folgt in P2. `E02/A04` erzwingt Liefertermin, Katalogleistung, Nettopreis und Steuer beim neuen Auftrag; eine vollständige sichtbare Terminänderungs-Historie ist noch nicht fertig.

## 4. Abweichungen von Vorlage und Bauumfang

- S03: Neue Nutzer werden nicht angelegt. Das bestehende Produkt-Akteursmodell akzeptiert ausschließlich Rolf, Phillip und Gregor. Eine Erweiterung wäre eine nicht freigegebene Auth-/Rollen-/Sessionänderung. Die UI zeigt deshalb „In Klärung“; Rollen-, PIN- und Sperrpflege der bestehenden Nutzer bleibt nutzbar.
- S02/A07: Bestehende freie Angebotspositionen sind noch nicht auf den Leistungskatalog umgestellt. Diese Integration gehört zum unmittelbar folgenden P2.
- A04: Der Datenbankbefehl verlangt bei Terminänderungen einen Grund und schreibt ein Ereignis; eine eigene Bearbeitungsoberfläche samt vollständiger sichtbarer Verlaufsausgabe fehlt noch.
- Screenshots der geschützten Seiten konnten nicht erzeugt werden: Die vorhandenen PINs kennt nur der Owner, und §1a verbietet neue Testnutzer. Es wurden keine Zugangsdaten erfunden oder im Repository hinterlegt.
- Die Preview wurde als reales Vercel-Deployment nachgewiesen; ein authentifizierter Browser-Smoke auf der Preview war ohne PINs nicht möglich.

## 5. Checks am Produkt-SHA

| Check | Ergebnis |
|---|---|
| Fresh-Replay der lokalen Supabase-Migrationen | PASS; vollständiger Replay bis `20261025182920_s1_p1_datenfundament.sql`, danach lokale Umgebung beendet |
| `npx tsc --noEmit --incremental false` | PASS |
| `npm run lint:full` | PASS |
| fokussierte P1-Unit-/Render-Tests | PASS: 87/87 in zwei isolierten Läufen |
| GitHub `npm run test:unit` | FAIL: 1006/1008 grün; ausschließlich zwei Authority-Assertions wegen vier nicht registrierter aktiver Lieferdateien |
| `npm run build` | PASS |
| `npm run quality:no-fake-production` | PASS |
| `npm run quality:module-gates` | FAIL: ausschließlich `ACTIVE_DELIVERY_SURFACE` für `ABGABE_P0.md`, `KREILE_BAUUMFANG_STUFEN.html`, `KREILE_CODEX_BAUAUFTRAG_STUFE1.md`, `OWNER_TODO.md`; Checker-/Governance-Dateien sind in P1 gesperrt |
| `e2e/f1-4-immutable-invoice.real.spec.ts` | NICHT GRÜN: letzter vollständiger Fresh-Replay-Lauf lief beim Katalog-Select in ein Timeout; die anschließende Selector-Korrektur ist noch nicht erneut end-to-end bestätigt |
| Vercel | PASS: Preview `Ready` |
| GitHub `agentur-gate` | FAIL infolge der beiden oben genannten Authority-Tests |

Es gibt keinen Erfolgsclaim für den Paket-E2E oder das Gesamt-Gate. Die erforderliche Owner-Aktion und die Empfehlung stehen in `docs/delivery/OWNER_TODO.md`.

## 6. Screenshots

Nicht geliefert. Für die geschützten neuen Seiten fehlen bewusst die nur dem Owner bekannten PINs; neue Testnutzer und Zugangsdaten im Repo sind untersagt. Offen sind daher 1914×917, 1220×880 und 390×844 für `/settings` und die kataloggebundene Auftragserfassung.

## 7. Nächster Schritt

Codex beginnt gemäß §1b ohne Wartephase P2 auf `kreile/s1-p2-eingang`, liest zuerst `_review/REVIEW_P2.md` (falls vorhanden) und baut zunächst die nicht extern blockierten Teile A07, E03 und A08. Graph/Azure werden bei fehlenden Zugängen als blockiert in `OWNER_TODO.md` geführt, ohne den restlichen Bau anzuhalten.

Owner: Authority-Checker-Freigabe und Begrenzung von S03 auf die vorhandenen drei Nutzer gemäß `OWNER_TODO.md` entscheiden; ansonsten für den Start von P2 nichts tun.
