// PL13.11.16:05: reachability only, no data, identity, session or provider access.
export const dynamic='force-dynamic';
export async function GET(){return new Response(null,{status:204,headers:{'Cache-Control':'no-store, max-age=0'}});}
