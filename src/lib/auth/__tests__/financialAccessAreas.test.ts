import {describe,expect,it} from 'vitest';
import {
 ACCESS_AREAS,ACCESS_AREA_LABELS,ROLE_ACCESS_AREA_TEMPLATES,
 canAssignIntakeCustomer,canTransportInvoiceDocument,getPermissionsForAreas,
 hasAuthorizationArea,normalizeAccessAreasForRole,type AccessArea,
} from '../authorizationContract';
import {getAuthorizationActionGrants} from "@/lib/auth/authorizationContract";

// Explicitly synthetic effective-right snapshots exercise the one pure contract.
// Real persisted-right/Action/DB cases are covered separately by the step matrix.
const profile=(areas:readonly AccessArea[])=>({role:'werkstatt' as const,areas});
const financial:readonly AccessArea[]=['preise','zahlungen','buchhaltung'];
describe('KORR-RECHTE-GELD independent financial scopes',()=>{
 it('keeps the existing operational areas and all three distinct financial checkboxes',()=>{
  expect(ACCESS_AREAS).toEqual(['auftraege','lager.stamm','eingang','kunden','preise','zahlungen','buchhaltung','kassieren','mails','entscheiden','einstellungen','logins','wartung','statistik_alle','protokoll']);
  expect(ACCESS_AREA_LABELS.preise).toEqual({text:'Preise & Rechnungen',sub:'Preise in KV, Auftrag und Rechnung; Rechnung ausstellen und senden'});
  expect(ACCESS_AREA_LABELS.zahlungen).toEqual({text:'Zahlungen & Mahnungen',sub:'Zahlungen buchen, offene Posten, Mahnung, Storno, Guthaben'});
  expect(ACCESS_AREA_LABELS.buchhaltung).toEqual({text:'Buchhaltung & Zahlen',sub:'Eingangsrechnungen, Buchhaltung, Kontostand, Auswertungen, Export'});
 });
 it('grants price visibility only to prices and export only to bookkeeping',()=>{
  expect(getPermissionsForAreas(['preise'])).toEqual(['perm_view_prices']);
  expect(getPermissionsForAreas(['zahlungen'])).toEqual([]);
  expect(getPermissionsForAreas(['buchhaltung'])).toEqual(['perm_data_csv']);
 });
 it('keeps office bookkeeping opt-in and blocks all business grants for a developer',()=>{
  for(const area of financial){expect(ROLE_ACCESS_AREA_TEMPLATES.meister).toContain(area);expect(ROLE_ACCESS_AREA_TEMPLATES.admin).toContain(area);expect(hasAuthorizationArea({role:'developer',areas:[area]},area)).toBe(false);}
  expect(ROLE_ACCESS_AREA_TEMPLATES.buero).toContain('preise');expect(ROLE_ACCESS_AREA_TEMPLATES.buero).toContain('zahlungen');expect(ROLE_ACCESS_AREA_TEMPLATES.buero).not.toContain('buchhaltung');
  expect(normalizeAccessAreasForRole('developer',financial)).toEqual([]);
  expect(ROLE_ACCESS_AREA_TEMPLATES.werkstatt).toEqual(['auftraege','eingang','kunden']);
 });
 it('separates issuing prices from payments while retaining the existing pickup cashier grant',()=>{
  expect(getAuthorizationActionGrants(profile(['eingang','preise']))).toMatchObject({createQuote:true,confirmPayment:false});
  expect(getAuthorizationActionGrants(profile(['zahlungen']))).toMatchObject({createQuote:false,confirmPayment:true});
  expect(getAuthorizationActionGrants(profile(['buchhaltung']))).toMatchObject({createQuote:false,confirmPayment:false});
  expect(getAuthorizationActionGrants(profile(['auftraege','kassieren']))).toMatchObject({confirmPayment:true});
  expect(getAuthorizationActionGrants(profile(['kassieren']))).toMatchObject({confirmPayment:false});
 });
 it('uses prices for invoice transport and intake plus customers for assignment',()=>{
  expect(canTransportInvoiceDocument(profile(['preise']))).toBe(true);
  expect(canTransportInvoiceDocument(profile(['zahlungen']))).toBe(false);
  expect(canTransportInvoiceDocument(profile(['buchhaltung']))).toBe(false);
  expect(canAssignIntakeCustomer(profile(['eingang','kunden']))).toBe(true);
  expect(canAssignIntakeCustomer(profile(['eingang','preise']))).toBe(false);
  expect(canAssignIntakeCustomer(profile(['eingang','zahlungen']))).toBe(false);
  expect(canAssignIntakeCustomer(profile(['kunden']))).toBe(false);
 });
});
