export type FixtureResetTable={schema:string;name:string};
/** Drain the existing browser's requests before its fixture/page teardown.
 * Closing a page first aborts the client while the real server transaction can
 * still hold read locks. No reset retry, lock rule or test timeout changes. */
export async function settleFixtureReads(page:{isClosed:()=>boolean;waitForLoadState:(state:'networkidle')=>Promise<void>}):Promise<void>{
 if(!page.isClosed())await page.waitForLoadState('networkidle');
}
export function fixtureResetTargets(tables:readonly FixtureResetTable[]):string{
 if(!tables.length||tables.some(table=>!['public','private'].includes(table.schema)||!/^[a-z_][a-z0-9_]*$/.test(table.name)))throw Error('FLOW_REPLAY_TABLE_NAME_INVALID');
 const names=[...new Set(tables.map(table=>`"${table.schema}"."${table.name}"`))].sort();
 return names.join(', ');
}
/** A closed browser can leave its real server transaction finishing. Observe
 * those existing relation locks before attempting the unchanged NOWAIT reset.
 * This reads this database only; it neither cancels sessions nor changes locks. */
export async function readFixtureResetBlockers(connection:{unsafe:(query:string)=>Promise<unknown>},tables:readonly FixtureResetTable[]):Promise<Array<{pid:number|null}>>{
 fixtureResetTargets(tables);
 const targets=[...new Set(tables.map(table=>`'"${table.schema}"."${table.name}"'::regclass`))].sort().join(', ');
 const rows=await connection.unsafe(`SELECT DISTINCT holder.pid FROM pg_locks holder
 WHERE holder.locktype='relation' AND holder.granted
 AND holder.database=(SELECT oid FROM pg_database WHERE datname=current_database())
 AND holder.relation IN (${targets}) AND holder.pid IS DISTINCT FROM pg_backend_pid()
 ORDER BY holder.pid NULLS FIRST`);
 if(!Array.isArray(rows)||rows.some(row=>!row||typeof row!=='object'||!('pid'in row)||row.pid!==null&&!Number.isInteger(row.pid)))throw Error('FLOW_REPLAY_LOCK_SOURCE_INVALID');
 return rows as Array<{pid:number|null}>;
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
