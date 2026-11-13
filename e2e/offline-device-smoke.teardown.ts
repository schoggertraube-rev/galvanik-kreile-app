import {execFileSync} from 'node:child_process';
import path from 'node:path';
export default async function teardown(){
 execFileSync(process.execPath,[path.resolve('scripts/testing/offline-smoke-next.mjs'),'--restore-flag'],{stdio:'pipe',timeout:20_000});
}
