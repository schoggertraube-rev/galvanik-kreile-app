"use server";
import {unstable_noStore as noStore} from "next/cache";
import {readComplaints} from "@/modules/complaints/server-public";
import type {ComplaintFilter} from "@/modules/complaints/public";

export async function getComplaints(filter?:ComplaintFilter){noStore();return readComplaints(filter);}
export async function getByOrder(orderId:string){noStore();return readComplaints({orderId});}
