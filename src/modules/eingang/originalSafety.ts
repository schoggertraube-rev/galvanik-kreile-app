import {inflateRawSync} from "node:zlib";

export function allowedOriginalExtension(name:string):boolean{return /\.(?:jpe?g|png|heic|webp|pdf|xml|xlsx|csv|eml)$/iu.test(name);}

/** Read the bounded MIME header, excluding the body and any quoted message. */
export function mimeHeaderLines(bytes:Uint8Array):string[]|null{
 const prefix=Buffer.from(bytes.subarray(0,65536)).toString('latin1'),end=prefix.search(/\r?\n\r?\n/);
 if(end<0)return null;
 return unfoldedMimeHeaders(prefix.slice(0,end));
}

function unfoldedMimeHeaders(value:string){
 return value.replace(/\r?\n[ \t]+/g,' ').split(/\r?\n/);
}

function mimeParameter(value:string,key:string){
 const match=new RegExp(`(?:^|;)\\s*${key}\\s*=\\s*(?:"([^"\\r\\n]*)"|([^;\\s]+))`,'i').exec(value);
 return match?.[1]??match?.[2];
}

function decodeMailBody(body:string,encoding:string,charset:string):string|null{
 let bytes:Buffer;
 switch(encoding){
  case '':case '7bit':case '8bit':case 'binary':
   bytes=Buffer.from(body,'latin1');break;
  case 'quoted-printable':
   bytes=Buffer.from(body.replace(/=\r?\n/g,'').replace(/=([a-f\d]{2})/gi,(_,hex:string)=>String.fromCharCode(parseInt(hex,16))),'latin1');break;
  case 'base64':{
   const value=body.replace(/[\r\n \t]/g,'');
   if(value.length%4!==0||!/^[a-z\d+/]*={0,2}$/i.test(value))return null;
   bytes=Buffer.from(value,'base64');break;
  }
  default:return null;
 }
 try{return new TextDecoder(charset,{fatal:true}).decode(bytes).replaceAll('\0','');}
 catch{return null;}
}

function htmlMailText(value:string){
 const entities:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',auml:'ä',ouml:'ö',uuml:'ü',szlig:'ß',Auml:'Ä',Ouml:'Ö',Uuml:'Ü'};
 return value.replace(/<!--[\s\S]*?-->|<(head|script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'')
  .replace(/<(?:br\b|\/(?:p|div|tr|li|h[1-6])\b)[^<>]*>/gi,'\n').replace(/<[^<>]*>/g,'')
  .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi,(raw:string,key:string)=>{
   if(!key.startsWith('#'))return Object.hasOwn(entities,key)?entities[key]:raw;
   const code=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));
   return code>0&&code<=0x10ffff&&(code<0xd800||code>0xdfff)?String.fromCodePoint(code):raw;
  });
}

type MailBody={plain:boolean;text:string};
function mailBodyFromEntity(entity:string,depth:number):MailBody|null{
 const separator=(depth>0 ? /^\r?\n|\r?\n\r?\n/ : /\r?\n\r?\n/).exec(entity);
 if(!separator||separator.index>65536||depth>8)return null;
 const headers=unfoldedMimeHeaders(entity.slice(0,separator.index));
 const header=(name:string)=>headers.find(line=>line.toLowerCase().startsWith(name+':'))?.slice(name.length+1).trim()??'';
 const type=header('content-type'),media=(type.split(';')[0].trim()||'text/plain').toLowerCase();
 const disposition=header('content-disposition');
 if(/^attachment(?:\s*;|$)/i.test(disposition)||mimeParameter(type,'name\\*?')!==undefined||mimeParameter(disposition,'filename\\*?')!==undefined)return null;
 const body=entity.slice(separator.index+separator[0].length);
 if(media.startsWith('multipart/')){
  const boundary=mimeParameter(type,'boundary');
  if(!boundary||boundary.length>70)return null;
  const escaped=boundary.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const delimiters=body.matchAll(new RegExp(`^--${escaped}(--)?[ \\t]*(?:\\r?\\n|$)`,'gm'));
  const parts:MailBody[]=[];
  let start:number|null=null,partsSeen=0;
  for(const line of delimiters){
   if(start!==null){
    if(++partsSeen>1000)return null;
    const part=mailBodyFromEntity(body.slice(start,line.index).replace(/\r?\n$/,''),depth+1);
    if(part)parts.push(part);
   }
   if(line[1]){
    if(media==='multipart/alternative')return parts.find(part=>part.plain&&part.text.trim())??parts.at(-1)??null;
    return parts.length?{plain:parts.every(part=>part.plain),text:parts.map(part=>part.text).join('\n')}:null;
   }
   start=line.index+line[0].length;
  }
  return null;
 }
 if(media!=='text/plain'&&media!=='text/html')return null;
 const decoded=decodeMailBody(body,header('content-transfer-encoding').toLowerCase(),mimeParameter(type,'charset')??'utf-8');
 return decoded===null?null:{plain:media==='text/plain',text:media==='text/plain'?decoded:htmlMailText(decoded)};
}

/** Returns the visible text of the original MIME body, excluding attachments and forwarded entities. */
export function readMimeOriginalText(bytes:Uint8Array):string|null{
 return mailBodyFromEntity(Buffer.from(bytes).toString('latin1'),0)?.text??null;
}

/** RFC 3834 §5. A single explicit marking can rule out a party's confirmation. */
export function automaticMimeReply(bytes:Uint8Array):boolean|null{
 const lines=mimeHeaderLines(bytes);
 if(!lines)return null;
 const marked=lines.flatMap(line=>{
  const match=/^auto-submitted:\s*(.*)$/i.exec(line);
  return match?[match[1]]:[];
 });
 if(marked.length!==1)return null;
 const keyword=/^([a-z][a-z-]*)(?:\s*;|\s*$)/i.exec(marked[0])?.[1].toLowerCase();
 if(keyword==='no')return false;
 return keyword==='auto-replied'||keyword==='auto-generated'?true:null;
}
const officeTypes={
 docx:{entry:'word/document.xml',type:'wordprocessingml.document.main+xml'},
 xlsx:{entry:'xl/workbook.xml',type:'spreadsheetml.sheet.main+xml'},
 pptx:{entry:'ppt/presentation.xml',type:'presentationml.presentation.main+xml'},
} as const;

function safeOfficeZip(bytes:Buffer,format:keyof typeof officeTypes):boolean{
 const expected=officeTypes[format];
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0||bytes.readUInt16LE(end+4)!==0||bytes.readUInt16LE(end+6)!==0)return false;
 const count=bytes.readUInt16LE(end+10);let at=bytes.readUInt32LE(end+16);let content:{at:number;size:number;method:number;raw:number}|null=null;let mainPart=false;
 if(count<1||count>10000||at>=end)return false;
 for(let i=0;i<count;i++){
  if(at+46>bytes.length||bytes.readUInt32LE(at)!==0x02014b50||(bytes.readUInt16LE(at+8)&1)!==0)return false;
  const length=bytes.readUInt16LE(at+28),extra=bytes.readUInt16LE(at+30),comment=bytes.readUInt16LE(at+32);
  if(at+46+length+extra+comment>end)return false;
  const name=bytes.subarray(at+46,at+46+length).toString('utf8');
  if(/(?:^|\/)\.\.(?:\/|$)|vba|activex|macrosheet|oleobjects/iu.test(name))return false;
  if(name===expected.entry)mainPart=true;
  if(name==='[Content_Types].xml')content={at:bytes.readUInt32LE(at+42),size:bytes.readUInt32LE(at+20),raw:bytes.readUInt32LE(at+24),method:bytes.readUInt16LE(at+10)};
  at+=46+length+extra+comment;
 }
 if(!mainPart||!content||content.raw>2*1024*1024||content.size>2*1024*1024||content.at+30>bytes.length||bytes.readUInt32LE(content.at)!==0x04034b50)return false;
 const start=content.at+30+bytes.readUInt16LE(content.at+26)+bytes.readUInt16LE(content.at+28);
 if(start+content.size>bytes.length)return false;
 const packed=bytes.subarray(start,start+content.size);
 const xml=(content.method===0?packed:content.method===8?inflateRawSync(packed,{maxOutputLength:2*1024*1024}):null)?.toString('utf8');
 return typeof xml==='string'&&xml.includes('application/vnd.openxmlformats-officedocument.'+expected.type)&&!/(?:macroEnabled|vbaProject|activeX)/iu.test(xml);
}

/** Office recognition does not broaden the signed-download allowlist. */
export function safeOfficeRecognitionBytes(name:string, data:Uint8Array, format:keyof typeof officeTypes|'html'):boolean{
 const extension=name.split('.').at(-1)?.toLowerCase();
 const bytes=Buffer.from(data.buffer,data.byteOffset,data.byteLength);
 if(format==='html')return (extension==='html'||extension==='htm')&&!bytes.includes(0)
  &&/^\s*(?:<!doctype\s+html\s*>|<html(?:[\s>]))/iu.test(bytes.subarray(0,1024).toString('utf8'));
 if(extension!==format)return false;
 try{return safeOfficeZip(bytes,format);}
 catch{return false;}
}
/** Whitelisted format and real bytes are checked before any signed download is issued. */
export function safeOriginalBytes(name:string,data:Uint8Array):boolean{
 if(!allowedOriginalExtension(name))return false;
 const bytes=Buffer.from(data.buffer,data.byteOffset,data.byteLength),extension=name.split('.').at(-1)?.toLowerCase();
 try{
  switch(extension){
   case 'jpg':case 'jpeg':return bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
   case 'png':return bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
   case 'webp':return bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
   case 'heic':return bytes.length>=16&&bytes.toString('ascii',4,8)==='ftyp'&&/heic|heix|hevc|hevx/u.test(bytes.toString('ascii',8,32));
   case 'pdf':return bytes.toString('ascii',0,5)==='%PDF-';
   case 'xml':return bytes.subarray(0,1024).toString('utf8').replace(/^\uFEFF/u,'').trimStart().startsWith('<')&&!bytes.includes(Buffer.from('<!DOCTYPE'))&&!bytes.includes(Buffer.from('<!ENTITY'));
   case 'csv':return !bytes.includes(0);
   case 'eml':return /^(?:from|subject|received|date|mime-version|content-type):/imu.test(bytes.subarray(0,32768).toString('utf8'));
   case 'xlsx':return safeOfficeZip(bytes,'xlsx');
   default:return false;
  }
 }catch(error){console.error('[INTAKE_ORIGINAL_FORMAT_INVALID]',error instanceof Error?error.name:'UnknownError');return false;}
}
