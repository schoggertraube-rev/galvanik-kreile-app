# F-BH-09 — Supabase Verification SQL

Diese SQL-Befehle werden nach der erfolgreichen Migration auf Supabase zur Prüfung verwendet.

### 1. Tabellenprüfung

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'beleg',
    'beleg_position',
    'kraftstoff_detail',
    'ausgangsrechnung',
    'zahlung',
    'kategorie',
    'lieferant',
    'steuerprofil',
    'ustva_periode',
    'export_lauf',
    'bh_audit_log',
    'bh_einstellungen'
  )
order by table_name;
```

### 2. Spaltenprüfung

```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'beleg',
    'bh_audit_log',
    'export_lauf',
    'ustva_periode'
  )
order by table_name, ordinal_position;
```

### 3. Triggerprüfung

```sql
select event_object_table, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in ('beleg', 'bh_audit_log')
order by event_object_table, trigger_name;
```

### 4. Policyprüfung

```sql
select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'beleg',
    'beleg_position',
    'kraftstoff_detail',
    'ausgangsrechnung',
    'zahlung',
    'kategorie',
    'lieferant',
    'steuerprofil',
    'ustva_periode',
    'export_lauf',
    'bh_audit_log',
    'bh_einstellungen'
  )
order by tablename, policyname;
```

### 5. PostgREST Reload (Pflicht nach manuellen Bucket-Anlagen oder SQL-Änderungen über CLI)

```sql
select pg_notify('pgrst','reload schema');
```

---

### Manuelle Storage-Bucket Einrichtung (Dashboard)

1. Navigieren zu **Storage** im Supabase Dashboard.
2. Neuen Bucket erstellen: **`buchhaltung-belege`**
3. **Public-Access**: DEAKTIVIERT (Private).
4. Erwarteter Upload-Pfad: `{year}/{month}/{beleg_id}/{original_filename}`.
5. URLs müssen später serverseitig als Signed-URLs generiert werden.

### GoBD-Tests (manuell oder via E2E)

- `UPDATE` auf `bh_audit_log` muss fehlschlagen.
- `DELETE` auf `bh_audit_log` muss fehlschlagen.
- `DELETE` auf festgeschriebenen `beleg` muss fehlschlagen.
- `UPDATE` des Feldes `original_datei` auf festgeschriebenem `beleg` muss fehlschlagen.
- `INSERT` in `beleg` erzeugt automatisch einen Eintrag im `bh_audit_log`.
