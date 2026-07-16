import React, { useEffect, useRef, useState } from 'react'
import { X, Send, Mail, RefreshCw } from 'lucide-react'
import { emailProvider } from '@/lib/email/resendAdapter'

type StatusTemplate = { id: string; templateKey: string; name: string }
type StatusMailOrder = {
  id: string
  orderNumber?: string | null
  status?: string | null
  statusText?: string | null
  customerEmail?: string | null
  customer?: { id?: string | null; name?: string | null; email?: string | null } | null
}

const DELIVERY_ERRORS: Record<string, string> = {
  CONFIGURATION_MISSING: 'Der E-Mail-Versand ist noch nicht serverseitig konfiguriert.',
  TEMPLATE_NOT_FOUND: 'Die ausgewählte Vorlage ist nicht mehr verfügbar.',
  TEMPLATE_INVALID: 'Die Vorlage passt nicht zu einem Status-Update und muss geprüft werden.',
  IN_PROGRESS: 'Dieser Versand wird bereits verarbeitet.',
  UNCERTAIN: 'Der Providerstatus ist unklar. Bitte nicht erneut senden, bevor der Versand geprüft wurde.',
  PROVIDER_REJECTED: 'Der E-Mail-Provider hat den Versand abgelehnt.',
  UNAVAILABLE: 'Der Versanddienst ist aktuell nicht verfügbar.',
  EMAIL_DELIVERY_UNAVAILABLE: 'Der Versanddienst ist aktuell nicht erreichbar.',
}

function newIdempotencyKey(orderId: string): string {
  return `status/${orderId}/${globalThis.crypto.randomUUID()}`
}

export function StatusMailDrawer({ orderData, onClose }: { orderData: StatusMailOrder; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [templates, setTemplates] = useState<StatusTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const idempotencyKey = useRef<string>('')

  const customerEmail = orderData.customer?.email || orderData.customerEmail

  useEffect(() => {
    const controller = new AbortController()
    idempotencyKey.current = newIdempotencyKey(orderData.id)
    async function fetchTemplates() {
      try {
        const response = await fetch('/api/email/templates?purpose=status', {
          cache: 'no-store',
          signal: controller.signal,
        })
        const body = await response.json() as { ok?: boolean; templates?: StatusTemplate[] }
        if (!response.ok || body.ok !== true || !Array.isArray(body.templates)) throw new Error('TEMPLATES_UNAVAILABLE')
        setTemplates(body.templates)
        setSelectedTemplate(body.templates[0]?.templateKey || '')
        if (body.templates.length === 0) setError('Es ist noch keine Status-Mail-Vorlage konfiguriert.')
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError('Die Status-Mail-Vorlagen konnten nicht geladen werden.')
      }
    }
    void fetchTemplates()
    return () => controller.abort()
  }, [orderData.id])

  async function handleSend() {
    if (!customerEmail) {
      setError('Beim Kunden ist keine E-Mail-Adresse hinterlegt.')
      return
    }
    if (!selectedTemplate) {
      setError('Es ist keine versandfähige Status-Mail-Vorlage verfügbar.')
      return
    }

    setLoading(true)
    setError(null)
    setMessage(null)
    const key = idempotencyKey.current || newIdempotencyKey(orderData.id)
    idempotencyKey.current = key
    const result = await emailProvider.send({
      to: customerEmail,
      templateKey: selectedTemplate,
      variables: {
        order_number: orderData.orderNumber || orderData.id,
        customer_name: orderData.customer?.name || 'Kunde',
        status: orderData.statusText || orderData.status || 'In Arbeit',
      },
      orderId: orderData.id,
      customerId: orderData.customer?.id || undefined,
      idempotencyKey: key,
    })

    if (result.success) {
      setMessage('Der Provider hat den Versand mit einer Nachrichten-ID bestätigt.')
      idempotencyKey.current = newIdempotencyKey(orderData.id)
      setTimeout(onClose, 2_000)
    } else {
      setError(DELIVERY_ERRORS[result.error || ''] || 'Die E-Mail wurde nicht als versendet bestätigt.')
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-[1000] bg-[rgba(26,31,46,0.42)] backdrop-blur-[8px] flex items-start justify-center pt-12 pb-12 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-[560px] mx-4 bg-[var(--ci-surface)] rounded-[18px] border border-[var(--ci-border)] shadow-[0_1px_2px_rgba(20,15,5,0.04),0_12px_32px_rgba(20,15,5,0.08)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--ci-border)] bg-[var(--ci-surface)]">
          <h2 className="text-lg font-medium text-[var(--ci-ink)]">Status-Update senden</h2>
          <button onClick={onClose} className="p-2 text-[var(--ci-ink-3)] hover:text-[var(--ci-ink)] transition-colors rounded-full hover:bg-[var(--ci-surface-soft)]" aria-label="Status-Mail schließen">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-[var(--ci-ink-3)]">Empfänger</label>
            <div className="p-3 bg-[var(--ci-surface)] border border-[var(--ci-border)] rounded-lg flex items-center gap-3">
              <Mail className="w-4 h-4 text-[var(--ci-ink-3)]" />
              <span className="text-sm font-medium text-[var(--ci-ink)]">{customerEmail || <span className="text-[var(--ci-danger)]">Fehlt</span>}</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-[var(--ci-ink-3)]">Vorlage</label>
            <select
              value={selectedTemplate}
              onChange={(event) => setSelectedTemplate(event.target.value)}
              className="w-full p-3 bg-[var(--ci-surface)] border border-[var(--ci-border)] rounded-lg text-sm text-[var(--ci-ink)] outline-none focus:border-[var(--ci-accent)]"
              disabled={templates.length === 0}
            >
              {templates.map((template) => (
                <option key={template.id} value={template.templateKey}>{template.name}</option>
              ))}
            </select>
          </div>

          {error && <div className="p-4 bg-[var(--ci-danger-soft)] text-[var(--ci-danger)] rounded-xl text-sm border border-red-200">{error}</div>}
          {message && <div className="p-4 bg-[var(--ci-success-soft)] text-[var(--ci-success)] rounded-xl text-sm border border-green-200">{message}</div>}
        </div>

        <div className="p-6 border-t border-[var(--ci-border)] bg-[var(--ci-surface)]">
          <button
            onClick={() => void handleSend()}
            disabled={loading || !customerEmail || !selectedTemplate}
            className="w-full flex items-center justify-center gap-2 bg-[var(--ci-ink)] text-[var(--ci-surface)] py-3 rounded-xl font-medium hover:bg-opacity-90 disabled:opacity-50 transition-all"
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            Senden
          </button>
        </div>
      </div>
    </div>
  )
}
