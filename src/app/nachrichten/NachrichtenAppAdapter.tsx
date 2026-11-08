'use client';
import {CommunicationPanel} from '@/components/communication/CommunicationPanel';
import {sendCustomerMailAction} from '@/app/actions/communications.actions';
import {changeOrderPickupNoticeAction} from '@/app/actions/orders.actions';
import {IntakeMessages,type IntakeMessagesPorts} from '@/modules/eingang/public';
import {getIntakeMessagesAction,selectIntakeConcernAction,finishIntakeUseAction,reopenIntakeAction,getIntakeAssignmentAction,assignIntakeCustomerAction,getIntakeDraftsAction,saveIntakeDraftAction,discardIntakeDraftAction} from '@/app/actions/eingang.actions';
const MailView:NonNullable<IntakeMessagesPorts['ReplyMailView']>=({customerId,composer})=><CommunicationPanel targetType="CUSTOMER" targetId={customerId} composer={composer}/>;
const ports:IntakeMessagesPorts={ReplyMailView:MailView,rejectComplaint:sendCustomerMailAction,replyDrafts:{readDrafts:getIntakeDraftsAction,saveDraft:saveIntakeDraftAction,discardDraft:discardIntakeDraftAction},requestPhotos:sendCustomerMailAction,handover:changeOrderPickupNoticeAction,list:getIntakeMessagesAction,select:selectIntakeConcernAction,finish:finishIntakeUseAction,reopen:reopenIntakeAction,assignment:{read:getIntakeAssignmentAction,assign:assignIntakeCustomerAction}};
export function NachrichtenAppAdapter({initialGroup,resumeDraftId}:{initialGroup?:string;resumeDraftId?:string}){return <IntakeMessages ports={ports} initialGroup={initialGroup} resumeDraftId={resumeDraftId}/>;}
