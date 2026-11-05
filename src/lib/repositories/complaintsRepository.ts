import {createComplaintRepository} from "@/modules/complaints/public";
export type {Complaint} from "@/modules/complaints/public";

/** The old path only composes the existing server boundary; it owns no data or writer. */
export const complaintsRepository=createComplaintRepository(async filter=>(await import("@/app/actions/complaints.actions")).getComplaints(filter));
