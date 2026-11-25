import 'server-only';
import {sql,type SQL, type SQLWrapper} from 'drizzle-orm';
import {foldSearchText,GERMAN_SEARCH_REPLACEMENTS} from '@/lib/domain/searchText';

/** The database folds with the same pairs and in the same order as the domain rule. */
export function foldedSqlText(text:SQLWrapper):SQL{
 let value:SQL=sql`coalesce(${text},'')`;
 for(const [from,to] of GERMAN_SEARCH_REPLACEMENTS){
  const upper=from.toLocaleUpperCase('de-DE');
  if(from.length===1&&upper!==from)value=sql`replace(${value},${upper},${to})`;
 }
 value=sql`lower(${value})`;
 for(const [from,to] of GERMAN_SEARCH_REPLACEMENTS)value=sql`replace(${value},${from},${to})`;
 return value;
}

export function foldedSqlContains(text:SQLWrapper,query:string):SQL{
 const needle=foldSearchText(query);
 return needle?sql`strpos(${foldedSqlText(text)},${needle})>0`:sql`false`;
}
