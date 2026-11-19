// @vitest-environment node
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {expect,it} from 'vitest';
import {readRootStyle} from '@/ui/vorfinalStyle';
import {extractVorfinalStyles,checkStyleArtifact} from '../../scripts/ui/import-vorfinal-style.mjs';
import binding from '@/ui/generated/vorfinalStyle.json';
import {GET as legacyStyleResponse} from '@/app/styles/endversion-legacy.css/route';
import {PACKAGE_SWITCHES,mapPackageSwitchRows} from '@/modules/fundament/public';

const flags=(enabled:boolean)=>mapPackageSwitchRows(PACKAGE_SWITCHES.map(({id})=>({id,enabled:id==='ui_v45'&&enabled,roles:null})));

it('uses the same server-resolved switch and leaves unauthenticated or absent flags on the old sheet',()=>{
 expect(readRootStyle('authenticated',flags(true))).toEqual({enabled:true,dataUi:'v45',href:'/styles/vorfinal-v10.css'});
 for(const status of ['unauthenticated','error'])expect(readRootStyle(status,flags(true)).enabled).toBe(false);
 expect(readRootStyle('authenticated').href).toBe('/styles/endversion-legacy.css');
 expect(readRootStyle('authenticated',flags(false)).dataUi).toBeUndefined();
});
it('retains the exact generated style artifacts and rejects an altered palette',()=>{
 expect(()=>execFileSync(process.execPath,['scripts/ui/import-vorfinal-style.mjs','--check'])).not.toThrow();
 const css=readFileSync('public/styles/vorfinal-v10.css','utf8');
 expect(css).not.toContain('<script');
 expect(()=>checkStyleArtifact(css.replace('#f3f6f5','#000000'),binding.cssSha256)).toThrow('VORFINAL_STYLE_ARTIFACT_CHANGED');
});
it('copies all four source blocks without interpreting CSS or accepting incomplete input',()=>{
 const synthetic='<style>/* TEST synthetic */a{color:red}</style><style>b{}</style><style>c{}</style><style>d{}</style>';
 expect(extractVorfinalStyles(synthetic).css).toBe('/* TEST synthetic */a{color:red}\nb{}\nc{}\nd{}');
 expect(()=>extractVorfinalStyles('<style>/* TEST synthetic incomplete */</style>')).toThrow('VORFINAL_STYLE_SOURCE_INCOMPLETE');
});
it('serves the previous stylesheet byte for byte, including its existing whitespace',async()=>{
 const response=legacyStyleResponse();
 expect(response.headers.get('Content-Type')).toBe('text/css; charset=utf-8');
 expect(Buffer.from(await response.arrayBuffer())).toEqual(readFileSync('docs/project/endversion/ui/endversion_design.css'));
});
