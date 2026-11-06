import type {ComplaintFilter,ComplaintReadResult} from './contract';

/** Compatibility composition port: errors propagate; a failed read is never an empty list. */
export function createComplaintRepository(read:(filter?:ComplaintFilter)=>Promise<ComplaintReadResult>){
 const list=async(filter?:ComplaintFilter)=>{const result=await read(filter);if(result.code!=='OK')throw new Error(result.message+' ['+result.code+']');return result.complaints;};
 return {getAll:()=>list(),getByCustomer:(customerId:string)=>list({customerId})};
}
