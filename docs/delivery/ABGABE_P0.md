# Abgabe P0 – B1-Korrektur

Status: `BLOCKED_EXTERNAL_PERMISSION` für Testnutzer und Rollen-Nachweis; Navigation umgesetzt
Stand: 25.10.2026

## 1. Preview und exakter SHA

- Branch: `kreile/b1-shell`
- Draft-PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/152>
- Produktkandidat: `4ba0be5b54d9e8752f77d7c60a88784558d4323e`
- Preview: <https://galvanik-kreile-werkstatt-kcrkqavkz.vercel.app>
- Branch-Alias: <https://galvanik-kreile-werksta-git-febda9-schoggertraube-revs-projects.vercel.app>
- Vercel-Deployment: `dpl_4RBmcugq6Afb2uUV8ksmS6dSkXCf`, `preview`, `Ready`

## 2. Zugänge je Rolle

| Person | Rolle | Zugang |
| --- | --- | --- |
| Rolf | `meister` | Nicht erstellt |
| Phillip | `werkstatt` | Nicht erstellt |
| Gregor | `admin` | Nicht erstellt |

Begründung: Die Vercel-Einträge für Supabase-URL, Datenbank-URL und Service-Role-Key gelten jeweils gemeinsam für `preview` und `production`; eine Branch-Ausnahme oder getrennte Preview-Projekt-Ref ist nicht vorhanden. Gemäß Regel 10 wurde vor jeder Datenmutation gestoppt.

## 3. Lieferumfang

| ID | Gebaut | Route | Datei | Test |
| --- | --- | --- | --- | --- |
| Bauquelle | ja | – | `docs/delivery/KREILE_BAUUMFANG_STUFEN.html` | zeichengetreuer Vergleich zum Owner-Anhang: PASS |
| Bauauftrag | ja | – | `docs/delivery/KREILE_CODEX_BAUAUFTRAG_STUFE1.md` | zeichengetreuer Vergleich zum Owner-Anhang: PASS |
| P0 Label | ja | `/customers` | `src/components/layout/MockAppFrame.tsx` | P0-Unit: PASS |
| P0 Bereiche | ja | Shell | `src/components/layout/MockAppFrame.tsx` | P0-Unit: PASS |
| P0 geplante Anschlüsse | ja | keine Zielroute | `src/components/layout/MockAppFrame.tsx` | disabled, `nav planned`, ohne `data-href`: PASS |
| P0 Testnutzer | nein | `/start` | keine Datenmutation | BLOCKED_EXTERNAL_PERMISSION |
| P0 Rollen-Login | nein | `/start` → Rollen-Home | – | mangels zulässiger Testnutzer nicht ausführbar |

## 4. Abweichungen

- Der Bauumfang wurde als Klartext geliefert. Die HTML-Datei enthält ihn ohne fachliche Änderung in einer minimalen HTML-Hülle mit Tab „Bauumfang“.
- Testnutzer, Rollen-Login und Rollen-Screenshots fehlen wegen der nicht getrennten Preview-Datenbank.
- Die alten Quality-/Authority-Regeln wurden nicht auf die neuen Bauquellen umgeschrieben, weil P0 Governance-Arbeit ausdrücklich verbietet.

## 5. Checks am Produkt-SHA

| Check | Ergebnis |
| --- | --- |
| `npx tsc --noEmit --incremental false` | PASS |
| `npm run lint:full` | PASS |
| `npm run build` | PASS |
| `npm run quality:no-fake-production` | PASS |
| P0-Navigationstest | PASS |
| `npm run quality:delivery-contracts` | PASS |
| `npm run quality:module-gates` | FAIL: ausschließlich die zwei neuen `ACTIVE_DELIVERY_SURFACE`-Dateien |
| `npm run quality:authority-gate` | FAIL: ausschließlich die zwei neuen `ACTIVE_DELIVERY_SURFACE`-Dateien |
| P0-Paket-Scope | FAIL: die zwei neuen Delivery-Dateien fehlen im alten B1-Scope |
| Remote Unit am exakten SHA | 121 Dateien: 119 PASS, 2 FAIL; 1002 Tests: 1000 PASS, 2 FAIL. Beide Fehler sind die alten Authority-/Module-Gate-Erwartungen; P0-Test PASS. |
| Fresh Supabase replay | FAIL: BF-007 erhielt für alle 12 Storage-HTTP-Fälle Status 502; keine P0-Datenmutation wurde ausgeführt. |
| Paket-E2E mit Rollen-Login | NICHT AUSGEFÜHRT: Testnutzer gesperrt |

## 6. Screenshots

| Größe | Status |
| --- | --- |
| 1914×917 je Rolle | Nicht erstellt: Rollen-Login ohne zulässige Testnutzer blockiert |
| 1220×880 je Rolle | Nicht erstellt: Rollen-Login ohne zulässige Testnutzer blockiert |
| 390×844 je Rolle | Nicht erstellt: Rollen-Login ohne zulässige Testnutzer blockiert |

## 7. Offener externer Blocker

Für die Fortsetzung von P0 braucht die Preview ein eigenes Supabase-Projekt oder mindestens eindeutig getrennte, nur für Preview/Branch geltende Werte für `NEXT_PUBLIC_SUPABASE_URL`, `DATABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY`. Erst nach belegter Trennung dürfen die drei Testnutzer angelegt und Rollen-Login sowie Screenshots nachgeholt werden.

P1 wurde nicht begonnen. Merge, Production, Kosten und Echtdaten blieben unberührt.
