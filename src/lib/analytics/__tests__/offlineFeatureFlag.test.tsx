import {render,screen,cleanup} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {FeatureFlagProvider,useFeatureFlag,useFeatureFlagAdmin} from '../useFeatureFlag';
function Consumer(){const enabled=useFeatureFlag('offline_24h');const admin=useFeatureFlagAdmin();return <button onClick={()=>admin.setOverride('offline_24h',!enabled)}>{String(enabled)}</button>;}
afterEach(()=>{cleanup();localStorage.clear();});
it('ignores legacy browser overrides in both directions for the server-resolved offline flag',()=>{
 localStorage.setItem('kreile_feature_flags_v2',JSON.stringify({offline_24h:true}));
 const view=render(<FeatureFlagProvider offline24hEnabled={false}><Consumer/></FeatureFlagProvider>);
 expect(screen.getByRole('button').textContent).toBe('false');
 screen.getByRole('button').click();
 expect(screen.getByRole('button').textContent).toBe('false');
 localStorage.setItem('kreile_feature_flags_v2',JSON.stringify({offline_24h:false}));
 view.rerender(<FeatureFlagProvider offline24hEnabled><Consumer/></FeatureFlagProvider>);
 expect(screen.getByRole('button').textContent).toBe('true');
 screen.getByRole('button').click();
 expect(screen.getByRole('button').textContent).toBe('true');
});
