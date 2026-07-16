import { getCompanySettings } from "@/app/actions/company.actions";
import type { Order } from "@/lib/repositories/ordersRepository";

/**
 * Generates the HTML for the automated follow-up email.
 * This email is sent to request a Google review and photos of the installed parts.
 */
export async function generateFollowUpMailHtml(order: Order, customerName: string): Promise<string> {
  const settings = await getCompanySettings();
  if (!settings.configured) throw new Error("Firmendaten sind noch nicht konfiguriert.");
  
  // Customizing greeting
  const isFormal = !customerName.includes(" "); // very rough heuristic, better to have a formal flag
  const greeting = isFormal 
    ? `Sehr geehrte(r) ${customerName},`
    : `Hallo ${customerName},`;

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #2D3748; line-height: 1.6; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      <p style="font-size: 16px;">${greeting}</p>
      
      <p style="font-size: 15px;">
        vor einiger Zeit haben wir Ihren Auftrag <strong>${order.orderNumber}</strong> (${order.title}) abgeschlossen. 
        Wir hoffen, Sie sind mit dem Ergebnis unserer Arbeit vollkommen zufrieden und die Teile erstrahlen im neuen Glanz!
      </p>
      
      <p style="font-size: 15px;">
        Für uns als Handwerksbetrieb ist das Feedback unserer Kunden extrem wichtig. Wir würden uns riesig freuen, wenn Sie sich eine Minute Zeit nehmen könnten, um unsere Arbeit auf Google zu bewerten:
      </p>

      <p style="font-size: 15px;">
        Antworten Sie gern direkt auf diese E-Mail. Ein externer Bewertungslink ist derzeit nicht konfiguriert.
      </p>

      <div style="background-color: #F7FAFC; border-left: 4px solid #D4AF37; padding: 16px; margin: 25px 0; border-radius: 0 8px 8px 0;">
        <h3 style="margin-top: 0; color: #2D3748; font-size: 16px;">📸 Zeigen Sie uns das Ergebnis!</h3>
        <p style="font-size: 14px; margin-bottom: 0;">
          Wir lieben es zu sehen, was aus unseren veredelten Teilen wird! Wenn Sie die Teile bereits wieder eingebaut haben (z.B. an Ihrem Oldtimer, Motorrad oder Schmuckstück), 
          würden wir uns sehr über ein paar <strong>Fotos des fertigen Ergebnisses</strong> freuen.<br><br>
          Antworten Sie einfach auf diese E-Mail und hängen Sie Ihre Bilder an. Mit Ihrer Erlaubnis präsentieren wir die schönsten Ergebnisse gerne (natürlich anonym) auf unserer Website oder unseren Social-Media-Kanälen, um auch anderen Kunden zu zeigen, was möglich ist.
        </p>
      </div>

      <p style="font-size: 15px;">
        Vielen Dank für Ihr Vertrauen in unsere Arbeit. Sollte doch einmal etwas nicht zu 100% gepasst haben, zögern Sie bitte nicht, sich direkt bei uns zu melden – wir finden immer eine Lösung.
      </p>
      
      <p style="margin-top: 30px; font-size: 15px;">
        Herzliche Grüße aus der Werkstatt,<br>
        <strong>Ihr Team von ${settings.companyName}</strong>
      </p>

      <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 40px 0 20px 0;" />
      
      <div style="font-size: 11px; color: #718096; text-align: center;">
        Diese E-Mail wurde automatisch im Rahmen unserer Qualitätssicherung versendet.<br>
        <strong>${settings.companyName}</strong> | ${settings.street}, ${settings.zip} ${settings.city}<br>
        Tel: ${settings.phone} | <a href="mailto:${settings.email}" style="color: #718096;">${settings.email}</a> | <a href="${settings.website}" style="color: #718096;">${settings.website}</a>
      </div>
    </div>
  `;

  return html;
}
