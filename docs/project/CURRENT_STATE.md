# Current State

Stand: 2026-08-06 â€” verifizierter Ist-Stand gegen `origin/main`, Supabase Production und Vercel.

Diese Datei ersetzt den veralteten Stand vom 2026-08-05, der Data-API und PIN faelschlich als offen fuehrte. Ein gruener Build oder ein aktuelles Deployment ist kein Gesamt-PASS.

## Gesamturteil

| Ebene | Status | Verifizierter Stand |
|---|---|---|
| GitHub-Lieferquelle | `PASS` | `main` ist einzige Lieferwahrheit; Head `6e0c74893ed10e5337e03b10457477f4b6d8cbf7`. |
| Vercel Production | `PASS_CURRENT_MAIN` | Production laeuft auf aktuellem `main`. |
| Data-API-Sicherheit (Production) | `DONE_VERIFIED` | 2026-08-05 alle Tabellen-Grants fuer `anon`/`authenticated` entzogen; per SQL 0 verbleibende Grants verifiziert. |
| PIN-Bestand (Production) | `DONE_VERIFIED` | 6/6 App-User bcrypt cost 12; 0 Legacy-Klartext-PINs (per SQL verifiziert). |
| Storage-Buckets (Production) | `DONE_VERIFIED` | `belege` 2026-08-06 auf privat gesetzt (D1); `buchhaltung-belege`, `item-photos`, `scans` bereits privat. |
| Public-Funktions-Grants (Production) | `DONE_VERIFIED` | 2026-08-06 EXECUTE fuer 9 App-Funktionen von `PUBLIC`/`anon`/`authenticated` entzogen (D2); `service_role`/`postgres` behalten Zugriff. |
| Tenant-Datenbestand (Production) | `CLEARED` | 2026-08-06 auf ausdrueckliche Freigabe alle Geschaeftsdaten (orders, customers, items, events, scan_uploads + abhaengige Tabellen) geloescht; 6 `app_users` erhalten. |
| Migrationswahrheit auf `main` | `FAIL` | Mehrere Production-Aenderungen (Data-API-Revoke, Default-Privileges, PIN-bcrypt, D1, D2) wurden per `execute_sql` angewandt und liegen ausserhalb des Ledgers. Fresh-Replay bleibt unbewiesen. |
| Operativer E2E-Kern | `NOT_PROVEN` | Kunde -> Auftrag -> Behaelter/QR -> Teil -> Aktion -> Today -> Beleg -> Reload wurde nie durchgaengig ausgefuehrt oder durch einen automatisierten Test abgesichert. |
| Offline-Vertrag | `CONTAINED_ONLY` | Kein echter, verifizierter Sync-Transport. Datenverlust-Pfad in SyncContext ist stillgelegt (PR #42, offen). 48h-Nachweis fehlt. |
| Produkt-Go-live | `NO_GO` | E2E-Kern, Offline-Vertrag, RLS-Relationsmatrix, Fresh-Replay und Ledger-Konsolidierung sind nicht abgenommen. |

## Offene Fundament-Fixes (Branch + PR, CI gruen, ungemergt)

Auf ausdrueckliche Anweisung noch nicht gemergt. Sammelfreigabe steht aus.

| PR | Inhalt | CI | Status |
|---|---|---|---|
| `#42` | C1 â€” SyncContext: stiller Datenverlust gestoppt (kein Fake-Sync/Loeschen ohne Serveruebertragung). | gruen (5/5) | offen, Review PASS |
| `#43` | C2 â€” `inquiriesRepository` auf Server Action umgestellt; kein Fake-Success mehr. | gruen | offen, Review PASS |
| `#44` | C3+C4 â€” Today-Datenvertrag: `risk`/`dueLabel`/`dueValue` server-seitig aus echtem `dueDate`; Mock-Typen raus; keine Client-Priorisierung. | gruen (quality/Build) | offen, Review PASS |
| `#41` | Docs + Offline-Containment. | gruen | **nicht als-is mergen** â€” kuerzt geschuetzte Anforderungen; durch diese Doku-Korrektur ersetzt. |

## Angewandte Production-Aenderungen ausserhalb des Ledgers (APPLIED_NOT_IN_LEDGER)

Diese Aenderungen sind produktiv wirksam, aber nicht als Migration im Ledger abgebildet. Vor Go-live in eine ledgerfaehige, replaybare Form ueberfuehren.

- 2026-08-05: Data-API-Grant-Entzug auf allen Tabellen/Views fuer `anon`/`authenticated` (0 Grants verifiziert).
- 2026-08-05: Default-Privileges fail-closed fuer kuenftige `public`-Objekte von `postgres`.
- 2026-08-05: PIN-Bestandsmigration auf bcrypt cost 12 (6/6).
- 2026-08-06: D1 â€” Bucket `belege` auf privat.
- 2026-08-06: D2 â€” EXECUTE-Entzug fuer `fn_compute_warnings`, `fn_is_production_order`, `fn_update_vorlagen`, `fn_verteile_energiekosten`, `search_globalhÙ×Ø™[Y×Ú[œÙ\™]™[Ø™[Y×Ù[]X™]™[Ø™[Y×Û]]][Û˜™]™[Ø]Y]Û]]][Û˜‚‹HŒ‹LLˆÙ\ØÚ[™È[\ˆ[˜[QÙ\ØÚYYÙ][ˆ
]\ÙYXÚÛXÚHœ™ZYØX™JK‚‚ˆÈÈ›ØÚÙ™™[ˆÈšXÚ™Z]\]‚ŸQİ]\È™\İ\˜™Z]ŸKK_KK_KK_ŸÕTPTÑKPQRS‹QQUS’U‹LX“ĞÒÑQÑVT“SY˜][š]š[YÙ\È›Ûˆİ\X˜\ÙWØYZ[˜Y\ˆ[›Û˜Ø]][XØ]Y™\İZ[ˆÙZ]\È\ˆYX™\ˆ\Ú›Ø\™ÓİÛ™\ˆÙ\Ø˜\‹ˆŸQÑT‹PÓÓ”ÓÓQUSÓ‹LXPÕU‘XYH\ˆ^Xİ]WÜÜ[[™Ù]Ø[™[ˆY[™\[™Ù[ˆYÙ\™˜YZYÈ˜XÚšYZ[Èœ™\ÚT™\^H\œİ[[‹ˆŸ“ËPÓÓ•PÕLXPÕU‘X™[][Û™[œÜ^šYš\ØÚH›Û[‹KÕ[˜[SX]š^È[˜[Ú\ÛÛ][ÛˆÜ™ZY\˜Ú]ZİÛš\ØÚ›ØÚšXÚØ]X™\‹ˆ“È\İšXÚ8 '™[˜[[ˆ‹ˆŸÔTUU‘KTÓPÑKLX“ÕÔ“Õ‘S˜L‘KRÙ\›ÙYÈ\˜ÚØY[™ÚYÈ]\ÙYZ™[ˆ[™]]ÛX]\ÚY\XœÚXÚ\›‹ˆÒKQL‘HYYZİY[\ˆÙZH]]Q˜Y[KˆŸÑ‘“S‘KTÒSLXÈÑ‘“S‘KMLX“ĞÒÑQXÚ\ˆŞ[˜ËU˜[œÜÜİ]›ŞRY[\İ[‹ÛÛ™›ZİK™\İ\[™S˜XÚÙZ\È™Z[‹ˆŸÑPËTÕÔQÑKP‘SQÑKLX‘PQX™[YÙXP[™ZYÙKÑİÛ›ØY]YˆÙ\™\œÙZ]YÙHÚYÛ™YT“È[\İ[[ˆ
XÚÙ]\İ™]š]˜]
KˆŸÑPËTS‹L˜T•PS]šXÙKPš[™[™ËĞÚ[[™ÙH›ZX›ÙZİ[ØÚZY[™ÎÈXZÙYT\ÜİÛÜ™TØÚ]ˆ›ÜˆÛË[]™H[H\Ú›Ø\™Zİ]šY\™[‹ˆŸÖTÕSPUPËPUQULXÔS˜\ˆYH›ÛH™]šY]È™[˜[›[ˆ]ZY[ˆİ\™[ˆ™\šYš^šY\ÈÙZ]\™HÛY[Tİ\X˜\ÙKT˜YH[™™XÚ[™ÜËKÔ™ZÛ[X][ÛœËKÕ\ØYT˜YHÚ[™šXÚŞ\İ[X]\ØÚÙ\YYˆ‚ˆÈÈ˜YXÚİH™ZZ[™›ÛÙB‚ŒKˆY\ÙHÚİKRÛÜœ™Zİ\ˆYY™[ˆ\ÜÙ[È™ZH™Y\™ˆÛÜœšYÚY\™[‹‚Œ‹ˆØ[[Y[œ™ZYØX™HY\ˆˆÍ‹ÈÍËÈÍÈÍHØÚY\ÜÙ[ˆÙ\ˆ]YˆÚİKRÛÜœ™Zİ\ˆ™Y^šY\™[‹‚ŒËˆYÙ\‹RÛÛœÛÛYY\[™È
Èœ™\ÚT™\^K‚ˆ]]ÛX]\ÚY\\ˆL‘KRÙ\›ÙYËU\İÈ[˜XÚÙ™›[™KU™\˜YË‚‚ˆÈÈœ™ZYØX™YÜ™[™[‚‚“Ú™H]\ÙYXÚÛXÚHœ™ZYØX™H\™›ÛÙ[ˆÙZ]\š[ˆÙZ[ˆY\™ÙKÙZ[ˆ›ÙXİ[Û‹Q\ŞKÙZ[™HÙZ]\™H™[[İKSZYÜ˜][Û‹ÙZ[™H“ËKÔÛXŞKPY[™\[™È[™ÙZ[™HÙZ]\™H][›Ù\ØÚ[™Ëˆ\ˆ\KUÛÜšİ™YH™X]\™KØØ\\™KX]]][˜[Ú\™šXÚ[™Ù]\İ]‚