/** Same German spelling equivalence in the existing search query and its evidence check. */
export const GERMAN_SEARCH_REPLACEMENTS=[['ä','ae'],['ö','oe'],['ü','ue'],['ß','ss']] as const;
export function foldSearchText(value:string):string{
 return GERMAN_SEARCH_REPLACEMENTS.reduce<string>((text,[from,to])=>text.replaceAll(from,to),value.trim().toLocaleLowerCase('de-DE'));
}

/** Kölner Phonetik, published letter rules (not a customer alias list).
 * Reference: https://commons.apache.org/proper/commons-codec/apidocs/org/apache/commons/codec/language/ColognePhonetic.html
 */
export function cologneSearchCode(value:string):string {
 const letters=value.toLocaleUpperCase('de-DE').replaceAll('Ä','A').replaceAll('Ö','O').replaceAll('Ü','U').replace(/[^A-Z]/g,'');
 let encoded='';
 for(let index=0;index<letters.length;index++){
  const letter=letters[index],before=letters[index-1]??'',after=letters[index+1]??'';
  if('AEIJOUY'.includes(letter))encoded+='0';
  else if(letter==='H')continue;
  else if(letter==='B'||letter==='P'&&after!=='H')encoded+='1';
  else if('DT'.includes(letter)&&!(after&&'CSZ'.includes(after)))encoded+='2';
  else if('FVW'.includes(letter)||letter==='P')encoded+='3';
  else if('GKQ'.includes(letter))encoded+='4';
  else if(letter==='C')encoded+=(index===0?!!after&&'AHKLOQRUX'.includes(after):!(before&&'SZ'.includes(before))&&!!after&&'AHKOQUX'.includes(after))?'4':'8';
  else if(letter==='X')encoded+=before&&'CKQ'.includes(before)?'8':'48';
  else if(letter==='L')encoded+='5';
  else if('MN'.includes(letter))encoded+='6';
  else if(letter==='R')encoded+='7';
  else encoded+='8';
 }
 const collapsed=encoded.replace(/(.)\1+/g,'$1');
 return collapsed.slice(0,1)+collapsed.slice(1).replaceAll('0','');
}

/** Exactly one insertion/deletion/replacement or adjacent transposition. */
function oneSpellingEdit(left:string,right:string):boolean {
 if(Math.abs(left.length-right.length)>1)return false;
 let at=0;while(at<Math.min(left.length,right.length)&&left[at]===right[at])at++;
 if(at===Math.min(left.length,right.length))return left.length!==right.length;
 if(left.length<right.length)return left.slice(at)===right.slice(at+1);
 if(left.length>right.length)return left.slice(at+1)===right.slice(at);
 return left.slice(at+1)===right.slice(at+1)
  ||left[at]===right[at+1]&&left[at+1]===right[at]&&left.slice(at+2)===right.slice(at+2);
}

const LEGAL_NAME_WORDS=new Set(['gmbh','kg','ag','ug','gbr','ohg','mbh','co','ltd','llc']);
export function alternativeNameQuery(query:string):string|null {
 const normalized=foldSearchText(query);
 return /^[a-z]{4,}$/u.test(normalized)&&!LEGAL_NAME_WORDS.has(normalized)?normalized:null;
}
export type NameSearchAlternative='phonetic'|'spelling';
export function nameSearchAlternative(name:string|null,query:string):NameSearchAlternative|null {
 const word=alternativeNameQuery(query);if(!word||!name)return null;
 const words=foldSearchText(name).match(/[a-z]+/g)??[];
 const code=cologneSearchCode(word);
 if(code&&words.some(candidate=>!LEGAL_NAME_WORDS.has(candidate)&&cologneSearchCode(candidate)===code))return 'phonetic';
 // A transposed query can split a phonetic family (Schmdit:8622, Schmidt:862).
 // Prove spelling alternatives through the same canonical code, without aliases or a second search.
 const correctedCodes=new Set(Array.from({length:word.length-1},(_,at)=>cologneSearchCode(word.slice(0,at)+word[at+1]+word[at]+word.slice(at+2))));
 return words.some(candidate=>!LEGAL_NAME_WORDS.has(candidate)&&(oneSpellingEdit(candidate,word)||correctedCodes.has(cologneSearchCode(candidate))))?'spelling':null;
}

/** Safe broad SQL preselection; only nameSearchAlternative can prove a hit. */
export function alternativeNameInitialPattern(query:string):string|null {
 const word=alternativeNameQuery(query);if(!word)return null;
 const initial=cologneSearchCode(word)[0];
 const groups:Record<string,string>={'0':'aeijouyh','1':'bph','2':'dth','3':'fvwph','4':'cgkqxh','5':'lh','6':'mnh','7':'rh','8':'cdstxzh'};
 return groups[initial]?'(^|[^[:alpha:]])['+groups[initial]+']':null;
}
