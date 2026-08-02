import { cleanupExpiredOrderPhotoUploads } from '@/lib/server/orderPhotoStorage';

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await cleanupExpiredOrderPhotoUploads();
    return Response.json({ ok: true, ...result });
  } catch (error: unknown) {
    console.error('Order photo cleanup cron failed:', error);
    return Response.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
