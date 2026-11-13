import {expect,it} from 'vitest';
import {capturePendingItemFinished} from '../pendingStore';
it('the real producer refuses a native storage SecurityError without creating an original',async()=>{
 const previous=Object.getOwnPropertyDescriptor(window,'indexedDB');
 document.cookie='kreile_offline_cache_scope='+('a'.repeat(64))+'; Path=/';
 Object.defineProperty(window,'indexedDB',{configurable:true,get(){throw new DOMException('TEST private storage unavailable','SecurityError');}});
 try{await expect(capturePendingItemFinished('b'.repeat(64),true,{orderId:crypto.randomUUID(),itemId:crypto.randomUUID(),clientEventId:crypto.randomUUID(),expectedVersion:1,finished:true})).resolves.toEqual({code:'NETWORK_REQUIRED'});}
 finally{if(previous)Object.defineProperty(window,'indexedDB',previous);else Reflect.deleteProperty(window,'indexedDB');document.cookie='kreile_offline_cache_scope=; Path=/; Max-Age=0';}
});
