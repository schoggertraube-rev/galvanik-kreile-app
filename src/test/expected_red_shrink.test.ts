import {describe, expect, it} from 'vitest';
import {checkRedListShrink, RED_LISTS} from '../../scripts/quality/check-expected-red-shrink.mjs';

const path = RED_LISTS[1];
const entry = {paket: 'TEST', grund: 'Synthetischer PL-Testgrund'};
const base = JSON.stringify({H1: entry, H2: entry});

describe('PL S14a(c)V2 expected-red lists may only shrink', () => {
  it.each([base, JSON.stringify({H1: entry}), '{}', JSON.stringify({H2: {grund: entry.grund, paket: entry.paket}, H1: entry})])(
    'accepts an unchanged entry or removal independent of property order: %s', candidate => {
      expect(() => checkRedListShrink(base, candidate, path)).not.toThrow();
    },
  );
  it.each([
    [{H1: entry, H3: entry}, 'H3'],
    [{H1: {...entry, grund: 'Changed'}}, 'H1'],
    [{H1: {...entry, erwarteterWert: 'TEST'}}, 'H1'],
  ])('rejects an added or modified exception: %j', (candidate, id) => {
    expect(() => checkRedListShrink(base, JSON.stringify(candidate), path)).toThrow('EXPECTED_RED_MAY_ONLY_SHRINK:' + id);
  });
  it('rejects removal of a named text restriction from an exception', () => {
    expect(() => checkRedListShrink(JSON.stringify({H1: {...entry, erwarteterWert: 'TEST'}}), JSON.stringify({H1: entry}), path))
      .toThrow('EXPECTED_RED_MAY_ONLY_SHRINK:H1');
  });
  it.each(['{', '[]', 'null', JSON.stringify({H1: {paket: 'TEST'}})])('fails closed on an invalid list: %s', candidate => {
    expect(() => checkRedListShrink(base, candidate, path)).toThrow('EXPECTED_RED_INVALID_');
  });
  it('accepts the initial empty DOM list, but still validates its schema', () => {
    expect(() => checkRedListShrink(null, '{}', path)).not.toThrow();
    expect(() => checkRedListShrink(null, JSON.stringify({H1: {paket: 'TEST'}}), path)).toThrow('EXPECTED_RED_INVALID_ENTRY:H1');
  });
});
