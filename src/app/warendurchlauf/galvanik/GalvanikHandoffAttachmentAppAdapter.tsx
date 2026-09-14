"use client";

import {
  finalizeGalvanikHandoffAttachmentAction,
  getGalvanikHandoffAttachmentOriginalAction,
  getGalvanikHandoffAttachmentsAction,
  reserveGalvanikHandoffAttachmentAction,
} from "@/app/warendurchlauf/actions";
import { supabase } from "@/lib/supabase/client";
import {
  GalvanikHandoffAttachmentPanel,
  type GalvanikHandoffAttachmentPanelProps,
  type GalvanikHandoffAttachmentPorts,
} from "@/modules/orders/public";

const ports: GalvanikHandoffAttachmentPorts = {
  read: getGalvanikHandoffAttachmentsAction,
  reserve: reserveGalvanikHandoffAttachmentAction,
  finalize: finalizeGalvanikHandoffAttachmentAction,
  readOriginal: getGalvanikHandoffAttachmentOriginalAction,
  async uploadSigned(input) {
    return supabase.storage.from(input.bucketId).uploadToSignedUrl(
      input.path,
      input.token,
      input.bytes,
      { contentType: input.contentType, upsert: false },
    );
  },
};

type Props = Omit<GalvanikHandoffAttachmentPanelProps, "ports">;

export function GalvanikHandoffAttachmentAppAdapter(props: Props) {
  return <GalvanikHandoffAttachmentPanel {...props} ports={ports} />;
}
