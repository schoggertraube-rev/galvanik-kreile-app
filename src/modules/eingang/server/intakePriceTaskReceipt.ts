import 'server-only';
import {sql} from 'drizzle-orm';

/** Qualify the same immutable receipt for a message row and for a direct read. */
export function priceTaskReceipt(alias:'source'|'candidate'){
 const row=sql.identifier(alias);
 return sql`SELECT beleg.id,beleg.nachher->>'text' AS text
   FROM public.intake_event beleg
   WHERE beleg.tenant_id=${row}.tenant_id AND beleg.item_id=${row}.id
    AND beleg.art='einsatz' AND beleg.befehl_id=${row}.id
    AND beleg.nachher->>'fuerBereich'='preise' AND beleg.nachher->>'bezugTyp'='lagerartikel'
    AND beleg.nachher->>'action' IN ('aufgabe.angelegt','aufgabe.erledigt','aufgabe.geaendert')`;
}
