// @vitest-environment node
// Controlled counters test only the E0 diagnostic contract, not app performance.
import {afterEach,expect,it,vi} from 'vitest';
import {logPageReadPhase,withPageReadPhase} from '../readBudget';
afterEach(()=>vi.restoreAllMocks());
it.each(['auth.candidates','auth.tx','auth.bcrypt','auth.last_seen','today.model.read','today.model.compose','today.refresh','rsc.bytes'])('records E0 phase %s exactly once without serializing its result',async phase=>{
 const output=vi.spyOn(console,'info').mockImplementation(()=>{});
 const result={code:'OK',privateValue:'TEST must never enter diagnostics'};
 const work=vi.fn(async()=>result);
 expect(await withPageReadPhase(phase,work)).toBe(result);
 expect(work).toHaveBeenCalledOnce();expect(output).toHaveBeenCalledOnce();
 expect(output.mock.calls[0][0]).toBe('[PAGE_READ_PHASE]');
 expect(JSON.parse(String(output.mock.calls[0][1]))).toMatchObject({phase,durationMs:expect.any(Number),counts:{ok:1,failed:0}});
 expect(JSON.stringify(output.mock.calls)).not.toContain(result.privateValue);
});
it('keeps the original work result and error when the diagnostic sink fails',async()=>{
 const output=vi.spyOn(console,'info').mockImplementation(()=>{throw Error('TEST sink unavailable');});
 const failure=vi.spyOn(console,'error').mockImplementation(()=>{});
 const result={code:'OK'};expect(await withPageReadPhase('auth.tx',()=>result)).toBe(result);
 const error=new Error('TEST original failure');await expect(withPageReadPhase('auth.tx',()=>{throw error;})).rejects.toBe(error);
 expect(output).toHaveBeenCalledTimes(2);expect(failure.mock.calls).toEqual([['[PAGE_READ_DIAGNOSTIC_FAILED]'],['[PAGE_READ_DIAGNOSTIC_FAILED]']]);
});
it('records only the measured RSC byte count, never a response body',()=>{
 const output=vi.spyOn(console,'info').mockImplementation(()=>{});
 logPageReadPhase('rsc.bytes',Date.now(),{bytes:1234});
 expect(JSON.parse(String(output.mock.calls[0][1]))).toMatchObject({phase:'rsc.bytes',counts:{bytes:1234}});
});
