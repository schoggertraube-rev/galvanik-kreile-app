import {expect,it} from 'vitest';
import {erlaubteWirkung,type MailAnliegen,type MailWirkung} from '../mailWirkungen';
import {planeMailWirkungen} from '../mailPlaene';
import {MAIL_PROMISE_COPY} from '@/ui/eingangMailCopy';

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
  ['A11','anschrift_vormerken','kundenstammdaten_aendern'],
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
  ['A9b','lieferanschrift_abgleichen','abholung_bestaetigen'],
  ['A24','gemeinsame_antwort_senden','ein_anliegen_uebergehen'],
  ['A25','anhang_zuordnen','anhaenge_ohne_bezug_ablegen'],
  ['A26','neues_anliegen_mit_bezug','alten_vorgang_oeffnen'],
  ['A27','rueckfrage_senden','kunde_ohne_dublette_anlegen'],
  ['A28','rueckruf_hinterlegter_kontakt','kontakt_nennen'],
  ['A29','bankverbindung_telefonisch_bestaetigen','bankverbindung_aendern'],
  ['A30','rueckruf_kontakt','mailadresse_raten'],
];

it.each(vertrag)('%s permits the office effect %s and excludes %s',(anliegen,erlaubt,verboten)=>{
  const belegt={preisquelle:true,reklamation:true,dokumentVorhanden:true,belegDublette:false,
    kundeOderLieferant:false,versandAenderbar:true,zuordnungBestaetigt:true};
  expect(erlaubteWirkung(anliegen,erlaubt,belegt)).toBe(true);
  expect(erlaubteWirkung(anliegen,verboten,belegt)).toBe(false);
});

it('keeps handover, cash collection and goods receipt out of self-pickup from mail',()=>{
  expect(planeMailWirkungen('A9',['versand_stoppen','uebergabeart_aendern','antwort_senden'],{versandAenderbar:true})).toEqual(
    ['versand_stoppen','uebergabeart_aendern','antwort_senden']);
  expect(planeMailWirkungen('A9',['versand_stoppen','uebergabeart_aendern','antwort_senden'],{versandAenderbar:false})).toEqual(
    ['antwort_senden']);
  for(const wirkung of ['recordGoodsOutAction','confirmPaymentAction','transitionWareneingangToGalvanikAction']){
    expect(erlaubteWirkung('A9',wirkung,{})).toBe(false);
  }
  expect(erlaubteWirkung('unbekannt','antwort_senden',{})).toBe(false);
  expect(erlaubteWirkung('__proto__','antwort_senden',{})).toBe(false);
});

it('does not plan an effect on a missing or negative business fact',()=>{
  expect(planeMailWirkungen('A1',['kunde_ohne_dublette_anlegen'],{dublette:true})).toEqual([]);
  expect(planeMailWirkungen('A1',['kunde_ohne_dublette_anlegen'],{dublette:false})).toEqual(['kunde_ohne_dublette_anlegen']);
  expect(planeMailWirkungen('A4',['auftrag_mit_preisquelle_anlegen','kv_entwurf_anlegen'],{})).toEqual(['kv_entwurf_anlegen']);
  expect(planeMailWirkungen('A12',['mahnstopp_vormerken'],{offeneRechnung:false})).toEqual([]);
  expect(planeMailWirkungen('A14',['mahnstopp_vormerken'],{offeneRechnung:true})).toEqual(['mahnstopp_vormerken']);
  expect(planeMailWirkungen('A13',['ruecksendung_erwarten'],{})).toEqual([]);
  expect(planeMailWirkungen('A19',['ab_an_bestellung_ablegen'],{belegDublette:true})).toEqual([]);
  expect(planeMailWirkungen('A9b',['versandpauschale_nennen'],{})).toEqual([]);
  expect(planeMailWirkungen('A9b',['versandpauschale_nennen'],{preisrecht:true})).toEqual(['versandpauschale_nennen']);
});

it('plans an interim reply and a workshop follow-up until the document is available',()=>{
  const requested=['zwischenantwort_mit_frist','aufgabe_werkstatt','vorhandenes_dokument_senden'] as const;
  expect(planeMailWirkungen('A17',requested,{dokumentVorhanden:false,antwortfristVorhanden:true})).toEqual(
    ['zwischenantwort_mit_frist','aufgabe_werkstatt']);
  expect(planeMailWirkungen('A17',requested,{dokumentVorhanden:false})).toEqual(['aufgabe_werkstatt']);
  expect(planeMailWirkungen('A17',requested,{dokumentVorhanden:true})).toEqual(['vorhandenes_dokument_senden']);
});

it.each([
  ['pickup','vorkasse','Abholung erst nach Zahlungseingang 10 €.' ],
  ['shipping','vorkasse','Versand nach Zahlung 10 €.' ],
  ['pickup','abholung','Bei Abholung 10 € kassieren.' ],
  ['shipping','abholung','Versand nach Zahlung 10 €.' ],
] as const)('shows the actual payment method for %s, %s',(handover,mode,expected)=>{
  expect(MAIL_PROMISE_COPY.prepayment('10 €',handover,mode)).toBe(expected);
});
