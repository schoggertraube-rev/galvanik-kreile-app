import { deepStrictEqual } from 'node:assert/strict';

/** Only TEST fixtures call this; SQL, guards and real Actions remain with the caller. */
export async function withRestoredTestSource<Snapshot, Result>(
 source: {label:string;read:()=>Promise<Snapshot>;restore:(snapshot:Snapshot)=>Promise<void>},
 run:()=>Promise<Result>,
):Promise<Result>{
 if(!source.label.startsWith('TEST '))throw Error('TEST_SOURCE_LABEL_REQUIRED');
 const snapshot=structuredClone(await source.read());
 let failed=false,originalError:unknown;
 try{return await run();}
 catch(error){failed=true;originalError=error;throw error;}
 finally{
  try{
   await source.restore(snapshot);
   deepStrictEqual(structuredClone(await source.read()),snapshot,'TEST_SOURCE_RESTORE_MISMATCH:'+source.label);
  }catch(error){
   if(failed)throw new AggregateError([originalError,error],'TEST_SOURCE_AND_RESTORE_FAILED:'+source.label);
   throw error;
  }
 }
}
