# Änderungen B1 – Shell und Rollen-Home

Stand: 25.10.2026, 14:17 Uhr (Europe/Berlin)  
Draft-PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/152>

## 1. Preview-URL und exakter SHA

- Preview: <https://galvanik-kreile-werksta-git-febda9-schoggertraube-revs-projects.vercel.app>
- Schutz: Vercel-SSO; kein öffentlicher Zugriff.
- Exakter Produktkandidat: `317f2c92e2c25253c23662cc65724799fc347a55`
- Nachweis am Kandidaten: Vercel-Build `SUCCESS`; `/start` hinter Vercel-Schutz `200`; `/cockpit` `404`.
- Der spätere Übergabe-Commit ändert nur diese Datei und nicht den Produktkandidaten.

## 2. Testzugänge je Rolle

| Rolle | Einstieg | Zugang |
| --- | --- | --- |
| Meister/Büro | Rolf auf `/start`, PIN-Anmeldung | **In Klärung:** kein Test-PIN im Repository oder Owner-Auftrag vorhanden. |
| Werkstatt | Phillip auf `/start`, PIN-Anmeldung | **In Klärung:** kein Test-PIN im Repository oder Owner-Auftrag vorhanden. |
| Admin | Gregor auf `/start`, E-Mail-Anmeldung | **In Klärung:** keine Test-E-Mail mit Passwort im Repository oder Owner-Auftrag vorhanden. |

Es wurden keine Zugangsdaten erfunden, keine PINs aus synthetischen Tests als Produktzugang ausgegeben und keine Echtdaten verändert. Die Preview zeigt alle drei Zugänge als verfügbar; der vollständige Login konnte mangels Zugangsdaten nicht ausgeführt werden.

## 3. Neu gemacht

| Was | Datei/Route | Sichtbar wo |
| --- | --- | --- |
| Einzige aktive Lieferlinie auf Verkaufsstufe 1 umgestellt | `docs/delivery/KREILE_VERKAUFSSTUFE_1.md`, `AGENTS.md`, `missions/F1_ORDER_TO_CASH_PILOT_001.yml` | Projektsteuerung und CI-Gates |
| Rolf-V8-Desktop-Shell rollenabhängig gemacht | `src/components/layout/MockAppFrame.tsx` | Meister/Büro/Admin auf Desktop |
| Navigation auf die Stufe-1-Bezeichnungen reduziert | `/`, `/warendurchlauf`, `/orders`, `/customers`, `/buchhaltung/rechnungen`, `/settings` | Rolf-V8-Seitennavigation |
| Phillip-V4-Werkstatt-Rahmen ohne Rolf-Seitenleiste ausgeliefert | `src/components/layout/MockAppFrame.tsx` | Werkstatt auf Desktop; vorhandene Werkstatt-Aktionsleiste bleibt |
| Admin-Zugang im Shell-Menü und Mehr-Menü korrekt unterstützt | `src/components/layout/MockAppFrame.tsx`, `src/components/layout/MoreMenu.tsx` | Admin auf Desktop/Touch |
| Nicht-Stufe-1-Produktflächen zentral auf echten HTTP-404 begrenzt | `src/proxy.ts` | Direkte Alt-URLs, belegt mit `/cockpit` |
| Routengrenze automatisiert geprüft | `src/test/sales_stage_one_route_gate.test.ts` | Unit-Suite |
| Bestehenden Real-Browser-Smoke auf die Phillip-Shell ohne Hauptnavigation angepasst | `e2e/path1-v5-shell-smoke.real.spec.ts` | isolierter Browser-/Replay-Nachweis |
| Vorhandene echte Rollen-Homes beibehalten und regressionsgeprüft | `src/app/page.tsx`, `src/components/home/RolfHome.tsx`, `src/components/home/WerkstattHome.tsx`, `src/app/settings/**` | `/` je Rolle; Admin wird nach `/settings` geleitet |
| Vorhandene echte Daten- und Leer-/Fehlerzustände beibehalten | Home- und Werkstatt-Komponenten | Rolf- und Phillip-Home; keine HTML-Demodaten ergänzt |

## 4. Weicht von Vorlage ab

- Die Suche im Kopfbereich ist noch nicht angebunden und deshalb ehrlich weggelassen. Suche/Filter gehört zu B2; es gibt keine funktionslose Suchattrappe.
- Die Rolf-V8-Navigation zeigt `Einstellungen` wie gefordert. Der Inhalt bleibt aus Sicherheitsgründen auf Admin/Developer beschränkt; Meister/Büro werden von `/settings` auf ihr Rollen-Home zurückgeführt. Eine fachliche persönliche Einstellungsfläche für Rolf ist **In Klärung**.
- Die Preview ist durch Vercel-SSO geschützt. Sie ist gebaut und mit bestehender Vercel-Identität geprüft, aber nicht öffentlich erreichbar.
- Ein visueller Rollen-Home-Screenshot aus der Preview fehlt, weil keine realen Testzugänge vorliegen. Loginseite und HTTP-Grenzen sind real geprüft; Rollenkomposition und Datenzustände sind durch bestehende Render-/Unit-Tests belegt.
- Die lokale Remote-Konfiguration zeigte die Anmeldung als nicht verfügbar; die Vercel-Preview selbst zeigt Rolf, Phillip und Gregor dagegen verfügbar. Es wird daraus kein Provider- oder Produktionsclaim abgeleitet.

## 5. Nicht geschafft und warum

- Vollständiger Preview-Login je Rolle einschließlich Screenshots: Zugangsdaten fehlen; **In Klärung**.
- Remote-CI vollständig grün: Der alte geschützte Ratchet aus `origin/main` verweigert die ownerautorisierte Vertragsmigration. Meldung: `The ratchet implementation or invocation drifted; a protected judge-contract migration is required.` Dieser erste Rebaseline-PR benötigt eine einmalige Owner-Ausnahme beim Merge; danach ist die neue Linie regulär geschützt.
- Der GitHub-Quality-Job traf nach grünen Gates, TypeScript, Voll-Lint und 1001 Unit-Tests einen CI-spezifischen Turbopack-Fehler bei `next/font/google` (`Can't resolve '@vercel/turbopack-next/internal/font/google/font'`). Derselbe Produktions-Build ist lokal und bei Vercel grün. Keine unbelegte Erfolgsmeldung: GitHub Quality bleibt am Kandidaten rot.
- Die genaue Liste der in B4 zulässigen ausgegrauten Anschluss-Stellen ist **In Klärung** und wurde in B1 nicht vorweggenommen.

## 6. CI-Status am SHA

SHA: `317f2c92e2c25253c23662cc65724799fc347a55`

| Prüfung | Status | Einordnung |
| --- | --- | --- |
| Vercel | `SUCCESS` | Preview real gebaut; `/start` 200 und alte Route 404 mit authentifiziertem `vercel curl` belegt. |
| Agentur-Gate (2 Läufe) | `SUCCESS` | Remote grün. |
| GitHub Quality | `FAILURE` | Build-Schritt: CI-Turbopack/Google-Font-Auflösung; alle vorherigen Schritte einschließlich 1001 Unit-Tests grün. |
| ESLint Ratchet | `FAILURE` | Erwarteter geschützter Vertragsmigrationsblocker beim ersten Rebaseline-PR. |
| Fresh Supabase replay | `SUCCESS` | Vollständiger isolierter Replay einschließlich echter Session-Kette, Datenbankintegration und V5-Shell-Browser-Smoke am Produkt-SHA grün. |

Lokal am Produktkandidaten:

- `quality:authority-gate:selftest` und `quality:authority-gate`: `PASS`
- `quality:delivery-contracts:selftest` und `quality:delivery-contracts`: `PASS`
- `quality:package-scope:selftest` und exakter B1-Scope: `PASS`
- `quality:no-fake-production`: `PASS`
- `quality:module-gates`: `PASS`
- TypeScript: `PASS`
- Voll-Lint: `PASS`
- Unit: `120` Testdateien, `1001` Tests, `PASS`
- Produktions-Build: `PASS`
- Lokaler Browser: `/start` 200 und `/cockpit` 404; Loginseite visuell geprüft.

## Prüfung und Freigabe

- Unabhängiger Exact-SHA-Review: noch offen; wegen der Owner-Regel „ein Writer, keine zweite Session“ nicht selbst ersetzt.
- Merge, Production-Effekt und Kosten: nicht freigegeben und nicht ausgeführt.
