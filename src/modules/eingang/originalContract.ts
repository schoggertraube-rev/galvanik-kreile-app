import type {GoodsReceiptFailure} from './goodsReceiptContract';
export type OriginalReadResult={code:'OK';original:{id:string;itemId:string;name:string;mime:string;bytes:number;sha256:string;customerId:string|null;orderId:string|null;previewable:boolean;url:string|null;downloadUrl:string|null;restricted:boolean}}|GoodsReceiptFailure|{code:'FILE_BLOCKED';message:string};
export type OriginalConfirmResult={code:'OK';count:number;replayed:boolean}|GoodsReceiptFailure;
