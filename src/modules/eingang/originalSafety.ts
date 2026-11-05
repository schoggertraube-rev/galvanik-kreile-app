import {inflateRawSync} from "node:zlib";

export function allowedOriginalExtension(name:string):boolean{return /\.(?:jpe?g|png|heic|webp|pdf|xml|xlsx|csv|eml)$/iu.test(name);}
function safeWorkbook(bytes:Buffer):boolean{
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0||bytes.readUInt16LE(end+4)!==0||bytes.readUInt16LE(end+6)!==0)return false;
 const count=bytes.readUInt16LE(end+10);let at=bytes.readUInt32LE(end+16);let content:{at:number;size:number;method:number;raw:number}|null=null;let workbook=false;
 if(count<1||count>10000||at>=end)return false;
 for(let i=0;i<count;i++){
  if(at+46>bytes.length||bytes.readUInt32LE(at)!==0x02014b50||(bytes.readUInt16LE(at+8)&1)!==0)return false;
  const length=bytes.readUInt16LE(at+28),extra=bytes.readUInt16LE(at+30),comment=bytes.readUInt16LE(at+32);
  if(at+46+length+extra+comment>end)return false;
  const name=bytes.subarray(at+46,at+46+length).toString('utf8');
  if(/(?:^|\/)\.\.(?:\/|$)|vba|activex|macrosheet|oleobjects/iu.test(name))return false;
  if(name==='xl/workbook.xml')workbook=true;
  if(name==='[Content_Types].xml')content={at:bytes.readUInt32LE(at+42),size:bytes.readUInt32LE(at+20),raw:bytes.readUInt32LE(at+24),method:bytes.readUInt16LE(at+10)};
  at+=46+length+extra+comment;
 }
 if(!workbook||!content||content.raw>2*1024*1024||content.size>2*1024*1024||content.at+30>bytes.length||bytes.readUInt32LE(content.at)!==0x04034b50)return false;
 const start=content.at+30+bytes.readUInt16LE(content.at+26)+bytes.readUInt16LE(content.at+28);
 if(start+content.size>bytes.length)return false;
 const packed=bytes.subarray(start,start+content.size);
 const xml=(content.method===0?packed:content.method===8?inflateRawSync(packed,{maxOutputLength:2*1024*1024}):null)?.toString('utf8');
 return typeof xml==='string'&&/application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet\.main\+xml/u.test(xml)&&!/(?:macroEnabled|vbaProject|activeX)/iu.test(xml);
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
   case 'xlsx':return safeWorkbook(bytes);
   default:return false;
  }
 }catch(error){console.error('[INTAKE_ORIGINAL_FORMAT_INVALID]',error instanceof Error?error.name:'UnknownError');return false;}
}
