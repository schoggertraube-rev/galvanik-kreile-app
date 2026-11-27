import 'server-only';

/** MAIL_PROZESSLOGIK §2, einschließlich der bedingten Folgeschritte. */
const mailWirkungen={
  A1:['kunde_ohne_dublette_anlegen','kv_entwurf_anlegen','kv_anhang_ablegen','antwort_senden'],
  A2:['kv_zusage_ablegen','auftrag_aus_kv_anlegen','auftragsbestaetigung_senden'],
  A3:['kv_absage_ablegen','kv_neufassung_entwerfen','antwort_senden'],
  A4:['auftrag_mit_preisquelle_anlegen','kv_entwurf_anlegen','auftragsbestaetigung_senden'],
  A5:['lieferavis_vormerken','lieferschein_am_auftrag_ablegen','antwort_senden'],
  A6:['anhang_ablegen','zeichnung_fassung_ablegen','kv_neufassung_vorschlagen','rueckfrage_senden','antwort_senden'],
  A7:['mengenwunsch_vormerken','aufgabe_buero','antwort_senden'],
  A8:['wunschtermin_vormerken','antwort_senden'],
  A9:['versand_stoppen','uebergabeart_aendern','abholtermin_vormerken','aufgabe_versand','antwort_senden'],
  A9b:['uebergabeart_aendern','lieferanschrift_abgleichen','versandpauschale_nennen','antwort_senden'],
  A10:['abholer_vormerken','aufgabe_ausgang','antwort_senden'],
  A11:['anschrift_vormerken','stammdaten_bestaetigung_anfordern','aufgabe_versand_anschrift','antwort_senden'],
  A12:['reklamation_aufnehmen','mahnstopp_vormerken','antwort_senden'],
  A13:['ruecksendung_erwarten','antwort_senden'],
  A14:['rechnungskopie_senden','zahlungsavis_vormerken','aufgabe_buchhaltung','mahnstopp_vormerken','antwort_senden'],
  A15:['stornowunsch_vormerken','aufgabe_buero','antwort_senden'],
  A16:['antwort_senden','stand_bei_werkstatt_anfordern'],
  A17:['vorhandenes_dokument_senden','zwischenantwort_mit_frist','aufgabe_werkstatt'],
  A18:['antwort_am_anliegen_ablegen','mehrarbeitsfreigabe_vormerken','antwort_senden'],
  A19:['rechnung_im_belegzugang_ablegen','lieferschein_an_bestellung_ablegen','ab_an_bestellung_ablegen','aufgabe_einkauf'],
  A20:['spedition_einzeltermin_verlegen','betroffene_pakete_markieren'],
  A21:['auf_kundenantwort_warten','wiedervorlage_vor_annahmeschluss'],
  A22:['ungebundene_mail_aussortieren'],
  A23:['auswahl_anzeigen','rueckfrage_senden'],
  A24:['anliegen_einzeln_bearbeiten','anliegen_begruendet_ablegen','gemeinsame_antwort_senden'],
  A25:['anhang_zuordnen','anliegen_zuordnen','rueckfrage_senden'],
  A26:['neues_anliegen_mit_bezug','gewaehrleistung_admin_vorlegen'],
  A27:['auswahl_anzeigen','rueckfrage_senden'],
  A28:['rueckruf_hinterlegter_kontakt','antwort_senden','rueckfrage_senden'],
  A29:['bankverbindung_telefonisch_bestaetigen'],
  A30:['rueckruf_kontakt','mailadresse_uebernehmen','original_erneut_senden'],
} as const;

export type MailAnliegen=keyof typeof mailWirkungen;
export type MailWirkung=typeof mailWirkungen[MailAnliegen][number];
export type MailWirkungsKontext={
  dublette?:boolean;
  belegDublette?:boolean;
  preisquelle?:boolean;
  preisrecht?:boolean;
  reklamation?:boolean;
  offeneRechnung?:boolean;
  dokumentVorhanden?:boolean;
  antwortfristVorhanden?:boolean;
  versandAenderbar?:boolean;
  zuordnungBestaetigt?:boolean;
  kundeOderLieferant?:boolean;
  neueMailadresseBestaetigt?:boolean;
};

export function erlaubteWirkung(anliegen:string,wirkung:string,kontext:MailWirkungsKontext):boolean{
  if(!Object.hasOwn(mailWirkungen,anliegen))return false;
  const erlaubt:readonly string[]=mailWirkungen[anliegen as MailAnliegen];
  if(!erlaubt.includes(wirkung))return false;
  switch(wirkung){
    case 'kunde_ohne_dublette_anlegen': return kontext.dublette===false;
    case 'auftrag_mit_preisquelle_anlegen': return kontext.preisquelle===true;
    case 'versandpauschale_nennen': return kontext.preisrecht===true;
    case 'ruecksendung_erwarten': return kontext.reklamation===true;
    case 'mahnstopp_vormerken': return kontext.offeneRechnung===true;
    case 'vorhandenes_dokument_senden': return kontext.dokumentVorhanden===true;
    case 'zwischenantwort_mit_frist': return kontext.dokumentVorhanden===false&&kontext.antwortfristVorhanden===true;
    case 'aufgabe_werkstatt': return kontext.dokumentVorhanden===false;
    case 'versand_stoppen':
    case 'uebergabeart_aendern': return kontext.versandAenderbar===true;
    case 'rechnung_im_belegzugang_ablegen':
    case 'lieferschein_an_bestellung_ablegen':
    case 'ab_an_bestellung_ablegen': return kontext.belegDublette===false;
    case 'anhang_zuordnen':
    case 'anliegen_zuordnen': return kontext.zuordnungBestaetigt===true;
    case 'ungebundene_mail_aussortieren': return kontext.kundeOderLieferant===false;
    case 'mailadresse_uebernehmen':
    case 'original_erneut_senden': return kontext.neueMailadresseBestaetigt===true;
    default: return true;
  }
}
