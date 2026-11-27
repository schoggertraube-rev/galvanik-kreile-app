import 'server-only';

import bcrypt from 'bcryptjs';

type PinHashImplementation = {
  compare(pin: string, encoded: string): Promise<boolean>;
  hash(pin: string, cost: number): Promise<string>;
};

const nativeHashFormat = /^\$2[ab]\$\d{2}\$[./A-Za-z0-9]{53}$/;
let implementation: Promise<PinHashImplementation> | undefined;

function pinHashImplementation(): Promise<PinHashImplementation> {
  implementation ??= import('@node-rs/bcrypt').then(
    ({ compare, hash }) => ({ compare, hash: (pin, cost) => hash(pin, { cost }) }),
    () => {
      console.warn('[AUTH_BCRYPT_NATIVE_UNAVAILABLE]');
      return bcrypt;
    },
  );
  return implementation;
}

export async function comparePinHash(pin: string, encoded: string): Promise<boolean> {
  // Retain the existing behavior for legacy formats and incomplete hashes.
  const engine = nativeHashFormat.test(encoded) ? await pinHashImplementation() : bcrypt;
  return engine.compare(pin, encoded);
}

export async function hashPin(pin: string, cost: number): Promise<string> {
  return (await pinHashImplementation()).hash(pin, cost);
}
