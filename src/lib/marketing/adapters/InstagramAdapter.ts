import type { AktionVorschlag } from '../marketingTypes'

export interface ChannelPublishResult {
  success: boolean
  message: string
  touchpointId?: string
}

export interface ChannelAdapter {
  id: string
  isConnected(): Promise<boolean>
  publish(aktion: AktionVorschlag): Promise<ChannelPublishResult>
}

type StatusResponse = {
  state?: 'configured_local' | 'not_connected' | 'not_configured' | 'unavailable'
}

type PublishResponse = {
  ok?: boolean
  code?: string
  message?: string
  touchpointId?: string
}

const PUBLISH_MESSAGES: Record<string, string> = {
  ASSET_REQUIRED: 'Vor dem Veröffentlichen muss ein freigegebenes Bild mit der Aktion verknüpft sein.',
  ACTION_NOT_APPROVED: 'Die Aktion muss vor dem Veröffentlichen freigegeben werden.',
  ACTION_CONTENT_NOT_APPROVED: 'Die sichtbare Textvariante ist nicht als freigegebener Inhalt gespeichert. Bitte veröffentlichen Sie nur den freigegebenen Stand.',
  ASSET_NOT_APPROVED: 'Das verknüpfte Bild ist nicht für Marketing freigegeben.',
  CHANNEL_NOT_CONNECTED: 'Instagram ist nicht verknüpft.',
  PUBLISH_IN_PROGRESS: 'Die Veröffentlichung wird bereits verarbeitet.',
  PUBLISH_UNCERTAIN: 'Der Veröffentlichungsstatus ist unklar. Bitte prüfen Sie Instagram, bevor erneut veröffentlicht wird.',
  PUBLISH_EVIDENCE_MISSING: 'Für die Veröffentlichung fehlt der gespeicherte Provider-Beleg. Der Status muss geprüft werden.',
  CONFIGURATION_MISSING: 'Die Instagram-Verbindung ist serverseitig noch nicht vollständig konfiguriert.',
}
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class InstagramAdapter implements ChannelAdapter {
  id = 'instagram'

  async isConnected(): Promise<boolean> {
    try {
      const response = await fetch('/api/marketing/instagram/status', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      })
      if (!response.ok) return false
      const body = await response.json() as StatusResponse
      return body.state === 'configured_local'
    } catch {
      return false
    }
  }

  connect(): void {
    if (typeof window !== 'undefined') {
      window.location.assign('/api/marketing/instagram/connect')
    }
  }

  async publish(aktion: AktionVorschlag): Promise<ChannelPublishResult> {
    if (aktion.publishCapability !== 'ready' || aktion.status !== 'freigegeben' || aktion.kanal !== 'instagram') {
      return { success: false, message: aktion.publishReason || PUBLISH_MESSAGES.ACTION_NOT_APPROVED }
    }
    if (!aktion.assetId) {
      return { success: false, message: PUBLISH_MESSAGES.ASSET_REQUIRED }
    }
    const expectedCaption = [
      aktion.caption.trim(),
      aktion.hashtags.trim(),
    ].filter(Boolean).join('\n\n')
    if (!expectedCaption || expectedCaption.length > 2_200) {
      return { success: false, message: PUBLISH_MESSAGES.ACTION_CONTENT_NOT_APPROVED }
    }

    try {
      const response = await fetch('/api/marketing/instagram/publish', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId: aktion.id, assetId: aktion.assetId, expectedCaption }),
      })
      const body = await response.json() as PublishResponse
      if (response.ok && body.ok && typeof body.touchpointId === 'string' && UUID_PATTERN.test(body.touchpointId)) {
        return {
          success: true,
          message: body.message || 'Erfolgreich auf Instagram veröffentlicht.',
          touchpointId: body.touchpointId,
        }
      }
      if (response.ok && body.ok) {
        return { success: false, message: PUBLISH_MESSAGES.PUBLISH_EVIDENCE_MISSING }
      }
      return {
        success: false,
        message: (body.code && PUBLISH_MESSAGES[body.code]) || 'Instagram-Veröffentlichung fehlgeschlagen.',
      }
    } catch {
      return { success: false, message: 'Instagram-Veröffentlichung konnte nicht erreicht werden.' }
    }
  }
}

export const instagramAdapter = new InstagramAdapter()
