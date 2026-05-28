<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:supabase-agent-rules -->
# Supabase RLS & Error Handling

1. **Tabellen nie ohne RLS-Policy anlegen**: Jede neue Tabelle via SQL MUSS im selben Migration-Skript RLS-Policies bekommen (z.B. `FOR ALL TO public USING (true)` für Prototyping), sonst blockiert Supabase jeden Insert/Select stumm.
2. **Immer detailliertes Error-Logging**: Niemals nur `console.error(error)` verwenden, da Supabase Fehler im Browser als leere Objekte `{}` angezeigt werden können. IMMER `error.message`, `error.details` und `error.hint` mit loggen.
3. **Kein stummes Scheitern**: Bei Supabase-Operationen darauf achten, dass fehlgeschlagene DB-Aufrufe (z.B. RLS Violations) nicht einfach stumm in der Konsole verpuffen.
<!-- END:supabase-agent-rules -->
