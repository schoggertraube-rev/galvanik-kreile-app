import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const action = readFileSync(resolve(process.cwd(), 'src/app/actions/start.actions.ts'), 'utf8')
const client = readFileSync(resolve(process.cwd(), 'src/components/start/StartScreenClient.tsx'), 'utf8')

describe('PIN reset request truth boundary', () => {
  it('records a rate-limited audit receipt without using the arbitrary UI event sink', () => {
    expect(action).toContain('consume_security_rate_limit')
    expect(action).toContain("'pin_reset_request_recorded'")
    expect(action).toContain('securityRateLimitSubjectHash')
    expect(action).not.toContain('uiEventsTable')
    expect(action).not.toContain('pin_reset_requested')
  })

  it('does not claim that an administrator was notified', () => {
    expect(client).toContain('Eine automatische Benachrichtigung ist noch nicht angebunden')
    expect(client).toContain('PIN-Hilfe speichern')
    expect(client).not.toContain('>Administrator kontaktieren</button>')
    expect(client).not.toContain('Der Administrator wurde benachrichtigt')
  })
})
