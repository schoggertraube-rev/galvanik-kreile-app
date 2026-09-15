"use client";

import {
  finalizeGalvanikHandoffAttachmentAction,
  getGalvanikHandoffAttachmentOriginalAction,
  getGalvanikHandoffAttachmentsAction,
  reserveGalvanikHandoffAttachmentAction,
} from "@/app/warendurchlauf/actions";
import {
  OrderStationAttachmentPanel,
  type OrderStationAttachmentPanelProps,
  type OrderStationAttachmentPorts,
} from "@/modules/orders/public";

type SignedUploadInput = Parameters<
  OrderStationAttachmentPorts["uploadSigned"]
>[0];

export async function uploadSignedOrderAttachment(input: SignedUploadInput) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl || input.bucketId !== "item-photos") {
    return {
      data: null,
      error: new Error("SIGNED_UPLOAD_CONFIGURATION_INVALID"),
    };
  }

  try {
    const endpoint = new URL(
      `/storage/v1/object/upload/sign/${input.bucketId}/${input.path}`,
      baseUrl,
    );
    endpoint.searchParams.set("token", input.token);
    const response = await fetch(endpoint, {
      method: "PUT",
      headers: {
        "cache-control": "max-age=3600",
        "content-type": input.contentType,
        "x-upsert": "false",
      },
      body: new Blob([input.bytes.slice().buffer as ArrayBuffer], {
        type: input.contentType,
      }),
    });
    if (!response.ok) {
      return { data: null, error: new Error("SIGNED_UPLOAD_FAILED") };
    }
    const payload = (await response.json()) as { Key?: unknown };
    if (payload.Key !== `${input.bucketId}/${input.path}`) {
      return {
        data: null,
        error: new Error("SIGNED_UPLOAD_READBACK_MISMATCH"),
      };
    }
    return { data: { path: input.path }, error: null };
  } catch {
    return { data: null, error: new Error("SIGNED_UPLOAD_UNAVAILABLE") };
  }
}

const ports: OrderStationAttachmentPorts = {
  read: getGalvanikHandoffAttachmentsAction,
  reserve: reserveGalvanikHandoffAttachmentAction,
  finalize: finalizeGalvanikHandoffAttachmentAction,
  readOriginal: getGalvanikHandoffAttachmentOriginalAction,
  uploadSigned: uploadSignedOrderAttachment,
};

type Props = Omit<OrderStationAttachmentPanelProps, "ports">;

export function GalvanikHandoffAttachmentAppAdapter(props: Props) {
  return <OrderStationAttachmentPanel {...props} ports={ports} />;
}
