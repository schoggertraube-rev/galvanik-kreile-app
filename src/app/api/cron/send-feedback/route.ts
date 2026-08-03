import { NextResponse } from 'next/server';
import { db } from '@/db';
import { eq, lte, and } from 'drizzle-orm';
import { feedbackMail } from '@/db/schema_marketing';

export async function GET(request: Request) {
  // Verifying token for cron is good practice, but skipping for demo
  try {
    const now = new Date();
    
    // Find alle "geplant" mit geplantFuer <= now
    const mailsToSend = await db.select().from(feedbackMail)
      .where(and(
        eq(feedbackMail.status, 'geplant'),
        lte(feedbackMail.geplantFuer, now)
      ));
      
    let sentCount = 0;
    
    for (const mail of mailsToSend) {
      // Mock: Send Email
      console.log(`[CRON] Sending feedback mail for order ${mail.auftragId} to customer ${mail.kundeId} with token ${mail.tokenFeedback}`);
      
      // Update status
      await db.update(feedbackMail)
        .set({ status: 'gesendet', gesendetAm: now })
        .where(eq(feedbackMail.id, mail.id));
        
      sentCount++;
    }
    
    return NextResponse.json({ ok: true, sent: sentCount, message: `Feedback-Pipeline: ${sentCount} Mails gesendet.` });
  } catch (error) {
    console.error("Error in send-feedback cron:", error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
