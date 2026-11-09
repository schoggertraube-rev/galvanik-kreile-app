export function packagePartWords(text:string){
 const ignored=new Set(['paket','ware','absender','unbekannt','bitte','stück','stueck','verchromen','verzinken','vernickeln','lieferschein','inhalt','diese','dieser','ohne','steht','zurück','zurueck','versand']);
 return [...new Set(text.toLocaleLowerCase('de-DE').split(/[^\p{L}\p{N}]+/u).filter(word=>word.length>=4&&!ignored.has(word)))].slice(0,8);
}
