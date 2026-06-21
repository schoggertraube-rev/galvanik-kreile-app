# Produktverfassung – Kreile WerkstattCockpit

## Hauptziel

Die Kreile App verwandelt einen papiergeführten, inhaberabhängigen Handwerksbetrieb in ein transparentes, planbares und übergabefähiges Unternehmen.

**Leitformel:** Vom Handgriff zur sicheren Unternehmensentscheidung.

---

## Prioritätsreihenfolge bei Zielkonflikten

1. Performance
2. UI/UX
3. Marketingwirkung und Oha-Effekt
4. Nutzung echter Assets (Bilder, Videos, Referenzen, Namen, Presse, Texte)
5. Kundennutzen und Abschlusswahrscheinlichkeit
6. Datengewinnung, Analysefähigkeit, Chef-Dashboard
7. Operative Effizienz für Mitarbeiter
8. Erweiterbarkeit und Wiederverwendbarkeit
9. Datenschutz als pragmatische Risikoabwägung
10. Kosten und Implementierungsaufwand

---

## Architektur und Tech-Stack

- **Frontend:** Next.js App Router · TypeScript · Tailwind CSS · Framer Motion
- **Backend:** Supabase (Postgres) · Drizzle ORM · Next.js Server Actions
- **OCR:** Klippa DocHorizon (primär, Wareneingang + Buchhaltung) · Gemini Vision (Fallback)
- **Payments:** Mollie
- **Deployment:** Vercel · PWA
- **Tests:** Playwright (E2E) · Vitest (Unit)

---

## CI-Designtokens (verbindlich, kein Hex inline)

| Token | Wert |
|---|---|
| Cream | `#F1E9DC` |
| Surface | `#FBF6ED` |
| Navy | `#1A1F2E` |
| Magenta | `#C2185B` |
| Success | `#4F8F58` |
| Warning | `#D89A2C` |
| Danger | `#B0413E` |
| Gradient | `linear-gradient(115deg,#7A3FB0,#C2185B 38%,#F2643C 72%,#F6A93B)` |

**Typografie:** Fraunces (Auftragsnummern, Namen, Beträge) · Inter (Fließtext)  
**card-radius:** 18px

---

## Verifizierte Spaltennamen (kanonisch)

| Kontext | Korrekt | Falsch |
|---|---|---|
| Fälligkeitsdatum | `promised_due_date` | due_date |
| Abschlussdatum | `completed_date` | — |
| Aktuelle Station | `current_station_id` | station_id |
| Arbeitszeitbuchung | `auftrag_id` | order_id |
| Stationsereignisse | `STATION_EINGANG` / `STATION_AUSGANG` | Kleinschreibung |

---

## Bekannte fehlende FKs (Migrationsbedarf)

- `ausgangsrechnung.order_id` → fehlt FK zu `orders.id` (blockiert Margenrechnung)
- `scan_uploads.linked_order_id` → FK-Migration steht aus (20260620000001)
- `scan_uploads.linked_customer_id` → FK-Migration steht aus (20260620000001)
- `inventory_items.tenant_id` → nullable, kein NOT NULL

---

## Pflichtregeln für jeden Build

1. Kein `Math.random()` im Produktionspfad.
2. Keine Mocks, keine hartkodierten Hex-Werte, keine hartkodierten Labels.
3. `NULL`-Zustände → „Noch keine Daten erfasst" + Aktionslink.
4. Alle KPIs aus SQL-Views, nicht aus Frontend-Berechnungen.
5. Alle UI-Labels deutsch.
6. Kein DB-Passwort inline im Terminal.
7. Secrets als Env-Variable, nie in Dateien committen.
8. Navigation/Sidebar nicht anfassen ohne Visual Pitch.
9. Vor Go-Live: alle Keys rotieren.
10. Jede neue Tabelle bekommt sofort RLS-Policy.

---

## Definition of Done (10 Checkpoints)

- [ ] tsc Exit 0
- [ ] lint Exit 0
- [ ] Tests grün (Report-Datei)
- [ ] Persistenz: SELECT-Beweis nach Write
- [ ] Rollen: ≥ 2 Rollen, RLS-Beweis
- [ ] Tablet/Mobile Screenshots
- [ ] Twin-Check dokumentiert
- [ ] Visual Pitch abgenommen (nur bei UI-Änderungen)
- [ ] Live-Beweis: curl 200 + Deployment-ID
- [ ] Chief Verifier gegengezeichnet (R2+)

---

## Nutzerzwillinge (Pflicht-Konsultation)

→ `@docs/user-twins/USER_TWIN_ROLF.md`  
→ `@docs/user-twins/USER_TWIN_PHILLIP.md`  
→ `@docs/user-twins/USER_TWIN_MICHAEL.md`

Jedes Konzept und jede UI-Änderung muss gegen alle drei Twins geprüft werden, bevor ein Build-Prompt ausgelöst wird.

---

## Risikoklassen

| Klasse | Scope | Verifier |
|---|---|---|
| R0 | Lint, tsc, Unit-Test | Automatisch |
| R1 | Neue UI-Komponente ohne Datenänderung | QA Lead |
| R2 | Neue API, neue Tabelle, neue Integration | Chief Verifier (Claude) |
| R3 | Auth, Payments, Migrations, P0-Defekte | Chief Verifier (unabhängig) + Red Team |

---

## Eskalationsschwellen (Pflicht-Rückfrage)

- Laufende Kosten > 20 €/Monat
- Einmalige Kosten > 100 €
- Neue externe Abhängigkeit (neues SaaS, neuer API-Key)
- Irreversible Datenbankänderung
- Sichtbare UI-Änderung ohne Visual Pitch
