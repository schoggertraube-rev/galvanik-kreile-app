"use client";

import {useMemo} from "react";
import {openIntakeOriginalAction} from "@/app/actions/eingang.actions";
import {uploadContextOriginal} from "@/components/attachments/DomainAttachmentPanel";
import {usePermissions} from "@/lib/auth/PermissionsContext";
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

const existingPorts = {
  read: getGalvanikHandoffAttachmentsAction,
  reserve: reserveGalvanikHandoffAttachmentAction,
  finalize: finalizeGalvanikHandoffAttachmentAction,
  readOriginal: getGalvanikHandoffAttachmentOriginalAction,
  uploadSigned: uploadSignedOrderAttachment,
};

export function useGalvanikHandoffAttachmentPorts() {
  const {offlineScope}=usePermissions();
  return useMemo<OrderStationAttachmentPorts>(()=>({
    ...existingPorts,
    capture:({orderId,itemId,expectedVersion,file})=>uploadContextOriginal({
      auftragId:orderId,teilId:itemId,fotoArt:'teile',phase:'arbeit',uebergabeVersion:expectedVersion,
    },file,offlineScope),
    async openIntake({orderId,fileId}) {
      const result=await openIntakeOriginalAction({orderId,fileId,clientEventId:crypto.randomUUID()});
      if(result.code!=='OK')return {code:'UNAVAILABLE' as const,message:result.message};
      if(result.original.id!==fileId||result.original.orderId!==orderId||!result.original.downloadUrl){
        return {code:'UNAVAILABLE' as const,message:'Downloadfreigabe war nicht exakt gebunden.'};
      }
      return {code:'OK' as const,downloadUrl:result.original.downloadUrl};
    },
  }),[offlineScope]);
}

type Props = Omit<OrderStationAttachmentPanelProps, "ports">;

export function GalvanikHandoffAttachmentAppAdapter(props: Props) {
  const ports=useGalvanikHandoffAttachmentPorts();
  return <OrderStationAttachmentPanel {...props} ports={ports} />;
}
