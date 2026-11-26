import {expect,it} from 'vitest';
import {erlaubteWirkung,type MailAnliegen,type MailWirkung} from '../mailWirkungen';

const vertrag:ReadonlyArray<readonly [MailAnliegen,MailWirkung,string]>=[
  ['A1','kv_entwurf_anlegen','offer_send'],
  ['A2','auftrag_aus_kv_anlegen','wareneingang_buchen'],
  ['A3','kv_absage_ablegen','kv_preis_ohne_recht_aendern'],
  ['A4','auftrag_mit_preisquelle_anlegen','auftrag_ohne_preisquelle_anlegen'],
  ['A5','lieferavis_vormerken','wareneingang_buchen'],
  ['A6','zeichnung_fassung_ablegen','alte_fassung_loeschen'],
  ['A7','mengenwunsch_vormerken','auftragsmenge_direkt_aendern'],
  ['A8','wunschtermin_vormerken','termin_ohne_kapazitaet_festlegen'],
  ['A9','abholtermin_vormerken','uebergabe_bestaetigen'],
  ['A10','abholer_vormerken','abholung_bestaetigen'],
  ['A11','auftragsadresse_vormerken','kundenstammdaten_aendern'],
  ['A12','reklamation_aufnehmen','nacharbeit_freigeben'],
  ['A13','ruecksendung_erwarten','wareneingang_buchen'],
  ['A14','zahlungsavis_vormerken','zahlung_bestaetigen'],
  ['A15','stornowunsch_vormerken','auftrag_stornieren'],
  ['A16','antwort_senden','auftragsdaten_aendern'],
  ['A17','vorhandenes_dokument_senden','dokument_erfinden'],
  ['A18','antwort_am_anliegen_ablegen','werkstattaufgabe_schliessen'],
  ['A19','lieferschein_an_bestellung_ablegen','rechnung_freigeben'],
  ['A20','spedition_einzeltermin_verlegen','kundenabholtermin_verlegen'],
  ['A21','auf_kundenantwort_warten','abholtermin_vormerken'],
  ['A22','ungebundene_mail_aussortieren','kundenmail_aussortieren'],
  ['A23','rueckfrage_senden','auftrag_automatisch_zuordnen'],
];

it.each(vertrag)('%s permits the office effect %s and excludes %s',(anliegen,erlaubt,verboten)=>{
  expect(erlaubteWirkung(anliegen,erlaubt)).toBe(true);
  expect(erlaubteWirkung(anliegen,verboten)).toBe(false);
});

it('keeps handover, cash collection and goods receipt out of self-pickup from mail',()=>{
  expect(erlaubteWirkung('A9','uebergabeart_vormerken')).toBe(true);
  expect(erlaubteWirkung('A9','antwort_senden')).toBe(true);
  for(const wirkung of ['recordGoodsOutAction','confirmPaymentAction','transitionWareneingangToGalvanikAction']){
    expect(erlaubteWirkung('A9',wirkung)).toBe(false);
  }
  expect(erlaubteWirkung('unbekannt','antwort_senden')).toBe(false);
  expect(erlaubteWirkung('__proto__','antwort_senden')).toBe(false);
});
