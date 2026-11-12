/** Shared browser-safe U2 projection. Object facts remain in their domain port. */
export type U2Field={key:string;werte:Readonly<Record<string,unknown>>};
export type U2Action={elementId:string;textKey:string;werte:Readonly<Record<string,string|number>>;befehl:{datei:string;funktion:string;argumente:Readonly<Record<string,unknown>>};recht:string|null};
export type U2Read={code:'OK';zustand:string|null;farbe:string|null;erstblick:U2Field[];hauptaktion:U2Action|null;weitere:readonly unknown[]|null;gesperrt:readonly {elementId:string;grundKey:string}[];datenluecken:readonly string[];quelle:Readonly<Record<string,unknown>>;weitereInformationen?:U2Field[]};

type RawU2={code:string;zustand?:string;farbe?:string;erstblick?:U2Field[];hauptaktion?:U2Action|string|null;weitere?:readonly unknown[]|null;gesperrt?:U2Read['gesperrt'];missing?:readonly string[];datenluecken?:readonly string[];quelle?:Readonly<Record<string,unknown>>};
/** A readable object keeps its known display fields when one subsource fails. */
export function completeU2Read<T extends RawU2>(input:T):Omit<T,keyof U2Read>&U2Read{
 const hauptaktion=input.code==='OK'&&input.hauptaktion&&typeof input.hauptaktion==='object'?input.hauptaktion:null;
 const datenluecken=[...new Set([...(input.datenluecken??[]),...(input.missing??[]),...(input.code==='FORBIDDEN'?['ACTION_PERMISSION']:[])])];
 return {...input,code:'OK',zustand:input.zustand??null,farbe:input.farbe??null,erstblick:(input.erstblick??[]).map(field=>field.key.endsWith('.hauptaktion')?{...field,werte:{elementId:hauptaktion?.elementId??null}}:field),hauptaktion,weitere:input.weitere??null,gesperrt:input.gesperrt??[],datenluecken,quelle:input.quelle??{}};
}
