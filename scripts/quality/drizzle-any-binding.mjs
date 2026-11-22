import ts from 'typescript';

/** PL22.11.01:55 H3. Native postgres tags are deliberately outside this rule:
 * their array binding differs from Drizzle. Resolve lexical symbols so an SQL
 * parameter cannot accidentally exempt an unrelated same-named array. */
export function findUnsafeDrizzleAny(source,filename='source.ts'){
 const tree=ts.createSourceFile(filename,source,ts.ScriptTarget.Latest,true,/\.tsx$/u.test(filename)?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 const imports=tree.statements.filter(node=>ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier)&&node.moduleSpecifier.text==='drizzle-orm');
 if(!imports.length)return [];
 const options={noLib:true,noResolve:true};
 const host=ts.createCompilerHost(options);
 host.getSourceFile=name=>name===filename?tree:undefined;
 host.fileExists=name=>name===filename;
 host.readFile=name=>name===filename?source:undefined;
 const checker=ts.createProgram([filename],options,host).getTypeChecker();
 const tags=new Set(),sqlTypes=new Set(),namespaces=new Set(),found=[];
 for(const node of imports){
  const bindings=node.importClause?.namedBindings;
  if(bindings&&ts.isNamespaceImport(bindings))namespaces.add(checker.getSymbolAtLocation(bindings.name));
  else if(bindings&&ts.isNamedImports(bindings))for(const entry of bindings.elements){
   const imported=(entry.propertyName??entry.name).text,symbol=checker.getSymbolAtLocation(entry.name);
   if(imported==='sql')tags.add(symbol);
   if(imported==='SQL')sqlTypes.add(symbol);
  }
 }
 const isNamespaceProperty=(node,name)=>ts.isPropertyAccessExpression(node)&&node.name.text===name&&namespaces.has(checker.getSymbolAtLocation(node.expression));
 const isSQLType=node=>node&&ts.isTypeReferenceNode(node)&&(
  ts.isIdentifier(node.typeName)?sqlTypes.has(checker.getSymbolAtLocation(node.typeName)):
   ts.isQualifiedName(node.typeName)&&node.typeName.right.text==='SQL'&&namespaces.has(checker.getSymbolAtLocation(node.typeName.left)));
 const visit=node=>{
  if(ts.isTaggedTemplateExpression(node)&&(ts.isIdentifier(node.tag)?tags.has(checker.getSymbolAtLocation(node.tag)):isNamespaceProperty(node.tag,'sql'))&&ts.isTemplateExpression(node.template)){
   let before=node.template.head.text;
   for(const span of node.template.templateSpans){
    if(/\bANY\s*\(\s*$/iu.test(before)&&ts.isIdentifier(span.expression)){
     const symbol=checker.getSymbolAtLocation(span.expression);
     if(!symbol?.declarations?.some(declaration=>isSQLType(declaration.type))){
      const position=tree.getLineAndCharacterOfPosition(span.expression.getStart(tree));
      found.push({line:position.line+1,column:position.character+1,identifier:span.expression.text});
     }
    }
    before=span.literal.text;
   }
  }
  ts.forEachChild(node,visit);
 };
 visit(tree);return found;
}

export function assertSafeDrizzleAny(source,filename){
 const found=findUnsafeDrizzleAny(source,filename);
 if(found.length)throw Error(found.map(row=>`${filename}:${row.line}:${row.column} DRIZZLE_ANY_ARRAY_REQUIRED ${row.identifier}`).join('\n'));
 return found;
}
