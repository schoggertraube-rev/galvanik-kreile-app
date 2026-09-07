# werkstatt/api — ehrlicher Vertrag

Dieses Modul besitzt **keinen** eigenen Route-Handler. Der einzige Einstiegspunkt ist
die Kompositionswurzel `src/app/warendurchlauf/page.tsx`: sie prüft Autorisierung,
liest atomar über die bestehenden, tenant-/rollenrichtigen Server-Actions
`getWareneingangOrdersAction` / `getGalvanikOrdersAction`
(`src/app/warendurchlauf/actions.ts`) und reicht die echten Ergebnisse als Props an
`@/modules/werkstatt/public`.

Kein neuer API-Endpunkt wurde erfunden. Sollte dieses Modul künftig einen eigenen
Route-Handler benötigen, gehört er hierher und in `werkstatt.manifest.json`.
