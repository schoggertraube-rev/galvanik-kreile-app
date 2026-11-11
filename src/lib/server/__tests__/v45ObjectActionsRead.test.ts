import {it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {readV45ObjectActionAbsence} from '../v45ObjectActionsRead';

it.each(['draft','sent','accepted','conditional','expired','goods_blocked'])('reads the proven empty quote alternative list for %s',state=>{
 expect(readV45ObjectActionAbsence('kv',state)).toMatchObject({code:'OK',weitere:[]});
});
it('never invents an empty list for an absent state',()=>{
 expect(readV45ObjectActionAbsence('kv','missing-state')).toEqual({code:'SOURCE_INCOMPLETE',missing:['OBJECT_ACTION_CONTEXT']});
});

it('requires every captured customer context to agree on the shared empty alternative list',()=>{
 expect(readV45ObjectActionAbsence('kunde')).toMatchObject({code:'OK',weitere:[],quelle:{sha256:expect.stringMatching(/^[a-f0-9]{64}$/)}});
 expect(readV45ObjectActionAbsence('TEST-unknown-domain')).toMatchObject({code:'SOURCE_INCOMPLETE'});
});
