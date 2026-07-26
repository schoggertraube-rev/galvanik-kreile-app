-- Tabelle: stations (Wird referenziert)
CREATE TABLE stations (
    id text PRIMARY KEY DEFAULT (gen_random_uuid()::text), -- Eindeutige ID für die Station
    slug text NOT NULL UNIQUE, -- Eindeutiger Slug für URLs und Zuordnungen in der App
    name text NOT NULL, -- Anzeigename der Station in der Werkstatt
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL, -- Zeitstempel der Erstellung
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL -- Zeitstempel der letzten Änderung
);
ALTER TABLE stations ENABLE ROW LEVEL SECURITY; -- RLS aktivieren (Deny All by default)

-- Tabelle: users
CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), -- Eindeutige Nutzer-ID
    email text NOT NULL UNIQUE, -- E-Mail-Adresse für Login und Kommunikation
    full_name text NOT NULL, -- Anzeigename in der App
    role text NOT NULL, -- Rolle (z.B. admin, worker) für App-Berechtigungen
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL, -- Erstellungszeitpunkt
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL -- Aktualisierungszeitpunkt
);
ALTER TABLE users ENABLE ROW LEVEL SECURITY; -- RLS aktivieren

-- Tabelle: customers
CREATE TABLE customers (
    id text PRIMARY KEY DEFAULT (gen_random_uuid()::text), -- Eindeutige Kunden-ID
    tenant_id text NOT NULL DEFAULT 'galvanik-kreile', -- Kanonische Mandantengrenze
    name text NOT NULL, -- Name des Kunden oder der Firma
    type text NOT NULL, -- Kundentyp (privat, business etc.)
    contact_person text, -- Ansprechpartner für Rückfragen
    email text, -- E-Mail-Adresse für Rechnungen/Benachrichtigungen
    phone text, -- Telefonnummer für kurzfristige Rückfragen
    pref_comm text, -- Bevorzugter Kommunikationskanal
    risk text DEFAULT 'Niedrig', -- Kundenrisiko
    risk_note text, -- Begründung der Risikoeinstufung
    notes text, -- Kanonische interne Kundennotiz
    address text, -- Unstrukturierte Bestandsadresse
    street text, -- Straße und Hausnummer
    city text, -- Ort
    zip_code text, -- Postleitzahl
    country text, -- Land
    payment_profile jsonb, -- JSONB für Zahlungskonditionen und -historie
    approval_profile jsonb, -- JSONB für Freigabeprozesse und Entscheider
    expectation_profile jsonb, -- JSONB für Qualitäts- und Preiserwartungen
    technical_profile jsonb, -- JSONB für Standard-Materialien und -Oberflächen
    trust_level text, -- Internes Vertrauens-Rating des Kunden
    internal_warning text, -- Interne Warnhinweise (z.B. Zahlungsausfälle)
    tags jsonb, -- Array von Tags zur Kategorisierung und Suche
    credit_rating text, -- Bonitäts-Einstufung des Kunden
    marketing_opt_out boolean NOT NULL DEFAULT false, -- Marketing-Widerruf
    last_reactivated_at TIMESTAMPTZ, -- Letzte Reaktivierung
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL, -- Zeitpunkt der Anlage
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL -- Zeitpunkt der letzten Änderung
);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY; -- RLS aktivieren

-- Tabelle: orders
CREATE TABLE orders (
    id text PRIMARY KEY DEFAULT (gen_random_uuid()::text), -- Eindeutige Auftrags-ID
    tenant_id text NOT NULL DEFAULT 'galvanik-kreile', -- Kanonische Mandantengrenze
    order_number text NOT NULL UNIQUE, -- Lesbare, fortlaufende Auftragsnummer
    customer_id text NOT NULL, -- Referenz auf den Kunden
    title text NOT NULL, -- Kurze Bezeichnung des Auftrags
    task text, -- Ausführliche operative Aufgabe
    station text NOT NULL DEFAULT 'wareneingang', -- Kanonische Stationskennung
    current_station_id text, -- Aktuelle Stationskennung für neue Pfade
    status text NOT NULL, -- Aktueller Gesamtstatus des Auftrags
    risk text, -- Risikoeinstufung (z.B. kritisch wegen Termin)
    priority text DEFAULT 'normal', -- Manuelle Priorität
    priority_computed text DEFAULT 'green', -- Deterministisch berechnete Priorität
    status_text text, -- Detailtext zum aktuellen Status
    delay_reason text, -- Grund für eine eventuelle Verzögerung
    recommended_action text, -- Handlungsempfehlung für den Mitarbeiter im Cockpit
    received_at TIMESTAMPTZ, -- Zeitpunkt des physischen Wareneingangs
    intake_date TIMESTAMPTZ DEFAULT now(), -- Kanonischer Wareneingangszeitpunkt
    due_date TIMESTAMPTZ, -- Vereinbartes Fälligkeitsdatum
    promised_date TIMESTAMPTZ, -- Intern zugesagtes Fertigstellungsdatum
    promised_due_date TIMESTAMPTZ, -- Kanonischer zugesagter Fertigstellungstermin
    completed_date TIMESTAMPTZ, -- Tatsächlicher Abschlusszeitpunkt
    source text, -- Herkunft des Auftrags
    source_ref text, -- Externe oder interne Quellreferenz
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL, -- Erstellungszeitpunkt in der DB
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL, -- Letzte Änderung
    -- FK: RESTRICT, da ein Kunde mit aktiven Aufträgen nicht versehentlich gelöscht werden darf
    CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY; -- RLS aktivieren

-- Tabelle: items
CREATE TABLE items (
    id text PRIMARY KEY DEFAULT (gen_random_uuid()::text), -- Eindeutige Teile-ID
    tenant_id text NOT NULL DEFAULT 'galvanik-kreile', -- Kanonische Mandantengrenze
    order_id text NOT NULL, -- Zugehöriger Auftrag
    customer_id text NOT NULL, -- Zugehöriger Kunde
    name text NOT NULL, -- Bezeichnung des Werkstücks
    quantity integer NOT NULL DEFAULT 1, -- Anzahl der gleichen Werkstücke im Auftrag
    current_station_id text DEFAULT 'wareneingang', -- Aktuelle Station
    material text, -- Basismaterial des Teils (z.B. Stahl, Messing)
    surface_requested text, -- Gewünschte Ziel-Oberfläche (z.B. Nickel)
    photo_ids jsonb, -- Referenzen auf hochgeladene Fotos
    is_missing boolean DEFAULT false, -- Flag, falls das Teil in der Produktion unauffindbar ist
    is_damaged boolean DEFAULT false, -- Flag für festgestellte Vorschäden
    needs_rework boolean DEFAULT false, -- Flag, falls Nacharbeit nötig ist
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL, -- Erstellungszeitpunkt
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL, -- Letzte Änderung
    -- FK: CASCADE, da Einzelteile fest an einen Auftrag gebunden sind und mit ihm gelöscht werden sollen
    CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_item_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
);
ALTER TABLE items ENABLE ROW LEVEL SECURITY; -- RLS aktivieren

-- Tabelle: status_events
CREATE TABLE status_events (
    id text PRIMARY KEY DEFAULT (gen_random_uuid()::text), -- Eindeutige Event-ID
    order_id text, -- Optionaler Bezug zu einem Auftrag
    item_id text, -- Optionaler Bezug zu einem spezifischen Einzelteil
    customer_id text, -- Bezug zum Kunden für die Historien-Ansicht
    event_type text NOT NULL, -- Art des Events (z.B. 'STATION_COMPLETED')
    metadata jsonb, -- Flexible Zusatzdaten zum Event
    timestamp TIMESTAMPTZ DEFAULT now() NOT NULL, -- Logischer Zeitpunkt des Events in der Realität
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL, -- Speicherung des Events in der DB
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL, -- Letzte Änderung
    -- FK: CASCADE, Historien-Event wird gelöscht, wenn der zugehörige Auftrag verschwindet
    CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    -- FK: CASCADE, Event wird gelöscht, wenn das referenzierte Teil verschwindet
    CONSTRAINT fk_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    -- FK: CASCADE, Event wird bereinigt, wenn der Kunde gelöscht wird
    CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
ALTER TABLE status_events ENABLE ROW LEVEL SECURITY; -- RLS aktivieren

-- Tabelle: baths
CREATE TABLE baths (
    id text PRIMARY KEY DEFAULT (gen_random_uuid()::text), -- Eindeutige Bad-ID
    bath_number text NOT NULL UNIQUE, -- Eindeutige, lesbare Bad-Nummer (z.B. B1)
    name text NOT NULL, -- Name des Galvanik-Bads
    process_type text NOT NULL, -- Prozesstyp (z.B. nickel, chrom)
    status text NOT NULL, -- Zustand des Bads (z.B. stable, critical)
    station_id text, -- Physischer Standort (Station) in der Werkstatt
    target_values jsonb, -- Zielwerte für Temperatur, pH etc.
    last_measurement_at TIMESTAMPTZ, -- Zeitpunkt der letzten Messung
    next_measurement_due_at TIMESTAMPTZ, -- Fälligkeit der nächsten Routinemessung
    notes text, -- Allgemeine Bemerkungen zum Bad
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL, -- Erstellungszeitpunkt
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL, -- Letzte Änderung
    -- FK: RESTRICT, da eine Station nicht gelöscht werden darf, wenn noch Bäder dort aktiv sind
    CONSTRAINT fk_station FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE RESTRICT
);
ALTER TABLE baths ENABLE ROW LEVEL SECURITY; -- RLS aktivieren

-- Tabelle: bath_measurements
CREATE TABLE bath_measurements (
    id text PRIMARY KEY DEFAULT (gen_random_uuid()::text), -- Eindeutige Messungs-ID
    tenant_id text NOT NULL DEFAULT 'galvanik-kreile', -- Kanonische Mandantengrenze
    bath_id text NOT NULL, -- Zugehöriges Bad
    temperature real, -- Gemessene Bad-Temperatur
    ph real, -- Gemessener pH-Wert
    concentration real, -- Gemessene Konzentration der Chemie
    conductivity real, -- Gemessene Leitfähigkeit
    status_after_measurement text NOT NULL, -- Badstatus direkt nach der Messung (Log)
    note text, -- Bemerkungen zur Messung durch den Mitarbeiter
    measured_at TIMESTAMPTZ DEFAULT now() NOT NULL, -- Zeitpunkt der Ablesung
    measured_by uuid, -- Mitarbeiter, der die Messung durchgeführt hat
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL, -- Speicherung in DB
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL, -- Letzte Änderung
    -- FK: CASCADE, da Messungen ohne das Bad nicht weiter relevant sind
    CONSTRAINT fk_bath FOREIGN KEY (bath_id) REFERENCES baths(id) ON DELETE CASCADE,
    -- FK: RESTRICT, damit die Nachvollziehbarkeit des Mitarbeiters nicht unabsichtlich zerreißt
    CONSTRAINT fk_measured_by FOREIGN KEY (measured_by) REFERENCES users(id) ON DELETE RESTRICT
);
ALTER TABLE bath_measurements ENABLE ROW LEVEL SECURITY; -- RLS aktivieren

-- Tabelle: complaints
CREATE TABLE complaints (
    id text PRIMARY KEY DEFAULT (gen_random_uuid()::text), -- Eindeutige Reklamations-ID
    tenant_id text NOT NULL DEFAULT 'galvanik-kreile', -- Kanonische Mandantengrenze
    order_id text NOT NULL, -- Betroffener Auftrag der Reklamation
    customer_id text NOT NULL, -- Reklamierender Kunde
    item_id text, -- Optional: Direkt betroffenes Einzelteil
    station_id text, -- Optional: Ort des mutmaßlichen Fehlers in der Produktion
    reason text NOT NULL, -- Klassifizierungsgrund (z.B. Oberflächenqualität)
    description text NOT NULL DEFAULT '', -- Freitext-Beschreibung des Problems
    photo_ids jsonb DEFAULT '[]'::jsonb, -- Belegfotos
    status text NOT NULL DEFAULT 'open', -- Bearbeitungsstatus
    resolved_at TIMESTAMPTZ, -- Zeitpunkt der Erledigung
    resolution text, -- Vereinbarte Lösung oder Gegenmaßnahme
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL, -- Eingangszeitpunkt der Reklamation
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL, -- Letzte Änderung
    -- FK: CASCADE, bei Auftrags-Löschung verschwindet auch die Reklamation (Vermeidung von Waisen)
    CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    -- FK: CASCADE, da die Reklamation fest zum Kunden gehört
    CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    -- FK: CASCADE, beim Löschen des Teils verfällt der Bezug
    CONSTRAINT fk_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    -- FK: RESTRICT, da Stationen historisch stabil bleiben müssen, um Qualitätsstatistiken nicht zu verfälschen
    CONSTRAINT fk_station FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE RESTRICT
);
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY; -- RLS aktivieren

-- Tabelle: inventory_items
CREATE TABLE inventory_items (
    id text PRIMARY KEY DEFAULT (gen_random_uuid()::text), -- Eindeutige Artikel-ID
    tenant_id text NOT NULL DEFAULT 'galvanik-kreile', -- Kanonische Mandantengrenze
    sku text NOT NULL UNIQUE, -- Artikelnummer für Barcodes/Referenzen
    name text NOT NULL, -- Bezeichnung der Chemie oder des Verbrauchsmaterials
    current_stock numeric(14,4) NOT NULL DEFAULT 0, -- Aktueller Lagerbestand
    min_stock numeric(14,4), -- Meldebestand für Warnungen und Nachbestellungen
    price_per_unit numeric(10,4), -- Einkaufspreis pro Einheit für Kalkulationen
    unit text NOT NULL, -- Maßeinheit (z.B. Liter, kg, Stück)
    is_consumable boolean DEFAULT true NOT NULL, -- Flag für Verbrauchsmaterial (im Gegensatz zu Werkzeugen)
    is_hazardous boolean DEFAULT false NOT NULL, -- Flag für Gefahrstoff (Sicherheitskennzeichnung)
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL, -- Anlagezeitpunkt im System
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL -- Letzte Änderung
);
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY; -- RLS aktivieren

-- Tabelle: stock_movements
CREATE TABLE stock_movements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), -- Eindeutige Bewegungs-ID
    tenant_id text NOT NULL DEFAULT 'galvanik-kreile', -- Kanonische Mandantengrenze
    inventory_item_id text NOT NULL, -- Bewegter Artikel
    movement_type text NOT NULL, -- Art (z.B. Wareneingang, Ausgang, Verbrauch)
    quantity numeric(14,4) NOT NULL, -- Bewegte Menge (Vorzeichen bestimmt Zu/Abgang logisch)
    unit text NOT NULL, -- Einheit der gebuchten Menge
    order_id text, -- Optionaler Projektbezug für auftragsbezogenen Verbrauch
    reason text, -- Begründung für die Bewegung (z.B. Schwund, Bruch)
    created_by uuid NOT NULL, -- Buchender Mitarbeiter
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL, -- Buchungszeitpunkt
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL, -- Letzte Änderung
    -- FK: RESTRICT, da Lagerbewegungen zwingend für Revision und Historie erhalten bleiben müssen
    CONSTRAINT fk_inventory_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT,
    -- FK: RESTRICT, Projektbezug soll für Nachkalkulationen erhalten bleiben
    CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
    -- FK: RESTRICT, Nachvollziehbarkeit des Mitarbeiters (Audit-Trail) muss unveränderlich bleiben
    CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY; -- RLS aktivieren

-- Tabelle: price_agreements
CREATE TABLE price_agreements (
    id text PRIMARY KEY DEFAULT (gen_random_uuid()::text), -- Eindeutige Preis-ID
    customer_id text NOT NULL, -- Kunde für die Sonderkondition
    scope text NOT NULL, -- Geltungsbereich der Absprache
    rate text NOT NULL, -- Vertraglich gespeicherter Satz
    date TIMESTAMPTZ DEFAULT now() NOT NULL, -- Wirksamkeitsdatum
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL, -- Erstellungszeitpunkt
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL, -- Letzte Änderung
    -- FK: CASCADE, wenn der Kunde gelöscht wird, entfallen seine spezifischen Sonderpreise
    CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
ALTER TABLE price_agreements ENABLE ROW LEVEL SECURITY; -- RLS aktivieren

-- Tabelle: inquiries (QuoteRequests)
CREATE TABLE inquiries (
    id text PRIMARY KEY DEFAULT (gen_random_uuid()::text), -- Eindeutige Anfrage-ID
    tenant_id text NOT NULL DEFAULT 'galvanik-kreile', -- Kanonische Mandantengrenze
    customer_id text, -- Optional, falls es ein bereits bekannter Bestandskunde ist
    customer_name text NOT NULL, -- Name des Anfragenden (wichtig für Neukunden ohne Konto)
    subject text NOT NULL, -- Betreff oder Titel der Anfrage
    description text, -- Freitext der Anfrage vom Kunden
    rust_level text, -- Bewerteter Zustand (z.B. Rostgrad) des Bauteils für den Aufwand
    dirt_level text, -- Verschmutzungsgrad
    part_count integer NOT NULL DEFAULT 1, -- Anzahl der Teile
    material text NOT NULL DEFAULT '', -- Materialangabe
    pricing jsonb, -- Kalkulierte Preisstruktur (Grundarbeit, Reinigung, etc.)
    status text NOT NULL, -- Bearbeitungsstatus (z.B. offen, angeboten, abgelehnt)
    photo text, -- Link zum angehängten Schadens- oder Teilefoto
    quelle_typ text NOT NULL DEFAULT 'unbekannt', -- Marketing-/Anfragequelle
    quelle_touchpoint_id uuid, -- Zugeordneter Marketing-Touchpoint
    quelle_manuell text, -- Manuell bestätigte Quelle
    quelle_konfidenz numeric(5,2), -- Konfidenz 0..1
    extracted_data jsonb, -- Extraktionsbeleg
    converted_to_order_id text, -- Erzeugter Auftrag
    converted_to_customer_id text, -- Erzeugter Kunde
    received_at TIMESTAMPTZ DEFAULT now() NOT NULL, -- Tatsächlicher Eingang der Anfrage (E-Mail Datum)
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL, -- Anlage in der Datenbank
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL, -- Letzte Änderung
    -- FK: SET NULL, falls ein Bestandskunde gelöscht wird, bleibt die alte Anfrage für die globale Statistik anonymisiert erhalten
    CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY; -- RLS aktivieren
