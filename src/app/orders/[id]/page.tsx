import { OrderCardAppAdapter } from "../OrderCardAppAdapter";
export default async function OrderDetailPage({params}:{params:Promise<{id:string}>}){const{id}=await params;return <OrderCardAppAdapter orderId={id} fallbackHref="/orders"/>}
