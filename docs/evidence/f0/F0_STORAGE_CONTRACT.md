# F0_STORAGE_CONTRACT â€” Buckets, Zwecke, Policies, HÃ¤rtung

**Stand:** 2026-08-06 (Supabase Production read-only)

| Bucket | public | Size-Limit | MIME-Allowlist | Fachzweck | HÃ¤rtung |
|---|---|---:|---|---|---|
| `belege` | false | 5 MiB | png/jpeg/pdf | Beleg-Intake (Client) | OK; Anzeige serverseitig signiert |
| `buchhaltung-belege` | false | **kein** | **kein** | Buchhaltungs-Beleg (Server) | **LÃ¼cke:** Size/MIME setzen (F0-06) |
| `item-photos` | false | **kein** | **kein** | Teilefotos | **LÃ¼cke:** Size/MIME setzen; Signed-URL 5 min (B4 ok) |
| `scans` | false | 20 MiB | pdf/heic/heif/jpeg/png/webp | OCR-Scan (Server) | OK; interner Pfad statt Public-URL (B4) |

## Uploadgrenzen (Code)
- Server-Routen `scan-upload`/`item-photo-upload`: `checkAppAuthorization('write')`, Tenant aus Session,
  Pfad aus Tenant+UUID, MIME-Allowlist, private Buckets, Signed-URL statt Public (B4, PR #46, integriert).
  Negativtests (anon â†’ 401, kein Storage-Zugriff) grÃ¼n.
- Server-Action `buchhaltung/actions.ts`: Upload + Anzeige Ã¼ber `buchhaltung-belege` mit `createSignedUrl` (1h).
- Client `buchhaltung/belege/neu/page.tsx`: **Direktupload** in privaten `belege`-Bucket Ã¼ber kanonischen
  Browserclient â†’ F0-06/07 Bewertung (Server-Route vs. Direktupload). Kein Public-URL-Leck.

## Offen fÃ¼r F0-06 PASS
- Size-/MIME-Limits fÃ¼r `buchhaltung-belege` und `item-photos`.
- VollstÃ¤ndige Negativtest-Matrix: fremder Tenant, manipulierter Pfad, falscher MIME, GrÃ¶ÃŸe,
  abgelaufene Signed URL, unautorisierte LÃ¶schung.
- Storage-Policies (RLS auf `storage.objects`) je Bucket dokumentieren und testen.
- UnverÃ¤nderlichkeit der Originale vor OCR/Zuweisung.