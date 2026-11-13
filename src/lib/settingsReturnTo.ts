/** Validate navigation inside the app; the parsing origin is never requested. */
export function settingsReturnTo(value: unknown): string | null {
  if(typeof value!=="string"||!value.startsWith("/")||value.startsWith("//")||value.includes("\\"))return null;
  const origin="https://kreile.invalid";
  try{return new URL(value,origin).origin===origin?value:null;}
  catch{return null;}
}
