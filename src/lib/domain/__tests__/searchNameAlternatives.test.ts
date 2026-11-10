import {describe,expect,it} from 'vitest';
import {cologneSearchCode,nameSearchAlternative,alternativeNameInitialPattern} from '../searchText';

describe('German name evidence, without customer aliases or guessed records',()=>{
 it.each([
  ['Schmitt','862'],['Schmidt','862'],['Schmied','862'],
  ['Mayr','67'],['Maier','67'],['Müller-Lüdenscheidt','65752682'],
  ['Breschnew','17863'],['Xaver','4837'],['Heinz','068'],
 ])('encodes %s with the published Cologne rules', (name,code)=>expect(cologneSearchCode(name)).toBe(code));
 it('distinguishes phonetic evidence and one transposed spelling from unrelated names',()=>{
  expect(nameSearchAlternative('TEST Sabrina Schmidt','Schmitt')).toBe('phonetic');
  expect(nameSearchAlternative('TEST Maier Oberflächen AG','Mayr')).toBe('phonetic');
  expect(nameSearchAlternative('TEST Sabrina Schmidt','Schmdit')).toBe('spelling');
  expect(nameSearchAlternative('TEST Reiner Schmitt','Schmdit')).toBe('spelling');
  expect(nameSearchAlternative('TEST Schmied Metallbau GmbH','Schmdit')).toBe('spelling');
  expect(nameSearchAlternative('TEST Andere Firma','Schmitt')).toBeNull();
  expect(nameSearchAlternative('TEST Schmidt','gmbh')).toBeNull();
  expect(nameSearchAlternative('TEST Schmidt','1234')).toBeNull();
  expect(nameSearchAlternative('TEST Schmidt','Sch')).toBeNull();
  expect(alternativeNameInitialPattern('R-2026-0102')).toBeNull();
 });
});
