-- F0-06 Härtung: security_invoker=on für Views.
-- KORRIGIERT 2026-08-07: Frühere Annahme „alle 17 off" war falsch (Query-Fehler: =on vs =true).
-- Ist-Stand Prod: 16 Views bereits security_invoker=true; **nur v_auftrag_db** ist offen.
-- Nötig ist daher exakt EINE Änderung. Idempotent.
-- Status: ANGEWENDET auf Prod 2026-08-07 (f0_06_storage_view_hardening, mit Freigabe).

alter view public.v_auftrag_db set (security_invoker = on);
