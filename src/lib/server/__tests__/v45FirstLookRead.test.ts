import {it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {readV45FirstLook} from '../v45FirstLookRead';

// Explicit synthetic domain values; layout and order are the actual V45 source.
const values={'kv.lage':{nummer:'TEST-KV'},'kv.teile':{teile:['TEST Teil']},'kv.termin':{datum:'2027-05-15'},'kv.kalkulation':{nettoCents:12345},'kv.hauptaktion':{elementId:'quote.send'}};
it('derives the five quote fields in source order without copying example content',()=>{
 const result=readV45FirstLook('kv',values);expect(result.code).toBe('OK');if(result.code!=='OK')throw Error('TEST_SOURCE_LAYOUT');
 expect(result.erstblick.map(row=>row.key)).toEqual(['kv.lage','kv.teile','kv.termin','kv.kalkulation','kv.hauptaktion']);
 expect(result.erstblick[0].werte).toEqual({nummer:'TEST-KV'});
});
it('projects only the explicitly hidden financial field out of the same source order',()=>{
 const result=readV45FirstLook('kv',values,['kv.kalkulation']);expect(result.code).toBe('OK');if(result.code!=='OK')throw Error('TEST_SOURCE_LAYOUT');
 expect(result.erstblick.map(row=>row.key)).toEqual(['kv.lage','kv.teile','kv.termin','kv.hauptaktion']);expect(JSON.stringify(result)).not.toContain('12345');
});
it('never falls back to the shorter layout when a visible domain fact is missing',()=>{
 const {['kv.termin']:omitted,...incomplete}=values;expect(omitted).toBeDefined();
 expect(readV45FirstLook('kv',incomplete)).toEqual({code:'SOURCE_INCOMPLETE',missing:['kv.termin']});
 expect(readV45FirstLook('missing',values)).toMatchObject({code:'SOURCE_INCOMPLETE'});
});

it('reads a closed order profile from source without fields from other states',()=>{
 const order={'auftrag.lage':{station:'abgeholt'},'auftrag.termin':{datum:null},'auftrag.teile':{teile:[]},'auftrag.hauptaktion':{elementId:null}};
 const result=readV45FirstLook('auftrag',order,[],'closed');
 expect(result.code).toBe('OK');if(result.code!=='OK')throw Error('TEST_SOURCE_LAYOUT');
 expect(result.erstblick.map(row=>row.key)).toEqual(['auftrag.lage','auftrag.termin','auftrag.teile','auftrag.hauptaktion']);
 expect(readV45FirstLook('auftrag',order,[],'invoice')).toMatchObject({code:'SOURCE_INCOMPLETE'});
 expect(readV45FirstLook('auftrag',order,[],'TEST_UNKNOWN')).toMatchObject({code:'SOURCE_INCOMPLETE',missing:['FIRST_LOOK_CONTEXT']});
});
it('uses the same source-bound quote state without changing its field order',()=>{
 const result=readV45FirstLook('kv',values,[],'draft');
 expect(result.code).toBe('OK');if(result.code!=='OK')throw Error('TEST_SOURCE_LAYOUT');
 expect(result.erstblick.map(row=>row.key)).toEqual(Object.keys(values));
});

it('keeps a declared field unknown when its supplied value is null',()=>{
 const incomplete={...values,'kv.termin':null} as unknown as Parameters<typeof readV45FirstLook>[1];
 expect(readV45FirstLook('kv',incomplete)).toMatchObject({code:'SOURCE_INCOMPLETE',missing:['kv.termin']});
});
