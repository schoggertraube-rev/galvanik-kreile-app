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
