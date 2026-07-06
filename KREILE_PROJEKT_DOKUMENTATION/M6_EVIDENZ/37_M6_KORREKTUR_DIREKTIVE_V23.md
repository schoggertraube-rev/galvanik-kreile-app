# 37 — Definitive Korrekturdirektive M6 → V2.3 (konsolidiert, code-verifiziert)

Zweck: **Konvergenz in EINEM Durchgang.** Alle offenen Funde aus Fremdprüfung `36_` — von Claude Fable 5 am echten `src/db/schema.ts` (Twin) gegengeprüft und bestätigt. Die Maschine setzt ALLE Punkte um, nicht häppchenweise. Danach eine finale Prüfung, dann Schluss mit Papier.

Grundprinzip dieser Runde: **Der Vertrag muss die EXISTIERENDEN Produktionspfade inventarisieren und je als „ersetzen" oder „härten" benennen.** Kein Ideal im luftleeren Raum mehr. Jede Tabelle/Spalte/Rolle gegen `src/db/schema.ts` belegt; wo remote unbelegt: als „SSG-00 remote zu verifizieren" markieren, nie als Fakt.

## A — Schema-Namensfehler (verifiziert, hart zu beheben)

| Fehler im Vertrag | Realität (schema.ts) | Fix in V2.3 |
|---|---|---|
| `orders.received_at` als bestehende Spalte behauptet, T3 schreibt sie | `orders` hat `intake_date` (Z.103), `source`, `source_ref` — **kein `received_at`** | Entweder aus T3 entfernen (nur `intake_date` nutzen) ODER als neue Migration + Drizzle-Symbol in B1 aufnehmen. Nicht als „bestehend" behaupten. |
| View `v_scan_events_timeline` nutzt `se.createdAt` | SQL-Spalte heißt `created_at` (Z.169) | In allen SQL-Views `created_at` schreiben (Drizzle-Property ≠ SQL-Spalte). |
| `events.order_id` „nur remote NOT NULL" | Drizzle: `orderId ... .notNull()` (Z.159) | B1 ändert BEIDES: Drizzle-Schema (`.notNull()` entfernen) UND Remote-Migration; remote per `information_schema` belegen. |
| Idempotenz global UNIQUE | — | `UNIQUE(tenant_id, client_idempotency_key)` (schon in V2.2, beibehalten). |

## B — Storage-RLS technisch neu (Befund 36-§2, gegen Supabase-Doku bestätigt)

`current_setting('app.tenant_id')` wirkt NICHT in `storage.objects`-Policies (Storage-API läuft nicht in der App-DB-Transaktion mit `SET LOCAL`). V2.3 muss §7.2 komplett neu fassen:

1. Storage-Policies gegen **authentifizierte Identität** prüfen, nicht gegen GUC:
   `EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.tenant_id = (storage.foldername(name))[1])`
   oder JWT-App-Metadata-Claim (nicht `raw_user_meta_data`).
2. Für Upsert/Retry: INSERT + SELECT + UPDATE getrennt abdecken; DELETE für `authenticated` ohne Policy + Negativtest.
3. **Ehrlichkeitspflicht:** Der echte Uploadpfad nutzt Service-Role (`scan-upload/route.ts:9-12`) = RLS-Bypass. V2.3 muss das benennen: entweder Service-Role-Storage abschaffen zugunsten nutzer-JWT-basierter RLS, ODER explizit als Application-Layer-Autorisierung mit Pfadvalidierung + eigenem Bypass-Test deklarieren — nicht als „authenticated-Storage-RLS verkaufen".
4. §3.6 `uploaded_by = auth.uid()`: `storage.objects` hat kein `uploaded_by` — Policy über `owner`/JWT/`app_users`-Lookup formulieren.

## C — Existierende Produktionspfade inventarisieren und in Scope nehmen (Kern der Konvergenz)

V2.3 muss diese realen Pfade namentlich als „zu ersetzen/härten" in die jeweilige Baumission aufnehmen:

| Pfad | Problem | Zielmission |
|---|---|---|
| `src/app/api/erfassung/scan-upload/route.ts` | Dateiname mit `Date.now()+Math.random()` (Z.29-30, verletzt Kernregel 17); `getPublicUrl` in `fileUrl` (Z.41-45, öffentlicher Link statt tenant-geschütztem Pfad); Base64 sofort an OCR (Z.50-56, OCR nicht auf gesichertem Original); Service-Role-Client (Z.9-12, RLS-Bypass) | B1/B2 — als zu ersetzender Pfad, mit Befundliste |
| `src/app/actions/erfassung.actions.ts::convertScanToOrder` (Z.578-679) | existiert bereits, aber **ohne `db.transaction`**, ohne `events`-Insert, ohne `conversion_order_id`/`conversion_event_id`, mehrere Einzelwrites | B3 — muss diesen Pfad atomar ERSETZEN/deaktivieren, nicht neben ihm eine zweite Action bauen (sonst Parallelwahrheit) |
| `supabase/functions/scan-analyze/index.ts` (Z.15-34) | akzeptiert `base64_data` ODER `file_url` als OCR-Quelle | B2 — hart eingrenzen: OCR nur auf gesichertem Original aus Storage; Base64/URL-Quelle deaktivieren oder begründet einschränken |
| Alt-Migration `0001_app_schema.sql:83-101` (`status_events`, `metadata`) + Alias `statusEvents = events` (schema.ts:235) | Parallelwahrheits-/Namensrisiko | B1/B4 — im Inventar erfassen; kanonisch ist `events`/`payload` |

## D — Kernregel 11 gegen echten Code (Befund 36-§3.3)

B3 darf T3 nicht als „neue Wunsch-Action" formulieren. Pflicht: den vorhandenen `convertScanToOrder` atomar ersetzen ODER deaktivieren; Rollback beweisen für Customer(-Match/-Anlage), Order, Items, Event, `scan_uploads.conversion_*` und `orders.source/source_ref/status`. Ein Zustand mit halb angelegtem Kunden/Auftrag muss unmöglich sein.

## E — Rollenmatrix korrigieren (Befund 36-§3, verifiziert schema.ts:13)

- `readonly` bekommt **kein** schreibendes Capture-/Upload-Recht (Widerspruch zum Namen; Kernregel 16). Upload nur `werkstatt`/`meister`/`buero`/`admin` — Zuschnitt begründen.
- Jede Server-Action: Rollen-Negativtest für die realen Werte `developer/admin/meister/buero/werkstatt/readonly` als Akzeptanzkriterium.

## F — SSG-11/16 (in V2.2 bereits GESCHLOSSEN — beibehalten)
Datenquellen-Inventar statt grep (B2-AK5, B7-AK5); Negativ-Inventar paralleler TS/Drizzle-Fachlogik (B4-AK5). Nicht verschlechtern.

## Umsetzungsauftrag
Die Maschine überarbeitet `proposals/M6_SLICE1_IMPL_CONTRACT_V2.md` → V2.3, setzt A–E vollständig um (F beibehalten), belegt jede Schema-Aussage mit `schema.ts`-Zeile, markiert remote Unbelegtes als SSG-00. Änderungsprotokoll V2.2→V2.3 mit je Punkt → Code-Beleg. Danach genau EINE finale Fremdprüfung.

## Ehrliche Erwartung an die Konvergenz
Nach A–E sollte der Vertrag auf echtem Code stehen. Was eine weitere Prüfung dann noch findet, dürfte Politur sein — kein Bug. Regel für den Abschluss: Findet die finale Prüfung nur noch Punkte ohne Sicherheits-/Datenintegritäts-/Schema-Charakter, wird akzeptiert; verbleibende Feinheiten wandern als benannte Punkte in die jeweilige Baumission (B1 selbst bringt Wahrheiten ans Licht, die kein Papier vorwegnehmen kann). Kein Streben nach Papier-Perfektion um den Preis des Stillstands.
