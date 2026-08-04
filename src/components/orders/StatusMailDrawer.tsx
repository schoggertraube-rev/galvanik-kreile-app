import React, { useState, useEffect } from 'react';
import { X, Send, Mail, RefreshCw } from 'lucide-react';
import { emailProvider } from '@/lib/email/resendAdapter';
import { supabase } from '@/lib/supabase/client';

type StatusMailOrder = {
  id: string;
  orderNumber?: string | null;
  status?: string | null;
  statusText?: string | null;
  customerId?: string | null;
  customer?: {
    id: string;
    email?: string | null;
    name?: string | null;
  } | null;
  customerEmail?: string | null;
};

type EmailTemplate = {
  id: string;
  template_key: string;
  name: string;
};

export function StatusMailDrawer({ orderData, onClose }: { orderData: StatusMailOrder; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const customerEmail = orderData.customer?.email || orderData.customerEmail;

  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await supabase.from('email_templates').select('*').order('name');
      if (data) {
        setTemplates(data);
        if (data.length > 0) setSelectedTemplate(data[0].template_key);
      }
    };
    fetchTemplates();
  }, []);

  const handleSend = async () => {
    if (!customerEmail) {
      setError("Kunde hat keine E-Mail Adresse hinterlegt.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    const res = await emailProvider.send({
      to: customerEmail,
      templateKey: selectedTemplate,
      variables: {
        order_number: orderData.orderNumber || orderData.id,
        customer_name: orderData.customer?.name || "Kunde",
        status: orderData.statusText || orderData.status || "In Arbeit",
      },
      orderId: orderData.id,
      customerId: orderData.customer?.id
    });

    if (res.success) {
      setMessage("E-Mail wurde erfolgreich versendet.");
      setTimeout(onClose, 2000);
    } else {
      setError(res.error || "Fehler beim Senden der E-Mail");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-[rgba(26,31,46,0.42)] backdrop-blur-[8px] flex items-start justify-center pt-12 pb-12 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-[560px] mx-4 bg-[var(--ci-surface)] rounded-[18px] border border-[var(--ci-border)] shadow-[0_1px_2px_rgba(20,15,5,0.04),0_12px_32px_rgba(20,15,5,0.08)]" onClick={e => e.stopPropagation()}>
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--ci-border)] bg-[var(--ci-surface)]">
          <h2 className="text-lg font-medium text-[var(--ci-ink)]">Status-Update senden</h2>
          <button onClick={onClose} className="p-2 text-[var(--ci-ink-3)] hover:text-[var(--ci-ink)] transition-colors rounded-full hover:bg-[var(--ci-surface-soft)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-[var(--ci-ink-3)]">Empfänger</label>
            <div className="p-3 bg-[var(--ci-surface)] border border-[var(--ci-border)] rounded-lg flex items-center gap-3">
              <Mail className="w-4 h-4 text-[var(--ci-ink-3)]"/>
              <span className="text-sm font-medium text-[var(--ci-ink)]">{customerEmail || <span className="text-[var(--ci-danger)]">Fehlt</span>}</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-[var(--ci-ink-3)]">Vorlage</label>
            <select 
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="w-full p-3 bg-[var(--ci-surface)] border border-[var(--ci-border)] rounded-lg text-sm text-[var(--ci-ink)] outline-none focus:border-[var(--ci-accent)]"
            >
              {templates.map(t => (
                <option key={t.id} value={t.template_key}>{t.name}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="p-4 bg-[var(--ci-danger-soft)] text-[var(--ci-danger)] rounded-xl text-sm border border-red-200">
              {error}
            </div>
          )}

          {message && (
            <div className="p-4 bg-[var(--ci-success-soft)] text-[var(--ci-success)] rounded-xl text-sm border border-green-200">
              {message}
            </div>
          )}

        </div>

        <div className="p-6 border-t border-[var(--ci-border)] bg-[var(--ci-surface)]">
          <button 
            onClick={handleSend} 
            disabled={loading || !customerEmail}
            className="w-full flex items-center justify-center gap-2 bg-[var(--ci-ink)] text-[var(--ci-surface)] py-3 rounded-xl font-medium hover:bg-opacity-90 disabled:opacity-50 transition-all"
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5"/>}
            Senden
          </button>
        </div>

      </div>
    </div>
  );
}
