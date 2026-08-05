# Produktentscheidung: Tenant-Isolation-Mechanismus

Stand: 2026-08-04 | Korrektur: 2026-08-05

## Architektur-Befund (2026-08-05)

Die App verbindet via Drizzle ORM direkt mit PostgreSQL als `postgres`-Rolle
(Superuser). Diese Rolle umgeht **alle RLS-Policies**. Die bisherige Planung
(JWT Custom Claims + RLS-Policies) ist fuer diese Architektur **wirkungslos**.

Zusaetzlich nutzt die App **kein Supabase Auth** fuer den Login — der
Login erfolgt via 4-stelliger PIN mit eigener Session-Verwaltung (Cookie).
Es gibt keinen Supabase-JWT, in den ein Custom Claim injiziert werden koennte.

### Konsequenz

| Ansatz | Funktioniert? | Grund |
|---|---|---|
| JWT Custom Claims + RLS | Nein | Kein Supabase Auth JWT vorhanden; `postgres`-Rolle umgeht RLS |
| `set_config('app.tenant_id')` + RLS | Nein | `postgres`-Rolle umgeht RLS |
| Separate DB-Rolle + RLS | Moeglich, aber aufwaendig | Erfordert Umbau der DB-Verbindung + neuen PostgreSQL-User |
| Application-Layer-Filter | Ja (aktueller Zustand) | Drizzle-Queries filtern nach `tenant_id` im App-Code |

## Revidierte Entscheidung

**Application-Layer Tenant-Filter** fuer Phase 1 (Single-Tenant Galvanik Kreile).

Begruendung:
- Galvanik Kreile ist ein **Einzel-Tenant-System** — es gibt nur den Tenant `galvanik-kreile`
- Die App laeuft auf Vercel als Server-Side-Rendered Next.js — es gibt keinen Client-seitigen
  Supabase-Zugriff, der abgesichert werden muesste
- Alle DB-Zugriffe laufen ueber Server Actions mit service_role — die Trust-Boundary ist der App-Code
- RLS wuerde nur schuetzen, wenn ein nicht vertrauenswuerdiger Client direkt auf die DB zugreift — das passiert hier nicht

### Massnahmen Phase 1 (Single-Tenant, Live-faehig)

1. **Kein RLS-Umbau** — spart Komplexitaet, keine falsche Sicherheit
2. **Bestehende `tenant_id`-Filterung** im App-Code beibehalten und auditieren
3. **Supabase Dashboard-Zugang** auf den Betreiber beschraenken (bereits der Fall)
4. **`DATABASE_URL`** als Vercel Environment Variable geschuetzt (bereits der Fall)

### Upgrade-Pfad Phase 2 (Multi-Tenant, spaeter)

Wenn Multi-Tenant benoetigt wird:
1. Separate PostgreSQL-Rolle `app_user` erstellen (kein Superuser)
2. `DATABASE_URL` auf diese Rolle umstellen
3. RLS-Policies mit `current_setting('app.tenant_id')` aktivieren
4. Drizzle-Middleware: `SET LOCAL app.tenant_id = ...` pro Request

## Status

- M5 (RLS-CONTRACT-001) wird **zurueckgestellt** — kein Nutzen bei aktueller Architektur
- Bestehende RLS-Policies auf Production sind No-Ops (richtig erkannt in CURRENT_STATE)
- Die P0-RLS-Migrationen aus PR #35 sind gemergt aber haben **keine reale Schutzwirkung**
  (postgres-Rolle umgeht sie). Sie schaden nicht, schuetzen aber nicht.
- Fokus verschiebt sich auf **operativen End-to-End-Kern** fuer Live-Faehigkeit
