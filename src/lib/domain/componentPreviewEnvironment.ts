/** Deployment boundary only; authentication and ui_v45 still come from the
 * existing canonical bootstrap. Never a new role, credential or permission. */
export function componentPreviewEnvironmentAllowed(input:{deployment:string|undefined;node:string|undefined;database:string|undefined}):boolean{
 if(input.deployment==='production')return false;
 if(input.deployment==='preview')return true;
 if(input.node!=='development'&&input.node!=='test')return false;
 try{
  if(!input.database)return false;
  const url=new URL(input.database);
  return ['postgres:','postgresql:'].includes(url.protocol)&&url.hostname==='127.0.0.1'&&url.port==='54342'&&url.pathname==='/postgres';
 }catch{return false;}
}
