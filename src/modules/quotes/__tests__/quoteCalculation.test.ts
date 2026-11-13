import {describe,expect,it} from 'vitest';
import {calculateQuote,scaleQuoteCalculation,scaleQuotePositions,nextQuoteEdition,quoteAcceptanceIsCurrent} from '../quoteCalculation';

it('scales a unitless quote position on partial goods and distributes legacy total minutes by net value',()=>{
 const calculation={hours:'1.0000',hourlyRateCents:10000,setupCents:0,materialCents:0};
 const result=scaleQuotePositions(calculation,[{position:1,quantity:4,lineTotalCents:7500,unit:null,plannedMinutes:null},{position:2,quantity:2,lineTotalCents:2500,unit:'stueck',plannedMinutes:null}],[{position:1,quantity:2},{position:2,quantity:2}]);
 expect(result).toMatchObject({code:'OK',totalNetCents:6250,positions:[{position:1,lineTotalCents:3750,plannedMinutes:23},{position:2,lineTotalCents:2500,plannedMinutes:15}],legacyMinutesAllocated:true});
});

it('assigns the remainder minute to the largest original net position and honors explicitly stored minutes',()=>{
 const source=[{position:1,quantity:1,lineTotalCents:100,unit:'stueck',plannedMinutes:null},{position:2,quantity:1,lineTotalCents:200,unit:'stueck',plannedMinutes:null}];
 expect(scaleQuotePositions({hours:'0.0833',hourlyRateCents:3600,setupCents:0,materialCents:0},source,[{position:1,quantity:1},{position:2,quantity:1}])).toMatchObject({code:'OK',positions:[{plannedMinutes:1},{plannedMinutes:4}]});
 expect(scaleQuotePositions(null,[{...source[0],quantity:4,plannedMinutes:80}],[{position:1,quantity:1}])).toMatchObject({code:'OK',positions:[{plannedMinutes:20}],legacyMinutesAllocated:false});
});

describe('AP-KV-V04 Server A: configured arithmetic and content edition',()=>{
 it('scales time only and keeps hourly, setup and material approaches unchanged',()=>{
  const original={hours:'8',hourlyRateCents:7500,setupCents:1200,materialCents:900};
  expect(scaleQuoteCalculation(original,4,3)).toEqual({code:'OK',calculation:{hours:'6.0000',hourlyRateCents:7500,setupCents:1200,materialCents:900}});
  expect(scaleQuoteCalculation(original,4,5)).toMatchObject({code:'OK',calculation:{hours:'10.0000',setupCents:1200,materialCents:900}});
  expect(original).toEqual({hours:'8',hourlyRateCents:7500,setupCents:1200,materialCents:900});
 });
 it('rounds decimal hours without scaling display-only approaches or supplying missing values',()=>{
  expect(scaleQuoteCalculation({hours:'1',hourlyRateCents:7500,setupCents:1200,materialCents:100},3,1)).toMatchObject({code:'OK',calculation:{hours:'0.3333',setupCents:1200,materialCents:100}});
  expect(scaleQuoteCalculation({hours:'1',hourlyRateCents:7500,setupCents:null,materialCents:100},3,1)).toMatchObject({code:'VALIDATION_ERROR',field:'setupCents'});
  expect(scaleQuoteCalculation({hours:'1',hourlyRateCents:7500,setupCents:1200,materialCents:100},0,1).code).toBe('VALIDATION_ERROR');
 });
 it('scales only agreed line totals, handles omitted parts and never invents mixed-factor hours',()=>{
  const calculation={hours:'4',hourlyRateCents:1000,setupCents:1200,materialCents:800};
  const source=[{position:1,quantity:4,lineTotalCents:4000},{position:2,quantity:4,lineTotalCents:2000}];
  expect(scaleQuotePositions(calculation,source,[{position:1,quantity:3},{position:2,quantity:4}])).toEqual({code:'OK',totalNetCents:5000,calculation:null,positions:[{position:1,quantity:3,lineTotalCents:3000},{position:2,quantity:4,lineTotalCents:2000}]});
  expect(scaleQuotePositions(calculation,source,[{position:1,quantity:3},{position:2,quantity:3}])).toMatchObject({code:'OK',totalNetCents:4500,calculation:{hours:'3.0000',setupCents:1200,materialCents:800}});
  expect(scaleQuotePositions(calculation,source,[{position:1,quantity:3},{position:2,quantity:0}])).toEqual({code:'OK',totalNetCents:3000,calculation:null,positions:[{position:1,quantity:3,lineTotalCents:3000}]});
 });
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

it('legacy lines and calculated lines share the canonical quantity scaler without invented setup',()=>{
 expect(scaleQuotePositions(null,[{position:1,quantity:4,lineTotalCents:4000}],[{position:1,quantity:3}])).toMatchObject({code:'OK',totalNetCents:3000,calculation:null,positions:[{position:1,quantity:3,lineTotalCents:3000}]});
 expect(scaleQuotePositions(null,[{position:1,quantity:3,lineTotalCents:1000}],[{position:1,quantity:1}])).toMatchObject({code:'OK',totalNetCents:333});
 expect(scaleQuotePositions(null,[{position:1,quantity:4,lineTotalCents:4000}],[{position:1,quantity:0}])).toMatchObject({code:'VALIDATION_ERROR'});
});
