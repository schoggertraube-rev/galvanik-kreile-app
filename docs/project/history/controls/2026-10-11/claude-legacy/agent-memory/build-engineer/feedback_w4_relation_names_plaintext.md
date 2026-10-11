---
name: w4-relation-names-plaintext
description: W4-Read-Port-Gate matcht Relationsnamen als Volltext inkl. Kommentaren; Auto-Discovery gilt nur fuer `private.v_*`, `public.v_*` ist Opt-in - deshalb ist Gruen dort kein Beweis.
metadata:
  type: feedback
---

In `src`-Produktionsdateien niemals einen schemaqualifizierten Relationsnamen (`public.v_...`, `private.v_...`) im Kommentartext erwaehnen, wenn die Datei kein deklarierter Read-Port ist. Ohne Schema-Praefix (`v_order_timeliness_orders_v1`) ist derselbe Kommentar erlaubt.

**Why:** `scripts/quality/check-w4-cross-module-read-ports.mjs` liest jede `.ts/.tsx` als String und prueft `containsRelation()` = `(?<![A-Za-z0-9_])<relation>(?![A-Za-z0-9_])` gegen den GESAMTEN Dateiinhalt. Es gibt kein Parsen, kein Strippen von Kommentaren. Die Inventar-Keys in `docs/evidence/f0/W4_CROSS_MODULE_READ_PORT_INVENTORY.json` sind voll qualifiziert, deshalb greift der Match nur beim Praefix. Am 2026-09-28 hat das in B2 eine reine Domaenendatei (`src/modules/orders/domain/orderTimelinessFacts.ts`) als `undeclared view port` rot gemacht, obwohl sie nie liest.

**Asymmetrie `private` vs. `public` (2026-09-28 belegt):** Die Auto-Discovery unregistrierter Views ist im Skript auf ein Schema festgenagelt: `content.match(/private\.v_[a-z0-9_]+/g)`. `knownViews` entsteht ausschliesslich aus dem Inventar selbst. Folge: ein `public.v_*`-Cross-Modul-View wird nur bewacht, wenn er freiwillig eingetragen ist. Traegt man ihn ein, erzwingt das Gate sofort Exklusivitaet (`undeclared view port` in jeder anderen Datei); nimmt man den Eintrag wieder heraus, bleibt das Gate GRUEN und verliert dabei still auch die `migrationContracts`-Zusicherung `CREATE VIEW ... WITH (security_invoker = true)` fuer diesen View. `W4_READ_PORT_CONTRACT=PASS` ist fuer `public.v_*` also kein Abdeckungsbeweis, sondern nur die Aussage "nichts Registriertes verletzt".

**How to apply:** Beim Dokumentieren, woher eine Spalte kommt, den View ohne Schema nennen. Wenn ein Review den Rueckbau eines `public.v_*`-Eintrags fordert, das PASS nicht als Entwarnung melden, sondern den Verlust der `security_invoker`-Pruefung als offenen, separat zu autorisierenden Punkt benennen. Bei `undeclared view port` in einer Datei ohne SQL zuerst nach dem Namen greppen und pruefen, ob der Treffer in einem Kommentar sitzt - nicht das Inventar erweitern, das waere eine echte Vertragsaenderung. Der Gegencheck ist `node scripts/quality/check-w4-cross-module-read-ports.mjs --check`; siehe auch [[f0-review-manifest-frozen]].
