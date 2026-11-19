// @vitest-environment node
// Isolated TEST presentation fixture: real controls/CSS/browser, not an App/Auth/DB proof.
import {it,expect} from 'vitest';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {chromium,firefox,webkit} from 'playwright';

it('keeps owner control geometry, keyboard and reduced motion across three browsers and widths',async()=>{
 const result=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
  import React from 'react';import {createRoot} from 'react-dom/client';
  import {GlobalesPlus} from './src/ui/kr/GlobalesPlus';import {Button} from './src/ui/kr/Button';
  const counters={open:0,command:0};Object.assign(window,{TEST_s18:counters});
  createRoot(document.getElementById('root')).render(<><GlobalesPlus onOeffnen={()=>counters.open++}/><Button art="primaer" text="TEST Befehl" onClick={()=>counters.command++}/></>);
 `},bundle:true,write:false,outfile:'TEST-s18.js',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"test"'}});
 const script=result.outputFiles.find(file=>file.path.endsWith('.js'))?.text;
 if(!script)throw Error('TEST_S18_BROWSER_BUNDLE_MISSING');
 const moduleCss=result.outputFiles.filter(file=>file.path.endsWith('.css')).map(file=>file.text).join('\n');
 const css=JSON.parse(readFileSync('src/ui/generated/vorfinalCss.json','utf8')).css;
 const html='<!doctype html><html data-ui="v45"><head><style>'+moduleCss+'</style><style>'+css+'</style></head><body><div id="root"></div><script>'+script.replaceAll('</script','<\\/script')+'</script></body></html>';
 const server=createServer((request,response)=>{
  if(request.url!=='/TEST-s18'){response.writeHead(404).end();return;}
  response.writeHead(200,{'content-type':'text/html; charset=utf-8'}).end(html);
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();if(!address||typeof address==='string')throw Error('TEST_S18_LOOPBACK_LISTENER');
 try{
  for(const engine of [chromium,webkit,firefox]){
   const browser=await engine.launch({headless:true});
   try{
    for(const width of [1440,820,390]){
     const page=await browser.newPage({viewport:{width,height:900}});
     try{
      await page.goto('http://127.0.0.1:'+address.port+'/TEST-s18');
      const plus=page.getByRole('button',{name:'Neuer Eingang'}),primary=page.getByRole('button',{name:'TEST Befehl'});
      await plus.waitFor({state:'visible'});await page.evaluate(()=>document.fonts.ready);
      const plusBox=await plus.boundingBox(),primaryBox=await primary.boundingBox();
      expect(plusBox?.width).toBe(58);expect(plusBox?.height).toBe(58);
      expect(primaryBox?.height).toBeGreaterThanOrEqual(60);expect(primaryBox?.width).toBeGreaterThanOrEqual(48);
      expect(await plus.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(196, 67, 47)');
      await plus.focus();await page.keyboard.press('Enter');
      await page.keyboard.press('Tab');expect(await primary.evaluate(el=>el===document.activeElement)).toBe(true);
      await page.keyboard.press('Enter');
      expect(await page.evaluate(()=>Reflect.get(window,'TEST_s18'))).toEqual({open:1,command:1});
      const durations=async()=>primary.evaluate(el=>getComputedStyle(el).transitionDuration.split(',').map(value=>Number.parseFloat(value)*1000));
      expect((await durations()).every(ms=>ms<=250)).toBe(true);
      await page.emulateMedia({reducedMotion:'reduce'});
      // Owner v10 uses .01ms, preserved verbatim; this does not assert the old plan's mathematical 0ms.
      expect((await durations()).every(ms=>ms<=0.01)).toBe(true);
     }finally{await page.close();}
    }
   }finally{await browser.close();}
  }
 }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
},60000);
