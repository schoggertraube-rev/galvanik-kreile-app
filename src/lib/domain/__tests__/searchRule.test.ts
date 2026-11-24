import {describe,expect,it} from 'vitest';
import {foldSearchText,foldedIncludes,nameSearchAlternative} from '../searchText';
import {searchFoldCases} from './searchFoldCases';
import {readdirSync,readFileSync,existsSync} from 'node:fs';
import {join,relative} from 'node:path';

describe('one German search rule',()=>{
 it.each(searchFoldCases)('folds %s to %s',(input,expected)=>expect(foldSearchText(input)).toBe(expected));
 it('keeps spelling alternatives separate from folding',()=>{
  expect(foldSearchText('Muller')).not.toBe(foldSearchText('Müller'));
  expect(nameSearchAlternative('TEST Müller','Muller')).not.toBeNull();
  expect(foldedIncludes('TEST Müller','Mueller')).toBe(true);
  expect(foldedIncludes(null,'Mueller')).toBe(false);
 });
});

it('keeps all live browser searches on the shared rule',()=>{
 const root=join(process.cwd(),'src');
 const expected=new Map([
  ['src/app/kommunikation/smartMatcher.ts',4],
  ['src/components/kommunikation/kommandozentrale/Kommandozentrale.tsx',2],
  ['src/app/buchhaltung/analysis.actions.ts',1],
  ['src/modules/eingang/GlobalCreateFlow.tsx',1],
 ]);
 const forbidden=[/ilike\(/,/\.ilike\./,/ILIKE/,/\.textSearch\(/,/rpc\('search_global'/,/toLowerCase\(\)\.includes\(/,/toLocaleLowerCase\([^)]*\)\.includes\(/];
 const seen=new Map<string,number>();
 const walk=(dir:string):void=>{
  for(const entry of readdirSync(dir,{withFileTypes:true})){
   if(entry.isDirectory()){
    if(entry.name!=='__tests__'&&!(dir===join(root,'ui')&&entry.name==='generated'))walk(join(dir,entry.name));
    continue;
   }
   if(!entry.isFile()||![/\.tsx?$/].some(pattern=>pattern.test(entry.name))||/\.test\.|\.spec\./.test(entry.name))continue;
   const path=join(dir,entry.name),name=relative(process.cwd(),path).replaceAll('\\','/');
   const lines=readFileSync(path,'utf8').split(/\r?\n/u);
   const count=lines.filter(line=>forbidden.some(pattern=>pattern.test(line))).length;
   if(count)seen.set(name,count);
  }
 };
 walk(root);
 for(const [name,count] of seen)expect(count,`extra search expression in ${name}`).toBeLessThanOrEqual(expected.get(name)??0);
 for(const path of ['src/lib/search/globalSearch.ts','src/features/analyse/hooks/useGlobalSearch.ts','src/lib/search/fuzzy.ts','src/components/galvanik/GalvanikQueue.tsx','src/lib/buchhaltung/providers/MockBuchhaltungProvider.ts'])expect(existsSync(path),path).toBe(false);
 for(const path of ['src/app/customers/CustomersAppAdapter.tsx','src/app/orders/OrdersAppAdapter.tsx','src/modules/quotes/ui/QuoteReplyPicker.tsx','src/modules/complaints/ui/ComplaintDialogs.tsx','src/app/actions/search.providers.ts']){
  const source=readFileSync(path,'utf8');
  expect(source,path).toMatch(/foldedIncludes|foldSearchText/u);
  const lower=(source.match(/toLocaleLowerCase\(|toLowerCase\(/gu)??[]).length;
  expect(lower,path).toBeLessThanOrEqual(path.includes('OrdersAppAdapter')?2:0);
 }
});
