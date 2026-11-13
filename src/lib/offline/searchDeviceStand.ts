import {customerMatchField,searchTenant,type SearchCustomerDocument,type SearchTenantResult} from '@/modules/suche/public';
import {TENANT_SEARCH_COPY} from '@/ui/situationCatalog';
import {readCacheScopeMarker} from './cacheScopeMarker';
import {readDevicePortResponse,readDeviceStandResponse} from './devicePortRead';

/** The existing search engine consumes the same cached list responses. No
 * network, alternative ranking, price projection or second device index. */
export async function searchDeviceStand(scope:string|null,enabled:boolean,query:string):Promise<SearchTenantResult>{
 const unavailable=():SearchTenantResult=>({code:'UNAVAILABLE',message:TENANT_SEARCH_COPY.unavailable});
 if(!scope||!enabled)return unavailable();
 const login=readCacheScopeMarker();if(!login)return unavailable();
 const stand=await readDeviceStandResponse(scope,true);if(stand.code!=='OK')return unavailable();
 const [orders,customers]=await Promise.all([
  readDevicePortResponse(scope,true,{port:'orders.list',objectId:'orders'}),
  readDevicePortResponse(scope,true,{port:'customers.list',objectId:'customers'}),
 ]);
 const result=await searchTenant(query,{
  readOrders:async()=>{
   if(orders.code!=='OK'||orders.value.port!=='orders.list'||!orders.value.response.result.ok)throw Error('OFFLINE_SEARCH_ORDER_SOURCE_UNAVAILABLE');
   return orders.value.response.result.data;
  },
  searchCustomers:async customerQuery=>{
   if(customers.code!=='OK'||customers.value.port!=='customers.list'||!customers.value.response.result.ok)throw Error('OFFLINE_SEARCH_CUSTOMER_SOURCE_UNAVAILABLE');
   const optional=(value:string|undefined)=>value?.trim()?value:null;
   const records:SearchCustomerDocument[]=customers.value.response.result.data.map(customer=>({id:customer.id,customerNumber:customer.customerNumber,name:customer.name,companyName:optional(customer.companyName),customerType:customer.type,city:optional(customer.city),phone:optional(customer.phone),contactPerson:optional(customer.contactPerson),email:optional(customer.email)}));
   return {records:records.filter(customer=>customerMatchField(customer,customerQuery)!==null),exhaustive:true};
  },
  readTimestamp:()=>stand.serverReadAt,
 });
 const fresh=await readDeviceStandResponse(scope,true);
 if(readCacheScopeMarker()!==login||fresh.code!=='OK'||fresh.cacheGeneration!==stand.cacheGeneration||fresh.serverReadAt!==stand.serverReadAt)return unavailable();
 return result;
}
