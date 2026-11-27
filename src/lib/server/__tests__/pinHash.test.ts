// @vitest-environment node
import bcrypt from 'bcryptjs';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

afterEach(() => {
  vi.doUnmock('@node-rs/bcrypt');
  vi.resetModules();
  vi.restoreAllMocks();
});

it('verifies both existing bcrypt formats and generates a compatible cost-12 hash', async () => {
  const { comparePinHash, hashPin } = await import('../pinHash');
  const pin = '7249';
  const existing = await bcrypt.hash(pin, 12);
  const earlier = existing.replace(/^\$2b\$/, () => '$2a$');
  expect(await comparePinHash(pin, existing)).toBe(true);
  expect(await comparePinHash(pin, earlier)).toBe(true);
  expect(await comparePinHash('1846', existing)).toBe(false);

  const stored = await hashPin(pin, 12);
  expect(stored).toMatch(/^\$2[ab]\$12\$/);
  expect(await bcrypt.compare(pin, stored)).toBe(true);
});

it('uses the existing bcrypt implementation when the native binding cannot load', async () => {
  vi.doMock('@node-rs/bcrypt', () => { throw Error('TEST_NATIVE_BINDING_UNAVAILABLE'); });
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { comparePinHash, hashPin } = await import('../pinHash');
  const pin = '5637';
  const stored = await hashPin(pin, 12);
  expect(await comparePinHash(pin, stored)).toBe(true);
  expect(await comparePinHash('4289', stored)).toBe(false);
  expect(warn).toHaveBeenCalledExactlyOnceWith('[AUTH_BCRYPT_NATIVE_UNAVAILABLE]');
});
