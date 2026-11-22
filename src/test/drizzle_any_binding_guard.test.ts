import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {assertSafeDrizzleAny,findUnsafeDrizzleAny} from '../../scripts/quality/drizzle-any-binding.mjs';

it.each([
 "import {sql} from 'drizzle-orm'; const ids=['TEST']; sql`id=ANY(${ids})`",
 "import {sql as query} from 'drizzle-orm'; const ids=['TEST']; query`id=any( ${ids}::uuid[])`",
 "import * as orm from 'drizzle-orm'; const ids=['TEST']; orm.sql`id=ANY(${ids})`",
 "import {sql,type SQL} from 'drizzle-orm'; function valid(ids:SQL){return sql`id=ANY(${ids})`;} function bad(ids:string[]){return sql`id=ANY(${ids})`;}",
])('rejects an unsafe Drizzle identifier bind: %s',source=>{
 expect(findUnsafeDrizzleAny(source)).toHaveLength(1);
 expect(()=>assertSafeDrizzleAny(source,'TEST.ts')).toThrow('DRIZZLE_ANY_ARRAY_REQUIRED ids');
});

it.each([
 "import {sql} from 'drizzle-orm'; const ids=['TEST']; sql`id=ANY(ARRAY[${sql.join(ids.map(id=>sql`${id}`),sql`, `)}]::uuid[])`",
 "import {sql,type SQL} from 'drizzle-orm'; function read(column:SQL){return sql`id=ANY(${column})`;}",
 "import {sql,type SQL as Fragment} from 'drizzle-orm'; const column:Fragment=sql`source.ids`; sql`id=ANY(${column})`",
 "import * as orm from 'drizzle-orm'; function read(column:orm.SQL){return orm.sql`id=ANY(${column})`;}",
 "import postgres from 'postgres'; const sql=postgres();const ids=['TEST'];sql`id=ANY(${ids})`",
 "import {sql as query} from 'drizzle-orm'; import postgres from 'postgres';const sql=postgres();const ids=['TEST'];sql`id=ANY(${ids})`; query`select 1`",
 "import {sql} from 'drizzle-orm';function native(sql:Function,ids:string[]){return sql`id=ANY(${ids})`}",
])('accepts an ARRAY, typed SQL fragment or native postgres bind: %s',source=>{
 expect(findUnsafeDrizzleAny(source)).toEqual([]);
 expect(()=>assertSafeDrizzleAny(source,'TEST.ts')).not.toThrow();
});

it('accepts the actual qualified SQL-column predicate and repaired catalog source',()=>{
 for(const path of ['src/modules/eingang/server/intakeMailFailureRead.ts','src/lib/server/commands/orderContentCommand.ts']){
  expect(()=>assertSafeDrizzleAny(readFileSync(path,'utf8'),path)).not.toThrow();
 }
});
