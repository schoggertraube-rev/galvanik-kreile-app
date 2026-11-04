export type CustomerComparisonValue = {
  customerType?: string | null; name?: string | null; companyName?: string | null;
  firstName?: string | null; lastName?: string | null; phone?: string | null; email?: string | null;
  street?: string | null; houseNumber?: string | null; zipCode?: string | null; city?: string | null;
};
export function normaliseCustomerName(text: string | null | undefined) {
  return (text??"").toLocaleLowerCase("de-DE")
    .replace(/\bug\s*\(haftungsbeschränkt\)/g," ").replace(/\bgmbh\s*&\s*co\.?\s*kg\b/g," ")
    .replace(/\be\s*\.?\s*[kv]\s*\.(?=\s|$)/g," ").replace(/\b(?:gmbh|ohg|ag|ug|kg|gbr)\b/g," ")
    .replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ");
}
export function normaliseCustomerPhone(phone: string | null | undefined) {
  const value=(phone??"").trim().replace(/^(?:\+49|0049)/,"0");
  return value.replace(/\D/g,"");
}
export function customerSortKey(value:CustomerComparisonValue) {
  return normaliseCustomerName(value.customerType==="privat"?[value.lastName,value.firstName].filter(Boolean).join(" "):value.companyName??value.name);
}
export function customerDuplicateMatch(stored: CustomerComparisonValue,candidate: CustomerComparisonValue): {kind:"exact"|"possible";by:string}|null {
  const phone=normaliseCustomerPhone(candidate.phone);
  if(phone&&phone===normaliseCustomerPhone(stored.phone))return {kind:"exact",by:"Telefon"};
  const email=candidate.email?.trim().toLocaleLowerCase("de-DE");
  if(email&&email===stored.email?.trim().toLocaleLowerCase("de-DE"))return {kind:"exact",by:"E-Mail"};
  const address=(field:keyof CustomerComparisonValue,value:CustomerComparisonValue)=>normaliseCustomerName(value[field]);
  const same=(field:keyof CustomerComparisonValue)=>Boolean(address(field,candidate))&&address(field,candidate)===address(field,stored);
  const names=(value:CustomerComparisonValue)=>normaliseCustomerName(value.customerType==="privat"?[value.firstName,value.lastName].filter(Boolean).join(" "):value.companyName??value.name);
  const left=names(stored),right=names(candidate);
  const words=(name:string)=>name.split(" ").sort().join(" ");
  const location=same("zipCode")||same("city")||(!candidate.zipCode?.trim()&&!candidate.city?.trim());
  if(right.length>=4&&location&&(left.includes(right)||right.includes(left)&&left.length>=4||words(left)===words(right)))return {kind:"possible",by:"Name"};
  if(candidate.customerType==="privat"&&same("lastName")&&same("street"))return {kind:"possible",by:"Name und Straße"};
  if(same("street")&&same("houseNumber")&&same("zipCode"))return {kind:"possible",by:"Anschrift"};
  const domain=email?.split("@")[1];
  if(candidate.customerType==="business"&&domain&&!/^(?:gmail\.com|googlemail\.com|gmx\.(?:de|net)|web\.de|t-online\.de|outlook\.com|hotmail\.com|yahoo\.(?:de|com)|icloud\.com)$/.test(domain)&&domain===stored.email?.trim().toLocaleLowerCase("de-DE").split("@")[1])return {kind:"possible",by:"E-Mail-Domain"};
  return null;
}
