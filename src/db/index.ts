import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {withPageReadQueryLimits,isAuthorizationRead,AUTHORIZATION_READ_TIMEOUT_MS} from './readBudget';
import * as baseSchema from './schema';
import * as buchhaltungSchema from './schema_buchhaltung';
import * as marketingSchema from './schema_marketing';

const schema = { ...baseSchema, ...buchhaltungSchema, ...marketingSchema };

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const connectionString = process.env.DATABASE_URL;

// Fix for Next.js HMR connection pool exhaustion
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
  authorizationReadConn: postgres.Sql | undefined;
};

const client = globalForDb.conn ?? postgres(connectionString, { prepare: false });
if (process.env.NODE_ENV !== "production") globalForDb.conn = client;

const primaryDb=drizzle(withPageReadQueryLimits(client),{schema});
let authorizationDb:typeof primaryDb|undefined;
/** Drizzle's two actual query modes, executed in native READ ONLY transactions.
 * Do not use startup GUCs: transaction poolers may silently drop those. */
function readOnlyQueries(native:postgres.Sql):postgres.Sql{
 return new Proxy(native,{get(target,key,receiver){
  if(key!=='unsafe')return Reflect.get(target,key,receiver);
  return (...args:Parameters<postgres.Sql['unsafe']>)=>{
   let values=false,pending:Promise<unknown>|undefined;
   const start=()=>pending??=target.begin('read only',async transaction=>{
    const query=transaction.unsafe(...args);
    return values?await query.values():await query;
   });
   const query={
    then:(resolve?:((value:unknown)=>unknown)|null,reject?:((reason:unknown)=>unknown)|null)=>start().then(resolve,reject),
    catch:(reject:(reason:unknown)=>unknown)=>start().catch(reject),
    finally:(done:()=>void)=>start().finally(done),
    values:()=>{if(pending)throw Error('AUTH_READ_MODE_ALREADY_STARTED');values=true;return query;},
   };
   return query;
  };
 }});
}
function authorizationDatabase():typeof primaryDb{
 if(authorizationDb)return authorizationDb;
 // Same configured database/provider, a maximum of two read connections.
 // No role, grant, credential, table or writer is introduced.
 const native=globalForDb.authorizationReadConn??postgres(connectionString,{prepare:false,max:2,connect_timeout:Math.ceil(AUTHORIZATION_READ_TIMEOUT_MS/1000),idle_timeout:20});
 if(process.env.NODE_ENV!=='production')globalForDb.authorizationReadConn=native;
 authorizationDb=drizzle(readOnlyQueries(withPageReadQueryLimits(native)),{schema});
 return authorizationDb;
}
export const db:typeof primaryDb=new Proxy(primaryDb,{get(target,key){
 const database=isAuthorizationRead()?authorizationDatabase():target;
 const value=Reflect.get(database,key,database);
 return key!=='$client'&&typeof value==='function'?value.bind(database):value;
}});
