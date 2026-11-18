import {readFileSync} from 'node:fs';
import path from 'node:path';
import fontkit,{type Font as FontProgram} from '@pdf-lib/fontkit';
import {Font} from '@react-pdf/renderer';

export const INVOICE_FONT_FAMILY='KreileInvoiceLiberationSans';
const sources=[
 {src:path.join(process.cwd(),'public/pdf/invoice/LiberationSans-Regular.ttf'),fontWeight:400},
 {src:path.join(process.cwd(),'public/pdf/invoice/LiberationSans-Bold.ttf'),fontWeight:700},
];
let registered=false;
let programs:FontProgram[]|undefined;

export function registerInvoiceFonts(){
 if(registered)return;
 Font.register({family:INVOICE_FONT_FAMILY,fonts:sources});registered=true;
}

export class InvoiceGlyphError extends Error{
 constructor(readonly field:string,readonly codePoint:number){super('INVOICE_DOCUMENT_GLYPH_MISSING');this.name='InvoiceGlyphError';}
}

/** Only character representability, never a substitute for required-field or
 * financial validation. Missing/empty source fields are handled by the writer. */
export function assertInvoiceGlyphs(texts:readonly {field:string;text:string}[]):void{
 if(!programs)programs=sources.map(source=>fontkit.create(readFileSync(source.src)));
 for(const {field,text} of texts){
  for(const character of text){
   if(character==='\n'||character==='\r'||character==='\t')continue; // Layout separators, not rendered glyphs.
   const codePoint=character.codePointAt(0);
   if(codePoint===undefined)throw Error('INVOICE_GLYPH_SOURCE_INVALID');
   if(!programs.every(program=>program.hasGlyphForCodePoint(codePoint)))throw new InvoiceGlyphError(field,codePoint);
  }
 }
}
