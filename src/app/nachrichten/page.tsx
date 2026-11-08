import {redirect} from 'next/navigation';
import {hasAuthorizationArea,resolveAuthorization} from '@/lib/server/authorization';
import {NachrichtenAppAdapter} from './NachrichtenAppAdapter';

export default async function NachrichtenPage({searchParams}:{searchParams:Promise<{gruppe?:string;antwortEntwurf?:string}>}){
 const result=await resolveAuthorization();if(!result.ok)redirect('/start');
 if(!hasAuthorizationArea(result.data,'mails'))return <p role="alert">Nachrichten benötigen das Recht Mails.</p>;
 const query=await searchParams;
 return <NachrichtenAppAdapter key={(query.gruppe??'all')+':'+(query.antwortEntwurf??'')} initialGroup={query.gruppe} resumeDraftId={query.antwortEntwurf}/>;
}
