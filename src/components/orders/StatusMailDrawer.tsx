import React, { useCallback, useEffect, useRef, useState } from 'react'
import { X, Send, Mail, RefreshCw } from 'lucide-react'
import { emailProvider } from '@/lib/email/resendAdapter'

type StatusTemplate = { id: string; templateKey: string; name: string }
type StatusDelivery = {
  id: string
  status: string
  subject: string
  createdAt: string
  completedAt: string | null
  providerConfirmed: boolean
  errorCode: string | null
}
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

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  queued: 'wartet',
  sending: 'wird versendet',
  sent: 'vom Provider angenommen',
  delivered: 'zugestellt',
  opened: 'geöffnet',
  bounced: 'unzustellbar',
  complained: 'Beschwerde',
  failed: 'fehlgeschlagen',
  uncertain: 'Status ungeklärt',
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
  const [writeCapability, setWriteCapability] = useState<{ available: boolean; reason: string | null }>({
    available: false,
    reason: 'Versandfähigkeit wurde noch nicht vom Server bestätigt.',
  })
  const [deliveries, setDeliveries] = useState<StatusDelivery[]>([])
  const [historyState, setHistoryState] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [historyMessage, setHistoryMessage] = useState<string | null>(null)
  const [historyTruncated, setHistoryTruncated] = useState(false)
  const idempotencyKey = useRef<string>('')

  const customerEmail = orderData.customer?.email || orderData.customerEmail

  const loadHistory = useCallback(async (signal?: AbortSignal) => {
    await Promise.resolve()
    if (signal?.aborted) return
    setHistoryState('loading')
    try {
      const response = await fetch(`/api/email/deliveries?orderId=${encodeURIComponent(orderData.id)}`, {
        cache: 'no-store',
        signal,
      })
      const body = await response.json() as {
        ok?: boolean
        deliveries?: StatusDelivery[]
        truncated?: boolean
        reason?: string
      }
      if (!response.ok || body.ok !== true || !Array.isArray(body.deliveries)) {
        throw new Error(body.reason || 'Versandhistorie ist nicht verfügbar.')
      }
      setDeliveries(body.deliveries)
      setHistoryTruncated(body.truncated === true)
      setHistoryMessage(null)
      setHistoryState('ready')
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      setDeliveries([])
      setHistoryTruncated(false)
      setHistoryMessage(cause instanceof Error ? cause.message : 'Versandhistorie ist nicht verfügbar.')
      setHistoryState('unavailable')
    }
  }, [orderData.id])

  useEffect(() => {
    const controller = new AbortController()
    idempotencyKey.current = newIdempotencyKey(orderData.id)
    async function fetchTemplates() {
      try {
        const response = await fetch('/api/email/templates?purpose=status', {
          cache: 'no-store',
          signal: controller.signal,
        })
        const body = await response.json() as {
          ok?: boolean
          templates?: StatusTemplate[]
          writeCapability?: { available: boolean; reason: string | null }
        }
        if (!response.ok || body.ok !== true || !Array.isArray(body.templates)) throw new Error('TEMPLATES_UNAVAILABLE')
        setTemplates(body.templates)
        setWriteCapability(body.writeCapability || { available: false, reason: 'Versandfähigkeit wurde vom Server nicht bestätigt.' })
        setSelectedTemplate(body.templates[0]?.templateKey || '')
        if (body.templates.length === 0) setError('Es ist noch keine Status-Mail-Vorlage konfiguriert.')
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setWriteCapability({ available: false, reason: 'Status-Mail-Vertrag konnte nicht geladen werden.' })
        setError('Die Status-Mail-Vorlagen konnten nicht geladen werden.')
      }
    }
    void fetchTemplates()
    const historyTimer = window.setTimeout(() => void loadHistory(controller.signal), 0)
    return () => {
      window.clearTimeout(historyTimer)
      controller.abort()
    }
  }, [loadHistory, orderData.id])

  async function handleSend() {
    if (!writeCapability.available) {
      setError(writeCapability.reason || 'Status-Mail-Versand ist nicht bestätigt verfügbar.')
      return
    }
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
      templateKey: selectedTemplate,
      orderId: orderData.id,
      idempotencyKey: key,
    })

    if (result.success) {
      setMessage('Der Provider hat den Versand mit einer Nachrichten-ID bestätigt.')
      idempotencyKey.current = newIdempotencyKey(orderData.id)
      await loadHistory()
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

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-[var(--ci-ink-3)]">Bestätigte Versandhistorie</div>
            {historyState === 'loading' && <div className="text-sm text-[var(--ci-ink-3)]">Historie wird geladen …</div>}
            {historyState === 'unavailable' && (
              <div role="status" className="p-3 bg-amber-50 text-amber-900 rounded-lg text-sm border border-amber-200">
                {historyMessage} Dies ist nicht als leere Historie zu verstehen.
              </div>
            )}
            {historyState === 'ready' && deliveries.length === 0 && (
              <div className="p-3 bg-[var(--ci-surface-soft)] rounded-lg text-sm text-[var(--ci-ink-3)]">
                Für diesen Auftrag sind keine Status-Mail-Belege gespeichert.
              </div>
            )}
            {historyState === 'ready' && deliveries.map((delivery) => (
              <div key={delivery.id} className="p-3 bg-[var(--ci-surface-soft)] border border-[var(--ci-border)] rounded-lg text-sm">
                <div className="font-medium text-[var(--ci-ink)]">{delivery.subject}</div>
                <div className="text-xs text-[var(--ci-ink-3)] mt-1">
                  {new Date(delivery.createdAt).toLocaleString('de-DE')} · {DELIVERY_STATUS_LABELS[delivery.status] || delivery.status}
                  {delivery.providerConfirmed ? ' · Provider-ID bestätigt' : ''}
                </div>
              </div>
            ))}
            {historyState === 'ready' && historyTruncated && (
              <div className="text-xs text-amber-800">Es werden nur die neuesten 20 Versandbelege angezeigt.</div>
            )}
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
          {!error && !writeCapability.available && (
            <div role="status" className="p-4 bg-amber-50 text-amber-900 rounded-xl text-sm border border-amber-200">
              {writeCapability.reason} Es wurde nichts versendet.
            </div>
          )}
          {message && <div className="p-4 bg-[var(--ci-success-soft)] text-[var(--ci-success)] rounded-xl text-sm border border-green-200">{message}</div>}
        </div>

        <div className="p-6 border-t border-[var(--ci-border)] bg-[var(--ci-surface)]">
          <button
            onClick={() => void handleSend()}
            disabled={loading || !customerEmail || !selectedTemplate || !writeCapability.available}
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
