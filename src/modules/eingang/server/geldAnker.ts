import 'server-only';
import {sql} from 'drizzle-orm';
import {foldSearchText} from '@/lib/domain/searchText';
import type {DocumentSuggestion} from '@/lib/server/azureDocumentIntelligence';

const geldFelder = [
  ['zahlung.skonto_prozent', /^(?:skonto prozent|skontosatz|skonto ?%)$/u],
  ['zahlung.skonto_bis', /^(?:skonto bis|skontofrist|skontodatum)$/u],
  ['zahlung.faellig_am', /^(?:faelligkeit|faellig am|zahlbar bis|payment due date|due date)$/u],
  ['zahlung.iban', /^(?:iban|empfaenger iban)$/u],
  ['zahlung.bedingungen', /^(?:zahlungsbedingungen|payment terms)$/u],
  ['avis.betrag', /^(?:zahlungs)?avis ?betrag$/u],
  ['avis.datum', /^(?:zahlungs)?avis ?datum$/u],
  ['avis.referenz', /^(?:zahlungs)?avis ?referenz$/u],
  ['quittung.datum', /^(?:quittungs? ?datum|bon ?datum|receipt date)$/u],
  ['quittung.aussteller', /^(?:quittungs? ?aussteller|receipt issuer)$/u],
  ['quittung.betrag', /^(?:quittungs? ?betrag|bon ?betrag|receipt amount)$/u],
  ['quittung.zweck', /^(?:ausgabezweck|quittungs? ?zweck|bewirtungsanlass)$/u],
  ['quittung.teilnehmer', /^(?:bewirtungs? ?teilnehmer|quittungs? ?teilnehmer)$/u],
] as const;

/** Uses labelled fields from the secured recognition result, without interpreting free text. */
export function leseGeldAnker(vorschlaege: readonly DocumentSuggestion[]) {
  return vorschlaege.flatMap(({label,value,confidence,source,field}) => {
    if (field === 'DOCUMENT_TEXT') return [];
    const bezeichnung = foldSearchText(label.normalize('NFC')).replace(/[^a-z0-9%]+/gu,' ').trim();
    const anker = geldFelder.find(([,muster]) => muster.test(bezeichnung));
    return anker ? [{field:anker[0],value,confidence,source}] : [];
  });
}

// These evidence fields have no editing or display command in the intake workflow.
export const ohneGeldAnker = sql`split_part(feld,'.',1) NOT IN ('zahlung','avis','quittung')`;
