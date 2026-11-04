export const CUSTOMER_COUNTRIES = [
  { value: "DE", label: "Deutschland" }, { value: "AT", label: "Österreich" },
  { value: "CH", label: "Schweiz" }, { value: "andere", label: "anderes Land" },
] as const;
export type CustomerCountry = typeof CUSTOMER_COUNTRIES[number]["value"];
export type CustomerFormType = "" | "business" | "privat" | "lieferant";
export type CustomerFormValue = {
  customerType: CustomerFormType; companyName: string; salutation: "" | "frau" | "herr" | "ohne";
  firstName: string; lastName: string; contactRole: string; phone: string; email: string;
  billingEmail: string; website: string; street: string; houseNumber: string; zipCode: string;
  city: string; country: string; paymentPreference: string; vatId: string; notes: string;
  handoverPreference: "" | "pickup" | "shipping"; iban: string; paymentTermDays: string;
  autoInfo: boolean; vorrang: boolean;
};
export const EMPTY_CUSTOMER_FORM: CustomerFormValue = {
  customerType: "", companyName: "", salutation: "", firstName: "", lastName: "", contactRole: "",
  phone: "", email: "", billingEmail: "", website: "", street: "", houseNumber: "", zipCode: "", city: "",
  country: "DE", paymentPreference: "vorkasse", vatId: "", notes: "", handoverPreference: "", iban: "",
  paymentTermDays: "", autoInfo: true, vorrang: false,
};
export function customerCountryLabel(country: string | null | undefined) {
  return CUSTOMER_COUNTRIES.find(option => option.value === country)?.label ?? (country ? "Land ungültig" : "fehlt");
}
export function nullableFormText(value: string) {
  return value.trim().replace(/\s+/g, " ") || null;
}
export function projectCustomerTransfer(input: unknown):Partial<CustomerFormValue> {
  if(!input||typeof input!=="object"||Array.isArray(input))return {};
  const source=input as Record<string,unknown>,value:Partial<CustomerFormValue>={};
  for(const key of Object.keys(EMPTY_CUSTOMER_FORM) as Array<keyof CustomerFormValue>) {
    if(typeof source[key]===typeof EMPTY_CUSTOMER_FORM[key])Object.assign(value,{[key]:source[key]});
  }
  return value;
}
export function customerDisplayName(value: Pick<CustomerFormValue,"customerType"|"companyName"|"firstName"|"lastName">) {
  return value.customerType === "privat" ? [value.firstName,value.lastName].map(part=>part.trim()).filter(Boolean).join(" ") : value.companyName.trim();
}
export function customerContactLabel(value: {customerType?: string | null; salutation?: string | null; firstName?: string | null; lastName?: string | null; contactRole?: string | null}) {
  if(value.customerType==="privat")return null;
  const name=[value.salutation==="frau"?"Frau":value.salutation==="herr"?"Herr":null,value.firstName,value.lastName].filter(Boolean).join(" ");
  return [name,value.contactRole].filter(Boolean).join(" · ")||null;
}
export function normaliseIban(value: string) { return value.replace(/\s/g, "").toUpperCase(); }
export function validIban(value: string) {
  const iban=normaliseIban(value);
  if(!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban))return false;
  let remainder=0;
  for(const letter of iban.slice(4)+iban.slice(0,4)) {
    for(const digit of (/[A-Z]/.test(letter)?String(letter.charCodeAt(0)-55):letter))remainder=(remainder*10+Number(digit))%97;
  }
  return remainder===1;
}
export function customerFieldError(field: keyof CustomerFormValue,value: CustomerFormValue): string | null {
  const text=String(value[field]??"").trim();
  const supplier=value.customerType==="lieferant";
  if(field==="customerType"&&!["business","privat","lieferant"].includes(value.customerType))return "Firma oder Privat wählen";
  if(field==="companyName"&&value.customerType&&value.customerType!=="privat"&&(text.length<2||text.length>160))return "Firmenname bitte mit mindestens 2 Zeichen";
  if(field==="firstName"&&text.length>60)return "Vorname höchstens 60 Zeichen";
  if(field==="lastName"&&((text&&(text.length<2||text.length>80))||(!text&&value.customerType==="privat")))return "Nachname bitte mit mindestens 2 Zeichen";
  if(field==="salutation"&&text&&!["frau","herr","ohne"].includes(text))return "Anrede prüfen";
  if(field==="contactRole"&&text.length>60)return "Höchstens 60 Zeichen";
  if(field==="phone"&&((text&&(!/^[0-9 +\-/()]{6,20}$/.test(text)||text.replace(/\D/g,"").length<6))||(!text&&!supplier)))return "Telefonnummer prüfen";
  if((field==="email"||field==="billingEmail")&&text&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)||text.length>254))return "E-Mail-Adresse prüfen";
  if(field==="street"&&text.length>120)return "Höchstens 120 Zeichen";
  if(field==="houseNumber"&&text&&!/^[0-9A-Za-z/-]{1,10}$/.test(text))return "Hausnummer prüfen";
  if(field==="zipCode"&&text) {
    if(value.country==="DE"&&!/^\d{5}$/.test(text))return "PLZ prüfen";
    if((value.country==="AT"||value.country==="CH")&&!/^\d{4}$/.test(text))return "PLZ prüfen";
    if(value.country==="andere"&&(text.length<2||text.length>10))return "PLZ prüfen";
  }
  if(field==="city"&&text.length>100)return "Höchstens 100 Zeichen";
  if(field==="country"&&text&&!CUSTOMER_COUNTRIES.some(option=>option.value===text))return "Land prüfen";
  if(field==="vatId"&&text&&!(value.country==="DE"?/^DE\d{9}$/.test(text):text.length>=4&&text.length<=20))return "USt-ID prüfen";
  if(field==="website"&&text&&(!/^[^\s.]+(?:\.[^\s.]+)+$/.test(text.replace(/^https?:\/\//i,""))||text.length>120))return "Website prüfen";
  if(field==="iban"&&text&&!validIban(text))return "IBAN ungültig";
  if(field==="paymentTermDays"&&text&&(!/^\d+$/.test(text)||Number(text)>120))return "Zahlungsziel prüfen";
  if(field==="notes"&&text.length>2000)return "Höchstens 2000 Zeichen";
  if(field==="paymentPreference"&&text&&!["vorkasse","bar","rechnung"].includes(text))return "Zahlungsbedingung prüfen";
  if(field==="handoverPreference"&&text&&!["pickup","shipping"].includes(text))return "Übergabe prüfen";
  return null;
}
export function kundeValidierung(value: CustomerFormValue,previous?: CustomerFormValue, terms?: { invoiceTermsEnabled?: boolean }) {
  const errors: Partial<Record<keyof CustomerFormValue,string>>={};
  for(const key of Object.keys(value) as Array<keyof CustomerFormValue>) {
    const dependencyChanged=(key==="zipCode"||key==="vatId")&&previous?.country!==value.country
      || ["companyName","lastName","phone"].includes(key)&&previous?.customerType!==value.customerType;
    if(previous&&previous[key]===value[key]&&!dependencyChanged)continue;
    const error=customerFieldError(key,value);
    if(error)errors[key]=error;
  }
  if (value.paymentPreference === "rechnung" && !terms?.invoiceTermsEnabled) errors.paymentPreference = "Ziel nicht freigeschaltet.";
  return errors;
}
export function customerTypeChangeLosses(value: CustomerFormValue,target: Exclude<CustomerFormType,"">) {
  if(!value.customerType||value.customerType===target)return [];
  const fields: Array<[keyof CustomerFormValue,string]>=target==="privat"
    ? [["companyName","Firmenname"],["contactRole","Funktion / Abteilung"],["vatId","USt-ID"],["website","Website"],["billingEmail","E-Mail für Rechnungen"],["iban","IBAN"],["paymentTermDays","Zahlungsziel"]]
    : target==="lieferant"?[["paymentPreference","Zahlungsbedingung"],["vatId","USt-ID"],["billingEmail","E-Mail für Rechnungen"],["handoverPreference","Übergabe bevorzugt"]]
      :[["iban","IBAN"],["paymentTermDays","Zahlungsziel"]];
  return fields.filter(([key])=>String(value[key]??"").trim()).map(([,label])=>label);
}
export function applyCustomerTypeChange(value:CustomerFormValue,target:Exclude<CustomerFormType,"">):CustomerFormValue {
  const next={...value,customerType:target};
  if(target==="privat")return {...next,companyName:"",contactRole:"",vatId:"",website:"",billingEmail:"",iban:"",paymentTermDays:""};
  if(target==="lieferant")return {...next,paymentPreference:"",vatId:"",billingEmail:"",handoverPreference:""};
  return {...next,iban:"",paymentTermDays:""};
}

export const CUSTOMER_FIELD_LABELS:Record<keyof CustomerFormValue,string>={customerType:"Kundentyp",companyName:"Firmenname",salutation:"Anrede",firstName:"Vorname",lastName:"Nachname",contactRole:"Funktion / Abteilung",phone:"Telefon",email:"E-Mail",billingEmail:"E-Mail für Rechnungen",website:"Website",street:"Straße",houseNumber:"Nr.",zipCode:"PLZ",city:"Ort",country:"Land",paymentPreference:"Zahlungsbedingung",vatId:"USt-ID",notes:"Notiz",handoverPreference:"Übergabe bevorzugt",iban:"IBAN",paymentTermDays:"Zahlungsziel",autoInfo:"Kunde automatisch informieren",vorrang:"Vorrang bei Terminen"};
