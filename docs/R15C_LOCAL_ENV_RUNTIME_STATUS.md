# R15C Local Env Runtime Status

## Ist-Zustand:
- Branch: feature/right-nav-focus
- HEAD: b7f52b35d1aab3845d3ef048b42648e1e136750a
- Ursprung: R15C1 wurde im Clean-Clone 02_app_r14c_s1_clean erstellt und wird in R15G in den Integrationsbranch übernommen.
- R15C1-Änderungen: .gitignore, .env.local.example, docs/R15C_LOCAL_ENV_RUNTIME_STATUS.md
- keine .env-Dateien vorhanden
- localhost läuft laut package.json auf Port 3001
- sichtbare Symptome:
  - Demo-/Offline-Modus aktiv
  - Admin Console DATABASE_URL missing
  - E-Mail-Login zeigt generischen Catch-Fallback statt Credential-Meldung, weil lokale Runtime/Auth nicht sauber prüfbar ist

## Ursache:
- fehlende lokale Runtime-Env
- nicht R15A/R15B-Code als primäre Ursache
- R15A/R15B bleiben nicht zurückzurollen

## Benötigte Keys als Vertrag, ohne Werte:
- DATABASE_URL
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

## Datei-/Code-Referenzen:
- src/db/index.ts → DATABASE_URL
- src/lib/supabase/client.ts → NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
- src/lib/supabase/server.ts → NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
- src/app/actions/admin.actions.ts → SUPABASE_SERVICE_ROLE_KEY
- src/app/actions/systemStats.ts → Supabase-Erreichbarkeit
- src/components/layout/KreileAppShell.tsx → Demo-/Offline-Banner

## Nächste Phase R15C-2:
- .env.local lokal erstellen
- echte Werte nur lokal eintragen
- .env.local darf nicht committed werden
- danach Runtime prüfen

## Nicht-Ziele:
- keine Codeänderung
- keine DB-Reparatur
- kein Deploy
- kein DOM-Smoke
- kein Periodenabschluss
