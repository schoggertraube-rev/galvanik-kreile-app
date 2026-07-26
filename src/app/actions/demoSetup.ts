'use server'

export async function initializeDemoIfNeeded() {
  return { initialized: false, reason: 'retired_mock_seed' } as const
}
