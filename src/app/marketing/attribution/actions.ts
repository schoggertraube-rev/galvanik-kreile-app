'use server'

import { db } from '@/db'
import { aktion, attribution, kanal, touchpoint } from '@/db/schema_marketing'
import { requireMarketingRead } from '@/lib/server/marketingAuthorization'

export type ChannelAttribution = {
  kanal: string
  plannedBudget: number
  actualSpend: number | null
  leads: number
  auftraege: number
  umsatz: number
  roi: number | null
  evidence: {
    touchpoints: number
    attributionRows: number
  }
}

export async function getAttributionData(): Promise<ChannelAttribution[]> {
  await requireMarketingRead()
  const [channels, actions, touchpoints, attributions] = await Promise.all([
    db.select().from(kanal),
    db.select().from(aktion),
    db.select().from(touchpoint),
    db.select().from(attribution),
  ])
  const actionsById = new Map(actions.map((entry) => [entry.id, entry]))

  return channels.map((channel) => {
    const channelTouchpoints = touchpoints.filter((entry) => entry.kanalId === channel.id)
    const touchpointIds = new Set(channelTouchpoints.map((entry) => entry.id))
    const channelAttributions = attributions.filter((entry) => entry.touchpointId && touchpointIds.has(entry.touchpointId))
    const actionIds = new Set(channelTouchpoints.flatMap((entry) => entry.aktionId ? [entry.aktionId] : []))
    const plannedBudget = [...actionIds].reduce((sum, actionId) => sum + (Number(actionsById.get(actionId)?.kostenBudget) || 0), 0)
    const revenue = channelAttributions.reduce((sum, entry) => sum + (Number(entry.umsatz) || 0), 0)

    return {
      kanal: channel.name,
      plannedBudget,
      actualSpend: null,
      leads: new Set(channelAttributions.flatMap((entry) => entry.leadId ? [entry.leadId] : [])).size,
      auftraege: new Set(channelAttributions.flatMap((entry) => entry.auftragId ? [entry.auftragId] : [])).size,
      umsatz: revenue,
      roi: null,
      evidence: {
        touchpoints: channelTouchpoints.length,
        attributionRows: channelAttributions.length,
      },
    }
  })
}
