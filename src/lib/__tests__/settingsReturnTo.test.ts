import {describe,it,expect,vi} from "vitest";
vi.mock("@/app/settings/SettingsAppAdapter",()=>({SettingsAppAdapter:()=>null}));
import SettingsPage from "@/app/settings/page";
import {settingsReturnTo} from "../settingsReturnTo";
describe("settings return navigation",()=>{
 it("accepts only relative paths that stay on the same origin",()=>{
  for(const value of ["/","/orders?tab=open#details","/kunden/Müller","/user@example.invalid"]){expect(settingsReturnTo(value)).toBe(value);}
  for(const value of ["//evil.example.invalid","/\\evil.example.invalid","/safe\\evil.example.invalid","/\n/evil.example.invalid","/\t/evil.example.invalid","https://evil.example.invalid","javascript:alert(1)","relative",null,undefined,{}]){expect(settingsReturnTo(value)).toBeNull();}
 });
 it("passes only the checked return target to the existing settings adapter",async()=>{
  for(const [value,expected] of [["/orders?tab=open","/orders?tab=open"],["/\\evil.example.invalid",null],["//evil.example.invalid",null]]){
   const view=await SettingsPage({searchParams:Promise.resolve({returnTo:value??undefined})});
   expect(view.props.returnTo).toBe(expected);
  }
 });

});
