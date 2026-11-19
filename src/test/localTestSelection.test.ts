// @vitest-environment node
// R27 selection contract. Real repository files, no test-runner/CI bypass mocks.
import {expect,it} from 'vitest';
import {selectLocalTestFiles,buildTestArguments} from '../../scripts/test-staged-related.mjs';
const file='src/test/localTestSelection.test.ts';
const options={root:process.cwd(),tracked:new Set([file])};
it('keeps the default related-test contract when no local list is supplied, including in CI',()=>{
 expect(selectLocalTestFiles(undefined,{...options,ci:true})).toBeUndefined();
 expect(buildTestArguments(['src/lib/domain/invoiceCollectionContract.ts'],undefined)).toEqual(['related','--run','src/lib/domain/invoiceCollectionContract.ts','--passWithNoTests','--exclude','**/*.integration.test.ts','--exclude','**/*.integration.test.tsx','--maxWorkers=1','--no-file-parallelism','--testTimeout=15000']);
});
it('runs an explicit indexed test list and cannot silently pass when nothing is discovered',()=>{
 const selected=selectLocalTestFiles(JSON.stringify([file]),options);
 expect(selected).toEqual([file]);
 const args=buildTestArguments([],selected);
 expect(args).toEqual(['run',file,'--maxWorkers=1','--no-file-parallelism','--testTimeout=15000']);
 expect(args).not.toContain('--passWithNoTests');expect(args).not.toContain('--exclude');
});
it('rejects every explicit selection in CI',()=>{expect(()=>selectLocalTestFiles(JSON.stringify([file]),{...options,ci:true})).toThrow('local-only');});
it.each(['','[]','null','{}','[null]','["../outside.test.ts"]','["src/../test/other.test.ts"]','["package.json"]','["--passWithNoTests"]',JSON.stringify([file,file]),'["C:/outside.test.ts"]'])('rejects an empty, invalid, expanded or escaping local list: %s',raw=>{
 expect(()=>selectLocalTestFiles(raw,options)).toThrow();
});
it('rejects existing files outside the index and missing indexed paths',()=>{
 expect(()=>selectLocalTestFiles(JSON.stringify([file]),{...options,tracked:new Set()})).toThrow('repository index');
 const missing='src/test/TEST-missing.test.ts';
 expect(()=>selectLocalTestFiles(JSON.stringify([missing]),{...options,tracked:new Set([missing])})).toThrow('does not exist');
});
