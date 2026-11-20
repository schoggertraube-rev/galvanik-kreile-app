// @vitest-environment node
// Isolated TEST presentation fixture: real controls/CSS/browser, not an App/Auth/DB proof.
import {it,expect} from 'vitest';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {chromium,firefox,webkit} from 'playwright';

// Existing Native CI provisions Chromium; the local owner comparison uses all three.
// No missing-browser fallback: every selected engine must launch and pass every assertion.
const engines=process.env.GITHUB_ACTIONS==='true'?[chromium]:[chromium,webkit,firefox];
it(`keeps owner control geometry, keyboard and reduced motion across ${engines.length} browsers and three widths`,async()=>{
 const result=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
  import React from 'react';import {createRoot} from 'react-dom/client';
  import {GlobalesPlus} from './src/ui/kr/GlobalesPlus';import {Button} from './src/ui/kr/Button';import {Zeit} from './src/ui/kr/Zeit';import {Overlay} from './src/ui/kr/Overlay';
  const counters={open:0,command:0};Object.assign(window,{TEST_s18:counters});
  function TimeFixture(){const [minutes,setMinutes]=React.useState(''),[date,setDate]=React.useState('2026-11-20'),[note,setNote]=React.useState('');
   return <form data-testid="TEST-time" onSubmit={event=>event.preventDefault()}><Zeit auftragId="TEST-order" version={7} variante="heute_offen" datum={date} heute="2026-11-20" minuten={minutes} dauerText="TEST Tageswert" enthaltenText="TEST Mehrarbeit enthalten" notiz={note} auswahl={[]} grenzen={{min:0,max:720,schritt:1}} verteilung={<p>TEST Teilzuordnung unverändert</p>} laden={false} deaktiviert={false} fehler={null} aktion={{text:'TEST Fachport fehlt',onAusloesen:null,gesperrt:true,grund:'TEST Präsentationsprobe ohne Schreibwirkung'}} onDatum={setDate} onMinuten={setMinutes} onNotiz={setNote}/></form>;}
  function DialogFixture(){const [opener,setOpener]=React.useState<HTMLElement|null>(null);return <><button onClick={event=>setOpener(event.currentTarget)}>TEST Dialog öffnen</button>{opener?<Overlay variante="formular" bezugId="TEST-order" version={7} elternId={null} oeffner={opener} titel="TEST gleiche Quelle 7" groesse="breit" laden={false} fehler={null} vorSchliessen={()=>true} onSchliessen={()=>setOpener(null)}><input aria-label="TEST Originaleingabe" defaultValue="TEST bleibt"/></Overlay>:null}</>;}
  createRoot(document.getElementById('root')).render(<><GlobalesPlus onOeffnen={()=>counters.open++}/><Button art="primaer" text="TEST Befehl" onClick={()=>counters.command++}/><TimeFixture/><DialogFixture/></>);
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
  for(const engine of engines){
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
      // Real browser layout is required by the one existing Enter handler; JSDOM has no visible field geometry.
      const time=page.getByTestId('TEST-time'),total=time.getByRole('spinbutton'),date=time.locator('input[type=date]'),note=time.locator('textarea');
      expect(await time.getByRole('slider').count()).toBe(0);
      await total.fill('75');await total.press('Enter');expect(await date.evaluate(el=>el===document.activeElement)).toBe(true);
      expect(await total.inputValue()).toBe('75');expect(await time.getByRole('slider').inputValue()).toBe('75');
      await date.press('Enter');expect(await note.evaluate(el=>el===document.activeElement)).toBe(true);
      await note.fill('TEST Notiz');await note.press('End');await note.press('Enter');
      expect(await note.inputValue()).toBe('TEST Notiz\n');expect(await note.evaluate(el=>el===document.activeElement)).toBe(true);
      // Instrument the actual native animation, never replace its execution/completion.
      await page.evaluate(()=>{
        const durations:unknown[]=[],focus:string[]=[],native=Element.prototype.animate,nativeFocus=HTMLElement.prototype.focus,nativeRect=Element.prototype.getBoundingClientRect;Reflect.set(window,'TEST_dialog_motion',durations);Reflect.set(window,'TEST_dialog_focus',focus);
        document.addEventListener('focusin',event=>{const element=event.target;if(element instanceof HTMLElement)focus.push(element.tagName+':'+(element.getAttribute('aria-label')??element.textContent??''));});
        HTMLElement.prototype.focus=function(this:HTMLElement,options){focus.push('CALL:'+this.tagName+':'+(this.getAttribute('aria-label')??this.textContent?.slice(0,60))+':'+this.isConnected);return nativeFocus.call(this,options);};
        Element.prototype.getBoundingClientRect=function(this:Element){const rect=nativeRect.call(this);if(this.classList.contains('ov-box')||this.textContent==='TEST Dialog öffnen')focus.push('RECT:'+this.tagName+':'+rect.width+':'+rect.height+':active='+document.activeElement?.tagName);return rect;};
        Element.prototype.animate=function(this:Element,frames,options){durations.push(typeof options==='number'?options:options?.duration);return native.call(this,frames,options);};
      });
      const dialogTrigger=page.getByRole('button',{name:'TEST Dialog öffnen'}),dialog=page.getByRole('dialog',{name:'TEST gleiche Quelle 7'});
      await dialogTrigger.focus();await dialogTrigger.click();await dialog.waitFor({state:'visible'});
      await dialog.getByRole('textbox').fill('TEST Eingabe während Bewegung');expect(await dialog.getByRole('textbox').inputValue()).toBe('TEST Eingabe während Bewegung');
      // Check the resting layout cap after the original spring settles; the
      // preceding edit deliberately happens while that animation is running.
      await dialog.evaluate(element=>Promise.all(element.getAnimations().map(animation=>animation.finished)));
      expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(640);
      await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
      // React restores focus in its passive unmount cleanup after DOM removal.
      await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='TEST Dialog öffnen')===document.activeElement).catch(async cause=>{
        throw new Error('TEST_DIALOG_FOCUS:'+JSON.stringify(await page.evaluate(()=>({active:document.activeElement?.outerHTML.slice(0,400),focus:Reflect.get(window,'TEST_dialog_focus'),motion:Reflect.get(window,'TEST_dialog_motion')}))),{cause});
      });
      expect(await dialogTrigger.evaluate(el=>el===document.activeElement)).toBe(true);
      expect(await page.evaluate(()=>Reflect.get(window,'TEST_dialog_motion'))).toEqual([250,250,190]);
      const durations=async()=>primary.evaluate(el=>getComputedStyle(el).transitionDuration.split(',').map(value=>Number.parseFloat(value)*1000));
      expect((await durations()).every(ms=>ms<=250)).toBe(true);
      await page.emulateMedia({reducedMotion:'reduce'});
      // Owner v10 uses .01ms, preserved verbatim; this does not assert the old plan's mathematical 0ms.
      expect((await durations()).every(ms=>ms<=0.01)).toBe(true);
      await dialogTrigger.click();await dialog.waitFor({state:'visible'});await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
      expect(await page.evaluate(()=>Reflect.get(window,'TEST_dialog_motion'))).toEqual([250,250,190]);
     }finally{await page.close();}
    }
   }finally{await browser.close();}
  }
 }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
},60000);
