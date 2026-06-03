# F-BH-08 — Migration Review: GoBD, RLS, Storage, Supabase-Plan

**Datum:** 2026-06-03
**Commit:** `2596f3d`
**Status:** REVIEW — NICHT AUSGEFÜHRT

---

## 1. Git-Status

- Branch: `main`
- Arbeitsbaum: **sauber**
- HEAD: `2596f3d revert(buchhaltung): restore multi-tile cockpit from ff481ba, fix nested anchor`

## 2. Gelesene Dateien

| Datei | Gelesen | Relevant |
|---|---|---|
| `12_BUCHHALTUNG_AGENTS_CONSTRAINTS.md` | ✅ | STOPP-Bedingungen, Anti-Drift |
| `14_BUCHHALTUNG_HAUPTSPEC.md` | ✅ (via Session-History) | Funktionsumfang |
| `15_BUCHHALTUNG_DATENMODELL.md` | ✅ | Pflichtschema, Trigger, Provider |
| `16_BUCHHALTUNG_INTEGRATIONEN_KI.md` | ✅ | Export-Adapter, KI-Regeln |
| `17_BUCHHALTUNG_DATENSCHUTZ_GOBD.md` | ✅ | DSGVO, GoBD, RLS-Rollen |
| `18_BUCHHALTUNG_BUILD_GOLIVE.md` | ✅ | Build-Reihenfolge, Go-Live |
| `docs/VORSCHAU_migration_buchhaltung.sql` | ✅ | Bestehende Vorschau (273 Zeilen) |
| `src/db/schema.ts` | ✅ | Drizzle-Schema (bestehend) |
| `src/lib/buchhaltung/types.ts` | ✅ | TS-Typen (316 Zeilen) |
| `src/lib/buchhaltung/providers/*` | ✅ | MockProvider + Interface |
| `supabase/migrations/*` | ✅ | 17 Migrationen |

## 3. Bestehende Migrationen & Konflikte

### Vorhandene Migrationen (17 Stück)

| # | Datei | Thema |
|---|---|---|
| 0001 | `0001_app_schema.sql` | Grundschema (orders, customers, etc.) |
| 0002 | `0002_rls_policies.sql` | RLS-Grundregeln |
| … | 0003–0015 | Erweiterungen (inquiries, items, complaints, etc.) |
| admin | `202605290000_admin_console.sql` | **app_users, feature_flags, audit_log** |
| realtime | `202605290001_realtime_activation.sql` | Realtime |
| schema | `202605290002_schema_contract_sync.sql` | Schema-Sync |

### ⚠️ KONFLIKT: `audit_log`

| Objekt | Besteht? | Datei/Migration | Risiko | Empfehlung |
|---|---|---|---|---|
| `audit_log` (Admin) | ✅ Ja | `202605290000_admin_console.sql` | **HOCH** — Namenskollision mit Buchhaltungs-`audit_log` | Buchhaltung nutzt **`bh_audit_log`** (separater Name) ✅ bereits so in VORSCHAU |
| `beleg` | ❌ Nein | — | Kein Konflikt | Neu anlegen |
| `beleg_position` | ❌ Nein | — | Kein Konflikt | Neu anlegen |
| `kraftstoff_detail` | ❌ Nein | — | Kein Konflikt | Neu anlegen |
| `ausgangsrechnung` | ❌ Nein | — | Kein Konflikt | Neu anlegen |
| `zahlung` | ❌ Nein | — | Kein Konflikt | Neu anlegen |
| `kategorie` | ❌ Nein | — | Kein Konflikt | Neu anlegen |
| `lieferant` | ❌ Nein | — | Kein Konflikt | Neu anlegen |
| `steuerprofil` | ❌ Nein | — | Kein Konflikt | Neu anlegen |
| `ustva_periode` | ❌ Nein | — | Kein Konflikt | Neu anlegen |
| `export_lauf` | ❌ Nein | — | Kein Konflikt | Neu anlegen |
| `bh_einstellungen` | ❌ Nein | — | Kein Konflikt | Neu anlegen |

**Entscheidung (bereits in VORSCHAU umgesetzt):** Buchhaltungs-Audit heißt `bh_audit_log` statt `audit_log`. Der bestehende `audit_log` bleibt für Admin-Console unverändert.

### Bestehende Storage-Buckets

| Bucket | Verwendung | Typ |
|---|---|---|
| `intake-photos` | Wareneingang-Fotos | Public URLs |
| `attachments` | Auftrags-Anhänge | Public URLs |
| `customer-images` | Kundenfotos | Public URLs |

Kein Bucket für Buchhaltungsbelege vorhanden → muss neu angelegt werden.

### Bestehende RLS-Patterns

- Bestehende Tabellen nutzen permissive `FOR ALL USING (true) WITH CHECK (true)` auf `authenticated`
- Rollenlogik existiert in `app_users.role` (Werte: `developer`, `admin`, `meister`, `office`, `workshop`, `readonly`)
- Noch kein Rollen-Mapping auf Buchhaltungsrollen (`EMPLOYEE`, `ACCOUNTING`, `OWNER`, `READ_ONLY_AUDIT`)

### Drizzle-Schema

- `src/db/schema.ts` enthält **kein** Buchhaltungs-Schema (Drizzle-Definitionen für `beleg`, `kategorie` etc. fehlen)
- Muss als nächster Schritt hinzugefügt werden (`src/db/buchhaltung-schema.ts` oder in `schema.ts` ergänzen)

---

## 4. Datenmodell-Abgleich

### Vorschau vs. Spec (15_BUCHHALTUNG_DATENMODELL.md)

| Tabelle | Pflichtfelder | GoBD-relevant | RLS nötig | Index nötig | Status |
|---|---|---|---|---|---|
| `beleg` | ✅ 23 Felder | ✅ | ✅ | ✅ 4 Indizes | ✅ Vollständig |
| `beleg_position` | ✅ 7 Felder | ✅ | ✅ | — | ✅ Vollständig |
| `kraftstoff_detail` | ✅ 6 Felder | — | ✅ | — | ✅ Vollständig |
| `ausgangsrechnung` | ✅ 11 Felder | ✅ | ✅ | — | ✅ Vollständig |
| `zahlung` | ✅ 8 Felder | ✅ | ✅ | — | ✅ Vollständig |
| `kategorie` | ✅ 7 Felder | — | ✅ | — | ✅ Vollständig |
| `lieferant` | ✅ 6 Felder + trgm-Index | — | ✅ | ✅ trgm | ✅ Vollständig |
| `steuerprofil` | ✅ 11 Felder | — | ✅ | — | ✅ Vollständig |
| `ustva_periode` | ✅ 12 Felder | ✅ | ✅ | — | ✅ Vollständig |
| `export_lauf` | ✅ 7 Felder | ✅ | ✅ | — | ✅ Vollständig |
| `bh_audit_log` | ✅ 7 Felder | ✅✅ | ✅ | — | ✅ Vollständig |
| `bh_einstellungen` | ✅ 6 Felder | — | ✅ | — | ✅ Vollständig |

### Detailprüfung Pflichtfelder

#### `beleg` — ✅ vollständig

- ID ✅, erfasst_am ✅, belegdatum ✅, lieferant_id/lieferant_text ✅
- brutto/netto/ust_satz/ust_betrag ✅, vorsteuer_abzug ✅
- kategorie_id ✅, skr_konto ✅, absetzbar_prozent/grund ✅
- belegart ✅, original_datei ✅ NOT NULL, original_format ✅
- ocr_confidence ✅, status ✅ DEFAULT 'pruefen'
- storniert_von ✅ self-ref, bank_zahlung_id ✅ FK→zahlung
- erstellt_von ✅ NOT NULL

#### `bh_audit_log` — ✅ vollständig, append-only

- ID ✅, zeit ✅ DEFAULT NOW, benutzer ✅ NOT NULL
- entitaet ✅, entitaet_id ✅, aktion ✅
- vorher/nachher ✅ JSONB
- Trigger: UPDATE + DELETE blocked ✅

#### `export_lauf` — ✅ vollständig

- ID ✅, typ ✅, zeitraum_von/bis ✅, datei_pfad ✅
- anzahl_buchungen ✅, erstellt_von ✅, erstellt_am ✅

#### `ustva_periode` — ✅ vollständig

- zeitraum_von/bis ✅, umsatz_19/7 ✅, ust_19/7 ✅
- umsatz_0 ✅, vorsteuer ✅, zahllast ✅
- status ✅ DEFAULT 'entwurf', freigegeben_am/von ✅

---

## 5. GoBD-Prüfung

### Trigger in VORSCHAU

| Trigger | Funktion | Tabelle | Zweck | Status |
|---|---|---|---|---|
| `trg_beleg_gobd` | `prevent_beleg_mutation()` | `beleg` | Blockiert UPDATE auf festgeschriebene/stornierte Belege | ✅ Korrekt |
| `trg_audit_no_update` | `prevent_audit_mutation()` | `bh_audit_log` | Blockiert UPDATE | ✅ Korrekt |
| `trg_audit_no_delete` | `prevent_audit_mutation()` | `bh_audit_log` | Blockiert DELETE | ✅ Korrekt |

### GoBD-Pflichtregeln

| Regel | Implementiert? | Wie |
|---|---|---|
| Keine harte Löschung von Finanzdaten | ✅ | Kein DELETE auf `beleg`, Trigger blockiert |
| Keine stillen Updates auf festgeschriebene Belege | ✅ | `trg_beleg_gobd` blockiert |
| Korrektur nur per Storno/Gegenbeleg | ✅ | `storniert_von` FK in `beleg` |
| Audit-Log append-only | ✅ | UPDATE/DELETE via Trigger blockiert |
| Originaldatei nicht überschreibbar | ⚠️ | Muss über Storage-Policy erzwungen werden (kein DB-Trigger) |
| Exportläufe protokolliert | ✅ | `export_lauf` Tabelle |
| Festgeschriebene Belege nicht unprotokolliert änderbar | ✅ | Trigger + Audit-Log |

### Fehlende Trigger/Ergänzungen

| Ergänzung | Priorität | Empfehlung |
|---|---|---|
| `log_beleg_changes()` — automatischer Audit-Eintrag bei INSERT/UPDATE auf `beleg` | Mittel | Nachrüsten in F-BH-09 |
| `prevent_beleg_delete()` — DELETE auf `beleg` blockieren | **Hoch** | Nachrüsten! Aktuell fehlt |
| `prevent_original_datei_change()` — UPDATE auf `original_datei` blockieren | Mittel | Nachrüsten oder via Storage-Policy |

> **⚠️ LÜCKE:** `beleg` hat keinen DELETE-Trigger. Ein DELETE wäre ohne Audit-Spur möglich. Muss in der finalen Migration ergänzt werden.

---

## 6. RLS-Rollenplan

### Rollen-Mapping (Spec → App)

| Spec-Rolle | `app_users.role` | Beschreibung |
|---|---|---|
| `EMPLOYEE` | `workshop` | Nur eigener Upload-Korb, keine Beträge |
| `ACCOUNTING` | `office` | Belege prüfen, exportieren |
| `OWNER` | `admin`, `developer` | Volle Rechte |
| `READ_ONLY_AUDIT` | `readonly` | Nur lesen nach Freigabe |

### Policy-Plan

| Rolle | Lesen | Schreiben | Freigeben | Export | Einstellungen | Beträge sichtbar? |
|---|---|---|---|---|---|---|
| EMPLOYEE | eigene Uploads | eigene Entwürfe | ❌ | ❌ | ❌ | ❌ |
| ACCOUNTING | alle Belege | Belege prüfen/korrigieren | ✅ | ✅ vorbereiten | ❌ | ✅ |
| OWNER | alles | alles | ✅ | ✅ | ✅ | ✅ |
| READ_ONLY_AUDIT | freigegebene Belege | ❌ | ❌ | ❌ | ❌ | ✅ |

### VORSCHAU-Status

Aktuell: **Prototyping-Policies** (`FOR ALL TO authenticated USING (true)`).
Für Livegang müssen rollenbasierte Policies implementiert werden.

### ⚠️ Offene Frage: Rollenübernahme

Die bestehende `app_users.role`-Spalte nutzt Werte (`workshop`, `office`, `admin`, `developer`, `meister`, `readonly`), die sich auf die Buchhaltungsrollen mappen lassen. **Aber:**

- Keine `meister`-Rolle in der Buchhaltungs-Spec definiert → soll `meister` = `EMPLOYEE`?
- Soll es eine eigene `bh_rolle`-Spalte geben oder reicht das Mapping über `app_users.role`?

**Empfehlung:** Mapping über bestehende Rolle, kein neues Rollenfeld. `meister` → `EMPLOYEE`.

---

## 7. Storage-Bucket-Plan

### Neuer Bucket: `buchhaltung-belege`

| Eigenschaft | Wert |
|---|---|
| Name | `buchhaltung-belege` |
| Sichtbarkeit | **privat** |
| Öffentliche URLs | **Nein** — nur signierte URLs |
| Max. Dateigröße | 20 MB |

### Pfadstruktur

```
{year}/{month}/{beleg_id}/{original_filename}
```

Beispiel: `2026/05/bel-001/aral-tankbeleg.jpg`

Kein Tenant-Modell aktiv (Single-Tenant), daher kein `tenant_id/` Prefix nötig.

### Storage-Policies

| Policy | Beschreibung |
|---|---|
| `buchhaltung_upload` | INSERT für `authenticated` Nutzer |
| `buchhaltung_read` | SELECT für `authenticated` Nutzer (Rollen prüfen über `app_users.role`) |
| `buchhaltung_no_overwrite` | Kein UPDATE auf bestehende Dateien |
| `buchhaltung_no_delete` | Kein DELETE (GoBD-konform) |

### Bestehende Patterns (Referenz)

- `intake-photos`, `attachments`, `customer-images` nutzen alle `getPublicUrl()` — **nicht geeignet** für Buchhaltungsbelege
- Buchhaltungsbelege müssen `createSignedUrl()` mit Ablauf nutzen

---

## 8. Finale Migrationsvorschau

Die bestehende `docs/VORSCHAU_migration_buchhaltung.sql` ist im Kern **vollständig und korrekt**. Folgende Ergänzungen sind nötig:

### Ergänzungen für finale Migration

1. **DELETE-Trigger auf `beleg`** — fehlt aktuell, muss ergänzt werden
2. **Automatischer Audit-Eintrag** bei INSERT/UPDATE auf `beleg` (optional aber empfohlen)
3. **`netto`/`ust_betrag` in `ausgangsrechnung`** — Spec hat sie, VORSCHAU hat sie ✅
4. **Kunde-Referenz** — `ausgangsrechnung.kunde_id` ist `TEXT` (passt zu `customers.id` als CUID) ✅

### Ergänzte Trigger (für finale Version)

```sql
-- Beleg DELETE verhindern
CREATE OR REPLACE FUNCTION prevent_beleg_delete() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'GoBD: Belege dürfen nicht gelöscht werden. Nur Storno ist erlaubt.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_beleg_no_delete ON beleg;
CREATE TRIGGER trg_beleg_no_delete
  BEFORE DELETE ON beleg
  FOR EACH ROW
  EXECUTE FUNCTION prevent_beleg_delete();
```

---

## 9. Verifikations-SQL (für F-BH-09)

```sql
-- Tabellen-Existenz
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'beleg', 'beleg_position', 'kraftstoff_detail',
    'ausgangsrechnung', 'zahlung', 'kategorie', 'lieferant',
    'steuerprofil', 'ustva_periode', 'export_lauf',
    'bh_audit_log', 'bh_einstellungen'
  )
ORDER BY table_name;

-- Spaltenprüfung
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('beleg', 'bh_audit_log', 'export_lauf', 'ustva_periode')
ORDER BY table_name, ordinal_position;

-- Trigger
SELECT event_object_table, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('beleg', 'bh_audit_log')
ORDER BY event_object_table, trigger_name;

-- RLS-Policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'beleg', 'beleg_position', 'kraftstoff_detail',
    'ausgangsrechnung', 'zahlung', 'kategorie', 'lieferant',
    'steuerprofil', 'ustva_periode', 'export_lauf',
    'bh_audit_log', 'bh_einstellungen'
  )
ORDER BY tablename, policyname;

-- PostgREST Reload
SELECT pg_notify('pgrst', 'reload schema');
```

---

## 10. STOPP-Punkte / Offene Fragen

### ⚠️ Klärungsbedarf (vor F-BH-09)

1. **DELETE-Trigger auf `beleg` fehlt** — Muss ergänzt werden. GoBD-kritisch.
2. **Rollen-Mapping `meister`** — Soll `meister` = `EMPLOYEE` (= nur eigene Uploads, keine Beträge)? Bestätigung nötig.
3. **Drizzle-Schema fehlt** — `src/db/schema.ts` hat keine Buchhaltungs-Tabellen. Muss entweder dort oder in separater Datei ergänzt werden.
4. **Storage-Bucket** — Muss manuell im Supabase Dashboard oder per CLI angelegt werden. Kein SQL-Befehl dafür.
5. **Prototyping-RLS** — Die Vorschau nutzt `FOR ALL TO authenticated USING (true)`. Für Go-Live müssen rollenbasierte Policies implementiert werden. Soll das in F-BH-09 direkt oder als separater Schritt passieren?
6. **`bh_audit_log` vs. Spec** — Die Spec nennt die Tabelle `audit_log`, die VORSCHAU nutzt `bh_audit_log` um Namenskollision zu vermeiden. Das TS-Interface referenziert noch `audit_log` in den Types. Soll das Mapping im Provider oder via View gemacht werden?

### ✅ Keine STOPP-Bedingung ausgelöst

- Keine bestehenden Finanzdaten betroffen
- Kein DROP TABLE
- Kein Spalten entfernen
- Git sauber
- Keine destruktive Änderung

---

## 11. Build-/Teststatus

- Build: ✅ grün (letzter Build `2596f3d`)
- Tests: ✅ 11/11 grün
- Keine Codeänderung in F-BH-08, kein neuer Build nötig

## 12. Commit-Hash

Commit nur für dieses Review-Dokument: **wird nach Freigabe erstellt**, nicht automatisch.

---

## 13. Empfehlung

### ✅ F-BH-09 kann vorbereitet werden

**Voraussetzung:**
1. Klärung Rollen-Mapping `meister` → `EMPLOYEE` ✅/❌
2. DELETE-Trigger auf `beleg` in finale Migration einbauen
3. Drizzle-Schema für Buchhaltungstabellen ergänzen
4. Storage-Bucket `buchhaltung-belege` (privat) im Dashboard anlegen
5. Entscheidung: Prototyping-RLS zuerst, rollenbasiert später?

**Reihenfolge F-BH-09:**
1. Finale Migration erstellen (mit DELETE-Trigger, idempotent)
2. `supabase db push` (oder SQL im Dashboard)
3. Verifikations-SQL ausführen
4. Storage-Bucket anlegen
5. Drizzle-Schema ergänzen
6. `SupabaseBuchhaltungProvider` implementieren
7. Feature-Flag für Provider-Umschaltung
