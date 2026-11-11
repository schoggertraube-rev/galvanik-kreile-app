'use client';
import {useSyncExternalStore} from 'react';
import {readLogoutNotice,subscribeLogoutNotice} from '@/lib/offline/logoutWithReadCleanup';
export function OfflineLogoutNotice(){
 const notice=useSyncExternalStore(subscribeLogoutNotice,readLogoutNotice,()=> '');
 return notice?<div role="status" className="kr-toast">{notice}</div>:null;
}
