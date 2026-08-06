# F0_STORAGE_CONTRACT — Buckets, Zwecke, Policies, Härtung

**Stand:** 2026-08-06 (Supabase Production read-only)

| Bucket | public | Size-Limit | MIME-Allowlist | Fachzweck | Härtung |
|---|---|---:|---|---|---|
| `belege` | false | 5 MiB | png/jpeg/pdf | Beleg-Intake (Client) | OK; Anzeige serverseitig signiert |
| `buchhaltung-belege` | false | **kein** | **kein** | Buchhaltungs-Beleg (Server) | **Lücke:** Size/MIME setzen (F0-06) |
| `item-photos` | false | **kein** | **kein** | Teilefotos | **Lücke:** Size/MIME setzen; Signed-URL 5 min (B4 ok) |
| `scans` | false | 20 MiB | pdf/heic/heif/jpeg/png/webp | OCR-Scan (Server) | OK; interner Pfad statt Public-URL (B4) |

## Uploadgrenzen (Code)
- Server-Routen `scan-upload`/`item-photo-upload`: `checkAppAuthorization('write')`, Tenant aus Session,
  Pfad aus Tenant+UUID, MIME-Allowlist, private Buckets, Signed-URL statt Public (B4, PR #46, integriert).
  Negativtests (anon → 401, kein Storage-Zugriff) grün.
- Server-Action `buchhaltung/actions.ts`: Upload + Anzeige über `buchhaltung-belege` mit `createSignedUrl` (1h).
- Client `buchhaltung/belege/neu/page.tsx`: **Direktupload** in privaten `belege`-Bucket über kanonischen
  Browserclient → F0-06/07 Bewertung (Server-Route vs. Direktupload). Kein Public-URL-Leck.

## Offen für F0-06 PASS
- Size-/MIME-Limits für `buchhaltung-belege` und `item-photos`.
- Vollständige Negativtest-Matrix: fremder Tenant, manipulierter Pfad, falscher MIME, Größe,
  abgelaufene Signed URL, unautorisierte Löschung.
- Storage-Policies (RLS auf `storage.objects`) je Bucket dokumentieren und testen.
- Unveränderlichkeit der Originale vor OCR/Zuweisung.
