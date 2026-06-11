-- Bereinigung von Demo-Kunden und Demo-Aufträgen

-- 1. Demo-Aufträge löschen (Löscht cascade-mäßig auch items, phone_notes etc., falls FKs korrekt konfiguriert sind, ansonsten manuell)
DELETE FROM complaints WHERE order_id IN (SELECT id FROM orders WHERE id LIKE 'ord_%' OR order_number IN ('A-2026-0030', 'A-2026-0035', 'A-2026-0038', 'A-2026-0040', 'A-2026-0042'));
DELETE FROM arbeitszeit_buchung WHERE auftrag_id IN (SELECT id FROM orders WHERE id LIKE 'ord_%' OR order_number IN ('A-2026-0030', 'A-2026-0035', 'A-2026-0038', 'A-2026-0040', 'A-2026-0042'));
DELETE FROM consumable_uses WHERE order_id IN (SELECT id FROM orders WHERE id LIKE 'ord_%' OR order_number IN ('A-2026-0030', 'A-2026-0035', 'A-2026-0038', 'A-2026-0040', 'A-2026-0042'));
DELETE FROM stock_movements WHERE order_id IN (SELECT id FROM orders WHERE id LIKE 'ord_%' OR order_number IN ('A-2026-0030', 'A-2026-0035', 'A-2026-0038', 'A-2026-0040', 'A-2026-0042'));
DELETE FROM order_financials WHERE order_id IN (SELECT id FROM orders WHERE id LIKE 'ord_%' OR order_number IN ('A-2026-0030', 'A-2026-0035', 'A-2026-0038', 'A-2026-0040', 'A-2026-0042'));
DELETE FROM order_cost_events WHERE order_id IN (SELECT id FROM orders WHERE id LIKE 'ord_%' OR order_number IN ('A-2026-0030', 'A-2026-0035', 'A-2026-0038', 'A-2026-0040', 'A-2026-0042'));
DELETE FROM items WHERE order_id IN (SELECT id FROM orders WHERE id LIKE 'ord_%' OR order_number IN ('A-2026-0030', 'A-2026-0035', 'A-2026-0038', 'A-2026-0040', 'A-2026-0042'));

DELETE FROM orders 
WHERE order_number IN (
  'A-2026-0030', 'A-2026-0035', 'A-2026-0038', 'A-2026-0040', 'A-2026-0042'
);

-- Aufträge, die mit 'ord_' beginnen (falls als Demo angelegt)
DELETE FROM orders WHERE id LIKE 'ord_%';

-- 2. Demo-Kunden löschen
DELETE FROM customers 
WHERE name IN (
  'Max Mustermann',
  'Museum Lenzburg',
  'Atelier Schmid',
  'Privatkunde Lenz',
  'Antik Galerie Main',
  'Antikladen Wagner',
  'Schreinerei Hartmann',
  'Restauration Becker',
  'Oldtimer Frankfurt',
  'Motorradtechnik Kessler'
);

-- Dummy-Telefonnotizen und Anfragen löschen, die mock ids haben
DELETE FROM phone_notes WHERE customer_id LIKE 'inst_%' OR customer_id LIKE 'cust_%';
DELETE FROM inquiries WHERE id LIKE 'inq_%';

