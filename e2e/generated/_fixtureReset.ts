export type FixtureResetTable={schema:string;name:string};
export function fixtureResetTargets(tables:readonly FixtureResetTable[]):string{
 if(!tables.length||tables.some(table=>!['public','private'].includes(table.schema)||!/^[a-z_][a-z0-9_]*$/.test(table.name)))throw Error('FLOW_REPLAY_TABLE_NAME_INVALID');
 const names=[...new Set(tables.map(table=>`"${table.schema}"."${table.name}"`))].sort();
 return names.join(', ');
}
/** Acquire the complete FK-cascade closure before changing any fixture. NOWAIT
 * rolls back partial lock acquisition instead of deadlocking a reader that
 * already holds a later table. A later reader waits until this reset commits. */
export async function lockFixtureResetTables(transaction:{unsafe:(query:string)=>Promise<unknown>},tables:readonly FixtureResetTable[]):Promise<void>{
 await transaction.unsafe(`LOCK TABLE ${fixtureResetTargets(tables)} IN ACCESS EXCLUSIVE MODE NOWAIT`);
}

/** Bounded fallback for aborted cleanup transactions, never a retry of product writes. */
export async function retryFixtureResetDeadlock<T>(reset: () => Promise<T>, warn: (...args: unknown[]) => void = console.warn): Promise<T> {
  for(let attempt=1;;attempt++){
    try{return await reset();}
    catch(error){
      if(!error||typeof error!=='object'||!('code' in error)||!['40P01','55P03'].includes(String(error.code))||attempt>=3)throw error;
      warn('FLOW_REPLAY_FIXTURE_RESET_RETRY',{attempt,code:error.code});
      await new Promise(resolve=>setTimeout(resolve,50*attempt));
    }
  }
}
