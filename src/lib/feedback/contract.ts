import { sanitizeTelemetryRoute } from '@/lib/telemetry/contract'

export type DeveloperFeedbackInput = {
  clientRequestId: string
  route: string
  message: string
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseDeveloperFeedback(value: unknown): DeveloperFeedbackInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_FEEDBACK')
  const input = value as Record<string, unknown>
  if (Object.keys(input).some((key) => !['clientRequestId', 'route', 'message'].includes(key))) throw new Error('INVALID_FEEDBACK')
  if (typeof input.clientRequestId !== 'string' || !UUID_V4.test(input.clientRequestId)) throw new Error('INVALID_FEEDBACK')
  if (typeof input.route !== 'string' || input.route.length > 200 || sanitizeTelemetryRoute(input.route) !== input.route) throw new Error('INVALID_FEEDBACK')
  if (typeof input.message !== 'string') throw new Error('INVALID_FEEDBACK')
  const message = input.message.replace(/\r\n?/g, '\n').trim()
  if (message.length < 3 || message.length > 2_000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(message)) {
    throw new Error('INVALID_FEEDBACK')
  }
  return { clientRequestId: input.clientRequestId, route: input.route, message }
}
