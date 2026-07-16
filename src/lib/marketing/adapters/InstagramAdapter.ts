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
  connected?: boolean
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
  CONFIGURATION_MISSING: 'Die Instagram-Verbindung ist serverseitig noch nicht vollständig konfiguriert.',
}

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
      return body.connected === true
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
      if (response.ok && body.ok) {
        return {
          success: true,
          message: body.message || 'Erfolgreich auf Instagram veröffentlicht.',
          touchpointId: body.touchpointId,
        }
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
