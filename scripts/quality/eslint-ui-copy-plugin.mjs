import {readFileSync} from 'node:fs';
import ts from 'typescript';

const baseline=JSON.parse(readFileSync(new URL('./ui-copy-baseline.json',import.meta.url),'utf8'));
const attributes=new Set(['aria-label','title','placeholder','alt']);
export const isTextBaselineFile=path=>path.startsWith('src/')&&/\.(?:tsx|jsx)$/u.test(path)&&!/(?:^|\/)(?:__tests__|test|generated)(?:\/|$)|\.(?:test|spec|generated)\./u.test(path);
/** Static display fragments only; CSS names, URLs, keys and call arguments aren't copy. */
export function collectInlineCopy(source,filename){
 const tree=ts.createSourceFile(filename,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),found=[];
 const add=(node,text)=>{
  const value=text.replace(/\s+/gu,' ').trim();
  if(/\p{L}/u.test(value))found.push({text:value,start:node.getStart(tree)});
 };
 const expression=node=>{
  if(!node)return;
  if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))add(node,node.text);
  else if(ts.isTemplateExpression(node)){add(node.head,node.head.text);for(const span of node.templateSpans)add(span.literal,span.literal.text);}
  else if(ts.isJsxExpression(node))expression(node.expression);
  else if(ts.isConditionalExpression(node)){expression(node.whenTrue);expression(node.whenFalse);}
  else if(ts.isBinaryExpression(node)&&[ts.SyntaxKind.PlusToken,ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken,ts.SyntaxKind.AmpersandAmpersandToken].includes(node.operatorToken.kind)){
   if(node.operatorToken.kind!==ts.SyntaxKind.AmpersandAmpersandToken)expression(node.left);
   expression(node.right);
  }else if(ts.isParenthesizedExpression(node)||ts.isAsExpression(node)||ts.isSatisfiesExpression(node)||ts.isNonNullExpression(node))expression(node.expression);
 };
 const visit=node=>{
  if(ts.isJsxText(node))add(node,node.text);
  else if(ts.isJsxAttribute(node)&&attributes.has(node.name.getText(tree)))expression(node.initializer);
  else if(ts.isJsxExpression(node)&&(ts.isJsxElement(node.parent)||ts.isJsxFragment(node.parent)))expression(node.expression);
  ts.forEachChild(node,visit);
 };
 visit(tree);return found;
}
export function findNewInlineCopy(source,filename,allowed){
 const counts=new Map();
 return collectInlineCopy(source,filename).filter(row=>{
  const count=(counts.get(row.text)??0)+1;counts.set(row.text,count);
  return count>(allowed[row.text]??0);
 });
}
const plugin={rules:{'no-inline-copy':{
 meta:{type:'problem',schema:[],messages:{catalog:'S15: sichtbaren Text aus dem Textkatalog lesen: {{text}}'}},
 create(context){return {Program(){
  const path=context.filename.replaceAll('\\','/').split('/src/').at(-1);
  const filename='src/'+path;
  if(!isTextBaselineFile(filename))return;
  for(const row of findNewInlineCopy(context.sourceCode.text,filename,baseline.files[filename]??{}))context.report({loc:context.sourceCode.getLocFromIndex(row.start),messageId:'catalog',data:{text:row.text}});
 }};},
}}};
export default plugin;
