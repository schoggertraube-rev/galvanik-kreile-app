import 'server-only';
import {sql} from 'drizzle-orm';

/** Canonical open-intake qualification; callers retain their tenant and access predicates. */
export function openIntakePredicate(alias:'source'|'candidate'='source'){
 const row=sql.identifier(alias);
 return sql`${row}.aussortiert IS NULL AND ${row}.einsatz NOT IN ('erledigt','info') AND (${row}.einsatz='offen' OR ${row}.zuordnung='offen')`;
}
