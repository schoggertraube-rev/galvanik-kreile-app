/** Same German spelling equivalence in the existing search query and its evidence check. */
export const GERMAN_SEARCH_REPLACEMENTS=[['ä','ae'],['ö','oe'],['ü','ue'],['ß','ss']] as const;
export function foldSearchText(value:string):string{
 return GERMAN_SEARCH_REPLACEMENTS.reduce<string>((text,[from,to])=>text.replaceAll(from,to),value.trim().toLocaleLowerCase('de-DE'));
}
