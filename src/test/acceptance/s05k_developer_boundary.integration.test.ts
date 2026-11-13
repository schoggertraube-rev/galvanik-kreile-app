// @vitest-environment node
// Synthetic TEST actors only; actual request/Auth/Actions/DB, no authorization doubles.
import {it,expect,vi} from "vitest";
const tenant=vi.hoisted(()=>"TEST-ablauf-"+globalThis.crypto.randomUUID());
vi.mock("@/lib/tenant",()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,withSession,createFixture} from "../../../e2e/ablauf/replayHarness";
import {saveManagedUserAction} from "@/app/actions/settings.actions";
import {loginWithPin} from "@/app/actions/auth.actions";
import {createPinLoginHandle} from "@/lib/server/pinLoginHandle";

async function developer(shortCode:string){
 const actor=await createFixture(["einstellungen","logins","wartung"],"developer");
 const input={userId:actor.actorId,fullName:"TEST S05K Developer",shortCode,designation:"TEST Entwickler",active:true,pin:"7654"};
 expect(await withSession(actor,()=>saveManagedUserAction(input))).toMatchObject({code:"OK"});
 actor.actorIssuedAt=Date.now();
 return {actor,input};
}
it("S05K A7 keeps a developer profile and PIN unchanged after another real manager retries",async()=>{
 const manager=await createFixture(["einstellungen","logins"]),target=await developer("D1");
 const [before]=await sql`SELECT pin_hash,full_name,active,role FROM public.app_users WHERE tenant_id=${tenant} AND id=${target.actor.actorId}::uuid`;
 const input={...target.input,fullName:"TEST Unauthorized Change",pin:"1234"};
 expect(await withSession(manager,()=>saveManagedUserAction(input))).toMatchObject({code:"FORBIDDEN"});
 expect(await withSession(manager,()=>saveManagedUserAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:"FORBIDDEN"});
 const [after]=await sql`SELECT pin_hash,full_name,active,role FROM public.app_users WHERE tenant_id=${tenant} AND id=${target.actor.actorId}::uuid`;
 expect(after).toEqual(before);
 const [events]=await sql`SELECT count(*)::integer AS n FROM public.ui_events WHERE tenant_id=${tenant} AND event_type='login_updated' AND payload->>'actorId'=${manager.actorId} AND payload->>'userId'=${target.actor.actorId}`;
 expect(events.n).toBe(0);
});
it("S05K A7 refuses a real developer PIN login even when the configured PIN is correct",async()=>{
 const target=await developer("D2"),handle=createPinLoginHandle(target.actor.actorId);
 expect(await withSession(target.actor,()=>loginWithPin(handle,"7654"))).toMatchObject({ok:false});
 const [limits]=await sql`SELECT count(*)::integer AS n FROM public.pin_rate_limits WHERE tenant_id=${tenant} AND operator_id=${target.actor.actorId}::uuid`;
 expect(limits.n).toBe(0);
});
