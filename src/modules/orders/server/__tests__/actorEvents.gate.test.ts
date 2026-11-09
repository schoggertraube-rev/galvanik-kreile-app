// @vitest-environment node
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {expect,it} from 'vitest';

/** Complements H18's Action/DB proofs; direct event writes must carry the actual actor binding. */
function actorFindings(source:string){
 const ast=ts.createSourceFile('actor-contract.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),errors:string[]=[];
 let writes=0;
 const visit=(node:ts.Node)=>{
  if(ts.isTaggedTemplateExpression(node)){
   const expressions:ts.Expression[]=[];
   let text=ts.isNoSubstitutionTemplateLiteral(node.template)?node.template.text:node.template.head.text;
   if(ts.isTemplateExpression(node.template))for(const span of node.template.templateSpans){text+='KR_EXPRESSION_'+expressions.length+span.literal.text;expressions.push(span.expression);}
   for(const match of text.matchAll(/\binsert\s+into\s+(?:(?:"public"|public)\s*\.\s*)?(?:"events"|events)\s*\(([^)]*)\)/gi)){
    writes++;
    const columns=match[1].split(',').map(value=>value.trim().replaceAll('"','').toLowerCase());
    const actor=columns.indexOf('user_id');
    if(actor<0){errors.push('EVENT_ACTOR_COLUMN_MISSING');continue;}
    const rest=text.slice((match.index??0)+match[0].length),values=/^\s*VALUES\s*\(/i.exec(rest);
    if(!values)continue; // INSERT/SELECT provenance remains covered by the real H18 writer tests.
    const parts:string[]=[];let part='',depth=0,quoted=false;
    for(const char of rest.slice(values[0].length)){
     if(char==="'")quoted=!quoted;
     if(!quoted&&char==='(')depth++;
     if(!quoted&&char===')'){if(depth===0){parts.push(part);break;}depth--;}
     if(!quoted&&depth===0&&char===','){parts.push(part);part='';}else part+=char;
    }
    const binding=/^\s*KR_EXPRESSION_(\d+)(?:::uuid)?\s*$/i.exec(parts[actor]??'');
    if(!binding){errors.push('EVENT_ACTOR_NOT_BOUND');continue;}
    const expression=expressions[Number(binding[1])];
    if(!expression||expression.kind===ts.SyntaxKind.NullKeyword||ts.isIdentifier(expression)&&expression.text==='undefined')errors.push('EVENT_ACTOR_EMPTY');
    else if(!ts.isIdentifier(expression)&&!ts.isPropertyAccessExpression(expression))errors.push('EVENT_ACTOR_NOT_IDENTITY');
   }
  }
  if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='values'){
   const insert=node.expression.expression;
   if(ts.isCallExpression(insert)&&ts.isPropertyAccessExpression(insert.expression)&&insert.expression.name.text==='insert'&&insert.arguments[0]?.getText(ast)==='events'){
    writes++;const value=node.arguments[0];
    const actor=value&&ts.isObjectLiteralExpression(value)?value.properties.find(prop=>ts.isPropertyAssignment(prop)&&prop.name.getText(ast).replaceAll('"','')==='userId'):undefined;
    if(!actor||!ts.isPropertyAssignment(actor))errors.push('ORM_EVENT_ACTOR_MISSING');
    else if(actor.initializer.kind===ts.SyntaxKind.NullKeyword||ts.isIdentifier(actor.initializer)&&actor.initializer.text==='undefined')errors.push('ORM_EVENT_ACTOR_EMPTY');
   }
  }
  ts.forEachChild(node,visit);
 };
 visit(ast);return {writes,errors};
}
function files(root:string):string[]{return readdirSync(root,{withFileTypes:true}).flatMap(entry=>entry.name==='__tests__'||entry.name==='fixtures'?[]:entry.isDirectory()?files(path.join(root,entry.name)):/\.tsx?$/.test(entry.name)&&!/(?:test|spec)\./.test(entry.name)?[path.join(root,entry.name)]:[]);}

it('AK-04 rejects an event write without an actor and explicit empty SQL/ORM actors',()=>{
 expect(actorFindings('sql`INSERT INTO public.events(id,event_type) VALUES (${id},\'TEST\')`').errors).toContain('EVENT_ACTOR_COLUMN_MISSING');
 expect(actorFindings('sql`INSERT INTO public.events(id,user_id) VALUES (${id},NULL)`').errors).toContain('EVENT_ACTOR_NOT_BOUND');
 expect(actorFindings("sql`INSERT INTO public.events(id,user_id) VALUES (${id},${'SYSTEM'})`").errors).toContain('EVENT_ACTOR_NOT_IDENTITY');
 expect(actorFindings('db.insert(events).values({id,userId:null})').errors).toContain('ORM_EVENT_ACTOR_EMPTY');
 expect(actorFindings('sql`INSERT INTO public.events(id,user_id) VALUES (${id},${auth.userId}::uuid)`')).toEqual({writes:1,errors:[]});
});
it('AK actor gate checks every direct production event insert without changing protected H18 rules',()=>{
 const found=files('src/app').concat(files('src/lib'),files('src/modules')).map(file=>({file,...actorFindings(readFileSync(file,'utf8'))}));
 expect(found.reduce((sum,row)=>sum+row.writes,0)).toBeGreaterThan(20);
 expect(found.flatMap(row=>row.errors.map(error=>row.file+':'+error))).toEqual([]);
});
