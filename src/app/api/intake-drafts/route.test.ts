import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const reader=vi.hoisted(()=>vi.fn());
vi.mock('@/app/actions/eingang.actions',()=>({getIntakeDraftsAction:reader}));

beforeEach(()=>reader.mockReset());

describe('GET /api/intake-drafts',()=>{
  it.each([
    ['UNAUTHENTICATED',401],
    ['FORBIDDEN',403],
  ] as const)('keeps %s denied with HTTP %i',async(code,status)=>{
    const result={code,message:'TEST denied'};
    reader.mockResolvedValue(result);
    const response=await GET();
    expect(response.status).toBe(status);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Vary')).toBe('Cookie');
    expect(await response.json()).toEqual(result);
  });
  it('returns the authorized draft reader without a second source',async()=>{
    const result={code:'OK',drafts:[{id:'TEST-draft'}]};
    reader.mockResolvedValue(result);
    const response=await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(reader).toHaveBeenCalledTimes(1);
  });
});
