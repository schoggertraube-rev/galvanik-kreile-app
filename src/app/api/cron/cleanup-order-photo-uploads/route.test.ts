import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cleanupExpiredOrderPhotoUploads: vi.fn(),
}));

vi.mock('@/lib/server/orderPhotoStorage', () => ({
  cleanupExpiredOrderPhotoUploads: mocks.cleanupExpiredOrderPhotoUploads,
}));

describe('order photo cleanup cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'cron-secret';
    mocks.cleanupExpiredOrderPhotoUploads.mockResolvedValue({ cleaned: 2, failed: 0 });
  });

  it('rejects requests without the configured bearer secret', async () => {
    const { GET } = await import('./route');
    const response = await GET(new Request('https://example.test/api/cron/cleanup-order-photo-uploads'));

    expect(response.status).toBe(401);
    expect(mocks.cleanupExpiredOrderPhotoUploads).not.toHaveBeenCalled();
  });

  it('runs cleanup only for the configured Vercel cron secret', async () => {
    const { GET } = await import('./route');
    const response = await GET(new Request(
      'https://example.test/api/cron/cleanup-order-photo-uploads',
      { headers: { authorization: 'Bearer cron-secret' } },
    ));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, cleaned: 2, failed: 0 });
    expect(mocks.cleanupExpiredOrderPhotoUploads).toHaveBeenCalledOnce();
  });
});
