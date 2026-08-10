"use server";

export type PhoneNoteCategory = "pickup_request" | "status_question" | "payment_question" | "complaint" | "callback" | "new_order_intake" | "new_customer_request" | "quote_request" | "email_review" | "attachment_review" | "photo_review" | "document_review" | "appointment_request" | "deadline_request" | "material_or_surface_info" | "shipping_question" | "technical_question" | "general";
export interface AIAnalysisInput { text: string; knownFacts: { customerCandidates: string[]; orderCandidates: string[]; selectedCustomer: string | null; selectedOrders: string[]; detectedDate: string | null; paymentKnown: string | null; }; }
export interface PhoneNoteAiAnalysis { category: PhoneNoteCategory; material: string | null; surfaceRequested: string | null; suggestedAnswer: string; overallConfidence: number; }

export async function analyzePhoneNoteWithAI(input: AIAnalysisInput): Promise<PhoneNoteAiAnalysis | null> {
  void input;
  return null;
}
