-- Paket B2, Review PR #115 Runde 6 (P1-2): der Legacy-Terminfeld-Konflikt wird
-- sichtbar, ohne die Terminwahrheit anzutasten.
--
-- Fachlicher Auftrag, drei Stellen im G04-Dossier:
--   * _MODULDOSSIERS/G04_AUFTRAEGE/02_FUNKTIONEN_ABLAEUFE.md, F-G04-007: "Legacy-
--     Terminfelder widersprechen sich" ist ein deklarierter Fehlerfall genau
--     dieses Ports.
--   * _MODULDOSSIERS/G04_AUFTRAEGE/05_REGELN_SPERREN_KONFLIKTE.md, K-G04-008:
--     "read-only Diagnose ... keine automatische Wahl".
--   * _MODULDOSSIERS/G04_AUFTRAEGE/01_ANFORDERUNGSKATALOG.md, A-G04-008:
--     "Abweichungen zum Legacy-Feld werden vor Migration als Konflikt
--     ausgewiesen" — und gleichzeitig "Alle G04-Reads verwenden due_date".
--
-- Diese Migration ist rein additiv und aendert KEINEN Wert und KEINE Semantik der
-- bestehenden Vertragsspalten. public.orders.due_date bleibt die einzige Quelle
-- des bestaetigten Termins; public.orders.promised_due_date wird ausschliesslich
-- KLASSIFIZIERT, nie gelesen, nie gewaehlt, nie gemischt. Der Readvertrag
-- transportiert deshalb genau eine neue Spalte mit vier moeglichen Textwerten und
-- keinen zweiten Datumswert. Ein zweiter Wert waere eine zweite Wahrheit und
-- wuerde K-G04-008 verletzen.
--
-- CREATE OR REPLACE VIEW statt Editieren von
-- 20260927120000_b2_order_timeliness_read_contract.sql: bestehende Migrationen
-- werden auf diesem Branch nicht umgeschrieben (sie sind auf lokalen und CI-
-- Datenbanken bereits im Ledger). Die Definition unten ist byteweise die des
-- Originals, um exakt eine angehaengte Spalte erweitert; CREATE OR REPLACE VIEW
-- laesst nur das Anhaengen am Ende zu und wuerde eine stille Umbenennung oder
-- Typaenderung der bestehenden Spalten selbst abweisen.
--
-- ZONENREGEL — FAIL-CLOSED PLATZHALTER, OWNER-BESTAETIGUNG OFFEN:
-- public.orders.due_date ist `timestamp without time zone`, also ein zonenfreier
-- Kalendertag (der Port liest ihn per to_char(..., 'YYYY-MM-DD"T"...Z') als UTC).
-- public.orders.promised_due_date ist `timestamp with time zone`, hat also erst
-- MIT einer Zone einen Kalendertag. Welche Zone fachlich gilt, ist NICHT
-- entschieden (offener Punkt: Termin-Semantik G03 vs. G04). Solange das offen
-- ist, klassifiziert diese View fail-closed: 'gleich' wird nur behauptet, wenn
-- der Tag in BEIDEN geprueften Zonen (UTC und Europe/Berlin) uebereinstimmt.
-- Jeder Zwischenfall — also jeder Termin, dessen Tag von der Zonenwahl abhaengt —
-- faellt bewusst auf 'widerspruechlich' und wird damit gemeldet statt geglaettet.
-- Die Zonenwahl ist ein Vorschlag und braucht eine Owner-Entscheidung; sie darf
-- nicht als final gelesen werden.
--
-- Die uebrigen Eigenschaften bleiben unveraendert: Tenant-Zeilenfilter
-- fail-closed ueber die GUC app.tenant_id, security_invoker = true, REVOKE ALL
-- gegen PUBLIC/anon/authenticated und SELECT nur fuer service_role. Die
-- Ereignis-View public.v_order_timeliness_pickup_events_v1 wird hier NICHT
-- angefasst.

CREATE OR REPLACE VIEW public.v_order_timeliness_orders_v1
WITH (security_invoker = true)
AS
SELECT
  orders.id,
  orders.tenant_id,
  orders.order_number,
  orders.status,
  orders.version,
  orders.due_date,
  orders.completed_date,
  CASE
    WHEN orders.promised_due_date IS NULL THEN 'nur_due_date'
    WHEN orders.due_date IS NULL THEN 'nur_promised'
    WHEN orders.due_date::date = (orders.promised_due_date AT TIME ZONE 'UTC')::date
      AND orders.due_date::date = (orders.promised_due_date AT TIME ZONE 'Europe/Berlin')::date
      THEN 'gleich'
    ELSE 'widerspruechlich'
  END AS promised_date_legacy_class
FROM public.orders orders
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND orders.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

COMMENT ON VIEW public.v_order_timeliness_orders_v1 IS
  'G04 Termintreue-Readvertrag v1: tenantgebundene Auftragszeilen (bestaetigter Termin, Fertigzeit, Lebenszyklusstatus, Aggregatversion) ohne Aggregation und ohne Historisierung; completed_date ist immer der aktuelle Wert. promised_date_legacy_class ist read-only Diagnose des Legacy-Felds promised_due_date (nur_due_date | nur_promised | gleich | widerspruechlich, A-G04-008/K-G04-008): sie waehlt NIE zwischen den Feldern, der bestaetigte Termin bleibt due_date. Die Zonenregel ist fail-closed und OFFEN — gleich nur, wenn der Kalendertag in UTC UND Europe/Berlin uebereinstimmt; die Zonenwahl braucht eine Owner-Entscheidung.';

REVOKE ALL ON TABLE public.v_order_timeliness_orders_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.v_order_timeliness_orders_v1 TO service_role;
