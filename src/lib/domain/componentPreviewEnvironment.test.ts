import {expect,it} from 'vitest';
import {componentPreviewEnvironmentAllowed as allowed} from './componentPreviewEnvironment';
it('denies production, absent configuration and any local server attached to an unapproved database',()=>{
 const own='postgresql://TEST:TEST@127.0.0.1:54342/postgres';
 expect(allowed({deployment:'production',node:'development',database:own})).toBe(false);
 expect(allowed({deployment:undefined,node:'production',database:own})).toBe(false);
 expect(allowed({deployment:undefined,node:'development',database:undefined})).toBe(false);
 expect(allowed({deployment:undefined,node:'development',database:'postgresql://TEST:TEST@remote.invalid/postgres'})).toBe(false);
 expect(allowed({deployment:undefined,node:'development',database:own.replace('54342','54322')})).toBe(false);
 expect(allowed({deployment:undefined,node:'development',database:'not-a-URL'})).toBe(false);
 expect(allowed({deployment:undefined,node:'development',database:own})).toBe(true);
 expect(allowed({deployment:'preview',node:'production',database:undefined})).toBe(true);
});
