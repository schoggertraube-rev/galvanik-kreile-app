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

## Lokaler Nachweis

- Frischer lokaler Supabase-Reset, einschließlich der P2-Migration: PASS.
- Quote-Persistenz-/Update-/Conversion-Real-DB-Test:
  `src/test/path1_quote_to_order.integration.test.ts`, 6/6 PASS.
- Quote-Command-, Read-Port-, GlobalCreate-Render- und Real-DB-Tests:
  4 Dateien, 23/23 PASS.
- Production-Browserlauf auf lokalem Production-Build und Loopback-Supabase:
  PASS. Er belegt Rolf-PIN-Login, leeren Start, direkten Eingang, Kundenanlage,
  KV-Anlage, KV-Bearbeitung auf Stand 2, Reload-Readback, Zuschlag und genau
  einen F1.1-Auftrag. Das Zuschlagsdatum ist bei 1914x917, 768x1024 und
  390x844 sichtbar und touch-tauglich; ohne gültiges Datum bleibt der
  Zuschlagsbutton deaktiviert, mit Datum wird er aktiv. Die Aktion lief ohne
  feste Wartezeit.
- Receipt-Readbacks des Browserlaufs: Kundenanlage
  `e064b451-db60-4ed4-b64e-9dffbe34ae21`, KV
  `a37bf3a8-bf3a-45f0-bce3-9234bf72989e`, Zuschlag
  `cbc814a7-dcfc-4d1b-a3ed-831ea6ff6c8a`; erzeugte Nummern
  `KV-2026-0001` und `A-2026-0002`.
- Browserartefakte aus der gebauten App: 1914x917
  `v5-start-identities-desktop-1914x917.png`
  (`2d4a5c903a49b233c677bce33f7213ee66eeabfdfd71d75c0cf9033a105e3d58`),
  1220x880 `v5-rolf-data-tablet-1220x880.png`
  (`7f05d9aec9cf60e76a800522ad5b2c2a52bd9ef1bf39dd2b079f4a99ed82fa64`),
  1024x768 `v5-invoices-target-shell-1024x768.png`
  (`7eb5509db0e56a9d44fcf7092a26618b82ca8e810a107f7c575e1ff4a4d4777d`),
  768x1024 `v5-kv-form-tablet-768x1024.png`
  (`dc4f36ba6bb6c73dc95c19a29f7df478ea97b4d22844a138275356d3da78af5d`),
  Datumsfeld Desktop `v5-award-date-desktop-1914x917.png`
  (`ac0b0f9068a79fc161db0f219ed5696e35780a7487ec7f2c5a5db4ae703c9dd8`),
  Tablet `v5-award-date-tablet-768x1024.png`
  (`f1444150534d49710734b0f3f2841e55aa0c63438592443da78a399d1a2986f3`),
  Mobile `v5-award-date-mobile-390x844.png`
  (`6aa38443b5fac7bcb6b506164940130ce5a119ea7a591372ceb7790006e8914f`)
  und 390x844 `v5-order-receipts-mobile-390x844.png`
  (`b287c466f02a338ef5642dbb35ff8c40feeb19adaef1e1dae7e65650087c9451`).
  Alle Captures prueften `scrollWidth <= clientWidth`.

## Grenzen

Keine RLS-/Policy-Änderung, keine Remote-Migration, kein Provider, keine
M365-Sendeaktion und keine zweite Order-Mutation sind Teil dieses Pakets.
