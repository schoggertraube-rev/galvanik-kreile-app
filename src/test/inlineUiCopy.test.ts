// @vitest-environment node
import {expect,it} from 'vitest';
import {ESLint} from 'eslint';
import {collectInlineCopy,findNewInlineCopy,isTextBaselineFile} from '../../scripts/quality/eslint-ui-copy-plugin.mjs';
import {assertBaselineShrinks} from '../../scripts/ui/check-copy-baseline.mjs';

it('finds real JSX copy, attributes, conditional branches and template fragments, never style/keys',()=>{
 const code='const X=()=> <div className="TEST-style" data-id="TEST-id" title="TEST Titel" alt={yes?"TEST Bild":"TEST Ersatz"} placeholder={`TEST ${value}`} aria-label={copy.label}>TEST Inhalt {yes?"TEST Ja":"TEST Nein"}{copy["TEST.key"]}</div>';
 expect(collectInlineCopy(code,'src/TEST.tsx').map((row:{text:string})=>row.text)).toEqual(['TEST Titel','TEST Bild','TEST Ersatz','TEST','TEST Inhalt','TEST Ja','TEST Nein']);
});
it('preserves existing text but blocks edits, extra occurrences and new-file copy',()=>{
 const code='<div>TEST Alt</div>';
 expect(findNewInlineCopy(code,'src/TEST.tsx',{'TEST Alt':1})).toEqual([]);
 expect(findNewInlineCopy('<div>TEST Neu</div>','src/TEST.tsx',{'TEST Alt':1})).toHaveLength(1);
 expect(findNewInlineCopy('<><div>TEST Alt</div><span>TEST Alt</span></>','src/TEST.tsx',{'TEST Alt':1})).toHaveLength(1);
 expect(findNewInlineCopy(code,'src/TEST.tsx',{})).toHaveLength(1);
});
it('allows only a shrinking frozen file and literal inventory',()=>{
 const old={files:{'src/TEST.tsx':{'TEST Alt':2}}};
 expect(()=>assertBaselineShrinks({files:{'src/TEST.tsx':{'TEST Alt':1}}},old)).not.toThrow();
 expect(()=>assertBaselineShrinks({files:{}},old)).not.toThrow();
 expect(()=>assertBaselineShrinks({files:{'src/TEST.tsx':{'TEST Alt':3}}},old)).toThrow('TEXT_ADDED');
 expect(()=>assertBaselineShrinks({files:{'src/OTHER.tsx':{'TEST Alt':1}}},old)).toThrow('FILE_ADDED');
 expect(()=>assertBaselineShrinks({files:{'src/TEST.tsx':{'TEST Neu':1}}},old)).toThrow('TEXT_ADDED');
});
it('excludes only tests/generated files and actually blocks a bad new component through normal ESLint',async()=>{
 expect(isTextBaselineFile('src/test/TEST.tsx')).toBe(false);
 expect(isTextBaselineFile('src/ui/generated/TEST.tsx')).toBe(false);
 expect(isTextBaselineFile('src/ui/TEST.tsx')).toBe(true);
 const eslint=new ESLint();
 const [bad]=await eslint.lintText('export default function Copy(){return <div title="TEST Titel">TEST Text</div>}',{filePath:'src/ui/S15SyntheticCopy.tsx'});
 expect(bad.messages.filter(row=>row.ruleId==='ui-copy/no-inline-copy')).toHaveLength(2);
 const [good]=await eslint.lintText('const copy={label:"TEST synthetic catalog value"}; export default function Copy(){return <div title={copy.label}>{copy.label}</div>}',{filePath:'src/ui/S15SyntheticCopy.tsx'});
 expect(good.messages.filter(row=>row.ruleId==='ui-copy/no-inline-copy')).toEqual([]);
});
