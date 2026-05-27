const fs = require('fs');

try {
    let lines = fs.readFileSync('src/app/customers/page.tsx', 'utf8').split('\n');

    // Find imports insertion point
    const importIndex = lines.findIndex(l => l.includes('import { INITIAL_CUSTOMERS }'));
    if (importIndex > -1) {
        lines.splice(importIndex, 0, 'import { CustomerDetailView } from "@/components/customers/CustomerDetailView";');
        lines.splice(importIndex + 1, 0, 'import { Customer } from "@/lib/types/customer";');
        // update INITIAL_CUSTOMERS to be EXTENDED_CUSTOMERS
        lines[importIndex + 2] = 'import { EXTENDED_CUSTOMERS as INITIAL_CUSTOMERS } from "@/lib/mockCustomersExtended";';
    }

    // Remove the inline interface blocks
    const ifStart = lines.findIndex(l => l.includes('interface MockPart {'));
    const ifEnd = lines.findIndex(l => l.includes('const safe = (value: unknown) =>'));

    if (ifStart > -1 && ifEnd > -1) {
        lines.splice(ifStart, ifEnd - ifStart);
    }

    // Replace the RIGHT COLUMN block
    const newStart = lines.findIndex(l => l.includes('{/* RIGHT COLUMN: Detail View Panel (CRM Customer File) */}'));
    const newEnd = lines.findIndex(l => l.includes('{/* Simulated Add Customer Modal */}'));

    if (newStart > -1 && newEnd > -1) {
        const replacement = [
            '        {/* RIGHT COLUMN: Detail View Panel (CRM Customer File) */}',
            '        <div className="lg:col-span-2">',
            '          {selectedCustomer ? (',
            '            <CustomerDetailView customer={selectedCustomer as Customer} onEdit={handleStartEdit} />',
            '          ) : (',
            '            <Card className="border-dashed border-2 border-neutral-gray-100 text-center p-16 text-text-muted bg-white">',
            '              <div className="w-14 h-14 bg-bg-app-soft rounded-full border border-neutral-gray-100 flex items-center justify-center mx-auto mb-4 shadow-inner">',
            '                <ChevronRight className="h-7 w-7 text-text-muted rotate-90" />',
            '              </div>',
            '              <h3 className="font-bold text-navy-700 text-base font-serif">Kein Kunde ausgewählt</h3>',
            '              <p className="text-xs max-w-[280px] mx-auto mt-2 leading-relaxed">',
            '                Wähle einen Kunden aus der linken Liste, um das vollständige technische Profil, Preisvereinbarungen und Werkstücke einzusehen.',
            '              </p>',
            '            </Card>',
            '          )}',
            '        </div>',
            '      </div>' // <--- Fix for the missing grid closing tag!
        ].join('\n');
        
        lines.splice(newStart, newEnd - newStart, replacement);
    }

    let page = lines.join('\n');

    // Fix Typescript issues
    page = page.replaceAll('setNewCustPhone(customer.phone);', 'setNewCustPhone(customer.phone || "");');
    page = page.replaceAll('setNewCustEmail(customer.email);', 'setNewCustEmail(customer.email || "");');
    page = page.replaceAll('setNewCustAddress(customer.address === "Keine Adresse hinterlegt" ? "" : customer.address);', 'setNewCustAddress(customer.address === "Keine Adresse hinterlegt" ? "" : (customer.address || ""));');
    page = page.replaceAll('id: newId,', 'id: newId,\n        customerNumber: newId,');

    fs.writeFileSync('src/app/customers/page.tsx', page);
    console.log('page.tsx successfully rewritten.');
} catch (e) {
    console.error(e);
}
