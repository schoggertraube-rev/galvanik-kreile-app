# Änderungen B1 / P0 – Bauquellen und Navigation

Stand: 25.10.2026
Branch: `kreile/b1-shell`
Draft-PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/152>

## 1. Preview-URL und exakter SHA

- Preview: <https://galvanik-kreile-werkstatt-kcrkqavkz.vercel.app>
- Stabiler Branch-Alias: <https://galvanik-kreile-werksta-git-febda9-schoggertraube-revs-projects.vercel.app>
- Schutz: Vercel-SSO; kein öffentlicher Zugriff.
- Exakter Produktkandidat: `4ba0be5b54d9e8752f77d7c60a88784558d4323e`
- Vercel-Deployment: `dpl_4RBmcugq6Afb2uUV8ksmS6dSkXCf`, Ziel `preview`, Status `Ready`.
- Ein nachfolgender Übergabe-Commit ändert nur die Abgabedokumentation, nicht den Produktkandidaten.

## 2. Testzugänge je Rolle

| Rolle | Soll-Zugang | Status |
| --- | --- | --- |
| Meister | Rolf, PIN-Anmeldung | **Nicht erstellt – BLOCKED_EXTERNAL_PERMISSION.** |
| Werkstatt | Phillip, PIN-Anmeldung | **Nicht erstellt – BLOCKED_EXTERNAL_PERMISSION.** |
| Admin | Gregor, E-Mail-Anmeldung | **Nicht erstellt – BLOCKED_EXTERNAL_PERMISSION.** |

Vor der verlangten Datenänderung wurde die Vercel-Umgebung geprüft. Für `NEXT_PUBLIC_SUPABASE_URL`, `DATABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` existiert jeweils nur ein gemeinsamer Vercel-Eintrag mit den Zielen `preview` und `production`; eine Branch-Ausnahme existiert nicht. Eine getrennte Supabase-Preview-Projekt-Ref ist damit nicht nachgewiesen. Nach Regel 10 des Bauauftrags wurden keine Nutzer, PINs, Passwörter oder sonstigen Daten angelegt oder verändert.

## 3. Neu gemacht

| Was | Datei/Route | Sichtbar wo |
| --- | --- | --- |
| Owner-Bauumfang als aktive HTML-Bauquelle abgelegt; gelieferter Klartext ist im Tab „Bauumfang“ zeichengetreu enthalten | `docs/delivery/KREILE_BAUUMFANG_STUFEN.html` | Projektabgabe |
| Verbindlichen Bauauftrag Stufe 1 zeichengetreu abgelegt | `docs/delivery/KREILE_CODEX_BAUAUFTRAG_STUFE1.md` | Projektabgabe |
| V8-Label auf „Kunden & Kontakt“ zurückgestellt | `src/components/layout/MockAppFrame.tsx`, `/customers` | Rolf-V8-Desktop-Navigation |
| „Zahlen“ als geplanten, nicht klickbaren Anschluss ergänzt | `src/components/layout/MockAppFrame.tsx` | Bereiche |
| „Kalender“ und „Material & Einkauf“ als geplante, nicht klickbare Anschlüsse ergänzt | `src/components/layout/MockAppFrame.tsx` | Weiteres |
| P0-Navigation und Nicht-Klickbarkeit automatisiert geprüft | `src/components/layout/__tests__/p0SalesStageNavigation.realRender.test.tsx` | Unit-Suite |

## 4. Weicht von Vorlage oder Bauumfang ab

- Die angelieferte Datei für den Bauumfang war Klartext und kein HTML-Dokument. Sie wurde ohne inhaltliche Ergänzungen in eine gültige HTML-Hülle mit dem Tab „Bauumfang“ gelegt; der eingebettete Text ist nach Zeilenumbruch-Normalisierung identisch.
- Die drei Testnutzer fehlen, weil keine von Production getrennte Preview-Datenbank nachgewiesen ist. Regel 10 verlangt an dieser Stelle den Stopp vor jeder Datenmutation.
- Rollen-Login und Rollen-Screenshots fehlen deshalb. Aus vorhandenen oder erfundenen Zugängen wurde kein Erfolgsnachweis konstruiert.
- Die alten Authority- und Paket-Scope-Checker kennen die beiden ownerautorisierten Bauquellen nicht. P0 verbietet Änderungen an `scripts/quality/**`, `quality/**`, `AGENTS.md`, Mission und Workflows; deshalb bleiben diese Checks ehrlich rot.

## 5. Nicht geschafft und warum

- Drei Testnutzer anlegen: gesperrt, weil Preview und Production dieselben Supabase-Umgebungseinträge verwenden und keine getrennte Preview-Projekt-Ref belegt ist.
- Preview-Login je Rolle und Screenshots je Rolle: ohne zulässige Testnutzer nicht ausführbar.
- Vollständig grüne CI: Authority-/Module-Gate, Paket-Scope und Ratchet bilden noch die vorherige Lieferquelle ab; eine Governance-Anpassung ist in P0 ausdrücklich untersagt.
- Paket-E2E mit echten Rollen-Logins: wegen derselben fehlenden Testdatenbank-Trennung nicht ausführbar.

## 6. CI-Status am SHA

SHA: `4ba0be5b54d9e8752f77d7c60a88784558d4323e`

| Prüfung | Status | Einordnung |
| --- | --- | --- |
| Vercel | `SUCCESS` | Preview real gebaut und `Ready`; kein Production-Deployment. |
| Agentur-Gate, beide Läufe | `FAILURE` | 121 Unit-Dateien: 119 grün, 2 rot; 1000 Tests grün, 2 rot. Beide roten Tests melden ausschließlich die zwei neuen `ACTIVE_DELIVERY_SURFACE`-Dateien. Der neue P0-Test ist grün. |
| GitHub Quality | `FAILURE` | Authority-Schritt meldet ausschließlich die zwei neuen `ACTIVE_DELIVERY_SURFACE`-Dateien. |
| ESLint Ratchet | `FAILURE` | Geschützter Altvertrag: „ratchet implementation or invocation drifted; a protected judge-contract migration is required“. |
| Fresh Supabase replay | `FAILURE` | Die lokale Replay-Storage-API lieferte in der BF-007-Matrix 12-mal HTTP 502; kein Produkt- oder Preview-Erfolgsclaim. |

Lokal am Produktkandidaten:

- P0-Navigationstest: `PASS`
- TypeScript `npx tsc --noEmit --incremental false`: `PASS`
- Voll-Lint `npm run lint:full`: `PASS`
- Produktions-Build `npm run build`: `PASS`
- `quality:no-fake-production`: `PASS`
- Delivery-Vertrag: `PASS`
- Authority-Gate und Module-Gate: `FAIL` ausschließlich für die zwei neuen Delivery-Dateien
- Paket-Scope: `FAIL` ausschließlich für die zwei neuen Delivery-Dateien
- Vollständige lokale Unit-Suite: zweimal nach zehn Minuten ohne Endstatus vom Werkzeug beendet; der Remote-Lauf am exakten SHA ist vollständig und oben ausgewiesen.

## Prüfung und Freigabe

- Unabhängiger Exact-SHA-Review durch Claude: noch offen; Codex akzeptiert den eigenen Stand nicht selbst.
- Merge nach `main`, Production, Kosten und Datenmutation: nicht freigegeben und nicht ausgeführt.
- P1 wurde nicht begonnen.
