import { getCompanySettings } from "@/app/actions/company.actions";
import type { Order } from "@/lib/repositories/ordersRepository";

export async function generateDeliveryMailHtml(order: Order, customerName: string): Promise<string> {
  const settings = await getCompanySettings();
  
  const greeting = settings.emailGreeting || "Sehr geehrte Damen und Herren,";
  const pickupInfo = settings.emailPickupInfo || "Ihr Auftrag ist fertig und kann abgeholt werden.";
  const paymentInfo = settings.emailPaymentInfo || "";
  const agb = settings.emailAgbText || "";
  const footer = settings.emailFooter || "Mit freundlichen Grüßen,\nIhr Team";
  const notes = settings.emailAdditionalNotes || "";

  // Replace placeholders if any (e.g., {Kundenname}, {Auftragsnummer})
  const processText = (txt: string) => {
    if (!txt) return "";
    return txt
      .replace(/{Kundenname}/g, customerName)
      .replace(/{Auftragsnummer}/g, order.orderNumber)
      .replace(/\n/g, "<br/>");
  };

  const html = `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
      <p>${processText(greeting)}</p>
      
      <p>${processText(pickupInfo)}</p>
      
      <div style="background-color: #f9fafb; border-left: 4px solid #0f172a; padding: 15px; margin: 20px 0;">
        <strong>Auftragsdetails:</strong><br/>
        Auftragsnummer: ${order.orderNumber}<br/>
        Artikel: ${order.parts?.map(p => `${p.quantity}x ${p.name}`).join(', ') || 'siehe Lieferschein'}<br/>
      </div>

      ${paymentInfo ? `<p>${processText(paymentInfo)}</p>` : ''}
      ${notes ? `<p>${processText(notes)}</p>` : ''}
      
      <p style="margin-top: 30px;">
        ${processText(footer)}
      </p>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      
      <div style="font-size: 12px; color: #64748b;">
        <strong>${settings.companyName}</strong><br/>
        ${settings.street}, ${settings.zip} ${settings.city}<br/>
        Tel: ${settings.phone} | E-Mail: ${settings.email}<br/>
        ${settings.website}<br/>
        <br/>
        ${agb ? processText(agb) : ''}
      </div>
    </div>
  `;

  return html;
}
