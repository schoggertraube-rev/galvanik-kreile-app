import {describe,expect,it} from 'vitest';
import {taskValidation,validTaskReference} from './contract';

const artikelId='TEST-lager-artikel';
const common={clientKey:'6692ae40-30bb-4f41-a219-b71e857d6b99',version:0,kind:'aufgabe',
 title:'Bestand von TEST Artikel klären',dueDate:'2026-11-25',time:null,forLogin:null,
 forArea:'lager.stamm',reference:{type:'lagerbestand',id:artikelId},note:null};

describe('Bestandsklärung bleibt ein eigener Aufgabenbezug',()=>{
 it('nimmt den qualifizierten Lagerbezug im Aufgabenvertrag an',()=>{
  expect(validTaskReference(common.reference)).toBe(true);
  expect(taskValidation(common)).toEqual({});
 });
 it('verwirft einen fehlenden Artikelbezug und zusätzliche Referenzfelder',()=>{
  expect(validTaskReference({type:'lagerbestand',id:null})).toBe(false);
  expect(validTaskReference({type:'lagerbestand',id:artikelId,negativ:true})).toBe(false);
 });
});
