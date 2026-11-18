/** The existing intake title formation, shared with regular content saving.
 * No stored freeze/invoice is rewritten and no customer name is invented. */
export function orderTitleSource(customer:{companyName:unknown;name:unknown},firstItemName:string|undefined):{customerDisplayName:string;title:string}|null{
 const display=(value:unknown)=>{
  if(typeof value!=='string')return null;
  const normalized=value.trim().replace(/\s+/g,' ');
  return normalized.length>=2&&normalized.length<=160?normalized:null;
 };
 const customerDisplayName=display(customer.companyName)??display(customer.name);
 return customerDisplayName?{customerDisplayName,title:`${customerDisplayName} · ${firstItemName??'Wareneingang'}`.slice(0,240)}:null;
}
