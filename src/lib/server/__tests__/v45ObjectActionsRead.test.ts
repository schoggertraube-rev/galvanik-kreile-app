import {it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {readV45ObjectActionAbsence} from '../v45ObjectActionsRead';

it.each(['draft','sent','accepted','conditional','expired','goods_blocked'])('reads the proven empty quote alternative list for %s',state=>{
 expect(readV45ObjectActionAbsence('kv',state)).toMatchObject({code:'OK',weitere:[]});
});
it('never invents an empty list for an absent state',()=>{
 expect(readV45ObjectActionAbsence('kv','missing-state')).toEqual({code:'SOURCE_INCOMPLETE',missing:['OBJECT_ACTION_CONTEXT']});
});
