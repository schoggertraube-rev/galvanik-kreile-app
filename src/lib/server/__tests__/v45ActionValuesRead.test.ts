import {it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {readV45ActionValues} from '../v45ActionValuesRead';

it('selects only the actual source placeholders without copying unrelated values',()=>{
 expect(readV45ActionValues('quote.send',{number:'TEST-KV',name:'TEST Kunde',netCents:123456,token:'TEST not an app credential'})).toEqual({code:'OK',werte:{number:'TEST-KV',name:'TEST Kunde'}});
 expect(readV45ActionValues('quote.return_goods',{name:'TEST Kunde'})).toEqual({code:'OK',werte:{}});
});
it('keeps missing and empty values unknown instead of filling a label',()=>{
 expect(readV45ActionValues('quote.convert',{number:'TEST-KV'})).toEqual({code:'SOURCE_INCOMPLETE',missing:['location']});
 expect(readV45ActionValues('quote.convert',{number:'TEST-KV',location:''})).toEqual({code:'SOURCE_INCOMPLETE',missing:['location']});
 expect(readV45ActionValues('missing.text',{})).toEqual({code:'SOURCE_INCOMPLETE',missing:['ACTION_TEXT']});
});
