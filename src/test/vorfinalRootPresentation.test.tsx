// @vitest-environment jsdom
// Synthetic server/client presentation boundaries, never an authorization proof.
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import {renderToString} from 'react-dom/server';
import {afterEach,expect,it} from 'vitest';
import {useVorfinalStyle} from '@/ui/useVorfinalStyle';
import {KrApp,useKrGeraet} from '@/ui/kr/AppShell';
function Probe(){return <output>{useVorfinalStyle()?'TEST vorfinal':'TEST legacy'}</output>;}
afterEach(()=>{cleanup();delete document.documentElement.dataset.ui;});
it('never switches markup ahead of its server-selected stylesheet after a later flag reread',async()=>{
 render(<KrApp geraet="desktop" vorfinal><Probe/></KrApp>);expect(screen.getByText('TEST legacy')).toBeTruthy();
 document.documentElement.dataset.ui='v45';await waitFor(()=>expect(screen.getByText('TEST vorfinal')).toBeTruthy());
 delete document.documentElement.dataset.ui;await waitFor(()=>expect(screen.getByText('TEST legacy')).toBeTruthy());
});
it('uses the same bootstrap flag for the first server markup before a document exists',()=>{
 expect(renderToString(<KrApp geraet="desktop" vorfinal><Probe/></KrApp>)).toContain('TEST vorfinal');
 expect(renderToString(<KrApp geraet="desktop" vorfinal={false}><Probe/></KrApp>)).toContain('TEST legacy');
});
it('inherits only presentation in a nested existing device context and preserves the device reader',()=>{
 function Device(){return <output>{useKrGeraet()}</output>;}
 const html=renderToString(<KrApp geraet="desktop" vorfinal><KrApp geraet="handy"><Probe/><Device/></KrApp></KrApp>);
 expect(html).toContain('TEST vorfinal');expect(html).toContain('handy');
});
