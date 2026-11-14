/** One browser-safe invoice intent contract shared by the existing writer and scoped queue. */
const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function plainObject(value:unknown):value is Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value);}

export type CreateInvoiceInput = {
  orderId: string;
  expectedVersion: number;
  clientEventId: string;
  agreement?: {
    id: string;
    version: number;
    type: "ausgabe_ohne_zahlung" | "zahlungsziel";
  };
  shippingCosts?: {
    invoiceId: string;
    expectedVersion: number;
    scope: string;
    expectedFeeCents: number;
  };
};

export function isCreateInvoiceInput(input: unknown): input is CreateInvoiceInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  const expected = ["clientEventId", "expectedVersion", "orderId"];
  const expectedWithAgreement = ["agreement", ...expected].sort();
  const actual = Object.keys(value).sort();
  const hasAgreement = actual.length === expectedWithAgreement.length
    && actual.every((key, index) => key === expectedWithAgreement[index]);
  const agreement = value.agreement;
  const hasShipping = actual.join(',') === [...expected,'shippingCosts'].sort().join(',');
  return (actual.length === expected.length
      && actual.every((key, index) => key === expected[index])
      || hasAgreement || hasShipping)
    && typeof value.orderId === "string"
    && value.orderId.trim() === value.orderId
    && value.orderId.length > 0
    && value.orderId.length <= 128
    && typeof value.clientEventId === "string"
    && UUID_PATTERN.test(value.clientEventId)
    && typeof value.expectedVersion === "number"
    && Number.isSafeInteger(value.expectedVersion)
    && value.expectedVersion > 0
    && (!hasShipping || isInvoiceShippingCostsInput(value.shippingCosts,value.orderId as string))
    && (!hasAgreement || (
      agreement !== null
      && typeof agreement === "object"
      && !Array.isArray(agreement)
      && Object.keys(agreement as Record<string, unknown>).sort().join(",") === "id,type,version"
      && typeof (agreement as Record<string, unknown>).id === "string"
      && UUID_PATTERN.test((agreement as Record<string, unknown>).id as string)
      && typeof (agreement as Record<string, unknown>).version === "number"
      && Number.isSafeInteger((agreement as Record<string, unknown>).version)
      && ((agreement as Record<string, unknown>).version as number) > 0
      && ((agreement as Record<string, unknown>).type === "ausgabe_ohne_zahlung"
        || (agreement as Record<string, unknown>).type === "zahlungsziel")
    ));
}

export function isInvoiceShippingCostsInput(value:unknown,orderId:string):value is NonNullable<CreateInvoiceInput['shippingCosts']>{
  if(!plainObject(value)||Object.keys(value).sort().join(',')!=='expectedFeeCents,expectedVersion,invoiceId,scope')return false;
  return typeof value.invoiceId==='string'&&UUID_PATTERN.test(value.invoiceId)
    &&typeof value.expectedVersion==='number'&&Number.isSafeInteger(value.expectedVersion)&&value.expectedVersion>0
    &&typeof value.expectedFeeCents==='number'&&Number.isSafeInteger(value.expectedFeeCents)&&value.expectedFeeCents>=0
    &&typeof value.scope==='string'&&(value.scope==='order:'+orderId
      ||value.scope.startsWith('sendung:')&&UUID_PATTERN.test(value.scope.slice(8))&&value.scope===value.scope.toLowerCase());
}
