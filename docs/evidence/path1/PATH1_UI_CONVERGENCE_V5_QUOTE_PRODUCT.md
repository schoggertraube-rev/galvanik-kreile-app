# PATH1 UI Convergence V5 – P2 KV-Produktlebenszyklus

Status: `LOCAL_REAL_DB_BROWSER_AND_GATES_PASS_EXACT_SHA_CI_PENDING_NO_UI_PASS`

Dieser Beleg beschreibt ausschließlich den P2-Vertikalschnitt für persistent
fortsetzbare KVs. Er behauptet weder einen Gesamt-PASS der UI-Konvergenz noch
eine Versand-, Provider- oder Produktionsfreigabe.

## Gebundener Vertrag

- Designpointer: `docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json`
- Ablaufreferenz: `docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html`
- Verifizierter SHA-256: `75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA`
- Migration: `20260916090000_path1_quote_product_lifecycle.sql`, additive,
  ausschließlich lokal auf frischer Supabase angewandt.

## Reale Datenkette

1. `private.quotes` bleibt das tenantgebundene KV-Aggregat; die bestehende
   Kundenzuordnung und die bestehende F1.1-Order-Wahrheit bleiben unverändert.
2. Jede Bearbeitung legt eine neue unveränderliche Positionsrevision an,
   erhöht die Version und schreibt genau ein `QUOTE_UPDATED_V1`-Ereignis mit
   update-spezifischem Receipt.
3. `private.v_quotes_v1` liest ausschließlich die aktuelle Revision;
   `private.v_open_quotes_v1` liefert nur offene Entwürfe desselben Tenants.
4. `update_quote_v1` bindet Actor, Tenant, ClientEventId, erwartete Version
   und Intent-Hash. Identische Wiederholung liefert dasselbe Receipt;
   geänderter Intent oder ein alter Stand endet fail-closed in Konflikt.
5. Der Zuschlag nutzt weiterhin ausschließlich `prepare_quote_conversion_v1`
   plus den vorhandenen F1.1-Intake-Command. Die Konvertierung kopiert die
   aktuelle Positionsrevision als finale immutable Aggregate-Version, erzeugt
   dadurch genau einen verknüpften Auftrag und erhält den Receipt-Readback.

## Sichtbarer Vertrag

`GlobalCreateFlow` bleibt die einzige sichtbare Erfassungskomposition. Die
Auswahl `Offene KVs bearbeiten` liest serverseitig gespeicherte Entwürfe,
öffnet einen Entwurf mit seiner Version und speichert nur über den bestehenden
tenant-/actor-gebundenen Action-Port. Ein Versand-Button wird nicht gerendert:
ohne realen M365-Receipt gibt es keinen gesendeten KV.

## Post-P2-Härtung: zugesagter Termin

- `confirmedOrderDueDate` bleibt ein lokaler, bewusst zu bestätigender Wert und
  wird nicht aus dem Terminwunsch des KV abgeleitet.
- Beim Bearbeiten des aktuellen KV, beim Wechsel zu einem anderen KV und beim
  erneuten Öffnen eines gespeicherten KV wird der Wert geleert. Der
  Zuschlagsbutton bleibt bis zur erneuten Eingabe eines gültigen Datums
  deaktiviert; das Feld meldet den fehlenden Wert mit `aria-invalid=true`.
- Ein Commandfehler, Versionskonflikt oder unklarer Ausgang löscht die Eingabe
  nicht. Diese Rettungsleine ist im Rendervertrag separat abgesichert.
- Die Änderung erweitert weder den Datenvertrag noch die Migration und ändert
  nichts an der idempotenten Konvertierung in genau einen F1.1-Auftrag.

## Lokaler Nachweis

- Frischer lokaler Supabase-Reset, einschließlich der P2-Migration: PASS.
- Quote-Persistenz-/Update-/Conversion-Real-DB-Test:
  `src/test/path1_quote_to_order.integration.test.ts`, 6/6 PASS.
- Quote-Command-, Read-Port-, GlobalCreate-Render- und Real-DB-Tests:
  4 Dateien, 23/23 PASS.
- Post-P2-Rendervertrag:
  `src/components/layout/__tests__/path1GlobalCreateFlow.realRender.test.tsx`,
  12/12 PASS. Er belegt Reset bei Bearbeiten, Wechsel und Wiederöffnen sowie
  Eingabeerhalt bei Konflikt und unklarem Ausgang.
- Production-Browserlauf auf lokalem Production-Build und Loopback-Supabase:
  PASS. Er belegt Rolf-PIN-Login, leeren Start, direkten Eingang, Kundenanlage,
  KV-Anlage, KV-Bearbeitung auf Stand 2, Reload-Readback, Zuschlag und genau
  einen F1.1-Auftrag. Ein zuvor gültiges Zuschlagsdatum ist nach Bearbeiten und
  nach Reload/Wiederöffnen leer; bei 1914x917, 768x1024 und 390x844 ist das
  Feld sichtbar und touch-tauglich. Ohne erneute gültige Eingabe bleibt der
  Zuschlagsbutton deaktiviert, danach wird er aktiv. Die Aktion und der
  ereignisgebundene PIN-Login liefen ohne feste Wartezeit.
- Receipt-Readbacks des Browserlaufs: Kundenanlage
  `303b1b24-2f90-462e-ae84-23d62b6239a6`, KV
  `6bfb0c99-be6f-4fc3-8221-232585d8c0eb`, Zuschlag
  `50e55200-f142-46d3-812d-b47d071d1f94`; erzeugte Nummern
  `KV-2026-0001` und `A-2026-0002`.
- Browserartefakte aus der gebauten App: 1914x917
  `v5-start-identities-desktop-1914x917.png`
  (`2d4a5c903a49b233c677bce33f7213ee66eeabfdfd71d75c0cf9033a105e3d58`),
  1220x880 `v5-rolf-data-tablet-1220x880.png`
  (`7cc4396827170664d16ce5c274823ba35106f3f6e1d816b2f161ba01b6c7b525`),
  1024x768 `v5-invoices-target-shell-1024x768.png`
  (`7eb5509db0e56a9d44fcf7092a26618b82ca8e810a107f7c575e1ff4a4d4777d`),
  768x1024 `v5-kv-form-tablet-768x1024.png`
  (`9f81e516602856e1233f33c9a06d443f043bee4343b7d3da14853de20b3f3d96`),
  Reset nach Bearbeiten Desktop
  `v5-award-date-reset-after-edit-desktop-1914x917.png`
  (`0483623a5ba4a9131fa02707e3055ebb6729d542166fa9929bee82d09a077a2d`),
  Reset nach Wiederöffnen Desktop
  `v5-award-date-reset-after-resume-desktop-1914x917.png`
  (`177ae158048b2ec89e64dfe1688abf4396d77e35abdc0b07f969d179fb0a005d`),
  Tablet `v5-award-date-reset-after-resume-tablet-768x1024.png`
  (`ceb4274b68a176278e1cc8042a4568a4ad960458dd355cdc8e1a120fe0230ee2`),
  Mobile `v5-award-date-reset-after-resume-mobile-390x844.png`
  (`09aba9b55efe7f93f05852968b0f6e160ada9f3a91cf5409306782d73c37dbb0`),
  erneut gültig Mobile `v5-award-date-mobile-390x844.png`
  (`559677160219a00506498db40e2188ba9b5ff68ab4e1f5e74d0ac7c473f0b831`)
  und 390x844 `v5-order-receipts-mobile-390x844.png`
  (`b287c466f02a338ef5642dbb35ff8c40feeb19adaef1e1dae7e65650087c9451`).
  Alle Captures prueften `scrollWidth <= clientWidth`.
- Vollständige lokale Units: 102 Dateien, 828/828 PASS. TypeScript,
  Full-ESLint, Ratchet (0/0), Modul-Gates, Authority-Gate plus Selftest,
  No-Fake plus Selftest, W4-Schema-/Read-Port-Gates und Build: PASS. Der
  eingefrorene W4-Storage-/Action-/UI-Vertrag lief nach zustandsgebundener
  lokaler Storage-Readiness auf seinem exakten 14-Migrationsstand 14/14 PASS.

## Grenzen

Keine RLS-/Policy-Änderung, keine Remote-Migration, kein Provider, keine
M365-Sendeaktion und keine zweite Order-Mutation sind Teil dieses Pakets.
