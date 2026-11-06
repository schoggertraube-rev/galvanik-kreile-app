# AP-ABS – Absprachen als Typ (Planungschat, 06.11. 02:20)

**Quelle (einzige):** BAUPLAN `9491009F…` (spec `b6132498f47a`), Abschnitt `paket_folge.AP-ABS` – Seiten, Eingriffe, Befehle, Rechte, Texte, Testfälle `testmodell.seiten.absprache` ABS-01…ABS-20, Sichtvertrag `absprache` (leer/beispiel/#aendern/#widerruf). Bis TA-B2k2 gemergt ist, gilt `BAUPLAN.next.json` mit dieser SHA (lokal auf dem TA-B2k2-Branch als `BAUPLAN.json`). Branch `kreile/b3-abs` auf dem TA-B2k2-Branch. Reihenfolge: `paket_folge.AP-ABS.reihenfolge_bau`.

## Datenmodell (Planungschat-Entscheidung, Datenbefund P66 4: `customer_agreements` existiert nicht)
Eine additive Migration `supabase/migrations/<zeit>_abs_absprachen.sql`; Dev nach P47 (Abbruch-Probe, dann anwenden, eingefroren).
- **`customer_agreements`** (neu): `id uuid pk default gen_random_uuid()`, `tenant_id`, `customer_id` (Typ und FK wie `customers.tenant_id`/`customers.id`), `position int not null check 1–20`, `bezeichnung text not null`, `wert text`, `geld boolean not null default false`, `hinweis boolean not null default false`, `gueltig_bis date`, `typ text` (null = Freitext; sonst nur die Schlüssel aus `paket_folge.AP-ABS.typen`, CHECK), `order_id` (Typ/FK wie `orders.id`, null = ganzer Kunde), `ziel_tage int check > 0` (Pflicht bei Zahlungsziel und Sammelrechnung), `grund text`, `widerrufen_am timestamptz`, `widerrufen_von` (Login-Typ wie im Bestand), `widerruf_grund text`, `version int not null default 1`, `client_key uuid`, `created_at timestamptz not null default now()`, `created_by`. Unique `(tenant_id, client_key)` wo client_key nicht null; **höchstens eine gültige typisierte Absprache je (tenant, customer, order_id)**: partieller Unique-Index `where typ is not null and widerrufen_am is null` (order_id null als eigener Wert, z. B. `coalesce`). Unique `(tenant_id, customer_id, position)` für Freitext-Einträge (typ null, nicht widerrufen).
- **`invoice_collections`** und **`invoice_collection_orders`** genau wie `paket_folge.AP-ABS.datenmodell`.
- RLS mandantengebunden wie `customers`; Schreiben nur über die Befehle des Pakets (Recht `geld`; Sammelliste zusätzlich `recordGoodsOutCommand`, Recht `auftraege`); REVOKE DELETE, TRUNCATE für service_role/anon/authenticated (wie `ein4_rechte`).

## 5.2/3.1 „Absprachen & Eigenheiten“
In AP-EIN ausgeblendet → mit AP-ABS einblenden, Inhalt wie Bauplan-Screens (Freitext-Liste bis 20 Positionen, Häkchen `geld`/`hinweis`, `gueltig_bis`), gespeichert über den **vorhandenen** Kunden-Schreibweg (kein zweiter Weg). Freitext wirkt nie auf Sperren; bei `geld = true` ohne Typ zeigt 5.1 „Absprache {bezeichnung} · Typ festlegen“.

## Fertig
ABS-01…ABS-20 grün (Modellkonflikte nach Regel 23), Sicht `absprache` + geänderte 5.1/5.2/4.1/10.1-Bereiche Rot 0 nach P54, Abgabe `docs/delivery/ABGABE_AP-ABS.md`, Was-ist-neu-Eintrag.
