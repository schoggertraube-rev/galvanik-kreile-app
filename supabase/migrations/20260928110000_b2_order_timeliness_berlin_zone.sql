-- Paket B2, Review PR #115 Runde 10 (P1-A): die Zonenregel der
-- Legacy-Terminklassifikation wird auf die EINE kanonische Zone gesetzt.
--
-- Was hier korrigiert wird, ist keine offene Fachfrage, sondern eine
-- uneindeutige technische Umsetzung eines bereits entschiedenen Mandats.
-- 20260928090000_b2_order_timeliness_legacy_class.sql hat 'gleich' nur dann
-- behauptet, wenn der Kalendertag in UTC UND in Europe/Berlin uebereinstimmt,
-- und diese Doppelpruefung als "fail-closed Platzhalter, OWNER-BESTAETIGUNG
-- OFFEN" beschrieben. Genau das war der Defekt: die Konjunktion macht die
-- Klasse von ZWEI Zonen abhaengig, obwohl nur eine gilt, und stempelt damit
-- jeden Termin zwischen 22:00 und 24:00 UTC (Sommerzeit) beziehungsweise
-- 23:00 und 24:00 UTC (Winterzeit) als 'widerspruechlich', obwohl er in der
-- kanonischen Zone derselbe Kalendertag ist. Ein Falsch-Positiv in einer
-- Konfliktdiagnose ist nicht "sicher", es erzeugt Konflikte, die es nicht gibt,
-- und untergraebt A-G04-008 ("Abweichungen zum Legacy-Feld werden vor
-- Migration als Konflikt ausgewiesen") genau dort, wo sie tragen soll.
--
-- ZONENREGEL — ENTSCHIEDEN, Europe/Berlin ist die einzige kanonische Zone:
--   * _MODULDOSSIERS/G04_AUFTRAEGE/02_FUNKTIONEN_ABLAEUFE.md:69 legt fuer die
--     Terminuebersicht "Zeitraum und Zeitzone `Europe/Berlin` festlegen" fest.
--     Der Kalendertag eines Termins ist damit der Berliner Kalendertag.
--   * supabase/migrations/20260908101500_werkstatt_kpi_view.sql:45 rechnet die
--     Faelligkeitsfenster der Werkstatt-KPI ueber
--     `(now() AT TIME ZONE 'Europe/Berlin')::date`.
--   * supabase/migrations/20260821152949_f1_4_immutable_invoice_contract.sql:207
--     haelt es woertlich fest: "Berlin is the single legal due-date truth;
--     never the DB session zone" und rechnet
--     `(issued_at AT TIME ZONE 'Europe/Berlin')::date`.
-- Es gibt also kein offenes Wahlrecht mehr und nichts, was eine
-- Owner-Entscheidung braucht; die Zone ist repoweit belegt.
--
-- Daraus folgt pro Spalte genau eine Behandlung, und die ist NICHT symmetrisch:
--   * public.orders.due_date ist `timestamp without time zone`, also bereits
--     zonenlos notierter Kalendertag. Eine Zonenkonvertierung waere hier falsch:
--     `AT TIME ZONE` auf einen zonenlosen Wert INTERPRETIERT ihn in dieser Zone
--     und liefert einen Instant, verschiebt den Tag also. Richtig ist allein
--     `::date`.
--   * public.orders.promised_due_date ist `timestamp with time zone`, hat also
--     erst MIT einer Zone einen Kalendertag. Richtig ist
--     `(... AT TIME ZONE 'Europe/Berlin')::date`, exakt das Muster der beiden
--     Praezedenzen oben.
--
-- Bewusst NICHT angefasst: public.orders.completed_date bleibt ueberall ein
-- UTC-Instant (der Port projiziert ihn in
-- src/modules/orders/server/getOrderTimelinessFacts.ts per
-- `AT TIME ZONE 'UTC'`). Das ist ein Zeitstempel und keine Kalendertagsfrage;
-- eine Berlin-Projektion wuerde dort Offset-Mehrdeutigkeit einfuehren, ohne
-- eine Frage zu beantworten. Die Zonenregel gilt fuer Kalendertage, nicht fuer
-- Instants.
--
-- Diese Migration ist rein additiv und aendert ausschliesslich den einen
-- CASE-Zweig sowie den Kommentartext. Spaltenliste, Reihenfolge, Typen,
-- Tenant-Zeilenfilter ueber die GUC app.tenant_id, security_invoker = true und
-- REVOKE/GRANT bleiben bytegleich zu
-- 20260928090000_b2_order_timeliness_legacy_class.sql. Es bleibt bei genau
-- einer Diagnosespalte mit vier Textwerten und KEINEM zweiten Datumswert:
-- public.orders.due_date bleibt die einzige Terminwahrheit, K-G04-008
-- ("read-only Diagnose ... keine automatische Wahl") bleibt unberuehrt. Die
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
    WHEN orders.due_date::date = (orders.promised_due_date AT TIME ZONE 'Europe/Berlin')::date
      THEN 'gleich'
    ELSE 'widerspruechlich'
  END AS promised_date_legacy_class
FROM public.orders orders
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND orders.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

COMMENT ON VIEW public.v_order_timeliness_orders_v1 IS
  'G04 Termintreue-Readvertrag v1: tenantgebundene Auftragszeilen (bestaetigter Termin, Fertigzeit, Lebenszyklusstatus, Aggregatversion) ohne Aggregation und ohne Historisierung; completed_date ist immer der aktuelle Wert und bleibt ein UTC-Instant. promised_date_legacy_class ist read-only Diagnose des Legacy-Felds promised_due_date (nur_due_date | nur_promised | gleich | widerspruechlich, A-G04-008/K-G04-008): sie waehlt NIE zwischen den Feldern, der bestaetigte Termin bleibt due_date. Die Zonenregel ist ENTSCHIEDEN und nicht offen: Europe/Berlin ist die einzige kanonische Zone fuer Kalendertage (_MODULDOSSIERS/G04_AUFTRAEGE/02_FUNKTIONEN_ABLAEUFE.md:69 "Zeitzone Europe/Berlin"; Praezedenzen 20260908101500_werkstatt_kpi_view.sql:45 und 20260821152949_f1_4_immutable_invoice_contract.sql:207 "Berlin is the single legal due-date truth"). due_date ist timestamp without time zone und wird deshalb nur per ::date gelesen, promised_due_date ist timestamptz und wird per (AT TIME ZONE ''Europe/Berlin'')::date auf den Berliner Kalendertag gebracht.';

REVOKE ALL ON TABLE public.v_order_timeliness_orders_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.v_order_timeliness_orders_v1 TO service_role;
