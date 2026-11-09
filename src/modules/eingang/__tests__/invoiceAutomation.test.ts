import {concernOptions} from '../concernMenuContract';
import type {IntakeMessage} from '../messageContract';
import {expect,it} from 'vitest';
import {invoiceAutomaticReadiness} from '../invoiceAutomation';
const fields={lieferantId:'TEST-supplier',nummer:'TEST-42',datum:'2026-11-08',netto:'100.00',ust:'19.00',brutto:'119.00',faelligAm:'2026-11-22',iban:'',ibanGeprueft:false};
const input={fields,originalSecured:true,supplierConfirmed:true,stored:false,duplicate:false,suggestions:[{feld:'rechnung.nummer',wert:fields.nummer,sicherheit:'sicher',verified:false},{feld:'rechnung.datum',wert:fields.datum,sicherheit:'sicher',verified:false},{feld:'rechnung.betrag',wert:{netto:'100,00',ust:'19,00',brutto:'119,00'},sicherheit:'sicher',verified:false}]};
it('requires every core field with matching persisted evidence, never absence of warnings',()=>{
 expect(invoiceAutomaticReadiness(input)).toEqual({state:'ready',missing:[]});
 expect(invoiceAutomaticReadiness({...input,suggestions:[]})).toMatchObject({state:'incomplete',missing:expect.arrayContaining(['Nummer nicht sicher erkannt','Datum nicht sicher erkannt','Beträge nicht sicher erkannt'])});
 expect(invoiceAutomaticReadiness({...input,originalSecured:false,supplierConfirmed:false})).toMatchObject({state:'incomplete',missing:expect.arrayContaining(['Gesichertes Original fehlt','Aussteller ist nicht eindeutig bestätigt'])});
});
it('refuses contradictory or uncertain extraction and non-balancing totals',()=>{
 expect(invoiceAutomaticReadiness({...input,suggestions:[...input.suggestions,{feld:'rechnung.nummer',wert:'TEST-OTHER',sicherheit:'sicher',verified:false}]})).toMatchObject({state:'incomplete',missing:expect.arrayContaining(['Nummer widersprüchlich erkannt'])});
 expect(invoiceAutomaticReadiness({...input,suggestions:input.suggestions.map(row=>({...row,sicherheit:'unsicher'}))})).toMatchObject({state:'incomplete'});
 expect(invoiceAutomaticReadiness({...input,fields:{...fields,brutto:'118.99'}})).toMatchObject({state:'incomplete',missing:expect.arrayContaining(['Netto + MwSt entspricht nicht Brutto'])});
});
it('reports stored or duplicate truth without suggesting a second booking',()=>{
 expect(invoiceAutomaticReadiness({...input,stored:true})).toEqual({state:'stored',missing:[]});
 expect(invoiceAutomaticReadiness({...input,duplicate:true})).toEqual({state:'duplicate',missing:[]});
});

it('uses the shared direct invoice target with the actual reader number and never invents a missing number',()=>{
 const row={customerType:'lieferant',concerns:['rechnung'],openConcerns:['rechnung'],orderKind:null,orderId:null,invoiceNumber:'TEST-BA-42'} as IntakeMessage;
 expect(concernOptions(row,['geld']).find(value=>value.id==='rechnungein')).toMatchObject({text:'Rechnung TEST-BA-42 ablegen',target:'rechnungein',reason:null});
 expect(concernOptions({...row,invoiceNumber:null},['geld']).find(value=>value.id==='rechnungein')).toMatchObject({text:'Rechnung ablegen'});
});
