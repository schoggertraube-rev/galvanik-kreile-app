import { CustomerCardAppAdapter } from "../CustomerCardAppAdapter";
export default async function CustomerDetailPage({params}:{params:Promise<{id:string}>}){const{id}=await params;return <CustomerCardAppAdapter customerId={id}/>}
