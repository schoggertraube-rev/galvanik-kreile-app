import {describe,expect,it} from 'vitest';
import {calculateQuote,nextQuoteEdition,quoteAcceptanceIsCurrent} from '../quoteCalculation';

describe('AP-KV-V04 Server A: configured arithmetic and content edition',()=>{
 it('KV-03 uses the supplied settings snapshot exactly and never supplies absent monetary values',()=>{
  expect(calculateQuote({hours:'8',hourlyRateCents:7500,setupCents:1200,materialCents:900})).toEqual({code:'OK',totalNetCents:62100});
  expect(calculateQuote({hours:'1,3333',hourlyRateCents:5000,setupCents:0,materialCents:0})).toEqual({code:'OK',totalNetCents:6667});
  expect(calculateQuote({hours:'8',hourlyRateCents:null,setupCents:0,materialCents:0})).toMatchObject({code:'VALIDATION_ERROR',field:'hourlyRateCents',message:'Stundensatz fehlt'});
  expect(calculateQuote({hours:'8',hourlyRateCents:7500,setupCents:null,materialCents:0})).toMatchObject({code:'VALIDATION_ERROR',field:'setupCents'});
  expect(calculateQuote({hours:'8',hourlyRateCents:7500,setupCents:0,materialCents:null})).toMatchObject({code:'VALIDATION_ERROR',field:'materialCents'});
 });
 it('rejects invalid hours and values outside safe integer cents',()=>{
  expect(calculateQuote({hours:'-1',hourlyRateCents:7500,setupCents:0,materialCents:0}).code).toBe('VALIDATION_ERROR');
  expect(calculateQuote({hours:'1.12345',hourlyRateCents:7500,setupCents:0,materialCents:0}).code).toBe('VALIDATION_ERROR');
  expect(calculateQuote({hours:'2',hourlyRateCents:Number.MAX_SAFE_INTEGER,setupCents:0,materialCents:0})).toMatchObject({code:'VALIDATION_ERROR',field:'total'});
 });
 it('KV-04 keeps draft edits at edition one, then increments only content changes after a send',()=>{
  expect(nextQuoteEdition({edition:1,sentEdition:null},true)).toBe(1);
  expect(nextQuoteEdition({edition:1,sentEdition:1},false)).toBe(1);
  expect(nextQuoteEdition({edition:1,sentEdition:1},true)).toBe(2);
  expect(nextQuoteEdition({edition:2,sentEdition:1},true)).toBe(3);
 });
 it('KV-05 never accepts a previous edition or acceptance without its persisted evidence',()=>{
  const facts={edition:1,acceptedEdition:1,acceptedAt:'2026-11-07T18:00:00Z',acceptanceEvidence:'TEST telefonische Zusage'};
  expect(quoteAcceptanceIsCurrent(facts)).toBe(true);
  expect(quoteAcceptanceIsCurrent({...facts,edition:2})).toBe(false);
  expect(quoteAcceptanceIsCurrent({...facts,acceptanceEvidence:''})).toBe(false);
  expect(quoteAcceptanceIsCurrent({...facts,acceptedAt:null})).toBe(false);
 });
});
