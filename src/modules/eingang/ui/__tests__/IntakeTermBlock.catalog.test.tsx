import {render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {IntakeTermBlock} from '../IntakeTermBlock';

it('shows the supplied missing catalog time and offers the existing catalog only with the projected target',()=>{
 const action=vi.fn();
 const facts=[{positionKey:'test-position',catalogServiceId:null,message:'Durchlaufzeit für TEST Teil fehlt'}];
 const props={handover:'PICKUP',handoverOrigin:null,onHandover:action,weeks:null,onWeeks:action,
  term:null,loading:false,failed:false,date:'2026-11-30',onDate:action,choice:null,onProposal:action,
  onOffer:action,onKeep:action,onChange:action,canDecide:true,quote:false,expired:false,surfacePending:false,missingLeadTimes:facts} as const;
 const {rerender}=render(<IntakeTermBlock {...props}/>);
 expect(screen.getByText(facts[0].message)).toBeVisible();
 expect(screen.queryByRole('link',{name:'Leistungskatalog'})).not.toBeInTheDocument();
 rerender(<IntakeTermBlock {...props} catalogHref="/settings?tab=catalog"/>);
 const link=screen.getByRole('link',{name:'Leistungskatalog'});
 expect(link).toHaveAttribute('href','/settings?tab=catalog');
 expect(link).toHaveAttribute('target','_blank');
 expect(screen.queryByRole('button',{name:/anbieten/i})).not.toBeInTheDocument();
 rerender(<IntakeTermBlock {...props} catalogHref="/settings?tab=catalog" loading/>);
 expect(screen.queryByText(facts[0].message)).not.toBeInTheDocument();
});
