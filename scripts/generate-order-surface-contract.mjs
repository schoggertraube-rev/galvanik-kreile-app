import fs from 'node:fs';
import {resolve,relative,basename} from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';

const source=fs.readFileSync(new URL('../src/lib/orderPositionContract.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('orderPositionContract.ts',source,ts.ScriptTarget.Latest,true);
function literal(node){
 if(ts.isAsExpression(node)||ts.isSatisfiesExpression(node))return literal(node.expression);
 if(ts.isStringLiteral(node))return node.text;
 if(ts.isArrayLiteralExpression(node))return node.elements.map(literal);
 if(ts.isObjectLiteralExpression(node))return Object.fromEntries(node.properties.map(property=>{
  if(!ts.isPropertyAssignment(property)||!ts.isIdentifier(property.name))throw Error('SURFACE_CONTRACT_LITERAL_REQUIRED');
  return [property.name.text,literal(property.initializer)];
 }));
 throw Error('SURFACE_CONTRACT_LITERAL_REQUIRED');
}
function constant(name){
 for(const statement of ast.statements)if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations){
  if(ts.isIdentifier(declaration.name)&&declaration.name.text===name&&declaration.initializer)return literal(declaration.initializer);
 }
 throw Error('SURFACE_CONTRACT_SOURCE_MISSING');
}
const surfaces=constant('ORDER_POSITION_SURFACES'),aliases=constant('ORDER_POSITION_SURFACE_ALIASES');
const keys=new Set(surfaces.map(option=>option.key)),variants=new Map();
function add(value,key){
 if(typeof value!=='string'||!value||value.trim()!==value||!keys.has(key))throw Error('SURFACE_CONTRACT_VALUE_INVALID');
 if(variants.has(value)&&variants.get(value)!==key)throw Error('SURFACE_CONTRACT_ALIAS_AMBIGUOUS');
 variants.set(value,key);
}
for(const option of surfaces){add(option.key,option.key);add(option.label,option.key);}
for(const option of aliases)add(option.alias,option.key);
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const hash=createHash('sha256').update(JSON.stringify({surfaces,aliases})).digest('hex');
const body=`-- Generated from src/lib/orderPositionContract.ts; one surface/alias vocabulary.
-- Contract SHA256: ${hash}. Create a new migration for later changes.
-- PL2026-11-21 04:39: legacy aliases are read without rewriting originals.
CREATE OR REPLACE FUNCTION private.order_position_surface_key(p_value text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $fn$
BEGIN
  IF p_value IS NULL OR btrim(p_value)='' THEN RETURN NULL; END IF;
  CASE btrim(p_value)
${[...variants].map(([value,key])=>`    WHEN ${quote(value)} THEN RETURN ${quote(key)};`).join('\n')}
    ELSE RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='ORDER_POSITION_SURFACE_KEY_UNKNOWN';
  END CASE;
END; $fn$;
REVOKE ALL ON FUNCTION private.order_position_surface_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.order_position_surface_key(text) TO service_role;
`;
if(!process.argv[2])throw Error('EXPLICIT_NEW_MIGRATION_FILE_REQUIRED');
const target=resolve(process.argv[2]),directory=resolve('supabase/migrations');
if(relative(directory,target)!==basename(target)||!/^\d{14}_surface_alias_contract\.sql$/.test(basename(target)))throw Error('NEW_SURFACE_MIGRATION_PATH_REQUIRED');
if(!fs.existsSync(target)||fs.readFileSync(target,'utf8').trim())throw Error('ONLY_EMPTY_CLI_CREATED_MIGRATION_ALLOWED');
fs.writeFileSync(target,body,'utf8');
console.log(JSON.stringify({migration:basename(target),surfaces:surfaces.length,aliases:aliases.length,variants:variants.size,contractSha256:hash}));
