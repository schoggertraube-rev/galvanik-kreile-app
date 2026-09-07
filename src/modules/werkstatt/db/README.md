# werkstatt/db — ehrlicher Vertrag

Dieses Modul besitzt **keine** Tabellen, Migrationen oder `v_*`-Views (`ownsTables`,
`migrations` und `viewsFunctions` in `werkstatt.manifest.json` sind bewusst leer).

Alle Auftragsdaten kommen unverändert von den bestehenden, tenant-/rollenrichtigen
Reads `getWareneingangOrdersAction` / `getGalvanikOrdersAction`
(`src/app/warendurchlauf/actions.ts`, dahinter `src/lib/server/orderStationRead.ts`).
`werkstatt` selbst führt nur reine Ableitung auf den bereits gelesenen, echten
Datensätzen aus (Sortierung nach Risiko/Fälligkeit, Bündel-Erkennung nach
`surfaceRequested`, Zählungen) — siehe `server/deriveWerkstattView.ts`. Keine eigene
Persistenz, keine erfundene Eigentümerschaft an fremden Tabellen.
