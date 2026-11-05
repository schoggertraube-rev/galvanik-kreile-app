import {redirect} from 'next/navigation';
import {IntakeMessages,type IntakeMessagesPorts} from '@/modules/eingang/public';
import {hasAuthorizationArea,resolveAuthorization} from '@/lib/server/authorization';
import {getIntakeMessagesAction,selectIntakeConcernAction,finishIntakeUseAction,reopenIntakeAction,getIntakeAssignmentAction,assignIntakeCustomerAction} from '@/app/actions/eingang.actions';

export default async function NachrichtenPage({searchParams}:{searchParams:Promise<{gruppe?:string}>}){
 const result=await resolveAuthorization();if(!result.ok)redirect('/start');
 if(!hasAuthorizationArea(result.data,'mails'))return <p role="alert">Nachrichten benötigen das Recht Mails.</p>;
 const query=await searchParams,ports:IntakeMessagesPorts={list:getIntakeMessagesAction,select:selectIntakeConcernAction,finish:finishIntakeUseAction,reopen:reopenIntakeAction,assignment:{read:getIntakeAssignmentAction,assign:assignIntakeCustomerAction}};
 return <IntakeMessages key={query.gruppe??'all'} ports={ports} initialGroup={query.gruppe}/>;
}
